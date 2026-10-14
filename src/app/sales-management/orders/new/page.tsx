"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart,
  ArrowLeft,
  Copy,
  Plus,
  Trash2,
  CheckCircle2,
  MessageSquare,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { getB2BCustomers, getB2BOrders, createB2BOrder, getSalesLogsAndMastersAction } from '@/app/actions/b2b';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '@/lib/tenant';
import { getJSTDate } from '@/lib/dateUtils';

export default function NewOrderPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<any[]>([]);
  const [crops, setCrops] = useState<any[]>([]);
  const [cropDefaultPrices, setCropDefaultPrices] = useState<
    Record<string, { unit_price: number; unit: string }>
  >({});
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(() => getJSTDate());
  const [deliveryNote, setDeliveryNote] = useState('');

  const [items, setItems] = useState<any[]>([
    { crop_id: '', quantity: 1, unit: 'kg', unit_price: 0 }
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tenantId, setTenantId] = useState<string>('');

  useEffect(() => {
    async function load() {
      const tId = await getCurrentTenantId();
      if (!tId) return;
      setTenantId(tId);

      // URLから ?customerId= が渡されていれば初期セット
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const cid = params.get('customerId');
        if (cid) setSelectedCustomerId(cid);
      }

      const [custRes, mastersRes, ordRes] = await Promise.all([
        getB2BCustomers(tId),
        getSalesLogsAndMastersAction(tId),
        getB2BOrders(tId)
      ]);
      if (custRes.success) {
        setCustomers(custRes.customers || []);
        setCropDefaultPrices((custRes as any).cropDefaultPrices || {});
      }
      if (mastersRes.success && mastersRes.crops) {
        setCrops(mastersRes.crops);
      } else {
        const { data: cropData } = await supabase.from('crops').select('*').eq('user_id', tId).order('name');
        if (cropData) setCrops(cropData);
      }
      if (ordRes.success) setRecentOrders(ordRes.orders || []);
    }
    load();
  }, []);

  // 指定した顧客・作目に対する標準の単価と単位を取得
  const resolvePriceAndUnit = (customerId: string, cropId: string) => {
    const cust = customers.find(c => c.id === customerId);
    const crop = crops.find(c => c.id === cropId);
    const cp = cust?.custom_prices?.[cropId];
    const dp = cropDefaultPrices?.[cropId];

    const unit = cp?.unit || dp?.unit || crop?.default_unit || 'kg';
    const unit_price =
      cp?.unit_price !== undefined && Number(cp.unit_price) > 0
        ? Number(cp.unit_price)
        : dp?.unit_price !== undefined && Number(dp.unit_price) > 0
        ? Number(dp.unit_price)
        : Number(crop?.default_unit_price) || 0;

    return { unit, unit_price };
  };

  // 得意先が変更されたとき、既に選択されている野菜の単価もその得意先向けに自動更新
  const handleSelectCustomer = (newCustomerId: string) => {
    setSelectedCustomerId(newCustomerId);
    if (!newCustomerId) return;
    setItems(prev =>
      prev.map(item => {
        if (!item.crop_id) return item;
        const { unit, unit_price } = resolvePriceAndUnit(newCustomerId, item.crop_id);
        return { ...item, unit, unit_price };
      })
    );
  };

  const handleCopyPrevious = () => {
    if (!selectedCustomerId) return;
    const customerOrders = recentOrders
      .filter(o => o.customer_id === selectedCustomerId)
      .sort((a, b) => new Date(b.delivery_date).getTime() - new Date(a.delivery_date).getTime());

    if (customerOrders.length > 0) {
      const lastOrder = customerOrders[0];
      if (lastOrder.items && lastOrder.items.length > 0) {
        const copiedItems = lastOrder.items.map((i: any) => ({
          crop_id: i.crop_id,
          quantity: i.quantity,
          unit: i.unit,
          unit_price: i.unit_price
        }));
        setItems(copiedItems);
        alert(`前回 (${lastOrder.delivery_date}) の注文内容をコピーしました。`);
      }
    } else {
      alert('この得意先の過去の注文データが見つかりません。');
    }
  };

  const handleAddItem = () => {
    setItems([...items, { crop_id: '', quantity: 1, unit: 'kg', unit_price: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    if (field === 'crop_id') {
      const { unit, unit_price } = resolvePriceAndUnit(selectedCustomerId, value);
      newItems[index] = {
        ...newItems[index],
        crop_id: value,
        unit,
        unit_price
      };
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      alert('得意先（お店）を選択してください');
      return;
    }
    for (const item of items) {
      if (!item.crop_id) {
        alert('野菜（作目）を選択していない明細があります');
        return;
      }
    }

    setIsSubmitting(true);

    const currentTid = tenantId || (await getCurrentTenantId());
    const total_amount = calculateTotal();
    const orderData = {
      customer_id: selectedCustomerId,
      order_date: getJSTDate(),
      delivery_date: deliveryDate,
      status: 'pending',
      total_amount,
      user_id: currentTid,
      delivery_note: deliveryNote.trim()
    };

    const formattedItems = items.map(i => ({
      crop_id: i.crop_id,
      quantity: Number(i.quantity),
      unit: i.unit,
      unit_price: Number(i.unit_price),
      total_price: Number(i.quantity) * Number(i.unit_price)
    }));

    const res = await createB2BOrder(orderData, formattedItems, currentTid);
    if (res.success) {
      router.push(currentTid ? `/sales-management/orders?farm=${currentTid}` : '/sales-management/orders');
    } else {
      alert('エラー: ' + res.error);
      setIsSubmitting(false);
    }
  };

  const selectedCustomerObj = customers.find(c => c.id === selectedCustomerId);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Link
          href={tenantId ? `/sales-management/orders?farm=${tenantId}` : '/sales-management/orders'}
          className="p-2 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-emerald-600" />
            <span>新しい注文の登録（電話・LINE・FAX受注）</span>
          </h1>
          <p className="text-xs font-bold text-slate-500 mt-0.5">
            得意先と野菜を選ぶと、設定された卸単価・単位が自動で入ります。
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-3xl shadow-xs border border-slate-200 p-6 sm:p-8 space-y-7"
      >
        {/* 1. 得意先と納品予定日 */}
        <section className="space-y-4">
          <h2 className="text-base font-black text-slate-800 border-b border-slate-100 pb-2">
            1. 得意先（お店）と納品日
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1.5">
                得意先名（お店・出荷先） <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedCustomerId}
                  onChange={e => handleSelectCustomer(e.target.value)}
                  className="flex-1 border border-slate-300 rounded-xl px-3.5 py-2.5 font-bold text-sm focus:outline-none focus:border-emerald-500"
                  required
                >
                  <option value="">お店を選択してください...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}（{c.type || '飲食店'}）
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleCopyPrevious}
                  disabled={!selectedCustomerId}
                  className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3.5 py-2 rounded-xl font-black text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 border border-indigo-200 shrink-0 cursor-pointer"
                  title="このお店の直近の注文内容をそのままコピーします"
                >
                  <Copy className="w-4 h-4" /> 前回と同じ注文
                </button>
              </div>
              {selectedCustomerObj?.notes && (
                <p className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 mt-2">
                  📝 お店メモ: {selectedCustomerObj.notes}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 mb-1.5">
                納品・配達予定日 <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={e => setDeliveryDate(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 font-bold text-sm focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
          </div>
        </section>

        {/* 2. 注文する野菜と数量・単価 */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-base font-black text-slate-800">2. 注文する野菜・数量・単価</h2>
            <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> 野菜を選ぶと単価・単位が自動セットされます
            </span>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={index}
                className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-slate-50 p-4 rounded-2xl border border-slate-200"
              >
                <div className="w-full sm:w-2/5">
                  <label className="block text-[11px] font-black text-slate-500 mb-1">野菜（作目）</label>
                  <select
                    value={item.crop_id}
                    onChange={e => handleItemChange(index, 'crop_id', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-sm focus:outline-none focus:border-emerald-500"
                    required
                  >
                    <option value="">野菜を選択...</option>
                    {crops.map(c => (
                      <option key={c.id} value={c.id}>
                        🌱 {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                  <div className="w-1/2 sm:w-24">
                    <label className="block text-[11px] font-black text-slate-500 mb-1">数量</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={item.quantity}
                      onChange={e => handleItemChange(index, 'quantity', e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-black text-sm focus:outline-none text-right"
                      required
                    />
                  </div>
                  <div className="w-1/2 sm:w-20">
                    <label className="block text-[11px] font-black text-slate-500 mb-1">単位</label>
                    <input
                      type="text"
                      value={item.unit}
                      onChange={e => handleItemChange(index, 'unit', e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2 py-2 font-bold text-sm focus:outline-none text-center"
                    />
                  </div>
                </div>

                <div className="flex gap-2 items-end w-full sm:w-auto ml-auto">
                  <div className="flex-1 sm:w-32">
                    <label className="block text-[11px] font-black text-slate-500 mb-1">
                      1{item.unit || '単位'}あたりの単価
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 font-bold text-xs">¥</span>
                      <input
                        type="number"
                        min="0"
                        value={item.unit_price}
                        onChange={e => handleItemChange(index, 'unit_price', e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-black text-sm focus:outline-none text-right"
                        placeholder="単価"
                      />
                    </div>
                  </div>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      title="この行を削除"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddItem}
            className="w-full py-3 border-2 border-dashed border-slate-300 hover:border-emerald-500 text-slate-600 hover:text-emerald-600 font-black rounded-2xl transition-colors flex items-center justify-center gap-2 text-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" /> ＋ 別の野菜を追加する
          </button>
        </section>

        {/* 3. 配達メモ */}
        <section className="space-y-2">
          <label className="block text-xs font-black text-slate-700 flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-slate-500" />
            <span>3. 配達時間や荷造りのメモ（任意）</span>
          </label>
          <input
            type="text"
            value={deliveryNote}
            onChange={e => setDeliveryNote(e.target.value)}
            placeholder="例: 午前10時納品 / 箱を2つに分けて詰める など"
            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800"
          />
        </section>

        {/* 合計と送信 */}
        <section className="border-t border-slate-200 pt-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-slate-500 block">注文合計金額 (税抜)</span>
            <span className="text-3xl font-black text-slate-800">
              ¥{calculateTotal().toLocaleString()}
            </span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 text-base disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle2 className="w-5 h-5" />
            {isSubmitting ? '登録中...' : 'この内容で注文を登録する'}
          </button>
        </section>
      </form>
    </div>
  );
}
