"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Calendar, Sprout, Store, Calculator, CheckCircle2, Clock, Truck, MapPin, Loader2, Target, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';

export default function PlansPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  // マスタデータ
  const [crops, setCrops] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [salesPrices, setSalesPrices] = useState<any[]>([]);
  const workTypes = ['収穫', '定植・播種', '水やり', '肥料・農薬', '草刈り', '片付け・メンテ'];

  // 予定データ
  const [plannedWork, setPlannedWork] = useState<any[]>([]);
  const [plannedSales, setPlannedSales] = useState<any[]>([]);

  // モーダルステート
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'work' | 'sales'>('work');
  const [targetDate, setTargetDate] = useState<string>('');
  const [selectedCrop, setSelectedCrop] = useState<string>('');
  const [selectedField, setSelectedField] = useState<string>('');
  const [selectedWorkType, setSelectedWorkType] = useState<string>('');
  const [plannedDuration, setPlannedDuration] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [plannedQuantity, setPlannedQuantity] = useState<string>('');

  useEffect(() => {
    fetchMasters();
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [currentDate]);

  async function fetchMasters() {
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
    }
  }

  async function fetchPlans() {
    setIsLoading(true);
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const startOfMonth = `${year}-${month}-01`;
    const endOfMonth = `${year}-${month}-31`; // 簡易的な月末判定

    try {
      const [workRes, salesRes] = await Promise.all([
        supabase.from('work_logs')
          .select('*, crops(name)')
          .eq('status', 'planned')
          .gte('work_date', startOfMonth)
          .lte('work_date', endOfMonth),
        supabase.from('sales_logs')
          .select('*, crops(name)')
          .eq('status', 'planned')
          .gte('sales_date', startOfMonth)
          .lte('sales_date', endOfMonth)
      ]);

      if (workRes.data) setPlannedWork(workRes.data);
      if (salesRes.data) setPlannedSales(salesRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  // カレンダーの日付配列生成
  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const date = new Date(year, month, 1);
    const days = [];
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  }, [currentDate]);

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const openModal = (dateStr: string, cropName: string = '') => {
    setTargetDate(dateStr);
    setSelectedCrop(cropName);
    setSelectedField('');
    setSelectedWorkType('');
    setPlannedDuration('');
    setSelectedChannel('');
    setPlannedQuantity('');
    setIsModalOpen(true);
  };

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
      fetchPlans();
      setTimeout(() => {
        setMessage(null);
        setIsModalOpen(false);
      }, 1500);
    } catch (err) {
      console.error(err);
      setMessage({ text: 'エラーが発生しました。', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // セルに表示する予定を検索
  const getPlansForCell = (cropName: string, dateStr: string) => {
    const works = plannedWork.filter(w => w.crops?.name === cropName && w.work_date === dateStr);
    const sales = plannedSales.filter(s => s.crops?.name === cropName && s.sales_date === dateStr);
    return { works, sales };
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <Target className="w-8 h-8 text-rose-500" />
            予定・目標ガントチャート
          </h1>
          <p className="text-slate-500 mt-2 font-medium">作業予定や出荷目標をカレンダー上で視覚的に管理します。</p>
        </div>
        <button
          onClick={() => openModal(new Date().toISOString().split('T')[0])}
          className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          予定を追加
        </button>
      </div>

      {/* カレンダーヘッダー */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
          <ChevronLeft className="w-6 h-6 text-slate-600" />
        </button>
        <h2 className="text-xl font-black text-slate-800 tracking-wider">
          {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月
        </h2>
        <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
          <ChevronRight className="w-6 h-6 text-slate-600" />
        </button>
      </div>

      {/* ガントチャート本体 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center p-20">
            <Loader2 className="w-10 h-10 text-rose-500 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* 動的グリッドカラム: 120px(作目) + (日数分 x 50px) */}
            <div 
              className="min-w-max"
              style={{ display: 'grid', gridTemplateColumns: `120px repeat(${daysInMonth.length}, minmax(50px, 1fr))` }}
            >
              {/* ヘッダー行 */}
              <div className="sticky left-0 z-10 bg-slate-100 border-r border-b border-slate-200 p-3 font-bold text-slate-600 text-sm flex items-center justify-center">
                作目
              </div>
              {daysInMonth.map((d, i) => {
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <div key={i} className={`border-b border-r border-slate-200 p-2 text-center text-xs font-bold ${isWeekend ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-500'}`}>
                    <div className="text-[10px] mb-0.5">{['日', '月', '火', '水', '木', '金', '土'][d.getDay()]}</div>
                    <div className="text-sm">{d.getDate()}</div>
                  </div>
                );
              })}

              {/* 作目ごとの行 */}
              {crops.map((crop) => (
                <React.Fragment key={crop.id}>
                  {/* 作目名 (左固定) */}
                  <div className="sticky left-0 z-10 bg-white border-r border-b border-slate-100 p-3 flex items-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    <span className="font-bold text-slate-700 text-sm">{crop.name}</span>
                  </div>
                  
                  {/* 日付セル */}
                  {daysInMonth.map((d, i) => {
                    const dateStr = d.toISOString().split('T')[0];
                    const { works, sales } = getPlansForCell(crop.name, dateStr);
                    const isToday = dateStr === new Date().toISOString().split('T')[0];
                    
                    return (
                      <div 
                        key={i} 
                        onClick={() => openModal(dateStr, crop.name)}
                        className={`border-b border-r border-slate-100 p-1 min-h-[60px] relative hover:bg-slate-50 cursor-pointer transition-colors group ${isToday ? 'bg-amber-50/30' : ''}`}
                      >
                        <div className="flex flex-col gap-1 w-full relative z-0">
                          {works.map((w, idx) => (
                            <div key={`w-${idx}`} className="bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10px] font-bold px-1 py-0.5 rounded truncate" title={`${w.work_type} (${w.duration_minutes}分)`}>
                              {w.work_type.substring(0, 2)}
                            </div>
                          ))}
                          {sales.map((s, idx) => (
                            <div key={`s-${idx}`} className="bg-amber-100 border border-amber-200 text-amber-800 text-[10px] font-bold px-1 py-0.5 rounded truncate" title={`売上予測: ¥${s.total_sales?.toLocaleString()}`}>
                              ¥{(s.total_sales / 1000).toFixed(0)}k
                            </div>
                          ))}
                        </div>
                        {/* ホバー時の＋アイコン */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="bg-rose-500 text-white rounded-full p-1 shadow-lg">
                            <Plus className="w-3 h-3" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isSubmitting && setIsModalOpen(false)}>
          <div className="bg-white rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white/80 backdrop-blur-md px-6 py-4 border-b border-slate-100 flex items-center justify-between z-10">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Target className="w-5 h-5 text-rose-500" />
                予定を追加
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-colors" disabled={isSubmitting}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              {message && (
                <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 font-bold ${message.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                  <CheckCircle2 className="w-5 h-5" />
                  {message.text}
                </div>
              )}

              <div className="flex p-1 bg-slate-100 rounded-xl w-full mb-6">
                <button
                  onClick={() => setActiveTab('work')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                    activeTab === 'work' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  <Clock className="w-4 h-4" /> 作業予定
                </button>
                <button
                  onClick={() => setActiveTab('sales')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                    activeTab === 'sales' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  <Truck className="w-4 h-4" /> 売上目標
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">対象日</label>
                    <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:border-rose-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">作目</label>
                    <select value={selectedCrop} onChange={e => setSelectedCrop(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:border-rose-500 focus:outline-none">
                      <option value="">選択</option>
                      {crops.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                {activeTab === 'work' ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">圃場</label>
                        <select value={selectedField} onChange={e => setSelectedField(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:border-emerald-500 focus:outline-none">
                          <option value="">選択</option>
                          {fields.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">作業内容</label>
                        <select value={selectedWorkType} onChange={e => setSelectedWorkType(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:border-emerald-500 focus:outline-none">
                          <option value="">選択</option>
                          {workTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">予定時間 (分)</label>
                      <input type="number" value={plannedDuration} onChange={e => setPlannedDuration(e.target.value)} placeholder="120" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-lg focus:border-emerald-500 focus:outline-none" />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">出荷予定先</label>
                      <select value={selectedChannel} onChange={e => setSelectedChannel(e.target.value)} required disabled={!selectedCrop} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:border-amber-500 focus:outline-none">
                        <option value="">{selectedCrop ? "選択してください" : "先に作目を選択"}</option>
                        {salesPrices.filter(sp => sp.crop_name === selectedCrop).map(sp => (
                          <option key={sp.id} value={sp.channel_name}>{sp.channel_name} (¥{sp.price_per_unit})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">予定数量</label>
                      <input type="number" value={plannedQuantity} onChange={e => setPlannedQuantity(e.target.value)} placeholder="50" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-lg focus:border-amber-500 focus:outline-none" />
                    </div>
                    {calculatedTotal > 0 && (
                      <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex justify-between items-center">
                        <span className="text-amber-800 font-bold">売上予測</span>
                        <span className="text-2xl font-black text-amber-600">¥{calculatedTotal.toLocaleString()}</span>
                      </div>
                    )}
                  </>
                )}

                <button type="submit" disabled={isSubmitting} className={`w-full py-4 rounded-xl font-black text-white flex items-center justify-center gap-2 transition-colors mt-6 ${activeTab === 'work' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-amber-600 hover:bg-amber-500'} disabled:opacity-50`}>
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : '登録する'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
