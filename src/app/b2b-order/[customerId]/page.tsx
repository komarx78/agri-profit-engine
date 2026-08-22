"use client";

import React, { useState, useEffect } from 'react';
import { Truck, CheckCircle2, ShoppingCart, Plus, Minus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { createB2BOrder } from '@/app/actions/b2b';

export default function B2BClientOrderPage({ params }: { params: { customerId: string } }) {
  const [customer, setCustomer] = useState<any>(null);
  const [crops, setCrops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // orderToken をベースにする想定だが、ここでは便宜的に customerId または token を使う
  // 今回のモック実装では、URLパラメータを token として検索する
  
  const [cart, setCart] = useState<{[key: string]: number}>({});
  const [deliveryDate, setDeliveryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2); // デフォルトは明後日
    return d.toISOString().split('T')[0];
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      // 実際は order_token で顧客を検索する安全な設計にする
      const { data: custData } = await supabase
        .from('b2b_customers')
        .select('*')
        .eq('order_token', params.customerId)
        .single();
        
      if (custData) {
        setCustomer(custData);
        // 作目一覧を取得
        const { data: cropData } = await supabase.from('crops').select('*');
        if (cropData) setCrops(cropData);
      }
      setLoading(false);
    }
    load();
  }, [params.customerId]);

  const updateQuantity = (cropId: string, delta: number) => {
    setCart(prev => {
      const current = prev[cropId] || 0;
      const next = Math.max(0, current + delta);
      const newCart = { ...prev };
      if (next === 0) delete newCart[cropId];
      else newCart[cropId] = next;
      return newCart;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    const cropIds = Object.keys(cart);
    if (cropIds.length === 0) {
      alert("発注する商品を選択してください。");
      return;
    }

    setIsSubmitting(true);

    const orderData = {
      customer_id: customer.id,
      order_date: new Date().toISOString().split('T')[0],
      delivery_date: deliveryDate,
      status: 'pending',
      total_amount: 0 // B2B向けは単価を隠す場合があるため0にしておくか、マスタから計算
    };

    const orderItems = cropIds.map(cropId => ({
      crop_id: cropId,
      quantity: cart[cropId],
      unit: 'kg', // 暫定
      unit_price: 0,
      total_price: 0
    }));

    const res = await createB2BOrder(orderData, orderItems);
    
    setIsSubmitting(false);
    if (res.success) {
      setIsSuccess(true);
    } else {
      alert("エラー: " + res.error);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-500">読み込み中...</div>;
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm text-center">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h1 className="text-xl font-black text-slate-800">無効な発注URLです</h1>
          <p className="text-slate-500 mt-2 font-bold text-sm">農園管理者にご確認ください。</p>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-xl font-black text-slate-800 mb-2">発注を完了しました</h1>
          <p className="text-slate-500 font-bold text-sm mb-6">
            納品予定日: {deliveryDate}
          </p>
          <button 
            onClick={() => { setIsSuccess(false); setCart({}); }}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors"
          >
            追加で発注する
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-32">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 py-4 shadow-sm">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-800">
              {customer.name} 様
            </h1>
            <p className="text-xs font-bold text-slate-500">発注専用フォーム</p>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-6 space-y-6">
        
        <section className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <label className="block text-sm font-black text-slate-700 mb-2">納品希望日</label>
          <input 
            type="date"
            value={deliveryDate}
            onChange={e => setDeliveryDate(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold focus:outline-none focus:border-indigo-500 text-slate-800"
            required
          />
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <h2 className="font-black text-slate-700">発注商品の選択</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {crops.map(crop => (
              <div key={crop.id} className="p-4 flex items-center justify-between">
                <div className="font-black text-slate-800">{crop.name}</div>
                <div className="flex items-center gap-3">
                  <button 
                    type="button"
                    onClick={() => updateQuantity(crop.id, -1)}
                    className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center text-slate-600 transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="w-12 text-center font-black text-lg text-slate-800">
                    {cart[crop.id] || 0}
                  </div>
                  <button 
                    type="button"
                    onClick={() => updateQuantity(crop.id, 1)}
                    className="w-8 h-8 bg-indigo-100 hover:bg-indigo-200 rounded-full flex items-center justify-center text-indigo-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>

      {/* 固定フッター（送信ボタン） */}
      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || Object.keys(cart).length === 0}
            className={`w-full py-4 rounded-xl font-black text-lg transition-all flex items-center justify-center gap-2 ${
              isSubmitting || Object.keys(cart).length === 0
                ? 'bg-slate-200 text-slate-400'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/30'
            }`}
          >
            {isSubmitting ? '送信中...' : '発注を確定する'}
          </button>
        </div>
      </div>
    </div>
  );
}
