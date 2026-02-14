
import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';

interface MemoryTimelineProps {
  onNext: () => void;
  config: any;
  theme: any;
}

const DEFAULT_SECRET_NOTES = [
  'A quiet moment I kept because it meant more than words.',
  'One frame, one heartbeat, one unforgettable memory.',
  'I saved this because your presence made that day brighter.',
  'This picture is a small proof of how special you are to me.',
  'Some memories feel like magic; this is one of them.',
];

const MemoryTimeline: React.FC<MemoryTimelineProps> = ({ onNext, config, theme }) => {
  const uploadedImages = useMemo(
    () => (Array.isArray(config.UPLOADED_IMAGES) ? config.UPLOADED_IMAGES.slice(0, 5) : []),
    [config.UPLOADED_IMAGES]
  );
  const [revealedPhotos, setRevealedPhotos] = useState<number[]>([]);

  const toggleReveal = (idx: number) => {
    setRevealedPhotos((prev) => (prev.includes(idx) ? prev : [...prev, idx]));
  };

  return (
    <div className="relative pt-32 pb-64 px-4 max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        className="text-center mb-32"
      >
        <h2 className={`${theme.font} text-4xl md:text-6xl text-white mb-6`}>
          {config.MODE === 'ADMIRER' ? 'This Pictures of you caught me' : 'The Person After My Heart'}
        </h2>
        <div className="w-24 h-1 bg-gradient-to-r from-pink-500 to-purple-500 mx-auto rounded-full"></div>
      </motion.div>

      <div className="absolute top-[400px] bottom-[300px] left-1/2 -translate-x-1/2 w-0.5 bg-gradient-to-b from-white/10 to-transparent hidden md:block"></div>
      <div className="absolute top-[420px] bottom-[300px] left-4 w-0.5 bg-gradient-to-b from-white/15 to-transparent md:hidden"></div>

      {uploadedImages.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-100px' }}
          className="mt-12 mb-20"
        >
          <p className="text-center text-white/50 text-sm tracking-[0.25em] uppercase mb-10">
            {config.MODE === 'ADMIRER' ? 'Some Pics of You That Got Me' : 'Tap each card to reveal'}
          </p>

          <div className="relative z-10 pl-6 md:pl-0">
            {uploadedImages.map((image: string, idx: number) => {
              const isRevealed = revealedPhotos.includes(idx);
              return (
                <motion.div
                  key={`${image}-${idx}`}
                  initial={{ opacity: 0, x: idx % 2 === 0 ? -40 : 40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`mb-14 flex w-full justify-start ${idx % 2 === 0 ? 'md:justify-start' : 'md:justify-end'}`}
                >
                  <motion.button
                    type="button"
                    onClick={() => toggleReveal(idx)}
                    whileHover={{ scale: 1.01 }}
                    className="relative text-left w-full max-w-xl overflow-hidden rounded-2xl border border-white/15 bg-white/5 backdrop-blur-xl shadow-xl"
                  >
                    <div className="relative aspect-square">
                      <motion.img
                        src={image}
                        alt={`Secret memory ${idx + 1}`}
                        animate={
                          isRevealed
                            ? { filter: 'blur(0px) grayscale(0%) brightness(1)', scale: 1 }
                            : { filter: 'blur(14px) grayscale(100%) brightness(0.35)', scale: 1.12 }
                        }
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/60" />
                      {!isRevealed ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
                          <motion.div
                            animate={{ opacity: [0.4, 1, 0.4] }}
                            transition={{ repeat: Infinity, duration: 1.8 }}
                            className="text-white/90 text-xs tracking-[0.3em] uppercase mb-3"
                          >
                            Hidden Pic #{idx + 1}
                          </motion.div>
                          <span className="text-white/60 text-sm uppercase tracking-wider">Tap to uncover</span>
                        </div>
                      ) : (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="absolute bottom-0 left-0 right-0 p-4"
                        >
                          <span className="text-pink-200 text-xs tracking-widest uppercase">Revealed Memory #{idx + 1}</span>
                          <p className="mt-2 text-white/75 text-sm leading-relaxed">
                            {DEFAULT_SECRET_NOTES[idx % DEFAULT_SECRET_NOTES.length]}
                          </p>
                        </motion.div>
                      )}
                    </div>
                  </motion.button>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        className="flex flex-col items-center mt-32"
      >
        <p className="text-white/40 mb-8 italic tracking-widest text-sm uppercase">Something special remains</p>
        <motion.button
          onClick={onNext}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="bg-white text-black px-12 py-5 rounded-full font-bold shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:shadow-[0_0_50px_rgba(255,255,255,0.5)] transition-all flex items-center gap-3"
        >
          View Secret Gift
          <span className="text-xl">🎁</span>
        </motion.button>
      </motion.div>
    </div>
  );
};

export default MemoryTimeline;

