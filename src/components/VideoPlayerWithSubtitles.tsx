"use client";

import React, { useState, useRef, useEffect } from 'react';
import { LanguageCode, LANGUAGES } from '@/lib/i18n';
import { Globe2, MessageSquare, Volume2, Subtitles, Check } from 'lucide-react';

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
  showLanguageSelector?: boolean;
}

export default function VideoPlayerWithSubtitles({ 
  videoUrl, 
  narrations = [], 
  language: initialLanguage = 'ja', 
  trimStart = 0,
  trimEnd,
  onTimeUpdate,
  className = '',
  autoPlay = false,
  showLanguageSelector = true
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentSubtitle, setCurrentSubtitle] = useState('');
  const [activeLang, setActiveLang] = useState<string>(initialLanguage);
  const [showSubtitles, setShowSubtitles] = useState<boolean>(true);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState<boolean>(false);

  // 初期言語の同期
  useEffect(() => {
    if (initialLanguage) {
      setActiveLang(initialLanguage);
    }
  }, [initialLanguage]);

  // トリミング初期位置の設定 & モバイル安全再生
  useEffect(() => {
    if (videoRef.current) {
      if (trimStart > 0) {
        videoRef.current.currentTime = trimStart;
      }
      if (autoPlay) {
        // モバイルでオートプレイが拒否されてもクラッシュしないようにハンドリング
        videoRef.current.play().catch(() => {
          // ユーザー操作待ち
        });
      }
    }
  }, [trimStart, videoUrl, autoPlay]);

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

    if (!showSubtitles) {
      setCurrentSubtitle('');
      return;
    }

    // 現在の再生時間に一致するテロップ（ナレーション）を検索
    const activeNarration = narrations.find(
      (n) => time >= Number(n.start_time) && time <= Number(n.end_time)
    );

    if (activeNarration) {
      let text = activeNarration.script_ja || '';

      // translations オブジェクト優先
      if (activeNarration.translations && activeNarration.translations[activeLang]) {
        text = activeNarration.translations[activeLang];
      } else {
        // 個別言語カラム判定
        if (activeLang === 'en' && activeNarration.script_en) text = activeNarration.script_en;
        else if (activeLang === 'vi' && activeNarration.script_vi) text = activeNarration.script_vi;
        else if (activeLang === 'id' && activeNarration.script_id) text = activeNarration.script_id;
        else if (activeLang === 'zh' && activeNarration.script_zh) text = activeNarration.script_zh;
        else if (activeLang === 'si' && activeNarration.script_si) text = activeNarration.script_si;
        else if (activeLang === 'km' && activeNarration.script_km) text = activeNarration.script_km;
      }

      setCurrentSubtitle(text);
    } else {
      setCurrentSubtitle('');
    }
  };

  const currentLangObj = LANGUAGES.find(l => l.code === activeLang) || { name: '日本語', flag: '🇯🇵' };

  return (
    <div className={`relative w-full bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800 group ${className}`} style={{ aspectRatio: '16/9' }}>
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-contain"
        controls
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
        controlsList="nodownload"
        onTimeUpdate={handleTimeUpdate}
      />
      
      {/* 🌐 字幕言語クイック切り替えバー（動画上部オーバーレイ） */}
      {showLanguageSelector && narrations.length > 0 && (
        <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
          {/* 字幕言語セレクター */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
              className="bg-black/75 hover:bg-black/90 text-white backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-white/20 shadow-lg transition-all active:scale-95"
              title="字幕言語を切り替える"
            >
              <Globe2 className="w-3.5 h-3.5 text-rose-400" />
              <span>字幕: {showSubtitles ? `${currentLangObj.flag} ${currentLangObj.name}` : 'OFF'}</span>
            </button>

            {isLangMenuOpen && (
              <div 
                className="absolute right-0 mt-1.5 w-48 bg-slate-900/95 border border-slate-700 text-white rounded-2xl shadow-2xl overflow-hidden py-1.5 z-30 backdrop-blur-md animate-in fade-in zoom-in-95"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-3 py-1 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-800 flex items-center justify-between">
                  <span>字幕言語を選択</span>
                  <button 
                    onClick={() => {
                      setShowSubtitles(!showSubtitles);
                      setIsLangMenuOpen(false);
                    }}
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${showSubtitles ? 'text-rose-400 hover:bg-rose-500/20' : 'text-emerald-400 hover:bg-emerald-500/20'}`}
                  >
                    {showSubtitles ? '字幕を消す' : '字幕を出す'}
                  </button>
                </div>

                <div className="max-h-52 overflow-y-auto py-1">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        setActiveLang(lang.code);
                        setShowSubtitles(true);
                        setIsLangMenuOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-xs font-bold flex items-center justify-between hover:bg-white/10 transition-colors ${
                        showSubtitles && activeLang === lang.code ? 'text-rose-400 bg-white/5' : 'text-slate-200'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </span>
                      {showSubtitles && activeLang === lang.code && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🎬 映画風リアルタイムテロップオーバーレイ */}
      {showSubtitles && currentSubtitle && (
        <div className="absolute bottom-8 sm:bottom-14 left-0 right-0 flex justify-center px-3 sm:px-6 pointer-events-none z-10 animate-in fade-in zoom-in-95 duration-150">
          <div className="bg-black/85 text-white px-3.5 py-1.5 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-base md:text-lg font-black max-w-[95%] sm:max-w-3xl text-center shadow-2xl backdrop-blur-md border border-white/20 tracking-wide leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {currentSubtitle}
          </div>
        </div>
      )}
    </div>
  );
}

