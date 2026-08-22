"use client";

import React from 'react';
import { Users, Construction, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function SuperAdminTenantsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-blue-500/10 rounded-xl">
          <Users className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">テナント管理</h1>
          <p className="text-slate-400 text-sm mt-1">契約中の農家アカウントとシステム利用状況を管理します。</p>
        </div>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center min-h-[400px]">
        <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center border border-slate-800 mb-6">
          <Construction className="w-10 h-10 text-slate-500" />
        </div>
        
        <h2 className="text-xl font-black text-white mb-3">
          テナント管理機能は現在構築中です
        </h2>
        
        <p className="text-slate-400 max-w-lg mb-8 leading-relaxed text-sm">
          この画面では今後、Supabaseの認証データベース（Auth）および Stripeの決済システムと連携し、各農家さんの契約状況、月額・年額の支払いステータス、アカウントの利用停止・再開などの操作を一元管理できるように拡張されます。
        </p>

        <Link 
          href="/super-admin"
          className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl border border-slate-700 transition-colors"
        >
          ダッシュボードに戻る <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
