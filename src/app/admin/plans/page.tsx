"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Calendar, Sprout, Store, Calculator, CheckCircle2, Clock, Truck, MapPin, Loader2, Target, ChevronLeft, ChevronRight, Plus, X, User, FileText, Image as ImageIcon } from 'lucide-react';

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
  const [materials, setMaterials] = useState<any[]>([]);
  const workTypes = ['収穫', '定植・播種', '水やり', '肥料・農薬', '草刈り', '片付け・メンテ'];

  const [allWorkLogs, setAllWorkLogs] = useState<any[]>([]);
  const [allSalesLogs, setAllSalesLogs] = useState<any[]>([]);

  // 表示モード
  const [ganttViewMode, setGanttViewMode] = useState<'byCrop' | 'byField'>('byCrop');
  const [ganttFilter, setGanttFilter] = useState<'all' | 'workOnly' | 'salesOnly'>('all');
  
  // 資材コスト算出モード
  const [costCalculationMode, setCostCalculationMode] = useState<'detailed' | 'estimate'>('estimate');
  const [estimateCostRate, setEstimateCostRate] = useState<number>(20); // 概算資材費の割合(%) 初期値20%
  
  // 基準時給 (ダッシュボード・シミュレーション用)
  const [baseHourlyWage, setBaseHourlyWage] = useState<number>(1000);

  // モーダルステート
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'work' | 'sales'>('work');
  const [selectedLogDetail, setSelectedLogDetail] = useState<any | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedCrop, setSelectedCrop] = useState<string>('');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [selectedWorkType, setSelectedWorkType] = useState<string>('');
  const [plannedDuration, setPlannedDuration] = useState<string>('');
  const [selectedMaterial, setSelectedMaterial] = useState<string>('');
  const [plannedMaterialQuantity, setPlannedMaterialQuantity] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [plannedQuantity, setPlannedQuantity] = useState<string>('');
  const [manualPrice, setManualPrice] = useState<string>('');

  useEffect(() => {
    fetchMasters();
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [currentDate]);

  useEffect(() => {
    const currentPriceObj = salesPrices.find(sp => sp.crop_name === selectedCrop && sp.channel_name === selectedChannel);
    if (currentPriceObj) {
      setManualPrice(String(currentPriceObj.price_per_unit));
    } else {
      setManualPrice('');
    }
  }, [selectedCrop, selectedChannel, salesPrices]);

  async function fetchMasters() {
    try {
      const [cRes, fRes, chRes, spRes, mRes] = await Promise.all([
        supabase.from('crops').select('id, name'),
        supabase.from('fields').select('id, name'),
        supabase.from('sales_channels').select('id, name'),
        supabase.from('sales_prices').select('*'),
        supabase.from('materials').select('id, name, default_price')
      ]);

      if (cRes.data) setCrops(cRes.data);
      if (fRes.data) setFields(fRes.data);
      if (chRes.data) setChannels(chRes.data);
      if (spRes.data) setSalesPrices(spRes.data);
      if (mRes.data) setMaterials(mRes.data);
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchPlans() {
    setIsLoading(true);
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    // 簡単のため1日から31日まで取得（存在しない日は無視される）
    const startOfMonth = `${year}-${month}-01`;
    const endOfMonth = `${year}-${month}-31`;

    try {
      const [workRes, salesRes] = await Promise.all([
        supabase.from('work_logs')
          .select('*, crops(name), fields(name), workers(name), materials(name, default_price)')
          .gte('work_date', startOfMonth)
          .lte('work_date', endOfMonth),
        supabase.from('sales_logs')
          .select('*, crops(name)')
          .gte('sales_date', startOfMonth)
          .lte('sales_date', endOfMonth)
      ]);

      if (workRes.data) setAllWorkLogs(workRes.data);
      if (salesRes.data) setAllSalesLogs(salesRes.data);
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

  const formatTime = (dateString: string) => {
    if (!dateString) return '-';
    const d = new Date(dateString);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // 月間サマリーの計算
  const monthlySummary = useMemo(() => {
    let plannedSales = 0;
    let plannedWorkHours = 0;
    let detailedMaterialCost = 0;
    
    allSalesLogs.forEach(s => {
      if (s.status === 'planned') {
        plannedSales += (s.total_sales || 0);
      }
    });
    
    allWorkLogs.forEach(w => {
      if (w.status === 'planned') {
        plannedWorkHours += (w.duration_minutes || 0) / 60;
        const qty = w.material_quantity || 0;
        const price = w.materials?.default_price || 0;
        detailedMaterialCost += (qty * price);
      }
    });

    const plannedLaborCost = plannedWorkHours * baseHourlyWage;
    const estimatedMaterialCost = Math.round(plannedSales * (estimateCostRate / 100));
    const finalMaterialCost = costCalculationMode === 'detailed' ? detailedMaterialCost : estimatedMaterialCost;
    const plannedCost = plannedLaborCost + finalMaterialCost;

    return {
      plannedSales,
      plannedCost,
      plannedLaborCost,
      finalMaterialCost,
      estimatedMaterialCost,
      plannedProfit: plannedSales - plannedCost,
      plannedWorkHours
    };
  }, [allSalesLogs, allWorkLogs, baseHourlyWage, costCalculationMode, estimateCostRate]);

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const openModal = (dateStr: string, cropName: string = '') => {
    setStartDate(dateStr);
    setEndDate(dateStr); // デフォルトは1日のみ
    setSelectedCrop(cropName);
    setSelectedFields([]);
    setSelectedWorkType('');
    setPlannedDuration('');
    setSelectedMaterial('');
    setPlannedMaterialQuantity('');
    setSelectedChannel('');
    setPlannedQuantity('');
    setManualPrice('');
    setIsModalOpen(true);
  };

  const parsedPrice = parseFloat(manualPrice) || 0;
  const calculatedTotal = plannedQuantity && parsedPrice ? parseFloat(plannedQuantity) * parsedPrice : 0;

  // 開始日〜終了日までの日付配列を生成する関数
  const generateDateRange = (start: string, end: string) => {
    const dates = [];
    let curr = new Date(start);
    const last = new Date(end);
    while (curr <= last) {
      dates.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (new Date(startDate) > new Date(endDate)) {
      setMessage({ text: '終了日は開始日以降の日付を指定してください', type: 'error' });
      return;
    }

    if (!selectedCrop) {
      setMessage({ text: '作目を選択してください', type: 'error' });
      return;
    }

    if (activeTab === 'work' && !selectedWorkType) {
      setMessage({ text: '作業内容を選択してください', type: 'error' });
      return;
    }

    if (activeTab === 'sales' && !selectedChannel) {
      setMessage({ text: '出荷予定先を選択してください', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const datesToInsert = generateDateRange(startDate, endDate);
      const cropId = crops.find(c => c.name === selectedCrop)?.id;

      if (activeTab === 'work') {
        const duration = plannedDuration ? parseInt(plannedDuration, 10) : null;
        const materialId = materials.find(m => m.name === selectedMaterial)?.id || null;
        const matQty = plannedMaterialQuantity ? parseFloat(plannedMaterialQuantity) : null;
        
        // 複数日分 × 複数圃場分 を一括作成
        const inserts: any[] = [];
        datesToInsert.forEach(dateStr => {
          if (selectedFields.length > 0) {
            selectedFields.forEach(fieldName => {
              const fieldId = fields.find(f => f.name === fieldName)?.id;
              inserts.push({
                crop_id: cropId || null,
                field_id: fieldId || null,
                work_type: selectedWorkType,
                work_date: dateStr,
                duration_minutes: duration,
                material_id: materialId,
                material_quantity: matQty,
                status: 'planned'
              });
            });
          } else {
            inserts.push({
              crop_id: cropId || null,
              field_id: null,
              work_type: selectedWorkType,
              work_date: dateStr,
              duration_minutes: duration,
              material_id: materialId,
              material_quantity: matQty,
              status: 'planned'
            });
          }
        });

        const { error } = await supabase.from('work_logs').insert(inserts);
        if (error) throw error;

      } else {
        const channelId = channels.find(c => c.name === selectedChannel)?.id;
        const qty = plannedQuantity ? parseFloat(plannedQuantity) : 0;
        const total = calculatedTotal > 0 ? calculatedTotal : null;

        const inserts = datesToInsert.map(dateStr => ({
          crop_id: cropId || null,
          channel_id: channelId || null,
          sales_date: dateStr,
          quantity: qty,
          unit: 'kg/箱',
          total_sales: total,
          status: 'planned'
        }));

        const { error } = await supabase.from('sales_logs').insert(inserts);
        if (error) throw error;
      }

      setMessage({ text: '予定を登録しました！', type: 'success' });
      fetchPlans();
      setTimeout(() => {
        setMessage(null);
        setIsModalOpen(false);
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setMessage({ text: 'エラー: ' + (err.message || '不明なエラーが発生しました'), type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // セルに表示するデータを抽出（予定と実績を分類）
  const getCellData = (itemId: string, dateStr: string) => {
    let works: any[] = [];
    let sales: any[] = [];
    
    if (ganttViewMode === 'byCrop') {
      works = allWorkLogs.filter(w => w.crop_id === itemId && w.work_date === dateStr);
      sales = allSalesLogs.filter(s => s.crop_id === itemId && s.sales_date === dateStr);
    } else {
      // 圃場別ビューの場合
      works = allWorkLogs.filter(w => w.field_id === itemId && w.work_date === dateStr);
      
      // その圃場に紐づく（作業予定・実績がある）作目IDのリストを取得
      const cropIdsInField = Array.from(new Set(
        allWorkLogs.filter(w => w.field_id === itemId).map(w => w.crop_id).filter(Boolean)
      ));
      
      // その圃場に関連する作目の売上目標を表示する
      sales = allSalesLogs.filter(s => cropIdsInField.includes(s.crop_id) && s.sales_date === dateStr);
    }
    
    // 同じ作業内容・作目でグループ化する
    const groupWorks = (workList: any[]) => {
      const groups: Record<string, any> = {};
      workList.forEach(w => {
        const key = `${w.work_type}_${w.crops?.name || 'unknown'}`;
        if (!groups[key]) {
          groups[key] = {
            work_type: w.work_type,
            crop_name: w.crops?.name || '不明',
            duration_minutes_total: 0,
            status: w.status,
            logs: []
          };
        }
        groups[key].duration_minutes_total += (w.duration_minutes || 0);
        groups[key].logs.push(w);
      });
      return Object.values(groups);
    };

    return {
      plannedWorks: groupWorks(works.filter(w => w.status === 'planned')),
      actualWorks: groupWorks(works.filter(w => w.status === 'completed')),
      plannedSales: sales.filter(s => s.status === 'planned'),
      actualSales: sales.filter(s => s.status === 'completed')
    };
  };

  // 行（作目または圃場）ごとの月間売上合計を計算
  const getRowSalesTotals = (itemId: string) => {
    let sales: any[] = [];
    if (ganttViewMode === 'byCrop') {
      sales = allSalesLogs.filter(s => s.crop_id === itemId);
    } else {
      const cropIdsInField = Array.from(new Set(allWorkLogs.filter(w => w.field_id === itemId).map(w => w.crop_id).filter(Boolean)));
      sales = allSalesLogs.filter(s => cropIdsInField.includes(s.crop_id));
    }
    const plannedSalesTotal = sales.filter(s => s.status === 'planned').reduce((sum, s) => sum + (s.total_sales || 0), 0);
    const actualSalesTotal = sales.filter(s => s.status === 'completed').reduce((sum, s) => sum + (s.total_sales || 0), 0);
    return { plannedSalesTotal, actualSalesTotal };
  };

  const rowItems = ganttViewMode === 'byCrop' ? crops : fields;

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <Target className="w-8 h-8 text-rose-500" />
            予実ガントチャート
          </h1>
          <p className="text-slate-500 mt-2 font-medium">作業予定や出荷目標（薄い色）と、実際の実績（濃い色）を比較できます。</p>
        </div>
        <button
          onClick={() => openModal(new Date().toISOString().split('T')[0])}
          className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          予定を追加
        </button>
      </div>

      {/* サマリーダッシュボード */}
      <div className="bg-slate-800 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
        {/* 装飾 */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-rose-500/10 rounded-full blur-2xl translate-y-1/2"></div>
        
        <div className="relative z-10">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-6 gap-4">
            <h2 className="text-xl font-black tracking-wider flex items-center gap-2">
              <Calculator className="w-5 h-5 text-amber-400" />
              {currentDate.getMonth() + 1}月の 予測サマリー
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              {/* コスト算出モード切替 */}
              <div className="flex items-center gap-1 bg-slate-700/50 p-1 rounded-xl backdrop-blur-sm border border-slate-600 relative group">
                <button
                  onClick={() => setCostCalculationMode('detailed')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    costCalculationMode === 'detailed' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'
                  }`}
                >
                  詳細入力で計算
                </button>
                <div className="relative">
                  <button
                    onClick={() => setCostCalculationMode('estimate')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                      costCalculationMode === 'estimate' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    概算金額(手入力)
                    <div className="w-3 h-3 rounded-full bg-slate-500 text-white flex items-center justify-center text-[8px] opacity-70">?</div>
                  </button>
                  {/* 説明ツールチップ */}
                  <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-slate-900 text-slate-200 text-xs rounded-xl p-3 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all font-medium leading-relaxed">
                    <span className="font-bold text-amber-400 block mb-1">概算入力とは？</span>
                    作付ごとの細かな資材入力が難しい場合に、「売上の〇〇%を資材経費とする」というざっくりとした割合を指定して、総コストや粗利の目安をシミュレーションするための機能です。
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-900"></div>
                  </div>
                </div>
              </div>
              
              {costCalculationMode === 'estimate' && (
                <div className="flex items-center gap-2 bg-slate-700/50 px-3 py-1.5 rounded-xl backdrop-blur-sm border border-slate-600">
                  <span className="text-xs font-bold text-slate-300">売上の</span>
                  <div className="flex items-center gap-1">
                    <input 
                      type="number" 
                      value={estimateCostRate}
                      onChange={(e) => setEstimateCostRate(Number(e.target.value) || 0)}
                      className="bg-slate-800 rounded w-12 px-1 font-black text-amber-400 text-right outline-none focus:ring-1 focus:ring-amber-400"
                    />
                    <span className="text-slate-400 text-sm">%</span>
                  </div>
                  <span className="text-[10px] text-slate-400 ml-1">(¥{monthlySummary.estimatedMaterialCost.toLocaleString()})</span>
                </div>
              )}

              <div className="flex items-center gap-2 bg-slate-700/50 px-3 py-1.5 rounded-xl backdrop-blur-sm border border-slate-600">
                <span className="text-xs font-bold text-slate-300">基準時給:</span>
                <div className="flex items-center gap-1">
                  <span className="text-slate-400 text-sm">¥</span>
                  <input 
                    type="number" 
                    value={baseHourlyWage}
                    onChange={(e) => setBaseHourlyWage(Number(e.target.value) || 0)}
                    className="bg-slate-800 rounded w-16 px-1 font-black text-white text-right outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  <span className="text-slate-400 text-xs">/h</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10">
              <div className="text-sm font-bold text-slate-400 mb-1">売上予測 (今月)</div>
              <div className="text-3xl font-black text-white">¥{monthlySummary.plannedSales.toLocaleString()}</div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10 relative group">
              <div className="text-sm font-bold text-slate-400 mb-1 flex items-center justify-between">
                <span>総コスト予測</span>
                <span className="text-[10px] bg-slate-700/50 px-2 py-0.5 rounded text-slate-300">人件費 + 資材費</span>
              </div>
              <div className="text-3xl font-black text-rose-300">¥{monthlySummary.plannedCost.toLocaleString()}</div>
              
              {/* コスト内訳ツールチップ */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-slate-900 text-white text-xs rounded-xl p-3 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-400">人件費 ({monthlySummary.plannedWorkHours.toFixed(1)}h)</span>
                  <span className="font-bold">¥{monthlySummary.plannedLaborCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-700 pt-1">
                  <span className="text-slate-400">資材費 ({costCalculationMode === 'detailed' ? '詳細' : '概算'})</span>
                  <span className="font-bold text-purple-300">¥{monthlySummary.finalMaterialCost.toLocaleString()}</span>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 backdrop-blur-md rounded-2xl p-5 border border-amber-500/30 relative overflow-hidden">
              <div className="absolute inset-0 bg-amber-400/5 mix-blend-overlay"></div>
              <div className="relative z-10">
                <div className="text-sm font-bold text-amber-200/80 mb-1">予測粗利 (売上 - コスト)</div>
                <div className="text-3xl font-black text-amber-400">¥{monthlySummary.plannedProfit.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* コントロールパネル */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setGanttViewMode('byCrop')}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${
              ganttViewMode === 'byCrop' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Sprout className="w-4 h-4" /> 作目別
          </button>
          <button
            onClick={() => setGanttViewMode('byField')}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${
              ganttViewMode === 'byField' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <MapPin className="w-4 h-4" /> 圃場別
          </button>
        </div>
        
        {ganttViewMode === 'byCrop' && (
          <div className="flex bg-slate-100 p-1 rounded-xl sm:ml-auto">
            <button
              onClick={() => setGanttFilter('all')}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                ganttFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              すべて表示
            </button>
            <button
              onClick={() => setGanttFilter('workOnly')}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                ganttFilter === 'workOnly' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              作業のみ
            </button>
            <button
              onClick={() => setGanttFilter('salesOnly')}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-1 ${
                ganttFilter === 'salesOnly' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Truck className="w-4 h-4" /> 売上予測マップ
            </button>
          </div>
        )}
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
            {/* 動的グリッドカラム: 120px(作目) + (日数分 x 55px) + 160px(合計) */}
            <div 
              className="min-w-max"
              style={{ display: 'grid', gridTemplateColumns: `120px repeat(${daysInMonth.length}, minmax(55px, 1fr)) 160px` }}
            >
              {/* ヘッダー行 */}
              <div className="sticky left-0 z-20 bg-slate-100 border-r border-b border-slate-200 p-3 font-bold text-slate-600 text-sm flex items-center justify-center">
                {ganttViewMode === 'byCrop' ? '作目' : '圃場'}
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
              {/* 合計カラムヘッダー */}
              <div className="sticky right-0 z-20 bg-amber-50/90 backdrop-blur border-l border-b border-amber-200 p-2 text-center font-black text-amber-800 text-xs shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)] flex flex-col justify-center">
                当月売上合計
              </div>

              {/* 行ループ */}
              {rowItems.map((item) => (
                <React.Fragment key={item.id}>
                  {/* ヘッダー (左固定) */}
                  <div className="sticky left-0 z-10 bg-white border-r border-b border-slate-100 p-3 flex items-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    <span className="font-bold text-slate-700 text-sm">{item.name}</span>
                  </div>
                  
                  {/* 日付セル */}
                  {daysInMonth.map((d, i) => {
                    const dateStr = d.toISOString().split('T')[0];
                    const { plannedWorks, actualWorks, plannedSales, actualSales } = getCellData(item.id, dateStr);
                    const isToday = dateStr === new Date().toISOString().split('T')[0];
                    
                    return (
                      <div 
                        key={i} 
                        onClick={() => openModal(dateStr, ganttViewMode === 'byCrop' ? item.name : '')}
                        className={`border-b border-r border-slate-100 p-1 min-h-[70px] relative hover:bg-slate-50 cursor-pointer transition-colors group ${isToday ? 'bg-amber-50/20' : ''}`}
                      >
                        <div className="flex flex-col gap-1 w-full relative z-0">
                          {/* 作業：予定 (薄い枠線) */}
                          {(ganttFilter === 'all' || ganttFilter === 'workOnly') && plannedWorks.map((group, idx) => (
                            <div key={`pw-${idx}`} onClick={(e) => { e.stopPropagation(); setSelectedLogDetail(group); }} className="bg-emerald-50 border border-emerald-300 border-dashed text-emerald-600 text-[10px] font-bold px-1 py-0.5 rounded truncate cursor-pointer hover:bg-emerald-100" title={`[予定] ${group.crop_name} - ${group.work_type} (${group.logs.length}件)`}>
                              予:{ganttViewMode === 'byField' ? `${group.crop_name}/` : ''}{group.work_type.substring(0, 2)}
                              {group.logs.length > 1 && <span className="ml-1 opacity-70">x{group.logs.length}</span>}
                            </div>
                          ))}
                          {/* 作業：実績 (濃いベタ塗り) */}
                          {(ganttFilter === 'all' || ganttFilter === 'workOnly') && actualWorks.map((group, idx) => (
                            <div key={`aw-${idx}`} onClick={(e) => { e.stopPropagation(); setSelectedLogDetail(group); }} className="bg-emerald-500 border border-emerald-600 text-white shadow-sm text-[10px] font-bold px-1 py-0.5 rounded truncate cursor-pointer hover:bg-emerald-400" title={`[実績] ${group.crop_name} - ${group.work_type} (${group.duration_minutes_total}分, ${group.logs.length}人)`}>
                              実:{ganttViewMode === 'byField' ? `${group.crop_name}/` : ''}{group.work_type.substring(0, 2)}
                              {group.logs.length > 1 && <span className="ml-1 opacity-90 text-[8px]">x{group.logs.length}</span>}
                            </div>
                          ))}

                          {/* 売上：予定 (薄い枠線) */}
                          {(ganttFilter === 'all' || ganttFilter === 'salesOnly') && plannedSales.map((s, idx) => (
                            <div key={`ps-${idx}`} className="bg-amber-50 border border-amber-300 border-dashed text-amber-600 text-[10px] font-bold px-1 py-0.5 rounded truncate" title={`[目標] 売上予測: ¥${s.total_sales?.toLocaleString() || '-'}`}>
                              目:¥{(s.total_sales / 1000).toFixed(0)}k
                            </div>
                          ))}
                          {/* 売上：実績 (濃いベタ塗り) */}
                          {(ganttFilter === 'all' || ganttFilter === 'salesOnly') && actualSales.map((s, idx) => (
                            <div key={`as-${idx}`} className="bg-amber-500 border border-amber-600 text-white shadow-sm text-[10px] font-bold px-1 py-0.5 rounded truncate" title={`[実績] 売上: ¥${s.total_sales?.toLocaleString() || '-'}`}>
                              実:¥{(s.total_sales / 1000).toFixed(0)}k
                            </div>
                          ))}
                        </div>
                        
                        {/* ホバー時の＋アイコン */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <div className="bg-rose-500 text-white rounded-full p-1 shadow-lg">
                            <Plus className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* 行の右端：月間売上合計カラム */}
                  {(() => {
                    const { plannedSalesTotal, actualSalesTotal } = getRowSalesTotals(item.id);
                    const progress = plannedSalesTotal > 0 ? Math.min(100, Math.round((actualSalesTotal / plannedSalesTotal) * 100)) : 0;
                    
                    return (
                      <div className="sticky right-0 z-10 bg-white border-l border-b border-slate-100 p-2 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                        {ganttFilter !== 'workOnly' ? (
                          <div className="flex flex-col h-full justify-center gap-1.5">
                            <div className="flex justify-between items-center text-[10px] font-bold">
                              <span className="text-amber-500">目標:</span>
                              <span className="text-slate-700">¥{plannedSalesTotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-black">
                              <span className="text-amber-600">実績:</span>
                              <span className="text-amber-600">¥{actualSalesTotal.toLocaleString()}</span>
                            </div>
                            
                            {/* プログレスバー */}
                            {plannedSalesTotal > 0 && (
                              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                                <div 
                                  className={`h-full ${progress >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                                  style={{ width: `${progress}%` }}
                                ></div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex h-full items-center justify-center text-slate-300 text-xs font-bold bg-slate-50 rounded">
                            非表示
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* レジェンド (凡例) */}
      <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500 mt-2 px-2">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-emerald-50 border border-emerald-300 border-dashed rounded"></div>作業予定</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-emerald-500 border border-emerald-600 rounded"></div>作業実績</div>
        <div className="flex items-center gap-1.5 ml-4"><div className="w-3 h-3 bg-amber-50 border border-amber-300 border-dashed rounded"></div>売上目標</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-amber-500 border border-amber-600 rounded"></div>売上実績</div>
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
                    <label className="block text-xs font-bold text-slate-500 mb-1">開始日</label>
                    <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); if(e.target.value > endDate) setEndDate(e.target.value); }} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:border-rose-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">終了日</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required min={startDate} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:border-rose-500 focus:outline-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">作目</label>
                  <select value={selectedCrop} onChange={e => setSelectedCrop(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:border-rose-500 focus:outline-none">
                    <option value="">選択</option>
                    {crops.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>

                {activeTab === 'work' ? (
                  <>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <label className="block text-xs font-bold text-slate-500 mb-2">圃場 (複数選択可)</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {fields.map(f => (
                            <label key={f.id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-emerald-50 transition-colors">
                              <input 
                                type="checkbox" 
                                checked={selectedFields.includes(f.name)}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedFields([...selectedFields, f.name]);
                                  else setSelectedFields(selectedFields.filter(n => n !== f.name));
                                }}
                                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-slate-300"
                              />
                              <span className="text-sm font-bold text-slate-700">{f.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">作業内容</label>
                          <select value={selectedWorkType} onChange={e => setSelectedWorkType(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:border-emerald-500 focus:outline-none">
                            <option value="">選択</option>
                            {workTypes.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">予定時間 (分) <span className="text-slate-400 font-normal ml-1">※任意</span></label>
                          <input type="number" value={plannedDuration} onChange={e => setPlannedDuration(e.target.value)} placeholder="空欄でもOK" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-lg focus:border-emerald-500 focus:outline-none placeholder:font-normal placeholder:text-sm" />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">使用資材 <span className="text-slate-400 font-normal ml-1">※任意</span></label>
                          <select value={selectedMaterial} onChange={e => setSelectedMaterial(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:border-emerald-500 focus:outline-none">
                            <option value="">資材を選択 (空欄可)</option>
                            {materials.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">予定数量</label>
                          <input type="number" value={plannedMaterialQuantity} onChange={e => setPlannedMaterialQuantity(e.target.value)} disabled={!selectedMaterial} placeholder={selectedMaterial ? "数量" : "資材を選択"} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-lg focus:border-emerald-500 focus:outline-none placeholder:font-normal placeholder:text-sm disabled:opacity-50" />
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">出荷予定先</label>
                      <select value={selectedChannel} onChange={e => setSelectedChannel(e.target.value)} required disabled={!selectedCrop} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:border-amber-500 focus:outline-none">
                        <option value="">{selectedCrop ? "選択してください" : "先に作目を選択"}</option>
                        {salesPrices.filter(sp => sp.crop_name === selectedCrop).map(sp => (
                          <option key={sp.id} value={sp.channel_name}>{sp.channel_name} (基準: ¥{sp.price_per_unit})</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">予定単価 (¥) <span className="text-slate-400 font-normal ml-1">※変更可</span></label>
                        <input type="number" value={manualPrice} onChange={e => setManualPrice(e.target.value)} placeholder="0" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-lg focus:border-amber-500 focus:outline-none placeholder:font-normal placeholder:text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">予定数量 <span className="text-slate-400 font-normal ml-1">※任意</span></label>
                        <input type="number" value={plannedQuantity} onChange={e => setPlannedQuantity(e.target.value)} placeholder="空欄でもOKです" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-lg focus:border-amber-500 focus:outline-none placeholder:font-normal placeholder:text-sm" />
                      </div>
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

      {/* 詳細確認モーダル (グループ化対応) */}
      {selectedLogDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedLogDetail(null)}>
          <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white/80 backdrop-blur-md px-6 py-4 border-b border-slate-100 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg ${selectedLogDetail.status === 'planned' ? 'bg-emerald-50 border border-emerald-200 text-emerald-500' : 'bg-emerald-100 text-emerald-700'}`}>
                  {selectedLogDetail.work_type.substring(0, 1)}
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                    {selectedLogDetail.crop_name} - {selectedLogDetail.work_type}
                    {selectedLogDetail.status === 'planned' && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold">予定</span>}
                  </h3>
                  <p className="text-sm font-bold text-slate-500">
                    作業記録: {selectedLogDetail.logs.length}件 / 合計時間: {selectedLogDetail.duration_minutes_total}分
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedLogDetail(null)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 bg-slate-50 min-h-[50vh]">
              <div className="space-y-4">
                {selectedLogDetail.logs.map((log: any, idx: number) => (
                  <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                    <div className="flex flex-col md:flex-row gap-6">
                      
                      {/* 左側：担当者と時間 */}
                      <div className="flex-shrink-0 md:w-1/3 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold">
                            {(log.workers?.name || '?').slice(0,1)}
                          </div>
                          <div>
                            <div className="font-black text-slate-700">{log.workers?.name || '担当者未定'}</div>
                            <div className="text-xs text-slate-400 font-bold">{log.work_date}</div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold text-slate-400">作業時間</span>
                          <span className="font-black text-emerald-600 text-xl">{log.duration_minutes ? `${log.duration_minutes} 分` : '-'}</span>
                          {log.start_time && (
                            <span className="text-xs text-slate-500 font-medium">
                              {formatTime(log.start_time)} ~ {formatTime(log.end_time)}
                            </span>
                          )}
                        </div>
                        
                        {log.fields && (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-bold text-slate-400">圃場</span>
                            <span className="font-bold text-slate-600 text-sm flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400" /> {log.fields.name}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 右側：資材、メモ、写真 */}
                      <div className="flex-grow space-y-4 md:border-l md:border-slate-100 md:pl-6">
                        {log.material_quantity && (
                          <div className="bg-purple-50 p-3 rounded-xl border border-purple-100">
                            <div className="text-xs font-bold text-purple-500 mb-1 flex items-center gap-1">
                              <Sprout className="w-3 h-3" /> 使用資材
                            </div>
                            <div className="font-bold text-purple-700 text-sm">
                              {log.materials?.name} <span className="opacity-70 text-xs ml-1">(使用量: {log.material_quantity})</span>
                            </div>
                          </div>
                        )}
                        
                        {log.memo && (
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <div className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-1">
                              <FileText className="w-3 h-3" /> メモ
                            </div>
                            <div className="text-slate-600 text-sm whitespace-pre-wrap">{log.memo}</div>
                          </div>
                        )}

                        {log.photo_url && (
                          <div>
                            <div className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-1">
                              <ImageIcon className="w-3 h-3" /> 写真
                            </div>
                            <img src={log.photo_url} alt="作業写真" className="rounded-xl w-32 h-32 object-cover border border-slate-200" />
                          </div>
                        )}
                        
                        {!log.material_quantity && !log.memo && !log.photo_url && (
                          <div className="text-slate-400 text-sm italic py-4">特記事項なし</div>
                        )}
                      </div>
                      
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
