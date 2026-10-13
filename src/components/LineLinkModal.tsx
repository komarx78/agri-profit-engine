"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, CheckCircle2, Copy, Check, MessageSquare, 
  ExternalLink, RefreshCw, AlertCircle, Unlink, Sparkles, ShieldCheck
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface LineLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  worker: {
    id: string;
    name: string;
    pin_code?: string;
    line_user_id?: string | null;
    is_line_notification_enabled?: boolean;
    user_id?: string | null;
  } | null;
  onLinkedSuccess?: () => void;
}

export const AGRI_PROFIT_LINE_CONSTANTS = {
  accountName: 'アグリプロフィット公式',
  basicId: '@543tdbfc',
  addFriendUrl: 'https://lin.ee/RD1vp8c',
  qrCodeUrl: 'https://qr-official.line.me/gs/M_543tdbfc_GW.png?from=page&searchId=543tdbfc',
  getOaMessageUrl: (pin: string) => `https://line.me/R/oaMessage/@543tdbfc/?${pin}`
};

// 互換性エイリアス
export const RAKUMARU_LINE_CONSTANTS = AGRI_PROFIT_LINE_CONSTANTS;

/**
 * 📱 スタッフ専用 LINE公式アカウント ワンタイムPIN連携モーダル
 * （現場スタッフが1秒で直感理解・LINEトークに4桁のPINを送るだけで自動連携）
 */
export const LineLinkModal: React.FC<LineLinkModalProps> = ({
  isOpen,
  onClose,
  worker,
  onLinkedSuccess
}) => {
  const [loading, setLoading] = useState(true);
  const [pin, setPin] = useState<string>('');
  const [isLinked, setIsLinked] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [unlinking, setUnlinking] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pollTimerRef = useRef<any>(null);

  // 1. 初期データロード
  useEffect(() => {
    if (!isOpen || !worker?.id) return;

    let isMounted = true;
    setLoading(true);
    setErrorMsg(null);

    const checkLinkAndFetchPin = async () => {
      try {
        const { data: wData, error: selErr } = await supabase
          .from('workers')
          .select('id, name, pin_code, line_user_id, is_line_notification_enabled')
          .eq('id', worker.id)
          .maybeSingle();

        if (selErr) {
          console.warn('LineLinkModal fetch worker err:', selErr);
        }

        const linked = !!(wData?.line_user_id || worker.line_user_id);
        if (!isMounted) return;

        setIsLinked(linked);

        if (!linked) {
          let currentPin = wData?.pin_code || worker.pin_code;
          // PINが未設定または形式が合わない場合は新規生成
          if (!currentPin || currentPin.trim().length === 0) {
            currentPin = Math.floor(1000 + Math.random() * 9000).toString();
            await supabase
              .from('workers')
              .update({ pin_code: currentPin })
              .eq('id', worker.id);
          }
          if (isMounted) {
            setPin(currentPin);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMsg(err?.message || '通信エラーが発生しました');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkLinkAndFetchPin();

    return () => {
      isMounted = false;
    };
  }, [isOpen, worker?.id]);

  // 2. リアルタイム連携検知（自動ポーリング：スタッフがLINEへPIN送信した瞬間に自動検知）
  useEffect(() => {
    if (!isOpen || !worker?.id || isLinked) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      return;
    }

    pollTimerRef.current = setInterval(async () => {
      try {
        const { data: wData } = await supabase
          .from('workers')
          .select('id, line_user_id, is_line_notification_enabled')
          .eq('id', worker.id)
          .maybeSingle();

        if (wData && wData.line_user_id) {
          setIsLinked(true);
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          if (onLinkedSuccess) {
            onLinkedSuccess();
          }
        }
      } catch (_) {}
    }, 2500);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isOpen, worker?.id, isLinked, onLinkedSuccess]);

  if (!isOpen || !worker) return null;

  // PINコピー処理
  const handleCopyPin = () => {
    if (!pin) return;
    navigator.clipboard.writeText(pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 連携解除処理
  const handleUnlink = async () => {
    if (!confirm('LINE公式アカウントとの連携を解除しますか？\n（解除すると打刻忘れ通知などのLINE連絡が届かなくなります）')) {
      return;
    }
    setUnlinking(true);
    try {
      const { error } = await supabase
        .from('workers')
        .update({
          line_user_id: null,
          is_line_notification_enabled: false
        })
        .eq('id', worker.id);

      if (error) throw error;

      setIsLinked(false);
      // 再連携用のPINを再取得
      const newPin = Math.floor(1000 + Math.random() * 9000).toString();
      await supabase.from('workers').update({ pin_code: newPin }).eq('id', worker.id);
      setPin(newPin);
      if (onLinkedSuccess) onLinkedSuccess();
    } catch (err: any) {
      alert('解除に失敗しました: ' + (err.message || '通信エラー'));
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]">
        
        {/* ヘッダー */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-950/60 to-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#06C755] flex items-center justify-center text-white shadow-md">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M12 2C6.48 2 2 5.82 2 10.53c0 4.23 3.64 7.77 8.56 8.41.33.07.78.22.89.5.1.25.07.64-.03 1.05-.16.63-.53 2.05-.53 2.05s-.16.65.25.79c.41.14.94-.23 1.3-.5 3.09-2.27 6.09-4.8 7.98-7.39C21.6 13.56 22 12.09 22 10.53 22 5.82 17.52 2 12 2z"/></svg>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-1.5">
                <span>LINE公式アカウント連携</span>
              </h2>
              <p className="text-[11px] text-emerald-400 font-bold">
                {worker.name} 様 専用連携
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ボディ */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
              <p className="text-xs text-slate-400 font-bold">連携状態を確認中...</p>
            </div>
          ) : isLinked ? (
            // ================= 連携完了画面 =================
            <div className="space-y-5 text-center py-2 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full mx-auto flex items-center justify-center shadow-lg">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <span className="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-xs font-black mb-2">
                  ✅ 連携完了（正常に稼働中）
                </span>
                <h3 className="text-lg font-black text-white">
                  LINE公式アカウントと連携されています
                </h3>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed max-w-xs mx-auto">
                  退勤の打刻忘れ防止アラートや、シフト・業務連絡がご自身のLINEに自動で届きます。
                </p>
              </div>

              <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 text-left space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>連携先アカウント:</span>
                  <span className="font-bold text-white">{RAKUMARU_LINE_CONSTANTS.accountName}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>公式LINE ID:</span>
                  <span className="font-mono font-bold text-emerald-400">{RAKUMARU_LINE_CONSTANTS.basicId}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>対象スタッフ:</span>
                  <span className="font-bold text-white">{worker.name}</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <a
                  href={RAKUMARU_LINE_CONSTANTS.addFriendUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 bg-[#06C755] hover:bg-[#05b34c] text-white font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-98"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>LINEトーク画面を開く</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  type="button"
                  onClick={handleUnlink}
                  disabled={unlinking}
                  className="w-full py-2.5 text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 rounded-xl transition-colors font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>{unlinking ? '連携解除中...' : '連携を解除する'}</span>
                </button>
              </div>
            </div>
          ) : (
            // ================= 未連携・かんたん連携画面 =================
            <div className="space-y-5">
              {errorMsg && (
                <div className="p-3.5 bg-rose-500/20 border border-rose-500/40 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* 手順説明バナー */}
              <div className="bg-emerald-950/40 border border-emerald-500/30 p-3.5 rounded-2xl flex items-start gap-2.5">
                <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-200 leading-relaxed font-bold">
                  【たった1分で完了】LINEで友だち追加して、下の【4桁のコード】をトークに送信するだけで自動連携されます！
                </p>
              </div>

              {/* STEP 1: 友だち追加 */}
              <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-xs font-black text-white">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-[11px] font-black">1</span>
                  <span>公式LINEを友だち追加</span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
                  {/* QRコード */}
                  <div className="p-2 bg-white rounded-2xl shadow-md shrink-0">
                    <img 
                      src={RAKUMARU_LINE_CONSTANTS.qrCodeUrl} 
                      alt="LINE友だち追加QRコード" 
                      className="w-28 h-28 object-contain"
                    />
                  </div>

                  <div className="flex-1 space-y-2 text-center sm:text-left">
                    <p className="text-[11px] text-slate-300">
                      スマホのカメラでQRコードを読み取るか、下のボタンからLINEを開いてください。
                    </p>
                    <a
                      href={RAKUMARU_LINE_CONSTANTS.addFriendUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full py-2.5 px-3 bg-[#06C755] hover:bg-[#05b34c] text-white font-black rounded-xl text-xs items-center justify-center gap-1.5 shadow transition-all active:scale-98"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>LINE友だち追加を開く</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>

              {/* STEP 2: 4桁PINコード送信 */}
              <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-xs font-black text-white">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-[11px] font-black">2</span>
                  <span>トークに連携コードを送信</span>
                </div>

                <p className="text-[11px] text-slate-300">
                  LINE公式アカウントのトーク画面を開き、以下の【4桁のコード】をそのまま送信してください：
                </p>

                {/* PINコード特大カード */}
                <div className="bg-gradient-to-r from-emerald-950 to-slate-900 border-2 border-emerald-500/60 p-4 rounded-2xl flex items-center justify-between gap-3 shadow-inner">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-400 block mb-0.5">連携用コード（PIN）</span>
                    <span className="text-3xl sm:text-4xl font-black font-mono tracking-widest text-white">
                      {pin || '----'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyPin}
                    className={`px-4 py-2.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                      copied 
                        ? 'bg-emerald-500 text-slate-950' 
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>コピー完了</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>コードをコピー</span>
                      </>
                    )}
                  </button>
                </div>

                {/* スマホ用：ワンタップでLINEが開いてコード入力済みの状態にする強力導線 */}
                {pin && (
                  <a
                    href={AGRI_PROFIT_LINE_CONSTANTS.getOaMessageUrl(pin)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 bg-[#06C755] hover:bg-[#05b34c] text-white font-black rounded-xl text-center flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-98 cursor-pointer text-xs sm:text-sm"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>LINEを開いてそのまま送信（1秒連携）</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}

                {/* 自動検知アニメーション */}
                <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 pt-1">
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                  <span>LINE送信を待機中（送信すると自動で完了します）</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>SSL暗号化・マルチテナント完全分離</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition-colors cursor-pointer"
          >
            閉じる
          </button>
        </div>

      </div>
    </div>
  );
};
