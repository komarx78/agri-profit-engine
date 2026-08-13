"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Table, Sprout, Plus, Save, Loader2, Calendar } from 'lucide-react';

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
  const [batches, setBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1)); // 今年の1月1日を起点とする

  // ヘッダーの日付リストを生成 (15週分程度)
  const weeks = Array.from({ length: 15 }).map((_, i) => addWeeks(startDate, i));

  useEffect(() => {
    fetchBatches();
  }, []);

  const fetchBatches = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('nursery_batches').select('*').order('created_at', { ascending: true });
      
      if (error) {
        // テーブルが存在しない場合などはエラーになる
        console.error("Fetch error:", error);
      } else {
        setBatches(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRow = () => {
    setBatches([...batches, {
      id: `temp-${Date.now()}`,
      crop_name: '',
      variety: '',
      maker: '',
      pot_color: '',
      spec: '',
      target_quantity: 0,
      sown_quantity: 0,
      schedule_data: {},
      isNew: true
    }]);
  };

  const handleCellChange = (id: string, field: string, value: any) => {
    setBatches(batches.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  const handleScheduleDataChange = (id: string, dateStr: string, value: string) => {
    setBatches(batches.map(b => {
      if (b.id !== id) return b;
      
      const newSchedule = { ...b.schedule_data };
      if (!value) {
        delete newSchedule[dateStr];
      } else {
        newSchedule[dateStr] = { quantity: Number(value), type: 'plan' };
      }
      return { ...b, schedule_data: newSchedule };
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // isNew のものは INSERT、それ以外は UPDATE
      const newBatches = batches.filter(b => b.isNew);
      const existingBatches = batches.filter(b => !b.isNew);

      if (newBatches.length > 0) {
        const inserts = newBatches.map(({ id, isNew, created_at, ...rest }) => rest);
        const { error } = await supabase.from('nursery_batches').insert(inserts);
        if (error) throw error;
      }

      for (const batch of existingBatches) {
        const { error } = await supabase.from('nursery_batches')
          .update({
            crop_name: batch.crop_name,
            variety: batch.variety,
            maker: batch.maker,
            pot_color: batch.pot_color,
            spec: batch.spec,
            target_quantity: batch.target_quantity,
            sown_quantity: batch.sown_quantity,
            schedule_data: batch.schedule_data
          })
          .eq('id', batch.id);
        if (error) throw error;
      }

      alert("保存しました！");
      fetchBatches();
    } catch (err: any) {
      console.error(err);
      alert(`保存エラー: テーブルが作成されていない可能性があります。\n${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-[95vw] mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <Sprout className="w-8 h-8 text-emerald-600" />
            育苗スケジュール表
          </h1>
          <p className="text-slate-500 mt-2 font-medium">品目ごとの播種や鉢上げ、定植のスケジュールを週単位で計画・管理します。</p>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={fetchBatches}
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
                  <th className="px-3 py-4 border-b border-r font-black min-w-[100px] sticky left-0 bg-slate-100 z-20">品目</th>
                  <th className="px-3 py-4 border-b border-r font-black min-w-[120px] sticky left-[100px] bg-slate-100 z-20">品種</th>
                  <th className="px-3 py-4 border-b border-r font-bold">メーカー</th>
                  <th className="px-3 py-4 border-b border-r font-bold">ポット色</th>
                  <th className="px-3 py-4 border-b border-r font-bold">規格(cm/穴)</th>
                  <th className="px-3 py-4 border-b border-r font-bold text-center">必要本数</th>
                  <th className="px-3 py-4 border-b border-r font-bold text-center">播種量</th>
                  
                  {/* 日付ヘッダー (週) */}
                  {weeks.map((week, i) => (
                    <th key={i} className="px-2 py-4 border-b border-r font-bold text-center min-w-[60px]">
                      {formatToMD(week)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batches.map((batch, idx) => (
                  <tr key={batch.id} className="border-b hover:bg-slate-50/50 transition-colors">
                    <td className="p-0 border-r sticky left-0 bg-white z-10">
                      <input 
                        type="text" 
                        value={batch.crop_name || ''} 
                        onChange={(e) => handleCellChange(batch.id, 'crop_name', e.target.value)}
                        className="w-full p-3 bg-transparent focus:outline-none focus:bg-emerald-50 font-bold"
                        placeholder="なす"
                      />
                    </td>
                    <td className="p-0 border-r sticky left-[100px] bg-white z-10">
                      <input 
                        type="text" 
                        value={batch.variety || ''} 
                        onChange={(e) => handleCellChange(batch.id, 'variety', e.target.value)}
                        className="w-full p-3 bg-transparent focus:outline-none focus:bg-emerald-50 font-bold"
                        placeholder="千両二号"
                      />
                    </td>
                    <td className="p-0 border-r">
                      <input 
                        type="text" 
                        value={batch.maker || ''} 
                        onChange={(e) => handleCellChange(batch.id, 'maker', e.target.value)}
                        className="w-full p-3 bg-transparent focus:outline-none focus:bg-emerald-50"
                      />
                    </td>
                    <td className="p-0 border-r">
                      <input 
                        type="text" 
                        value={batch.pot_color || ''} 
                        onChange={(e) => handleCellChange(batch.id, 'pot_color', e.target.value)}
                        className="w-full p-3 bg-transparent focus:outline-none focus:bg-emerald-50"
                      />
                    </td>
                    <td className="p-0 border-r">
                      <input 
                        type="text" 
                        value={batch.spec || ''} 
                        onChange={(e) => handleCellChange(batch.id, 'spec', e.target.value)}
                        className="w-full p-3 bg-transparent focus:outline-none focus:bg-emerald-50"
                      />
                    </td>
                    <td className="p-0 border-r">
                      <input 
                        type="number" 
                        value={batch.target_quantity || ''} 
                        onChange={(e) => handleCellChange(batch.id, 'target_quantity', Number(e.target.value))}
                        className="w-full p-3 bg-transparent focus:outline-none focus:bg-emerald-50 text-center"
                      />
                    </td>
                    <td className="p-0 border-r">
                      <input 
                        type="number" 
                        value={batch.sown_quantity || ''} 
                        onChange={(e) => handleCellChange(batch.id, 'sown_quantity', Number(e.target.value))}
                        className="w-full p-3 bg-transparent focus:outline-none focus:bg-emerald-50 text-center font-bold text-emerald-700"
                      />
                    </td>
                    
                    {/* スケジュール入力セル */}
                    {weeks.map((week, i) => {
                      const dateStr = formatToYYYYMMDD(week);
                      const cellData = batch.schedule_data?.[dateStr];
                      const val = cellData ? cellData.quantity : '';
                      
                      return (
                        <td key={i} className="p-0 border-r text-center">
                          <input 
                            type="text" 
                            value={val}
                            onChange={(e) => handleScheduleDataChange(batch.id, dateStr, e.target.value)}
                            className="w-full h-full p-3 bg-transparent focus:outline-none focus:bg-blue-50 text-center text-xs font-bold"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {batches.length === 0 && (
                  <tr>
                    <td colSpan={7 + weeks.length} className="p-8 text-center text-slate-400">
                      データがありません。「行を追加」からスケジュールを作成してください。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <div className="p-4 border-t border-slate-100 bg-slate-50">
            <button 
              onClick={handleAddRow}
              className="flex items-center gap-2 text-emerald-600 font-bold hover:text-emerald-700 px-4 py-2 hover:bg-emerald-100 rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              行を追加
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
