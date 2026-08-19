"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { HelpTooltip } from '@/components/HelpTooltip';
import { Calendar, Save, Loader2, ChevronLeft, ChevronRight, Plus, Trash2, X, BarChart2, User } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

export default function CultivationSchedulePage() {
  const [fields, setFields] = useState<any[]>([]);
  const [crops, setCrops] = useState<any[]>([]);
  const [cropStandards, setCropStandards] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [monthlyExpenses, setMonthlyExpenses] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  // 新規計画モーダル用ステート
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({ field_id: '', crop_id: '', variety: '', start_month: 8, end_month: 11 });
  const [isSaving, setIsSaving] = useState(false);

  // 詳細パネル(予実管理)用ステート
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'work' | 'sales' | 'analysis'>('work');
  const [workLogs, setWorkLogs] = useState<any[]>([]);
  const [salesLogs, setSalesLogs] = useState<any[]>([]);
  const [isPanelLoading, setIsPanelLoading] = useState(false);
  
  // 新規入力用ステート
  const [newWork, setNewWork] = useState({ date: new Date().toISOString().split('T')[0], type: '播種', duration: '', note: '' });
  const [newSales, setNewSales] = useState({ date: new Date().toISOString().split('T')[0], quantity: '', price: '', channel: '直売所' });

  // 8月〜7月の月配列
  const months = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7];

  useEffect(() => {
    fetchData();
  }, [year]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [fRes, cRes, csRes, pRes, expRes] = await Promise.all([
        supabase.from('fields').select('*').order('name'),
        supabase.from('crops').select('*').order('name'),
        supabase.from('crop_standards').select('*'),
        supabase.from('cultivation_plans_v2').select(`
          *,
          crops ( * )
        `).eq('year', year),
        supabase.from('monthly_expenses').select('*')
      ]);
      
      setFields(fRes.data || []);
      setCrops(cRes.data || []);
      setCropStandards(csRes.data || []);
      setMonthlyExpenses(expRes.data || []);
      
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

  const handleDeletePlan = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm("この計画を削除しますか？\n（関連する育苗スケジュールも削除されます）")) return;
    
    try {
      const { error } = await supabase.from('cultivation_plans_v2').delete().eq('id', id);
      if (error) throw error;
      if (selectedPlan?.id === id) setSelectedPlan(null);
      fetchData();
    } catch (err: any) {
      alert(`削除エラー: ${err.message}`);
    }
  };

  // 詳細パネル関連
  const handleOpenDetails = async (plan: any) => {
    setSelectedPlan(plan);
    setActiveTab('work');
    fetchPlanDetails(plan);
  };

  const fetchPlanDetails = async (plan: any) => {
    setIsPanelLoading(true);
    try {
      const [workRes, salesRes] = await Promise.all([
        supabase.from('work_logs').select(`
          *,
          workers (name, hourly_wage),
          materials (default_price, category)
        `).or(`plan_id.eq.${plan.id},crop_id.eq.${plan.crop_id}`).order('work_date', { ascending: false }),
        supabase.from('sales_logs').select('*').or(`plan_id.eq.${plan.id},crop_id.eq.${plan.crop_id}`).order('sales_date', { ascending: false })
      ]);
      setWorkLogs(workRes.data || []);
      setSalesLogs(salesRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsPanelLoading(false);
    }
  };

  const handleAddWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('work_logs').insert([{
        plan_id: selectedPlan.id,
        work_date: newWork.date,
        work_type: newWork.type,
        duration_minutes: Number(newWork.duration) || 0,
        notes: newWork.note,
        status: 'completed'
      }]);
      if (error) throw error;
      setNewWork({ ...newWork, duration: '', note: '' });
      fetchPlanDetails(selectedPlan);
    } catch (err: any) {
      alert(`エラー: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddSales = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('sales_logs').insert([{
        plan_id: selectedPlan.id,
        sales_date: newSales.date,
        quantity: Number(newSales.quantity) || 0,
        total_sales: Number(newSales.price) || 0,
        status: 'completed'
      }]);
      if (error) throw error;
      setNewSales({ ...newSales, quantity: '', price: '' });
      fetchPlanDetails(selectedPlan);
    } catch (err: any) {
      alert(`エラー: ${err.message}`);
    } finally {
      setIsSaving(false);
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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2 md:gap-3">
            <Calendar className="w-6 h-6 md:w-8 md:h-8 text-blue-600 flex-shrink-0" />
            栽培計画表 (作付カレンダー)
            <HelpTooltip content="年度ごとの作付計画（いつ、どこで、何を育てるか）を登録します。この計画をもとに必要な苗や資材の量が自動計算されます。" className="ml-1" />
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-2 font-medium">ここで作付計画を立てると、マスタの基準値に基づき必要な苗や資材の量が自動計算されます。</p>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
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
                                  <div 
                                    key={plan.id} 
                                    onClick={() => handleOpenDetails(plan)}
                                    className="bg-blue-100 border border-blue-200 rounded-md p-1.5 shadow-sm flex items-start justify-between group/item cursor-pointer hover:bg-blue-200 transition-colors"
                                  >
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
                                      onClick={(e) => handleDeletePlan(plan.id, e)}
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

      {selectedPlan && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                  {selectedPlan.crops?.name} {selectedPlan.variety && <span className="text-sm font-medium text-slate-500">({selectedPlan.variety})</span>}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  {fields.find(f => f.id === selectedPlan.field_id)?.name} / {selectedPlan.start_month}月〜{selectedPlan.end_month}月
                </p>
              </div>
              <button 
                onClick={() => setSelectedPlan(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex border-b border-slate-200">
              <button
                onClick={() => setActiveTab('work')}
                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'work' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
              >
                作業記録
              </button>
              <button
                onClick={() => setActiveTab('sales')}
                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'sales' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
              >
                出荷記録
              </button>
              <button
                onClick={() => setActiveTab('analysis')}
                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'analysis' ? 'border-amber-600 text-amber-700' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
              >
                📊 分析
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
              {isPanelLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
              ) : (
                <>
                  {activeTab === 'work' && (
                    <div className="space-y-6">
                      {/* 作業記録追加フォーム */}
                      <form onSubmit={handleAddWork} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2"><Plus className="w-4 h-4"/>作業を追加</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">日付</label>
                            <input type="date" required value={newWork.date} onChange={e => setNewWork({...newWork, date: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">作業種類</label>
                            <select value={newWork.type} onChange={e => setNewWork({...newWork, type: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-sm">
                              <option>播種</option>
                              <option>定植</option>
                              <option>水やり</option>
                              <option>肥料・農薬</option>
                              <option>草刈り</option>
                              <option>収穫</option>
                              <option>片付け・メンテ</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">所要時間(分)</label>
                            <input type="number" required placeholder="60" value={newWork.duration} onChange={e => setNewWork({...newWork, duration: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">メモ(任意)</label>
                            <input type="text" placeholder="例: 10畝完了" value={newWork.note} onChange={e => setNewWork({...newWork, note: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-sm" />
                          </div>
                        </div>
                        <button disabled={isSaving} className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm transition-colors">
                          {isSaving ? '保存中...' : '記録する'}
                        </button>
                      </form>

                      {/* 作業履歴一覧 */}
                      <div className="space-y-3">
                        {workLogs.map(log => (
                          <div key={log.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <div className="text-xs font-bold text-slate-500">{log.work_date}</div>
                                {log.workers?.name && (
                                  <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <User className="w-3 h-3" /> {log.workers.name}
                                  </div>
                                )}
                              </div>
                              <div className="font-bold text-slate-800">{log.work_type}</div>
                              {log.notes && <div className="text-xs text-slate-500 mt-1">{log.notes}</div>}
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-black text-blue-600">{log.duration_minutes} 分</div>
                              <div className="text-[10px] text-slate-400">完了</div>
                            </div>
                          </div>
                        ))}
                        {workLogs.length === 0 && <p className="text-center text-sm text-slate-400 py-4">作業履歴はありません</p>}
                      </div>
                    </div>
                  )}

                  {activeTab === 'sales' && (
                    <div className="space-y-6">
                      {/* 出荷記録追加フォーム */}
                      <form onSubmit={handleAddSales} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2"><Plus className="w-4 h-4"/>出荷を追加</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">日付</label>
                            <input type="date" required value={newSales.date} onChange={e => setNewSales({...newSales, date: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">出荷先(チャネル)</label>
                            <select value={newSales.channel} onChange={e => setNewSales({...newSales, channel: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-sm">
                              <option>直売所</option>
                              <option>スーパー</option>
                              <option>飲食店</option>
                              <option>市場</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">数量</label>
                            <input type="number" required placeholder="例: 50" value={newSales.quantity} onChange={e => setNewSales({...newSales, quantity: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">売上額(円)</label>
                            <input type="number" required placeholder="例: 10000" value={newSales.price} onChange={e => setNewSales({...newSales, price: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-sm" />
                          </div>
                        </div>
                        <button disabled={isSaving} className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm transition-colors">
                          {isSaving ? '保存中...' : '記録する'}
                        </button>
                      </form>

                      {/* 出荷履歴一覧 */}
                      <div className="space-y-3">
                        {salesLogs.map(log => (
                          <div key={log.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex justify-between items-start">
                            <div>
                              <div className="text-xs font-bold text-slate-500">{log.sales_date}</div>
                              <div className="font-bold text-slate-800">数量: {log.quantity}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-black text-emerald-600">¥ {log.total_sales?.toLocaleString()}</div>
                              <div className="text-[10px] text-slate-400">完了</div>
                            </div>
                          </div>
                        ))}
                        {salesLogs.length === 0 && <p className="text-center text-sm text-slate-400 py-4">出荷履歴はありません</p>}
                      </div>
                    </div>
                  )}

                  {activeTab === 'analysis' && (
                    <div className="space-y-6">
                      {(() => {
                        const areaStr = fields.find(f => f.id === selectedPlan.field_id)?.area_size || selectedPlan.calculated_area;
                        const area = Number(areaStr) || 1; // 0除算防止
                        const multiplier = 10 / area;
                        
                        // 売上集計
                        const totalSalesQuantity = salesLogs.reduce((sum, log) => sum + (Number(log.quantity) || 0), 0);
                        const totalSalesAmount = salesLogs.reduce((sum, log) => sum + (Number(log.total_sales) || 0), 0);
                        
                        // 作業時間集計
                        const totalWorkMinutes = workLogs.reduce((sum, log) => sum + (Number(log.duration_minutes) || 0), 0);
                        const totalWorkHours = totalWorkMinutes / 60;
                        
                        // 費用集計
                        let totalLaborCost = 0;
                        const materialCostByCategory: Record<string, number> = {};
                        
                        // 作業タイプ別時間割合
                        const workTypeHours: Record<string, number> = {};
                        
                        workLogs.forEach(log => {
                          const durationH = (Number(log.duration_minutes) || 0) / 60;
                          
                          // 作業タイプ集計
                          const wType = log.work_type || 'その他';
                          workTypeHours[wType] = (workTypeHours[wType] || 0) + durationH;
                          
                          // 人件費
                          const wage = log.workers?.hourly_wage || 1000;
                          totalLaborCost += durationH * wage;
                          
                          // 資材費
                          if (log.material_quantity && log.materials) {
                            const cost = log.material_quantity * (log.materials.default_price || 0);
                            const cat = log.materials.category || '諸材料費';
                            materialCostByCategory[cat] = (materialCostByCategory[cat] || 0) + cost;
                          }
                        });
                        
                        // 10a換算値
                        const yield10a = totalSalesQuantity * multiplier;
                        const revenue10a = totalSalesAmount * multiplier;
                        const unitPrice = totalSalesQuantity > 0 ? totalSalesAmount / totalSalesQuantity : 0;
                        
                        const laborCost10a = totalLaborCost * multiplier;
                        let totalMaterialCost10a = 0;
                        const costs10a: Record<string, number> = {};
                        Object.keys(materialCostByCategory).forEach(cat => {
                          const c10a = materialCostByCategory[cat] * multiplier;
                          costs10a[cat] = c10a;
                          totalMaterialCost10a += c10a;
                        });

                        // ハイブリッド経費按分ロジック
                        // 1. 農場全体の面積合計
                        const totalFarmArea = fields.reduce((sum, f) => sum + (Number(f.area_size) || 0), 0);
                        const areaRatio = totalFarmArea > 0 ? area / totalFarmArea : 0;
                        
                        // 2. 栽培期間の月リストを作成 (最大12ヶ月)
                        const planMonths: string[] = [];
                        let currentM = selectedPlan.start_month;
                        let y = currentM >= 8 ? selectedPlan.year : selectedPlan.year + 1;
                        for (let i = 0; i < 12; i++) {
                          planMonths.push(`${y}-${String(currentM).padStart(2, '0')}`);
                          if (currentM === selectedPlan.end_month) break;
                          currentM++;
                          if (currentM > 12) { currentM = 1; y++; }
                        }

                        // 3. マスタの概算（予算）を取得し、1ヶ月・自圃場面積あたりに変換
                        const cropMaster = crops.find(c => c.id === selectedPlan.crop_id);
                        const totalMonths = planMonths.length || 1;
                        const estFuelPerMonth = ((cropMaster?.est_fuel_cost_10a || 0) * (area / 10)) / totalMonths;
                        const estMachineryPerMonth = ((cropMaster?.est_machinery_cost_10a || 0) * (area / 10)) / totalMonths;
                        const estOtherPerMonth = ((cropMaster?.est_other_cost_10a || 0) * (area / 10)) / totalMonths;

                        // 4. 各月の実費または予算を加算
                        let totalFuelArea = 0;
                        let totalMachineryArea = 0;
                        let totalOtherArea = 0;

                        planMonths.forEach(mStr => {
                          const monthLogs = monthlyExpenses.filter(e => e.month === mStr);
                          if (monthLogs.length > 0) {
                            // 実績あり：全体経費 × 面積按分率
                            totalFuelArea += (monthLogs.find(e => e.expense_type === 'fuel')?.amount || 0) * areaRatio;
                            totalMachineryArea += (monthLogs.find(e => e.expense_type === 'machinery')?.amount || 0) * areaRatio;
                            totalOtherArea += (monthLogs.find(e => e.expense_type === 'other')?.amount || 0) * areaRatio;
                          } else {
                            // 実績なし：予算（概算）
                            totalFuelArea += estFuelPerMonth;
                            totalMachineryArea += estMachineryPerMonth;
                            totalOtherArea += estOtherPerMonth;
                          }
                        });

                        // 5. 10aあたりに再換算して costs10a に組み込む
                        const fuel10a = totalFuelArea * multiplier;
                        const machinery10a = totalMachineryArea * multiplier;
                        const other10a = totalOtherArea * multiplier;
                        
                        costs10a['動力光熱費'] = (costs10a['動力光熱費'] || 0) + fuel10a;
                        costs10a['機械・車両費 (参考)'] = (costs10a['機械・車両費 (参考)'] || 0) + machinery10a;
                        costs10a['その他経費'] = (costs10a['その他経費'] || 0) + other10a;
                        totalMaterialCost10a += (fuel10a + machinery10a + other10a);
                        
                        const totalCost10a = laborCost10a + totalMaterialCost10a;
                        const profit10a = revenue10a - totalCost10a;
                        const profitMargin = revenue10a > 0 ? (profit10a / revenue10a) * 100 : 0;
                        
                        const laborHours10a = totalWorkHours * multiplier;
                        const profitPerHour = laborHours10a > 0 ? profit10a / laborHours10a : 0;
                        
                        // 円グラフデータ
                        const pieData = Object.keys(workTypeHours).map(k => ({
                          name: k,
                          value: Number((workTypeHours[k] * multiplier).toFixed(1))
                        })).filter(d => d.value > 0).sort((a, b) => b.value - a.value);
                        
                        const PIE_COLORS = ['#fb7185', '#f43f5e', '#e11d48', '#fda4af', '#be123c', '#9f1239', '#ffe4e6'];
                        
                        return (
                          <>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-4">
                                <h4 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                  <BarChart2 className="w-5 h-5 text-amber-500" />
                                  経営指標 (10a当たり)
                                </h4>
                                <a 
                                  href={`/admin/report/${selectedPlan.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-700 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                                >
                                  📄 詳細レポート(PDF印刷)
                                </a>
                              </div>
                              
                              <div className="text-xs text-slate-500 mb-4 bg-amber-50 p-3 rounded-lg border border-amber-100 font-medium">
                                ※ 現在の圃場面積({area}a)から10aあたりの数値を自動換算しています。<br/>
                                （換算倍率: {multiplier.toFixed(2)}倍）
                              </div>
                              
                              <table className="w-full text-sm mb-4 border-collapse">
                                <tbody>
                                  <tr className="border-b border-slate-100"><td className="py-2 text-slate-500 font-bold">生産量(kg)</td><td className="py-2 text-right font-black text-slate-800">{Math.round(yield10a).toLocaleString()}</td></tr>
                                  <tr className="border-b border-slate-100"><td className="py-2 text-slate-500 font-bold">単価(円/kg)</td><td className="py-2 text-right font-black text-slate-800">{Math.round(unitPrice).toLocaleString()}</td></tr>
                                  <tr className="border-b border-slate-100"><td className="py-2 text-slate-500 font-bold">粗収益(円)</td><td className="py-2 text-right font-black text-amber-600">{Math.round(revenue10a).toLocaleString()}</td></tr>
                                  <tr className="border-b border-slate-100"><td className="py-2 text-slate-500 font-bold">所得(円)</td><td className="py-2 text-right font-black text-blue-600">{Math.round(profit10a).toLocaleString()}</td></tr>
                                  <tr className="border-b border-slate-100"><td className="py-2 text-slate-500 font-bold">所得率(%)</td><td className="py-2 text-right font-black text-slate-800">{Math.round(profitMargin)}</td></tr>
                                  <tr className="border-b border-slate-100"><td className="py-2 text-slate-500 font-bold">労働時間(時間)</td><td className="py-2 text-right font-black text-slate-800">{Math.round(laborHours10a).toLocaleString()}</td></tr>
                                  <tr className="border-b border-slate-100"><td className="py-2 text-slate-500 font-bold">1時間当たり所得(円)</td><td className="py-2 text-right font-black text-slate-800">{Math.round(profitPerHour).toLocaleString()}</td></tr>
                                </tbody>
                              </table>
                              
                              <h5 className="text-sm font-black text-slate-700 mt-6 mb-2 border-b border-slate-100 pb-1">費用の内訳 (10a当たり)</h5>
                              <table className="w-full text-sm border-collapse">
                                <tbody>
                                  {Object.keys(costs10a).map(cat => (
                                    <tr key={cat} className="border-b border-slate-100">
                                      <td className="py-2 text-slate-500 font-medium">{cat}</td>
                                      <td className="py-2 text-right text-slate-700">{Math.round(costs10a[cat]).toLocaleString()}</td>
                                    </tr>
                                  ))}
                                  <tr className="border-b border-slate-100">
                                    <td className="py-2 text-slate-500 font-medium">人件費 (参考値)</td>
                                    <td className="py-2 text-right text-slate-700">{Math.round(laborCost10a).toLocaleString()}</td>
                                  </tr>
                                  <tr className="bg-slate-50 font-black text-slate-800">
                                    <td className="py-2 px-2">合計</td>
                                    <td className="py-2 px-2 text-right">{Math.round(totalCost10a).toLocaleString()}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                            
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                              <h4 className="text-sm font-black text-slate-700 mb-4 text-center">10a当たり作業別時間割合</h4>
                              {pieData.length > 0 ? (
                                <div className="h-64">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <PieChart margin={{ top: 10, right: 40, bottom: 10, left: 40 }}>
                                      <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={35}
                                        outerRadius={60}
                                        paddingAngle={2}
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        labelLine={true}
                                      >
                                        {pieData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                      </Pie>
                                      <RechartsTooltip formatter={(value: number) => [`${value} 時間/10a`, '時間']} />
                                    </PieChart>
                                  </ResponsiveContainer>
                                </div>
                              ) : (
                                <p className="text-center text-sm text-slate-400 py-8">作業記録がありません</p>
                              )}
                              
                              <table className="w-full text-sm mt-4 border-collapse">
                                <thead>
                                  <tr className="border-b-2 border-slate-200 text-slate-500">
                                    <th className="py-2 text-left font-bold">作業内容</th>
                                    <th className="py-2 text-right font-bold">労働時間 (h/10a)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {pieData.map((d, i) => (
                                    <tr key={i} className="border-b border-slate-100">
                                      <td className="py-2 text-slate-700">{d.name}</td>
                                      <td className="py-2 text-right font-black text-slate-700">{d.value.toFixed(1)}</td>
                                    </tr>
                                  ))}
                                  <tr className="bg-slate-50 font-black text-slate-800">
                                    <td className="py-2 px-2">合計</td>
                                    <td className="py-2 px-2 text-right">{Math.round(laborHours10a).toLocaleString()}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
