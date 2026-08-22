"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Truck, Calendar, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getB2BOrders } from '@/app/actions/b2b';

export default function SalesManagementDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await getB2BOrders(null);
      if (res.success) {
        setOrders(res.orders);
      }
      setLoading(false);
    }
    load();
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const todaysOrders = orders.filter(o => o.delivery_date === todayStr);
  const tomorrowsOrders = orders.filter(o => o.delivery_date === tomorrowStr);
  const pendingOrders = orders.filter(o => o.status === 'pending');

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">販売管理ダッシュボード</h1>
        <p className="text-sm font-bold text-slate-500 mt-1">受注状況と納品スケジュールを確認できます。</p>
      </div>

      {/* 概要カード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-black text-slate-400 uppercase">本日の納品予定</span>
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <Truck className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-black text-slate-800">{todaysOrders.length}</span>
            <span className="text-sm font-bold text-slate-500 mb-1">件</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-black text-slate-400 uppercase">明日の納品予定</span>
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-black text-slate-800">{tomorrowsOrders.length}</span>
            <span className="text-sm font-bold text-slate-500 mb-1">件</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-black text-slate-400 uppercase">未処理（未納品）</span>
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-black text-slate-800">{pendingOrders.length}</span>
            <span className="text-sm font-bold text-slate-500 mb-1">件</span>
          </div>
        </div>
      </div>

      {/* スケジュール可視化 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-black text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-500" /> 直近の納品スケジュール
          </h2>
          <Link href="/sales-management/orders" className="text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
            すべて見る <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        
        <div className="p-0">
          {loading ? (
            <div className="p-8 text-center text-slate-500 font-bold">読み込み中...</div>
          ) : pendingOrders.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-bold">直近の納品予定はありません。</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingOrders.slice(0, 5).map(order => (
                <div key={order.id} className="p-4 sm:px-6 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                        order.delivery_date === todayStr ? 'bg-rose-100 text-rose-700' :
                        order.delivery_date === tomorrowStr ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {order.delivery_date === todayStr ? '今日' : order.delivery_date === tomorrowStr ? '明日' : order.delivery_date}
                      </span>
                      <span className="font-black text-slate-800 text-lg">{order.customer?.name}</span>
                    </div>
                    <div className="text-sm font-bold text-slate-500 flex items-center gap-2">
                      {order.items?.map((item: any) => (
                        <span key={item.id} className="bg-slate-100 px-2 py-0.5 rounded">
                          {item.crop?.name} {item.quantity}{item.unit}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black text-slate-800">¥{Number(order.total_amount).toLocaleString()}</span>
                    <button className="text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition-colors">
                      詳細
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
