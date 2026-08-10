"use client";

import React, { useState, useEffect } from 'react';
import { Truck, Sprout, Store, CheckCircle2, AlertCircle, FileDigit, Calculator } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function SalesEntryPage() {
  const [crops, setCrops] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [salesPrices, setSalesPrices] = useState<any[]>([]);
  
  const [selectedCrop, setSelectedCrop] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [cRes, chRes, spRes] = await Promise.all([
          supabase.from('crops').select('id, name'),
          supabase.from('sales_channels').select('id, name'),
          supabase.from('sales_prices').select('*')
        ]);

        if (cRes.data) setCrops(cRes.data);
        if (chRes.data) setChannels(chRes.data);
        if (spRes.data) setSalesPrices(spRes.data);
        
        if (!cRes.error) setIsConnected(true);
      } catch (err) {
        console.log('Error fetching data', err);
      }
    }
    fetchData();
  }, []);

  // 選択された作目・販路に基づき、単価を取得
  const currentPriceObj = salesPrices.find(
    sp => sp.crop_name === selectedCrop && sp.channel_name === selectedChannel
  );
  const currentPrice = currentPriceObj ? currentPriceObj.price_per_unit : 0;
  
  // 自動計算された総売上
  const calculatedTotal = quantity && currentPrice ? parseFloat(quantity) * currentPrice : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (isConnected) {
        const cropId = crops.find(c => c.name === selectedCrop)?.id;
        const channelId = channels.find(c => c.name === selectedChannel)?.id;

        const { error } = await supabase.from('sales_logs').insert([
          {
            crop_id: cropId || null,
            channel_id: channelId || null,
            sales_date: new Date().toISOString().split('T')[0],
            quantity: parseFloat(quantity) || 0,
            unit: 'kg/箱',
            total_sales: calculatedTotal > 0 ? calculatedTotal : null,
          }
        ]);
        if (error) console.error('Insert error:', error);
      } else {
        await new Promise(r => setTimeout(r, 800));
      }

      setIsSubmitting(false);
      setIsSuccess(true);
      
      setTimeout(() => {
        setIsSuccess(false);
        setSelectedCrop('');
        setSelectedChannel('');
        setQuantity('');
      }, 2500);
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-32">
      <header className="sticky top-0 z-10 backdrop-blur-md bg-slate-950/80 border-b border-amber-900/50 px-4 py-4 shadow-lg">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-amber-500 to-orange-400 rounded-xl shadow-md text-amber-950">
              <Truck className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                出荷記録
              </h1>
              <p className="text-xs font-medium text-amber-300/80">数量だけ入れて自動計算！</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 pt-6">
        {isSuccess ? (
          <div className="my-12 p-8 bg-gradient-to-b from-amber-900/90 to-orange-950/90 rounded-3xl border border-amber-500/40 shadow-2xl text-center flex flex-col items-center justify-center space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center border border-amber-400/40 shadow-inner">
              <CheckCircle2 className="w-12 h-12 text-amber-400" />
            </div>
            <h2 className="text-2xl font-black text-white">出荷記録完了！</h2>
            <p className="text-sm text-amber-200">売上も自動計算されました🚚</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* 1. 作目選択 */}
            <section className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/60 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2.5 flex items-center gap-2">
                <Sprout className="w-4 h-4 text-emerald-400" />作目
              </h2>
              <div className="grid grid-cols-2 gap-2.5">
                {crops.length > 0 ? crops.map(crop => (
                  <button
                    key={crop.id}
                    type="button"
                    onClick={() => setSelectedCrop(crop.name)}
                    className={`py-3.5 px-3 rounded-xl font-bold text-base transition-all border text-center ${
                      selectedCrop === crop.name
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-emerald-950 border-emerald-300 shadow-md'
                        : 'bg-slate-950/60 text-slate-300 border-slate-800/80'
                    }`}
                  >
                    {crop.name}
                  </button>
                )) : (
                  <div className="col-span-2 text-sm text-slate-500 p-2 text-center">データ取得中...</div>
                )}
              </div>
            </section>

            {/* 2. 出荷先・販路 */}
            <section className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/60 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-2.5 flex items-center gap-2">
                <Store className="w-4 h-4 text-blue-400" />出荷先
              </h2>
              <div className="grid grid-cols-2 gap-2.5">
                {channels.length > 0 ? channels.map(ch => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setSelectedChannel(ch.name)}
                    className={`py-3.5 px-3 rounded-xl font-bold text-base transition-all border text-center ${
                      selectedChannel === ch.name
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-slate-950 border-blue-300 shadow-md'
                        : 'bg-slate-950/60 text-slate-300 border-slate-800/80'
                    }`}
                  >
                    {ch.name}
                  </button>
                )) : (
                  <div className="col-span-2 text-sm text-slate-500 p-2 text-center">データ取得中...</div>
                )}
              </div>
            </section>

            {/* 3. 数量 */}
            <section className="bg-amber-900/20 p-4 rounded-2xl border border-amber-900/40 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2.5 flex items-center gap-2">
                <FileDigit className="w-4 h-4 text-amber-400" />出荷量・数 (必須)
              </h2>
              <div className="relative">
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  className="w-full py-4 px-4 pr-16 text-3xl font-black text-right bg-slate-950/80 rounded-xl border-2 border-amber-700/50 text-white placeholder-slate-700 focus:border-amber-400 focus:outline-none transition-all shadow-inner"
                  required
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-500 font-bold">
                  kg / 箱
                </div>
              </div>
            </section>

            {/* 4. 自動計算プレビュー */}
            {selectedCrop && selectedChannel && (
              <section className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/50 flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400 flex items-center gap-1"><Calculator className="w-4 h-4" /> 適用単価</span>
                  {currentPrice > 0 ? (
                    <span className="text-slate-200 font-bold">¥{currentPrice.toLocaleString()} / 単位</span>
                  ) : (
                    <span className="text-red-400 font-medium text-xs">※単価マスタ未登録</span>
                  )}
                </div>
                <div className="flex justify-between items-end border-t border-slate-700/50 pt-2 mt-1">
                  <span className="text-emerald-400 font-bold text-sm">売上予定額</span>
                  <span className="text-2xl font-black text-white">
                    ¥{calculatedTotal.toLocaleString()}
                  </span>
                </div>
              </section>
            )}

            {/* 送信ボタン */}
            <button
              type="submit"
              disabled={!selectedCrop || !selectedChannel || !quantity || isSubmitting}
              className={`w-full py-5 rounded-2xl font-black text-xl shadow-xl transition-all duration-200 flex items-center justify-center gap-2 mt-4 ${
                !selectedCrop || !selectedChannel || !quantity || isSubmitting
                  ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 text-amber-950 hover:brightness-110 active:scale-[0.98] shadow-amber-500/20'
              }`}
            >
              {isSubmitting ? (
                <span>記録中...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-6 h-6" />
                  <span>出荷記録を保存する</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
