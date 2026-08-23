"use client";

import React, { useState } from 'react';
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
  MapPin
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export interface CultivationTarget {
  id: string; // plan_id または field_id + crop_id
  fieldId: string;
  fieldName: string;
  cropId?: string;
  cropName: string;
  areaAcre?: number;
  startDate?: string;
}

interface CultivationActionSheetProps {
  selectedCultivations: CultivationTarget[];
  onClearSelection: () => void;
  onSuccess: (message: string) => void;
}

type ActionCategory = 'fertilizer' | 'pesticide' | 'work' | 'pest' | 'growth' | 'shipment' | 'sales' | null;

export const CultivationActionSheet: React.FC<CultivationActionSheetProps> = ({
  selectedCultivations,
  onClearSelection,
  onSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'record' | 'plan'>('record');
  const [activeCategory, setActiveCategory] = useState<ActionCategory>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // フォーム用ステート
  const [formDate, setFormDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [workType, setWorkType] = useState<string>('播種');
  const [itemName, setItemName] = useState<string>(''); // 肥料名/農薬名/出荷先など
  const [quantity, setQuantity] = useState<string>('');
  const [unit, setUnit] = useState<string>('kg');
  const [durationMinutes, setDurationMinutes] = useState<string>('60');
  const [priceAmount, setPriceAmount] = useState<string>('');
  const [memo, setMemo] = useState<string>('');

  if (selectedCultivations.length === 0) {
    return null;
  }

  const handleOpenModal = (category: ActionCategory) => {
    setActiveCategory(category);
    setErrorMessage('');
    setMemo('');
    setQuantity('');
    setPriceAmount('');

    // カテゴリごとのデフォルト値
    if (category === 'fertilizer') {
      setItemName('元肥（化成肥料8-8-8）');
      setUnit('kg');
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

      if (activeCategory === 'shipment' || activeCategory === 'sales') {
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
        // work_logs に一括登録
        const typeLabelMap: Record<string, string> = {
          fertilizer: '肥料（施肥）',
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
          
          {/* 上部ヘッダー：選択件数・全解除・タブ切り替え */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-100 rounded-full border border-emerald-200">
                {selectedCultivations.length} 件選択中
              </span>
              <span className="text-xs text-slate-500 hidden sm:inline">
                ({selectedCultivations.map(c => `${c.cropName}・${c.fieldName}`).slice(0, 2).join(', ')}
                {selectedCultivations.length > 2 ? ` ほか${selectedCultivations.length - 2}件` : ''})
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
                    選択中の {selectedCultivations.length} 圃場・作付けにまとめて保存されます
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
            <div className="px-6 py-2.5 bg-emerald-50/60 border-b border-emerald-100 flex items-center gap-2 overflow-x-auto text-xs text-emerald-800">
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

              {/* カテゴリに応じた固有項目 */}
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

              {(activeCategory === 'fertilizer' || activeCategory === 'pesticide' || activeCategory === 'pest' || activeCategory === 'growth' || activeCategory === 'shipment' || activeCategory === 'sales') && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {activeCategory === 'fertilizer' && '肥料・資材名'}
                    {activeCategory === 'pesticide' && '農薬名'}
                    {activeCategory === 'pest' && '病害虫・雑草名'}
                    {activeCategory === 'growth' && '調査項目'}
                    {activeCategory === 'shipment' && '出荷先 / 販路'}
                    {activeCategory === 'sales' && '販売先・用途'}
                  </label>
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

              {/* 数量・単位 */}
              {(activeCategory === 'fertilizer' || activeCategory === 'pesticide' || activeCategory === 'shipment' || activeCategory === 'sales') && (
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

              {/* 売上金額（売上時のみ） */}
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
                      className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                </div>
              )}

              {/* 作業時間 */}
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
                      className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
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
                  placeholder="希釈倍率、発生状況、現場メモ等"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium resize-none"
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
