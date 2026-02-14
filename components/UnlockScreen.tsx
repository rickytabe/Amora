
import React from 'react';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { THEMES } from '../constants';

interface UnlockScreenProps {
  onUnlock: () => void;
  config: any;
}

const UnlockScreen: React.FC<UnlockScreenProps> = ({ onUnlock, config }) => {
  const theme = THEMES[config.MODE as keyof typeof THEMES] || THEMES.ROMANTIC;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(20px)' }}
      className="fixed inset-0 flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 1 }}
        className="w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 p-10 rounded-[2rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] text-center relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-pink-500 to-transparent opacity-50" />
        
        <div className="flex justify-center mb-8">
          <div className="relative">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="bg-pink-500/20 p-5 rounded-full"
            >
              <span className="text-4xl">{theme.icon}</span>
            </motion.div>
            <div className="absolute -top-1 -right-1 bg-purple-900 border border-white/20 p-1.5 rounded-full">
              <Lock className="w-3 h-3 text-white" />
            </div>
          </div>
        </div>

        <h1 className={`${theme.font} text-3xl md:text-4xl mb-2 text-white/90`}>
          Hello there.
        </h1>
        <p className="text-white/60 mb-8 font-light tracking-wide">
          {config.INTRO_TITLE}
        </p>

        <div className="space-y-6">
          <button
            type="button"
            onClick={onUnlock}
            className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-pink-900/20 transition-all hover:scale-[1.02] active:scale-[0.98] group"
          >
            Unlock the Secret
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default UnlockScreen;
