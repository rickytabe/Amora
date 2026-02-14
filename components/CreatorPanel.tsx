import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Save,
  X,
  User,
  MessageCircle,
  Layout,
  Copy,
  Upload,
  RefreshCw,
  ImagePlus,
  Trash2,
  Plus,
  LogIn,
  Sparkles,
  Mail,
} from 'lucide-react';
import { SurpriseMode, MUSIC_TRACKS, MODE_TEXT_DEFAULTS, DEFAULT_PERSONALIZATION } from '../constants';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';

interface CreatorPanelProps {
  onSaveDraft: (config: any) => void;
  onPublish: (config: any) => Promise<{ slug: string; editToken: string } | null>;
  onUpdate: (config: any) => Promise<boolean>;
  onUpdatePublished: (config: any, slug: string, token: string) => Promise<boolean>;
  onCancel: () => void;
  currentConfig: any;
  publishedSlug: string | null;
  hasEditToken: boolean;
}

type UploadStatus = 'queued' | 'uploading' | 'error';

interface UploadPreview {
  id: string;
  name: string;
  previewUrl: string;
  status: UploadStatus;
  note?: string;
}

interface TemplateRecord {
  id: string;
  name: string;
  config: any;
  updated_at: string;
  published_slug: string | null;
  edit_token: string | null;
}

const MAX_IMAGES = 5;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const STORAGE_BUCKET = 'LoveBids_Pics';
const UPLOAD_CONCURRENCY = 2;
const UPLOAD_RETRIES = 3;
const MAX_DIMENSION = 1920;
const EASY_ACCEPT_TEXT = 'I am in.';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

const optimizeImage = async (file: File): Promise<File | null> => {
  if (!file.type.startsWith('image/')) return null;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file.size <= MAX_FILE_SIZE_BYTES ? file : null;
  }

  try {
    const maxSide = Math.max(bitmap.width, bitmap.height);
    const scale = maxSide > MAX_DIMENSION ? MAX_DIMENSION / maxSide : 1;
    const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
    const targetHeight = Math.max(1, Math.round(bitmap.height * scale));

    if (file.size <= MAX_FILE_SIZE_BYTES && scale === 1) return file;

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file.size <= MAX_FILE_SIZE_BYTES ? file : null;

    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    const qualities = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5];
    let chosenBlob: Blob | null = null;

    for (const quality of qualities) {
      const blob = await canvasToBlob(canvas, 'image/webp', quality);
      if (!blob) continue;
      if (!chosenBlob || blob.size < chosenBlob.size) chosenBlob = blob;
      if (blob.size <= MAX_FILE_SIZE_BYTES) {
        chosenBlob = blob;
        break;
      }
    }

    if (!chosenBlob || chosenBlob.size > MAX_FILE_SIZE_BYTES) return null;
    const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
    return new File([chosenBlob], `${baseName}.webp`, { type: 'image/webp' });
  } finally {
    bitmap.close();
  }
};

function CreatorPanel({
  onSaveDraft,
  onPublish,
  onUpdatePublished,
  onCancel,
  currentConfig,
  publishedSlug,
  hasEditToken,
}: CreatorPanelProps) {
  const normalizeConfig = (cfg: any) => ({
    ...cfg,
    UPLOADED_IMAGES: Array.isArray(cfg?.UPLOADED_IMAGES) ? cfg.UPLOADED_IMAGES : [],
    ADMIRER_ACCEPT_TEMPLATE: cfg?.ADMIRER_ACCEPT_TEMPLATE || EASY_ACCEPT_TEXT,
  });

  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authStatus, setAuthStatus] = useState('');

  const [isTemplatesLoading, setIsTemplatesLoading] = useState(false);
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('My Template');

  const [form, setForm] = useState(normalizeConfig(currentConfig));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploadPreviews, setUploadPreviews] = useState<UploadPreview[]>([]);
  const previewUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setIsAuthLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsAuthLoading(false);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current = [];
    };
  }, []);

  const activeTemplate = useMemo(
    () => templates.find((t) => t.id === activeTemplateId) || null,
    [templates, activeTemplateId]
  );

  const shareUrl = useMemo(() => {
    const slug = activeTemplate?.published_slug || publishedSlug;
    if (!slug) return '';
    return `${window.location.origin}/s/${slug}`;
  }, [activeTemplate?.published_slug, publishedSlug]);

  const loadTemplateList = async (seedOnEmpty = true) => {
    if (!session?.user?.id) return;
    setIsTemplatesLoading(true);

    const { data, error } = await supabase
      .from('creator_templates')
      .select('id, name, config, updated_at, published_slug, edit_token')
      .order('updated_at', { ascending: false });

    if (error) {
      setStatus(`Template load failed: ${error.message}`);
      setIsTemplatesLoading(false);
      return;
    }

    const rows = (data || []) as TemplateRecord[];
    if (rows.length > 0) {
      setTemplates(rows);
      setActiveTemplateId(rows[0].id);
      setTemplateName(rows[0].name);
      const cfg = normalizeConfig(rows[0].config);
      setForm(cfg);
      onSaveDraft(cfg);
      setIsTemplatesLoading(false);
      return;
    }

    if (!seedOnEmpty) {
      setTemplates([]);
      setActiveTemplateId('');
      setIsTemplatesLoading(false);
      return;
    }

    const seedName = currentConfig?.LOVED_ONE_NAME ? `${currentConfig.LOVED_ONE_NAME} Template` : 'My Template';
    const { data: inserted, error: insertError } = await supabase
      .from('creator_templates')
      .insert({
        user_id: session.user.id,
        name: seedName,
        config: normalizeConfig(currentConfig),
      })
      .select('id, name, config, updated_at, published_slug, edit_token')
      .single();

    if (insertError || !inserted) {
      setStatus(`Template creation failed: ${insertError?.message || 'Unknown error'}`);
      setIsTemplatesLoading(false);
      return;
    }

    const template = inserted as TemplateRecord;
    setTemplates([template]);
    setActiveTemplateId(template.id);
    setTemplateName(template.name);
    const cfg = normalizeConfig(template.config);
    setForm(cfg);
    onSaveDraft(cfg);
    setStatus(`Created "${template.name}".`);
    setIsTemplatesLoading(false);
  };

  useEffect(() => {
    if (!session?.user?.id) {
      setTemplates([]);
      setActiveTemplateId('');
      return;
    }
    loadTemplateList(true).catch(() => {
      setStatus('Failed to initialize templates.');
      setIsTemplatesLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const signInAnonymously = async () => {
    setIsAuthSubmitting(true);
    setAuthStatus('');
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      setAuthStatus(`Sign in failed: ${error.message}`);
    } else {
      setAuthStatus('Signed in. Loading your dashboard...');
    }
    setIsAuthSubmitting(false);
  };

  const sendMagicLink = async () => {
    const trimmed = authEmail.trim();
    if (!trimmed) {
      setAuthStatus('Enter an email to receive a login link.');
      return;
    }

    setIsAuthSubmitting(true);
    setAuthStatus('');
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      setAuthStatus(`Could not send link: ${error.message}`);
    } else {
      setAuthStatus('Check your inbox for the sign-in link.');
    }
    setIsAuthSubmitting(false);
  };

  const updateTypewriter = (idx: number, text: string) => {
    const newMsgs = [...form.TYPEWRITER_MESSAGES];
    newMsgs[idx].text = text;
    setForm({ ...form, TYPEWRITER_MESSAGES: newMsgs });
  };

  const applyModeDefaults = (mode: SurpriseMode) => {
    const chosen = MODE_TEXT_DEFAULTS[mode];
    if (!chosen) return;

    setForm((prev: any) => ({
      ...prev,
      MODE: chosen.mode,
      INTRO_TITLE: chosen.introTitle,
      MUSIC_TRACK: chosen.musicTrack,
      TYPEWRITER_MESSAGES: chosen.typewriterMessages,
      FINAL_QUESTION: chosen.finalQuestion,
      SUCCESS_MESSAGE: chosen.successMessage,
      HIDDEN_MESSAGE: chosen.hiddenMessage,
      ADMIRER_PHONE: chosen.admirerPhone ?? prev.ADMIRER_PHONE ?? '',
      ADMIRER_ACCEPT_TEMPLATE: chosen.admirerAcceptTemplate ?? EASY_ACCEPT_TEXT,
      ADMIRER_REJECT_MESSAGE: chosen.admirerRejectMessage ?? prev.ADMIRER_REJECT_MESSAGE ?? '',
    }));
    setStatus(`Applied "${chosen.label}" defaults for ${mode}.`);
  };

  const loadTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    setActiveTemplateId(template.id);
    setTemplateName(template.name);
    const cfg = normalizeConfig(template.config);
    setForm(cfg);
    onSaveDraft(cfg);
    setStatus(`Loaded "${template.name}".`);
  };

  const createNewTemplate = async () => {
    if (!session?.user?.id) return;
    const base = normalizeConfig(DEFAULT_PERSONALIZATION);
    const name = `Template ${templates.length + 1}`;
    const { data, error } = await supabase
      .from('creator_templates')
      .insert({
        user_id: session.user.id,
        name,
        config: base,
      })
      .select('id, name, config, updated_at, published_slug, edit_token')
      .single();

    if (error || !data) {
      setStatus(`Create failed: ${error?.message || 'Unknown error'}`);
      return;
    }

    const row = data as TemplateRecord;
    setTemplates((prev) => [row, ...prev]);
    setActiveTemplateId(row.id);
    setTemplateName(row.name);
    setForm(base);
    onSaveDraft(base);
    setStatus(`Created "${row.name}".`);
  };

  const saveCurrentTemplate = async () => {
    if (!activeTemplateId) return;
    const name = templateName.trim() || 'Untitled Template';
    const payload = normalizeConfig(form);

    const { data, error } = await supabase
      .from('creator_templates')
      .update({
        name,
        config: payload,
      })
      .eq('id', activeTemplateId)
      .select('id, name, config, updated_at, published_slug, edit_token')
      .single();

    if (error || !data) {
      setStatus(`Save failed: ${error?.message || 'Unknown error'}`);
      return;
    }

    const row = data as TemplateRecord;
    setTemplates((prev) => [row, ...prev.filter((t) => t.id !== row.id)]);
    setActiveTemplateId(row.id);
    setTemplateName(row.name);
    setForm(payload);
    onSaveDraft(payload);
    setStatus(`Saved "${name}".`);
  };

  const getUploadSessionId = () => {
    const key = `amora_upload_session_${session?.user?.id || 'guest'}`;
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const created = `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, created);
    return created;
  };

  const updatePreviewStatus = (id: string, statusValue: UploadStatus, note?: string) => {
    setUploadPreviews((prev) => prev.map((p) => (p.id === id ? { ...p, status: statusValue, note } : p)));
  };

  const removePreview = (id: string) => {
    setUploadPreviews((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
        previewUrlsRef.current = previewUrlsRef.current.filter((u) => u !== target.previewUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  const uploadWithRetry = async (sessionId: string, file: File): Promise<string | null> => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

    for (let attempt = 1; attempt <= UPLOAD_RETRIES; attempt++) {
      const path = `${sessionId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeName}`;
      const { data, error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
        upsert: false,
        cacheControl: '3600',
      });

      if (!error && data?.path) {
        const { data: publicData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(data.path);
        return publicData?.publicUrl || null;
      }
      if (attempt < UPLOAD_RETRIES) await delay(250 * Math.pow(2, attempt - 1));
    }
    return null;
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadError('');
    const currentImages: string[] = form.UPLOADED_IMAGES || [];
    const remaining = MAX_IMAGES - currentImages.length;
    if (remaining <= 0) {
      setUploadError('You already reached the 5-image limit for this surprise.');
      event.target.value = '';
      return;
    }

    const selectedFiles = Array.from(files).slice(0, remaining) as File[];
    if (files.length > selectedFiles.length) setUploadError(`Only ${remaining} more image(s) can be uploaded.`);

    const sessionId = getUploadSessionId();
    const queued = selectedFiles.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      previewUrlsRef.current.push(previewUrl);
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        file,
        previewUrl,
      };
    });

    setUploadPreviews((prev) => [
      ...prev,
      ...queued.map((item) => ({ id: item.id, name: item.name, previewUrl: item.previewUrl, status: 'queued' as UploadStatus })),
    ]);

    setIsUploading(true);
    const uploadedUrls: string[] = [];
    const errors: string[] = [];

    let cursor = 0;
    const worker = async () => {
      while (cursor < queued.length) {
        const item = queued[cursor++];
        updatePreviewStatus(item.id, 'uploading');

        const optimized = await optimizeImage(item.file);
        if (!optimized) {
          updatePreviewStatus(item.id, 'error', 'Could not fit under 5MB.');
          errors.push(`${item.name}: could not fit under 5MB.`);
          continue;
        }

        const publicUrl = await uploadWithRetry(sessionId, optimized);
        if (!publicUrl) {
          updatePreviewStatus(item.id, 'error', 'Upload failed.');
          errors.push(`${item.name}: upload failed.`);
          continue;
        }

        uploadedUrls.push(publicUrl);
        removePreview(item.id);
      }
    };

    const workers = Array.from({ length: Math.min(UPLOAD_CONCURRENCY, queued.length) }, () => worker());
    await Promise.all(workers);

    if (uploadedUrls.length > 0) {
      setForm((prev: any) => ({
        ...prev,
        UPLOADED_IMAGES: [...(prev.UPLOADED_IMAGES || []), ...uploadedUrls].slice(0, MAX_IMAGES),
      }));
      setStatus(`Uploaded ${uploadedUrls.length} image(s).`);
    }

    if (errors.length > 0) setUploadError(errors.join(' '));
    setIsUploading(false);
    event.target.value = '';
  };

  const removeUploadedImage = (idx: number) => {
    setForm((prev: any) => ({
      ...prev,
      UPLOADED_IMAGES: (prev.UPLOADED_IMAGES || []).filter((_: string, i: number) => i !== idx),
    }));
  };

  const handlePublish = async () => {
    if (!activeTemplateId) return;
    setIsSubmitting(true);
    setStatus('Publishing...');
    try {
      const result = await onPublish(form);
      if (!result) {
        setStatus('Publish failed. Check Supabase key/table/RPC setup.');
        return;
      }

      const { data, error } = await supabase
        .from('creator_templates')
        .update({
          config: normalizeConfig(form),
          published_slug: result.slug,
          edit_token: result.editToken,
        })
        .eq('id', activeTemplateId)
        .select('id, name, config, updated_at, published_slug, edit_token')
        .single();

      if (error || !data) {
        setStatus(`Published but template update failed: ${error?.message || 'Unknown error'}`);
        return;
      }

      const row = data as TemplateRecord;
      setTemplates((prev) => [row, ...prev.filter((t) => t.id !== row.id)]);
      setActiveTemplateId(row.id);
      setTemplateName(row.name);
      onSaveDraft(form);
      setStatus(`Published "${row.name}". Slug: ${result.slug}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTemplate = async () => {
    if (!activeTemplate || !activeTemplate.published_slug || !activeTemplate.edit_token) {
      setStatus('Update failed. This template has no published link yet.');
      return;
    }

    setIsSubmitting(true);
    setStatus('Updating...');
    try {
      const ok = await onUpdatePublished(form, activeTemplate.published_slug, activeTemplate.edit_token);
      if (!ok) {
        setStatus('Update failed. Invalid token or link not found.');
        return;
      }

      const { data, error } = await supabase
        .from('creator_templates')
        .update({
          config: normalizeConfig(form),
        })
        .eq('id', activeTemplate.id)
        .select('id, name, config, updated_at, published_slug, edit_token')
        .single();

      if (error || !data) {
        setStatus(`Update saved remotely, but history refresh failed: ${error?.message || 'Unknown error'}`);
        return;
      }

      const row = data as TemplateRecord;
      setTemplates((prev) => [row, ...prev.filter((t) => t.id !== row.id)]);
      setActiveTemplateId(row.id);
      setTemplateName(row.name);
      onSaveDraft(form);
      setStatus('Published link updated successfully.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setStatus('Share link copied to clipboard.');
  };

  const openPreview = () => {
    if (!shareUrl) return;
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  if (isAuthLoading) {
    return (
      <div className="relative z-[200] min-h-screen w-full p-4 md:p-8">
        <div className="bg-[#1e1b4b]/90 border border-white/10 w-full max-w-3xl mx-auto rounded-3xl p-8 shadow-2xl text-center text-white/70">
          Loading dashboard...
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="relative z-[200] min-h-screen w-full p-4 md:p-8"
      >
        <div className="bg-[#1e1b4b]/90 border border-white/10 w-full max-w-3xl mx-auto rounded-3xl p-6 md:p-8 shadow-2xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-white">Amora Creator Dashboard</h2>
              <p className="text-white/40">Sign in to save templates and keep your history.</p>
            </div>
            <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X className="text-white/60" />
            </button>
          </div>

          <div className="space-y-6">
            <button
              type="button"
              onClick={signInAnonymously}
              disabled={isAuthSubmitting}
              className="w-full px-5 py-4 rounded-xl bg-pink-600 hover:bg-pink-500 disabled:opacity-70 text-white font-semibold flex items-center justify-center gap-2"
            >
              <LogIn size={18} />
              Continue Instantly
            </button>

            <div className="text-center text-white/35 text-xs uppercase tracking-[0.2em]">or</div>

            <div className="space-y-3">
              <label className="text-sm text-white/60 flex items-center gap-2">
                <Mail size={14} /> Use email magic link
              </label>
              <div className="flex flex-col md:flex-row gap-3">
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-pink-500"
                />
                <button
                  type="button"
                  onClick={sendMagicLink}
                  disabled={isAuthSubmitting}
                  className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-70 text-white"
                >
                  Send Link
                </button>
              </div>
            </div>

            {authStatus && <p className="text-sm text-white/70">{authStatus}</p>}
            <p className="text-xs text-white/45">
              Tip: use <span className="text-white">Continue Instantly</span> for the fastest setup. You can still upgrade later.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="relative z-[200] min-h-screen w-full p-4 md:p-8"
    >
      <div className="bg-[#1e1b4b]/90 border border-white/10 w-full max-w-5xl mx-auto rounded-3xl p-6 md:p-8 shadow-2xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white">Creator Dashboard</h2>
            <p className="text-white/40">Build templates, keep history, and publish separate links.</p>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="text-white/60" />
          </button>
        </div>

        <section className="space-y-4 mb-8">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-pink-400 font-semibold uppercase text-xs tracking-widest">Template Library</h3>
            <button
              type="button"
              onClick={createNewTemplate}
              className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs flex items-center gap-2"
            >
              <Plus size={14} /> New Template
            </button>
          </div>
          {isTemplatesLoading ? (
            <p className="text-white/60 text-sm">Loading templates...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {templates.map((template) => (
                <button
                  type="button"
                  key={template.id}
                  onClick={() => loadTemplate(template.id)}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    template.id === activeTemplateId
                      ? 'border-pink-400/60 bg-pink-500/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <p className="text-white font-medium">{template.name}</p>
                  <p className="text-white/50 text-xs mt-1">Recipient: {template.config?.LOVED_ONE_NAME || 'Unknown'}</p>
                  <p className="text-white/35 text-[11px] mt-2">Edited: {new Date(template.updated_at).toLocaleString()}</p>
                  {template.published_slug && <p className="text-emerald-300 text-[11px] mt-1">Published: /s/{template.published_slug}</p>}
                </button>
              ))}
            </div>
          )}
        </section>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveCurrentTemplate();
          }}
          className="space-y-8"
        >
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-pink-400 font-semibold uppercase text-xs tracking-widest"><User size={14} /> Basic Info</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-white/60">Template Name</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-pink-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/60">Recipient Name</label>
                <input
                  type="text"
                  value={form.LOVED_ONE_NAME}
                  onChange={(e) => setForm({ ...form, LOVED_ONE_NAME: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-pink-500"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm text-white/60">Intro Title</label>
                <input
                  type="text"
                  value={form.INTRO_TITLE}
                  onChange={(e) => setForm({ ...form, INTRO_TITLE: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-pink-500"
                />
              </div>
            </div>

            {form.MODE === 'ADMIRER' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="space-y-2">
                  <label className="text-sm text-white/60">Your Phone Number (for replies)</label>
                  <PhoneInput
                    country="cm"
                    value={(form.ADMIRER_PHONE || '').replace(/^\+/, '')}
                    onChange={(value: string) => setForm({ ...form, ADMIRER_PHONE: value ? `+${value}` : '' })}
                    enableSearch
                    inputStyle={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.10)',
                      color: '#fff',
                      borderRadius: '0.75rem',
                      height: '48px',
                    }}
                    buttonStyle={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.10)',
                      borderRight: '0',
                      borderRadius: '0.75rem 0 0 0.75rem',
                    }}
                    dropdownStyle={{
                      background: '#1e1b4b',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.15)',
                    }}
                    searchStyle={{
                      background: 'rgba(255,255,255,0.08)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.15)',
                    }}
                    containerStyle={{ width: '100%' }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/60">Default Accept Reply</label>
                  <div className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/80">
                    <span className="inline-flex items-center gap-2">
                      <Sparkles size={14} className="text-pink-300" />
                      {EASY_ACCEPT_TEXT}
                    </span>
                  </div>
                  <p className="text-xs text-white/45">This comes from mode templates in constants.</p>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-pink-400 font-semibold uppercase text-xs tracking-widest"><Layout size={14} /> Theme & Music</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-white/60">Experience Mode</label>
                <select
                  value={form.MODE}
                  onChange={(e) => applyModeDefaults(e.target.value as SurpriseMode)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-pink-500 appearance-none"
                  style={{ color: '#fff', backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                >
                  <option value="ROMANTIC" style={{ backgroundColor: '#1e1b4b', color: '#fff' }}>Romantic</option>
                  <option value="ADMIRER" style={{ backgroundColor: '#1e1b4b', color: '#fff' }}>Secret Admirer</option>
                  <option value="FRIENDLY" style={{ backgroundColor: '#1e1b4b', color: '#fff' }}>Friendship / Family</option>
                  <option value="CLASSIC" style={{ backgroundColor: '#1e1b4b', color: '#fff' }}>Classic</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/60">Background Music</label>
                <select
                  value={form.MUSIC_TRACK}
                  onChange={(e) => setForm({ ...form, MUSIC_TRACK: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-pink-500 appearance-none"
                  style={{ color: '#fff', backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                >
                  {MUSIC_TRACKS.map((track) => (
                    <option key={track.id} value={track.id} style={{ backgroundColor: '#1e1b4b', color: '#fff' }}>{track.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-pink-400 font-semibold uppercase text-xs tracking-widest"><MessageCircle size={14} /> Storyline Messages</h3>
            <div className="space-y-4">
              {form.TYPEWRITER_MESSAGES.map((msg: any, i: number) => (
                <div key={i} className="flex gap-2">
                  <span className="text-white/20 mt-3 font-bold">{i + 1}.</span>
                  <textarea
                    value={msg.text}
                    onChange={(e) => updateTypewriter(i, e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-pink-500 h-20 resize-none"
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3 bg-white/5 border border-white/10 rounded-2xl p-4">
            <h3 className="text-pink-400 font-semibold uppercase text-xs tracking-widest">Secret Photos</h3>
            <p className="text-white/50 text-sm">Upload up to 5 photos, max 5MB each.</p>
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm cursor-pointer">
                <ImagePlus size={14} />
                {isUploading ? 'Uploading...' : 'Add Photos'}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={isUploading || (form.UPLOADED_IMAGES?.length || 0) >= MAX_IMAGES}
                />
              </label>
              <span className="text-xs text-white/50">{(form.UPLOADED_IMAGES?.length || 0)}/{MAX_IMAGES} used</span>
            </div>

            {uploadPreviews.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {uploadPreviews.map((item) => (
                  <div key={item.id} className="relative w-full aspect-square rounded-md overflow-hidden border border-white/15">
                    <img src={item.previewUrl} alt={item.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/45 flex items-center justify-center text-[10px] text-white uppercase tracking-wider text-center px-1">
                      {item.status === 'queued' && 'Queued'}
                      {item.status === 'uploading' && 'Uploading'}
                      {item.status === 'error' && (item.note || 'Error')}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {uploadError && <p className="text-xs text-red-300">{uploadError}</p>}
            {Array.isArray(form.UPLOADED_IMAGES) && form.UPLOADED_IMAGES.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {form.UPLOADED_IMAGES.map((url: string, idx: number) => (
                  <div key={`${url}-${idx}`} className="relative group">
                    <img src={url} alt={`Upload ${idx + 1}`} className="w-full aspect-square object-cover rounded-lg border border-white/15" />
                    <button
                      type="button"
                      onClick={() => removeUploadedImage(idx)}
                      className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove image"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3 bg-white/5 border border-white/10 rounded-2xl p-4">
            <h3 className="text-pink-400 font-semibold uppercase text-xs tracking-widest">Publish</h3>
            <p className="text-white/50 text-sm">Publish creates or updates a link for the active template.</p>
            {shareUrl && (
              <div className="flex flex-col md:flex-row gap-3 md:items-center">
                <code className="flex-1 bg-black/30 px-3 py-2 rounded-lg text-xs text-white/80 break-all">{shareUrl}</code>
                <button type="button" onClick={copyLink} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm flex items-center gap-2">
                  <Copy size={14} /> Copy Link
                </button>
                <button type="button" onClick={openPreview} className="px-4 py-2 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white text-sm">
                  Open Preview
                </button>
              </div>
            )}
            {status && <p className="text-xs text-white/60">{status}</p>}
          </section>

          <div className="flex flex-wrap justify-end gap-4 pt-4">
            <button type="button" onClick={onCancel} className="px-6 py-3 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-all">
              Close
            </button>
            <button type="submit" className="px-8 py-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-pink-900/40 transition-all hover:scale-105">
              <Save size={18} /> Save Template
            </button>
            <button type="button" disabled={isSubmitting} onClick={handlePublish} className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-70 text-white font-bold flex items-center gap-2 transition-all">
              <Upload size={18} /> Publish Link
            </button>
            {(activeTemplate?.published_slug && activeTemplate?.edit_token) || (publishedSlug && hasEditToken) ? (
              <button type="button" disabled={isSubmitting} onClick={handleUpdateTemplate} className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-70 text-white font-bold flex items-center gap-2 transition-all">
                <RefreshCw size={18} /> Update Link
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </motion.div>
  );
}

export default CreatorPanel;

