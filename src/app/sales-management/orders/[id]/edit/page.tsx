"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, ArrowLeft, Copy, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { getB2BCustomers, updateB2BOrderDetails, deleteB2BOrder } from '@/app/actions/b2b';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '@/lib/tenant';

// In Next.js 15+ async params must be used with React.use, or defined properly
export default function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [orderId, setOrderId] = useState<string>('');
  
  const [customers, setCustomers] = useState<any[]>([]);
  const [crops, setCrops] = useState<any[]>([]);
  
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  
  const [items, setItems] = useState<any[]>([
    { crop_id: '', quantity: 1, unit: 'kg', unit_price: 0 }
  ]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    async function unwrap() {
      const p = await params;
      setOrderId(p.id);
    }
    unwrap();
  }, [params]);

  useEffect(() => {
    async function load() {
      if (!orderId) return;
      
      const tenantId = await getCurrentTenantId();

      let cropQuery = supabase.from('crops').select('*');
      if (tenantId) {
        cropQuery = cropQuery.eq('user_id', tenantId);
      }
      const { data: cropData } = await cropQuery;
      if (cropData) setCrops(cropData);

      const custRes = await getB2BCustomers(tenantId);
      if (custRes.success) setCustomers(custRes.customers);
      
      // Load existing order
      let orderQuery = supabase
        .from('b2b_orders')
        .select(`*, items:b2b_order_items(*)`)
        .eq('id', orderId);

      if (tenantId) {
        orderQuery = orderQuery.eq('user_id', tenantId);
      }

      const { data: orderData, error } = await orderQuery.single();
        
      if (orderData) {
        setSelectedCustomerId(orderData.customer_id);
        setDeliveryDate(orderData.delivery_date);
        if (orderData.items && orderData.items.length > 0) {
          setItems(orderData.items.map((i: any) => ({
            crop_id: i.crop_id,
            quantity: i.quantity,
            unit: i.unit || 'kg',
            unit_price: i.unit_price || 0
          })));
        }
      }
    }
    load();
  }, [orderId]);

  const handleAddItem = () => {
    setItems([...items, { crop_id: '', quantity: 1, unit: 'kg', unit_price: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unit_price)), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      alert("顧客を選択してください。");
      return;
    }
    if (items.some(i => !i.crop_id || !i.quantity)) {
      alert("すべての商品の種類と数量を入力してください。");
      return;
    }

    setIsSubmitting(true);

    const orderData = {
      customer_id: selectedCustomerId,
      delivery_date: deliveryDate,
      total_amount: calculateTotal()
    };

    const orderItems = items.map(item => ({
      ...item,
      total_price: Number(item.quantity) * Number(item.unit_price)
    }));

    const res = await updateB2BOrderDetails(orderId, orderData, orderItems);
    
    setIsSubmitting(false);
    
    if (res.success) {
      alert("注文を修正しました。");
      router.push('/sales-management/orders');
    } else {
      alert("エラー: " + res.error);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("本当にこの注文を完全に削除しますか？\n（この操作は取り消せません）")) return;
    setIsSubmitting(true);
    const res = await deleteB2BOrder(orderId);
    setIsSubmitting(false);
    if (res.success) {
      alert("注文を削除しました。");
      router.push('/sales-management/orders');
    } else {
      alert("エラー: " + res.error);
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
            注文内容の修正
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
              <select 
                value={selectedCustomerId}
                onChange={e => setSelectedCustomerId(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 font-bold focus:outline-none focus:border-emerald-500"
                required
              >
                <option value="">選択してください</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
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
            {isSubmitting ? '保存中...' : <><CheckCircle2 className="w-6 h-6" /> 修正を確定する</>}
          </button>
        </section>

      </form>

      {/* 危険ゾーン（削除） */}
      <div className="bg-rose-50 rounded-2xl border border-rose-100 p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-center gap-4 mt-8">
        <div>
          <h3 className="text-rose-800 font-black text-lg">この注文を削除する</h3>
          <p className="text-rose-600 font-bold text-sm mt-1">二重注文や取り消しの場合など、この注文データを完全に消去します。元に戻すことはできません。</p>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isSubmitting}
          className="w-full sm:w-auto bg-white hover:bg-rose-100 text-rose-700 font-black py-3 px-6 rounded-xl border border-rose-200 shadow-sm transition-colors flex items-center justify-center gap-2"
        >
          <Trash2 className="w-5 h-5" /> 完全に削除する
        </button>
      </div>

    </div>
  );
}
