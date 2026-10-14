"use client";

import React, { useEffect, useState } from 'react';
import { FileText, FileSpreadsheet, Calendar, CheckCircle2, AlertCircle, Play } from 'lucide-react';
import Link from 'next/link';
import { getB2BInvoices, generateInvoicesForMonth } from '@/app/actions/b2b';
import { getCurrentTenantId } from '@/lib/tenant';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [targetMonth, setTargetMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    loadInvoices();
  }, []);

  async function loadInvoices() {
    setLoading(true);
    const tenantId = await getCurrentTenantId();
    const res = await getB2BInvoices(tenantId);
    if (res.success) {
      setInvoices(res.invoices || []);
    }
    setLoading(false);
  }

  const handleGenerate = async () => {
    if (!window.confirm(`${targetMonth}月分の納品済データから請求書を一括生成しますか？`)) return;
    setIsGenerating(true);
    
    const tenantId = await getCurrentTenantId();
    const res = await generateInvoicesForMonth(targetMonth, tenantId);
    
    setIsGenerating(false);
    
    if (res.success) {
      alert(`${res.count}件の請求書を生成しました。`);
      loadInvoices();
    } else {
      alert("エラー: " + res.error);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <FileText className="w-6 h-6 text-amber-500" />
            <span>請求書の一括作成・入金確認</span>
          </h1>
          <p className="text-sm font-bold text-slate-500 mt-1">
            「納品済」にした注文データを月ごとに自動集計して請求書を作成し、入金状況（未入金・入金済）を管理します。
          </p>
        </div>
      </div>

      {/* 自動生成パネル */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-2xl border border-amber-200 shadow-sm">
        <h2 className="text-lg font-black text-amber-900 mb-4 flex items-center gap-2">
          <Play className="w-5 h-5 text-amber-600" /> 月まとめ請求書の自動作成
        </h2>
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div>
            <label className="block text-sm font-bold text-amber-800 mb-2">集計する月</label>
            <input 
              type="month"
              value={targetMonth}
              onChange={e => setTargetMonth(e.target.value)}
              className="border border-amber-300 rounded-xl px-4 py-3 font-bold text-amber-900 focus:outline-none focus:border-amber-500 bg-white"
            />
          </div>
          <button 
            onClick={handleGenerate}
            disabled={isGenerating}
            className="bg-amber-500 hover:bg-amber-600 text-white font-black py-3 px-6 rounded-xl transition-colors shadow-lg shadow-amber-500/30 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isGenerating ? '作成中...' : '納品済データから請求書を作成する'}
          </button>
        </div>
        <p className="text-xs font-bold text-amber-700/80 mt-3">※ 選んだ月の「✓ 納品済」の注文をお店ごとに自動で合算し、得意先設定の締め日・支払日に合わせて支払期限を自動計算します。</p>
      </div>

      {/* 請求書一覧 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <h2 className="font-black text-slate-700">作成済みの請求書一覧</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-slate-200 text-sm">
                <th className="p-4 font-black text-slate-500">対象月・得意先名</th>
                <th className="p-4 font-black text-slate-500 text-right">請求金額 (税込)</th>
                <th className="p-4 font-bold text-slate-500 w-1/4">お支払期限</th>
                <th className="p-4 font-bold text-slate-500 w-32 text-center">入金状態</th>
                <th className="p-4 font-bold text-slate-500 w-28 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500 font-bold">読み込み中...</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500 font-bold">まだ作成された請求書がありません。上のボタンから作成できます。</td></tr>
              ) : invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="text-xs font-bold text-slate-400 mb-1">{inv.target_month}月分</div>
                    <div className="font-black text-slate-800 text-lg">{inv.customer?.name}</div>
                  </td>
                  <td className="p-4 text-right font-black text-slate-800 text-lg">
                    ¥{Number(inv.total_amount).toLocaleString()}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5 text-slate-600 font-bold text-sm">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      {inv.due_date}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black ${
                      inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                      {inv.status === 'paid' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                      {inv.status === 'paid' ? '入金済' : '未入金'}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <Link href={`/sales-management/invoices/${inv.id}`} className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 rounded-lg text-xs font-bold transition-colors">
                      <FileText className="w-3.5 h-3.5" />
                      請求書を印刷
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
