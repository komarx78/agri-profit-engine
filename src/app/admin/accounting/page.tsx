"use client";

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { FileSpreadsheet, Download, Calendar, Settings, Info, AlertTriangle } from 'lucide-react';
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
  });

  // MF税区分の初期値（インポートエラーを防ぐため設定）
  const taxCategories = {
    sales: '課税売上 10%', // 軽減税率の場合は「課税売上 8%（軽）」などに変更可能にするなどの拡張余地
    material: '対象外'
  };

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

      // -------------------------------------------------------------
      // 1. 売上データの「月次・請求先単位」での集計処理（掛売上方式）
      // -------------------------------------------------------------
      const monthlySalesMap = new Map<string, { total: number; channelName: string; lastDate: string }>();

      salesLogs.forEach((log: any) => {
        if (!log.total_sales || log.total_sales <= 0) return;
        
        // 該当月のYYYY-MMを取得
        const monthKey = log.sales_date.substring(0, 7); // "2026-08"
        const channelName = log.sales_channels?.name || '不明な請求先';
        const mapKey = `${monthKey}_${channelName}`;

        if (monthlySalesMap.has(mapKey)) {
          const existing = monthlySalesMap.get(mapKey)!;
          existing.total += log.total_sales;
          // その月の一番最後の日付（計上日）を更新するなら比較するが、ここでは簡易的に末日を計算する
        } else {
          monthlySalesMap.set(mapKey, {
            total: log.total_sales,
            channelName: channelName,
            lastDate: log.sales_date
          });
        }
      });

      // 集計した売上マップからMF形式の仕訳レコードを作成
      let index = 1;
      monthlySalesMap.forEach((value, key) => {
        const [yearStr, monthStr] = key.split('_')[0].split('-');
        
        // 計上日はその月の末日とする（掛売上の原則）
        // ※ただし抽出期間が月の中途半端な場合は、指定されたendDateを上限とするなど適宜調整
        let accDate = new Date(parseInt(yearStr), parseInt(monthStr), 0); // 月末日
        let dateStr = `${accDate.getFullYear()}/${String(accDate.getMonth()+1).padStart(2, '0')}/${String(accDate.getDate()).padStart(2, '0')}`;
        
        journalEntries.push({
          'No': index++,
          '日付': dateStr,
          '借方勘定科目': accounts.salesDebit,
          '借方補助科目': '',
          '借方部門': '',
          '借方税区分': '対象外', // 売掛金は対象外
          '借方インボイス': '',
          '借方金額(円)': Math.round(value.total),
          '借方税額': 0,
          '貸方勘定科目': accounts.salesCredit,
          '貸方補助科目': '',
          '貸方部門': '',
          '貸方税区分': taxCategories.sales,
          '貸方インボイス': '',
          '貸方金額(円)': Math.round(value.total),
          '貸方税額': 0,
          '摘要': `【${parseInt(monthStr)}月分ご請求】${value.channelName}`,
          '仕訳メモ': '',
          'タグ': '',
          'MF仕訳タイプ': '',
          '決算整理仕訳': '',
          '作成日時': '',
          '作成者': '',
          '最終更新日時': '',
          '最終更新者': ''
        });
      });

      // -------------------------------------------------------------
      // 2. コスト（資材費・人件費）データは日々の発生ベースで仕訳化
      // -------------------------------------------------------------
      workLogs.forEach((log: any) => {
        const dateStr = log.work_date?.replace(/-/g, '/') || '';
        const cropName = log.crops?.name || '';
        
        // 資材費の仕訳
        if (log.material_quantity && log.materials?.default_price) {
          const matCost = log.material_quantity * log.materials.default_price;
          if (matCost > 0) {
            journalEntries.push({
              'No': index++,
              '日付': dateStr,
              '借方勘定科目': accounts.materialDebit,
              '借方補助科目': '',
              '借方部門': '',
              '借方税区分': taxCategories.material,
              '借方インボイス': '',
              '借方金額(円)': Math.round(matCost),
              '借方税額': 0,
              '貸方勘定科目': accounts.materialCredit,
              '貸方補助科目': '',
              '貸方部門': '',
              '貸方税区分': '対象外', // 現金などは対象外
              '貸方インボイス': '',
              '貸方金額(円)': Math.round(matCost),
              '貸方税額': 0,
              '摘要': `${log.materials.name} 使用 (${cropName})`,
              '仕訳メモ': '',
              'タグ': '',
              'MF仕訳タイプ': '',
              '決算整理仕訳': '',
              '作成日時': '',
              '作成者': '',
              '最終更新日時': '',
              '最終更新者': ''
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
      journalEntries.sort((a, b) => new Date(a.日付).getTime() - new Date(b.日付).getTime());
      
      // Noの振り直し
      journalEntries.forEach((entry, i) => {
        entry['No'] = i + 1;
      });

      // CSVエクスポート処理 (MF完全互換形式、Shift-JISまたはBOM付きUTF-8)
      // MFクラウドはBOM付きUTF-8を自動判別するためBOMを付与する
      const csv = Papa.unparse(journalEntries);
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MF仕訳帳_一括DL_${startDate}_${endDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      
      setMessage(`${journalEntries.length}件の仕訳データ（マネーフォワード完全互換形式）をエクスポートしました！`);

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
          売上と作業記録（資材費）から、マネーフォワードクラウドの「仕訳帳」へ直接インポートできる全25項目のCSVを生成します。
        </p>
      </div>

      <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex items-start gap-3 animate-in fade-in">
        <Info className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
        <p className="text-sm text-emerald-800 font-bold leading-relaxed">
          【お知らせ】売上の計上方法が「請求書発行ベース（掛売上）」にアップグレードされました！<br />
          <span className="font-normal text-emerald-700">これまでの「出荷ごと」の仕訳ではなく、自動的に「対象月・出荷先ごとの請求書単位」に合算され、月末日付で1本だけ売上仕訳が作成されます。</span>
        </p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl font-bold text-center ${message.includes('エラー') || message.includes('ありません') ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>
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
                MF互換CSVをダウンロード
              </>
            )}
          </button>

        </div>

        {/* 右側: 勘定科目の設定 */}
        <div className="md:col-span-2">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-700 mb-6 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Settings className="w-5 h-5 text-slate-400" /> 勘定科目の設定
            </h2>
            
            <p className="text-sm text-slate-500 mb-6">
              ご自身の農園の会計ルールに合わせて、摘要される勘定科目を書き換えてからダウンロードしてください。
            </p>

            <div className="space-y-6">
              {/* 売上仕訳 */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <h3 className="font-bold text-slate-700 mb-3 border-b-2 border-blue-500 inline-block pb-1">売上 (請求書発行ベース) の仕訳</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">借方科目 (例: 売掛金)</label>
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
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
