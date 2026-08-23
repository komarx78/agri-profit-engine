"use client";

import React, { useState, useRef } from 'react';

export interface Narration {
  id: string;
  start_time: number;
  end_time: number;
  script_ja: string;
  script_en?: string;
  script_vi?: string;
}

interface VideoPlayerProps {
  videoUrl: string;
  narrations: Narration[];
  language: 'ja' | 'en' | 'vi';
  onTimeUpdate?: (time: number) => void;
}

export default function VideoPlayerWithSubtitles({ videoUrl, narrations, language, onTimeUpdate }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentSubtitle, setCurrentSubtitle] = useState('');

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    
    if (onTimeUpdate) {
      onTimeUpdate(time);
    }

    // 現在の再生時間に一致するナレーションを検索
    const activeNarration = narrations.find(
      (n) => time >= Number(n.start_time) && time <= Number(n.end_time)
    );

    if (activeNarration) {
      if (language === 'ja') setCurrentSubtitle(activeNarration.script_ja);
      else if (language === 'en') setCurrentSubtitle(activeNarration.script_en || activeNarration.script_ja);
      else if (language === 'vi') setCurrentSubtitle(activeNarration.script_vi || activeNarration.script_ja);
    } else {
      setCurrentSubtitle('');
    }
  };

  return (
    <div className="relative w-full bg-slate-900 rounded-2xl overflow-hidden shadow-inner border border-slate-800" style={{ aspectRatio: '16/9' }}>
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-contain"
        controls
        controlsList="nodownload"
        onTimeUpdate={handleTimeUpdate}
      />
      
      {/* 字幕オーバーレイ */}
      {currentSubtitle && (
        <div className="absolute bottom-20 left-0 right-0 flex justify-center px-4 pointer-events-none transition-opacity duration-200">
          <div className="bg-black/75 text-white px-6 py-3 rounded-xl text-lg md:text-xl font-bold max-w-4xl text-center shadow-lg backdrop-blur-md border border-white/10">
            {currentSubtitle}
          </div>
        </div>
      )}
    </div>
  );
}
