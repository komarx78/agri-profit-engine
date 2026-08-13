"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Table, Sprout, Save, Loader2, Info } from 'lucide-react';

// 日付操作ユーティリティ
const addWeeks = (date: Date, weeks: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
};

const formatToMD = (date: Date) => {
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

const formatToYYYYMMDD = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function NurserySchedulePage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1)); // 今年の1月1日を起点とする

  // ヘッダーの日付リストを生成 (15週分程度)
  const weeks = Array.from({ length: 15 }).map((_, i) => addWeeks(startDate, i));

  useEffect(() => {
    fetchData();
  }, [year]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 栽培計画 (基準に基づく自動計算結果を含む) を取得
      const { data: plansData, error: plansErr } = await supabase
        .from('cultivation_plans_v2')
        .select(`
          *,
          fields ( name ),
          crops ( name )
        `)
        .eq('year', year)
        .gt('calculated_seedlings', 0); // 苗が必要な作目のみ抽出
        
      if (plansErr && plansErr.code !== '42P01') {
        console.error("Plans fetch error:", plansErr);
      }
      
      const fetchedPlans = plansData || [];
      
      // それに紐づく育苗スケジュールを取得
      let fetchedSchedules: any[] = [];
      if (fetchedPlans.length > 0) {
        const planIds = fetchedPlans.map(p => p.id);
        const { data: schedulesData, error: schedulesErr } = await supabase
          .from('nursery_schedules_v2')
          .select('*')
          .in('plan_id', planIds);
          
        if (schedulesErr && schedulesErr.code !== '42P01') {
          console.error("Schedules fetch error:", schedulesErr);
        }
        fetchedSchedules = schedulesData || [];
      }
      
      setPlans(fetchedPlans);
      
      // 画面表示用にデータをマージする (Schedules が無ければカラの初期データを作成)
      const mergedSchedules = fetchedPlans.map(plan => {
        const existingSchedule = fetchedSchedules.find(s => s.plan_id === plan.id);
        return existingSchedule || {
          plan_id: plan.id,
          sown_quantity: 0,
          schedule_data: {},
          isNew: true
        };
      });
      
      setSchedules(mergedSchedules);
      
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCellChange = (planId: string, field: string, value: any) => {
    setSchedules(schedules.map(s => s.plan_id === planId ? { ...s, [field]: value } : s));
  };

  const handleScheduleDataChange = (planId: string, dateStr: string, value: string) => {
    setSchedules(schedules.map(s => {
      if (s.plan_id !== planId) return s;
      
      const newSchedule = { ...s.schedule_data };
      if (!value) {
        delete newSchedule[dateStr];
      } else {
        newSchedule[dateStr] = { quantity: Number(value), type: 'plan' };
      }
      return { ...s, schedule_data: newSchedule };
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const newSchedules = schedules.filter(s => s.isNew);
      const existingSchedules = schedules.filter(s => !s.isNew);

      if (newSchedules.length > 0) {
        const inserts = newSchedules.map(({ isNew, ...rest }) => rest);
        const { error } = await supabase.from('nursery_schedules_v2').insert(inserts);
        if (error) throw error;
      }

      for (const schedule of existingSchedules) {
        const { error } = await supabase.from('nursery_schedules_v2')
          .update({
            sown_quantity: schedule.sown_quantity,
            schedule_data: schedule.schedule_data
          })
          .eq('id', schedule.id);
        if (error) throw error;
      }

      alert("保存しました！");
      fetchData();
    } catch (err: any) {
      console.error(err);
      alert(`保存エラー: テーブルが作成されていない可能性があります。\n${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-[95vw] mx-auto space-y-6 pb-12 relative">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <Sprout className="w-8 h-8 text-emerald-600" />
            育苗スケジュール表
          </h1>
          <p className="text-slate-500 mt-2 font-medium">栽培計画に基づいて「必要な苗リスト」が自動生成されます。日々の播種・定植の予定を入力してください。</p>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={fetchData}
            className="px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 font-bold transition-colors"
          >
            リロード
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            変更を保存
          </button>
        </div>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex gap-3 text-emerald-800 text-sm font-medium">
        <Info className="w-5 h-5 shrink-0 text-emerald-600" />
        <p>
          このリストは<strong>「栽培計画表」と連動</strong>しています。新しい苗を計画に追加したい場合は、先に「栽培計画表」画面で計画を立ててください。自動的にこちらに必要数と共に追加されます。
        </p>
      </div>

      {isLoading ? (
        <div className="p-12 flex justify-center text-emerald-600">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto relative">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-slate-700 bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-4 border-b border-r font-black min-w-[150px] sticky left-0 bg-slate-100 z-20">定植先(圃場)</th>
                  <th className="px-3 py-4 border-b border-r font-black min-w-[150px] sticky left-[150px] bg-slate-100 z-20">作目・品種</th>
                  <th className="px-3 py-4 border-b border-r font-bold text-center">必要本数(自動計算)</th>
                  <th className="px-3 py-4 border-b border-r font-bold text-center">播種量(実数)</th>
                  
                  {/* 日付ヘッダー (週) */}
                  {weeks.map((week, i) => (
                    <th key={i} className="px-2 py-4 border-b border-r font-bold text-center min-w-[60px]">
                      {formatToMD(week)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plans.map((plan, idx) => {
                  const schedule = schedules.find(s => s.plan_id === plan.id);
                  if (!schedule) return null;
                  
                  return (
                    <tr key={plan.id} className="border-b hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 border-r sticky left-0 bg-white z-10 text-slate-600 font-bold">
                        {plan.fields?.name}
                      </td>
                      <td className="p-3 border-r sticky left-[150px] bg-white z-10 text-slate-600 font-bold">
                        {plan.crops?.name} {plan.variety && <span className="text-emerald-600 text-xs ml-1">{plan.variety}</span>}
                      </td>
                      <td className="p-3 border-r text-center font-black text-slate-700 bg-slate-50/50">
                        {plan.calculated_seedlings.toLocaleString()} 本
                      </td>
                      <td className="p-0 border-r">
                        <input 
                          type="number" 
                          value={schedule.sown_quantity || ''} 
                          onChange={(e) => handleCellChange(plan.id, 'sown_quantity', Number(e.target.value))}
                          className="w-full p-3 bg-transparent focus:outline-none focus:bg-emerald-50 text-center font-bold text-emerald-700"
                          placeholder="0"
                        />
                      </td>
                      
                      {/* スケジュール入力セル */}
                      {weeks.map((week, i) => {
                        const dateStr = formatToYYYYMMDD(week);
                        const cellData = schedule.schedule_data?.[dateStr];
                        const val = cellData ? cellData.quantity : '';
                        
                        return (
                          <td key={i} className="p-0 border-r text-center">
                            <input 
                              type="text" 
                              value={val}
                              onChange={(e) => handleScheduleDataChange(plan.id, dateStr, e.target.value)}
                              className="w-full h-full p-3 bg-transparent focus:outline-none focus:bg-blue-50 text-center text-xs font-bold"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {plans.length === 0 && (
                  <tr>
                    <td colSpan={4 + weeks.length} className="p-8 text-center text-slate-400 font-bold">
                      現在、苗が必要な栽培計画はありません。「栽培計画表」から計画を作成してください。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
