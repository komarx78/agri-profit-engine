"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Smartphone, Share, PlusSquare, X, Download, CheckCircle2, Sparkles, ExternalLink, AlertTriangle } from 'lucide-react';
import { t, LanguageCode } from '@/lib/i18n';

export function PwaInstallPrompt({ language = 'ja' }: { language?: LanguageCode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isLine, setIsLine] = useState(false);
  const [showTopBanner, setShowTopBanner] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const userAgent = window.navigator.userAgent.toLowerCase();
    
    // iOS判定
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // LINEアプリ内ブラウザ判定
    const isLineApp = /line\//.test(userAgent) || /line/.test(userAgent);
    setIsLine(isLineApp);

    // Android Chrome 等の beforeinstallprompt イベント
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsOpen(false);
        setShowTopBanner(false);
      }
    } else {
      setIsOpen(true);
    }
  };

  return (
    <>
      {/* ① ヘッダーに置く「アプリ化」ボタン */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black shadow transition-all active:scale-95 cursor-pointer shrink-0"
        title="スマホのホーム画面にアプリアイコンを追加できます"
      >
        <Smartphone className="w-3.5 h-3.5 text-emerald-100 shrink-0" />
        <span className="whitespace-nowrap">{t('pwaInstallBtn', language)}</span>
      </button>

      {/* ② LINE内ブラウザ用 緊急警告バー */}
      {isLine && (
        <div className="fixed top-0 left-0 right-0 z-[250] bg-amber-500 text-slate-950 px-3 py-2 text-xs font-black flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <AlertTriangle className="w-4 h-4 shrink-0 text-slate-950" />
            <span className="truncate">LINE内ブラウザです。右下の「︙」から「Safariで開く」を押すと快適に使えます</span>
          </div>
          <a
            href={typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?openExternalBrowser=1` : '#'}
            className="px-2 py-1 bg-slate-950 text-white rounded text-[11px] font-bold shrink-0 ml-2 shadow"
          >
            Safariで開く
          </a>
        </div>
      )}

      {/* インストール手順モーダル */}
      <PwaInstallModal 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
        isLine={isLine}
        isIos={isIos}
        deferredPrompt={deferredPrompt}
        onInstallClick={handleInstallClick}
        language={language}
      />
    </>
  );
}

{/* 📱 ページの最下部に配置するアプリ化案内バナー（画面に被らない安全配置） */}
export function PwaBottomBanner({ language = 'ja' }: { language?: LanguageCode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isLine, setIsLine] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('agri_pwa_banner_dismissed') === 'true';
    }
    return false;
  });
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIos(/iphone|ipad|ipod/.test(userAgent));
    setIsLine(/line\//.test(userAgent) || /line/.test(userAgent));

    const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsOpen(false);
        setIsDismissed(true);
        localStorage.setItem('agri_pwa_banner_dismissed', 'true');
      }
    } else {
      setIsOpen(true);
    }
  };

  // アプリとして起動中、または閉じた後は非表示
  if (isStandalone || isDismissed || isLine) return null;

  return (
    <>
      <div className="w-full max-w-md mx-auto my-6 px-1">
        <div className="bg-slate-900/95 backdrop-blur-md border-2 border-emerald-500/80 rounded-2xl p-3 shadow-xl flex items-center justify-between gap-3 text-slate-100">
          <div 
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-lg shadow-md shrink-0 border border-emerald-300/30">
              🌱
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black text-white flex items-center gap-1 truncate">
                <span>{t('pwaBannerTitle', language)}</span>
                <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
              </div>
              <p className="text-[10px] text-emerald-300 font-bold truncate">
                {t('pwaBannerSub', language)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-[11px] font-black transition-all shadow cursor-pointer active:scale-95"
            >
              {t('pwaViewSteps', language)}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsDismissed(true);
                localStorage.setItem('agri_pwa_banner_dismissed', 'true');
              }}
              className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="閉じる"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* インストール手順モーダル */}
      <PwaInstallModal 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
        isLine={isLine}
        isIos={isIos}
        deferredPrompt={deferredPrompt}
        onInstallClick={handleInstallClick}
        language={language}
      />
    </>
  );
}

{/* 共通インストール手順モーダルコンポーネント */}
function PwaInstallModal({
  isOpen,
  onClose,
  isLine,
  isIos,
  deferredPrompt,
  onInstallClick,
  language = 'ja'
}: {
  isOpen: boolean;
  onClose: () => void;
  isLine: boolean;
  isIos: boolean;
  deferredPrompt: any;
  onInstallClick: () => void;
  language?: LanguageCode;
}) {
  const [platform, setPlatform] = useState<'ios' | 'android'>(isIos ? 'ios' : 'android');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setPlatform(isIos ? 'ios' : 'android');
  }, [isIos]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[9999] overflow-y-auto p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="flex min-h-full items-center justify-center py-4">
        <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 text-slate-100 relative my-auto">
          
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="閉じる"
          >
            <X className="w-5 h-5" />
          </button>

          {/* ヘッダー */}
          <div className="flex items-center gap-3 pr-8">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-2xl shadow-lg shadow-emerald-900/50 border border-emerald-400/40 shrink-0">
              🌱
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-black text-white flex items-center gap-1.5">
                <span>{t('pwaModalTitle', language)}</span>
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              </h3>
              <p className="text-xs text-slate-400 font-medium leading-tight">
                {t('pwaModalSub', language)}
              </p>
            </div>
          </div>

          {/* LINE注意 */}
          {isLine && (
            <div className="p-3 bg-amber-500/20 border border-amber-500/40 rounded-2xl text-xs space-y-1 text-amber-200">
              <p className="font-black text-amber-300">{t('pwaLineWarning', language)}</p>
              <p className="leading-relaxed text-[11px]">
                {t('pwaLineDesc', language)}
              </p>
            </div>
          )}

          {/* メリット */}
          <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700 space-y-1.5 text-xs">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{t('pwaBenefit1', language)}</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{t('pwaBenefit2', language)}</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{t('pwaBenefit3', language)}</span>
            </div>
          </div>

          {/* プラットフォーム切り替えタブ */}
          <div className="grid grid-cols-2 p-1 bg-slate-800 rounded-xl gap-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setPlatform('ios')}
              className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                platform === 'ios'
                  ? 'bg-amber-500 text-slate-950 font-black shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🍎 iPhone</span>
            </button>
            <button
              type="button"
              onClick={() => setPlatform('android')}
              className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                platform === 'android'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🤖 Android</span>
            </button>
          </div>

          {/* iPhone (Safari) の手順 */}
          {platform === 'ios' && (
            <div className="space-y-2 text-xs font-bold text-slate-200 animate-in fade-in duration-150">
              <div className="flex items-start gap-2.5 p-3 bg-slate-800/90 rounded-xl border border-slate-700/60">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">1</span>
                <p className="leading-relaxed">
                  {t('pwaIosStep1', language)}
                </p>
              </div>

              <div className="flex items-start gap-2.5 p-3 bg-slate-800/90 rounded-xl border border-slate-700/60">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">2</span>
                <p className="leading-relaxed">
                  {t('pwaIosStep2', language)}
                </p>
              </div>
            </div>
          )}

          {/* Android (Chrome) の手順 */}
          {platform === 'android' && (
            <div className="space-y-2 text-xs font-bold text-slate-200 animate-in fade-in duration-150">
              {deferredPrompt && (
                <button
                  type="button"
                  onClick={onInstallClick}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-black text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95 mb-2"
                >
                  <Download className="w-4 h-4" />
                  <span>{t('pwaAndroidOneTap', language)}</span>
                </button>
              )}
              <div className="flex items-start gap-2.5 p-3 bg-slate-800/90 rounded-xl border border-slate-700/60">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">1</span>
                <p className="leading-relaxed">
                  {t('pwaAndroidStep1', language)}
                </p>
              </div>
              <div className="flex items-start gap-2.5 p-3 bg-slate-800/90 rounded-xl border border-slate-700/60">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">2</span>
                <p className="leading-relaxed">
                  {t('pwaAndroidStep2', language)}
                </p>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            {t('pwaCloseBtn', language)}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
