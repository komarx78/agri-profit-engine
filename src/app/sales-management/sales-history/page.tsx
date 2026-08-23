"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { HelpTooltip } from '@/components/HelpTooltip';
import { Truck, Download, Filter, Sprout, Store, Trash2 } from 'lucide-react';
import Papa from 'papaparse';

export default function SalesHistoryPage() {
  const [salesLogs, setSalesLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filterCrop, setFilterCrop] = useState<string>('all');
  const [filterChannel, setFilterChannel] = useState<string>('all');

  useEffect(() => {
    fetchSalesLogs();
  }, []);

  async function fetchSalesLogs() {
    try {
      setIsLoading(true);
      const [logsRes, channelsRes, cropsRes] = await Promise.all([
        supabase
          .from('sales_logs')
          .select('id, sales_date, quantity, unit, total_sales, channel_id, crop_id')
          .or('status.neq.planned,status.is.null')
          .order('sales_date', { ascending: false })
          .order('id', { ascending: false }),
        supabase.from('sales_channels').select('id, name'),
        supabase.from('crops').select('id, name')
      ]);

      if (logsRes.error) throw logsRes.error;
      
      const channels = channelsRes.data || [];
      const crops = cropsRes.data || [];

      const mappedLogs = (logsRes.data || []).map(log => ({
        ...log,
        crops: { name: crops.find(c => c.id === log.crop_id)?.name || '不明' },
        sales_channels: { name: channels.find(c => c.id === log.channel_id)?.name || '不明' }
      }));

      setSalesLogs(mappedLogs);
    } catch (err) {
      console.error(err);
      alert('売上データの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }

  const uniqueCrops = useMemo(() => {
    const names = salesLogs.map(log => log.crops?.name).filter(Boolean);
    return Array.from(new Set(names)).sort();
  }, [salesLogs]);

  const uniqueChannels = useMemo(() => {
    const names = salesLogs.map(log => log.sales_channels?.name).filter(Boolean);
    return Array.from(new Set(names)).sort();
  }, [salesLogs]);

  const filteredLogs = useMemo(() => {
    return salesLogs.filter(log => {
      const matchCrop = filterCrop === 'all' || log.crops?.name === filterCrop;
      const matchChannel = filterChannel === 'all' || log.sales_channels?.name === filterChannel;
      return matchCrop && matchChannel;
    });
  }, [salesLogs, filterCrop, filterChannel]);

  const handleDelete = async (id: string) => {
    const confirmDelete = window.confirm("この売上記録を削除してもよろしいですか？\n※この操作は取り消せません。");
    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from('sales_logs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setSalesLogs(prev => prev.filter(log => log.id !== id));
    } catch (err) {
      console.error(err);
      alert('削除に失敗しました');
    }
  };

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;
    
    const exportData = filteredLogs.map(log => {
      const unitPrice = log.quantity > 0 && log.total_sales > 0 ? Math.round(log.total_sales / log.quantity) : 0;
      return {
        '出荷日': log.sales_date || '',
        '作目': log.crops?.name || '不明',
        '出荷先': log.sales_channels?.name || '不明',
        '出荷量': log.quantity || 0,
        '単位': log.unit || 'kg/箱',
        '適用単価(推計)': unitPrice,
        '売上金額': log.total_sales || 0
      };
    });

    const csv = Papa.unparse(exportData);
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `出荷売上履歴_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6 text-indigo-600 flex-shrink-0" />
            出荷履歴一覧
            <HelpTooltip content="出荷および売上の履歴データです。CSVでダウンロードして会計ソフト等と連携可能です。" />
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">現場日誌やB2Bで登録されたすべての出荷・売上履歴です。</p>
        </div>
        
        <button
          onClick={handleExportCSV}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors shadow-xs"
        >
          <Download className="w-4 h-4" />
          表示中データをCSV出力
        </button>
      </div>

      {/* フィルターUI */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 flex flex-col md:flex-row gap-4 items-center">
        <div className="flex items-center gap-2 text-slate-500 font-bold text-xs shrink-0">
          <Filter className="w-4 h-4 text-indigo-600" /> 絞り込み:
        </div>
        
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Sprout className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <select 
              value={filterCrop}
              onChange={(e) => setFilterCrop(e.target.value)}
              className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
            >
              <option value="all">すべての作目</option>
              {uniqueCrops.map(c => (
                <option key={c as string} value={c as string}>{c}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Store className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <select 
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
            >
              <option value="all">すべての出荷先</option>
              {uniqueChannels.map(ch => (
                <option key={ch as string} value={ch as string}>{ch}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="text-xs font-bold text-slate-500 ml-auto">
          全 {filteredLogs.length} 件
        </div>
      </div>

      {/* 履歴テーブル */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px] text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <th className="p-3.5 font-bold">出荷日</th>
                <th className="p-3.5 font-bold">作目</th>
                <th className="p-3.5 font-bold">出荷先</th>
                <th className="p-3.5 font-bold text-right">出荷量</th>
                <th className="p-3.5 font-bold text-right">売上金額</th>
                <th className="p-3.5 font-bold text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <div className="inline-block animate-spin rounded-full h-7 w-7 border-b-2 border-indigo-600"></div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400 font-bold">条件に一致する出荷記録がありません</td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const unitPrice = log.quantity > 0 && log.total_sales > 0 ? Math.round(log.total_sales / log.quantity) : 0;
                  
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-700">{log.sales_date}</div>
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                          {log.crops?.name || '不明'}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-600">{log.sales_channels?.name || '不明'}</div>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="font-bold text-slate-700">
                          {log.quantity} <span className="text-[10px] text-slate-400 font-normal">{log.unit || 'kg/箱'}</span>
                        </div>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="font-black text-indigo-700 text-sm">
                          ¥{log.total_sales?.toLocaleString() || 0}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold">
                          (単価目安: ¥{unitPrice.toLocaleString()})
                        </div>
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => handleDelete(log.id)}
                          className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                          title="この記録を削除する"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
