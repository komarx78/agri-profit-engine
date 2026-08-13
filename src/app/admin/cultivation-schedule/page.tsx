"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Calendar, Save, Loader2, ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react';

export default function CultivationSchedulePage() {
  const [fields, setFields] = useState<any[]>([]);
  const [crops, setCrops] = useState<any[]>([]);
  const [cropStandards, setCropStandards] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  // 新規計画モーダル用ステート
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({ field_id: '', crop_id: '', variety: '', start_month: 8, end_month: 11 });
  const [isSaving, setIsSaving] = useState(false);

  // 8月〜7月の月配列
  const months = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7];

  useEffect(() => {
    fetchData();
  }, [year]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [fRes, cRes, csRes, pRes] = await Promise.all([
        supabase.from('fields').select('*').order('name'),
        supabase.from('crops').select('*').order('name'),
        supabase.from('crop_standards').select('*'),
        supabase.from('cultivation_plans_v2').select(`
          *,
          crops ( name )
        `).eq('year', year)
      ]);
      
      setFields(fRes.data || []);
      setCrops(cRes.data || []);
      setCropStandards(csRes.data || []);
      
      if (pRes.error && pRes.error.code !== '42P01') {
        console.error("Plans fetch error:", pRes.error);
      }
      setPlans(pRes.data || []);
      
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (fieldId: string, month: number) => {
    setFormData({
      field_id: fieldId,
      crop_id: '',
      variety: '',
      start_month: month,
      end_month: month < 8 ? month + 1 : (month === 12 ? 1 : month + 1) // 適当な初期値
    });
    setIsModalOpen(true);
  };

  const handleSavePlan = async () => {
    if (!formData.crop_id) {
      alert("作目を選択してください");
      return;
    }
    
    setIsSaving(true);
    try {
      // 1. 自動計算のための情報を取得
      const field = fields.find(f => f.id === formData.field_id);
      const standard = cropStandards.find(s => s.crop_id === formData.crop_id);
      
      const area = field?.area_size || 0;
      const seedlingsPer10a = standard?.seedlings_per_10a || 0;
      
      // 計算: 面積(a) / 10 * 10aあたりの苗数
      const calculatedSeedlings = (area / 10) * seedlingsPer10a;
      
      const insertData = {
        field_id: formData.field_id,
        crop_id: formData.crop_id,
        variety: formData.variety || null,
        year: year,
        start_month: formData.start_month,
        end_month: formData.end_month,
        calculated_area: area,
        calculated_seedlings: calculatedSeedlings
      };
      
      const { error } = await supabase.from('cultivation_plans_v2').insert([insertData]);
      if (error) throw error;
      
      alert("作付計画を登録しました！\n（必要苗数などが自動計算されました）");
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error(err);
      alert(`保存エラー: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePlan = async (id: string) => {
    if (!confirm("この計画を削除しますか？\n（関連する育苗スケジュールも削除されます）")) return;
    
    try {
      const { error } = await supabase.from('cultivation_plans_v2').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      alert(`削除エラー: ${err.message}`);
    }
  };

  // 年度の切り替え
  const handlePrevYear = () => setYear(y => y - 1);
  const handleNextYear = () => setYear(y => y + 1);

  // 月が指定期間に含まれるか判定（年またぎ考慮）
  const isMonthInPlan = (month: number, startM: number, endM: number) => {
    // 8月始まりのインデックス (8月=0, 7月=11)
    const monthIndex = month >= 8 ? month - 8 : month + 4;
    const startIndex = startM >= 8 ? startM - 8 : startM + 4;
    const endIndex = endM >= 8 ? endM - 8 : endM + 4;
    
    if (startIndex <= endIndex) {
      return monthIndex >= startIndex && monthIndex <= endIndex;
    } else {
      // 終了月が開始月より前にある場合は論理エラーだが一応対応
      return monthIndex >= startIndex || monthIndex <= endIndex;
    }
  };

  return (
    <div className="max-w-[95vw] mx-auto space-y-6 pb-12 relative">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <Calendar className="w-8 h-8 text-blue-600" />
            栽培計画表 (作付カレンダー)
          </h1>
          <p className="text-slate-500 mt-2 font-medium">ここで作付計画を立てると、マスタの基準値に基づき必要な苗や資材の量が自動計算されます。</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <button onClick={handlePrevYear} className="p-2 hover:bg-slate-100 transition-colors">
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div className="px-4 font-black text-slate-700">{year}年度</div>
            <button onClick={handleNextYear} className="p-2 hover:bg-slate-100 transition-colors">
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </button>
          </div>
          
          <button 
            onClick={fetchData}
            className="px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 font-bold transition-colors"
          >
            リロード
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 flex justify-center text-blue-600">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto relative">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-slate-700 bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-4 border-b border-r font-black min-w-[150px] sticky left-0 bg-slate-100 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">圃場名</th>
                  <th className="px-3 py-4 border-b border-r font-bold text-center min-w-[80px]">面積(a)</th>
                  
                  {/* 横軸: 8月〜7月 */}
                  {months.map((month) => (
                    <th key={month} className="px-2 py-4 border-b border-r font-bold text-center min-w-[120px]">
                      {month}月
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fields.map((field) => {
                  const fieldPlans = plans.filter(p => p.field_id === field.id);
                  
                  return (
                    <tr key={field.id} className="border-b hover:bg-slate-50/50 transition-colors h-16">
                      <td className="px-3 py-3 border-r sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        <span className="font-bold text-slate-700">{field.name}</span>
                      </td>
                      <td className="px-3 py-3 border-r text-center text-slate-500 font-medium bg-slate-50/30">
                        {field.area_size || '-'}
                      </td>
                      
                      {/* 月別セル */}
                      {months.map((month) => {
                        // この月に開始する計画があるか
                        const startingPlans = fieldPlans.filter(p => p.start_month === month);
                        // この月をまたいでいる計画があるか
                        const ongoingPlans = fieldPlans.filter(p => p.start_month !== month && isMonthInPlan(month, p.start_month, p.end_month));
                        
                        return (
                          <td key={month} className="p-1 border-r relative align-top">
                            <div className="min-h-[60px] relative group">
                              {/* 背景の追加ボタン */}
                              <button 
                                onClick={() => handleOpenModal(field.id, month)}
                                className="absolute inset-0 w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-blue-50/50 transition-all z-0 rounded"
                              >
                                <Plus className="w-5 h-5 text-blue-400" />
                              </button>
                              
                              {/* 計画バーの表示 */}
                              <div className="relative z-10 space-y-1 mt-1">
                                {startingPlans.map(plan => (
                                  <div key={plan.id} className="bg-blue-100 border border-blue-200 rounded-md p-1.5 shadow-sm flex items-start justify-between group/item">
                                    <div>
                                      <div className="font-bold text-blue-800 text-xs">
                                        {plan.crops?.name} {plan.variety && <span className="text-blue-600">{plan.variety}</span>}
                                      </div>
                                      {plan.calculated_seedlings > 0 && (
                                        <div className="text-[10px] text-blue-600 font-medium mt-0.5">
                                          必要苗: {plan.calculated_seedlings.toLocaleString()}
                                        </div>
                                      )}
                                      <div className="text-[10px] text-blue-400">
                                        〜{plan.end_month}月
                                      </div>
                                    </div>
                                    <button 
                                      onClick={() => handleDeletePlan(plan.id)}
                                      className="opacity-0 group-hover/item:opacity-100 p-0.5 text-blue-400 hover:text-red-500 hover:bg-white rounded"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                                
                                {ongoingPlans.map(plan => (
                                  <div key={`ongoing-${plan.id}`} className="h-4 bg-blue-100/50 rounded-full w-full"></div>
                                ))}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {fields.length === 0 && (
                  <tr>
                    <td colSpan={2 + months.length} className="p-8 text-center text-slate-400 font-bold">
                      圃場データがありません。「マスタ管理」から圃場を登録してください。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 新規計画モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-blue-50/50">
              <h3 className="text-lg font-black text-blue-800">
                作付計画の追加
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-sm font-bold text-blue-800 mb-4">
                対象: {fields.find(f => f.id === formData.field_id)?.name} 
                ({fields.find(f => f.id === formData.field_id)?.area_size || 0}a)
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">作目 (必須)</label>
                <select
                  value={formData.crop_id}
                  onChange={e => setFormData({...formData, crop_id: e.target.value})}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-bold"
                >
                  <option value="">選択してください</option>
                  {crops.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">品種 (任意)</label>
                <input 
                  type="text" 
                  value={formData.variety || ''} 
                  onChange={e => setFormData({...formData, variety: e.target.value})}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-bold"
                  placeholder="例: スノークラウン"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">開始月</label>
                  <select
                    value={formData.start_month}
                    onChange={e => setFormData({...formData, start_month: Number(e.target.value)})}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-bold"
                  >
                    {months.map(m => (
                      <option key={m} value={m}>{m}月</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">終了予定月</label>
                  <select
                    value={formData.end_month}
                    onChange={e => setFormData({...formData, end_month: Number(e.target.value)})}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-bold"
                  >
                    {months.map(m => (
                      <option key={m} value={m}>{m}月</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* 自動計算プレビュー */}
              {formData.crop_id && (
                <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <div className="text-xs font-bold text-emerald-600 mb-1">自動計算予測</div>
                  <div className="text-sm font-black text-emerald-800">
                    {(() => {
                      const field = fields.find(f => f.id === formData.field_id);
                      const standard = cropStandards.find(s => s.crop_id === formData.crop_id);
                      const area = field?.area_size || 0;
                      const seedlings = standard?.seedlings_per_10a || 0;
                      if (!area || !seedlings) return "※面積または基準苗数が未設定のため計算できません";
                      return `必要苗数: ${((area / 10) * seedlings).toLocaleString()} 株`;
                    })()}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 flex gap-3 border-t border-slate-100">
              <button 
                onClick={() => setIsModalOpen(false)}
                disabled={isSaving}
                className="flex-1 py-3 text-slate-500 font-bold bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                キャンセル
              </button>
              <button 
                onClick={handleSavePlan}
                disabled={isSaving}
                className="flex-1 py-3 text-white font-bold bg-blue-600 rounded-xl hover:bg-blue-700 shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : '計画を登録する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
