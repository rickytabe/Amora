import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

interface SurpriseSectionProps {
  config: any;
  theme: any;
}

const SurpriseSection: React.FC<SurpriseSectionProps> = ({ config, theme }) => {
  const [isOpened, setIsOpened] = useState(false);
  const [responded, setResponded] = useState(false);
  const [showRejectedMessage, setShowRejectedMessage] = useState(false);
  const [noButtonPos, setNoButtonPos] = useState({ x: 0, y: 0 });

  const isAdmirerMode = config.MODE === 'ADMIRER';

  const handleOpen = () => {
    setIsOpened(true);
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#ff4d6d', '#ff758f', '#ff8fa3', '#ffb3c1', '#ffffff'],
    });
  };

  const handleResponse = () => {
    setResponded(true);

    if (isAdmirerMode) {
      const phoneRaw = String(config.ADMIRER_PHONE || '').trim();
      const phone = phoneRaw.replace(/[^\d+]/g, '');
      const body = encodeURIComponent(
        config.ADMIRER_ACCEPT_TEMPLATE || "I'm in. I'd like to know you better."
      );
      if (phone) {
        window.location.href = `sms:${phone}?body=${body}`;
      }
    }

    const end = Date.now() + 5 * 1000;
    const colors = ['#ff4d6d', '#ffffff'];

    (function frame() {
      confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
      });
      confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  };

  const moveNoButton = useCallback(() => {
    const x = (Math.random() - 0.5) * 400;
    const y = (Math.random() - 0.5) * 400;
    setNoButtonPos({ x, y });
  }, []);

  const playSadTone = () => {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.8);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.95);
  };

  const handleReject = () => {
    playSadTone();
    setShowRejectedMessage(true);
    setTimeout(() => setShowRejectedMessage(false), 3500);
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-8 transition-colors duration-1000 ${isOpened ? 'bg-black/40' : 'bg-black/60'}`}>
      <AnimatePresence mode="wait">
        {!isOpened ? (
          <motion.div
            key="gift-box"
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 1.5, opacity: 0 }}
            className="flex flex-col items-center cursor-pointer group"
            onClick={handleOpen}
          >
            <motion.div
              animate={{ y: [0, -20, 0], rotate: [0, 2, -2, 0] }}
              transition={{ repeat: Infinity, duration: 4 }}
              className="text-[120px] md:text-[200px] drop-shadow-[0_0_50px_rgba(255,255,255,0.2)] transition-transform group-hover:scale-110"
            >
              ??
            </motion.div>
            <p className="mt-8 text-white/60 tracking-[0.5em] uppercase text-sm animate-pulse">Open the gift</p>
          </motion.div>
        ) : !responded ? (
          <motion.div
            key="proposal"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl text-center relative"
          >
            <h2 className={`${theme.font} text-5xl md:text-8xl text-white mb-12 drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]`}>
              {config.FINAL_QUESTION}
            </h2>
            <div className="flex flex-col md:flex-row items-center justify-center gap-6 min-h-[100px]">
              <motion.button
                onClick={handleResponse}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="w-full md:w-auto px-16 py-6 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-full font-bold text-xl shadow-[0_0_40px_rgba(236,72,153,0.5)] z-10"
              >
                {isAdmirerMode ? `Yes, text me ${theme.icon}` : `YES! ${theme.icon}`}
              </motion.button>

              {isAdmirerMode ? (
                <motion.button
                  onClick={handleReject}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full md:w-auto px-16 py-6 bg-white/5 backdrop-blur-md border border-white/10 text-white/70 rounded-full font-medium text-xl shadow-xl hover:text-white transition-colors"
                >
                  No, sorry ??
                </motion.button>
              ) : (
                <motion.button
                  onMouseEnter={moveNoButton}
                  animate={{ x: noButtonPos.x, y: noButtonPos.y, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="w-full md:w-auto px-16 py-6 bg-white/5 backdrop-blur-md border border-white/10 text-white/60 rounded-full font-medium text-xl shadow-xl hover:text-white transition-colors"
                >
                  Sorry, I can't... ??
                </motion.button>
              )}
            </div>

            <AnimatePresence>
              {showRejectedMessage && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-8 mx-auto max-w-xl rounded-2xl border border-white/15 bg-black/40 backdrop-blur-md p-4 text-white/85 text-sm"
                >
                  {config.ADMIRER_REJECT_MESSAGE || 'It hurts, but thank you for being honest. ??'}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                filter: ['drop-shadow(0 0 10px #ff4d6d)', 'drop-shadow(0 0 40px #ff4d6d)', 'drop-shadow(0 0 10px #ff4d6d)'],
              }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-9xl mb-12"
            >
              {theme.icon}
            </motion.div>
            <h2 className={`${theme.font} text-4xl md:text-7xl text-white max-w-3xl leading-tight`}>
              {config.SUCCESS_MESSAGE}
            </h2>
            <p className="mt-8 text-white/40 italic tracking-widest uppercase text-xs">A moment to remember forever</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SurpriseSection;
