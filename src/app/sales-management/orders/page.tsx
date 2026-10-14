"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShoppingCart,
  Plus,
  Search,
  Calendar,
  CheckCircle2,
  Printer,
  Edit2,
  Phone,
  MapPin,
  MessageSquare,
  X,
  FileText
} from 'lucide-react';
import { getB2BOrders, updateB2BOrderStatus } from '@/app/actions/b2b';
import { getCurrentTenantId } from '@/lib/tenant';
import { getJSTDate } from '@/lib/dateUtils';
import { useCompany } from '@/hooks/useCompany';

export default function OrdersPage() {
  const [tenantId, setTenantId] = useState<string>('');
  const { companyName } = useCompany(tenantId);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // 納品書印刷プレビュー対象オーダー
  const [deliverySlipOrder, setDeliverySlipOrder] = useState<any | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(prev => (prev === msg ? null : prev));
    }, 3500);
  };

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    setLoading(true);
    const tid = await getCurrentTenantId();
    if (tid) setTenantId(tid);
    const res = await getB2BOrders(tid);
    if (res.success) {
      setOrders(res.orders || []);
    }
    setLoading(false);
  }

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    const label =
      newStatus === 'delivered' ? '納品済' : newStatus === 'invoiced' ? '請求済' : '未納品（手配中）';
    const currentTid = tenantId || (await getCurrentTenantId());

    // 楽観的UI更新
    setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, status: newStatus } : o)));

    const res = await updateB2BOrderStatus(orderId, newStatus, currentTid);
    if (res.success) {
      showToast(`状態を「${label}」に更新しました！`);
    } else {
      alert('エラーが発生しました: ' + res.error);
      loadOrders();
    }
  };

  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'day' | 'week' | 'calendar'>('day');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [currentDayOffset, setCurrentDayOffset] = useState(0);

  const filteredOrders = orders.filter(o => {
    if (search && !o.customer?.name?.includes(search) && !o.delivery_date?.includes(search)) {
      return false;
    }

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
      return (
        orderDate.getMonth() === today.getMonth() &&
        orderDate.getFullYear() === today.getFullYear()
      );
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
    start.setDate(today.getDate() - today.getDay() + currentWeekOffset * 7);
    return Array.from({ length: 7 }).map((_, i) => {
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

  const newOrderHref = tenantId
    ? `/sales-management/orders/new?farm=${tenantId}`
    : '/sales-management/orders/new';

  return (
    <div className="space-y-6 animate-in fade-in duration-300 relative">
      {/* トースト通知 */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-700 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-sm font-black print:hidden">
          <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 1. ヘッダー（納品書印刷時は非表示） */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${deliverySlipOrder ? 'print:hidden' : ''}`}>
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-emerald-600" />
            <span>注文・配達の管理（収穫・荷造り表）</span>
          </h1>
          <p className="text-xs sm:text-sm font-bold text-slate-500 mt-1">
            得意先からの注文内容と、「その日に畑から収穫・荷造りする合計量」を確認し、ワンクリックで納品書印刷や納品済チェックができます。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={() => {
              setDeliverySlipOrder(null);
              setTimeout(() => window.print(), 50);
            }}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-black py-2.5 px-4 rounded-xl transition-colors flex items-center gap-1.5 text-xs shadow-2xs cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>この画面（収穫・配達表）を印刷</span>
          </button>

          <Link
            href={newOrderHref}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 px-5 rounded-xl transition-colors flex items-center justify-center gap-2 text-xs sm:text-sm shadow-sm"
          >
            <Plus className="w-5 h-5" /> ＋ 新しい注文を入力
          </Link>
        </div>
      </div>

      {/* 2. 表示モード切替バー */}
      <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center print:hidden">
        <div className="flex flex-wrap bg-slate-200 p-1 rounded-xl w-full sm:w-auto gap-1">
          <button
            type="button"
            onClick={() => setViewMode('day')}
            className={`flex-1 min-w-[110px] px-3.5 py-2.5 text-xs sm:text-sm font-black rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              viewMode === 'day'
                ? 'bg-white shadow-xs text-rose-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-4 h-4" /> 1日の収穫・配達表
          </button>
          <button
            type="button"
            onClick={() => setViewMode('week')}
            className={`flex-1 min-w-[100px] px-3.5 py-2.5 text-xs sm:text-sm font-black rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              viewMode === 'week'
                ? 'bg-white shadow-xs text-indigo-700'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-4 h-4" /> 週間予定
          </button>
          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            className={`flex-1 min-w-[100px] px-3.5 py-2.5 text-xs sm:text-sm font-black rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              viewMode === 'calendar'
                ? 'bg-white shadow-xs text-emerald-700'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-4 h-4" /> 月間カレンダー
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`flex-1 min-w-[100px] px-3.5 py-2.5 text-xs sm:text-sm font-black rounded-lg transition-all cursor-pointer ${
              viewMode === 'list'
                ? 'bg-white shadow-xs text-slate-800'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📋 全件リスト
          </button>
        </div>

        {viewMode === 'list' && (
          <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
            <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-xs flex items-center gap-1 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-3.5 py-2 text-xs font-black rounded-lg transition-colors cursor-pointer ${
                  filter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                すべて
              </button>
              <button
                type="button"
                onClick={() => setFilter('day')}
                className={`px-3.5 py-2 text-xs font-black rounded-lg transition-colors cursor-pointer ${
                  filter === 'day' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                今日
              </button>
              <button
                type="button"
                onClick={() => setFilter('week')}
                className={`px-3.5 py-2 text-xs font-black rounded-lg transition-colors cursor-pointer ${
                  filter === 'week' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                今後1週間
              </button>
              <button
                type="button"
                onClick={() => setFilter('month')}
                className={`px-3.5 py-2 text-xs font-black rounded-lg transition-colors cursor-pointer ${
                  filter === 'month' ? 'bg-amber-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                今月
              </button>
            </div>
            <div className="bg-white p-2 px-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-2.5 w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="お店の名前・日付で検索..."
                className="bg-transparent border-none focus:outline-none text-slate-700 font-bold text-xs w-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. メイン領域（納品書モーダル表示中の印刷時は隠す） */}
      <div className={deliverySlipOrder ? 'print:hidden' : ''}>
        {viewMode === 'calendar' ? (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-4 sm:p-6">
            <div className="flex justify-between items-center mb-6">
              <button
                type="button"
                onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
                className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold rounded-xl transition-colors cursor-pointer"
              >
                &lt; 先月
              </button>
              <h2 className="text-xl font-black text-slate-800">
                {year}年 {month + 1}月
              </h2>
              <button
                type="button"
                onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
                className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold rounded-xl transition-colors cursor-pointer"
              >
                来月 &gt;
              </button>
            </div>
            <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-2xl overflow-hidden">
              {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
                <div
                  key={day}
                  className={`bg-slate-50 p-2 text-center text-xs sm:text-sm font-black ${
                    i === 0 ? 'text-rose-500' : i === 6 ? 'text-blue-500' : 'text-slate-500'
                  }`}
                >
                  {day}
                </div>
              ))}
              {Array.from({ length: startingDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-white p-2 min-h-[100px] sm:min-h-[120px]"></div>
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayOrders = filteredOrders.filter(o => o.delivery_date === dateStr);
                const isToday = getJSTDate() === dateStr;

                return (
                  <div
                    key={day}
                    className="bg-white p-1.5 sm:p-2 min-h-[100px] sm:min-h-[120px] flex flex-col gap-1 transition-colors hover:bg-slate-50"
                  >
                    <button
                      type="button"
                      onClick={() => jumpToDay(dateStr)}
                      className="flex justify-center mb-1 w-full hover:bg-slate-100 rounded py-0.5 cursor-pointer transition-colors"
                      title={`${month + 1}月${day}日の1日予定を見る`}
                    >
                      <span
                        className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                          isToday ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-700'
                        }`}
                      >
                        {day}
                      </span>
                    </button>
                    <div className="flex-1 overflow-y-auto max-h-[100px] space-y-1.5 pr-1">
                      {dayOrders.map(o => {
                        const editHref = tenantId
                          ? `/sales-management/orders/${o.id}/edit?farm=${tenantId}`
                          : `/sales-management/orders/${o.id}/edit`;
                        return (
                          <Link
                            href={editHref}
                            key={o.id}
                            className={`block text-[10px] sm:text-xs p-1.5 rounded-lg border transition-opacity hover:opacity-80 ${
                              o.status === 'delivered' || o.status === 'invoiced'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-2xs'
                            }`}
                          >
                            <div className="font-black truncate">{o.customer?.name}</div>
                            <div className="truncate opacity-90 mt-0.5">
                              {o.items
                                ?.map(
                                  (item: any) =>
                                    `${item.crops?.name || item.crop?.name || '不明'} ${item.quantity}${item.unit}`
                                )
                                .join(', ')}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : viewMode === 'week' ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <button
                type="button"
                onClick={() => setCurrentWeekOffset(prev => prev - 1)}
                className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold rounded-xl transition-colors cursor-pointer"
              >
                &lt; 前週
              </button>
              <h2 className="text-xl font-black text-slate-800">
                {weekDays[0].getMonth() + 1}月{weekDays[0].getDate()}日 〜 {weekDays[6].getMonth() + 1}月
                {weekDays[6].getDate()}日
              </h2>
              <button
                type="button"
                onClick={() => setCurrentWeekOffset(prev => prev + 1)}
                className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold rounded-xl transition-colors cursor-pointer"
              >
                翌週 &gt;
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {weekDays.map(date => {
                const dateStr = getJSTDate(date);
                const dayOrders = filteredOrders.filter(o => o.delivery_date === dateStr);
                const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
                const isToday = getJSTDate(date) === getJSTDate();

                return (
                  <div
                    key={dateStr}
                    className={`bg-white rounded-3xl border ${
                      isToday ? 'border-indigo-400 shadow-md ring-1 ring-indigo-400' : 'border-slate-200 shadow-xs'
                    } overflow-hidden flex flex-col h-[320px]`}
                  >
                    <button
                      type="button"
                      onClick={() => jumpToDay(dateStr)}
                      className={`p-3.5 border-b ${
                        isToday
                          ? 'bg-indigo-50 border-indigo-100 text-indigo-800'
                          : 'bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100'
                      } flex items-center justify-between sticky top-0 w-full text-left transition-colors cursor-pointer`}
                      title="この日の1日予定を見る"
                    >
                      <div className="font-black flex items-center gap-2">
                        <span className="text-lg">
                          {date.getMonth() + 1}/{date.getDate()}
                        </span>
                        <span className="text-sm">({dayOfWeek})</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {dayOrders.length > 0 && (
                          <span className="text-xs font-black bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded-lg">
                            {dayOrders.length}件
                          </span>
                        )}
                        {isToday && (
                          <span className="text-xs font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                            今日
                          </span>
                        )}
                      </div>
                    </button>

                    <div className="p-3 flex-1 overflow-y-auto space-y-2.5">
                      {dayOrders.length === 0 ? (
                        <div className="text-xs font-bold text-slate-400 text-center py-10">納品予定なし</div>
                      ) : (
                        dayOrders.map(o => (
                          <div
                            key={o.id}
                            onClick={() => jumpToDay(dateStr)}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer hover:shadow-xs ${
                              o.status === 'delivered' || o.status === 'invoiced'
                                ? 'bg-emerald-50/70 border-emerald-200'
                                : 'bg-white border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-black text-slate-800 text-sm truncate">
                                {o.customer?.name}
                              </span>
                              <span
                                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                  o.status === 'delivered' || o.status === 'invoiced'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {o.status === 'delivered' || o.status === 'invoiced' ? '納品済' : '未納品'}
                              </span>
                            </div>
                            <div className="space-y-1">
                              {o.items?.map((item: any) => (
                                <div key={item.id} className="flex justify-between items-center text-xs">
                                  <span className="font-bold text-slate-600">
                                    🌱 {item.crops?.name || item.crop?.name || '不明'}
                                  </span>
                                  <span className="font-black text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">
                                    {item.quantity}
                                    {item.unit}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
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

            // 野菜ごとの総収穫・荷造り（ピッキング）合計 ＋ お店別内訳を計算
            const harvestTotals: Record<
              string,
              {
                cropName: string;
                unit: string;
                totalQty: number;
                breakdown: Array<{ customerName: string; qty: number }>;
              }
            > = {};

            dayOrders.forEach(o => {
              const custName = o.customer?.name || '得意先';
              o.items?.forEach((item: any) => {
                const name = item.crops?.name || item.crop?.name || '不明';
                const unit = item.unit || 'kg';
                const key = `${name}__${unit}`;
                if (!harvestTotals[key]) {
                  harvestTotals[key] = { cropName: name, unit, totalQty: 0, breakdown: [] };
                }
                const q = Number(item.quantity) || 0;
                harvestTotals[key].totalQty = Math.round((harvestTotals[key].totalQty + q) * 10) / 10;
                harvestTotals[key].breakdown.push({ customerName: custName, qty: q });
              });
            });

            return (
              <div className="space-y-5">
                {/* 日付移動バー */}
                <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-xs gap-2">
                  <div className="flex items-center gap-2 print:hidden">
                    <button
                      type="button"
                      onClick={() => setCurrentDayOffset(prev => prev - 1)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
                    >
                      &lt; 前日
                    </button>
                    {currentDayOffset !== 0 && (
                      <button
                        type="button"
                        onClick={() => setCurrentDayOffset(0)}
                        className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-black rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        今日に戻る
                      </button>
                    )}
                  </div>

                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
                    <span className="text-rose-600">
                      {currentDay.getMonth() + 1}月{currentDay.getDate()}日
                    </span>
                    <span className="text-base text-slate-500">({dayOfWeek}) の収穫・配達リスト</span>
                    {currentDayOffset === 0 && (
                      <span className="text-xs bg-rose-600 text-white px-2.5 py-0.5 rounded-full">今日</span>
                    )}
                    {currentDayOffset === 1 && (
                      <span className="text-xs bg-indigo-600 text-white px-2.5 py-0.5 rounded-full">明日</span>
                    )}
                  </h2>

                  <button
                    type="button"
                    onClick={() => setCurrentDayOffset(prev => prev + 1)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl text-xs sm:text-sm transition-colors cursor-pointer print:hidden"
                  >
                    翌日 &gt;
                  </button>
                </div>

                {/* 🌾 この日の収穫・荷造り（ピッキング）合計表（お店ごとの内訳付き！） */}
                {dayOrders.length > 0 && (
                  <div className="bg-amber-50/90 rounded-3xl border-2 border-amber-200 p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-black text-amber-950 text-base flex items-center gap-2">
                        <span className="text-xl">🌾</span>
                        <span>① 畑から収穫・荷造りする野菜の合計（全{dayOrders.length}件のお店分）</span>
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Object.values(harvestTotals).map((h, idx) => (
                        <div
                          key={idx}
                          className="bg-white p-3.5 rounded-2xl border border-amber-200 shadow-2xs flex flex-col justify-between gap-2"
                        >
                          <div className="flex items-baseline justify-between border-b border-slate-100 pb-2">
                            <span className="font-black text-slate-900 text-base">🌱 {h.cropName}</span>
                            <span className="font-black text-amber-600 text-xl">
                              合計 {h.totalQty}{' '}
                              <span className="text-xs font-bold text-slate-600">{h.unit}</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {h.breakdown.map((b, bIdx) => (
                              <span
                                key={bIdx}
                                className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-bold"
                              >
                                {b.customerName}: <strong>{b.qty}{h.unit}</strong>
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 🚚 この日の配達・納品カード一覧（その場で納品済チェック＆納品書印刷OK！） */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {dayOrders.length === 0 ? (
                    <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs space-y-3">
                      <div className="text-4xl">🌱</div>
                      <div className="text-base font-black text-slate-700">
                        この日の注文・配達予定はありません
                      </div>
                      <Link
                        href={newOrderHref}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black print:hidden"
                      >
                        <Plus className="w-4 h-4" /> ＋ 注文を登録する
                      </Link>
                    </div>
                  ) : (
                    dayOrders.map(o => {
                      const isDelivered = o.status === 'delivered' || o.status === 'invoiced';
                      const editHref = tenantId
                        ? `/sales-management/orders/${o.id}/edit?farm=${tenantId}`
                        : `/sales-management/orders/${o.id}/edit`;

                      return (
                        <div
                          key={o.id}
                          className={`p-5 rounded-3xl border-2 transition-all flex flex-col justify-between gap-4 ${
                            isDelivered
                              ? 'bg-emerald-50/20 border-emerald-200'
                              : 'bg-white border-slate-200 shadow-xs'
                          }`}
                        >
                          <div className="space-y-3">
                            {/* お店名・連絡先・状態 */}
                            <div className="flex justify-between items-start gap-2">
                              <div className="space-y-1">
                                <div className="font-black text-slate-900 text-lg sm:text-xl flex items-center gap-2 flex-wrap">
                                  <span>🏪 {o.customer?.name}</span>
                                  {o.customer?.type && (
                                    <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">
                                      {o.customer.type}
                                    </span>
                                  )}
                                </div>

                                {/* 電話番号・住所・メモ */}
                                <div className="flex items-center gap-3 flex-wrap text-xs font-bold text-slate-500">
                                  {o.customer?.phone && (
                                    <span className="inline-flex items-center gap-1">
                                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                                      {o.customer.phone}
                                    </span>
                                  )}
                                  {o.customer?.address && (
                                    <span className="inline-flex items-center gap-1">
                                      <MapPin className="w-3.5 h-3.5 text-rose-500" />
                                      {o.customer.address}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <span
                                className={`text-xs font-black px-3 py-1 rounded-full shrink-0 ${
                                  o.status === 'pending'
                                    ? 'bg-amber-100 text-amber-800'
                                    : o.status === 'delivered'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {o.status === 'pending'
                                  ? '未納品（配達前）'
                                  : o.status === 'delivered'
                                  ? '✓ 納品済'
                                  : '🧾 請求書発行済'}
                              </span>
                            </div>

                            {/* 配達希望メモ */}
                            {(o.delivery_note || o.customer?.notes) && (
                              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-900 flex items-start gap-1.5">
                                <MessageSquare className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                  {o.delivery_note && <div>注文メモ: {o.delivery_note}</div>}
                                  {o.customer?.notes && <div>お店メモ: {o.customer.notes}</div>}
                                </div>
                              </div>
                            )}

                            {/* 注文商品の明細 */}
                            <div className="space-y-2 bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80">
                              {o.items?.map((item: any) => (
                                <div key={item.id} className="flex justify-between items-center text-sm">
                                  <span className="font-black text-slate-800">
                                    🌱 {item.crops?.name || item.crop?.name || '不明'}
                                  </span>
                                  <div className="flex items-center gap-2.5">
                                    {Number(item.unit_price) > 0 && (
                                      <span className="text-xs font-bold text-slate-400">
                                        @¥{Number(item.unit_price).toLocaleString()}
                                      </span>
                                    )}
                                    <span className="font-black text-slate-900 text-base bg-white px-3 py-1 rounded-xl border border-slate-200 shadow-2xs">
                                      {item.quantity} {item.unit}
                                    </span>
                                  </div>
                                </div>
                              ))}
                              <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs font-black text-slate-700">
                                <span>合計金額（税抜）</span>
                                <span className="text-base text-emerald-700">
                                  ¥{Number(o.total_amount || 0).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* カード下部：ワンクリックアクション（納品済にする / 納品書を印刷 / 修正） */}
                          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 print:hidden">
                            <div className="flex items-center gap-2">
                              {o.status !== 'invoiced' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleStatusChange(
                                      o.id,
                                      o.status === 'delivered' ? 'pending' : 'delivered'
                                    )
                                  }
                                  className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                                    o.status === 'delivered'
                                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                  }`}
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span>
                                    {o.status === 'delivered' ? '未納品に戻す' : '✓ 納品済にする'}
                                  </span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setDeliverySlipOrder(o)}
                                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>納品書を印刷</span>
                              </button>
                            </div>

                            <Link
                              href={editHref}
                              className="px-3 py-2 text-xs font-black text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl flex items-center gap-1 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>数量・単価を修正</span>
                            </Link>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })()
        ) : (
          /* リスト表示モード */
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-black text-slate-500">
                    <th className="p-4">納品予定日 / 得意先名</th>
                    <th className="p-4">注文内容（野菜・数量）</th>
                    <th className="p-4 text-right">金額 (税抜)</th>
                    <th className="p-4 text-center">納品状態・納品書</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500 font-bold">
                        読み込み中...
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500 font-bold">
                        該当する注文データがありません。
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map(o => {
                      const editHref = tenantId
                        ? `/sales-management/orders/${o.id}/edit?farm=${tenantId}`
                        : `/sales-management/orders/${o.id}/edit`;

                      return (
                        <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-2 mb-1">
                              <Calendar className="w-4 h-4 text-slate-400" />
                              <span className="font-bold text-slate-700 text-sm">{o.delivery_date}</span>
                            </div>
                            <div className="font-black text-slate-800 text-base">{o.customer?.name}</div>
                            {o.delivery_note && (
                              <div className="text-xs font-bold text-amber-700 mt-1">
                                📝 {o.delivery_note}
                              </div>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1.5">
                              {o.items?.map((item: any) => (
                                <div
                                  key={item.id}
                                  className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg"
                                >
                                  🌱 {item.crops?.name || item.crop?.name || '不明'}:{' '}
                                  <strong>
                                    {item.quantity} {item.unit}
                                  </strong>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="p-4 text-right font-black text-slate-800 text-base">
                            ¥{Number(o.total_amount || 0).toLocaleString()}
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex flex-wrap items-center justify-center gap-2">
                              <select
                                value={o.status}
                                onChange={e => handleStatusChange(o.id, e.target.value)}
                                className={`text-xs font-black px-3 py-1.5 rounded-xl outline-none cursor-pointer border transition-colors ${
                                  o.status === 'pending'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : o.status === 'delivered'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-blue-50 text-blue-800 border-blue-200'
                                }`}
                              >
                                <option value="pending">未納品 (予定)</option>
                                <option value="delivered">✓ 納品済</option>
                                <option value="invoiced">🧾 請求済</option>
                              </select>

                              <button
                                type="button"
                                onClick={() => setDeliverySlipOrder(o)}
                                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" /> 納品書
                              </button>

                              <Link
                                href={editHref}
                                className="px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:text-indigo-700 underline"
                              >
                                修正
                              </Link>
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
        )}
      </div>

      {/* 4. 🖨️ 納品書（兼 受領書）表示・A4印刷モーダル */}
      {deliverySlipOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 print:static print:bg-white print:p-0">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 print:shadow-none print:border-none print:rounded-none">
            {/* モーダル上部操作バー（印刷時は非表示） */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 print:hidden">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <span className="font-black text-slate-800">納品書のプレビュー・印刷</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>A4で印刷する</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeliverySlipOrder(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 納品書本体 */}
            <div className="space-y-6 text-slate-900">
              <div className="text-center border-b-2 border-slate-800 pb-3">
                <h2 className="text-2xl font-black tracking-widest">納 品 書</h2>
                <p className="text-xs font-bold text-slate-500 mt-1">
                  納品日: {deliverySlipOrder.delivery_date}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div>
                  <div className="text-xl font-black border-b border-slate-400 pb-1 inline-block pr-8">
                    {deliverySlipOrder.customer?.name} 御中
                  </div>
                  {deliverySlipOrder.customer?.address && (
                    <div className="text-xs font-bold text-slate-600 mt-1.5">
                      納品先: {deliverySlipOrder.customer.address}
                    </div>
                  )}
                  <p className="text-xs font-bold text-slate-600 mt-2">
                    下記の通り納品いたしましたのでご確認くださいますようお願い申し上げます。
                  </p>
                </div>

                <div className="text-right text-xs font-bold space-y-0.5">
                  <div className="text-base font-black text-slate-900">
                    {companyName || '当農園'}
                  </div>
                  <div className="text-slate-500">発行日: {getJSTDate()}</div>
                </div>
              </div>

              <table className="w-full text-sm border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-xs font-black">
                    <th className="p-2.5 border-r border-slate-300 text-left">品名（作目）</th>
                    <th className="p-2.5 border-r border-slate-300 text-right">数量</th>
                    <th className="p-2.5 border-r border-slate-300 text-right">単価（税抜）</th>
                    <th className="p-2.5 text-right">金額（税抜）</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {deliverySlipOrder.items?.map((item: any, idx: number) => {
                    const sub = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
                    return (
                      <tr key={idx}>
                        <td className="p-2.5 border-r border-slate-300 font-bold">
                          {item.crops?.name || item.crop?.name || '農産物'}
                        </td>
                        <td className="p-2.5 border-r border-slate-300 text-right font-bold">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="p-2.5 border-r border-slate-300 text-right">
                          {Number(item.unit_price) > 0
                            ? `¥${Number(item.unit_price).toLocaleString()}`
                            : '-'}
                        </td>
                        <td className="p-2.5 text-right font-black">
                          {sub > 0 ? `¥${sub.toLocaleString()}` : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  {(() => {
                    const subtotal = Number(deliverySlipOrder.total_amount) || 0;
                    const tax = Math.floor(subtotal * 0.08);
                    const grandTotal = subtotal + tax;
                    return (
                      <>
                        <tr className="border-t-2 border-slate-400 bg-slate-50 text-xs font-bold">
                          <td colSpan={3} className="p-2 text-right border-r border-slate-300">
                            小計（税抜）
                          </td>
                          <td className="p-2 text-right">¥{subtotal.toLocaleString()}</td>
                        </tr>
                        <tr className="bg-slate-50 text-xs font-bold border-t border-slate-300">
                          <td colSpan={3} className="p-2 text-right border-r border-slate-300">
                            消費税（軽減税率 8%）
                          </td>
                          <td className="p-2 text-right">¥{tax.toLocaleString()}</td>
                        </tr>
                        <tr className="bg-slate-100 text-sm font-black border-t border-slate-400">
                          <td colSpan={3} className="p-2.5 text-right border-r border-slate-300">
                            合計金額（税込）
                          </td>
                          <td className="p-2.5 text-right text-base">
                            ¥{grandTotal.toLocaleString()}
                          </td>
                        </tr>
                      </>
                    );
                  })()}
                </tfoot>
              </table>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="border border-slate-300 rounded-xl p-3 text-xs text-slate-600 min-h-[64px]">
                  <div className="font-black text-slate-700 mb-1">備考・連絡事項:</div>
                  <div>{deliverySlipOrder.delivery_note || ''}</div>
                </div>
                <div className="border border-slate-300 rounded-xl p-3 text-xs text-slate-600 flex items-end justify-between min-h-[64px]">
                  <span className="font-black text-slate-700 self-start">受領サイン・印:</span>
                  <span className="text-slate-400">年　　月　　日</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
