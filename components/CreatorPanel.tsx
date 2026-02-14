import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Save, X, User, MessageCircle, Layout, Copy, Upload, RefreshCw, ImagePlus, Trash2 } from 'lucide-react';
import { SurpriseMode, MUSIC_TRACKS, MODE_TEXT_DEFAULTS } from '../constants';
import { supabase } from '../lib/supabase';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';

interface CreatorPanelProps {
  onSaveDraft: (config: any) => void;
  onPublish: (config: any) => Promise<{ slug: string; editToken: string } | null>;
  onUpdate: (config: any) => Promise<boolean>;
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

const MAX_IMAGES = 5;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const STORAGE_BUCKET = 'LoveBids_Pics';
const UPLOAD_CONCURRENCY = 2;
const UPLOAD_RETRIES = 3;
const MAX_DIMENSION = 1920;

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

    if (file.size <= MAX_FILE_SIZE_BYTES && scale === 1) {
      return file;
    }

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
      if (!chosenBlob || blob.size < chosenBlob.size) {
        chosenBlob = blob;
      }
      if (blob.size <= MAX_FILE_SIZE_BYTES) {
        chosenBlob = blob;
        break;
      }
    }

    if (!chosenBlob || chosenBlob.size > MAX_FILE_SIZE_BYTES) {
      return null;
    }

    const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
    return new File([chosenBlob], `${baseName}.webp`, { type: 'image/webp' });
  } finally {
    bitmap.close();
  }
};

const CreatorPanel: React.FC<CreatorPanelProps> = ({
  onSaveDraft,
  onPublish,
  onUpdate,
  onCancel,
  currentConfig,
  publishedSlug,
  hasEditToken,
}) => {
  const normalizeConfig = (cfg: any) => ({
    ...cfg,
    UPLOADED_IMAGES: Array.isArray(cfg?.UPLOADED_IMAGES) ? cfg.UPLOADED_IMAGES : [],
  });

  const [form, setForm] = useState(normalizeConfig(currentConfig));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploadPreviews, setUploadPreviews] = useState<UploadPreview[]>([]);
  const previewUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    setForm(normalizeConfig(currentConfig));
  }, [currentConfig]);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current = [];
    };
  }, []);

  const shareUrl = useMemo(() => {
    if (!publishedSlug) return '';
    return `${window.location.origin}/s/${publishedSlug}`;
  }, [publishedSlug]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveDraft(form);
    setStatus('Draft saved locally.');
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
      ADMIRER_ACCEPT_TEMPLATE: chosen.admirerAcceptTemplate ?? prev.ADMIRER_ACCEPT_TEMPLATE ?? '',
      ADMIRER_REJECT_MESSAGE: chosen.admirerRejectMessage ?? prev.ADMIRER_REJECT_MESSAGE ?? '',
    }));
    setStatus(`Applied "${chosen.label}" defaults for ${mode}.`);
  };

  const updateTypewriter = (idx: number, text: string) => {
    const newMsgs = [...form.TYPEWRITER_MESSAGES];
    newMsgs[idx].text = text;
    setForm({ ...form, TYPEWRITER_MESSAGES: newMsgs });
  };

  const getUploadSessionId = () => {
    const key = 'valentine_upload_session';
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

      if (attempt < UPLOAD_RETRIES) {
        await delay(250 * Math.pow(2, attempt - 1));
      }
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
    if (files.length > selectedFiles.length) {
      setUploadError(`Only ${remaining} more image(s) can be uploaded.`);
    }

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

    if (errors.length > 0) {
      setUploadError(errors.join(' '));
    }

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
    setIsSubmitting(true);
    setStatus('Publishing...');
    try {
      const result = await onPublish(form);
      if (!result) {
        setStatus('Publish failed. Check Supabase key/table/RPC setup.');
        return;
      }
      setStatus(`Published successfully. Slug: ${result.slug}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    setIsSubmitting(true);
    setStatus('Updating...');
    try {
      const ok = await onUpdate(form);
      setStatus(ok ? 'Published link updated successfully.' : 'Update failed. Missing or invalid edit token.');
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
            <p className="text-white/40">Build your template, publish a link, then preview it in a separate tab</p>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="text-white/60" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-pink-400 font-semibold uppercase text-xs tracking-widest"><User size={14} /> Basic Info</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-white/60">Recipient Name</label>
                <input
                  type="text"
                  value={form.LOVED_ONE_NAME}
                  onChange={(e) => setForm({ ...form, LOVED_ONE_NAME: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-pink-500"
                />
              </div>
              <div className="space-y-2">
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
                  <label className="text-sm text-white/60">Your Phone Number (for accepted reply)</label>
                  <div className="text-white">
                    <PhoneInput
                      country="cm"
                      value={form.ADMIRER_PHONE || ''}
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
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/60">Rejection Message (If they Reject You)</label>
                  <input
                    type="text"
                    value={form.ADMIRER_REJECT_MESSAGE || ''}
                    onChange={(e) => setForm({ ...form, ADMIRER_REJECT_MESSAGE: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-pink-500"
                  />
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
                  onChange={(e) => {
                    const nextMode = e.target.value as SurpriseMode;
                    applyModeDefaults(nextMode);
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-pink-500 appearance-none"
                  style={{ color: '#fff', backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                >
                  <option value="ROMANTIC" style={{ backgroundColor: '#1e1b4b', color: '#fff' }}>Romantic (Hearts & Reds)</option>
                  <option value="ADMIRER" style={{ backgroundColor: '#1e1b4b', color: '#fff' }}>Secret Admirer (Mystery & Dark Indigo)</option>
                  <option value="FRIENDLY" style={{ backgroundColor: '#1e1b4b', color: '#fff' }}>Friendship/Family (Warmth & Gold)</option>
                  <option value="CLASSIC" style={{ backgroundColor: '#1e1b4b', color: '#fff' }}>Elegant/Formal (Professional & Teal)</option>
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
            <div className="space-y-3 pt-2">
              <p className="text-sm text-white/60">
                Mode controls the default text style. Changing mode auto-loads that mode template.
              </p>
              <button
                type="button"
                onClick={() => applyModeDefaults(form.MODE as SurpriseMode)}
                className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/90 text-xs"
              >
                Re-apply current mode defaults
              </button>
              {form.MODE === 'ADMIRER' && (
                <p className="text-xs text-indigo-200/80">
                  Tip: for extra spark, ask a trusted friend to share the link instead of sending it directly yourself.
                </p>
              )}
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
                    placeholder={`Message ${i + 1}`}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3 bg-white/5 border border-white/10 rounded-2xl p-4">
            <h3 className="text-pink-400 font-semibold uppercase text-xs tracking-widest">Secret Photos</h3>
            <p className="text-white/50 text-sm">Upload up to 5 photos, max 5MB each. They will be revealed mysteriously in the timeline.</p>
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
              <span className="text-xs text-white/50">
                {(form.UPLOADED_IMAGES?.length || 0)}/{MAX_IMAGES} used
              </span>
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
                    <img src={url} alt={`Upload ${idx + 1}`} className="w-full h-24 object-cover rounded-lg border border-white/15" />
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
            <p className="text-white/50 text-sm">Publish generates a shareable URL. Save Draft keeps local preview only.</p>
            {shareUrl && (
              <div className="flex flex-col md:flex-row gap-3 md:items-center">
                <code className="flex-1 bg-black/30 px-3 py-2 rounded-lg text-xs text-white/80 break-all">{shareUrl}</code>
                <button
                  type="button"
                  onClick={copyLink}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm flex items-center gap-2"
                >
                  <Copy size={14} /> Copy Link
                </button>
                <button
                  type="button"
                  onClick={openPreview}
                  className="px-4 py-2 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white text-sm"
                >
                  Open Preview
                </button>
              </div>
            )}
            {status && <p className="text-xs text-white/60">{status}</p>}
          </section>

          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-8 py-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-pink-900/40 transition-all hover:scale-105"
            >
              <Save size={18} /> Save Changes
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handlePublish}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-70 text-white font-bold flex items-center gap-2 transition-all"
            >
              <Upload size={18} /> Publish Link
            </button>
            {publishedSlug && hasEditToken && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleUpdate}
                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-70 text-white font-bold flex items-center gap-2 transition-all"
              >
                <RefreshCw size={18} /> Update Link
              </button>
            )}
          </div>
        </form>
      </div>
    </motion.div>
  );
};

export default CreatorPanel;
