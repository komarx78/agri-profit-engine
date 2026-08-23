"use client";

import React, { useState, useMemo } from 'react';
import { 
  Sprout, 
  FlaskConical, 
  PenTool, 
  Bug, 
  Ruler, 
  Package, 
  Coins, 
  X, 
  Check, 
  Calendar, 
  Clock, 
  Loader2, 
  AlertCircle,
  FileText,
  MapPin,
  Calculator,
  Layers
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export interface CultivationTarget {
  id: string; // plan_id または field_id + crop_id
  fieldId: string;
  fieldName: string;
  cropId?: string;
  cropName: string;
  areaAcre?: number; // a (アール)
  startDate?: string;
}

interface CultivationActionSheetProps {
  selectedCultivations: CultivationTarget[];
  onClearSelection: () => void;
  onSuccess: (message: string) => void;
}

type ActionCategory = 'fertilizer' | 'pesticide' | 'work' | 'pest' | 'growth' | 'shipment' | 'sales' | null;

// 肥料プリセットマスター
interface FertilizerPreset {
  name: string;
  n: number; // %
  p: number; // %
  k: number; // %
  bagWeight: number; // kg
  pricePerBag: number; // 円
}

const FERTILIZER_PRESETS: FertilizerPreset[] = [
  { name: '普通化成肥料 (8-8-8)', n: 8, p: 8, k: 8, bagWeight: 20, pricePerBag: 2400 },
  { name: '高度化成肥料 (14-14-14)', n: 14, p: 14, k: 14, bagWeight: 20, pricePerBag: 3800 },
  { name: '有機配合肥料 (10-8-8)', n: 10, p: 8, k: 8, bagWeight: 20, pricePerBag: 3200 },
  { name: '発酵鶏ふん (3-5-2)', n: 3.0, p: 5.0, k: 2.0, bagWeight: 15, pricePerBag: 350 },
  { name: '完熟牛ふん堆肥 (1-1-1)', n: 1.2, p: 1.5, k: 1.0, bagWeight: 40, pricePerBag: 600 },
  { name: '尿素 (46-0-0)', n: 46, p: 0, k: 0, bagWeight: 20, pricePerBag: 4200 },
  { name: '過リン酸石灰 (0-20-0)', n: 0, p: 20, k: 0, bagWeight: 20, pricePerBag: 2800 },
  { name: '塩化加里 (0-0-60)', n: 0, p: 0, k: 60, bagWeight: 20, pricePerBag: 4500 },
  { name: 'その他（手入力）', n: 0, p: 0, k: 0, bagWeight: 20, pricePerBag: 0 }
];

export const CultivationActionSheet: React.FC<CultivationActionSheetProps> = ({
  selectedCultivations,
  onClearSelection,
  onSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'record' | 'plan'>('record');
  const [activeCategory, setActiveCategory] = useState<ActionCategory>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 共通フォームステート
  const [formDate, setFormDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [durationMinutes, setDurationMinutes] = useState<string>('60');
  const [memo, setMemo] = useState<string>('');

  // 作業用
  const [workType, setWorkType] = useState<string>('定植');

  // 肥料専用ステート
  const [selectedFertilizerName, setSelectedFertilizerName] = useState<string>(FERTILIZER_PRESETS[0].name);
  const [fertilizerType, setFertilizerType] = useState<'元肥' | '追肥1回目' | '追肥2回目' | '土壌改良' | '葉面散布'>('元肥');
  const [fertInputMode, setFertInputMode] = useState<'bags' | 'kg'>('bags');
  const [fertBags, setFertBags] = useState<string>('3'); // 袋数
  const [fertTotalKg, setFertTotalKg] = useState<string>('60'); // kg
  const [customN, setCustomN] = useState<string>('8');
  const [customP, setCustomP] = useState<string>('8');
  const [customK, setCustomK] = useState<string>('8');
  const [fertPricePerBag, setFertPricePerBag] = useState<string>('2400');

  // その他の品名・数量・金額
  const [itemName, setItemName] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [unit, setUnit] = useState<string>('kg');
  const [priceAmount, setPriceAmount] = useState<string>('');

  // 選択中圃場の合計面積(a)
  const totalAreaAcre = useMemo(() => {
    return selectedCultivations.reduce((sum, c) => sum + (c.areaAcre || 10), 0);
  }, [selectedCultivations]);

  // 肥料成分のリアルタイム計算
  const fertCalculation = useMemo(() => {
    const preset = FERTILIZER_PRESETS.find(p => p.name === selectedFertilizerName);
    const nRatio = preset && preset.name !== 'その他（手入力）' ? preset.n : (parseFloat(customN) || 0);
    const pRatio = preset && preset.name !== 'その他（手入力）' ? preset.p : (parseFloat(customP) || 0);
    const kRatio = preset && preset.name !== 'その他（手入力）' ? preset.k : (parseFloat(customK) || 0);
    const bagKg = preset ? preset.bagWeight : 20;
    const bagPrice = preset && preset.name !== 'その他（手入力）' ? preset.pricePerBag : (parseFloat(fertPricePerBag) || 0);

    let totalWeightKg = 0;
    let bagsCount = 0;

    if (fertInputMode === 'bags') {
      bagsCount = parseFloat(fertBags) || 0;
      totalWeightKg = bagsCount * bagKg;
    } else {
      totalWeightKg = parseFloat(fertTotalKg) || 0;
      bagsCount = bagKg > 0 ? totalWeightKg / bagKg : 0;
    }

    // 10a (1反) あたりの施肥量
    const weightPer10a = totalAreaAcre > 0 ? (totalWeightKg / totalAreaAcre) * 10 : totalWeightKg;

    // N-P-K 純成分量 (kg/10a)
    const nPer10a = (weightPer10a * nRatio) / 100;
    const pPer10a = (weightPer10a * pRatio) / 100;
    const kPer10a = (weightPer10a * kRatio) / 100;

    // 概算総コスト (円)
    const totalCost = bagsCount * bagPrice;

    return {
      totalWeightKg: Math.round(totalWeightKg * 10) / 10,
      bagsCount: Math.round(bagsCount * 10) / 10,
      nPer10a: Math.round(nPer10a * 10) / 10,
      pPer10a: Math.round(pPer10a * 10) / 10,
      kPer10a: Math.round(kPer10a * 10) / 10,
      totalCost: Math.round(totalCost)
    };
  }, [selectedFertilizerName, fertInputMode, fertBags, fertTotalKg, customN, customP, customK, fertPricePerBag, totalAreaAcre]);

  if (selectedCultivations.length === 0) {
    return null;
  }

  const handleOpenModal = (category: ActionCategory) => {
    setActiveCategory(category);
    setErrorMessage('');
    setMemo('');
    setQuantity('');
    setPriceAmount('');

    if (category === 'fertilizer') {
      setSelectedFertilizerName(FERTILIZER_PRESETS[0].name);
      setFertilizerType('元肥');
      setFertBags('3');
      setFertPricePerBag(String(FERTILIZER_PRESETS[0].pricePerBag));
    } else if (category === 'pesticide') {
      setItemName('カスケード乳剤');
      setUnit('ml');
    } else if (category === 'work') {
      setWorkType('定植');
    } else if (category === 'pest') {
      setItemName('アブラムシ類');
    } else if (category === 'growth') {
      setItemName('草丈・本葉展開');
    } else if (category === 'shipment') {
      setItemName('JA出荷');
      setUnit('kg');
    } else if (category === 'sales') {
      setItemName('直売所売上');
      setUnit('円');
    }
  };

  const handleCloseModal = () => {
    setActiveCategory(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const isRecord = activeTab === 'record';
      const timestamp = new Date().toISOString();

      if (activeCategory === 'fertilizer') {
        // 肥料（施肥）の登録: work_logs と material_costs に連動
        const fertMemoText = `[施肥:${fertilizerType}] ${selectedFertilizerName} ${fertCalculation.totalWeightKg}kg (${fertCalculation.bagsCount}袋) | N:${fertCalculation.nPer10a}kg P:${fertCalculation.pPer10a}kg K:${fertCalculation.kPer10a}kg/10a | 費用:¥${fertCalculation.totalCost.toLocaleString()} ${memo}`.trim();

        // 1. work_logs へ Insert
        const workRecords = selectedCultivations.map(c => ({
          field_id: c.fieldId || null,
          crop_id: c.cropId || null,
          work_date: formDate,
          work_type: `施肥 (${fertilizerType})`,
          duration_minutes: parseInt(durationMinutes, 10) || 60,
          status: isRecord ? 'completed' : 'planned',
          memo: `[一括${isRecord ? '記録' : '予定'}] ${fertMemoText}`,
          created_at: timestamp
        }));
        const { error: workErr } = await supabase.from('work_logs').insert(workRecords);
        if (workErr) throw workErr;

        // 2. 実績の場合、資材経費 (material_costs) にも原価を自動計上
        if (isRecord && fertCalculation.totalCost > 0) {
          const costPerField = fertCalculation.totalCost / selectedCultivations.length;
          const costRecords = selectedCultivations.map(c => ({
            crop_id: c.cropId || null,
            expense_date: formDate,
            item_name: `肥料: ${selectedFertilizerName} (${fertilizerType}) - ${c.fieldName}`,
            amount: Math.round(costPerField),
            memo: fertMemoText,
            created_at: timestamp
          }));
          await supabase.from('material_costs').insert(costRecords);
        }

      } else if (activeCategory === 'shipment' || activeCategory === 'sales') {
        // sales_logs に一括登録
        const recordsToInsert = selectedCultivations.map(c => ({
          field_id: c.fieldId || null,
          crop_id: c.cropId || null,
          sales_date: formDate,
          quantity: activeCategory === 'shipment' ? (parseFloat(quantity) || 0) : (parseFloat(quantity) || 1),
          unit: unit || 'kg',
          total_sales: activeCategory === 'sales' ? (parseFloat(priceAmount) || 0) : null,
          memo: `[一括${isRecord ? '記録' : '予定'}:${activeCategory === 'shipment' ? '出荷' : '売上'}] ${itemName} ${memo}`.trim(),
          created_at: timestamp
        }));
        const { error } = await supabase.from('sales_logs').insert(recordsToInsert);
        if (error) throw error;

      } else {
        // 通常作業・農薬・病害虫・生育調査の work_logs 登録
        const typeLabelMap: Record<string, string> = {
          pesticide: '農薬散布',
          work: workType || '一般作業',
          pest: '病害虫記録',
          growth: '生育調査'
        };

        const recordsToInsert = selectedCultivations.map(c => ({
          field_id: c.fieldId || null,
          crop_id: c.cropId || null,
          work_date: formDate,
          work_type: typeLabelMap[activeCategory || 'work'] || '農作業',
          duration_minutes: parseInt(durationMinutes, 10) || 0,
          status: isRecord ? 'completed' : 'planned',
          memo: `[一括${isRecord ? '記録' : '予定'}] ${itemName ? `品名:${itemName} ` : ''}${quantity ? `数量:${quantity}${unit} ` : ''}${memo}`.trim(),
          created_at: timestamp
        }));

        const { error } = await supabase.from('work_logs').insert(recordsToInsert);
        if (error) throw error;
      }

      onSuccess(`${selectedCultivations.length}件の作付けに一括${isRecord ? '記録' : '予定'}を登録しました！`);
      handleCloseModal();
      onClearSelection();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || '登録中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = [
    { id: 'fertilizer' as const, label: '肥料', icon: Sprout, color: 'bg-amber-100 text-amber-600 border-amber-300 hover:bg-amber-200' },
    { id: 'pesticide' as const, label: '農薬', icon: FlaskConical, color: 'bg-rose-100 text-rose-600 border-rose-300 hover:bg-rose-200' },
    { id: 'work' as const, label: '作業', icon: PenTool, color: 'bg-emerald-100 text-emerald-600 border-emerald-300 hover:bg-emerald-200' },
    { id: 'pest' as const, label: '病害虫', icon: Bug, color: 'bg-stone-100 text-stone-600 border-stone-300 hover:bg-stone-200' },
    { id: 'growth' as const, label: '生育調査', icon: Ruler, color: 'bg-cyan-100 text-cyan-600 border-cyan-300 hover:bg-cyan-200' },
    { id: 'shipment' as const, label: '出荷', icon: Package, color: 'bg-blue-100 text-blue-600 border-blue-300 hover:bg-blue-200' },
    { id: 'sales' as const, label: '売上', icon: Coins, color: 'bg-yellow-100 text-yellow-600 border-yellow-300 hover:bg-yellow-200' },
  ];

  return (
    <>
      {/* 画面下部に固定されるボトムシートバー */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl transition-all duration-300 animate-in slide-in-from-bottom-5">
        <div className="max-w-5xl mx-auto px-4 py-3 sm:px-6">
          
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-100 rounded-full border border-emerald-200">
                {selectedCultivations.length} 件選択中
              </span>
              <span className="text-xs text-slate-500 hidden sm:inline font-medium">
                合計面積: {totalAreaAcre.toFixed(1)} a
              </span>
              <button
                onClick={onClearSelection}
                className="text-xs text-slate-500 hover:text-rose-600 underline ml-2 transition-colors"
              >
                選択解除
              </button>
            </div>

            {/* 「記録」と「予定」の切り替えタブ */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab('record')}
                className={`px-5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'record'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                記録 (実績)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('plan')}
                className={`px-5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'plan'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                予定 (指示)
              </button>
            </div>
          </div>

          {/* 7大アクション丸アイコンボタン群 */}
          <div className="grid grid-cols-7 gap-2 sm:gap-4 pt-1">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleOpenModal(cat.id)}
                  className="flex flex-col items-center justify-center group focus:outline-none"
                >
                  <div className={`w-11 h-11 sm:w-13 sm:h-13 rounded-2xl flex items-center justify-center border transition-all duration-200 group-hover:scale-105 group-active:scale-95 shadow-sm ${cat.color}`}>
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <span className="text-[11px] sm:text-xs font-bold text-slate-700 mt-1.5 group-hover:text-emerald-700 transition-colors">
                    {cat.label}
                  </span>
                </button>
              );
            })}
          </div>

        </div>
      </div>

      {/* 一括入力モーダル */}
      {activeCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            
            {/* モーダルヘッダー */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${categories.find(c => c.id === activeCategory)?.color}`}>
                  {React.createElement(categories.find(c => c.id === activeCategory)?.icon || FileText, { className: 'w-4 h-4' })}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    一括{activeTab === 'record' ? '記録' : '予定'}登録：{categories.find(c => c.id === activeCategory)?.label}
                  </h3>
                  <p className="text-xs text-slate-500">
                    選択中の {selectedCultivations.length} 圃場 (計 {totalAreaAcre.toFixed(1)}a) に保存されます
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 対象一覧プレビュー */}
            <div className="px-6 py-2 bg-emerald-50/60 border-b border-emerald-100 flex items-center gap-2 overflow-x-auto text-xs text-emerald-800">
              <MapPin className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
              <span className="font-semibold shrink-0">対象:</span>
              <div className="flex gap-1.5 flex-nowrap">
                {selectedCultivations.map((c, i) => (
                  <span key={i} className="bg-white px-2 py-0.5 rounded-md border border-emerald-200 font-medium whitespace-nowrap">
                    {c.cropName} ({c.fieldName})
                  </span>
                ))}
              </div>
            </div>

            {/* モーダルフォーム */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* 日付 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {activeTab === 'record' ? '実施日' : '予定日'}
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>
              </div>

              {/* ========================================================= */}
              {/* 肥料専用入力ブロック（N-P-K計算 & コスト連動） */}
              {/* ========================================================= */}
              {activeCategory === 'fertilizer' && (
                <div className="space-y-3.5 p-4 bg-amber-50/50 border border-amber-200 rounded-2xl">
                  
                  {/* 施肥区分 */}
                  <div>
                    <label className="block text-xs font-bold text-amber-900 mb-1.5">施肥区分</label>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-center">
                      {(['元肥', '追肥1回目', '追肥2回目', '土壌改良', '葉面散布'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setFertilizerType(t)}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all border ${
                            fertilizerType === t
                              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                              : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 肥料選択 */}
                  <div>
                    <label className="block text-xs font-bold text-amber-900 mb-1.5">肥料・資材名</label>
                    <select
                      value={selectedFertilizerName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedFertilizerName(val);
                        const preset = FERTILIZER_PRESETS.find(p => p.name === val);
                        if (preset && preset.name !== 'その他（手入力）') {
                          setFertPricePerBag(String(preset.pricePerBag));
                        }
                      }}
                      className="w-full px-3 py-2 text-sm bg-white border border-amber-300 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      {FERTILIZER_PRESETS.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name} {p.name !== 'その他（手入力）' ? `(単価:約¥${p.pricePerBag.toLocaleString()}/袋)` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 施肥量入力（袋数 または kg） */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold text-amber-900">投入量</label>
                        <div className="flex text-[10px] font-bold bg-amber-200/60 p-0.5 rounded-md">
                          <button
                            type="button"
                            onClick={() => setFertInputMode('bags')}
                            className={`px-1.5 py-0.5 rounded ${fertInputMode === 'bags' ? 'bg-white text-amber-900 shadow-xs' : 'text-amber-700'}`}
                          >
                            袋数
                          </button>
                          <button
                            type="button"
                            onClick={() => setFertInputMode('kg')}
                            className={`px-1.5 py-0.5 rounded ${fertInputMode === 'kg' ? 'bg-white text-amber-900 shadow-xs' : 'text-amber-700'}`}
                          >
                            kg
                          </button>
                        </div>
                      </div>

                      {fertInputMode === 'bags' ? (
                        <div className="relative">
                          <input
                            type="number"
                            step="any"
                            value={fertBags}
                            onChange={(e) => setFertBags(e.target.value)}
                            placeholder="3"
                            className="w-full px-3 py-2 text-sm bg-white border border-amber-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">袋</span>
                        </div>
                      ) : (
                        <div className="relative">
                          <input
                            type="number"
                            step="any"
                            value={fertTotalKg}
                            onChange={(e) => setFertTotalKg(e.target.value)}
                            placeholder="60"
                            className="w-full px-3 py-2 text-sm bg-white border border-amber-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">kg</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-amber-900 mb-1.5">袋単価 (概算)</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={fertPricePerBag}
                          onChange={(e) => setFertPricePerBag(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white border border-amber-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">円/袋</span>
                      </div>
                    </div>
                  </div>

                  {/* N-P-K 成分量 ＆ コスト自動計算サマリー */}
                  <div className="p-3 bg-white border border-amber-200 rounded-xl shadow-xs space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                      <span className="flex items-center gap-1">
                        <Calculator className="w-3.5 h-3.5 text-amber-600" />
                        10aあたり純成分投入量 (kg/10a)
                      </span>
                      <span className="text-amber-700">総量: {fertCalculation.totalWeightKg}kg</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="text-[10px] font-extrabold text-blue-600">N (窒素)</div>
                        <div className="text-sm font-black text-blue-900">{fertCalculation.nPer10a} <span className="text-[10px]">kg</span></div>
                      </div>
                      <div className="p-2 bg-orange-50 border border-orange-200 rounded-lg">
                        <div className="text-[10px] font-extrabold text-orange-600">P (リン酸)</div>
                        <div className="text-sm font-black text-orange-900">{fertCalculation.pPer10a} <span className="text-[10px]">kg</span></div>
                      </div>
                      <div className="p-2 bg-purple-50 border border-purple-200 rounded-lg">
                        <div className="text-[10px] font-extrabold text-purple-600">K (カリ)</div>
                        <div className="text-sm font-black text-purple-900">{fertCalculation.kPer10a} <span className="text-[10px]">kg</span></div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-amber-100 text-xs font-bold">
                      <span className="text-slate-600">概算肥料原価 (合計):</span>
                      <span className="text-emerald-700 text-sm font-black">¥{fertCalculation.totalCost.toLocaleString()}</span>
                    </div>
                  </div>

                </div>
              )}

              {/* 作業内容 */}
              {activeCategory === 'work' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">作業内容</label>
                  <select
                    value={workType}
                    onChange={(e) => setWorkType(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  >
                    <option value="播種">播種（種まき）</option>
                    <option value="定植">定植（植え付け）</option>
                    <option value="水やり・灌水">水やり・灌水</option>
                    <option value="草引き・除草">草引き・除草</option>
                    <option value="剪定・整枝">剪定・整枝・芽かき</option>
                    <option value="収穫・調製">収穫・調製</option>
                    <option value="片付け・耕起">片付け・耕起</option>
                    <option value="その他">その他管理作業</option>
                  </select>
                </div>
              )}

              {/* 農薬・病害虫・生育調査・出荷・売上の一般名称入力 */}
              {(activeCategory === 'pesticide' || activeCategory === 'pest' || activeCategory === 'growth' || activeCategory === 'shipment' || activeCategory === 'sales') && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      {activeCategory === 'pesticide' && '農薬名'}
                      {activeCategory === 'pest' && '病害虫・雑草名'}
                      {activeCategory === 'growth' && '調査項目'}
                      {activeCategory === 'shipment' && '出荷先 / 販路'}
                      {activeCategory === 'sales' && '販売先・用途'}
                    </label>
                    {activeCategory === 'pesticide' && (
                      <a
                        href="/admin/spray-management"
                        className="text-[11px] font-bold text-rose-600 hover:text-rose-800 underline flex items-center gap-1"
                      >
                        残回数・RAC管理画面を開く ➔
                      </a>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="名称を入力してください"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>
              )}

              {/* 数量・単位 (出荷・売上・農薬等) */}
              {(activeCategory === 'pesticide' || activeCategory === 'shipment' || activeCategory === 'sales') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">数量 (各圃場あたり)</label>
                    <input
                      type="number"
                      step="any"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="例: 10"
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">単位</label>
                    <input
                      type="text"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="kg, L, 箱 など"
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                </div>
              )}

              {/* 売上金額 */}
              {activeCategory === 'sales' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">売上金額 (円)</label>
                  <div className="relative">
                    <Coins className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      value={priceAmount}
                      onChange={(e) => setPriceAmount(e.target.value)}
                      placeholder="例: 50000"
                      className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium"
                    />
                  </div>
                </div>
              )}

              {/* 所要時間 */}
              {activeCategory !== 'sales' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">所要時間 (分/圃場)</label>
                  <div className="relative">
                    <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(e.target.value)}
                      placeholder="60"
                      className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium"
                    />
                  </div>
                </div>
              )}

              {/* メモ */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">備考・メモ</label>
                <textarea
                  rows={2}
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="施肥機設定、作業メモ等"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium resize-none"
                />
              </div>

              {/* ボタン */}
              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-100 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>保存中...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>一括{activeTab === 'record' ? '記録' : '予定'}を保存</span>
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}
    </>
  );
};
