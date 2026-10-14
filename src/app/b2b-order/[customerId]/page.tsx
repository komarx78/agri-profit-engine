"use client";

import React, { useState, useEffect, use } from 'react';
import {
  CheckCircle2,
  ShoppingCart,
  Plus,
  Minus,
  AlertCircle,
  FileText,
  RotateCcw,
  Calendar,
  MessageSquare,
  Clock
} from 'lucide-react';
import Link from 'next/link';
import { getB2BPortalData, createB2BOrder } from '@/app/actions/b2b';
import { getJSTDate, getJSTDateWithOffset } from '@/lib/dateUtils';

export default function B2BClientOrderPage({ params }: { params: Promise<{ customerId: string }> }) {
  const unwrappedParams = use(params);
  const customerId = unwrappedParams.customerId;

  const [customer, setCustomer] = useState<any>(null);
  const [crops, setCrops] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [cart, setCart] = useState<{ [key: string]: number }>({});
  const [deliveryDate, setDeliveryDate] = useState(() => getJSTDateWithOffset(2).dateStr);
  const [deliveryNote, setDeliveryNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'order' | 'history' | 'invoices'>('order');

  useEffect(() => {
    loadPortalData();
  }, [customerId]);

  async function loadPortalData() {
    try {
      const res = await getB2BPortalData(customerId);
      if (res.success && res.customer) {
        setCustomer(res.customer);
        setCrops(res.crops || []);
        setInvoices(res.invoices || []);
        setRecentOrders((res as any).recentOrders || []);
      }
    } catch (err) {
      console.error('Portal load error:', err);
    } finally {
      setLoading(false);
    }
  }

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

  const setDirectQuantity = (cropId: string, val: number) => {
    setCart(prev => {
      const next = Math.max(0, val);
      const newCart = { ...prev };
      if (next === 0) delete newCart[cropId];
      else newCart[cropId] = next;
      return newCart;
    });
  };

  // 前回の注文内容をワンタップでカートに復元
  const handleCopyLastOrder = () => {
    if (recentOrders.length === 0) return;
    const lastOrder = recentOrders[0];
    if (!lastOrder?.items || lastOrder.items.length === 0) return;
    const nextCart: { [key: string]: number } = {};
    lastOrder.items.forEach((item: any) => {
      if (item.crop_id && Number(item.quantity) > 0) {
        nextCart[item.crop_id] = Number(item.quantity);
      }
    });
    setCart(nextCart);
  };

  // カート内の合計金額計算
  const cartSummary = React.useMemo(() => {
    let totalItems = 0;
    let totalAmount = 0;
    let hasUnpricedItem = false;

    Object.entries(cart).forEach(([cropId, qty]) => {
      if (qty <= 0) return;
      totalItems += 1;
      const cropObj = crops.find(c => c.id === cropId);
      const unitPrice = Number(cropObj?.resolved_unit_price) || 0;
      if (unitPrice > 0) {
        totalAmount += qty * unitPrice;
      } else {
        hasUnpricedItem = true;
      }
    });

    return { totalItems, totalAmount, hasUnpricedItem };
  }, [cart, crops]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    const cropIds = Object.keys(cart).filter(id => cart[id] > 0);
    if (cropIds.length === 0) {
      alert('注文する野菜の数量を1つ以上選んでください。');
      return;
    }

    setIsSubmitting(true);

    const orderItems = cropIds.map(cropId => {
      const cropObj = crops.find(c => c.id === cropId);
      const qty = Number(cart[cropId]) || 0;
      const unit = cropObj?.resolved_unit || 'kg';
      const unitPrice = Number(cropObj?.resolved_unit_price) || 0;
      return {
        crop_id: cropId,
        quantity: qty,
        unit,
        unit_price: unitPrice,
        total_price: qty * unitPrice
      };
    });

    const totalAmount = orderItems.reduce((sum, item) => sum + item.total_price, 0);

    const orderData = {
      customer_id: customer.id,
      order_date: getJSTDate(),
      delivery_date: deliveryDate,
      status: 'pending',
      total_amount: totalAmount,
      delivery_note: deliveryNote.trim()
    };

    const res = await createB2BOrder(orderData, orderItems, customer.user_id);

    setIsSubmitting(false);
    if (res.success) {
      setIsSuccess(true);
      loadPortalData();
    } else {
      alert('エラー: ' + res.error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-500">
        読み込み中...
      </div>
    );
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
        <div className="bg-white p-8 rounded-3xl shadow-sm text-center max-w-sm w-full space-y-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800">ご注文を受け付けました！</h1>
            <p className="text-slate-600 font-bold text-sm mt-1">
              納品希望日: <strong className="text-indigo-700">{deliveryDate}</strong>
            </p>
          </div>
          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsSuccess(false);
                setCart({});
                setDeliveryNote('');
                setActiveTab('history');
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-xl transition-colors text-sm"
            >
              注文履歴を確認する
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSuccess(false);
                setCart({});
                setDeliveryNote('');
              }}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors text-sm"
            >
              続けて別の注文をする
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-36">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-xs">
        <div className="px-4 py-4 max-w-lg mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
            <ShoppingCart className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-800">{customer.name} 様</h1>
            <p className="text-xs font-bold text-slate-500">
              {customer.company_name} お客様専用ご注文ページ
            </p>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 flex gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('order')}
            className={`py-3 text-xs sm:text-sm font-black border-b-[3px] transition-colors ${
              activeTab === 'order'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            🛒 注文する
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-3 text-xs sm:text-sm font-black border-b-[3px] transition-colors ${
              activeTab === 'history'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            📦 最近の注文履歴 ({recentOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('invoices')}
            className={`py-3 text-xs sm:text-sm font-black border-b-[3px] transition-colors ${
              activeTab === 'invoices'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            🧾 請求書 {invoices.length > 0 && `(${invoices.length})`}
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-5">
        {activeTab === 'order' ? (
          <>
            {/* 1. 納品希望日 */}
            <section className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200 space-y-2">
              <label className="block text-sm font-black text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span>1. 納品（配達）希望日</span>
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={e => setDeliveryDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 font-black focus:outline-none focus:border-indigo-500 text-slate-800"
                required
              />
            </section>

            {/* 2. 注文する野菜と数量の選択 */}
            <section className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                <h2 className="font-black text-slate-800 text-sm">2. 注文する野菜と数量</h2>
                {recentOrders.length > 0 && (
                  <button
                    type="button"
                    onClick={handleCopyLastOrder}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-black flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>前回と同じ数をセット</span>
                  </button>
                )}
              </div>

              <div className="divide-y divide-slate-100">
                {crops.length === 0 ? (
                  <div className="p-8 text-center text-xs font-bold text-slate-400">
                    現在ご注文いただける商品が登録されていません。
                  </div>
                ) : (
                  crops.map(crop => {
                    const qty = cart[crop.id] || 0;
                    const unit = crop.resolved_unit || 'kg';
                    const unitPrice = Number(crop.resolved_unit_price) || 0;

                    return (
                      <div
                        key={crop.id}
                        className={`p-4 flex items-center justify-between gap-3 transition-colors ${
                          qty > 0 ? 'bg-indigo-50/40' : ''
                        }`}
                      >
                        <div>
                          <div className="font-black text-slate-900 text-base">🌱 {crop.name}</div>
                          <div className="text-xs font-bold text-slate-500 mt-0.5">
                            {unitPrice > 0 ? (
                              <span>
                                1{unit}あたり{' '}
                                <strong className="text-slate-800">¥{unitPrice.toLocaleString()}</strong>
                              </span>
                            ) : (
                              <span>単位: {unit}（単価は納品時確定）</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateQuantity(crop.id, -1)}
                            className="w-9 h-9 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center text-slate-700 transition-colors"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <div className="flex items-baseline gap-1">
                            <input
                              type="number"
                              min="0"
                              value={qty || ''}
                              placeholder="0"
                              onChange={e => setDirectQuantity(crop.id, Number(e.target.value) || 0)}
                              className="w-14 text-center font-black text-lg text-slate-900 bg-white border border-slate-200 rounded-xl py-1"
                            />
                            <span className="text-xs font-bold text-slate-600">{unit}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => updateQuantity(crop.id, 1)}
                            className="w-9 h-9 bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center justify-center text-white transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* 3. 配達希望メモ */}
            <section className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200 space-y-2">
              <label className="block text-sm font-black text-slate-800 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-indigo-600" />
                <span>3. 配達時間のご希望・連絡メモ（任意）</span>
              </label>
              <input
                type="text"
                value={deliveryNote}
                onChange={e => setDeliveryNote(e.target.value)}
                placeholder="例: 午前10時までに納品希望 / 小さめサイズ希望 など"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800"
              />
            </section>
          </>
        ) : activeTab === 'history' ? (
          <section className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-500" />
              <h2 className="font-black text-slate-800 text-sm">最近のご注文履歴（直近5件）</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {recentOrders.length === 0 ? (
                <div className="p-8 text-center font-bold text-slate-400 text-sm">
                  まだ注文履歴がありません
                </div>
              ) : (
                recentOrders.map(ord => (
                  <div key={ord.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-black text-slate-800 text-sm">
                        📅 納品予定日: {ord.delivery_date}
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                          ord.status === 'delivered' || ord.status === 'invoiced'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {ord.status === 'delivered' || ord.status === 'invoiced' ? '納品済' : '手配中'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ord.items?.map((item: any, idx: number) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold"
                        >
                          🌱 {item.crops?.name || '野菜'}: {item.quantity}
                          {item.unit}
                        </span>
                      ))}
                    </div>
                    {Number(ord.total_amount) > 0 && (
                      <div className="text-right text-xs font-black text-slate-700">
                        合計(税抜目安): ¥{Number(ord.total_amount).toLocaleString()}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        ) : (
          <section className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden mb-8">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-500" />
              <h2 className="font-black text-slate-700 text-sm">発行済みの請求書</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {invoices.length === 0 ? (
                <div className="p-8 text-center font-bold text-slate-400 text-sm">
                  請求書はまだありません
                </div>
              ) : (
                invoices.map(inv => (
                  <Link
                    href={`/b2b-order/${customerId}/invoices/${inv.id}`}
                    key={inv.id}
                    className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors block"
                  >
                    <div>
                      <div className="font-black text-slate-800">
                        {inv.target_month ? `${inv.target_month.replace('-', '年')}月分 請求書` : '請求書'}
                      </div>
                      <div className="text-xs font-bold text-slate-500 mt-1">
                        お支払期限: {inv.due_date || '未設定'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-indigo-700">
                        ¥{Number(inv.total_amount || 0).toLocaleString()}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        )}
      </main>

      {/* 固定フッター（送信ボタン - 発注タブのみ表示） */}
      {activeTab === 'order' && (
        <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
          <div className="max-w-lg mx-auto space-y-2">
            {cartSummary.totalItems > 0 && (
              <div className="flex items-center justify-between text-xs font-black text-slate-700 px-1">
                <span>選択中: {cartSummary.totalItems} 品目</span>
                {cartSummary.totalAmount > 0 && (
                  <span className="text-sm text-indigo-700">
                    概算合計: ¥{cartSummary.totalAmount.toLocaleString()}
                    {cartSummary.hasUnpricedItem ? ' ＋ 時価品目' : '（税抜）'}
                  </span>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || cartSummary.totalItems === 0}
              className={`w-full py-3.5 rounded-xl font-black text-base transition-all flex items-center justify-center gap-2 ${
                isSubmitting || cartSummary.totalItems === 0
                  ? 'bg-slate-200 text-slate-400'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/30'
              }`}
            >
              {isSubmitting ? '送信中...' : '✓ この内容で注文を確定する'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
