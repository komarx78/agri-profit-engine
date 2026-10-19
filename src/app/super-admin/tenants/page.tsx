"use client";

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Users,
  Building,
  CheckCircle2,
  Clock,
  RefreshCw,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Phone,
  MapPin,
  Calendar,
  Gift,
  AlertTriangle,
  Plus,
  X,
  Edit3,
  FileText,
} from 'lucide-react';
import {
  getSuperAdminTenantsAction,
  updateTenantPlanAndPeriodAction,
} from '@/app/actions/farm';

interface TrialComputedInfo {
  isTrial: boolean;
  trialDays: number;
  startDateStr: string;
  endDateStr: string;
  daysLeft: number;
  isExpiringSoon: boolean;
  isExpired: boolean;
  campaignName: string;
  contractCycle: 'monthly' | 'yearly' | 'unlimited';
  contractEndsAt: string;
  adminMemo: string;
  statusLabel: string;
}

function toJstDateString(d: Date): string {
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().substring(0, 10);
}

function addDaysToDateStr(baseDateStr: string, daysToAdd: number): string {
  const base = new Date(`${baseDateStr}T00:00:00+09:00`);
  if (isNaN(base.getTime())) return toJstDateString(new Date());
  base.setDate(base.getDate() + daysToAdd);
  return toJstDateString(base);
}

function diffDaysFromToday(targetDateStr: string): number {
  const todayStr = toJstDateString(new Date());
  const todayMs = new Date(`${todayStr}T00:00:00+09:00`).getTime();
  const targetMs = new Date(`${targetDateStr}T00:00:00+09:00`).getTime();
  if (isNaN(targetMs)) return 0;
  return Math.ceil((targetMs - todayMs) / (1000 * 60 * 60 * 24));
}

function computeTenantTrialInfo(tenant: any): TrialComputedInfo {
  const settings = tenant?.settings || {};
  const createdDateStr = tenant?.created_at
    ? toJstDateString(new Date(tenant.created_at))
    : toJstDateString(new Date());

  const trialDays = Number(settings.trial_days || 30);
  const endDateStr =
    settings.trial_ends_at && /^\d{4}-\d{2}-\d{2}$/.test(settings.trial_ends_at)
      ? settings.trial_ends_at
      : addDaysToDateStr(createdDateStr, trialDays);

  const campaignName =
    settings.campaign_name ||
    (trialDays >= 180
      ? '🌸 半年無料キャンペーン'
      : trialDays >= 90
      ? '🎉 3ヶ月無料キャンペーン'
      : trialDays >= 60
      ? '🎁 2ヶ月無料キャンペーン'
      : '標準1ヶ月無料');

  const contractCycle: 'monthly' | 'yearly' | 'unlimited' =
    settings.contract_cycle || 'monthly';
  const contractEndsAt = settings.contract_ends_at || '';
  const adminMemo = settings.admin_memo || '';

  if (tenant?.plan_type === 'premium') {
    const cycleLabel =
      contractCycle === 'yearly'
        ? '本契約（年額プラン）'
        : contractCycle === 'unlimited'
        ? '本契約（無期限・特別枠）'
        : '本契約（有料プラン）';
    return {
      isTrial: false,
      trialDays,
      startDateStr: createdDateStr,
      endDateStr,
      daysLeft: 999,
      isExpiringSoon: false,
      isExpired: false,
      campaignName,
      contractCycle,
      contractEndsAt,
      adminMemo,
      statusLabel: cycleLabel,
    };
  }

  const daysLeft = diffDaysFromToday(endDateStr);
  const isExpired = daysLeft <= 0;
  const isExpiringSoon = daysLeft > 0 && daysLeft <= 7;

  return {
    isTrial: true,
    trialDays,
    startDateStr: createdDateStr,
    endDateStr,
    daysLeft: Math.max(0, daysLeft),
    isExpiringSoon,
    isExpired,
    campaignName,
    contractCycle,
    contractEndsAt,
    adminMemo,
    statusLabel:
      daysLeft > 0
        ? `無料お試し中（残り ${daysLeft} 日）`
        : `無料お試し期間終了（${Math.abs(daysLeft)}日経過）`,
  };
}

const CAMPAIGN_LINKS = [
  {
    key: '1m',
    badge: '標準 1ヶ月無料 (30日)',
    code: '標準',
    query: '',
    color: 'border-slate-700 bg-slate-900/90 text-slate-200',
  },
  {
    key: '2m',
    badge: '🎁 2ヶ月無料 (60日)',
    code: 'FREE2M',
    query: '?campaign=2m',
    color: 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300',
  },
  {
    key: '3m',
    badge: '🎉 3ヶ月無料 (90日・1作体験)',
    code: 'FREE3M',
    query: '?campaign=3m',
    color: 'border-amber-500/40 bg-amber-950/40 text-amber-300',
  },
  {
    key: '6m',
    badge: '🌸 半年無料 (180日・特別枠)',
    code: 'FREE6M',
    query: '?campaign=6m',
    color: 'border-purple-500/40 bg-purple-950/40 text-purple-300',
  },
];

export default function SuperAdminTenantsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [workerCounts, setWorkerCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedCampaignKey, setCopiedCampaignKey] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // 期間・キャンペーン編集モーダル用ステート
  const [editingModal, setEditingModal] = useState<{
    tenant: any;
    planType: 'trial' | 'premium';
    startDateStr: string;
    trialDays: number;
    trialEndsAt: string;
    campaignName: string;
    contractCycle: 'monthly' | 'yearly' | 'unlimited';
    contractEndsAt: string;
    adminMemo: string;
  } | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const loadTenants = async () => {
    setIsLoading(true);
    try {
      const res = await getSuperAdminTenantsAction();
      if (res.success) {
        setTenants(res.tenants || []);
        setWorkerCounts(res.workerCounts || {});
      }
    } catch (e) {
      console.error('Failed to load tenants:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const openPeriodModal = (tenant: any) => {
    const info = computeTenantTrialInfo(tenant);
    setEditingModal({
      tenant,
      planType: tenant.plan_type === 'premium' ? 'premium' : 'trial',
      startDateStr: info.startDateStr,
      trialDays: info.trialDays,
      trialEndsAt: info.endDateStr,
      campaignName: info.campaignName,
      contractCycle: info.contractCycle,
      contractEndsAt: info.contractEndsAt,
      adminMemo: info.adminMemo,
    });
  };

  // ワンクリックで登録日基準の無料期間（30日 / 60日 / 90日 / 180日）をセット
  const applyPresetMonthsInModal = (days: number, label: string) => {
    if (!editingModal) return;
    const newEnd = addDaysToDateStr(editingModal.startDateStr, days);
    setEditingModal({
      ...editingModal,
      planType: 'trial',
      trialDays: days,
      trialEndsAt: newEnd,
      campaignName: label,
    });
  };

  // 現在の終了日から＋N日延長
  const extendDaysInModal = (addDays: number) => {
    if (!editingModal) return;
    const baseEnd =
      editingModal.trialEndsAt || addDaysToDateStr(editingModal.startDateStr, 30);
    const todayStr = toJstDateString(new Date());
    // すでに期限切れの場合は今日から＋N日、まだ残っている場合は終了日から＋N日
    const startFrom = baseEnd < todayStr ? todayStr : baseEnd;
    const nextEnd = addDaysToDateStr(startFrom, addDays);

    const startMs = new Date(`${editingModal.startDateStr}T00:00:00+09:00`).getTime();
    const endMs = new Date(`${nextEnd}T00:00:00+09:00`).getTime();
    const totalDays = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));

    setEditingModal({
      ...editingModal,
      planType: 'trial',
      trialDays: totalDays,
      trialEndsAt: nextEnd,
      campaignName:
        editingModal.campaignName === '標準1ヶ月無料'
          ? `🎁 期間延長（計${totalDays}日間）`
          : editingModal.campaignName,
    });
  };

  // モーダル保存
  const handleSaveModal = async () => {
    if (!editingModal) return;
    setUpdatingId(editingModal.tenant.id);
    try {
      const res = await updateTenantPlanAndPeriodAction({
        companyId: editingModal.tenant.id,
        planType: editingModal.planType,
        trialDays: editingModal.trialDays,
        trialEndsAt: editingModal.trialEndsAt,
        campaignName: editingModal.campaignName,
        contractCycle: editingModal.contractCycle,
        contractEndsAt: editingModal.contractEndsAt,
        adminMemo: editingModal.adminMemo,
      });

      if (res.success && res.tenant) {
        setTenants((prev) =>
          prev.map((t) => (t.id === editingModal.tenant.id ? res.tenant : t))
        );
        // ローカルキャッシュがある場合はクリアして農園画面にも即反映
        if (typeof window !== 'undefined' && editingModal.tenant.user_id) {
          try {
            window.localStorage.removeItem(
              `agri_company_obj_${editingModal.tenant.user_id}`
            );
          } catch (e) {}
        }
        showToast(
          `「${editingModal.tenant.company_name}」の契約・お試し期間を更新しました！`
        );
        setEditingModal(null);
      } else {
        alert(res.error || '保存に失敗しました');
      }
    } finally {
      setUpdatingId(null);
    }
  };

  // 一覧から1クリックで「＋1ヶ月（30日）無料延長」または「本契約切替」
  const handleQuickExtend30Days = async (tenant: any) => {
    const info = computeTenantTrialInfo(tenant);
    const todayStr = toJstDateString(new Date());
    const baseEnd = info.endDateStr < todayStr ? todayStr : info.endDateStr;
    const nextEnd = addDaysToDateStr(baseEnd, 30);
    const startMs = new Date(`${info.startDateStr}T00:00:00+09:00`).getTime();
    const endMs = new Date(`${nextEnd}T00:00:00+09:00`).getTime();
    const totalDays = Math.max(30, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));

    const nextCampaign =
      totalDays >= 90
        ? '🎉 3ヶ月無料キャンペーン'
        : totalDays >= 60
        ? '🎁 2ヶ月無料キャンペーン'
        : '🎁 無料期間延長';

    setUpdatingId(tenant.id);
    try {
      const res = await updateTenantPlanAndPeriodAction({
        companyId: tenant.id,
        planType: 'trial',
        trialDays: totalDays,
        trialEndsAt: nextEnd,
        campaignName: nextCampaign,
      });
      if (res.success && res.tenant) {
        setTenants((prev) =>
          prev.map((t) => (t.id === tenant.id ? res.tenant : t))
        );
        if (typeof window !== 'undefined' && tenant.user_id) {
          try {
            window.localStorage.removeItem(`agri_company_obj_${tenant.user_id}`);
          } catch (e) {}
        }
        showToast(
          `「${tenant.company_name}」の無料期間を＋1ヶ月延長（${nextEnd.replace(/-/g, '/')}まで）しました！`
        );
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const handleQuickSwitchPlan = async (
    tenant: any,
    newPlan: 'trial' | 'premium',
    presetTrialDays?: number
  ) => {
    const info = computeTenantTrialInfo(tenant);
    const days = presetTrialDays || info.trialDays || 30;
    const endDate = presetTrialDays
      ? addDaysToDateStr(info.startDateStr, presetTrialDays)
      : info.endDateStr;
    const campaign =
      presetTrialDays === 90
        ? '🎉 3ヶ月無料キャンペーン'
        : presetTrialDays === 60
        ? '🎁 2ヶ月無料キャンペーン'
        : info.campaignName;

    setUpdatingId(tenant.id);
    try {
      const res = await updateTenantPlanAndPeriodAction({
        companyId: tenant.id,
        planType: newPlan,
        trialDays: days,
        trialEndsAt: endDate,
        campaignName: campaign,
      });
      if (res.success && res.tenant) {
        setTenants((prev) =>
          prev.map((t) => (t.id === tenant.id ? res.tenant : t))
        );
        if (typeof window !== 'undefined' && tenant.user_id) {
          try {
            window.localStorage.removeItem(`agri_company_obj_${tenant.user_id}`);
          } catch (e) {}
        }
        showToast(
          newPlan === 'premium'
            ? `「${tenant.company_name}」を本契約（有料プラン）に切り替えました！`
            : `「${tenant.company_name}」を無料お試し中に切り替えました`
        );
      }
    } finally {
      setUpdatingId(null);
    }
  };

  // 集計数値
  const stats = useMemo(() => {
    let premiumCount = 0;
    let trialCount = 0;
    let campaignTrialCount = 0;
    let attentionCount = 0;

    tenants.forEach((t) => {
      const info = computeTenantTrialInfo(t);
      if (!info.isTrial) {
        premiumCount += 1;
      } else {
        trialCount += 1;
        if (info.trialDays > 30) campaignTrialCount += 1;
        if (info.isExpired || info.isExpiringSoon) attentionCount += 1;
      }
    });

    return {
      total: tenants.length,
      premiumCount,
      trialCount,
      campaignTrialCount,
      attentionCount,
    };
  }, [tenants]);

  return (
    <div className="space-y-6 max-w-6xl pb-16">
      {/* トースト通知 */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-emerald-600 text-white font-bold text-sm shadow-2xl border border-emerald-400/30">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
            <Users className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">
              契約・お試し農園（テナント）＆期間管理
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">
              標準1ヶ月無料から、2ヶ月・3ヶ月無料キャンペーン、個別の日数延長・終了日指定まで一元管理できます。
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/register"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            <span>新規登録画面（/register）を開く</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          <button
            type="button"
            onClick={loadTenants}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-bold text-xs cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>更新</span>
          </button>
        </div>
      </div>

      {/* 🎁 キャンペーン別 新規登録URLワンクリック発行バー */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-black text-white">
              キャンペーン期間つき新規登録URL・紹介コード（LINE・チラシ配布用）
            </h2>
          </div>
          <span className="text-[11px] text-slate-400">
            ※下のURLを農家さんに送って登録してもらうだけで、自動的に2ヶ月・3ヶ月無料が適用されます
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {CAMPAIGN_LINKS.map((item) => {
            const isCopied = copiedCampaignKey === item.key;
            return (
              <div
                key={item.key}
                className={`rounded-xl border p-3 flex flex-col justify-between gap-2.5 ${item.color}`}
              >
                <div>
                  <div className="text-xs font-black">{item.badge}</div>
                  <div className="text-[11px] opacity-80 mt-0.5 font-mono">
                    紹介コード: <strong>{item.code}</strong>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const origin =
                        typeof window !== 'undefined' ? window.location.origin : '';
                      const fullUrl = `${origin}/register${item.query}`;
                      navigator.clipboard.writeText(fullUrl);
                      setCopiedCampaignKey(item.key);
                      showToast(`「${item.badge}」の専用登録URLをコピーしました！`);
                      setTimeout(() => setCopiedCampaignKey(null), 2500);
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-950 text-white text-[11px] font-bold border border-white/10 cursor-pointer"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">URLコピー済</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>登録URLをコピー</span>
                      </>
                    )}
                  </button>
                  <Link
                    href={`/register${item.query}`}
                    target="_blank"
                    className="p-1.5 rounded-lg bg-slate-950/60 hover:bg-slate-950 text-slate-300 hover:text-white border border-white/10"
                    title="このキャンペーン設定で登録画面を開く"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4つのサマリーカード */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5">
          <p className="text-xs font-bold text-slate-400">全登録農園数</p>
          <p className="text-3xl font-black text-white mt-1">
            {stats.total} <span className="text-sm font-bold text-slate-500">農園</span>
          </p>
        </div>

        <div className="bg-slate-950 border border-emerald-500/30 rounded-2xl p-5">
          <p className="text-xs font-bold text-emerald-400">本契約（有料プラン）</p>
          <p className="text-3xl font-black text-emerald-300 mt-1">
            {stats.premiumCount}{' '}
            <span className="text-sm font-bold text-slate-500">農園</span>
          </p>
        </div>

        <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-5">
          <p className="text-xs font-bold text-amber-400">無料お試し中（1〜6ヶ月）</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-3xl font-black text-amber-300">
              {stats.trialCount}{' '}
              <span className="text-sm font-bold text-slate-500">農園</span>
            </p>
            {stats.campaignTrialCount > 0 && (
              <span className="text-[11px] font-bold text-emerald-400">
                （特典適用 {stats.campaignTrialCount}件）
              </span>
            )}
          </div>
        </div>

        <div className="bg-slate-950 border border-rose-500/30 rounded-2xl p-5">
          <p className="text-xs font-bold text-rose-400">
            ⚠️ お試し期限間近・終了
          </p>
          <p className="text-3xl font-black text-rose-300 mt-1">
            {stats.attentionCount}{' '}
            <span className="text-sm font-bold text-slate-500">農園</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            残り7日以内または期間終了
          </p>
        </div>
      </div>

      {/* テナント一覧テーブル */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 text-[11px] font-black text-slate-400 uppercase">
                <th className="py-3.5 px-4">農園名 / 会社名</th>
                <th className="py-3.5 px-4">農園コード</th>
                <th className="py-3.5 px-4">契約ステータス・無料期間・キャンペーン</th>
                <th className="py-3.5 px-4">期間変更・クイック操作</th>
                <th className="py-3.5 px-4">スタッフ数</th>
                <th className="py-3.5 px-4 text-right">画面確認</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-sm">
              {tenants.map((t) => {
                const info = computeTenantTrialInfo(t);
                const code = (t.farm_code || '').toUpperCase() || '未設定';
                const count = workerCounts[t.user_id] || 0;
                const isUpdating = updatingId === t.id;

                return (
                  <tr key={t.id} className="hover:bg-slate-900/40 transition-colors">
                    {/* 農園名・連絡先・本部メモ */}
                    <td className="py-4 px-4">
                      <div className="font-black text-white flex items-center gap-2">
                        <Building className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{t.company_name || '名称未設定'}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                        {t.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {t.phone}
                          </span>
                        )}
                        {t.address && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {t.address}
                          </span>
                        )}
                      </div>
                      {info.adminMemo && (
                        <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-[11px] text-amber-300 font-bold">
                          <FileText className="w-3 h-3 shrink-0" />
                          <span>{info.adminMemo}</span>
                        </div>
                      )}
                    </td>

                    {/* 農園コード */}
                    <td className="py-4 px-4">
                      <div className="inline-flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1">
                        <span className="font-mono font-black text-emerald-400 text-xs">
                          {code}
                        </span>
                        {t.farm_code && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(code);
                              setCopiedId(t.id);
                              setTimeout(() => setCopiedId(null), 2000);
                            }}
                            className="text-slate-400 hover:text-white cursor-pointer"
                            title="農園コードをコピー"
                          >
                            {copiedId === t.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* 契約ステータス・無料期間・キャンペーン */}
                    <td className="py-4 px-4">
                      {info.isTrial ? (
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ${
                                info.isExpired
                                  ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                  : info.isExpiringSoon
                                  ? 'bg-amber-500/20 text-amber-200 border border-amber-400/50 animate-pulse'
                                  : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              {info.isExpired ? (
                                <AlertTriangle className="w-3.5 h-3.5" />
                              ) : (
                                <Clock className="w-3.5 h-3.5" />
                              )}
                              <span>{info.statusLabel}</span>
                            </span>

                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                              <span>{info.campaignName}</span>
                              <span>（{info.trialDays}日間）</span>
                            </span>
                          </div>

                          <div className="text-xs text-slate-300 font-bold flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            <span>
                              開始 {info.startDateStr.replace(/-/g, '/')} 〜{' '}
                              <strong className="text-amber-300">
                                {info.endDateStr.replace(/-/g, '/')} まで無料
                              </strong>
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{info.statusLabel}</span>
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-2">
                            <span>登録日: {info.startDateStr.replace(/-/g, '/')}</span>
                            {info.contractEndsAt && (
                              <span className="text-emerald-300 font-bold">
                                ／ 次回更新: {info.contractEndsAt.replace(/-/g, '/')}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </td>

                    {/* 期間変更・クイック操作 */}
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => openPeriodModal(t)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-200 border border-indigo-500/40 text-xs font-bold cursor-pointer transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>期間・キャンペーン設定</span>
                        </button>

                        {info.isTrial ? (
                          <>
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleQuickExtend30Days(t)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-bold cursor-pointer"
                              title="現在の終了日からさらに1ヶ月（30日）無料期間を延長します"
                            >
                              <Plus className="w-3 h-3" />
                              <span>1ヶ月延長</span>
                            </button>
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleQuickSwitchPlan(t, 'premium')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold cursor-pointer"
                            >
                              <span>本契約へ</span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => openPeriodModal(t)}
                            className="text-[11px] font-bold text-slate-400 hover:text-amber-300 underline cursor-pointer ml-1"
                          >
                            お試し（1〜3ヶ月無料）へ切替
                          </button>
                        )}
                      </div>
                    </td>

                    {/* スタッフ数 */}
                    <td className="py-4 px-4 font-bold text-slate-200 whitespace-nowrap">
                      {count} 名
                    </td>

                    {/* 画面確認 */}
                    <td className="py-4 px-4 text-right space-x-2 whitespace-nowrap">
                      <Link
                        href={`/portal?farm=${t.user_id}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-emerald-300 border border-slate-700"
                      >
                        <span>現場ポータル</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                      <Link
                        href={`/admin/cultivations?farm=${t.user_id}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white border border-slate-700"
                      >
                        <span>管理画面</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================
          📅 期間・キャンペーン・契約設定モーダル
      ========================================================= */}
      {editingModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-[11px] font-bold text-emerald-400">
                  契約プラン・無料お試し期間の設定
                </span>
                <h3 className="text-lg font-black text-white mt-0.5">
                  {editingModal.tenant.company_name || '農園'} 様
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingModal(null)}
                className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 1. 契約ステータスの選択 */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">
                ① 契約ステータス
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    setEditingModal({ ...editingModal, planType: 'trial' })
                  }
                  className={`py-3 px-4 rounded-2xl border font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    editingModal.planType === 'trial'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>🎁 無料お試し（トライアル）</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setEditingModal({ ...editingModal, planType: 'premium' })
                  }
                  className={`py-3 px-4 rounded-2xl border font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    editingModal.planType === 'premium'
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>✅ 本契約（有料プラン）</span>
                </button>
              </div>
            </div>

            {/* 2. 無料お試し選択時の期間設定 */}
            {editingModal.planType === 'trial' ? (
              <div className="space-y-4 bg-slate-950/90 border border-slate-800 rounded-2xl p-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2">
                    ② キャンペーン・無料期間プリセット（登録日 {editingModal.startDateStr.replace(/-/g, '/')} から自動計算）
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { days: 30, label: '標準1ヶ月無料' },
                      { days: 60, label: '🎁 2ヶ月無料キャンペーン' },
                      { days: 90, label: '🎉 3ヶ月無料キャンペーン' },
                      { days: 180, label: '🌸 半年無料キャンペーン' },
                    ].map((preset) => (
                      <button
                        key={preset.days}
                        type="button"
                        onClick={() =>
                          applyPresetMonthsInModal(preset.days, preset.label)
                        }
                        className={`py-2.5 px-3 rounded-xl border text-xs font-bold text-left cursor-pointer transition-all ${
                          editingModal.trialDays === preset.days
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div>{preset.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          計 {preset.days} 日間（
                          {addDaysToDateStr(
                            editingModal.startDateStr,
                            preset.days
                          ).replace(/-/g, '/')}{' '}
                          まで）
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 現在の終了日からさらに延長 */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    または現在の終了日からワンクリック延長
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => extendDaysInModal(15)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold cursor-pointer"
                    >
                      ＋15日延長
                    </button>
                    <button
                      type="button"
                      onClick={() => extendDaysInModal(30)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold cursor-pointer"
                    >
                      ＋1ヶ月（30日）延長
                    </button>
                    <button
                      type="button"
                      onClick={() => extendDaysInModal(60)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold cursor-pointer"
                    >
                      ＋2ヶ月（60日）延長
                    </button>
                  </div>
                </div>

                {/* カレンダーで終了日を直接指定 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      無料お試し終了日（直接指定可）
                    </label>
                    <input
                      type="date"
                      value={editingModal.trialEndsAt}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        const sMs = new Date(
                          `${editingModal.startDateStr}T00:00:00+09:00`
                        ).getTime();
                        const eMs = new Date(`${val}T00:00:00+09:00`).getTime();
                        const calcDays = Math.max(
                          1,
                          Math.round((eMs - sMs) / (1000 * 60 * 60 * 24))
                        );
                        setEditingModal({
                          ...editingModal,
                          trialEndsAt: val,
                          trialDays: calcDays,
                        });
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-black text-sm"
                    />
                    <p className="text-[11px] text-amber-300 font-bold mt-1">
                      今日からの残り日数:{' '}
                      {Math.max(0, diffDaysFromToday(editingModal.trialEndsAt))} 日
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      キャンペーン表示名（農園画面にも表示）
                    </label>
                    <input
                      type="text"
                      value={editingModal.campaignName}
                      onChange={(e) =>
                        setEditingModal({
                          ...editingModal,
                          campaignName: e.target.value,
                        })
                      }
                      placeholder="例: 🎉 3ヶ月無料キャンペーン"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-xs"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* 本契約（有料プラン）選択時の期間設定 */
              <div className="space-y-4 bg-slate-950/90 border border-slate-800 rounded-2xl p-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2">
                    ② 本契約プラン区分
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'monthly', label: '月額プラン' },
                      { id: 'yearly', label: '年額プラン' },
                      { id: 'unlimited', label: '無期限・特別枠' },
                    ].map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() =>
                          setEditingModal({
                            ...editingModal,
                            contractCycle: c.id as any,
                          })
                        }
                        className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                          editingModal.contractCycle === c.id
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    次回契約更新日・満了日（任意）
                  </label>
                  <input
                    type="date"
                    value={editingModal.contractEndsAt}
                    onChange={(e) =>
                      setEditingModal({
                        ...editingModal,
                        contractEndsAt: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-sm"
                  />
                </div>
              </div>
            )}

            {/* 3. 本部管理メモ */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                ③ 本部管理メモ（紹介元・キャンペーン経緯・フォロー記録など）
              </label>
              <input
                type="text"
                value={editingModal.adminMemo}
                onChange={(e) =>
                  setEditingModal({ ...editingModal, adminMemo: e.target.value })
                }
                placeholder="例: JA紹介キャンペーンで3ヶ月無料適用中、12月中旬に本契約フォロー予定"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingModal(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={updatingId === editingModal.tenant.id}
                onClick={handleSaveModal}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg cursor-pointer"
              >
                {updatingId === editingModal.tenant.id
                  ? '保存中...'
                  : 'この設定を保存する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
