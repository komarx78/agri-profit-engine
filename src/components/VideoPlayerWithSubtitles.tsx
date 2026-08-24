"use client";

import React, { useState, useRef, useEffect } from 'react';
import { LanguageCode } from '@/lib/i18n';

export interface Narration {
  id?: string;
  start_time: number;
  end_time: number;
  script_ja: string;
  script_en?: string;
  script_vi?: string;
  script_id?: string;
  script_zh?: string;
  script_si?: string;
  script_km?: string;
  translations?: Record<string, string>;
}

interface VideoPlayerProps {
  videoUrl: string;
  narrations?: Narration[];
  language?: LanguageCode | string;
  trimStart?: number;
  trimEnd?: number;
  onTimeUpdate?: (time: number) => void;
  className?: string;
  autoPlay?: boolean;
}

export default function VideoPlayerWithSubtitles({ 
  videoUrl, 
  narrations = [], 
  language = 'ja', 
  trimStart = 0,
  trimEnd,
  onTimeUpdate,
  className = '',
  autoPlay = false
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentSubtitle, setCurrentSubtitle] = useState('');

  // トリミング初期位置の設定
  useEffect(() => {
    if (videoRef.current && trimStart > 0) {
      videoRef.current.currentTime = trimStart;
    }
  }, [trimStart, videoUrl]);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    
    if (onTimeUpdate) {
      onTimeUpdate(time);
    }

    // トリミング制御（末尾を超えたら先頭へ戻すか停止）
    if (trimEnd && trimEnd > 0 && time >= trimEnd) {
      if (videoRef.current) {
        videoRef.current.currentTime = trimStart || 0;
      }
    }

    // 現在の再生時間に一致するテロップ（ナレーション）を検索
    const activeNarration = narrations.find(
      (n) => time >= Number(n.start_time) && time <= Number(n.end_time)
    );

    if (activeNarration) {
      let text = activeNarration.script_ja || '';

      // translations オブジェクト優先
      if (activeNarration.translations && activeNarration.translations[language]) {
        text = activeNarration.translations[language];
      } else {
        // 個別言語カラム判定
        if (language === 'en' && activeNarration.script_en) text = activeNarration.script_en;
        else if (language === 'vi' && activeNarration.script_vi) text = activeNarration.script_vi;
        else if (language === 'id' && activeNarration.script_id) text = activeNarration.script_id;
        else if (language === 'zh' && activeNarration.script_zh) text = activeNarration.script_zh;
        else if (language === 'si' && activeNarration.script_si) text = activeNarration.script_si;
        else if (language === 'km' && activeNarration.script_km) text = activeNarration.script_km;
      }

      setCurrentSubtitle(text);
    } else {
      setCurrentSubtitle('');
    }
  };

  return (
    <div className={`relative w-full bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800 ${className}`} style={{ aspectRatio: '16/9' }}>
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-contain"
        controls
        autoPlay={autoPlay}
        controlsList="nodownload"
        onTimeUpdate={handleTimeUpdate}
      />
      
      {/* 🎬 映画風リアルタイムテロップオーバーレイ */}
      {currentSubtitle && (
        <div className="absolute bottom-14 sm:bottom-16 left-0 right-0 flex justify-center px-4 pointer-events-none z-10 animate-in fade-in zoom-in-95 duration-150">
          <div className="bg-black/80 text-white px-5 py-2.5 sm:px-6 sm:py-3 rounded-2xl text-sm sm:text-base md:text-lg font-black max-w-3xl text-center shadow-2xl backdrop-blur-md border border-white/20 tracking-wide leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {currentSubtitle}
          </div>
        </div>
      )}
    </div>
  );
}

