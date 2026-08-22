"use client";

import React, { useEffect, useState } from 'react';
import { Users, Database, Activity, CreditCard, ArrowUpRight, ShieldAlert, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';

export default function SuperAdminDashboard() {
  const [dbStats, setDbStats] = useState({
    basicCount: 0,
    usageCount: 0,
    loading: true
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function fetchStats() {
      try {
        const { count: basicCount } = await supabase.from('m_pesticides').select('*', { count: 'exact', head: true });
        const { count: usageCount } = await supabase.from('m_pesticide_usages').select('*', { count: 'exact', head: true });
        
        setDbStats({
          basicCount: basicCount || 0,
          usageCount: usageCount || 0,
          loading: false
        });
      } catch (error) {
        console.error('Failed to fetch stats', error);
        setDbStats(prev => ({ ...prev, loading: false }));
      }
    }
    fetchStats();
  }, [supabase]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-indigo-500" />
            司令部ダッシュボード
          </h1>
          <p className="text-slate-400 text-sm mt-1">システム全体の稼働状況とビジネス指標を俯瞰します。</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 農薬マスター (実データ連携) */}
        <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex flex-col relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-indigo-400/10 blur-2xl group-hover:scale-150 transition-transform duration-500" />
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-3 rounded-xl bg-indigo-400/10 text-indigo-400">
              <Database className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400">
              Live
            </span>
          </div>
          <div className="relative z-10 mt-auto">
            <h3 className="text-slate-400 text-sm font-bold mb-1">基本部（農薬名）登録数</h3>
            <p className="text-3xl font-black text-white">
              {dbStats.loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-500" /> : dbStats.basicCount.toLocaleString()}
            </p>
          </div>
        </div>

        {/* 適用部マスター (実データ連携) */}
        <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex flex-col relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-indigo-400/10 blur-2xl group-hover:scale-150 transition-transform duration-500" />
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-3 rounded-xl bg-indigo-400/10 text-indigo-400">
              <Database className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400">
              Live
            </span>
          </div>
          <div className="relative z-10 mt-auto">
            <h3 className="text-slate-400 text-sm font-bold mb-1">適用部（使用法）登録数</h3>
            <p className="text-3xl font-black text-white">
              {dbStats.loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-500" /> : dbStats.usageCount.toLocaleString()}
            </p>
          </div>
        </div>

        {/* テナント管理 (今後実装予定) */}
        <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex flex-col relative overflow-hidden group opacity-75">
          <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-blue-400/10 blur-2xl group-hover:scale-150 transition-transform duration-500" />
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-3 rounded-xl bg-blue-400/10 text-blue-400">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-slate-800 text-slate-400">
              構築予定
            </span>
          </div>
          <div className="relative z-10 mt-auto">
            <h3 className="text-slate-400 text-sm font-bold mb-1">アクティブテナント</h3>
            <p className="text-lg font-black text-slate-500">認証DBと連携予定</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="bg-slate-950 rounded-2xl border border-slate-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white">クイックアクション</h2>
          </div>
          <div className="space-y-3">
            <Link href="/super-admin/pesticides" className="flex items-center justify-between p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 transition-colors group">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-200 group-hover:text-white transition-colors">農薬マスターの管理</h3>
                  <p className="text-xs text-slate-500 mt-1">FAMICからの最新データをシステム全体に適用します。</p>
                </div>
              </div>
              <ArrowUpRight className="w-5 h-5 text-slate-600 group-hover:text-indigo-400 transition-colors" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
