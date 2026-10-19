"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '@/lib/tenant';
import {
  createAdHocSalesLogAction,
  getSalesLogsAndMastersAction,
  updateAdHocSalesLogPriceAction,
  deleteAdHocSalesLogAction
} from '@/app/actions/b2b';
import { getJSTDate } from '@/lib/dateUtils';
import { HelpTooltip } from '@/components/HelpTooltip';
import {
  Truck,
  Download,
  Filter,
  Sprout,
  Store,
  Trash2,
  Edit2,
  CheckCircle2,
  Banknote,
  X,
  AlertCircle,
  Plus
} from 'lucide-react';
import Papa from 'papaparse';

export default function SalesHistoryPage() {
  const [tenantId, setTenantId] = useState<string>('');
  const [salesLogs, setSalesLogs] = useState<any[]>([]);
  const [crops, setCrops] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filterCrop, setFilterCrop] = useState<string>('all');
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // 新規の都度出荷（JA・直売所・市場）登録モーダル用ステート
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newLogDate, setNewLogDate] = useState(() => getJSTDate());
  const [newLogCropId, setNewLogCropId] = useState('');
  const [newLogChannelId, setNewLogChannelId] = useState('');
  const [newLogCustomChannelName, setNewLogCustomChannelName] = useState('');
  const [newLogQuantity, setNewLogQuantity] = useState('10');
  const [newLogUnit, setNewLogUnit] = useState('箱');
  const [newLogUnitPrice, setNewLogUnitPrice] = useState('');
  const [newLogTotalSales, setNewLogTotalSales] = useState('');
  const [isCreatingLog, setIsCreatingLog] = useState(false);

  // 事後確定・価格編集モーダル用ステート
  const [editingLog, setEditingLog] = useState<any | null>(null);
  const [editUnitPrice, setEditUnitPrice] = useState<string>('');
  const [editTotalSales, setEditTotalSales] = useState<string>('');
  const [isSavingPrice, setIsSavingPrice] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(prev => (prev === msg ? null : prev));
    }, 3500);
  };

  useEffect(() => {
    fetchSalesLogs();
  }, []);

  async function fetchSalesLogs() {
    try {
      setIsLoading(true);
      const tid = await getCurrentTenantId();
      if (!tid) {
        setIsLoading(false);
        return;
      }
      setTenantId(tid);

      const srvRes = await getSalesLogsAndMastersAction(tid);
      if (srvRes?.success) {
        const chList = srvRes.channels || [];
        const crList = srvRes.crops || [];
        setChannels(chList);
        setCrops(crList);
        const mappedLogs = (srvRes.salesLogs || []).map((log: any) => ({
          ...log,
          crops: { name: crList.find((c: any) => c.id === log.crop_id)?.name || '不明' },
          sales_channels: { name: chList.find((c: any) => c.id === log.channel_id)?.name || '出荷先未設定' }
        }));
        setSalesLogs(mappedLogs);
        return;
      }

      const [logsRes, channelsRes, cropsRes] = await Promise.all([
        supabase
          .from('sales_logs')
          .select('id, sales_date, quantity, unit, total_sales, channel_id, crop_id')
          .eq('user_id', tid)
          .or('status.neq.planned,status.is.null')
          .order('sales_date', { ascending: false })
          .order('id', { ascending: false }),
        supabase.from('sales_channels').select('id, name').eq('user_id', tid).order('name'),
        supabase.from('crops').select('id, name, default_unit').eq('user_id', tid).order('name')
      ]);

      if (logsRes.error) throw logsRes.error;

      const chList = channelsRes.data || [];
      const crList = cropsRes.data || [];
      setChannels(chList);
      setCrops(crList);

      const mappedLogs = (logsRes.data || []).map(log => ({
        ...log,
        crops: { name: crList.find(c => c.id === log.crop_id)?.name || '不明' },
        sales_channels: { name: chList.find(c => c.id === log.channel_id)?.name || '出荷先未設定' }
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

  // 新規出荷記録の登録処理
  const handleCreateLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLogCropId) {
      alert('出荷した野菜（作目）を選択してください。');
      return;
    }
    setIsCreatingLog(true);
    try {
      const res = await createAdHocSalesLogAction(
        {
          sales_date: newLogDate,
          crop_id: newLogCropId,
          channel_id: newLogChannelId === '__NEW__' ? '' : newLogChannelId,
          new_channel_name: newLogChannelId === '__NEW__' ? newLogCustomChannelName : '',
          quantity: Number(newLogQuantity) || 0,
          unit: newLogUnit || '箱',
          total_sales: Number(newLogTotalSales) || 0
        },
        tenantId
      );

      if (res.success) {
        setShowCreateModal(false);
        setNewLogUnitPrice('');
        setNewLogTotalSales('');
        setNewLogCustomChannelName('');
        await fetchSalesLogs();
        showToast('出荷記録を登録しました！');
      } else {
        alert('登録エラー: ' + res.error);
      }
    } finally {
      setIsCreatingLog(false);
    }
  };

  // 価格編集モーダルを開く
  const handleOpenEdit = (log: any) => {
    setEditingLog(log);
    const unitPrice =
      log.quantity > 0 && log.total_sales > 0 ? Math.round(log.total_sales / log.quantity) : '';
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
      const currentTid = tenantId || (await getCurrentTenantId());

      const srvRes = await updateAdHocSalesLogPriceAction(editingLog.id, finalTotal, currentTid);
      if (!srvRes?.success) {
        const { error } = await supabase
          .from('sales_logs')
          .update({
            total_sales: finalTotal
          })
          .eq('id', editingLog.id);

        if (error) throw error;
      }

      setSalesLogs(prev =>
        prev.map(l => (l.id === editingLog.id ? { ...l, total_sales: finalTotal } : l))
      );
      setEditingLog(null);
      showToast('売上金額を確定して保存しました！');
    } catch (err: any) {
      alert('保存エラー: ' + err.message);
    } finally {
      setIsSavingPrice(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmDelete = window.confirm(
      'この出荷記録を削除してもよろしいですか？\n※この操作は取り消せません。'
    );
    if (!confirmDelete) return;

    try {
      const currentTid = tenantId || (await getCurrentTenantId());
      const srvRes = await deleteAdHocSalesLogAction(id, currentTid);
      if (!srvRes?.success) {
        const { error } = await supabase.from('sales_logs').delete().eq('id', id);
        if (error) throw error;
      }
      setSalesLogs(prev => prev.filter(log => log.id !== id));
      showToast('出荷記録を削除しました。');
    } catch (err) {
      console.error(err);
      alert('削除に失敗しました');
    }
  };

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;

    const exportData = filteredLogs.map(log => {
      const unitPrice =
        log.quantity > 0 && log.total_sales > 0 ? Math.round(log.total_sales / log.quantity) : 0;
      return {
        出荷日: log.sales_date || '',
        作目: log.crops?.name || '不明',
        出荷先: log.sales_channels?.name || '不明',
        出荷量: log.quantity || 0,
        単位: log.unit || 'kg/箱',
        適用単価: unitPrice,
        売上金額: log.total_sales || 0,
        状態: log.total_sales > 0 ? '確定済' : '未確定'
      };
    });

    const csv = Papa.unparse(exportData);
    const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csv], {
      type: 'text/csv;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `出荷売上履歴_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 relative">
      {/* トースト通知 */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-700 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-sm font-black">
          <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6 text-indigo-600 shrink-0" />
            <span>JA・直売所・市場の出荷記録</span>
            <HelpTooltip content="農協（JA）や直売所・市場へ出した野菜の数量と売上金額を記録します。出した当日は数量だけ入れておき、後日「精算書」が届いてから金額を入力することもできます。" />
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-bold">
            この画面から直接「今日どこに何箱出したか」を記録でき、あとで精算書が届いたら金額を入力して確定できます。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (!newLogCropId && crops[0]?.id) setNewLogCropId(crops[0].id);
              if (!newLogChannelId && channels[0]?.id) setNewLogChannelId(channels[0].id);
              setShowCreateModal(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>＋ JA・直売所への出荷を記録する</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-indigo-600" />
            <span>CSV出力</span>
          </button>
        </div>
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
              onChange={e => setFilterCrop(e.target.value)}
              className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
            >
              <option value="all">すべての野菜（作目）</option>
              {uniqueCrops.map(c => (
                <option key={c as string} value={c as string}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Store className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <select
              value={filterChannel}
              onChange={e => setFilterChannel(e.target.value)}
              className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
            >
              <option value="all">すべての出荷先（JA・直売所等）</option>
              {uniqueChannels.map(ch => (
                <option key={ch as string} value={ch as string}>
                  {ch}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs font-bold text-slate-500 ml-auto">全 {filteredLogs.length} 件</div>
      </div>

      {/* 履歴テーブル */}
      <div className="bg-white rounded-3xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px] text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black">
                <th className="p-3.5">出荷日</th>
                <th className="p-3.5">野菜（作目）</th>
                <th className="p-3.5">出荷先（JA・直売所等）</th>
                <th className="p-3.5 text-right">出荷数量</th>
                <th className="p-3.5 text-right">売上金額・単価</th>
                <th className="p-3.5 text-center">操作</th>
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
                  <td colSpan={6} className="p-12 text-center text-slate-400 font-bold">
                    出荷記録がまだありません。右上の「＋ JA・直売所への出荷を記録する」から追加できます。
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const hasPrice = log.total_sales && log.total_sales > 0;
                  const unitPrice =
                    hasPrice && log.quantity > 0 ? Math.round(log.total_sales / log.quantity) : 0;

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-700">{log.sales_date}</div>
                      </td>
                      <td className="p-3.5">
                        <div className="font-black text-slate-800 flex items-center gap-1.5 text-sm">
                          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                          {log.crops?.name || '不明'}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                          {log.sales_channels?.name || '出荷先未設定'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="font-black text-slate-800 text-sm">
                          {log.quantity}{' '}
                          <span className="text-xs text-slate-500 font-bold">
                            {log.unit || 'kg/箱'}
                          </span>
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
                              <span>
                                ¥{unitPrice.toLocaleString()}/{log.unit || 'kg'} (確定済)
                              </span>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(log)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl font-black text-xs transition-colors cursor-pointer"
                            title="精算書到着後に単価・売上金額を入力"
                          >
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            <span>金額未確定 ➔ 金額を入れる</span>
                          </button>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(log)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="単価・売上金額を編集・確定する"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
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

      {/* 1. 新規の都度出荷（JA・直売所・市場）登録モーダル */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-emerald-50/60">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-600" />
                <span>JA・直売所・市場への出荷を記録</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-slate-400 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLog} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">出荷日</label>
                <input
                  type="date"
                  value={newLogDate}
                  onChange={e => setNewLogDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  出荷した野菜（作目） <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newLogCropId}
                  onChange={e => {
                    const cid = e.target.value;
                    setNewLogCropId(cid);
                    const cObj = crops.find(x => x.id === cid);
                    if (cObj?.default_unit) setNewLogUnit(cObj.default_unit);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800"
                  required
                >
                  <option value="">野菜を選択してください...</option>
                  {crops.map(c => (
                    <option key={c.id} value={c.id}>
                      🌱 {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  出荷先（JA・直売所・市場など）
                </label>
                <select
                  value={newLogChannelId}
                  onChange={e => setNewLogChannelId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800"
                >
                  <option value="">出荷先を選択...</option>
                  {channels.map(ch => (
                    <option key={ch.id} value={ch.id}>
                      🏪 {ch.name}
                    </option>
                  ))}
                  <option value="__NEW__">✨ ＋ 新しい出荷先（直売所・JA等）を入力する...</option>
                </select>

                {(newLogChannelId === '__NEW__' || channels.length === 0) && (
                  <input
                    type="text"
                    value={newLogCustomChannelName}
                    onChange={e => {
                      setNewLogChannelId('__NEW__');
                      setNewLogCustomChannelName(e.target.value);
                    }}
                    placeholder="新しい出荷先の名前（例: JAあいち / 道の駅〇〇）"
                    className="w-full mt-2 px-3.5 py-2 bg-white border border-emerald-300 rounded-xl text-sm font-bold text-slate-800"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    出荷した数量 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={newLogQuantity}
                    onChange={e => {
                      const q = e.target.value;
                      setNewLogQuantity(q);
                      if (newLogUnitPrice) {
                        setNewLogTotalSales(
                          String(Math.round((Number(q) || 0) * (Number(newLogUnitPrice) || 0)))
                        );
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-right text-sm font-black text-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">数え方（単位）</label>
                  <input
                    type="text"
                    value={newLogUnit}
                    onChange={e => setNewLogUnit(e.target.value)}
                    placeholder="箱 / 袋 / kg"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-center text-sm font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-700">
                    売上金額（精算書がまだなら空欄でOK！）
                  </label>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                    あとから入力可能
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block mb-1">
                      1{newLogUnit || '単位'}の単価（任意）
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-slate-400">¥</span>
                      <input
                        type="number"
                        min="0"
                        value={newLogUnitPrice}
                        onChange={e => {
                          const up = e.target.value;
                          setNewLogUnitPrice(up);
                          if (up) {
                            setNewLogTotalSales(
                              String(Math.round((Number(newLogQuantity) || 0) * (Number(up) || 0)))
                            );
                          }
                        }}
                        placeholder="未定なら空欄"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-right text-sm font-bold text-slate-800"
                      />
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block mb-1">
                      売上合計金額（任意）
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-slate-400">¥</span>
                      <input
                        type="number"
                        min="0"
                        value={newLogTotalSales}
                        onChange={e => setNewLogTotalSales(e.target.value)}
                        placeholder="0（未確定）"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-right text-sm font-black text-indigo-700"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs sm:text-sm cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isCreatingLog}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs sm:text-sm shadow-sm cursor-pointer"
                >
                  {isCreatingLog ? '登録中...' : '✓ 出荷を記録する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. 事後確定・価格編集モーダル */}
      {editingLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-600" />
                精算価格・売上金額の確定
              </h3>
              <button
                type="button"
                onClick={() => setEditingLog(null)}
                className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePrice} className="p-6 space-y-4">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1">
                <div className="text-xs text-slate-500 font-bold">出荷日: {editingLog.sales_date}</div>
                <div className="text-sm font-black text-slate-800">
                  {editingLog.crops?.name} ➔ {editingLog.sales_channels?.name}
                </div>
                <div className="text-xs font-bold text-emerald-700">
                  出荷数量: {editingLog.quantity} {editingLog.unit || 'kg'}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  確定単価 (円/{editingLog.unit || 'kg'})
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                    ¥
                  </span>
                  <input
                    type="number"
                    step="any"
                    value={editUnitPrice}
                    onChange={e => handleUnitPriceChange(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-bold text-slate-800 text-lg"
                    placeholder="例: 250"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  ※ 単価を入力すると売上総額が自動計算されます
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  売上総額 (精算確定金額)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                    ¥
                  </span>
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
                <p className="text-[11px] text-slate-400 mt-1">
                  ※ 精算書の合計金額を直接入力することも可能です
                </p>
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
