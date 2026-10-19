"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
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
} from 'lucide-react';

export default function SuperAdminTenantsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [workerCounts, setWorkerCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadTenants = async () => {
    setIsLoading(true);
    try {
      const [{ data: companies }, { data: workers }] = await Promise.all([
        supabase
          .from('company_settings')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('workers').select('id, user_id'),
      ]);

      if (companies) {
        setTenants(companies);
      }
      if (workers) {
        const counts: Record<string, number> = {};
        workers.forEach((w: any) => {
          if (w.user_id) {
            counts[w.user_id] = (counts[w.user_id] || 0) + 1;
          }
        });
        setWorkerCounts(counts);
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

  const handleTogglePlan = async (tenant: any, newPlan: 'trial' | 'premium') => {
    setUpdatingId(tenant.id);
    try {
      const { error } = await supabase
        .from('company_settings')
        .update({ plan_type: newPlan, updated_at: new Date().toISOString() })
        .eq('id', tenant.id);

      if (!error) {
        setTenants((prev) =>
          prev.map((t) => (t.id === tenant.id ? { ...t, plan_type: newPlan } : t))
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingId(null);
    }
  };

  const getTrialInfo = (createdAt: string, planType: string) => {
    if (planType === 'premium') {
      return { isTrial: false, daysLeft: 999, label: '本契約（有料プラン）' };
    }
    const start = new Date(createdAt).getTime();
    const now = Date.now();
    const elapsedDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
    const daysLeft = Math.max(0, 30 - elapsedDays);
    return {
      isTrial: true,
      daysLeft,
      label: daysLeft > 0 ? `無料お試し中（残り ${daysLeft} 日）` : '無料お試し期間終了',
    };
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
            <Users className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">契約・お試し農園（テナント）一覧</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              1ヶ月無料お試し登録された農園および本契約農園のステータス・農園コードを一元管理します。
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

      {/* サマリーカード */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5">
          <p className="text-xs font-bold text-slate-400">全登録農園数</p>
          <p className="text-3xl font-black text-white mt-1">{tenants.length} <span className="text-sm font-bold text-slate-500">農園</span></p>
        </div>
        <div className="bg-slate-950 border border-emerald-500/30 rounded-2xl p-5">
          <p className="text-xs font-bold text-emerald-400">本契約（有料プラン）</p>
          <p className="text-3xl font-black text-emerald-300 mt-1">
            {tenants.filter((t) => t.plan_type === 'premium').length} <span className="text-sm font-bold text-slate-500">農園</span>
          </p>
        </div>
        <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-5">
          <p className="text-xs font-bold text-amber-400">1ヶ月無料お試し中</p>
          <p className="text-3xl font-black text-amber-300 mt-1">
            {tenants.filter((t) => t.plan_type !== 'premium').length} <span className="text-sm font-bold text-slate-500">農園</span>
          </p>
        </div>
      </div>

      {/* テナント一覧 */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 text-[11px] font-black text-slate-400 uppercase">
                <th className="py-3.5 px-4">農園名 / 会社名</th>
                <th className="py-3.5 px-4">農園コード</th>
                <th className="py-3.5 px-4">契約ステータス・お試し残日数</th>
                <th className="py-3.5 px-4">登録スタッフ数</th>
                <th className="py-3.5 px-4">登録日</th>
                <th className="py-3.5 px-4 text-right">操作・画面確認</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-sm">
              {tenants.map((t) => {
                const trial = getTrialInfo(t.created_at, t.plan_type);
                const code = (t.farm_code || '').toUpperCase() || '未設定';
                const count = workerCounts[t.user_id] || 0;

                return (
                  <tr key={t.id} className="hover:bg-slate-900/40 transition-colors">
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
                    </td>

                    <td className="py-4 px-4">
                      <div className="inline-flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1">
                        <span className="font-mono font-black text-emerald-400 text-xs">{code}</span>
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

                    <td className="py-4 px-4">
                      {trial.isTrial ? (
                        <div className="space-y-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ${
                              trial.daysLeft > 0
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>{trial.label}</span>
                          </span>
                          <div>
                            <button
                              type="button"
                              disabled={updatingId === t.id}
                              onClick={() => handleTogglePlan(t, 'premium')}
                              className="text-[11px] font-bold text-emerald-400 hover:underline cursor-pointer"
                            >
                              → 本契約（有料プラン）へ切替
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{trial.label}</span>
                          </span>
                          <div>
                            <button
                              type="button"
                              disabled={updatingId === t.id}
                              onClick={() => handleTogglePlan(t, 'trial')}
                              className="text-[11px] font-bold text-slate-500 hover:text-slate-300 hover:underline cursor-pointer"
                            >
                              お試しに戻す
                            </button>
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="py-4 px-4 font-bold text-slate-200">{count} 名</td>

                    <td className="py-4 px-4 text-xs text-slate-400">
                      {t.created_at ? new Date(t.created_at).toLocaleDateString('ja-JP') : '-'}
                    </td>

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
    </div>
  );
}
