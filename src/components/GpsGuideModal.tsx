"use client";

import React, { useState } from 'react';
import { MapPin, AlertTriangle, CheckCircle2, X, RefreshCw, Smartphone, ExternalLink, Settings, ShieldCheck } from 'lucide-react';

interface GpsGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => Promise<void> | void;
  isRetrying?: boolean;
}

export function GpsGuideModal({ isOpen, onClose, onRetry, isRetrying = false }: GpsGuideModalProps) {
  const [activeTab, setActiveTab] = useState<'iphone' | 'android'>('iphone');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 text-slate-100 relative max-h-[90vh] overflow-y-auto">
        
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* ヘッダー */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-1.5">
              <span>位置情報の許可・設定ガイド</span>
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              ブラウザの設定で位置情報を「許可」にする手順
            </p>
          </div>
        </div>

        {/* 注意バナー */}
        <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-2xl text-xs space-y-1 text-amber-200">
          <div className="flex items-center gap-1.5 font-bold text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>位置情報が「ブロック中（OFF）」になっています</span>
          </div>
          <p className="text-[11px] leading-relaxed text-amber-200/90">
            初回アクセス時に「許可しない」を選んだ場合、ブラウザの仕様により自動では再確認されません。以下の手順で許可に変更してください。
          </p>
        </div>

        {/* 機種切り替えタブ */}
        <div className="grid grid-cols-2 gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
          <button
            type="button"
            onClick={() => setActiveTab('iphone')}
            className={`py-2 px-3 rounded-lg font-black text-xs transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'iphone'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>🍎 iPhone (Safari)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('android')}
            className={`py-2 px-3 rounded-lg font-black text-xs transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'android'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>🤖 Android (Chrome)</span>
          </button>
        </div>

        {/* iPhone (Safari) の手順 */}
        {activeTab === 'iphone' && (
          <div className="space-y-2.5 text-xs font-medium text-slate-200">
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">1</span>
              <div>
                <p className="font-bold text-white">アドレスバー左の「ぁあ」またはメニューをタップ</p>
                <p className="text-[11px] text-slate-400 mt-0.5">画面下部または上部のアドレスバー左端にある文字をタップします。</p>
              </div>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">2</span>
              <div>
                <p className="font-bold text-white">「Webサイトの設定」をタップ</p>
                <p className="text-[11px] text-slate-400 mt-0.5">開いたメニュー内の歯車アイコン「Webサイトの設定」を選択します。</p>
              </div>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">3</span>
              <div>
                <p className="font-bold text-white">「位置情報」を【許可】に変更</p>
                <p className="text-[11px] text-emerald-300 mt-0.5">「拒否」または「確認」から「許可」に変更して完了を押します。</p>
              </div>
            </div>

            <div className="p-2.5 bg-slate-800/40 rounded-xl border border-slate-700/40 text-[11px] text-slate-400 leading-relaxed">
              💡 <strong>それでも動かない場合:</strong> iPhoneの「設定アプリ ➔ プライバシーとセキュリティ ➔ 位置情報サービス」がONになっているかご確認ください。
            </div>
          </div>
        )}

        {/* Android (Chrome) の手順 */}
        {activeTab === 'android' && (
          <div className="space-y-2.5 text-xs font-medium text-slate-200">
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">1</span>
              <div>
                <p className="font-bold text-white">アドレスバー左の「🔒(南京錠)」または調整マークをタップ</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Chromeのアドレスバーの左端にあるアイコンをタップします。</p>
              </div>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">2</span>
              <div>
                <p className="font-bold text-white">「権限」または「サイトの設定」をタップ</p>
                <p className="text-[11px] text-slate-400 mt-0.5">メニューからサイトの権限設定を開きます。</p>
              </div>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">3</span>
              <div>
                <p className="font-bold text-white">「位置情報」のアクセスを【許可】にする</p>
                <p className="text-[11px] text-emerald-300 mt-0.5">ブロックを解除し、「許可」に切り替えてページを再読み込みします。</p>
              </div>
            </div>
          </div>
        )}

        {/* 再取得アクションボタン */}
        <div className="space-y-2 pt-2">
          <button
            type="button"
            disabled={isRetrying}
            onClick={async () => {
              await onRetry();
            }}
            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-black text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{isRetrying ? '位置情報を再測位中...' : '設定完了！今すぐ位置情報を再取得する'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            閉じる
          </button>
        </div>

      </div>
    </div>
  );
}
