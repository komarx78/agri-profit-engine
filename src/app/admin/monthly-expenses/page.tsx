"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
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
  
  // 今月を初期値とする (YYYY-MM)
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [formData, setFormData] = useState<ExpenseFormData>({ fuel: '', machinery: '', other: '' });
  
  // 過去の一覧用
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);

  useEffect(() => {
    fetchExpenses();
  }, [selectedMonth]);

  const fetchExpenses = async () => {
    setIsLoading(true);
    try {
      // 選択した月のデータを取得
      const { data: monthData, error: monthError } = await supabase
        .from('monthly_expenses')
        .select('*')
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

      // 直近の履歴を取得（一覧用）
      const { data: historyData, error: historyError } = await supabase
        .from('monthly_expenses')
        .select('*')
        .order('month', { ascending: false })
        .limit(108); // 最大3年分 x 3種 = 108件程度

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
      const inserts = [
        { month: selectedMonth, expense_type: 'fuel', amount: Number(formData.fuel) || 0 },
        { month: selectedMonth, expense_type: 'machinery', amount: Number(formData.machinery) || 0 },
        { month: selectedMonth, expense_type: 'other', amount: Number(formData.other) || 0 }
      ];

      // onConflict を指定して Upsert（月と種類が重複すれば上書き）
      const { error } = await supabase
        .from('monthly_expenses')
        .upsert(inserts, { onConflict: 'month, expense_type' });

      if (error) throw error;
      
      alert(`${selectedMonth}の経費を保存しました。`);
      fetchExpenses(); // リロード
    } catch (error: any) {
      console.error(error);
      alert('保存に失敗しました: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 履歴データを月ごとにグループ化する
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
    
    // 月の降順にソートして配列化
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0])).map(([month, data]) => ({
      month,
      ...data,
      total: data.fuel + data.machinery + data.other
    }));
  }, [historyLogs]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6 pb-12 pt-4 sm:pt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-emerald-600" />
            月次全体経費の入力
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            農場全体でかかった経費を月1回入力します。ここで入力した経費は、各作付の面積比に応じて自動で按分され、正確な原価計算に使用されます。
          </p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-amber-800 text-sm">
        <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600" />
        <div>
          <p className="font-bold mb-1">経費按分の仕組み（ハイブリッド方式）</p>
          <ul className="list-disc ml-4 space-y-1 text-xs">
            <li>この画面で<strong>経費が入力されている月</strong>は、稼働中の全圃場の面積を計算し、面積比で正確に割り振られます（実績ベース）。</li>
            <li>この画面で<strong>経費がまだ入力されていない月</strong>（未来など）は、「作目マスタ」で設定した『10aあたり概算経費』を用いて予測計算されます（予算ベース）。</li>
            <li>月末に請求書が届いたら、この画面で実績を入力してください。自動的に各作付のレポートの数字が実績値に置き換わります。</li>
          </ul>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="font-bold text-slate-700 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              対象月を選択:
            </label>
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="p-2 border border-slate-300 rounded-lg font-bold text-lg focus:outline-none focus:border-emerald-500 bg-white"
            />
          </div>
          <button 
            onClick={fetchExpenses}
            className="text-sm font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            再読み込み
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              
              {/* 動力光熱費 */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block font-black text-slate-700 mb-2">動力光熱費</label>
                <p className="text-xs text-slate-500 mb-3 h-12">ハウスの暖房用A重油、ボイラー燃料、電気代、水道代など</p>
                <div className="relative">
                  <input 
                    type="number" 
                    value={formData.fuel}
                    onChange={(e) => setFormData({...formData, fuel: e.target.value})}
                    placeholder="0"
                    className="w-full pl-3 pr-8 py-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500 font-bold text-right text-lg"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">円</span>
                </div>
              </div>

              {/* 機械・車両費 */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block font-black text-slate-700 mb-2">機械・車両費</label>
                <p className="text-xs text-slate-500 mb-3 h-12">トラクターやトラックの軽油・ガソリン代、修理・メンテナンス費、リース代など</p>
                <div className="relative">
                  <input 
                    type="number" 
                    value={formData.machinery}
                    onChange={(e) => setFormData({...formData, machinery: e.target.value})}
                    placeholder="0"
                    className="w-full pl-3 pr-8 py-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500 font-bold text-right text-lg"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">円</span>
                </div>
              </div>

              {/* その他経費 */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block font-black text-slate-700 mb-2">その他経費</label>
                <p className="text-xs text-slate-500 mb-3 h-12">事務用品、通信費、地代家賃、その他農場全体にかかる経費など</p>
                <div className="relative">
                  <input 
                    type="number" 
                    value={formData.other}
                    onChange={(e) => setFormData({...formData, other: e.target.value})}
                    placeholder="0"
                    className="w-full pl-3 pr-8 py-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500 font-bold text-right text-lg"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">円</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button 
                type="submit" 
                disabled={isSaving}
                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm transition-colors flex items-center gap-2"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {selectedMonth} の経費を保存する
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 過去の履歴一覧 */}
      <div className="mt-12">
        <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-slate-500" />
          月次経費の推移・履歴
        </h2>
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-black text-slate-700">対象月</th>
                <th className="px-4 py-3 text-right font-black text-slate-700">動力光熱費</th>
                <th className="px-4 py-3 text-right font-black text-slate-700">機械・車両費</th>
                <th className="px-4 py-3 text-right font-black text-slate-700">その他経費</th>
                <th className="px-4 py-3 text-right font-black text-emerald-700">合計</th>
                <th className="px-4 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historyByMonth.map((row) => (
                <tr 
                  key={row.month} 
                  className="hover:bg-amber-50 cursor-pointer transition-colors group"
                  onClick={() => {
                    setSelectedMonth(row.month);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  title={`${row.month} の経費を編集`}
                >
                  <td className="px-4 py-3 font-bold text-slate-800">{row.month}</td>
                  <td className="px-4 py-3 text-right text-slate-600">¥ {row.fuel.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-slate-600">¥ {row.machinery.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-slate-600">¥ {row.other.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-black text-emerald-600">¥ {row.total.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <button className="p-1 text-slate-400 group-hover:text-emerald-600 transition-colors">
                      <Edit2 className="w-4 h-4" />
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
