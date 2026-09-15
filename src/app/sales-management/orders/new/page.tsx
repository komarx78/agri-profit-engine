"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, ArrowLeft, Copy, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { getB2BCustomers, getB2BOrders, createB2BOrder } from '@/app/actions/b2b';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '@/lib/tenant';
import { getJSTDate } from '@/lib/dateUtils';

export default function NewOrderPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<any[]>([]);
  const [crops, setCrops] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(() => getJSTDate());
  
  const [items, setItems] = useState<any[]>([
    { crop_id: '', quantity: 1, unit: 'kg', unit_price: 0 }
  ]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) return;

      const [custRes, cropRes, ordRes] = await Promise.all([
        getB2BCustomers(tenantId),
        supabase.from('crops').select('*').eq('user_id', tenantId),
        getB2BOrders(tenantId)
      ]);
      if (custRes.success) setCustomers(custRes.customers || []);
      if (cropRes.data) setCrops(cropRes.data);
      if (ordRes.success) setRecentOrders(ordRes.orders || []);
    }
    load();
  }, []);

  const handleCopyPrevious = () => {
    if (!selectedCustomerId) return;
    // Find the most recent order for this customer
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
      alert("この顧客の過去の注文データが見つかりません。");
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
    newItems[index][field] = value;
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unit_price)), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      alert("顧客を選択してください");
      return;
    }
    // Validation
    for (const item of items) {
      if (!item.crop_id) {
        alert("作目を選択していない明細があります");
        return;
      }
    }

    setIsSubmitting(true);
    
    const tenantId = await getCurrentTenantId();
    const total_amount = calculateTotal();
    const orderData = {
      customer_id: selectedCustomerId,
      order_date: getJSTDate(),
      delivery_date: deliveryDate,
      status: 'pending',
      total_amount,
      user_id: tenantId
    };
    
    const formattedItems = items.map(i => ({
      crop_id: i.crop_id,
      quantity: Number(i.quantity),
      unit: i.unit,
      unit_price: Number(i.unit_price),
      total_price: Number(i.quantity) * Number(i.unit_price)
    }));

    const res = await createB2BOrder(orderData, formattedItems, tenantId);
    if (res.success) {
      alert("新規受注を登録しました。");
      router.push('/sales-management/orders');
    } else {
      alert("エラー: " + res.error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/sales-management/orders" className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-emerald-500" />
            新規受注入力
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-8">
        
        {/* 基本情報 */}
        <section className="space-y-4">
          <h2 className="text-lg font-black text-slate-800 border-b border-slate-100 pb-2">1. 顧客と納品日</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">顧客名 (取引先)</label>
              <div className="flex gap-2">
                <select 
                  value={selectedCustomerId}
                  onChange={e => setSelectedCustomerId(e.target.value)}
                  className="flex-1 border border-slate-300 rounded-xl px-4 py-3 font-bold focus:outline-none focus:border-emerald-500"
                  required
                >
                  <option value="">選択してください</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleCopyPrevious}
                  disabled={!selectedCustomerId}
                  className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2 disabled:opacity-50 border border-indigo-200"
                  title="この顧客の前回の注文内容をコピーします"
                >
                  <Copy className="w-4 h-4" /> 前回コピー
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">納品・配達予定日</label>
              <input 
                type="date"
                value={deliveryDate}
                onChange={e => setDeliveryDate(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 font-bold focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
          </div>
        </section>

        {/* 注文明細 */}
        <section className="space-y-4">
          <h2 className="text-lg font-black text-slate-800 border-b border-slate-100 pb-2">2. 注文明細</h2>
          
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="w-full sm:w-1/3">
                  <label className="block sm:hidden text-xs font-bold text-slate-500 mb-1">作目</label>
                  <select 
                    value={item.crop_id}
                    onChange={e => handleItemChange(index, 'crop_id', e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 font-bold focus:outline-none"
                    required
                  >
                    <option value="">選択...</option>
                    {crops.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                
                <div className="flex gap-2 w-full sm:w-auto">
                  <div className="w-1/2 sm:w-24">
                    <label className="block sm:hidden text-xs font-bold text-slate-500 mb-1">数量</label>
                    <input 
                      type="number"
                      step="0.1"
                      value={item.quantity}
                      onChange={e => handleItemChange(index, 'quantity', e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 font-bold focus:outline-none text-right"
                    />
                  </div>
                  <div className="w-1/2 sm:w-20">
                    <label className="block sm:hidden text-xs font-bold text-slate-500 mb-1">単位</label>
                    <input 
                      type="text"
                      value={item.unit}
                      onChange={e => handleItemChange(index, 'unit', e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 font-bold focus:outline-none text-center"
                    />
                  </div>
                </div>

                <div className="flex gap-3 items-center w-full sm:w-auto ml-auto">
                  <div className="w-full sm:w-32 flex items-center gap-2">
                    <label className="block sm:hidden text-xs font-bold text-slate-500">単価</label>
                    <span className="text-slate-400 font-bold">¥</span>
                    <input 
                      type="number"
                      value={item.unit_price}
                      onChange={e => handleItemChange(index, 'unit_price', e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 font-bold focus:outline-none text-right"
                      placeholder="単価"
                    />
                  </div>
                  {items.length > 1 && (
                    <button 
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
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
            className="text-sm font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 py-2 px-3 hover:bg-emerald-50 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> 明細を追加
          </button>
        </section>

        {/* 合計と送信 */}
        <section className="bg-slate-900 text-white p-6 rounded-xl shadow-inner flex flex-col sm:flex-row justify-between items-center gap-6">
          <div>
            <div className="text-slate-400 text-sm font-bold mb-1">合計金額（概算）</div>
            <div className="text-3xl font-black text-emerald-400">¥{calculateTotal().toLocaleString()}</div>
          </div>
          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black py-4 px-8 rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? '保存中...' : <><CheckCircle2 className="w-6 h-6" /> 受注を確定する</>}
          </button>
        </section>

      </form>
    </div>
  );
}
