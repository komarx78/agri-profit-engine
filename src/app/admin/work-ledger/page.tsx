"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '@/lib/tenant';
import { Table, Download, Loader2, Calendar as CalendarIcon, Briefcase, Calendar, Sparkles } from 'lucide-react';
import Papa from 'papaparse';
import { getJSTDate, getAttendancePeriod } from '@/lib/dateUtils';

export default function WorkLedgerPage() {
  const [workLogs, setWorkLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [closingDay, setClosingDay] = useState<number>(0);
  
  // 初期期間の計算（締日未ロード時は当月1日〜末日）
  const todayStr = getJSTDate();
  const [y, m] = todayStr.split('-').map(Number);
  const lastDate = new Date(y, m, 0).getDate();
  const firstDay = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = `${y}-${String(m).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`;
  
  const [startDate, setStartDate] = useState<string>(firstDay);
  const [endDate, setEndDate] = useState<string>(lastDay);
  const [activePreset, setActivePreset] = useState<string>('current-period');
  
  // 表示モード (時間 or 人件費 or 資材費 or 総コスト)
  const [viewMode, setViewMode] = useState<'hours' | 'cost' | 'materialCost' | 'totalCost'>('hours');

  const [salesLogs, setSalesLogs] = useState<any[]>([]);

  // 1. 初回マウント時に締日設定を取得し、初期集計期間を締日に連動させる
  useEffect(() => {
    async function initClosingDay() {
      try {
        const tenantId = await getCurrentTenantId();
        let resolvedDay = 0;
        if (typeof window !== 'undefined') {
          const localClosing = (tenantId ? localStorage.getItem(`agri_attendance_closing_day_${tenantId}`) : null) || localStorage.getItem('agri_attendance_closing_day');
          if (localClosing !== null && localClosing !== undefined) {
            resolvedDay = Number(localClosing);
          }
        }

        if (tenantId) {
          const { data: compData } = await supabase
            .from('company_settings')
            .select('attendance_closing_day')
            .eq('user_id', tenantId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (compData && compData.attendance_closing_day !== undefined && compData.attendance_closing_day !== null) {
            resolvedDay = Number(compData.attendance_closing_day);
            if (typeof window !== 'undefined') {
              localStorage.setItem(`agri_attendance_closing_day_${tenantId}`, String(resolvedDay));
              localStorage.setItem('agri_attendance_closing_day', String(resolvedDay));
            }
          }
        }

        setClosingDay(resolvedDay);
        // 締日サイクルで当月度の期間をセット
        const now = new Date();
        const p = getAttendancePeriod(now.getFullYear(), now.getMonth() + 1, resolvedDay);
        setStartDate(p.startDate);
        setEndDate(p.endDate);
      } catch (e) {
        console.warn('Closing day init warning:', e);
      }
    }
    initClosingDay();
  }, []);

  // 期間プリセットの切り替えハンドラ
  const applyPeriodPreset = (preset: 'current-period' | 'prev-period' | 'current-month' | 'prev-month') => {
    setActivePreset(preset);
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;

    if (preset === 'current-period') {
      const p = getAttendancePeriod(curYear, curMonth, closingDay);
      setStartDate(p.startDate);
      setEndDate(p.endDate);
    } else if (preset === 'prev-period') {
      const prevMonth = curMonth === 1 ? 12 : curMonth - 1;
      const prevYear = curMonth === 1 ? curYear - 1 : curYear;
      const p = getAttendancePeriod(prevYear, prevMonth, closingDay);
      setStartDate(p.startDate);
      setEndDate(p.endDate);
    } else if (preset === 'current-month') {
      const monthStr = String(curMonth).padStart(2, '0');
      const ld = new Date(curYear, curMonth, 0).getDate();
      setStartDate(`${curYear}-${monthStr}-01`);
      setEndDate(`${curYear}-${monthStr}-${String(ld).padStart(2, '0')}`);
    } else if (preset === 'prev-month') {
      const prevM = curMonth === 1 ? 12 : curMonth - 1;
      const prevY = curMonth === 1 ? curYear - 1 : curYear;
      const monthStr = String(prevM).padStart(2, '0');
      const ld = new Date(prevY, prevM, 0).getDate();
      setStartDate(`${prevY}-${monthStr}-01`);
      setEndDate(`${prevY}-${monthStr}-${String(ld).padStart(2, '0')}`);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [startDate, endDate]);

  async function fetchLogs() {
    if (!startDate || !endDate) return;
    setIsLoading(true);
    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) {
        setIsLoading(false);
        return;
      }

      // 自社テナントの作業実績の取得
      const { data: workData, error: workError } = await supabase
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
        .eq('user_id', tenantId)
        .gte('work_date', startDate)
        .lte('work_date', endDate)
        .eq('status', 'completed');

      if (workError) throw workError;
      
      // 自社テナントの収穫・売上実績の取得
      const { data: salesData, error: salesError } = await supabase
        .from('sales_logs')
        .select(`
          id,
          sales_date,
          total_sales,
          crops(name)
        `)
        .eq('user_id', tenantId)
        .gte('sales_date', startDate)
        .lte('sales_date', endDate)
        .eq('status', 'completed');

      if (salesError) throw salesError;
      
      setWorkLogs(workData || []);
      setSalesLogs(salesData || []);
    } catch (err) {
      console.error(err);
      alert('データの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }

  // クロス集計データの生成
  const { tableData, salesData, materialData, materialDetailsData, cropsList, workTypesList, totals } = useMemo(() => {
    const cropsSet = new Set<string>();
    const workTypesSet = new Set<string>();
    
    const pivotMap: Record<string, Record<string, number>> = {};
    const salesMap: Record<string, number> = {};
    const materialMap: Record<string, number> = {};
    const materialDetailsMap: Record<string, { name: string, qty: number, cost: number }[]> = {};
    
    let grandTotalCost = 0; // 作業費（人件費など）
    let grandTotalMaterial = 0; // 資材費
    let grandTotalSales = 0; // 売上

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
      else if (viewMode === 'cost' || viewMode === 'totalCost') value = laborCost; // 作業列には純粋な人件費を入れる
      else if (viewMode === 'materialCost') value = materialCost; // 既存互換

      pivotMap[cropName][workType] = (pivotMap[cropName][workType] || 0) + value;
      grandTotalCost += value;
      
      if (materialCost > 0) {
        materialMap[cropName] = (materialMap[cropName] || 0) + materialCost;
        grandTotalMaterial += materialCost;

        if (!materialDetailsMap[cropName]) materialDetailsMap[cropName] = [];
        // 同じ資材があればまとめる
        const existingMaterial = materialDetailsMap[cropName].find(m => m.name === log.materials?.name);
        if (existingMaterial) {
          existingMaterial.qty += materialQty;
          existingMaterial.cost += materialCost;
        } else {
          materialDetailsMap[cropName].push({
            name: log.materials?.name || '不明',
            qty: materialQty,
            cost: materialCost
          });
        }
      }
    });

    salesLogs.forEach(log => {
      const cropName = log.crops?.name || '作目未指定';
      cropsSet.add(cropName);
      const salesAmount = log.total_sales || 0;
      salesMap[cropName] = (salesMap[cropName] || 0) + salesAmount;
      grandTotalSales += salesAmount;
    });

    const cropsArray = Array.from(cropsSet).sort();
    const workTypesArray = Array.from(workTypesSet).sort();

    return { 
      tableData: pivotMap,
      salesData: salesMap,
      materialData: materialMap,
      materialDetailsData: materialDetailsMap,
      cropsList: cropsArray, 
      workTypesList: workTypesArray,
      totals: { cost: grandTotalCost, material: grandTotalMaterial, sales: grandTotalSales }
    };
  }, [workLogs, salesLogs, viewMode]);

  const handleExportCSV = () => {
    if (cropsList.length === 0) return;
    
    const exportData = cropsList.map(crop => {
      const row: any = { '作目': crop };
      workTypesList.forEach(wt => {
        row[wt] = Math.round(tableData[crop]?.[wt] || 0);
      });
      const rowLaborCost = workTypesList.reduce((sum, wt) => sum + (tableData[crop]?.[wt] || 0), 0);
      row['作業費合計'] = Math.round(rowLaborCost);
      if (viewMode === 'totalCost') {
        const material = materialData[crop] || 0;
        const totalCost = rowLaborCost + material;
        const sales = salesData[crop] || 0;
        
        row['資材費(種・苗・農薬等)'] = material;
        row['総費用(作業+資材)'] = Math.round(totalCost);
        row['売上実績'] = sales;
        row['粗利'] = sales - Math.round(totalCost);
      }
      return row;
    });

    const csv = Papa.unparse(exportData);
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `経営分析_${startDate}_${endDate}.csv`;
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6 pb-12 pt-4 sm:pt-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2 md:gap-3">
            <Table className="w-6 h-6 md:w-8 md:h-8 text-indigo-500 flex-shrink-0" />
            経営分析 (作目別 期間集計)
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-2 font-medium">任意の期間を指定して、作目ごとのトータルコストと最終的な売上・粗利を分析します。</p>
        </div>
      </div>

      {/* コントロールパネル */}
      <div className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        {/* 上段: 期間指定 ＆ プリセットボタン */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full lg:w-auto">
            <label className="text-slate-700 font-black text-xs sm:text-sm flex items-center gap-2 shrink-0">
              <CalendarIcon className="w-4 h-4 text-indigo-600" /> 対象期間:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setActivePreset('custom');
                }}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 text-xs sm:text-sm focus:outline-none focus:border-indigo-500"
              />
              <span className="text-slate-400 font-bold">〜</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setActivePreset('custom');
                }}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 text-xs sm:text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* プリセットボタン群 */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-500" />
              <span>プリセット:</span>
            </span>
            <button
              type="button"
              onClick={() => applyPeriodPreset('current-period')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                activePreset === 'current-period'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100/80'
              }`}
            >
              当月度 ({closingDay === 0 ? '末日締め' : `${closingDay}日締め`})
            </button>
            <button
              type="button"
              onClick={() => applyPeriodPreset('prev-period')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                activePreset === 'prev-period'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              前月度
            </button>
            <button
              type="button"
              onClick={() => applyPeriodPreset('current-month')}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                activePreset === 'current-month'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              今月 (カレンダー)
            </button>
            <button
              type="button"
              onClick={() => applyPeriodPreset('prev-month')}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                activePreset === 'prev-month'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              先月 (カレンダー)
            </button>
          </div>
        </div>

        {/* 下段: 表示切替 */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full">
          <label className="text-slate-500 font-bold flex items-center gap-2 shrink-0">
            <Briefcase className="w-5 h-5" /> 表示切替:
          </label>
          <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl gap-1">
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
          className="w-full md:w-auto md:ml-auto bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-sm mt-2 md:mt-0"
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
            指定した期間の実績データがありません。
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
                    作目別 作業費計
                  </th>
                  {viewMode === 'totalCost' && (
                    <>
                      <th className="bg-purple-50/50 p-4 border-b border-l border-purple-200 font-black text-purple-800 whitespace-nowrap">
                        資材費 (種・苗等)
                      </th>
                      <th className="bg-slate-100 p-4 border-b border-l-2 border-slate-300 font-black text-slate-800 whitespace-nowrap">
                        総費用 (作業+資材)
                      </th>
                      <th className="bg-emerald-50/50 p-4 border-b border-l border-emerald-200 font-black text-emerald-800 whitespace-nowrap">
                        売上実績
                      </th>
                      <th className="bg-amber-50/50 p-4 border-b border-l-2 border-amber-200 font-black text-amber-800 whitespace-nowrap">
                        粗利 (売上 - 総費用)
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cropsList.map(crop => {
                  const laborTotal = workTypesList.reduce((sum, wt) => sum + (tableData[crop]?.[wt] || 0), 0);
                  const materialTotal = materialData[crop] || 0;
                  const totalCost = laborTotal + materialTotal;
                  const sales = salesData[crop] || 0;
                  const profit = sales - totalCost;
                  
                  return (
                    <tr key={crop} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 text-left font-bold text-slate-800 bg-white sticky left-0 z-10 shadow-[1px_0_0_0_#f1f5f9] whitespace-nowrap">
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
                        {formatValue(laborTotal)}
                      </td>
                      {viewMode === 'totalCost' && (
                        <>
                          <td className="p-4 border-l border-purple-100 font-black text-purple-600 bg-purple-50/20 relative group cursor-help">
                            <div className="flex items-center justify-end gap-1">
                              ¥{materialTotal.toLocaleString()}
                              {materialDetailsData[crop] && materialDetailsData[crop].length > 0 ? (
                                <div className="w-4 h-4 rounded-full bg-purple-200 text-purple-700 flex items-center justify-center text-[10px] opacity-70 group-hover:opacity-100">i</div>
                              ) : null}
                            </div>
                            
                            {/* 内訳ツールチップ */}
                            {materialDetailsData[crop] && materialDetailsData[crop].length > 0 ? (
                              <div className="absolute z-50 bottom-full right-0 mb-2 w-56 bg-slate-800 text-white text-xs rounded-xl p-3 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                                <div className="font-bold border-b border-slate-600 pb-2 mb-2 text-center flex items-center justify-center gap-1">
                                  資材費の内訳
                                </div>
                                <div className="space-y-1.5">
                                  {materialDetailsData[crop].map((m, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-slate-700/50 rounded px-2 py-1">
                                      <span className="truncate pr-2 font-medium text-slate-200">{m.name} <span className="text-[10px] text-slate-400">({m.qty})</span></span>
                                      <span className="font-black text-purple-300">¥{m.cost.toLocaleString()}</span>
                                    </div>
                                  ))}
                                </div>
                                <div className="absolute -bottom-1.5 right-6 border-4 border-transparent border-t-slate-800"></div>
                              </div>
                            ) : null}
                          </td>
                          <td className="p-4 border-l-2 border-slate-200 font-black text-slate-700 bg-slate-100/80">
                            ¥{totalCost.toLocaleString()}
                          </td>
                          <td className="p-4 border-l border-emerald-100 font-black text-emerald-600 bg-emerald-50/20">
                            ¥{sales.toLocaleString()}
                          </td>
                          <td className={`p-4 border-l-2 border-amber-200 font-black text-lg bg-amber-50/20 ${profit < 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                            ¥{profit.toLocaleString()}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
                
                {/* 総合計行 */}
                {(() => {
                  const totalCostAll = totals.cost + totals.material;
                  const profitAll = totals.sales - totalCostAll;
                  return (
                    <tr className="bg-slate-100/50 border-t-2 border-slate-200">
                      <td className="p-4 text-left font-black text-slate-700 sticky left-0 z-10 bg-slate-100 shadow-[1px_0_0_0_#e2e8f0]">
                        全体 合計
                      </td>
                      {workTypesList.map(wt => (
                        <td key={wt} className="p-4 border-l border-slate-200 font-black text-slate-700">
                          {formatValue(cropsList.reduce((sum, crop) => sum + (tableData[crop]?.[wt] || 0), 0))}
                        </td>
                      ))}
                      <td className="p-4 border-l-2 border-indigo-200 font-black text-indigo-700 text-lg bg-indigo-100/50">
                        {formatValue(totals.cost)}
                      </td>
                      {viewMode === 'totalCost' && (
                        <>
                          <td className="p-4 border-l border-purple-200 font-black text-purple-700 text-lg bg-purple-100/50">
                            ¥{totals.material.toLocaleString()}
                          </td>
                          <td className="p-4 border-l-2 border-slate-300 font-black text-slate-800 text-lg bg-slate-200/60">
                            ¥{totalCostAll.toLocaleString()}
                          </td>
                          <td className="p-4 border-l border-emerald-200 font-black text-emerald-700 text-lg bg-emerald-100/50">
                            ¥{totals.sales.toLocaleString()}
                          </td>
                          <td className={`p-4 border-l-2 border-amber-300 font-black text-xl bg-amber-100/50 ${profitAll < 0 ? 'text-rose-600' : 'text-amber-700'}`}>
                            ¥{profitAll.toLocaleString()}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
