"use client";

/**
 * 品目・作業工程PDCAボード（直接利益作業の最大化・前年スピード比較・時間按分）
 *
 * 方針:
 *  1. 資材費20%等の推測経理計算を完全撤去し、「出荷売上 − 投入人件費（按分込）＝ 現場労働粗利」に特化。
 *  2. 準備・片付け等の非収穫作業（🔴）と、種まき・収穫等の直接利益を生む作業（🟢）の割合を可視化。
 *  3. 前年（昨年）と今年の作業工程ごとの時間を比較し、翌年の作業スピード改善（PDCA）に直結させる。
 *  4. 共通作業（農園全体の準備・片付け・草刈り等）を「📐 面積比」⇔「⏱️ 作業時間比」⇔「🚫 按分なし」でワンクリック切替。
 */

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '@/lib/tenant';
import { getAdminCropAnalysisDataAction, getTenantCultivationPlansAction } from '@/app/actions/farm';
import { classifyWorkProcess, PROCESS_CATEGORY_META, ProcessCategory } from '@/lib/workProcessUtils';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend
} from 'recharts';
import {
  Sprout,
  Loader2,
  User,
  Clock,
  BarChart2,
  TrendingUp,
  Sliders,
  Sparkles,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { HelpTooltip } from '@/components/HelpTooltip';
import { AdminOnlyGuard } from '@/components/AdminOnlyGuard';

const PIE_COLORS = ['#10b981', '#f59e0b', '#f43f5e', '#3b82f6', '#8b5cf6', '#14b8a6', '#ec4899'];
const WORKER_COLORS = ['#3b82f6', '#60a5fa', '#2563eb', '#93c5fd', '#1d4ed8', '#bfdbfe', '#1e3a8a'];
const FALLBACK_WAGE = 1000;

type AllocationMode = 'area' | 'hours' | 'none';

const yen = (n: number) => `¥${Math.round(n || 0).toLocaleString()}`;
const hoursLabel = (h: number) => {
  const totalMin = Math.round((h || 0) * 60);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  if (hh === 0) return `${mm}分`;
  return mm === 0 ? `${hh}時間` : `${hh}時間${mm}分`;
};

export default function CropAnalysisPage() {
  const [crops, setCrops] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [allWorkLogs, setAllWorkLogs] = useState<any[]>([]);
  const [prevYearWorkLogs, setPrevYearWorkLogs] = useState<any[]>([]);
  const [allSalesLogs, setAllSalesLogs] = useState<any[]>([]);
  const [allB2bOrders, setAllB2bOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCropId, setSelectedCropId] = useState<string>('all');
  const [year, setYear] = useState(new Date().getFullYear());
  const [allocationMode, setAllocationMode] = useState<AllocationMode>('area');

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) {
        setIsLoading(false);
        return;
      }

      const srvRes = await getAdminCropAnalysisDataAction(tenantId, year);

      if (srvRes?.success) {
        setCrops(srvRes.crops || []);
        setAllWorkLogs(srvRes.workLogs || []);
        setPrevYearWorkLogs(srvRes.prevWorkLogs || []);
        setAllSalesLogs(srvRes.salesLogs || []);
        setAllB2bOrders(srvRes.b2bOrders || []);
        setFields(srvRes.fields || []);
        setPlans(srvRes.plans || []);
      } else {
        const [cRes, wRes, pwRes, sRes, fRes, pRes] = await Promise.all([
          supabase.from('crops').select('*').eq('user_id', tenantId).order('name'),
          supabase
            .from('work_logs')
            .select('*, workers(name, hourly_wage)')
            .eq('user_id', tenantId)
            .gte('work_date', `${year}-01-01`)
            .lte('work_date', `${year}-12-31`),
          supabase
            .from('work_logs')
            .select('*, workers(name, hourly_wage)')
            .eq('user_id', tenantId)
            .gte('work_date', `${year - 1}-01-01`)
            .lte('work_date', `${year - 1}-12-31`),
          supabase
            .from('sales_logs')
            .select('*')
            .eq('user_id', tenantId)
            .gte('sales_date', `${year}-01-01`)
            .lte('sales_date', `${year}-12-31`),
          supabase.from('fields').select('*').eq('user_id', tenantId),
          getTenantCultivationPlansAction(tenantId, year)
        ]);
        setCrops(cRes.data || []);
        setAllWorkLogs(wRes.data || []);
        setPrevYearWorkLogs(pwRes.data || []);
        setAllSalesLogs(sRes.data || []);
        setFields(fRes.data || []);
        setPlans(pRes?.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 品目別 面積・作業時間（3分類）・共通作業按分・出荷売上の集計 ---
  const { cropStats, commonPool, totalSummary } = useMemo(() => {
    const fieldAreaMap: Record<string, number> = {};
    fields.forEach(f => {
      fieldAreaMap[f.id] = Number(f.area_size) || 0;
    });

    // 各品目の作付面積を集計
    const cropAreaMap: Record<string, number> = {};
    plans.forEach(p => {
      if (!p.crop_id) return;
      const a = fieldAreaMap[p.field_id] || Number(p.calculated_area) || 0;
      cropAreaMap[p.crop_id] = (cropAreaMap[p.crop_id] || 0) + a;
    });

    const stats: Record<string, any> = {};
    const nameToIdMap: Record<string, string> = {};
    crops.forEach(c => {
      nameToIdMap[c.name] = c.id;
      stats[c.id] = {
        id: c.id,
        name: c.name,
        area: cropAreaMap[c.id] || 0,
        actualSales: 0,
        harvestKg: 0,
        recordedHours: 0,
        recordedLaborCost: 0,
        directHours: 0,
        careHours: 0,
        prepHours: 0,
        prevYearHours: 0,
        prevYearPrepHours: 0
      };
    });

    // 売上・収穫量集計
    allSalesLogs.forEach(s => {
      if (s.status === 'planned') return;
      if (s.crop_id && stats[s.crop_id]) {
        stats[s.crop_id].actualSales += Number(s.total_sales) || 0;
        const unit = String(s.unit || 'kg').toLowerCase();
        if (unit === 'kg' || unit === 'ｋｇ') {
          stats[s.crop_id].harvestKg += Number(s.quantity) || 0;
        }
      }
    });

    allB2bOrders.forEach(ord => {
      if (ord.status === 'cancelled') return;
      const isActual = ord.status === 'delivered' || ord.status === 'invoiced' || ord.status === 'paid';
      if (!isActual) return;
      const items = Array.isArray(ord.items) ? ord.items : [];
      items.forEach((item: any) => {
        const cid = nameToIdMap[item.crop_name];
        if (cid && stats[cid]) {
          const amt = Number(item.amount) || Number(item.quantity || 0) * Number(item.unit_price || 0) || 0;
          stats[cid].actualSales += amt;
        }
      });
    });

    // 当年の作業ログ集計（品目指定あり vs 共通作業）
    let unassignedHours = 0;
    let unassignedCost = 0;
    let unassignedCount = 0;

    allWorkLogs.forEach(w => {
      if (w.status !== 'completed' || w.approval_status === 'rejected') return;
      const hours = (Number(w.duration_minutes) || 0) / 60;
      if (hours <= 0) return;
      const wage = Number(w.workers?.hourly_wage) || FALLBACK_WAGE;
      const cost = hours * wage;
      const cat = classifyWorkProcess(w.work_type || w.task_title);

      if (w.crop_id && stats[w.crop_id]) {
        stats[w.crop_id].recordedHours += hours;
        stats[w.crop_id].recordedLaborCost += cost;
        if (cat === 'direct') stats[w.crop_id].directHours += hours;
        else if (cat === 'prep_cleanup') stats[w.crop_id].prepHours += hours;
        else stats[w.crop_id].careHours += hours;
      } else {
        unassignedHours += hours;
        unassignedCost += cost;
        unassignedCount++;
      }
    });

    // 前年の作業ログ集計（品目別比較用）
    prevYearWorkLogs.forEach(w => {
      if (w.status !== 'completed' || w.approval_status === 'rejected') return;
      const hours = (Number(w.duration_minutes) || 0) / 60;
      if (hours <= 0) return;
      const cat = classifyWorkProcess(w.work_type || w.task_title);
      if (w.crop_id && stats[w.crop_id]) {
        stats[w.crop_id].prevYearHours += hours;
        if (cat === 'prep_cleanup') stats[w.crop_id].prevYearPrepHours += hours;
      }
    });

    const activeCrops = Object.values(stats).filter(
      (s: any) => s.area > 0 || s.recordedHours > 0 || s.actualSales > 0 || s.prevYearHours > 0
    );
    const totalArea = activeCrops.reduce((sum: number, s: any) => sum + s.area, 0);
    const totalRecHours = activeCrops.reduce((sum: number, s: any) => sum + s.recordedHours, 0);
    const count = activeCrops.length || 1;

    const finalList = activeCrops
      .map((s: any) => {
        let ratio = 0;
        if (allocationMode === 'area') {
          ratio = totalArea > 0 ? s.area / totalArea : 1 / count;
        } else if (allocationMode === 'hours') {
          ratio = totalRecHours > 0 ? s.recordedHours / totalRecHours : 1 / count;
        } else {
          ratio = 0;
        }

        const allocHours = unassignedHours * ratio;
        const allocCost = unassignedCost * ratio;
        const totalHours = s.recordedHours + allocHours;
        const totalLaborCost = s.recordedLaborCost + allocCost;
        const totalPrepHours = s.prepHours + allocHours;

        const directRatio = totalHours > 0 ? Math.round((s.directHours / totalHours) * 100) : 0;
        const careRatio = totalHours > 0 ? Math.round((s.careHours / totalHours) * 100) : 0;
        const prepRatio = totalHours > 0 ? Math.max(0, 100 - directRatio - careRatio) : 0;

        const profit = s.actualSales - totalLaborCost;
        const profitPerHour = totalHours > 0 ? profit / totalHours : null;
        const hoursPer100kg = s.harvestKg > 0 ? (totalHours / s.harvestKg) * 100 : null;

        return {
          ...s,
          allocHours,
          allocCost,
          totalHours,
          totalLaborCost,
          totalPrepHours,
          directRatio,
          careRatio,
          prepRatio,
          profit,
          profitPerHour,
          hoursPer100kg
        };
      })
      .sort((a: any, b: any) => b.profit - a.profit);

    const tot = finalList.reduce(
      (acc: any, item: any) => {
        acc.sales += item.actualSales;
        acc.laborCost += item.totalLaborCost;
        acc.hours += item.totalHours;
        acc.directHours += item.directHours;
        acc.careHours += item.careHours;
        acc.prepHours += item.totalPrepHours;
        return acc;
      },
      { sales: 0, laborCost: 0, hours: 0, directHours: 0, careHours: 0, prepHours: 0 }
    );

    return {
      cropStats: finalList,
      commonPool: { count: unassignedCount, hours: unassignedHours, cost: unassignedCost },
      totalSummary: {
        ...tot,
        profit: tot.sales - tot.laborCost,
        directRatio: tot.hours > 0 ? Math.round((tot.directHours / tot.hours) * 100) : 0,
        prepRatio: tot.hours > 0 ? Math.round((tot.prepHours / tot.hours) * 100) : 0,
        profitPerHour: tot.hours > 0 ? (tot.sales - tot.laborCost) / tot.hours : null
      }
    };
  }, [crops, fields, plans, allSalesLogs, allB2bOrders, allWorkLogs, prevYearWorkLogs, allocationMode]);

  // --- ⏱️ 作業工程ごとの振り返りと前年比較（PDCAテーブル） ---
  const processPdcaRows = useMemo(() => {
    const filterLog = (w: any) => {
      if (w.status !== 'completed' || w.approval_status === 'rejected') return false;
      if (selectedCropId === 'all') return true;
      return w.crop_id === selectedCropId;
    };

    const currentFiltered = allWorkLogs.filter(filterLog);
    const prevFiltered = prevYearWorkLogs.filter(filterLog);

    const map: Record<
      string,
      {
        workType: string;
        category: ProcessCategory;
        currentHours: number;
        currentCost: number;
        currentCount: number;
        prevHours: number;
      }
    > = {};

    currentFiltered.forEach(w => {
      const h = (Number(w.duration_minutes) || 0) / 60;
      if (h <= 0) return;
      const wage = Number(w.workers?.hourly_wage) || FALLBACK_WAGE;
      const wt = String(w.work_type || w.task_title || 'その他').trim();
      if (!map[wt]) {
        map[wt] = {
          workType: wt,
          category: classifyWorkProcess(wt),
          currentHours: 0,
          currentCost: 0,
          currentCount: 0,
          prevHours: 0
        };
      }
      map[wt].currentHours += h;
      map[wt].currentCost += h * wage;
      map[wt].currentCount += 1;
    });

    prevFiltered.forEach(w => {
      const h = (Number(w.duration_minutes) || 0) / 60;
      if (h <= 0) return;
      const wt = String(w.work_type || w.task_title || 'その他').trim();
      if (!map[wt]) {
        map[wt] = {
          workType: wt,
          category: classifyWorkProcess(wt),
          currentHours: 0,
          currentCost: 0,
          currentCount: 0,
          prevHours: 0
        };
      }
      map[wt].prevHours += h;
    });

    const totalCurrent = Object.values(map).reduce((s, r) => s + r.currentHours, 0);

    return Object.values(map)
      .map(r => {
        const sharePct = totalCurrent > 0 ? Math.round((r.currentHours / totalCurrent) * 100) : 0;
        const diffHours = r.currentHours - r.prevHours;
        return {
          ...r,
          sharePct,
          diffHours
        };
      })
      .sort((a, b) => b.currentHours - a.currentHours);
  }, [allWorkLogs, prevYearWorkLogs, selectedCropId]);

  // 円グラフ用データ
  const { workPieData, workerPieData } = useMemo(() => {
    const targetLogs =
      selectedCropId === 'all'
        ? allWorkLogs.filter(w => w.status === 'completed' && w.approval_status !== 'rejected')
        : allWorkLogs.filter(w => w.status === 'completed' && w.approval_status !== 'rejected' && w.crop_id === selectedCropId);

    const workTypeHours: Record<string, number> = {};
    const workerTypeHours: Record<string, number> = {};

    targetLogs.forEach(log => {
      const hours = (Number(log.duration_minutes) || 0) / 60;
      const wType = log.work_type || 'その他';
      workTypeHours[wType] = (workTypeHours[wType] || 0) + hours;

      const wName = log.workers?.name || '不明';
      workerTypeHours[wName] = (workerTypeHours[wName] || 0) + hours;
    });

    return {
      workPieData: Object.keys(workTypeHours)
        .map(k => ({ name: k, value: Number(workTypeHours[k].toFixed(1)) }))
        .filter(d => d.value > 0)
        .sort((a, b) => b.value - a.value),
      workerPieData: Object.keys(workerTypeHours)
        .map(k => ({ name: k, value: Number(workerTypeHours[k].toFixed(1)) }))
        .filter(d => d.value > 0)
        .sort((a, b) => b.value - a.value)
    };
  }, [allWorkLogs, selectedCropId]);

  return (
    <AdminOnlyGuard>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6 pb-16 pt-4 sm:pt-6">
        {/* ヘッダー */}
        <header className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-black mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>作業工程の振り返りとPDCA（直接利益を生む作業の最大化）</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2.5">
                <Sprout className="w-7 h-7 text-emerald-600" />
                <span>品目・作業工程PDCAボード（前年スピード比較）</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-bold mt-1">
                準備や片付けなどの非収穫作業（🔴）を特定・短縮し、収穫や種まきなど「直接利益を生む作業（🟢）」の割合を最大化します。
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-black text-slate-800 shadow-2xs cursor-pointer"
              >
                {[...Array(5)].map((_, i) => {
                  const y = new Date().getFullYear() - 2 + i;
                  return (
                    <option key={y} value={y}>
                      {y}年度（前年 {y - 1}年と比較）
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* ⚡ ワンクリック按分切替バー */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                <Sliders className="w-4 h-4" />
                <span>品目未指定の共通作業（準備・片付け・草刈り等）の自動按分ルール</span>
              </div>
              <p className="text-[11px] text-slate-300 font-bold">
                品目共通の作業記録：{commonPool.count}件（計 {hoursLabel(commonPool.hours)} / 人件費 {yen(commonPool.cost)}）
              </p>
            </div>

            <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setAllocationMode('area')}
                className={`px-3 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  allocationMode === 'area' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                📐 作付面積比で按分
              </button>
              <button
                type="button"
                onClick={() => setAllocationMode('hours')}
                className={`px-3 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  allocationMode === 'hours' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                ⏱️ 作業時間比で按分
              </button>
              <button
                type="button"
                onClick={() => setAllocationMode('none')}
                className={`px-3 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  allocationMode === 'none' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                🚫 按分なし
              </button>
            </div>
          </div>
        </header>

        {isLoading ? (
          <div className="h-64 bg-white rounded-3xl border border-slate-200 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            <p className="text-xs font-bold text-slate-500">品目ごとの作業時間と前年比較データを集計中...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* トップKPI（直接利益作業の黄金比率） */}
            <section className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl">
                <span className="text-[11px] font-black text-emerald-800 block">🟢 直接利益を生む作業の割合</span>
                <div className="text-2xl font-black text-emerald-900 mt-1">{totalSummary.directRatio}%</div>
                <p className="text-[11px] font-bold text-emerald-700 mt-0.5">
                  播種・定植・収穫・出荷：{hoursLabel(totalSummary.directHours)}
                </p>
              </div>

              <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl">
                <span className="text-[11px] font-black text-rose-800 block">🔴 準備・片付け等の非生産作業</span>
                <div className="text-2xl font-black text-rose-700 mt-1">{totalSummary.prepRatio}%</div>
                <p className="text-[11px] font-bold text-rose-700 mt-0.5">
                  計 {hoursLabel(totalSummary.prepHours)}（短縮・外注化ターゲット）
                </p>
              </div>

              <div className="bg-white border border-slate-200 p-4 rounded-2xl">
                <span className="text-[11px] font-black text-slate-500 block">📈 農園全体の現場労働粗利</span>
                <div className="text-2xl font-black text-slate-900 mt-1">{yen(totalSummary.profit)}</div>
                <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                  売上 {yen(totalSummary.sales)} − 人件費 {yen(totalSummary.laborCost)}
                </p>
              </div>

              <div className="bg-white border border-slate-200 p-4 rounded-2xl">
                <span className="text-[11px] font-black text-slate-500 block">⚡ 1時間あたりの労働粗利</span>
                <div className="text-2xl font-black text-emerald-700 mt-1">
                  {totalSummary.profitPerHour !== null ? `${yen(totalSummary.profitPerHour)}/h` : '—'}
                </div>
                <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                  総労働時間 {hoursLabel(totalSummary.hours)}
                </p>
              </div>
            </section>

            {/* ⏱️ セクション1：作業工程の振り返りと前年比較（PDCA） */}
            <section className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2">
                    <Clock className="w-6 h-6 text-emerald-600" />
                    <span>1. 作業工程ごとの時間振り返り・前年スピード比較（PDCA）</span>
                  </h2>
                  <p className="text-xs font-bold text-slate-500 mt-0.5">
                    どの作業工程に何時間かかったかを前年（{year - 1}年）と比較し、準備・片付けの短縮と直接利益作業の拡大に活かします。
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-black text-slate-500">対象品目:</span>
                  <select
                    value={selectedCropId}
                    onChange={e => setSelectedCropId(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-black text-slate-800 cursor-pointer"
                  >
                    <option value="all">🌱 すべての品目（農園全体）</option>
                    {crops.map(c => (
                      <option key={c.id} value={c.id}>
                        🌱 {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-black">作業工程</th>
                      <th className="px-4 py-3 font-black">工程分類</th>
                      <th className="px-4 py-3 font-black text-right">{year}年 所要時間</th>
                      <th className="px-4 py-3 font-black text-right">構成比</th>
                      <th className="px-4 py-3 font-black text-right">前年（{year - 1}年）</th>
                      <th className="px-4 py-3 font-black text-right">前年比（時間増減）</th>
                      <th className="px-4 py-3 font-black">PDCA診断・改善ヒント</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {processPdcaRows.length > 0 ? (
                      processPdcaRows.map(row => {
                        const meta = PROCESS_CATEGORY_META[row.category];
                        const isPrep = row.category === 'prep_cleanup';
                        const isDirect = row.category === 'direct';
                        return (
                          <tr key={row.workType} className="hover:bg-slate-50/80">
                            <td className="px-4 py-3.5 font-black text-slate-800">
                              {row.workType}
                              <span className="text-[11px] font-bold text-slate-400 ml-1.5">({row.currentCount}回)</span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={`px-2 py-0.5 text-[11px] font-black rounded-md border ${meta.badgeClass}`}>
                                {meta.shortLabel}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right font-black text-slate-900">
                              {hoursLabel(row.currentHours)}
                              <div className="text-[10px] font-bold text-slate-400">{yen(row.currentCost)}</div>
                            </td>
                            <td className="px-4 py-3.5 text-right font-black text-slate-700">{row.sharePct}%</td>
                            <td className="px-4 py-3.5 text-right font-bold text-slate-500">
                              {row.prevHours > 0 ? hoursLabel(row.prevHours) : '記録なし'}
                            </td>
                            <td className="px-4 py-3.5 text-right font-black">
                              {row.prevHours > 0 ? (
                                row.diffHours < 0 ? (
                                  <span className="inline-flex items-center gap-0.5 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg text-xs">
                                    <ArrowDownRight className="w-3.5 h-3.5" />
                                    {hoursLabel(Math.abs(row.diffHours))} 短縮
                                  </span>
                                ) : row.diffHours > 0 ? (
                                  <span className="inline-flex items-center gap-0.5 text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg text-xs">
                                    <ArrowUpRight className="w-3.5 h-3.5" />+{hoursLabel(row.diffHours)}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-xs">±0</span>
                                )
                              ) : (
                                <span className="text-slate-400 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-xs font-bold">
                              {isPrep ? (
                                <span className="text-rose-700 flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                  段取り標準化・動線見直し・外部委託で短縮余地あり
                                </span>
                              ) : isDirect ? (
                                <span className="text-emerald-700 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                  直接利益を生むコア作業（時間比重を高めたい工程）
                                </span>
                              ) : (
                                <span className="text-amber-800">生育管理工程（機械化・一括処理で効率化）</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-slate-400 font-bold">
                          作業工程の記録がまだありません
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 📊 セクション2：品目別の収支・時間按分・直接作業率比較テーブル */}
            <section className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2">
                    <TrendingUp className="w-6 h-6 text-emerald-600" />
                    <span>2. 品目別の時間按分・直接利益作業率・労働粗利一覧</span>
                    <HelpTooltip content="品目ごとにどれだけ時間を費やし、1時間あたりいくら利益を生んだかを比較します。" />
                  </h2>
                  <p className="text-xs font-bold text-slate-500 mt-0.5">
                    ※経費・資材計算は切り離し、「出荷売上 − 投入人件費（按分込）＝ 現場労働粗利」で純粋な作業採算を比較します。
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-black">品目</th>
                      <th className="px-4 py-3 font-black text-right">総労働時間（按分込）</th>
                      <th className="px-4 py-3 font-black">工程比率（🟢直接 / 🟡管理 / 🔴準備片付）</th>
                      <th className="px-4 py-3 font-black text-right">出荷売上</th>
                      <th className="px-4 py-3 font-black text-right">投入人件費</th>
                      <th className="px-4 py-3 font-black text-right">現場労働粗利</th>
                      <th className="px-4 py-3 font-black text-right">1時間あたり利益</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cropStats.length > 0 ? (
                      cropStats.map((stat: any) => (
                        <tr key={stat.id} className="hover:bg-slate-50/80">
                          <td className="px-4 py-4">
                            <div className="font-black text-slate-800 text-base">🌱 {stat.name}</div>
                            <div className="text-[11px] font-bold text-slate-400">
                              {stat.area > 0 ? `作付 ${stat.area}a` : '面積未設定'}
                              {stat.harvestKg > 0 ? ` ・ 収穫 ${Math.round(stat.harvestKg)}kg` : ''}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="font-black text-slate-900">{hoursLabel(stat.totalHours)}</div>
                            {stat.allocHours > 0 && (
                              <div className="text-[10px] font-bold text-indigo-600">
                                うち共通按分 +{hoursLabel(stat.allocHours)}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4 min-w-[200px]">
                            <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden flex mb-1">
                              <div className="bg-emerald-500 h-full" style={{ width: `${stat.directRatio}%` }} />
                              <div className="bg-amber-400 h-full" style={{ width: `${stat.careRatio}%` }} />
                              <div className="bg-rose-500 h-full" style={{ width: `${stat.prepRatio}%` }} />
                            </div>
                            <div className="flex justify-between text-[10px] font-black">
                              <span className="text-emerald-700">🟢直接 {stat.directRatio}%</span>
                              <span className="text-amber-700">🟡管理 {stat.careRatio}%</span>
                              <span className="text-rose-700">🔴準備片付 {stat.prepRatio}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right font-black text-slate-900">{yen(stat.actualSales)}</td>
                          <td className="px-4 py-4 text-right font-black text-rose-600">{yen(stat.totalLaborCost)}</td>
                          <td className="px-4 py-4 text-right">
                            <span className={`font-black text-base ${stat.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {yen(stat.profit)}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <span className="font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl text-xs">
                              {stat.profitPerHour !== null ? `${yen(stat.profitPerHour)}/h` : '—'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-slate-400 font-bold">
                          データがありません
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 円グラフ分析 */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                <h3 className="text-center font-black text-slate-700 mb-4 flex items-center justify-center gap-2">
                  <BarChart2 className="w-5 h-5 text-emerald-600" />
                  作業工程別の時間割合
                </h3>
                {workPieData.length > 0 ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={workPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={88}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                        >
                          {workPieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value: any) => [`${value} 時間`, '稼働時間']} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-72 flex items-center justify-center text-slate-400 font-bold">作業記録がありません</div>
                )}
              </div>

              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                <h3 className="text-center font-black text-slate-700 mb-4 flex items-center justify-center gap-2">
                  <User className="w-5 h-5 text-blue-500" />
                  スタッフ別の稼働時間割合
                </h3>
                {workerPieData.length > 0 ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={workerPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={88}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                        >
                          {workerPieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={WORKER_COLORS[index % WORKER_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value: any) => [`${value} 時間`, '稼働時間']} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-72 flex items-center justify-center text-slate-400 font-bold">作業記録がありません</div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </AdminOnlyGuard>
  );
}
