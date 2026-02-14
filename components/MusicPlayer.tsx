
import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { motion } from 'framer-motion';
import { MUSIC_TRACKS } from '../constants';

interface MusicPlayerProps {
  isPlaying: boolean;
  onToggle: () => void;
  trackType?: string;
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

const MusicPlayer: React.FC<MusicPlayerProps> = ({ isPlaying, onToggle, trackType = 'romantic' }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const [isYTReady, setIsYTReady] = useState(false);

  const track = MUSIC_TRACKS.find(t => t.id === trackType) || MUSIC_TRACKS[1];
  const isYouTube = track.url.includes('youtube.com') || track.url.includes('youtu.be');

  // Extract YouTube ID
  const getYTId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  useEffect(() => {
    if (isYouTube && !window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        setIsYTReady(true);
      };
    } else if (isYouTube && window.YT) {
      setIsYTReady(true);
    }
  }, [isYouTube]);

  useEffect(() => {
    if (isYouTube && isYTReady) {
      const videoId = getYTId(track.url);
      if (!videoId) return;

      if (!ytPlayerRef.current) {
        // Create hidden container for YT
        const playerDiv = document.createElement('div');
        playerDiv.id = 'yt-player';
        playerDiv.style.display = 'none';
        document.body.appendChild(playerDiv);

        ytPlayerRef.current = new window.YT.Player('yt-player', {
          height: '0',
          width: '0',
          videoId: videoId,
          playerVars: {
            autoplay: isPlaying ? 1 : 0,
            loop: 1,
            playlist: videoId
          },
          events: {
            onReady: (event: any) => {
              event.target.setVolume(40);
              if (isPlaying) event.target.playVideo();
            }
          }
        });
      } else {
        const currentId = ytPlayerRef.current.getVideoData?.().video_id;
        if (currentId !== videoId) {
          ytPlayerRef.current.loadVideoById(videoId);
        }
      }
    }

    // Toggle YT playback
    if (ytPlayerRef.current && ytPlayerRef.current.playVideo) {
      if (isPlaying) ytPlayerRef.current.playVideo();
      else ytPlayerRef.current.pauseVideo();
    }

    return () => {
      if (!isYouTube && ytPlayerRef.current) {
        ytPlayerRef.current.destroy?.();
        ytPlayerRef.current = null;
      }
    };
  }, [isYouTube, isYTReady, track.url, isPlaying]);

  useEffect(() => {
    if (isYouTube) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      return;
    }

    if (!track.url) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(track.url);
      audioRef.current.loop = true;
      audioRef.current.volume = 0.3;
    } else if (audioRef.current.src !== track.url) {
      audioRef.current.src = track.url;
    }

    if (isPlaying) {
      audioRef.current.play().catch(e => console.warn("Autoplay blocked:", e));
    } else {
      audioRef.current.pause();
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [isPlaying, track.url, isYouTube]);

  if (track.id === 'none') return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed top-8 right-8 z-[100]"
    >
      <button
        onClick={onToggle}
        className="w-12 h-12 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center text-white transition-all hover:bg-white/20 active:scale-90 shadow-xl"
      >
        {isPlaying ? <Volume2 size={20} /> : <VolumeX size={20} />}
      </button>
      {isPlaying && (
        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest text-white/40 whitespace-nowrap bg-black/40 px-2 py-0.5 rounded">
          Playing: {track.name}
        </span>
      )}
    </motion.div>
  );
};

export default MusicPlayer;
