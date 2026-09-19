"use client";

import React from 'react';
import { Printer, X, Smartphone, CheckCircle, QrCode } from 'lucide-react';

interface FarmPosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  farmCode: string;
  companyName: string;
  tenantId: string;
}

export const FarmPosterModal: React.FC<FarmPosterModalProps> = ({
  isOpen,
  onClose,
  farmCode,
  companyName,
  tenantId,
}) => {
  if (!isOpen) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://agri-profit-engine.vercel.app';
  const portalUrl = `${origin}/portal/${tenantId}?openExternalBrowser=1`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(portalUrl)}`;
  const displayCode = (farmCode || 'sahara-789').toUpperCase();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
      {/* 印刷用スタイル注入 */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #farm-poster-print-area, #farm-poster-print-area * {
            visibility: visible;
          }
          #farm-poster-print-area {
            position: fixed;
            left: 0;
            top: 0;
            width: 100vw;
            height: 100vh;
            padding: 24mm 20mm;
            margin: 0;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
            z-index: 999999;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* モーダルカード本体 */}
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-8">
        {/* 操作ヘッダー（印刷時は非表示） */}
        <div className="no-print bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-base">現場休憩所・掲示用 A4ポスター印刷</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              印刷する（A4）
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 印刷エリア（A4レイアウト） */}
        <div id="farm-poster-print-area" className="p-8 md:p-12 bg-white flex flex-col justify-between">
          <div>
            {/* 農園名ヘッダー */}
            <div className="text-center border-b-4 border-emerald-600 pb-4 mb-6">
              <span className="inline-block bg-emerald-100 text-emerald-800 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider mb-2">
                現場スタッフ用 スマホ出退勤・日報アプリ案内
              </span>
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
                {companyName || '当農園'} 現場ポータル
              </h1>
            </div>

            {/* 農園コードハイライト（最重要） */}
            <div className="bg-emerald-50 border-4 border-emerald-500 rounded-2xl p-6 text-center shadow-inner mb-8">
              <div className="flex items-center justify-center gap-2 text-emerald-800 font-bold text-sm md:text-base mb-1">
                <Smartphone className="w-5 h-5 text-emerald-600" />
                アプリ起動時に入力する「農園コード」
              </div>
              <div className="text-4xl md:text-6xl font-black tracking-widest text-emerald-950 font-mono py-2 select-all">
                {displayCode}
              </div>
              <p className="text-xs md:text-sm text-emerald-700 font-medium mt-1">
                ※アプリ初回起動時に「農園コードを入力」と表示されたら、上記をそのまま入力してください。
              </p>
            </div>

            {/* QRコードと接続手順の2カラム */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center bg-slate-50 p-6 rounded-2xl border border-slate-200">
              {/* QRコード */}
              <div className="md:col-span-5 flex flex-col items-center justify-center text-center">
                <div className="bg-white p-3 rounded-2xl shadow-md border border-slate-300">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrUrl}
                    alt="QR Code"
                    className="w-44 h-44 md:w-48 md:h-48 object-contain"
                  />
                </div>
                <span className="text-xs font-bold text-slate-600 mt-2">
                  カメラで読み取ってアクセス
                </span>
              </div>

              {/* 3ステップ手順 */}
              <div className="md:col-span-7 space-y-4">
                <h2 className="text-base font-black text-slate-900 border-l-4 border-emerald-600 pl-3">
                  📱 カンタン接続 3ステップ
                </h2>

                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
                      1
                    </span>
                    <div>
                      <div className="font-bold text-slate-800">QRコードをかざす（入力不要！）</div>
                      <div className="text-xs text-slate-500">
                        スマホのカメラ、またはアプリの「📷 QR読み取り」ボタンでこのQRを写すだけで一発接続！
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
                      2
                    </span>
                    <div>
                      <div className="font-bold text-slate-800">（手入力する場合）農園コードを入力</div>
                      <div className="text-xs text-slate-500">
                        「<span className="font-mono font-bold text-emerald-700">{displayCode}</span>」と入力して接続ボタンを押します。
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
                      3
                    </span>
                    <div>
                      <div className="font-bold text-slate-800">PIN（暗証番号）で打刻・日報</div>
                      <div className="text-xs text-slate-500">
                        自分の名前を選び、4桁のPINを入力して出勤・退勤・作業記録を行えます！
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* フッター */}
          <div className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-400">
            <div>
              {companyName} 農業統合管理システム（agri-profit-engine PRO）
            </div>
            <div>
              発行日: {new Date().toLocaleDateString('ja-JP')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
