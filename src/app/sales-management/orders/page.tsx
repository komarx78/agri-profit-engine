"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, Plus, Search, Calendar, CheckCircle2, Clock, Truck } from 'lucide-react';
import { getB2BOrders, updateB2BOrderStatus } from '@/app/actions/b2b';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    setLoading(true);
    const res = await getB2BOrders(null);
    if (res.success) {
      setOrders(res.orders);
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

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <Search className="w-5 h-5 text-slate-400" />
        <input 
          type="text" 
          placeholder="顧客名や日付で検索..." 
          className="bg-transparent border-none focus:outline-none text-slate-700 font-bold w-full"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
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
              ) : orders.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-slate-500 font-bold">受注データがありません。</td></tr>
              ) : orders.map((o) => (
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
                          {item.crop?.name} : {item.quantity} {item.unit}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="p-4 text-right font-black text-slate-800">
                    ¥{Number(o.total_amount).toLocaleString()}
                  </td>
                  <td className="p-4 text-center">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
