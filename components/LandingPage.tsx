import React from 'react';
import { motion } from 'framer-motion';

interface LandingPageProps {
  onGoToCreator: () => void;
  theme: any;
}

const LandingPage: React.FC<LandingPageProps> = ({ onGoToCreator, theme }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -30 }}
      className="min-h-screen w-full flex items-center justify-center p-6 z-40"
    >
      <div className="max-w-5xl w-full text-center">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
          className="space-y-8"
        >
          <motion.div
            animate={{ scale: [1, 1.05, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ repeat: Infinity, duration: 4 }}
            className="text-pink-500/50 text-sm tracking-[0.45em] uppercase font-semibold"
          >
            Passion. Secret Admirer. Love Vibe.
          </motion.div>

          <h1 className={`${theme.font} text-4xl md:text-7xl text-white leading-tight font-light`}>
            Amora lets the <br />
            <span className="italic font-normal">Heart Speak.</span><br />
            Without Saying a Word.
          </h1>

          <p className="text-white/50 text-base md:text-lg max-w-2xl mx-auto leading-relaxed font-light">
            Some feelings are hard to say face to face.
            <br />
            Make a simple, beautiful surprise link and let your heart speak for you.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-left">
              <p className="text-sm text-white/90">Secret admirer ready</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-left">
              <p className="text-sm text-white/90">Pure love vibe</p>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 1 }}
            className="pt-6 flex items-center justify-center"
          >
            <button
              onClick={onGoToCreator}
              className="px-10 py-4 bg-pink-600/80 hover:bg-pink-500 text-white border border-pink-300/20 rounded-full transition-all duration-300 tracking-widest uppercase text-xs"
            >
              Start Creating
            </button>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default LandingPage;
