"use client";

import React, { useState, useEffect } from 'react';
import { Smartphone, Share, PlusSquare, X, Download, CheckCircle2, Sparkles } from 'lucide-react';

export function PwaInstallPrompt() {
  const [isOpen, setIsOpen] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // すでにPWAアプリ（スタンドアロン）として起動しているかチェック
    const isApp = window.matchMedia('(display-mode: standalone)').matches || 
                  (window.navigator as any).standalone === true;
    setIsStandalone(isApp);

    // iOSデバイスの判定
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

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
      }
    } else {
      setIsOpen(true);
    }
  };

  // すでにアプリとして開いている場合は何も表示しない
  if (isStandalone) return null;

  return (
    <>
      {/* ヘッダーやメニューに置くクイック起動ボタン */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-950/40 transition-all active:scale-95 cursor-pointer border border-emerald-400/30 animate-pulse"
        title="スマホのホーム画面にアプリアイコンを追加できます"
      >
        <Smartphone className="w-3.5 h-3.5 text-emerald-200" />
        <span>📱 アプリ化（ホーム画面に追加）</span>
      </button>

      {/* インストール手順モーダル */}
      {isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 text-slate-100 relative">
            
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* ヘッダー */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-2xl shadow-lg shadow-emerald-900/50 border border-emerald-400/40">
                🌱
              </div>
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-1.5">
                  <span>アグリ現場 をアプリにする</span>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  URLバーが消え、全画面で高速に起動します
                </p>
              </div>
            </div>

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

            {/* ガイド手順 */}
            {isIos ? (
              /* iPhone (Safari) の手順 */
              <div className="space-y-3 pt-1">
                <div className="text-xs font-black text-amber-300 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20">
                  🍎 iPhone (Safari) での手順 (2ステップ):
                </div>

                <div className="space-y-2 text-xs font-bold text-slate-200">
                  <div className="flex items-start gap-2.5 p-2.5 bg-slate-800 rounded-xl border border-slate-700/60">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">1</span>
                    <p className="leading-relaxed">
                      画面下の <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-700 rounded text-sky-400 font-mono"><Share className="w-3 h-3 inline mr-1" />共有ボタン</span> をタップします。
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5 p-2.5 bg-slate-800 rounded-xl border border-slate-700/60">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">2</span>
                    <p className="leading-relaxed">
                      メニューから <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-700 rounded text-emerald-400 font-mono"><PlusSquare className="w-3 h-3 inline mr-1" />「ホーム画面に追加」</span> を選択して「追加」をタップ！
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* Android / PC Chrome の手順 */
              <div className="space-y-3 pt-1">
                {deferredPrompt ? (
                  <button
                    type="button"
                    onClick={handleInstallClick}
                    className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Download className="w-5 h-5" />
                    <span>今すぐアプリをインストールする</span>
                  </button>
                ) : (
                  <div className="space-y-2 text-xs font-bold text-slate-200">
                    <div className="text-xs font-black text-emerald-300 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                      🤖 Android / Chrome での手順:
                    </div>
                    <div className="flex items-start gap-2.5 p-2.5 bg-slate-800 rounded-xl border border-slate-700/60">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">1</span>
                      <p className="leading-relaxed">
                        ブラウザ右上のメニュー（<strong>︙</strong>）をタップします。
                      </p>
                    </div>
                    <div className="flex items-start gap-2.5 p-2.5 bg-slate-800 rounded-xl border border-slate-700/60">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">2</span>
                      <p className="leading-relaxed">
                        <strong>「アプリをインストール」</strong> または <strong>「ホーム画面に追加」</strong> を選択！
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

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
