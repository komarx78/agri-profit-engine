"use client";

import React, { useState, useRef, useEffect } from 'react';
import { LanguageCode, LANGUAGES } from '@/lib/i18n';
import { Globe2, MessageSquare, Volume2, Subtitles, Check, Play, Pause, Loader2, AlertTriangle, ExternalLink } from 'lucide-react';

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
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  // 初期言語の同期
  useEffect(() => {
    if (initialLanguage) {
      setActiveLang(initialLanguage);
    }
  }, [initialLanguage]);

  // 動画URL変更時のリセット
  useEffect(() => {
    if (videoUrl) {
      setIsLoading(false);
      setHasError(false);
      setIsPlaying(false);
      setCurrentSubtitle('');
    }
  }, [videoUrl]);

  // メタデータロード完了時の処理
  const handleLoadedMetadata = () => {
    setIsLoading(false);
    setHasError(false);
    if (videoRef.current) {
      if (trimStart > 0) {
        videoRef.current.currentTime = trimStart;
      }
      if (autoPlay) {
        videoRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(() => {
          setIsPlaying(false);
        });
      }
    }
  };

  const handlePlayPauseToggle = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!videoRef.current) return;

    if (videoRef.current.paused) {
      setIsLoading(true);
      videoRef.current.play().then(() => {
        setIsPlaying(true);
        setIsLoading(false);
      }).catch((err) => {
        console.error('Play error:', err);
        setIsLoading(false);
      });
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      setIsLoading(false);
    }
  };

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
        videoRef.current.pause();
        setIsPlaying(false);
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

  if (!videoUrl) {
    return (
      <div className={`relative w-full bg-black rounded-2xl overflow-hidden flex items-center justify-center ${className}`} style={{ aspectRatio: '16/9' }}>
        <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
      </div>
    );
  }

  return (
    <div 
      className={`relative w-full bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800 group select-none ${className}`} 
      style={{ aspectRatio: '16/9' }}
    >
      <video
        key={videoUrl}
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-contain cursor-pointer"
        controls
        playsInline
        preload="metadata"
        controlsList="nodownload"
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={() => {
          setIsLoading(false);
          setHasError(false);
        }}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => {
          setIsLoading(false);
          setIsPlaying(true);
        }}
        onPause={() => {
          setIsPlaying(false);
          setIsLoading(false);
        }}
        onEnded={() => {
          setIsPlaying(false);
          setIsLoading(false);
        }}
        onError={(e) => {
          if (videoUrl && videoRef.current?.error) {
            console.error('Video error event:', videoRef.current.error);
            setIsLoading(false);
            setHasError(true);
          }
        }}
        onTimeUpdate={handleTimeUpdate}
        onClick={handlePlayPauseToggle}
      />

      {/* ⏳ バッファリング中スピナー (再生中のみ) */}
      {isLoading && isPlaying && !hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-xs pointer-events-none z-10 animate-in fade-in">
          <Loader2 className="w-10 h-10 text-rose-500 animate-spin mb-2" />
          <span className="text-white text-xs font-bold tracking-wider">読み込み中...</span>
        </div>
      )}

      {/* ⚠️ 再生エラー時のフォールバック */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 text-white p-4 text-center z-10 space-y-2.5">
          <AlertTriangle className="w-9 h-9 text-amber-400" />
          <div className="max-w-sm space-y-1">
            <p className="text-xs sm:text-sm font-black text-white">動画の読み込みに失敗しました</p>
            <p className="text-[11px] text-slate-300">
              ストレージ内に動画ファイルが存在しない（404）か、非対応フォーマットの可能性があります。
            </p>
            <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800 text-[10px] text-slate-400 font-mono break-all line-clamp-2">
              URL: {videoUrl}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setHasError(false);
                setIsLoading(true);
                if (videoRef.current) {
                  videoRef.current.load();
                }
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 transition-all shadow-md active:scale-95"
            >
              <span>🔄 再試行</span>
            </button>
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95"
            >
              <span>直接リンクを開く</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* ▶️ 画面中央の大きな再生ボタン（停止中に確実にタップして再生させる） */}
      {!isPlaying && !hasError && (
        <button
          type="button"
          onClick={handlePlayPauseToggle}
          className="absolute inset-0 flex items-center justify-center bg-black/25 hover:bg-black/35 transition-colors z-10 group/btn"
          aria-label="再生"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-rose-600/90 hover:bg-rose-600 text-white rounded-full flex items-center justify-center shadow-2xl group-hover/btn:scale-110 active:scale-95 transition-all backdrop-blur-xs">
            <Play className="w-8 h-8 sm:w-10 sm:h-10 ml-1 fill-white" />
          </div>
        </button>
      )}
      
      {/* 🌐 字幕言語クイック切り替えバー（動画上部オーバーレイ） */}
      {showLanguageSelector && narrations.length > 0 && !hasError && (
        <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
          {/* 字幕言語セレクター */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsLangMenuOpen(!isLangMenuOpen);
              }}
              className="bg-black/75 hover:bg-black/90 text-white backdrop-blur-md px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1.5 border border-white/20 shadow-lg transition-all active:scale-95"
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
      {showSubtitles && currentSubtitle && !hasError && (
        <div className="absolute bottom-8 sm:bottom-14 left-0 right-0 flex justify-center px-3 sm:px-6 pointer-events-none z-10 animate-in fade-in zoom-in-95 duration-150">
          <div className="bg-black/85 text-white px-3.5 py-1.5 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-base md:text-lg font-black max-w-[95%] sm:max-w-3xl text-center shadow-2xl backdrop-blur-md border border-white/20 tracking-wide leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {currentSubtitle}
          </div>
        </div>
      )}
    </div>
  );
}

