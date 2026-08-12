"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Table, Download, Loader2, Calendar as CalendarIcon, Briefcase } from 'lucide-react';
import Papa from 'papaparse';

export default function WorkLedgerPage() {
  const [workLogs, setWorkLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // 表示月フィルター (デフォルトは今月)
  const currentMonth = new Date().toISOString().substring(0, 7);
  const [targetMonth, setTargetMonth] = useState<string>(currentMonth);
  
  // 表示モード (時間 or 人件費 or 資材費 or 総コスト)
  const [viewMode, setViewMode] = useState<'hours' | 'cost' | 'materialCost' | 'totalCost'>('hours');

  useEffect(() => {
    fetchLogs();
  }, [targetMonth]);

  async function fetchLogs() {
    setIsLoading(true);
    try {
        const startOfMonth = `${targetMonth}-01`;
        // 簡単のため31日を月末とする（PostgreSQLのdate型なら、存在しない日でもその月の範囲まで検索可能）
        const endOfMonth = `${targetMonth}-31`;

      // 指定月のデータを取得
      const { data, error } = await supabase
        .from('work_logs')
        .select(`
          id,
          work_date,
          duration_minutes,
          work_type,
          crops(name),
          workers(name, hourly_wage),
          material_quantity,
          materials(name, default_price)
        `)
        .gte('work_date', startOfMonth)
        .lte('work_date', endOfMonth)
        .eq('status', 'completed'); // 実績のみ

      if (error) throw error;
      setWorkLogs(data || []);
    } catch (err) {
      console.error(err);
      alert('データの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }

  // クロス集計データの生成
  const { tableData, cropsList, workTypesList } = useMemo(() => {
    // 存在する作目と作業内容のユニークリストを抽出
    const cropsSet = new Set<string>();
    const workTypesSet = new Set<string>();
    
    // 集計用マップ: crop -> workType -> value(時間 or 金額)
    const pivotMap: Record<string, Record<string, number>> = {};
    let grandTotal = 0;

    workLogs.forEach(log => {
      const cropName = log.crops?.name || '作目未指定';
      const workType = log.work_type || '未指定';
      const durationHours = (log.duration_minutes || 0) / 60;
      const wage = log.workers?.hourly_wage || 1000;
      const laborCost = durationHours * wage;
      
      const materialQty = log.material_quantity || 0;
      const materialPrice = log.materials?.default_price || 0;
      const materialCost = materialQty * materialPrice;

      cropsSet.add(cropName);
      workTypesSet.add(workType);

      if (!pivotMap[cropName]) pivotMap[cropName] = {};
      
      let value = 0;
      if (viewMode === 'hours') value = durationHours;
      else if (viewMode === 'cost') value = laborCost;
      else if (viewMode === 'materialCost') value = materialCost;
      else if (viewMode === 'totalCost') value = laborCost + materialCost;

      pivotMap[cropName][workType] = (pivotMap[cropName][workType] || 0) + value;
      grandTotal += value;
    });

    const cropsArray = Array.from(cropsSet).sort();
    const workTypesArray = Array.from(workTypesSet).sort();

    return { 
      tableData: pivotMap, 
      cropsList: cropsArray, 
      workTypesList: workTypesArray,
      grandTotal
    };
  }, [workLogs, viewMode]);

  const handleExportCSV = () => {
    if (cropsList.length === 0) return;
    
    const exportData = cropsList.map(crop => {
      const row: any = { '作目': crop };
      workTypesList.forEach(wt => {
        row[wt] = Math.round(tableData[crop]?.[wt] || 0);
      });
      row['合計'] = Math.round(workTypesList.reduce((sum, wt) => sum + (tableData[crop]?.[wt] || 0), 0));
      return row;
    });

    const csv = Papa.unparse(exportData);
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `作業台帳_${targetMonth}_${viewMode === 'hours' ? '時間' : '人件費'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatValue = (val: number) => {
    if (!val) return '-';
    if (viewMode === 'hours') {
      return `${val.toFixed(1)} h`;
    } else {
      return `¥${Math.round(val).toLocaleString()}`;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <Table className="w-8 h-8 text-indigo-500" />
            作業内容台帳 (クロス集計)
          </h1>
          <p className="text-slate-500 mt-2 font-medium">作目と作業内容の掛け合わせで、何にどれくらいコスト（時間・人件費）がかかっているかを分析します。</p>
        </div>
      </div>

      {/* コントロールパネル */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-3">
          <label className="text-slate-500 font-bold flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" /> 対象月:
          </label>
          <input
            type="month"
            value={targetMonth}
            onChange={(e) => setTargetMonth(e.target.value)}
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3 border-l border-slate-200 pl-6">
          <label className="text-slate-500 font-bold flex items-center gap-2">
            <Briefcase className="w-5 h-5" /> 表示切替:
          </label>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('hours')}
              className={`px-3 py-1.5 rounded-lg font-bold text-sm transition-all ${
                viewMode === 'hours' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              作業時間(h)
            </button>
            <button
              onClick={() => setViewMode('cost')}
              className={`px-3 py-1.5 rounded-lg font-bold text-sm transition-all ${
                viewMode === 'cost' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              人件費(円)
            </button>
            <button
              onClick={() => setViewMode('materialCost')}
              className={`px-3 py-1.5 rounded-lg font-bold text-sm transition-all ${
                viewMode === 'materialCost' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              資材費(円)
            </button>
            <button
              onClick={() => setViewMode('totalCost')}
              className={`px-3 py-1.5 rounded-lg font-bold text-sm transition-all ${
                viewMode === 'totalCost' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              総コスト(円)
            </button>
          </div>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={cropsList.length === 0}
          className="ml-auto bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" /> CSV出力
        </button>
      </div>

      {/* 集計テーブル */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : cropsList.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-bold">
            指定した月の実績データがありません。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse min-w-[800px]">
              <thead>
                <tr>
                  <th className="bg-slate-50 p-4 border-b border-slate-200 text-left font-black text-slate-600 sticky left-0 z-10 w-48 shadow-[1px_0_0_0_#e2e8f0]">
                    作目 \ 作業内容
                  </th>
                  {workTypesList.map(wt => (
                    <th key={wt} className="bg-slate-50 p-4 border-b border-l border-slate-200 font-bold text-slate-600 text-sm whitespace-nowrap">
                      {wt}
                    </th>
                  ))}
                  <th className="bg-indigo-50/50 p-4 border-b border-l-2 border-indigo-200 font-black text-indigo-800 whitespace-nowrap">
                    作目別 合計
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cropsList.map(crop => (
                  <tr key={crop} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 text-left font-bold text-slate-800 bg-white sticky left-0 z-10 shadow-[1px_0_0_0_#f1f5f9]">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
                        {crop}
                      </div>
                    </td>
                    {workTypesList.map(wt => (
                      <td key={wt} className="p-4 border-l border-slate-100 font-medium text-slate-600">
                        {formatValue(tableData[crop]?.[wt] || 0)}
                      </td>
                    ))}
                    <td className="p-4 border-l-2 border-indigo-100 font-black text-indigo-600 bg-indigo-50/20">
                      {formatValue(workTypesList.reduce((sum, wt) => sum + (tableData[crop]?.[wt] || 0), 0))}
                    </td>
                  </tr>
                ))}
                
                {/* 総合計行 */}
                <tr className="bg-slate-100/50 border-t-2 border-slate-200">
                  <td className="p-4 text-left font-black text-slate-700 sticky left-0 z-10 bg-slate-100 shadow-[1px_0_0_0_#e2e8f0]">
                    作業別 合計
                  </td>
                  {workTypesList.map(wt => (
                    <td key={wt} className="p-4 border-l border-slate-200 font-black text-slate-700">
                      {formatValue(cropsList.reduce((sum, crop) => sum + (tableData[crop]?.[wt] || 0), 0))}
                    </td>
                  ))}
                  <td className="p-4 border-l-2 border-indigo-200 font-black text-indigo-700 text-lg bg-indigo-100/50">
                    {formatValue(
                      cropsList.reduce((total, crop) => 
                        total + workTypesList.reduce((sum, wt) => sum + (tableData[crop]?.[wt] || 0), 0), 
                      0)
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
