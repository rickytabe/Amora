
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DEFAULT_PERSONALIZATION, THEMES, SurpriseMode } from './constants';
import UnlockScreen from './components/UnlockScreen';
import TypewriterMessage from './components/TypewriterMessage';
import MemoryTimeline from './components/MemoryTimeline';
import SurpriseSection from './components/SurpriseSection';
import FloatingParticles from './components/FloatingParticles';
import CustomCursor from './components/CustomCursor';
import MusicPlayer from './components/MusicPlayer';
import CreatorPanel from './components/CreatorPanel';
import LandingPage from './components/LandingPage';
import { supabase } from './lib/supabase';

export enum AppStage {
  LANDING = 'LANDING',
  LOCKED = 'LOCKED',
  INTRO = 'INTRO',
  TIMELINE = 'TIMELINE',
  SURPRISE = 'SURPRISE',
  CREATOR = 'CREATOR'
}

const App: React.FC = () => {
  const [stage, setStage] = useState<AppStage>(AppStage.LANDING);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [config, setConfig] = useState(DEFAULT_PERSONALIZATION);
  const [isRemoteLoading, setIsRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState('');
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [editToken, setEditToken] = useState<string | null>(null);

  useEffect(() => {
    const loadInitialConfig = async () => {
      const pathMatch = window.location.pathname.match(/^\/s\/([a-z0-9_-]{6,64})\/?$/i);
      const incomingSlug = pathMatch?.[1] || null;

      if (incomingSlug) {
        setStage(AppStage.LOCKED);
        setPublishedSlug(incomingSlug);
        const tokenBySlugRaw = localStorage.getItem('valentine_edit_tokens');
        if (tokenBySlugRaw) {
          try {
            const tokenBySlug = JSON.parse(tokenBySlugRaw);
            if (tokenBySlug[incomingSlug]) setEditToken(tokenBySlug[incomingSlug]);
          } catch {
            // ignore malformed local token store
          }
        }
        setIsRemoteLoading(true);
        const { data, error } = await supabase
          .from('surprises')
          .select('config')
          .eq('slug', incomingSlug)
          .single();

        if (error || !data?.config) {
          setRemoteError('This surprise link is unavailable.');
        } else {
          setConfig(data.config);
          setRemoteError('');
        }
        setIsRemoteLoading(false);
        return;
      }

      setStage(AppStage.LANDING);

      const saved = localStorage.getItem('valentine_config');
      const savedSlug = localStorage.getItem('valentine_published_slug');
      const tokenBySlugRaw = localStorage.getItem('valentine_edit_tokens');
      const tokenBySlug = tokenBySlugRaw ? JSON.parse(tokenBySlugRaw) : {};

      if (saved) {
        try {
          setConfig(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to load local draft", e);
        }
      }
      if (savedSlug) {
        setPublishedSlug(savedSlug);
        if (tokenBySlug[savedSlug]) setEditToken(tokenBySlug[savedSlug]);
      }
    };

    loadInitialConfig().catch((e) => {
      console.error('Initial load failed', e);
      setRemoteError('Failed to load surprise.');
      setIsRemoteLoading(false);
    });
  }, []);

  const persistEditToken = (slug: string, token: string) => {
    const tokenBySlugRaw = localStorage.getItem('valentine_edit_tokens');
    const tokenBySlug = tokenBySlugRaw ? JSON.parse(tokenBySlugRaw) : {};
    tokenBySlug[slug] = token;
    localStorage.setItem('valentine_edit_tokens', JSON.stringify(tokenBySlug));
    localStorage.setItem('valentine_published_slug', slug);
  };

  const getStoredEditToken = (slug: string) => {
    const tokenBySlugRaw = localStorage.getItem('valentine_edit_tokens');
    if (!tokenBySlugRaw) return null;
    try {
      const tokenBySlug = JSON.parse(tokenBySlugRaw);
      return tokenBySlug[slug] || null;
    } catch {
      return null;
    }
  };

  const theme = useMemo(() => THEMES[config.MODE as SurpriseMode] || THEMES.ROMANTIC, [config.MODE]);
  const isSharedPreview = useMemo(
    () => /^\/s\/([a-z0-9_-]{6,64})\/?$/i.test(window.location.pathname),
    []
  );

  const handleUnlock = useCallback(() => {
    setStage(AppStage.INTRO);
    setIsAudioPlaying(true);
  }, []);

  const goToLanding = useCallback(() => setStage(AppStage.LANDING), []);
  const goToTimeline = useCallback(() => setStage(AppStage.TIMELINE), []);
  const goToSurprise = useCallback(() => setStage(AppStage.SURPRISE), []);
  const goToCreator = useCallback(() => setStage(AppStage.CREATOR), []);

  const handleSaveDraft = (newConfig: any) => {
    setConfig(newConfig);
    localStorage.setItem('valentine_config', JSON.stringify(newConfig));
  };

  const handlePublishConfig = async (newConfig: any) => {
    const { data, error } = await supabase.rpc('publish_surprise', {
      p_config: newConfig,
    });

    if (error || !Array.isArray(data) || !data[0]?.slug || !data[0]?.edit_token) {
      console.error('Publish error', error);
      return null;
    }

    const result = data[0];
    setConfig(newConfig);
    setPublishedSlug(result.slug);
    setEditToken(result.edit_token);
    localStorage.setItem('valentine_config', JSON.stringify(newConfig));
    persistEditToken(result.slug, result.edit_token);
    return { slug: result.slug as string, editToken: result.edit_token as string };
  };

  const handleUpdateConfig = async (newConfig: any) => {
    if (!publishedSlug) return false;
    const token = editToken || getStoredEditToken(publishedSlug);
    if (!token) return false;

    const { data, error } = await supabase.rpc('update_surprise', {
      p_slug: publishedSlug,
      p_edit_token: token,
      p_config: newConfig,
      p_expires_at: null,
      p_is_published: true,
    });

    if (error || data !== true) {
      console.error('Update error', error);
      return false;
    }

    setConfig(newConfig);
    localStorage.setItem('valentine_config', JSON.stringify(newConfig));
    return true;
  };

  const [showHidden, setShowHidden] = useState(false);
  const triggerHidden = () => {
    setShowHidden(true);
    setTimeout(() => setShowHidden(false), 3000);
  };

  if (isRemoteLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#0c0014] text-white">
        <p className="text-white/70 tracking-wide">Loading surprise...</p>
      </div>
    );
  }

  return (
    <div 
      className={`relative min-h-screen w-full overflow-x-hidden selection:bg-pink-500/30 transition-colors duration-1000`}
      style={{ 
        background: `linear-gradient(-45deg, ${theme.colors.join(', ')})`,
        backgroundSize: '400% 400%',
        animation: 'gradient-shift 15s ease infinite'
      }}
    >
      <CustomCursor />
      <FloatingParticles 
        density={stage === AppStage.LANDING || stage === AppStage.LOCKED ? 30 : 60} 
        color={theme.particleColor} 
      />
      
      {stage !== AppStage.LANDING && stage !== AppStage.LOCKED && stage !== AppStage.CREATOR && (
        <MusicPlayer 
          isPlaying={isAudioPlaying} 
          onToggle={() => setIsAudioPlaying(!isAudioPlaying)} 
          trackType={config.MUSIC_TRACK}
        />
      )}

      {!isSharedPreview && (stage === AppStage.LANDING || stage === AppStage.LOCKED) && (
        <button 
          onClick={goToCreator}
          className="fixed top-6 left-6 z-[100] p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-white/40 hover:text-white/80 transition-all shadow-xl group"
          title="Creator Dashboard"
        >
          <motion.div 
            animate={{ rotate: 360 }} 
            transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
            className="group-hover:scale-110 transition-transform"
          >
            ⚙️
          </motion.div>
        </button>
      )}

      <AnimatePresence mode="wait">
        {remoteError && (stage === AppStage.LANDING || stage === AppStage.LOCKED) && (
          <motion.div
            key="remote-error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[150] bg-red-900/50 border border-red-400/30 text-red-100 px-4 py-2 rounded-lg text-sm"
          >
            {remoteError}
          </motion.div>
        )}

        {stage === AppStage.LANDING && (
          <LandingPage key="landing" onGoToCreator={goToCreator} theme={theme} />
        )}

        {stage === AppStage.LOCKED && (
          <UnlockScreen key="unlock" onUnlock={handleUnlock} config={config} />
        )}

        {stage === AppStage.CREATOR && (
          <CreatorPanel
            key="creator"
            onSaveDraft={handleSaveDraft}
            onPublish={handlePublishConfig}
            onUpdate={handleUpdateConfig}
            onCancel={goToLanding}
            currentConfig={config}
            publishedSlug={publishedSlug}
            hasEditToken={Boolean(editToken || (publishedSlug && getStoredEditToken(publishedSlug)))}
          />
        )}

        {stage === AppStage.INTRO && (
          <TypewriterMessage key="intro" onComplete={goToTimeline} config={config} theme={theme} />
        )}

        {stage === AppStage.TIMELINE && (
          <motion.div
            key="timeline"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          >
            <MemoryTimeline onNext={goToSurprise} config={config} theme={theme} />
          </motion.div>
        )}

        {stage === AppStage.SURPRISE && (
          <SurpriseSection key="surprise" config={config} theme={theme} />
        )}
      </AnimatePresence>

      {stage !== AppStage.CREATOR && (
        <div 
          onClick={triggerHidden}
          className="fixed bottom-4 right-4 w-12 h-12 cursor-pointer z-50 opacity-0 hover:opacity-10 transition-opacity"
        />
      )}

      <AnimatePresence>
        {showHidden && stage !== AppStage.CREATOR && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed bottom-10 right-10 z-[100] bg-white/10 backdrop-blur-xl p-4 rounded-xl border border-white/20 text-pink-200 text-sm italic shadow-2xl"
          >
            {config.HIDDEN_MESSAGE}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
