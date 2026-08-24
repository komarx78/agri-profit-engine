"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '@/lib/tenant';
import { HelpTooltip } from '@/components/HelpTooltip';
import { Receipt, Save, Loader2, Calendar, TrendingDown, RefreshCw, AlertCircle, Edit2 } from 'lucide-react';

type ExpenseType = 'fuel' | 'machinery' | 'other';

interface ExpenseFormData {
  fuel: string;
  machinery: string;
  other: string;
}

export default function MonthlyExpensesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [formData, setFormData] = useState<ExpenseFormData>({ fuel: '', machinery: '', other: '' });
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);

  useEffect(() => {
    fetchExpenses();
  }, [selectedMonth]);

  const fetchExpenses = async () => {
    setIsLoading(true);
    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) {
        setIsLoading(false);
        return;
      }

      const { data: monthData, error: monthError } = await supabase
        .from('monthly_expenses')
        .select('*')
        .eq('user_id', tenantId)
        .eq('month', selectedMonth);
        
      if (monthError) throw monthError;

      const newFormData = { fuel: '', machinery: '', other: '' };
      if (monthData) {
        monthData.forEach(row => {
          if (row.expense_type === 'fuel') newFormData.fuel = row.amount.toString();
          if (row.expense_type === 'machinery') newFormData.machinery = row.amount.toString();
          if (row.expense_type === 'other') newFormData.other = row.amount.toString();
        });
      }
      setFormData(newFormData);

      const { data: historyData, error: historyError } = await supabase
        .from('monthly_expenses')
        .select('*')
        .eq('user_id', tenantId)
        .order('month', { ascending: false })
        .limit(108);

      if (historyError) throw historyError;
      setHistoryLogs(historyData || []);

    } catch (error) {
      console.error(error);
      alert('データの取得に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('テナントIDが特定できません');

      const inserts = [
        { user_id: tenantId, month: selectedMonth, expense_type: 'fuel', amount: Number(formData.fuel) || 0 },
        { user_id: tenantId, month: selectedMonth, expense_type: 'machinery', amount: Number(formData.machinery) || 0 },
        { user_id: tenantId, month: selectedMonth, expense_type: 'other', amount: Number(formData.other) || 0 }
      ];

      const { error } = await supabase
        .from('monthly_expenses')
        .upsert(inserts, { onConflict: 'user_id, month, expense_type' });

      if (error) {
        const { error: fallbackErr } = await supabase
          .from('monthly_expenses')
          .upsert(inserts);
        if (fallbackErr) throw fallbackErr;
      }
      
      alert(`${selectedMonth}の経費を保存しました。`);
      fetchExpenses();
    } catch (error: any) {
      console.error(error);
      alert('保存に失敗しました: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const historyByMonth = useMemo(() => {
    const map: Record<string, { fuel: number, machinery: number, other: number }> = {};
    historyLogs.forEach(row => {
      if (!map[row.month]) {
        map[row.month] = { fuel: 0, machinery: 0, other: 0 };
      }
      if (row.expense_type === 'fuel') map[row.month].fuel = row.amount;
      if (row.expense_type === 'machinery') map[row.month].machinery = row.amount;
      if (row.expense_type === 'other') map[row.month].other = row.amount;
    });
    
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0])).map(([month, data]) => ({
      month,
      ...data,
      total: data.fuel + data.machinery + data.other
    }));
  }, [historyLogs]);

  return (
    <div className="space-y-6">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-indigo-600" />
            月次全体経費 (按分用)
            <HelpTooltip content="農場全体でかかった毎月の経費（光熱費や機械代など）を入力します。ここで入力した経費は、各作付の面積比に応じて自動で割り振られ、利益計算に使われます。" />
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            農場全体でかかった固定費・光熱費を月1回入力し、作目ごとに按分して正確な原価を計算します。
          </p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-amber-800 text-xs sm:text-sm">
        <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600" />
        <div>
          <p className="font-bold mb-1">経費按分の仕組み（ハイブリッド方式）</p>
          <ul className="list-disc ml-4 space-y-1 text-xs">
            <li>この画面で<strong>経費が入力されている月</strong>は、稼働中の全圃場の面積を計算し、面積比で正確に割り振られます（実績ベース）。</li>
            <li>この画面で<strong>経費がまだ入力されていない月</strong>（未来など）は、「作目マスタ」で設定した『10aあたり概算経費』を用いて予測計算されます。</li>
          </ul>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="font-bold text-xs text-slate-700 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              対象月を選択:
            </label>
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>
          <button 
            onClick={fetchExpenses}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            再読み込み
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              {/* 動力光熱費 */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block font-black text-slate-800 text-xs mb-1">動力光熱費</label>
                <p className="text-[11px] text-slate-500 mb-3 h-10">ハウス暖房用A重油、ボイラー燃料、電気代、水道代など</p>
                <div className="relative">
                  <input 
                    type="number" 
                    value={formData.fuel}
                    onChange={(e) => setFormData({...formData, fuel: e.target.value})}
                    placeholder="0"
                    className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-right text-base"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">円</span>
                </div>
              </div>

              {/* 機械・車両費 */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block font-black text-slate-800 text-xs mb-1">機械・車両費</label>
                <p className="text-[11px] text-slate-500 mb-3 h-10">トラクター・軽トラ燃料代、修理・車検、リース代など</p>
                <div className="relative">
                  <input 
                    type="number" 
                    value={formData.machinery}
                    onChange={(e) => setFormData({...formData, machinery: e.target.value})}
                    placeholder="0"
                    className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-right text-base"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">円</span>
                </div>
              </div>

              {/* その他経費 */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block font-black text-slate-800 text-xs mb-1">その他経費</label>
                <p className="text-[11px] text-slate-500 mb-3 h-10">事務用品、通信費、地代家賃、その他農場全体経費など</p>
                <div className="relative">
                  <input 
                    type="number" 
                    value={formData.other}
                    onChange={(e) => setFormData({...formData, other: e.target.value})}
                    placeholder="0"
                    className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-right text-base"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">円</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button 
                type="submit" 
                disabled={isSaving}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {selectedMonth} の経費を保存する
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 過去の履歴一覧 */}
      <div className="mt-8">
        <h2 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-slate-500" />
          月次経費の推移・履歴
        </h2>
        
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-slate-700">対象月</th>
                <th className="px-4 py-3 text-right font-bold text-slate-700">動力光熱費</th>
                <th className="px-4 py-3 text-right font-bold text-slate-700">機械・車両費</th>
                <th className="px-4 py-3 text-right font-bold text-slate-700">その他経費</th>
                <th className="px-4 py-3 text-right font-black text-indigo-700">合計</th>
                <th className="px-4 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historyByMonth.map((row) => (
                <tr 
                  key={row.month} 
                  className="hover:bg-slate-50 cursor-pointer transition-colors group"
                  onClick={() => {
                    setSelectedMonth(row.month);
                    setFormData({
                      fuel: row.fuel.toString(),
                      machinery: row.machinery.toString(),
                      other: row.other.toString()
                    });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <td className="px-4 py-3 font-bold text-slate-800">{row.month}</td>
                  <td className="px-4 py-3 text-right text-slate-600">¥ {row.fuel.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-slate-600">¥ {row.machinery.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-slate-600">¥ {row.other.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-black text-indigo-600">¥ {row.total.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <button 
                      type="button"
                      className="p-1 text-slate-400 group-hover:text-indigo-600 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {historyByMonth.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    登録されている履歴がありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
