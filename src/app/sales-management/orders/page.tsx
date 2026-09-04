"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, Plus, Search, Calendar, CheckCircle2, Clock, Truck } from 'lucide-react';
import { getB2BOrders, updateB2BOrderStatus } from '@/app/actions/b2b';
import { getCurrentTenantId } from '@/lib/tenant';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    setLoading(true);
    const tenantId = await getCurrentTenantId();
    const res = await getB2BOrders(tenantId);
    if (res.success) {
      setOrders(res.orders || []);
    }
    setLoading(false);
  }

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    if (!window.confirm(`ステータスを「${newStatus === 'delivered' ? '納品済' : newStatus === 'invoiced' ? '請求済' : '未納品'}」に変更しますか？`)) return;
    const res = await updateB2BOrderStatus(orderId, newStatus);
    if (res.success) {
      loadOrders();
    } else {
      alert("エラーが発生しました: " + res.error);
    }
  };

  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list'|'day'|'week'|'calendar'>('day'); // Default to day now!
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [currentDayOffset, setCurrentDayOffset] = useState(0);

  const filteredOrders = orders.filter(o => {
    // Search filter
    if (search && !o.customer?.name?.includes(search) && !o.delivery_date.includes(search)) {
      return false;
    }
    
    // Date filter (only applied in list view)
    if (viewMode !== 'list') return true;
    if (filter === 'all') return true;
    
    const today = new Date();
    const orderDate = new Date(o.delivery_date);
    
    if (filter === 'day') {
      return orderDate.toDateString() === today.toDateString();
    }
    if (filter === 'week') {
      const diffTime = orderDate.getTime() - today.getTime();
      const diffDays = diffTime / (1000 * 3600 * 24);
      return diffDays >= 0 && diffDays <= 7;
    }
    if (filter === 'month') {
      return orderDate.getMonth() === today.getMonth() && orderDate.getFullYear() === today.getFullYear();
    }
    
    return true;
  });

  // --- Calendar Variables ---
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startingDayOfWeek = new Date(year, month, 1).getDay();

  // --- Week Variables ---
  const getWeekDays = () => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay() + (currentWeekOffset * 7));
    return Array.from({length: 7}).map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  };
  const weekDays = getWeekDays();

  // --- Jump to Day ---
  const jumpToDay = (dateStr: string) => {
    const targetDate = new Date(dateStr);
    const today = new Date();
    targetDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    setCurrentDayOffset(diffDays);
    setViewMode('day');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-emerald-500" />
            受注・納品管理
          </h1>
          <p className="text-sm font-bold text-slate-500 mt-1">システム経由または手動で登録された注文と納品状況を管理します。</p>
        </div>
        <Link 
          href="/sales-management/orders/new"
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
        >
          <Plus className="w-5 h-5" /> 新規受注（手動入力）
        </Link>
      </div>

      <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">
        <div className="flex flex-wrap bg-slate-200 p-1 rounded-xl w-full sm:w-auto gap-1">
          <button onClick={() => setViewMode('list')} className={`flex-1 min-w-[100px] px-3 py-2.5 text-xs sm:text-sm font-black rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>リスト</button>
          <button onClick={() => setViewMode('day')} className={`flex-1 min-w-[100px] px-3 py-2.5 text-xs sm:text-sm font-black rounded-lg transition-all flex items-center justify-center gap-1 ${viewMode === 'day' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-500 hover:text-slate-700'}`}><Calendar className="w-4 h-4"/> 1日予定</button>
          <button onClick={() => setViewMode('week')} className={`flex-1 min-w-[100px] px-3 py-2.5 text-xs sm:text-sm font-black rounded-lg transition-all flex items-center justify-center gap-1 ${viewMode === 'week' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}><Calendar className="w-4 h-4"/> 週間</button>
          <button onClick={() => setViewMode('calendar')} className={`flex-1 min-w-[100px] px-3 py-2.5 text-xs sm:text-sm font-black rounded-lg transition-all flex items-center justify-center gap-1 ${viewMode === 'calendar' ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}><Calendar className="w-4 h-4"/> 月間</button>
        </div>

        {viewMode === 'list' && (
          <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
            <div className="bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-1 w-full sm:w-auto">
              <button onClick={() => setFilter('all')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${filter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>すべて</button>
              <button onClick={() => setFilter('day')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${filter === 'day' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>今日(1日)</button>
              <button onClick={() => setFilter('week')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${filter === 'week' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>1週間</button>
              <button onClick={() => setFilter('month')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${filter === 'month' ? 'bg-amber-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>今月</button>
            </div>
            <div className="bg-white p-2 px-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 w-full sm:w-64">
              <Search className="w-5 h-5 text-slate-400" />
              <input 
                type="text" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="検索..." 
                className="bg-transparent border-none focus:outline-none text-slate-700 font-bold w-full"
              />
            </div>
          </div>
        )}
      </div>

      {viewMode === 'calendar' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex justify-between items-center mb-6">
            <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold rounded-lg transition-colors">&lt; 先月</button>
            <h2 className="text-xl font-black text-slate-800">{year}年 {month + 1}月</h2>
            <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold rounded-lg transition-colors">来月 &gt;</button>
          </div>
          <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden">
            {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
              <div key={day} className={`bg-slate-50 p-2 text-center text-xs sm:text-sm font-black ${i === 0 ? 'text-rose-500' : i === 6 ? 'text-blue-500' : 'text-slate-500'}`}>{day}</div>
            ))}
            {Array.from({ length: startingDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-white p-2 min-h-[100px] sm:min-h-[120px]"></div>
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayOrders = filteredOrders.filter(o => o.delivery_date === dateStr);
              const isToday = new Date().toISOString().split('T')[0] === dateStr;
              
              return (
                <div key={day} className={`bg-white p-1.5 sm:p-2 min-h-[100px] sm:min-h-[120px] flex flex-col gap-1 transition-colors hover:bg-slate-50`}>
                  <button onClick={() => jumpToDay(dateStr)} className="flex justify-center mb-1 w-full hover:bg-slate-100 rounded py-0.5 cursor-pointer transition-colors" title={`${month + 1}月${day}日の1日予定を見る`}>
                    <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-700'}`}>{day}</span>
                  </button>
                  <div className="flex-1 overflow-y-auto max-h-[100px] space-y-1.5 custom-scrollbar pr-1">
                    {dayOrders.map(o => (
                      <Link href={`/sales-management/orders/${o.id}/edit`} key={o.id} className={`block text-[10px] sm:text-xs p-1.5 rounded-md border transition-opacity hover:opacity-80 ${
                        o.status === 'delivered' || o.status === 'invoiced' 
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                          : 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm'
                      }`}>
                        <div className="font-black truncate">{o.customer?.name}</div>
                        <div className="truncate opacity-90 mt-0.5">
                          {o.items?.map((item:any) => `${item.crops?.name || item.crop?.name || '不明'} ${item.quantity}${item.unit}`).join(', ')}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : viewMode === 'week' ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <button onClick={() => setCurrentWeekOffset(prev => prev - 1)} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold rounded-lg transition-colors">&lt; 前週</button>
            <h2 className="text-xl font-black text-slate-800">
              {weekDays[0].getMonth() + 1}月{weekDays[0].getDate()}日 〜 {weekDays[6].getMonth() + 1}月{weekDays[6].getDate()}日
            </h2>
            <button onClick={() => setCurrentWeekOffset(prev => prev + 1)} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold rounded-lg transition-colors">翌週 &gt;</button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {weekDays.map(date => {
              const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
              const dayOrders = filteredOrders.filter(o => o.delivery_date === dateStr);
              const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
              const isToday = date.toDateString() === new Date().toDateString();
              
              return (
                <div key={dateStr} className={`bg-white rounded-2xl border ${isToday ? 'border-indigo-400 shadow-md ring-1 ring-indigo-400' : 'border-slate-200 shadow-sm'} overflow-hidden flex flex-col h-[300px]`}>
                  <button onClick={() => jumpToDay(dateStr)} className={`p-3 border-b ${isToday ? 'bg-indigo-50 border-indigo-100 text-indigo-800' : 'bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100'} flex items-center justify-between sticky top-0 w-full text-left transition-colors cursor-pointer`} title="この日の1日予定を見る">
                    <div className="font-black flex items-center gap-2">
                      <span className="text-lg">{date.getMonth() + 1}/{date.getDate()}</span>
                      <span className="text-sm">({dayOfWeek})</span>
                    </div>
                    {isToday && <span className="text-xs font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full">今日</span>}
                  </button>
                  
                  <div className="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                    {dayOrders.length === 0 ? (
                      <div className="text-sm font-bold text-slate-400 text-center py-8">納品予定なし</div>
                    ) : (
                      dayOrders.map(o => (
                        <Link href={`/sales-management/orders/${o.id}/edit`} key={o.id} className="block group">
                          <div className={`p-3 rounded-xl border transition-all group-hover:shadow-md ${
                            o.status === 'delivered' || o.status === 'invoiced' 
                              ? 'bg-emerald-50 border-emerald-200 opacity-80' 
                              : 'bg-white border-slate-200 shadow-sm'
                          }`}>
                            <div className="font-black text-slate-800 text-sm mb-2 group-hover:text-indigo-600 transition-colors">
                              {o.customer?.name}
                            </div>
                            <div className="space-y-1">
                              {o.items?.map((item:any) => (
                                <div key={item.id} className="flex justify-between items-center text-xs">
                                  <span className="font-bold text-slate-600">{item.crops?.name || item.crop?.name || '不明'}</span>
                                  <span className="font-black text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">{item.quantity}{item.unit}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : viewMode === 'day' ? (
        (() => {
          const currentDay = new Date();
          currentDay.setDate(currentDay.getDate() + currentDayOffset);
          const dateStr = `${currentDay.getFullYear()}-${String(currentDay.getMonth() + 1).padStart(2, '0')}-${String(currentDay.getDate()).padStart(2, '0')}`;
          const dayOrders = filteredOrders.filter(o => o.delivery_date === dateStr);
          const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][currentDay.getDay()];
          
          // Calculate total harvest needed for the day
          const harvestTotals: Record<string, { quantity: number, unit: string }> = {};
          dayOrders.forEach(o => {
            o.items?.forEach((item: any) => {
              const name = item.crops?.name || item.crop?.name || '不明';
              if (!harvestTotals[name]) {
                harvestTotals[name] = { quantity: 0, unit: item.unit };
              }
              harvestTotals[name].quantity += Number(item.quantity);
            });
          });

          return (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <button onClick={() => setCurrentDayOffset(prev => prev - 1)} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold rounded-lg transition-colors">&lt; 前日</button>
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <span className="text-rose-600">{currentDay.getMonth() + 1}月{currentDay.getDate()}日</span>
                  <span className="text-base text-slate-500">({dayOfWeek})</span>
                  {currentDayOffset === 0 && <span className="text-xs bg-rose-500 text-white px-2 py-1 rounded-full ml-2">今日</span>}
                </h2>
                <button onClick={() => setCurrentDayOffset(prev => prev + 1)} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold rounded-lg transition-colors">翌日 &gt;</button>
              </div>

              {dayOrders.length > 0 && (
                <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6 shadow-sm">
                  <h3 className="font-black text-amber-900 mb-4 flex items-center gap-2">
                    <span className="text-xl">📋</span> この日の総出荷（収穫）リスト
                  </h3>
                  <div className="flex flex-wrap gap-4">
                    {Object.entries(harvestTotals).map(([name, data]) => (
                      <div key={name} className="bg-white px-4 py-3 rounded-xl border border-amber-200 shadow-sm flex items-center gap-3">
                        <span className="font-bold text-slate-700">{name}</span>
                        <span className="font-black text-amber-600 text-lg">{data.quantity}{data.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {dayOrders.length === 0 ? (
                  <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
                    <div className="text-5xl mb-4">🌱</div>
                    <div className="text-lg font-bold text-slate-500">この日の納品予定はありません</div>
                  </div>
                ) : (
                  dayOrders.map(o => (
                    <Link href={`/sales-management/orders/${o.id}/edit`} key={o.id} className="block group">
                      <div className={`p-5 rounded-2xl border transition-all group-hover:shadow-md ${
                        o.status === 'delivered' || o.status === 'invoiced' 
                          ? 'bg-slate-50 border-slate-200 opacity-80' 
                          : 'bg-white border-slate-200 shadow-sm'
                      }`}>
                        <div className="flex justify-between items-start mb-4">
                          <div className="font-black text-slate-800 text-xl group-hover:text-rose-600 transition-colors">
                            {o.customer?.name}
                          </div>
                          <div className={`text-xs font-bold px-3 py-1 rounded-full ${
                            o.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                            o.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' :
                            o.status === 'invoiced' ? 'bg-blue-100 text-blue-800' :
                            'bg-slate-100 text-slate-800'
                          }`}>
                            {o.status === 'pending' ? '未納品' : o.status === 'delivered' ? '納品済' : o.status === 'invoiced' ? '請求済' : o.status}
                          </div>
                        </div>
                        
                        <div className="space-y-2 bg-slate-50 rounded-xl p-4 border border-slate-100">
                          {o.items?.map((item:any) => (
                            <div key={item.id} className="flex justify-between items-center text-sm">
                              <span className="font-bold text-slate-700 text-base">{item.crops?.name || item.crop?.name || '不明'}</span>
                              <div className="flex items-center gap-3">
                                <span className="font-black text-slate-800 text-lg bg-white px-3 py-1 rounded border border-slate-200 shadow-sm">{item.quantity}{item.unit}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        <div className="mt-4 flex justify-between items-center text-sm font-bold text-slate-400">
                          <div>注文日: {o.order_date}</div>
                          <div className="text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">修正する &gt;</div>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })()
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-sm">
                  <th className="p-4 font-black text-slate-500">納品予定日 / 顧客名</th>
                  <th className="p-4 font-black text-slate-500">注文内容</th>
                  <th className="p-4 font-black text-slate-500 text-right">金額 (円)</th>
                  <th className="p-4 font-black text-slate-500 text-center">ステータス</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={4} className="p-8 text-center text-slate-500 font-bold">読み込み中...</td></tr>
                ) : filteredOrders.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-slate-500 font-bold">該当する受注データがありません。</td></tr>
                ) : filteredOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="font-bold text-slate-700">{o.delivery_date}</span>
                      </div>
                      <div className="font-black text-slate-800 text-lg">{o.customer?.name}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        {o.items?.map((item: any) => (
                          <div key={item.id} className="text-sm font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded inline-block w-fit">
                            {item.crops?.name || item.crop?.name || '不明'} : {item.quantity} {item.unit}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 text-right font-black text-slate-800">
                      ¥{Number(o.total_amount).toLocaleString()}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex flex-col items-center gap-2">
                      <select
                        value={o.status}
                        onChange={(e) => handleStatusChange(o.id, e.target.value)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-full outline-none cursor-pointer border-2 transition-colors ${
                          o.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          o.status === 'delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          o.status === 'invoiced' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        <option value="pending">未納品 (予定)</option>
                        <option value="delivered">納品済</option>
                        <option value="invoiced">請求済</option>
                      </select>
                      <Link href={`/sales-management/orders/${o.id}/edit`} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline">
                        修正する
                      </Link>
                    </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
