"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Sprout,
  Building,
  User,
  Mail,
  Lock,
  Phone,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Sparkles,
  Copy,
  Check,
  ShieldCheck,
  Gift,
} from 'lucide-react';

function resolveCampaignConfig(rawCode: string): {
  trialDays: number;
  monthsLabel: string;
  campaignName: string;
  isSpecial: boolean;
} {
  const code = (rawCode || '').trim().toUpperCase();
  if (
    code === '6M' ||
    code === 'FREE6M' ||
    code === 'CAMP6M' ||
    code === '6MONTHS' ||
    code.includes('6ヶ月') ||
    code.includes('半年')
  ) {
    return {
      trialDays: 180,
      monthsLabel: '6ヶ月間（180日間）',
      campaignName: '🌸 半年無料キャンペーン',
      isSpecial: true,
    };
  }
  if (
    code === '3M' ||
    code === 'FREE3M' ||
    code === 'CAMP3M' ||
    code === '3MONTHS' ||
    code.includes('3ヶ月') ||
    code.includes('3カ月')
  ) {
    return {
      trialDays: 90,
      monthsLabel: '3ヶ月間（90日間）',
      campaignName: '🎉 3ヶ月無料キャンペーン',
      isSpecial: true,
    };
  }
  if (
    code === '2M' ||
    code === 'FREE2M' ||
    code === 'CAMP2M' ||
    code === '2MONTHS' ||
    code.includes('2ヶ月') ||
    code.includes('2カ月')
  ) {
    return {
      trialDays: 60,
      monthsLabel: '2ヶ月間（60日間）',
      campaignName: '🎁 2ヶ月無料キャンペーン',
      isSpecial: true,
    };
  }
  return {
    trialDays: 30,
    monthsLabel: '1ヶ月間（30日間）',
    campaignName: '標準1ヶ月無料',
    isSpecial: false,
  };
}

export default function RegisterFarmPage() {
  const router = useRouter();

  const [companyName, setCompanyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [preferredFarmCode, setPreferredFarmCode] = useState('');
  const [campaignCode, setCampaignCode] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [completedData, setCompletedData] = useState<{
    tenantId: string;
    companyName: string;
    farmCode: string;
    worker: any;
    trialDays: number;
    trialEndsAt: string;
    campaignName: string;
  } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // URLパラメータ (?campaign=2m / ?campaign=3m 等) からキャンペーンコードを自動取得
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const qCamp =
        params.get('campaign') || params.get('code') || params.get('promo') || '';
      if (qCamp) {
        const upper = qCamp.trim().toUpperCase();
        if (upper === '2M') setCampaignCode('FREE2M');
        else if (upper === '3M') setCampaignCode('FREE3M');
        else if (upper === '6M') setCampaignCode('FREE6M');
        else setCampaignCode(upper);
      }
    }
  }, []);

  const campaignInfo = useMemo(
    () => resolveCampaignConfig(campaignCode),
    [campaignCode]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/register-farm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          ownerName,
          phone,
          email,
          password,
          preferredFarmCode,
          campaignCode,
          trialDays: campaignInfo.trialDays,
          campaignName: campaignInfo.campaignName,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || '登録に失敗しました。');
      }

      // ローカルストレージに当農園と初期スタッフ情報を保存して、1タップでポータルに入れるようにする
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('agri_owner_id', json.tenantId);
          window.localStorage.setItem('agri_cached_company_name', json.companyName);
          if (json.worker) {
            window.localStorage.setItem(
              'agri_current_worker',
              JSON.stringify(json.worker)
            );
          }
        } catch (storageErr) {}
      }

      setCompletedData({
        tenantId: json.tenantId,
        companyName: json.companyName,
        farmCode: json.farmCode,
        worker: json.worker,
        trialDays: json.trialDays || campaignInfo.trialDays,
        trialEndsAt: json.trialEndsAt || '',
        campaignName: json.campaignName || campaignInfo.campaignName,
      });
    } catch (err: any) {
      setErrorMsg(err.message || '登録中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = () => {
    if (!completedData?.farmCode) return;
    navigator.clipboard.writeText(completedData.farmCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
        {completedData ? (
          /* 🎉 登録完了＆農園コード発行画面 */
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-emerald-400" />
            </div>

            <div>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-black mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {completedData.campaignName}（{completedData.trialDays}日間）登録完了！
                </span>
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-white">
                {completedData.companyName} 様
                <br />
                専用環境が作成されました
              </h1>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                今日から <strong>{completedData.trialDays}日間</strong>
                {completedData.trialEndsAt
                  ? `（${completedData.trialEndsAt.replace(/-/g, '/')} まで）`
                  : ''}
                、すべての機能を完全無料でご利用いただけます。
              </p>
            </div>

            {/* 発行された農園コードとPIN番号 */}
            <div className="bg-slate-950 border-2 border-emerald-500/40 rounded-2xl p-5 space-y-4 text-left">
              <div>
                <p className="text-xs font-bold text-slate-400 mb-1">
                  ① あなたの農園専用【農園コード】
                </p>
                <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                  <span className="text-xl font-mono font-black text-emerald-400 tracking-wider">
                    {completedData.farmCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">コピー済</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>コピー</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  ※パート・従業員の方のスマホでこの農園コードを入力すると、貴社専用の打刻画面に繋がります。
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800">
                <p className="text-xs font-bold text-slate-400 mb-1">
                  ② 初期スタッフ登録（代表者様）
                </p>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs space-y-1">
                  <p className="text-slate-200 font-bold">
                    お名前：<span className="text-white">{completedData.worker?.name}</span>（管理者権限）
                  </p>
                  <p className="text-slate-200 font-bold">
                    初期暗証番号（PIN）：<span className="text-amber-400 font-mono text-sm">0000</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => router.push(`/portal?farm=${completedData.tenantId}`)}
                className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition-all"
              >
                <span>🌾 さっそく現場ポータルを開く</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => router.push(`/admin/cultivations?farm=${completedData.tenantId}`)}
                className="w-full py-3.5 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Building className="w-4 h-4 text-emerald-400" />
                <span>管理者画面（畑・作付け・スタッフ登録）を開く</span>
              </button>
            </div>
          </div>
        ) : (
          /* 📝 新規無料お試し登録フォーム */
          <div>
            <div className="text-center mb-6">
              <div
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black mb-3 ${
                  campaignInfo.isSpecial
                    ? 'bg-amber-500/20 border border-amber-400/50 text-amber-300 shadow-sm'
                    : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                }`}
              >
                {campaignInfo.isSpecial ? (
                  <Gift className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <Sprout className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="whitespace-nowrap">
                  {campaignInfo.isSpecial
                    ? `${campaignInfo.campaignName}適用中（${campaignInfo.monthsLabel}無料）`
                    : `最初の${campaignInfo.monthsLabel}完全無料`}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                新規農園アカウント登録
              </h1>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                クレジットカード登録は不要です。1分で貴社専用の【農園コード】と管理画面が発行されます。
              </p>
            </div>

            {errorMsg && (
              <div className="mb-5 p-3.5 bg-rose-500/15 border border-rose-500/40 rounded-2xl text-xs text-rose-300 font-bold text-center leading-relaxed">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  農園名 / 会社名（屋号） <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="例: 山田農園 / 株式会社〇〇ファーム"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  代表者・管理者のお名前 <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="例: 山田 太郎"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  お電話番号（任意・サポート連絡用）
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="例: 090-1234-5678"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  メールアドレス（管理者ログインID） <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="farm@example.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  パスワード（半角6文字以上） <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white font-bold focus:outline-none focus:border-emerald-500 tracking-widest"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    希望する農園コード（任意）
                  </label>
                  <input
                    type="text"
                    value={preferredFarmCode}
                    onChange={(e) => setPreferredFarmCode(e.target.value)}
                    placeholder="例: yamada（空欄なら自動）"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    🎁 キャンペーンコード（任意）
                  </label>
                  <input
                    type="text"
                    value={campaignCode}
                    onChange={(e) => setCampaignCode(e.target.value)}
                    placeholder="例: FREE2M / FREE3M"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <p className="text-emerald-400 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>安心の{campaignInfo.monthsLabel}無料トライアル</span>
                </p>
                <p>・無料期間終了後に勝手に自動課金されることはありません。</p>
                <p>・登録データは貴社専用領域に暗号化・完全分離して保管されます。</p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !companyName || !ownerName || !email || password.length < 6}
                className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-slate-950 font-black text-sm shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>専用環境を作成中...</span>
                  </>
                ) : (
                  <>
                    <span>🎁 {campaignInfo.monthsLabel}無料でお試しを開始する</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-800 text-center space-y-2.5">
              <div>
                <Link
                  href="/portal"
                  className="text-xs font-bold text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
                >
                  <span>← すでに農園コードをお持ちの方（初期接続画面へ）</span>
                </Link>
              </div>
              <div>
                <Link
                  href="/login"
                  className="text-[11px] font-bold text-slate-400 hover:text-white inline-flex items-center gap-1"
                >
                  <span>管理者ログイン画面はこちら →</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
