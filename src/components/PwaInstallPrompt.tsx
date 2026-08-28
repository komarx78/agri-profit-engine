"use client";

import React, { useState, useEffect } from 'react';
import { Smartphone, Share, PlusSquare, X, Download, CheckCircle2, Sparkles, ExternalLink, AlertTriangle } from 'lucide-react';

export function PwaInstallPrompt() {
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
        <span className="whitespace-nowrap">📱 アプリ化</span>
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

      {/* ③ 画面下部の常設目立つバナー（閉じることも可能） */}
      {showTopBanner && !isLine && (
        <div className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:bottom-4 z-[100] max-w-sm">
          <div className="bg-slate-900/95 backdrop-blur-md border-2 border-emerald-500/80 rounded-2xl p-3 shadow-2xl shadow-emerald-950/60 flex items-center justify-between gap-3 text-slate-100 animate-bounce-short">
            <div 
              onClick={() => setIsOpen(true)}
              className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-lg shadow-md shrink-0 border border-emerald-300/30">
                🌱
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black text-white flex items-center gap-1 truncate">
                  <span>アグリ現場をアプリにする</span>
                  <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                </div>
                <p className="text-[10px] text-emerald-300 font-bold truncate">
                  ホーム画面に追加して全画面起動
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-[11px] font-black transition-all shadow cursor-pointer active:scale-95"
              >
                手順を見る
              </button>
              <button
                type="button"
                onClick={() => setShowTopBanner(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                title="閉じる"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ④ インストール手順モーダル（全端末対応・図解） */}
      {isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 text-slate-100 relative max-h-[90vh] overflow-y-auto">
            
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* ヘッダー */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-2xl shadow-lg shadow-emerald-900/50 border border-emerald-400/40 shrink-0">
                🌱
              </div>
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-1.5">
                  <span>アグリ現場 をアプリ化</span>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  URLバーが消え、全画面でサクサク起動します
                </p>
              </div>
            </div>

            {/* LINE注意 */}
            {isLine && (
              <div className="p-3 bg-amber-500/20 border border-amber-500/40 rounded-2xl text-xs space-y-1 text-amber-200">
                <p className="font-black text-amber-300">⚠️ 現在LINEアプリ内で開かれています</p>
                <p className="leading-relaxed text-[11px]">
                  LINE内ではホーム画面追加が制限されるため、右下の「︙」または共有アイコンから<strong>「Safariで開く（ブラウザで開く）」</strong>を選択してください。
                </p>
              </div>
            )}

            {/* メリット */}
            <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>ホーム画面から1タップで即起動</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>ブラウザの余計な枠がなく画面広々</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>現場での作業記録や打刻が超スムーズ</span>
              </div>
            </div>

            {/* iPhone (Safari) の手順 */}
            <div className="space-y-3 pt-1">
              <div className="text-xs font-black text-amber-300 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20 flex items-center gap-1.5">
                <span>🍎 iPhone (Safari) での手順:</span>
              </div>

              <div className="space-y-2 text-xs font-bold text-slate-200">
                <div className="flex items-start gap-2.5 p-3 bg-slate-800/90 rounded-xl border border-slate-700/60">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">1</span>
                  <p className="leading-relaxed">
                    Safari画面下の <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-700 rounded text-sky-400 font-mono"><Share className="w-3.5 h-3.5 inline mr-1" />共有ボタン</span> をタップ
                  </p>
                </div>

                <div className="flex items-start gap-2.5 p-3 bg-slate-800/90 rounded-xl border border-slate-700/60">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">2</span>
                  <p className="leading-relaxed">
                    メニュー内の <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-700 rounded text-emerald-400 font-mono"><PlusSquare className="w-3.5 h-3.5 inline mr-1" />「ホーム画面に追加」</span> を選択して「追加」をタップ！
                  </p>
                </div>
              </div>
            </div>

            {/* Android (Chrome) の手順 */}
            <div className="space-y-3 pt-1">
              <div className="text-xs font-black text-emerald-300 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                🤖 Android / Chrome での手順:
              </div>

              {deferredPrompt ? (
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-black text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>今すぐワンタップでインストール</span>
                </button>
              ) : (
                <div className="space-y-2 text-xs font-bold text-slate-200">
                  <div className="flex items-start gap-2.5 p-3 bg-slate-800/90 rounded-xl border border-slate-700/60">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">1</span>
                    <p className="leading-relaxed">
                      Chrome右上のメニュー（<strong>︙</strong>）をタップ
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5 p-3 bg-slate-800/90 rounded-xl border border-slate-700/60">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">2</span>
                    <p className="leading-relaxed">
                      <strong>「アプリをインストール」</strong> または <strong>「ホーム画面に追加」</strong> を選択！
                    </p>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </>
  );
}
