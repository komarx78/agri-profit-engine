"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Calendar, Sprout, Store, Calculator, CheckCircle2, Clock, Truck, MapPin, Loader2, Target } from 'lucide-react';

export default function PlansPage() {
  const [activeTab, setActiveTab] = useState<'work' | 'sales'>('work');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  // マスタデータ
  const [crops, setCrops] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [salesPrices, setSalesPrices] = useState<any[]>([]);
  const workTypes = ['収穫', '定植・播種', '水やり', '肥料・農薬', '草刈り', '片付け・メンテ'];

  // フォームステート
  const [targetDate, setTargetDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedCrop, setSelectedCrop] = useState<string>('');
  const [selectedField, setSelectedField] = useState<string>('');
  const [selectedWorkType, setSelectedWorkType] = useState<string>('');
  const [plannedDuration, setPlannedDuration] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [plannedQuantity, setPlannedQuantity] = useState<string>('');

  useEffect(() => {
    fetchMasters();
  }, []);

  async function fetchMasters() {
    setIsLoading(true);
    try {
      const [cRes, fRes, chRes, spRes] = await Promise.all([
        supabase.from('crops').select('id, name'),
        supabase.from('fields').select('id, name'),
        supabase.from('sales_channels').select('id, name'),
        supabase.from('sales_prices').select('*')
      ]);

      if (cRes.data) setCrops(cRes.data);
      if (fRes.data) setFields(fRes.data);
      if (chRes.data) setChannels(chRes.data);
      if (spRes.data) setSalesPrices(spRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  const currentPriceObj = salesPrices.find(sp => sp.crop_name === selectedCrop && sp.channel_name === selectedChannel);
  const currentPrice = currentPriceObj ? currentPriceObj.price_per_unit : 0;
  const calculatedTotal = plannedQuantity && currentPrice ? parseFloat(plannedQuantity) * currentPrice : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      if (activeTab === 'work') {
        const cropId = crops.find(c => c.name === selectedCrop)?.id;
        const fieldId = fields.find(f => f.name === selectedField)?.id;
        
        const { error } = await supabase.from('work_logs').insert([{
          crop_id: cropId || null,
          field_id: fieldId || null,
          work_type: selectedWorkType,
          work_date: targetDate,
          duration_minutes: parseInt(plannedDuration, 10),
          status: 'planned'
        }]);
        
        if (error) throw error;
      } else {
        const cropId = crops.find(c => c.name === selectedCrop)?.id;
        const channelId = channels.find(c => c.name === selectedChannel)?.id;

        const { error } = await supabase.from('sales_logs').insert([{
          crop_id: cropId || null,
          channel_id: channelId || null,
          sales_date: targetDate,
          quantity: parseFloat(plannedQuantity),
          unit: 'kg/箱',
          total_sales: calculatedTotal > 0 ? calculatedTotal : null,
          status: 'planned'
        }]);

        if (error) throw error;
      }

      setMessage({ text: '予定を登録しました！', type: 'success' });
      // フォームリセット
      setSelectedCrop('');
      setSelectedField('');
      setSelectedWorkType('');
      setPlannedDuration('');
      setSelectedChannel('');
      setPlannedQuantity('');
      
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error(err);
      setMessage({ text: 'エラーが発生しました。Supabaseでstatusカラムや制約のSQLを実行したか確認してください。', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
          <Target className="w-8 h-8 text-rose-500" />
          予定・目標の作成 (予実管理)
        </h1>
        <p className="text-slate-500 mt-2 font-medium">作業の予定時間（コスト）や出荷の予定（売上）を立てて、実績と比較しましょう。</p>
      </div>

      {/* タブ */}
      <div className="flex p-1 bg-slate-200 rounded-xl w-full max-w-sm">
        <button
          onClick={() => setActiveTab('work')}
          className={`flex-1 py-2 font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === 'work' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Clock className="w-4 h-4" />
          作業予定を立てる
        </button>
        <button
          onClick={() => setActiveTab('sales')}
          className={`flex-1 py-2 font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === 'sales' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Truck className="w-4 h-4" />
          売上予定を立てる
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 font-bold ${message.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
          <CheckCircle2 className="w-5 h-5" />
          {message.text}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
        </div>
      ) : (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> 対象日・予定日
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-600 mb-2 flex items-center gap-2">
                  <Sprout className="w-4 h-4" /> 作目
                </label>
                <select
                  value={selectedCrop}
                  onChange={(e) => setSelectedCrop(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-rose-500"
                  required
                >
                  <option value="">選択してください</option>
                  {crops.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
            </div>

            {activeTab === 'work' ? (
              // 作業予定のフォーム
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> 予定の圃場 (作業場)
                  </label>
                  <select
                    value={selectedField}
                    onChange={(e) => setSelectedField(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-emerald-500"
                    required
                  >
                    <option value="">選択してください</option>
                    {fields.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> 予定の作業内容
                  </label>
                  <select
                    value={selectedWorkType}
                    onChange={(e) => setSelectedWorkType(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-emerald-500"
                    required
                  >
                    <option value="">選択してください</option>
                    {workTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-600 mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> 予定作業時間 (分)
                  </label>
                  <input
                    type="number"
                    value={plannedDuration}
                    onChange={(e) => setPlannedDuration(e.target.value)}
                    placeholder="例: 120"
                    className="w-full px-4 py-4 text-2xl font-black bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl focus:outline-none focus:border-emerald-500"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-2">※この予定時間から概算コストが予測されます。</p>
                </div>
              </div>
            ) : (
              // 売上予定のフォーム
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-600 mb-2 flex items-center gap-2">
                    <Store className="w-4 h-4" /> 出荷予定先 (販路)
                  </label>
                  <select
                    value={selectedChannel}
                    onChange={(e) => setSelectedChannel(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-amber-500"
                    required
                    disabled={!selectedCrop}
                  >
                    <option value="">{selectedCrop ? "選択してください" : "先に作目を選択してください"}</option>
                    {salesPrices.filter(sp => sp.crop_name === selectedCrop).map(sp => (
                      <option key={sp.id} value={sp.channel_name}>{sp.channel_name} (単価: ¥{sp.price_per_unit})</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-600 mb-2 flex items-center gap-2">
                    <Calculator className="w-4 h-4" /> 予定数量 (kg / 箱)
                  </label>
                  <input
                    type="number"
                    value={plannedQuantity}
                    onChange={(e) => setPlannedQuantity(e.target.value)}
                    placeholder="例: 50"
                    className="w-full px-4 py-4 text-2xl font-black bg-amber-50 border border-amber-200 text-amber-800 rounded-xl focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                {selectedCrop && selectedChannel && (
                  <div className="md:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-center text-sm mb-2">
                      <span className="text-slate-500">適用単価 (マスタ設定値)</span>
                      <span className="font-bold">¥{currentPrice.toLocaleString()} / 単位</span>
                    </div>
                    <div className="flex justify-between items-end border-t border-slate-200 pt-2">
                      <span className="text-amber-600 font-bold">予定売上額 (自動計算)</span>
                      <span className="text-3xl font-black text-amber-700">¥{calculatedTotal.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-4 rounded-xl font-black text-lg text-white shadow-md flex items-center justify-center gap-2 transition-colors ${
                activeTab === 'work' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-amber-600 hover:bg-amber-500'
              } disabled:opacity-50`}
            >
              {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : 'この予定を登録する'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
