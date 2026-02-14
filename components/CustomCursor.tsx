
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const CustomCursor: React.FC = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <>
      <motion.div
        animate={{ x: position.x - 12, y: position.y - 12 }}
        transition={{ type: 'spring', damping: 20, stiffness: 200, mass: 0.5 }}
        className="fixed top-0 left-0 w-6 h-6 border border-pink-500 rounded-full pointer-events-none z-[9999] mix-blend-difference hidden md:block"
      />
      <motion.div
        animate={{ x: position.x - 150, y: position.y - 150 }}
        transition={{ type: 'spring', damping: 30, stiffness: 100 }}
        className="fixed top-0 left-0 w-[300px] h-[300px] bg-pink-500/10 rounded-full pointer-events-none z-0 blur-[100px] hidden md:block"
      />
    </>
  );
};

export default CustomCursor;
