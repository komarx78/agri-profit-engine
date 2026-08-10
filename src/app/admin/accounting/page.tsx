"use client";

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { FileSpreadsheet, Download, Calendar, Settings, Info } from 'lucide-react';
import Papa from 'papaparse';

export default function AccountingPage() {
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  // 勘定科目のカスタマイズ用ステート
  const [accounts, setAccounts] = useState({
    salesDebit: '売掛金',
    salesCredit: '売上高',
    materialDebit: '消耗品費',
    materialCredit: '現金',
    laborDebit: '給料手当',
    laborCredit: '未払金',
  });

  const handleAccountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAccounts(prev => ({ ...prev, [name]: value }));
  };

  const handleExport = async () => {
    setIsLoading(true);
    setMessage('');
    
    try {
      // 指定期間のデータを取得
      const [salesRes, workRes] = await Promise.all([
        supabase
          .from('sales_logs')
          .select(`
            sales_date,
            total_sales,
            crops(name),
            sales_channels(name)
          `)
          .gte('sales_date', startDate)
          .lte('sales_date', endDate),
        
        supabase
          .from('work_logs')
          .select(`
            work_date,
            duration_minutes,
            material_quantity,
            crops(name),
            fields(name),
            workers(name, hourly_wage),
            materials(name, default_price)
          `)
          .gte('work_date', startDate)
          .lte('work_date', endDate)
      ]);

      const salesLogs = salesRes.data || [];
      const workLogs = workRes.data || [];
      const journalEntries: any[] = [];

      // 1. 売上データの仕訳作成
      salesLogs.forEach((log: any) => {
        if (!log.total_sales || log.total_sales <= 0) return;
        
        const cropName = log.crops?.name || '';
        const channelName = log.sales_channels?.name || '';
        const dateStr = log.sales_date.replace(/-/g, '/'); // MF形式 YYYY/MM/DD に寄せる
        
        journalEntries.push({
          '取引日': dateStr,
          '借方勘定科目': accounts.salesDebit,
          '借方金額': Math.round(log.total_sales),
          '借方税区分': '',
          '貸方勘定科目': accounts.salesCredit,
          '貸方金額': Math.round(log.total_sales),
          '貸方税区分': '',
          '摘要': `${cropName} ${channelName} 出荷分`
        });
      });

      // 2. コストデータの仕訳作成
      workLogs.forEach((log: any) => {
        const dateStr = log.work_date?.replace(/-/g, '/') || '';
        const cropName = log.crops?.name || '';
        
        // 資材費の仕訳
        if (log.material_quantity && log.materials?.default_price) {
          const matCost = log.material_quantity * log.materials.default_price;
          if (matCost > 0) {
            journalEntries.push({
              '取引日': dateStr,
              '借方勘定科目': accounts.materialDebit,
              '借方金額': Math.round(matCost),
              '借方税区分': '',
              '貸方勘定科目': accounts.materialCredit,
              '貸方金額': Math.round(matCost),
              '貸方税区分': '',
              '摘要': `${log.materials.name} 使用 (${cropName})`
            });
          }
        }
        
        // 人件費の仕訳
        if (log.duration_minutes && log.workers?.hourly_wage) {
          const laborCost = (log.duration_minutes / 60) * log.workers.hourly_wage;
          if (laborCost > 0) {
            journalEntries.push({
              '取引日': dateStr,
              '借方勘定科目': accounts.laborDebit,
              '借方金額': Math.round(laborCost),
              '借方税区分': '',
              '貸方勘定科目': accounts.laborCredit,
              '貸方金額': Math.round(laborCost),
              '貸方税区分': '',
              '摘要': `${log.workers.name} 作業代 (${cropName})`
            });
          }
        }
      });

      if (journalEntries.length === 0) {
        setMessage('指定された期間に仕訳データがありませんでした。');
        setIsLoading(false);
        return;
      }

      // 日付順に並び替え
      journalEntries.sort((a, b) => new Date(a.取引日).getTime() - new Date(b.取引日).getTime());

      // CSVエクスポート処理 (マネーフォワード形式)
      const csv = Papa.unparse(journalEntries);
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' }); // BOM付きUTF-8でExcelでも文字化けさせない
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MF仕訳_${startDate}_${endDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      
      setMessage(`${journalEntries.length}件の仕訳データをエクスポートしました！`);

    } catch (err) {
      console.error(err);
      setMessage('エラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
          <FileSpreadsheet className="w-8 h-8 text-blue-600" />
          会計データ出力（仕訳CSV生成）
        </h1>
        <p className="text-slate-500 mt-2 font-medium">
          売上と作業記録（人件費・資材費）から、マネーフォワード等の会計ソフトへ直接インポートできる複式簿記形式のCSVを生成します。
        </p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl font-bold text-center ${message.includes('エラー') || message.includes('ありません') ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* 左側: 期間指定と実行ボタン */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-slate-400" /> 抽出期間
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-500 mb-1">開始日</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-500 mb-1">終了日</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white p-4 rounded-2xl font-black text-lg shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? '生成中...' : (
              <>
                <Download className="w-5 h-5" />
                仕訳CSVをダウンロード
              </>
            )}
          </button>

          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800 font-medium leading-relaxed">
              ダウンロードしたCSVファイルは、マネーフォワードクラウドの「仕訳帳」からインポートすることができます。freee等へインポートする場合は、ソフト側のインポート設定で列を合わせてください。
            </p>
          </div>
        </div>

        {/* 右側: 勘定科目の設定 */}
        <div className="md:col-span-2">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-700 mb-6 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Settings className="w-5 h-5 text-slate-400" /> 勘定科目の設定
            </h2>
            
            <p className="text-sm text-slate-500 mb-6">
              ご自身の農園の会計ルール（科目マスタ）に合わせて、摘要される勘定科目を書き換えてからダウンロードしてください。
            </p>

            <div className="space-y-6">
              {/* 売上仕訳 */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <h3 className="font-bold text-slate-700 mb-3 border-b-2 border-blue-500 inline-block pb-1">売上発生時の仕訳</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">借方科目 (例: 売掛金, 現金)</label>
                    <input type="text" name="salesDebit" value={accounts.salesDebit} onChange={handleAccountChange} className="w-full p-2 border border-slate-200 rounded-lg text-sm font-bold focus:border-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">貸方科目 (例: 売上高, 農産物売上)</label>
                    <input type="text" name="salesCredit" value={accounts.salesCredit} onChange={handleAccountChange} className="w-full p-2 border border-slate-200 rounded-lg text-sm font-bold focus:border-blue-500 outline-none" />
                  </div>
                </div>
              </div>

              {/* 資材費仕訳 */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <h3 className="font-bold text-slate-700 mb-3 border-b-2 border-emerald-500 inline-block pb-1">資材使用時の仕訳 (コスト)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">借方科目 (例: 消耗品費, 肥料費)</label>
                    <input type="text" name="materialDebit" value={accounts.materialDebit} onChange={handleAccountChange} className="w-full p-2 border border-slate-200 rounded-lg text-sm font-bold focus:border-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">貸方科目 (例: 現金, 買掛金)</label>
                    <input type="text" name="materialCredit" value={accounts.materialCredit} onChange={handleAccountChange} className="w-full p-2 border border-slate-200 rounded-lg text-sm font-bold focus:border-blue-500 outline-none" />
                  </div>
                </div>
              </div>

              {/* 人件費仕訳 */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <h3 className="font-bold text-slate-700 mb-3 border-b-2 border-purple-500 inline-block pb-1">作業発生時の仕訳 (人件費)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">借方科目 (例: 給料手当, 雑給)</label>
                    <input type="text" name="laborDebit" value={accounts.laborDebit} onChange={handleAccountChange} className="w-full p-2 border border-slate-200 rounded-lg text-sm font-bold focus:border-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">貸方科目 (例: 未払金, 現金)</label>
                    <input type="text" name="laborCredit" value={accounts.laborCredit} onChange={handleAccountChange} className="w-full p-2 border border-slate-200 rounded-lg text-sm font-bold focus:border-blue-500 outline-none" />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
