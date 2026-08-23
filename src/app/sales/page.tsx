"use client";

import React, { useState, useEffect } from 'react';
import { Truck, Sprout, Store, CheckCircle2, AlertCircle, FileDigit, Calculator, Calendar, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getB2BOrders, updateB2BOrderStatus } from '@/app/actions/b2b';

export default function SalesEntryHubPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // 都度出荷用
  const [crops, setCrops] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [selectedCrop, setSelectedCrop] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('');
  const [quantity, setQuantity] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoadingOrders(true);
    // 1. Load today's orders
    const oRes = await getB2BOrders(null);
    if (oRes.success) {
      const todayStr = new Date().toISOString().split('T')[0];
      setOrders(oRes.orders.filter((o: any) => o.delivery_date === todayStr && o.status === 'pending'));
    }

    // 2. Load crops & channels for ad-hoc
    const [cRes, chRes] = await Promise.all([
      supabase.from('crops').select('*'),
      supabase.from('sales_channels').select('*')
    ]);
    if (cRes.data) setCrops(cRes.data);
    if (chRes.data) setChannels(chRes.data);

    setLoadingOrders(false);
  }

  const handleCompleteOrder = async (orderId: string) => {
    const confirm = window.confirm("この注文を「納品済」として記録しますか？");
    if (!confirm) return;
    
    await updateB2BOrderStatus(orderId, 'delivered');
    loadData(); // reload
  };

  const handleAdHocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const cropId = crops.find(c => c.name === selectedCrop)?.id;
      const channelId = channels.find(c => c.name === selectedChannel)?.id;
      
      const { error } = await supabase.from('sales_logs').insert([
        {
          crop_id: cropId || null,
          channel_id: channelId || null,
          sales_date: new Date().toISOString().split('T')[0],
          quantity: parseFloat(quantity) || 0,
          status: 'completed'
        }
      ]);
      if (error) throw error;
      
      alert("都度出荷を記録しました。");
      setSelectedCrop('');
      setSelectedChannel('');
      setQuantity('');
    } catch (err: any) {
      alert("エラー: " + err.message);
    }
    setIsSubmitting(false);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-32">
      <header className="sticky top-0 z-10 backdrop-blur-md bg-slate-950/80 border-b border-emerald-900/50 px-4 py-4 shadow-lg">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-xl shadow-md text-emerald-950">
            <Truck className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              出荷・納品ハブ
            </h1>
            <p className="text-xs font-medium text-emerald-300/80">本日の納品予定と都度出荷を記録</p>
          </div>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 pt-6 space-y-8">
        
        {/* 上段：本日の納品予定（受注分） */}
        <section className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/60 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
          <h2 className="text-sm font-black text-indigo-400 mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4" /> 本日の配達予定 (受注分)
          </h2>
          
          {loadingOrders ? (
            <div className="text-center py-4 text-slate-500 font-bold text-sm">読み込み中...</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 bg-slate-950/50 rounded-xl border border-slate-800/50">
              <CheckCircle2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <div className="text-slate-400 font-bold text-sm">本日の未納品はありません</div>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map(order => (
                <div key={order.id} className="bg-slate-800/40 border border-slate-700/50 p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="font-black text-white text-base mb-1">{order.customer?.name}</div>
                    <div className="text-xs font-bold text-slate-400">
                      {order.items?.map((i: any) => `${i.crops?.name || i.crop?.name || '不明'} ${i.quantity}${i.unit}`).join(' / ')}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleCompleteOrder(order.id)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 px-4 rounded-lg transition-colors flex items-center gap-1 shadow-md shadow-indigo-900/50"
                  >
                    納品完了 <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 下段：JA等への都度出荷フォーム */}
        <section className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/60 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
          <h2 className="text-sm font-black text-emerald-400 mb-4 flex items-center gap-2">
            <Truck className="w-4 h-4" /> 都度出荷の記録 (JA等)
          </h2>
          
          <form onSubmit={handleAdHocSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">出荷先 (販路)</label>
              <select 
                value={selectedChannel}
                onChange={e => setSelectedChannel(e.target.value)}
                className="w-full bg-slate-950/60 text-white px-4 py-3 border border-slate-800/60 rounded-xl focus:outline-none focus:border-emerald-500"
                required
              >
                <option value="">選択してください</option>
                {channels.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">作目</label>
              <select 
                value={selectedCrop}
                onChange={e => setSelectedCrop(e.target.value)}
                className="w-full bg-slate-950/60 text-white px-4 py-3 border border-slate-800/60 rounded-xl focus:outline-none focus:border-emerald-500"
                required
              >
                <option value="">選択してください</option>
                {crops.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">数量</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  className="w-full bg-slate-950/60 text-white text-2xl font-black px-4 py-3 border border-slate-800/60 rounded-xl focus:outline-none focus:border-emerald-500 text-right"
                  required
                />
                <div className="w-20 bg-slate-800/60 flex items-center justify-center rounded-xl font-bold text-slate-400 border border-slate-800/60">
                  kg
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !selectedChannel || !selectedCrop || !quantity}
              className={`w-full py-4 rounded-xl font-black text-lg transition-all flex items-center justify-center gap-2 mt-2 ${
                isSubmitting || !selectedChannel || !selectedCrop || !quantity
                  ? 'bg-slate-800 text-slate-500'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/50'
              }`}
            >
              {isSubmitting ? '保存中...' : '出荷を記録する'}
            </button>
          </form>
        </section>

      </div>
    </main>
  );
}
