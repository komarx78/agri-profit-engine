"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Truck, Download, Filter, Sprout, Store, Trash2 } from 'lucide-react';
import Papa from 'papaparse';

export default function SalesHistoryPage() {
  const [salesLogs, setSalesLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // フィルター用ステート
  const [filterCrop, setFilterCrop] = useState<string>('all');
  const [filterChannel, setFilterChannel] = useState<string>('all');

  useEffect(() => {
    fetchSalesLogs();
  }, []);

  async function fetchSalesLogs() {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('sales_logs')
        .select(`
          id,
          sales_date,
          quantity,
          unit,
          total_sales,
          crops(name),
          sales_channels(name)
        `)
        .order('sales_date', { ascending: false })
        .order('id', { ascending: false });

      if (error) throw error;
      if (data) setSalesLogs(data);
    } catch (err) {
      console.error(err);
      alert('売上データの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }

  // フィルターの選択肢を抽出（重複排除）
  const uniqueCrops = useMemo(() => {
    const names = salesLogs.map(log => log.crops?.name).filter(Boolean);
    return Array.from(new Set(names)).sort();
  }, [salesLogs]);

  const uniqueChannels = useMemo(() => {
    const names = salesLogs.map(log => log.sales_channels?.name).filter(Boolean);
    return Array.from(new Set(names)).sort();
  }, [salesLogs]);

  // 表示するログをフィルタリング
  const filteredLogs = useMemo(() => {
    return salesLogs.filter(log => {
      const matchCrop = filterCrop === 'all' || log.crops?.name === filterCrop;
      const matchChannel = filterChannel === 'all' || log.sales_channels?.name === filterChannel;
      return matchCrop && matchChannel;
    });
  }, [salesLogs, filterCrop, filterChannel]);

  // レコードの削除
  const handleDelete = async (id: string) => {
    const confirmDelete = window.confirm("この売上記録を削除してもよろしいですか？\n※この操作は取り消せません。");
    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from('sales_logs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // ローカルのステートから削除して再レンダリング
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
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <Truck className="w-8 h-8 text-amber-500" />
            出荷記録一覧
          </h1>
          <p className="text-slate-500 mt-2 font-medium">現場で入力されたすべての出荷（売上）の履歴です。</p>
        </div>
        
        <button
          onClick={handleExportCSV}
          className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          表示中データをCSV出力
        </button>
      </div>

      {/* フィルターUI */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center">
        <div className="flex items-center gap-2 text-slate-500 font-bold shrink-0">
          <Filter className="w-5 h-5" /> 絞り込み:
        </div>
        
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
          {/* 作目別フィルター */}
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Sprout className="w-4 h-4 text-slate-400" />
            </div>
            <select 
              value={filterCrop}
              onChange={(e) => setFilterCrop(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-amber-500 appearance-none"
            >
              <option value="all">すべての作目</option>
              {uniqueCrops.map(c => (
                <option key={c as string} value={c as string}>{c}</option>
              ))}
            </select>
          </div>

          {/* 出荷先別フィルター */}
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Store className="w-4 h-4 text-slate-400" />
            </div>
            <select 
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-amber-500 appearance-none"
            >
              <option value="all">すべての出荷先</option>
              {uniqueChannels.map(ch => (
                <option key={ch as string} value={ch as string}>{ch}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="text-sm font-bold text-slate-500 ml-auto">
          全 {filteredLogs.length} 件
        </div>
      </div>

      {/* 履歴テーブル */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                <th className="p-4 font-bold">出荷日</th>
                <th className="p-4 font-bold">作目</th>
                <th className="p-4 font-bold">出荷先</th>
                <th className="p-4 font-bold text-right">出荷量</th>
                <th className="p-4 font-bold text-right">売上金額</th>
                <th className="p-4 font-bold text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
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
                      <td className="p-4">
                        <div className="font-bold text-slate-700">{log.sales_date}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-800 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                          {log.crops?.name || '不明'}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-600">{log.sales_channels?.name || '不明'}</div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="font-bold text-slate-700">
                          {log.quantity} <span className="text-xs text-slate-400 font-normal">{log.unit || 'kg/箱'}</span>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="font-black text-amber-600 text-lg">
                          ¥{log.total_sales?.toLocaleString() || 0}
                        </div>
                        <div className="text-xs text-slate-400 font-bold mt-0.5">
                          (単価目安: ¥{unitPrice.toLocaleString()})
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleDelete(log.id)}
                          className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                          title="この記録を削除する"
                        >
                          <Trash2 className="w-5 h-5" />
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
