"use client";

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '@/lib/tenant';
import { HelpTooltip } from '@/components/HelpTooltip';
import { FileSpreadsheet, Download, RefreshCw, Loader2, Info, AlertTriangle, Calendar, Settings } from 'lucide-react';
import Papa from 'papaparse';

export default function AccountingPage() {
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [accounts, setAccounts] = useState({
    salesDebit: '売掛金',
    salesCredit: '売上高',
    materialDebit: '消耗品費',
    materialCredit: '現金',
  });

  const taxCategories = {
    sales: '課税売上 10%',
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
      const tenantId = await getCurrentTenantId();
      if (!tenantId) {
        throw new Error('テナントIDが特定できません');
      }

      const [salesRes, purchasesRes, cropsRes, channelsRes] = await Promise.all([
        supabase
          .from('sales_logs')
          .select('sales_date, total_sales, crop_id, channel_id')
          .eq('user_id', tenantId)
          .gte('sales_date', startDate)
          .lte('sales_date', endDate),
        
        supabase
          .from('material_purchases')
          .select('purchase_date, supplier, total_price, notes, materials(name)')
          .eq('user_id', tenantId)
          .gte('purchase_date', startDate)
          .lte('purchase_date', endDate),
          
        supabase.from('crops').select('id, name').eq('user_id', tenantId),
        supabase.from('sales_channels').select('id, name').eq('user_id', tenantId)
      ]);

      const crops = cropsRes.data || [];
      const channels = channelsRes.data || [];

      const salesLogs = (salesRes.data || []).map(log => ({
        ...log,
        crops: { name: crops.find(c => c.id === log.crop_id)?.name || '不明な作目' },
        sales_channels: { name: channels.find(c => c.id === log.channel_id)?.name || '不明な請求先' }
      }));
      
      const journalEntries: any[] = [];

      // 1. 売上データの集計
      const monthlySalesMap = new Map<string, { total: number; channelName: string; lastDate: string }>();

      salesLogs.forEach((log: any) => {
        if (!log.total_sales || log.total_sales <= 0) return;
        
        const monthKey = log.sales_date.substring(0, 7);
        const channelName = log.sales_channels?.name || '不明な請求先';
        const mapKey = `${monthKey}_${channelName}`;

        if (monthlySalesMap.has(mapKey)) {
          const existing = monthlySalesMap.get(mapKey)!;
          existing.total += log.total_sales;
        } else {
          monthlySalesMap.set(mapKey, {
            total: log.total_sales,
            channelName: channelName,
            lastDate: log.sales_date
          });
        }
      });

      let index = 1;
      monthlySalesMap.forEach((value, key) => {
        const [yearStr, monthStr] = key.split('_')[0].split('-');
        let accDate = new Date(parseInt(yearStr), parseInt(monthStr), 0);
        let dateStr = `${accDate.getFullYear()}/${String(accDate.getMonth()+1).padStart(2, '0')}/${String(accDate.getDate()).padStart(2, '0')}`;
        
        journalEntries.push({
          'No': index++,
          '日付': dateStr,
          '借方勘定科目': accounts.salesDebit,
          '借方補助科目': '',
          '借方部門': '',
          '借方税区分': '対象外',
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

      // 2. コストデータの集計
      const purchases = purchasesRes.data || [];

      purchases.forEach((p: any) => {
        if (!p.total_price || p.total_price <= 0) return;
        
        const dateStr = p.purchase_date?.replace(/-/g, '/') || '';
        const matName = p.materials?.name || 'その他資材';
        const supplier = p.supplier ? `${p.supplier} ` : '';
        const notes = p.notes ? ` (${p.notes})` : '';
        
        journalEntries.push({
          'No': index++,
          '日付': dateStr,
          '借方勘定科目': accounts.materialDebit,
          '借方補助科目': '',
          '借方部門': '',
          '借方税区分': taxCategories.material,
          '借方インボイス': '',
          '借方金額(円)': Math.round(p.total_price),
          '借方税額': 0,
          '貸方勘定科目': accounts.materialCredit,
          '貸方補助科目': '',
          '貸方部門': '',
          '貸方税区分': '対象外',
          '貸方インボイス': '',
          '貸方金額(円)': Math.round(p.total_price),
          '貸方税額': 0,
          '摘要': `${supplier}資材購入: ${matName}${notes}`,
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

      if (journalEntries.length === 0) {
        setMessage('指定された期間に仕訳データがありませんでした。');
        setIsLoading(false);
        return;
      }

      journalEntries.sort((a, b) => new Date(a.日付).getTime() - new Date(b.日付).getTime());
      
      journalEntries.forEach((entry, i) => {
        entry['No'] = i + 1;
      });

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
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-indigo-600 flex-shrink-0" />
          会計データ出力（仕訳CSV生成）
          <HelpTooltip content="売上や経費のデータを、マネーフォワードなどの会計ソフトに取り込める仕訳形式のCSVで出力します。" className="ml-1" />
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
          売上と仕入経費から、マネーフォワードクラウドの「仕訳帳」へ直接インポートできる全25項目のCSVを生成します。
        </p>
      </div>

      <div className="bg-indigo-50/70 p-4 rounded-xl border border-indigo-100 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <p className="text-xs text-indigo-900 font-bold leading-relaxed">
          【お知らせ】売上の計上方法が「請求書発行ベース（掛売上）」に対応しております。<br />
          <span className="font-normal text-indigo-700">自動的に「対象月・出荷先ごとの請求書単位」に合算され、月末日付で1本だけ売上仕訳が作成されます。</span>
        </p>
      </div>

      {message && (
        <div className={`p-3 rounded-xl text-xs font-bold text-center ${message.includes('エラー') || message.includes('ありません') ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-800'}`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <div className="md:col-span-1 space-y-4">
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
            <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" /> 抽出期間
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">開始日</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">終了日</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white py-3 px-4 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? '生成中...' : (
              <>
                <Download className="w-4 h-4" />
                MF互換CSVをダウンロード
              </>
            )}
          </button>

        </div>

        <div className="md:col-span-2">
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
            <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Settings className="w-4 h-4 text-slate-400" /> 勘定科目の設定
            </h2>
            
            <p className="text-xs text-slate-500 mb-4">
              ご自身の農園の会計ルールに合わせて、適用する勘定科目を書き換えてからダウンロードしてください。
            </p>

            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <h3 className="font-bold text-xs text-slate-700 mb-2 border-b border-indigo-200 inline-block pb-0.5">売上 (請求書発行ベース) の仕訳</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">借方科目 (例: 売掛金)</label>
                    <input type="text" name="salesDebit" value={accounts.salesDebit} onChange={handleAccountChange} className="w-full p-1.5 border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">貸方科目 (例: 売上高)</label>
                    <input type="text" name="salesCredit" value={accounts.salesCredit} onChange={handleAccountChange} className="w-full p-1.5 border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <h3 className="font-bold text-xs text-slate-700 mb-2 border-b border-indigo-200 inline-block pb-0.5">資材購入時の仕訳 (コスト)</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">借方科目 (例: 消耗品費, 肥料費)</label>
                    <input type="text" name="materialDebit" value={accounts.materialDebit} onChange={handleAccountChange} className="w-full p-1.5 border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">貸方科目 (例: 現金, 買掛金)</label>
                    <input type="text" name="materialCredit" value={accounts.materialCredit} onChange={handleAccountChange} className="w-full p-1.5 border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
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
