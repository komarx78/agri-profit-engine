"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '@/lib/tenant';
import { HelpTooltip } from '@/components/HelpTooltip';
import { Truck, Download, Filter, Sprout, Store, Trash2, Edit2, CheckCircle2, Banknote, X, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';

export default function SalesHistoryPage() {
  const [salesLogs, setSalesLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filterCrop, setFilterCrop] = useState<string>('all');
  const [filterChannel, setFilterChannel] = useState<string>('all');

  // 事後確定・価格編集モーダル用ステート
  const [editingLog, setEditingLog] = useState<any | null>(null);
  const [editUnitPrice, setEditUnitPrice] = useState<string>('');
  const [editTotalSales, setEditTotalSales] = useState<string>('');
  const [isSavingPrice, setIsSavingPrice] = useState(false);

  useEffect(() => {
    fetchSalesLogs();
  }, []);

  async function fetchSalesLogs() {
    try {
      setIsLoading(true);
      const tenantId = await getCurrentTenantId();
      if (!tenantId) {
        setIsLoading(false);
        return;
      }

      const [logsRes, channelsRes, cropsRes] = await Promise.all([
        supabase
          .from('sales_logs')
          .select('id, sales_date, quantity, unit, total_sales, channel_id, crop_id')
          .eq('user_id', tenantId)
          .or('status.neq.planned,status.is.null')
          .order('sales_date', { ascending: false })
          .order('id', { ascending: false }),
        supabase.from('sales_channels').select('id, name').eq('user_id', tenantId),
        supabase.from('crops').select('id, name').eq('user_id', tenantId)
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

  // 価格編集モーダルを開く
  const handleOpenEdit = (log: any) => {
    setEditingLog(log);
    const unitPrice = (log.quantity > 0 && log.total_sales > 0) ? Math.round(log.total_sales / log.quantity) : '';
    setEditUnitPrice(unitPrice ? String(unitPrice) : '');
    setEditTotalSales(log.total_sales ? String(log.total_sales) : '');
  };

  // 単価変更時の連動計算
  const handleUnitPriceChange = (val: string) => {
    setEditUnitPrice(val);
    if (editingLog && val) {
      const u = parseFloat(val) || 0;
      setEditTotalSales(String(Math.round(editingLog.quantity * u)));
    }
  };

  // 売上総額変更時の連動計算
  const handleTotalSalesChange = (val: string) => {
    setEditTotalSales(val);
    if (editingLog && val && editingLog.quantity > 0) {
      const total = parseFloat(val) || 0;
      setEditUnitPrice(String(Math.round(total / editingLog.quantity)));
    }
  };

  // 価格保存（事後確定）
  const handleSavePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog) return;
    setIsSavingPrice(true);
    try {
      const finalTotal = parseFloat(editTotalSales) || 0;

      const { error } = await supabase
        .from('sales_logs')
        .update({
          total_sales: finalTotal
        })
        .eq('id', editingLog.id);

      if (error) throw error;

      setSalesLogs(prev => prev.map(l => l.id === editingLog.id ? { ...l, total_sales: finalTotal } : l));
      setEditingLog(null);
    } catch (err: any) {
      alert('保存エラー: ' + err.message);
    } finally {
      setIsSavingPrice(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmDelete = window.confirm("この出荷記録を削除してもよろしいですか？\n※この操作は取り消せません。");
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
      const unitPrice = (log.quantity > 0 && log.total_sales > 0) ? Math.round(log.total_sales / log.quantity) : 0;
      return {
        '出荷日': log.sales_date || '',
        '作目': log.crops?.name || '不明',
        '出荷先': log.sales_channels?.name || '不明',
        '出荷量': log.quantity || 0,
        '単位': log.unit || 'kg/箱',
        '適用単価': unitPrice,
        '売上金額': log.total_sales || 0,
        '状態': log.total_sales > 0 ? '確定済' : '未確定'
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
            出荷・売上履歴一覧
            <HelpTooltip content="現場日報で登録された出荷記録と売上金額の一覧です。JAや市場の精算書が届いた後、［✏️ 価格設定］から確定単価・売上金額をいつでも後から入力・確定できます。" />
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            現場で登録された出荷数量に対し、精算書到着後に確定金額を入力できます。
          </p>
        </div>
        
        <button
          onClick={handleExportCSV}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
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
                <th className="p-3.5 font-bold text-right">売上金額・単価</th>
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
                  const hasPrice = log.total_sales && log.total_sales > 0;
                  const unitPrice = (hasPrice && log.quantity > 0) ? Math.round(log.total_sales / log.quantity) : 0;
                  
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
                        {hasPrice ? (
                          <div>
                            <div className="font-black text-indigo-700 text-sm">
                              ¥{Number(log.total_sales).toLocaleString()}
                            </div>
                            <div className="text-[10px] text-emerald-600 font-bold flex items-center justify-end gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>¥{unitPrice.toLocaleString()}/{log.unit || 'kg'} (確定済)</span>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleOpenEdit(log)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg font-bold text-[11px] transition-colors cursor-pointer"
                            title="精算書到着後に単価・売上金額を入力"
                          >
                            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                            <span>金額未確定 (入力する)</span>
                          </button>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(log)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="単価・売上金額を編集・確定する"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(log.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="この記録を削除する"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 事後確定・価格編集モーダル */}
      {editingLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-600" />
                精算価格・売上金額の確定
              </h3>
              <button 
                onClick={() => setEditingLog(null)} 
                className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSavePrice} className="p-6 space-y-4">
              {/* 出荷情報概要 */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1">
                <div className="text-xs text-slate-500 font-bold">出荷日: {editingLog.sales_date}</div>
                <div className="text-sm font-black text-slate-800">
                  {editingLog.crops?.name} ➔ {editingLog.sales_channels?.name}
                </div>
                <div className="text-xs font-bold text-emerald-700">
                  出荷数量: {editingLog.quantity} {editingLog.unit || 'kg'}
                </div>
              </div>

              {/* 単価入力 */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  確定単価 (円/{editingLog.unit || 'kg'})
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">¥</span>
                  <input 
                    type="number" 
                    step="any"
                    value={editUnitPrice} 
                    onChange={e => handleUnitPriceChange(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-bold text-slate-800 text-lg"
                    placeholder="例: 250"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">※ 単価を入力すると売上総額が自動計算されます</p>
              </div>

              {/* 売上総額入力 */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  売上総額 (精算確定金額)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">¥</span>
                  <input 
                    type="number" 
                    step="any"
                    value={editTotalSales} 
                    onChange={e => handleTotalSalesChange(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-black text-indigo-700 text-2xl"
                    placeholder="例: 12500"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">※ 精算書の合計金額を直接入力することも可能です</p>
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingLog(null)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-sm transition-colors cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSavingPrice || !editTotalSales}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-sm transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSavingPrice ? (
                    <span>保存中...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>金額を確定して保存</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
