"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { FileText, Printer, Calculator, AlertCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface CompanySettings {
  company_name: string;
  postal_code: string;
  address: string;
  phone: string;
  invoice_number: string;
  bank_info: string;
}

interface InvoiceItem {
  cropName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export default function InvoicesPage() {
  const [channels, setChannels] = useState<any[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  
  // フィルター
  const currentMonth = new Date().toISOString().substring(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedChannel, setSelectedChannel] = useState('');
  
  const [salesLogs, setSalesLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetched, setIsFetched] = useState(false);

  useEffect(() => {
    async function init() {
      // 販路と自社設定の取得
      const [chRes, setRes] = await Promise.all([
        supabase.from('sales_channels').select('id, name').order('name'),
        supabase.from('company_settings').select('*').order('created_at', { ascending: false }).limit(1).single()
      ]);
      
      if (chRes.data) setChannels(chRes.data);
      if (setRes.data) setSettings(setRes.data as CompanySettings);
      
      if (chRes.data && chRes.data.length > 0) {
        setSelectedChannel(chRes.data[0].name);
      }
    }
    init();
  }, []);

  const handleGenerate = async () => {
    if (!selectedMonth || !selectedChannel) return;
    
    setIsLoading(true);
    setIsFetched(false);
    
    try {
      // 指定月（YYYY-MM）の最初の日と最後の日
      const startDate = `${selectedMonth}-01`;
      const date = new Date(selectedMonth + '-01');
      const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

      const [logsRes, cropsRes, channelsRes] = await Promise.all([
        supabase
          .from('sales_logs')
          .select(`
            id,
            quantity,
            unit,
            total_sales,
            crop_id,
            channel_id
          `)
          .gte('sales_date', startDate)
          .lte('sales_date', endDate),
        supabase.from('crops').select('id, name'),
        supabase.from('sales_channels').select('id, name')
      ]);
      
      if (logsRes.error) throw logsRes.error;
      
      const crops = cropsRes.data || [];
      const allChannels = channelsRes.data || [];

      // JS側でマッピングとフィルタリングを行う
      const mappedLogs = (logsRes.data || []).map(log => ({
        ...log,
        crops: { name: crops.find(c => c.id === log.crop_id)?.name || '不明な作目' },
        sales_channels: { name: allChannels.find(c => c.id === log.channel_id)?.name || '不明な請求先' }
      }));

      const filtered = mappedLogs.filter(log => log.sales_channels.name === selectedChannel);
      setSalesLogs(filtered);
      setIsFetched(true);
      
    } catch (err) {
      console.error(err);
      alert('データ取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // 請求書明細の集計（同じ作目・同じ推計単価のものをまとめる）
  const invoiceItems = useMemo(() => {
    const map = new Map<string, InvoiceItem>();
    
    salesLogs.forEach(log => {
      if (!log.total_sales || log.total_sales <= 0) return;
      
      const cName = log.crops?.name || '不明な作目';
      const u = log.unit || 'kg/箱';
      const q = log.quantity || 0;
      const total = log.total_sales;
      // 単価は総額/数量の推計値とする
      const price = q > 0 ? Math.round(total / q) : 0;
      
      const key = `${cName}_${price}_${u}`;
      
      if (map.has(key)) {
        const existing = map.get(key)!;
        existing.quantity += q;
        existing.total += total;
      } else {
        map.set(key, {
          cropName: cName,
          unit: u,
          quantity: q,
          unitPrice: price,
          total: total
        });
      }
    });
    
    return Array.from(map.values()).sort((a, b) => a.cropName.localeCompare(b.cropName));
  }, [salesLogs]);

  // 税金計算 (軽減税率対応などは簡略化し、合計に対して10%と仮定。本来は品目ごと)
  // 農業において食用農産物は軽減税率(8%)が適用されるケースが多いが、今回は簡易的に全額対象または設定なし。
  // 実務上は内税・外税があるが、ここでは「表示上の合計を税込（請求総額）」とする。
  const subtotal = invoiceItems.reduce((acc, item) => acc + item.total, 0);
  const tax = Math.round(subtotal * 0.08); // ※仮で軽減税率8%として計算（適宜変更可能）
  // 既にtotal_salesが税込で記録されている前提の場合は、税計算を分けるかどうかに依存する。
  // 今回のシステムは `sales_prices` の単価をそのまま掛け算しているので、税込総額として扱うのが無難。
  const totalAmount = subtotal; // 税込請求額

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* --- コントロールパネル (印刷時に非表示) --- */}
      <div className="print:hidden space-y-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <FileText className="w-8 h-8 text-indigo-500" />
            請求書発行
          </h1>
          <p className="text-slate-500 mt-2 font-medium">指定した月の出荷記録を自動で合算し、請求書を生成・印刷します。</p>
        </div>

        {!settings && (
          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-800 mb-1">自社情報が設定されていません</p>
              <p className="text-xs text-amber-700 mb-2">請求書に印字する農園名や振込先口座情報を設定してください。</p>
              <Link href="/admin/settings" className="text-xs font-bold bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors inline-block">
                自社設定へ移動
              </Link>
            </div>
          </div>
        )}

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-bold text-slate-500 mb-1">対象月</label>
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex-1 w-full">
            <label className="block text-sm font-bold text-slate-500 mb-1">請求先（出荷先）</label>
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-indigo-500 appearance-none"
            >
              {channels.map(ch => (
                <option key={ch.id} value={ch.name}>{ch.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleGenerate}
            disabled={isLoading || !selectedMonth || !selectedChannel}
            className="w-full md:w-auto bg-slate-800 hover:bg-slate-700 text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Calculator className="w-5 h-5" />}
            請求書を作成
          </button>
        </div>
      </div>

      {/* --- 請求書プレビュー --- */}
      {isFetched && (
        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="print:hidden flex justify-end">
            <button
              onClick={handlePrint}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-md shadow-indigo-600/20"
            >
              <Printer className="w-4 h-4" />
              この請求書を印刷 (PDF保存)
            </button>
          </div>

          <div className="bg-white p-10 md:p-16 rounded-none md:rounded-2xl shadow-sm border border-slate-200 print:shadow-none print:border-none print:p-0 min-h-[1050px]">
            {/* 請求書ヘッダー */}
            <div className="flex justify-between items-start border-b-2 border-slate-800 pb-8 mb-8">
              <div>
                <h2 className="text-4xl font-black text-slate-800 tracking-widest mb-6">請求書</h2>
                <div className="text-xl font-bold text-slate-800 border-b border-slate-800 pb-2 inline-block min-w-[300px]">
                  {selectedChannel} <span className="text-base font-normal">御中</span>
                </div>
                <div className="mt-4 text-sm text-slate-600 font-medium">
                  下記の通りご請求申し上げます。
                </div>
              </div>
              
              <div className="text-right text-sm text-slate-700 space-y-1">
                <div className="mb-4">
                  発行日: {new Date().toLocaleDateString('ja-JP')}
                </div>
                {settings ? (
                  <>
                    <div className="text-lg font-bold text-slate-800 mb-2">{settings.company_name}</div>
                    {settings.postal_code && <div>〒{settings.postal_code}</div>}
                    {settings.address && <div>{settings.address}</div>}
                    {settings.phone && <div>TEL: {settings.phone}</div>}
                    {settings.invoice_number && <div className="mt-2 text-xs font-bold text-slate-500">登録番号: T{settings.invoice_number}</div>}
                  </>
                ) : (
                  <div className="text-slate-400 italic">自社情報未設定</div>
                )}
              </div>
            </div>

            {/* 請求金額合計 */}
            <div className="flex justify-center mb-12">
              <div className="text-center">
                <div className="text-sm font-bold text-slate-500 mb-1 tracking-widest">ご請求金額 (税込)</div>
                <div className="text-5xl font-black text-slate-800 border-b-4 border-slate-800 pb-2 px-8">
                  ¥ {totalAmount.toLocaleString()} -
                </div>
              </div>
            </div>

            {/* 明細テーブル */}
            <table className="w-full text-left border-collapse mb-12">
              <thead>
                <tr className="bg-slate-100 border-b-2 border-slate-800 text-slate-700 font-bold text-sm">
                  <th className="py-3 px-4 w-1/2">品目・摘要</th>
                  <th className="py-3 px-4 text-right">数量</th>
                  <th className="py-3 px-4 text-center">単位</th>
                  <th className="py-3 px-4 text-right">単価</th>
                  <th className="py-3 px-4 text-right">金額</th>
                </tr>
              </thead>
              <tbody className="text-slate-800">
                {invoiceItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 font-bold">
                      この期間の出荷データがありません。
                    </td>
                  </tr>
                ) : (
                  invoiceItems.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="py-3 px-4 font-bold">{item.cropName}</td>
                      <td className="py-3 px-4 text-right">{item.quantity}</td>
                      <td className="py-3 px-4 text-center text-slate-500">{item.unit}</td>
                      <td className="py-3 px-4 text-right text-slate-600">¥{item.unitPrice.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-bold">¥{item.total.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* フッター情報 (振込先など) */}
            <div className="mt-auto grid grid-cols-2 gap-8 border-t-2 border-slate-800 pt-8">
              <div>
                <div className="text-sm font-bold text-slate-500 mb-2 tracking-widest">振込先口座</div>
                {settings?.bank_info ? (
                  <div className="text-slate-700 font-medium whitespace-pre-wrap leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
                    {settings.bank_info}
                  </div>
                ) : (
                  <div className="text-slate-400 italic">振込先情報未設定</div>
                )}
              </div>
              <div>
                <div className="text-sm font-bold text-slate-500 mb-2 tracking-widest">備考</div>
                <div className="text-slate-700 font-medium whitespace-pre-wrap leading-relaxed text-sm">
                  対象期間: {selectedMonth.replace('-', '年')}月分<br />
                  お振込手数料は貴社にてご負担くださいますようお願い申し上げます。
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
