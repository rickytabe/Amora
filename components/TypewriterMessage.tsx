
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TypewriterMessageProps {
  onComplete: () => void;
  config: any;
  theme: any;
}

const TypewriterMessage: React.FC<TypewriterMessageProps> = ({ onComplete, config, theme }) => {
  const [index, setIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [showButton, setShowButton] = useState(false);

  const messages = config.TYPEWRITER_MESSAGES;

  useEffect(() => {
    if (index >= messages.length) {
      setShowButton(true);
      return;
    }

    const currentMsg = messages[index];
    const shouldAppendRecipientName = currentMsg.isSpecial && config.MODE !== 'ADMIRER';
    const fullText = shouldAppendRecipientName
      ? `${currentMsg.text}${config.LOVED_ONE_NAME}.`
      : currentMsg.text;

    let charIndex = 0;
    setIsTyping(true);

    const timer = setInterval(() => {
      setDisplayedText(fullText.slice(0, charIndex + 1));
      charIndex++;

      if (charIndex === fullText.length) {
        clearInterval(timer);
        setIsTyping(false);
        setTimeout(() => {
          setIndex(prev => prev + 1);
          setDisplayedText("");
        }, currentMsg.pause || 2000);
      }
    }, 60);

    return () => clearInterval(timer);
  }, [index, messages, config.LOVED_ONE_NAME, config.MODE]);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center p-8 bg-black/60 backdrop-blur-sm z-40">
      <div className="max-w-3xl w-full text-center relative h-64 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {!showButton && displayedText && (
            <motion.h2
              key={index}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className={`${theme.font} text-3xl md:text-5xl lg:text-6xl text-white leading-relaxed tracking-tight`}
            >
              {displayedText.split(config.LOVED_ONE_NAME).map((part: string, i: number, arr: any[]) => (
                <React.Fragment key={i}>
                  {part}
                  {i < arr.length - 1 && (
                    <motion.span
                      animate={{ textShadow: ["0 0 10px #ec4899", "0 0 30px #ec4899", "0 0 10px #ec4899"] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="text-pink-500 drop-shadow-[0_0_10px_#ec4899]"
                    >
                      {config.LOVED_ONE_NAME}
                    </motion.span>
                  )}
                </React.Fragment>
              ))}
              {isTyping && <span className="animate-pulse inline-block w-1 h-12 bg-pink-500 ml-2 align-middle" />}
            </motion.h2>
          )}
        </AnimatePresence>

        {showButton && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            className="flex flex-col items-center gap-8"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 3 }}
              className="w-16 h-16 border-2 border-pink-500 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(236,72,153,0.5)]"
            >
              <span className="text-2xl">{theme.icon}</span>
            </motion.div>
            
            <button
              onClick={onComplete}
              className="px-10 py-4 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md rounded-full text-white font-medium tracking-widest uppercase text-sm transition-all hover:scale-110 active:scale-95 shadow-2xl"
            >
              Continue
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default TypewriterMessage;
