"use client";

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, CartesianGrid, Cell, ComposedChart, Line, Area
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '@/lib/tenant';
import {
  getAdminDashboardDataAction,
  saveProcessImprovementRecipeAction,
  deleteProcessImprovementRecipeAction,
  saveFarmDriveUrlAction
} from '@/app/actions/farm';
import { HelpTooltip } from '@/components/HelpTooltip';
import {
  classifyWorkProcess,
  classifySixStage,
  SIX_STAGES_ORDER,
  SIX_STAGE_META,
  SixStageKey,
  parseWorkMemoBottleneck,
  ProcessImprovementRecipe,
  RecipeActionType
} from '@/lib/workProcessUtils';
import { getJSTDateWithOffset } from '@/lib/dateUtils';
import {
  Activity, Clock, Sprout, TrendingUp, Banknote, UserCheck,
  CalendarDays, MapPin, Calculator, AlertCircle,
  CheckCircle2, ArrowRight, Copy, Check, ExternalLink,
  Sparkles, Users, Lock, Plus, Trash2, FolderOpen, AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';

const formatCurrency = (val: number) => {
  const rounded = Math.round(val || 0);
  if (rounded < 0) {
    return `▲¥${Math.abs(rounded).toLocaleString()}`;
  }
  return `¥${rounded.toLocaleString()}`;
};

const formatYAxisTenThousand = (val: number) => {
  const rounded = Math.round((val || 0) / 10000);
  if (rounded === 0) return '¥0';
  if (rounded < 0) return `▲¥${Math.abs(rounded)}万`;
  return `¥${rounded}万`;
};

const hoursLabel = (h: number) => {
  const totalMin = Math.round((h || 0) * 60);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  if (hh === 0) return `${mm}分`;
  return mm === 0 ? `${hh}時間` : `${hh}時間${mm}分`;
};

interface StageCellAnalysis {
  stageKey: SixStageKey;
  actualMinutes: number;
  actualHours: number;
  benchmarkHours: number;
  gapHours: number;
  laborCost: number;
  distinctDays: number;
  logCount: number;
  signal: 'red' | 'yellow' | 'green';
  signalReason: string;
  bottleneckLogs: Array<{
    id: string;
    date: string;
    workerName: string;
    workType: string;
    durationMinutes: number;
    causeTag: string;
    extraMinutes: number;
    cleanBody: string;
    nextActionIdea: string;
    driveUrl: string;
    photoUrl: string;
  }>;
  recipes: ProcessImprovementRecipe[];
}

interface UnitSignalRow {
  unitKey: string;
  fieldId: string;
  fieldName: string;
  cropId: string;
  cropName: string;
  area10a: number;
  totalHours: number;
  directHours: number;
  prepCleanupHours: number;
  directRatio: number;
  prepRatio: number;
  sales: number;
  laborCost: number;
  profit: number;
  hourlyProfit: number;
  redCount: number;
  yellowCount: number;
  stages: Record<SixStageKey, StageCellAnalysis>;
}

export default function DashboardPage() {
  const [dataViewMode, setDataViewMode] = useState<'actualOnly' | 'includePlanned'>('actualOnly');

  const [rawWorkLogsState, setRawWorkLogsState] = useState<any[]>([]);
  const [rawSalesLogsState, setRawSalesLogsState] = useState<any[]>([]);
  const [rawB2bOrdersState, setRawB2bOrdersState] = useState<any[]>([]);
  const [plansState, setPlansState] = useState<any[]>([]);
  const [fieldsState, setFieldsState] = useState<any[]>([]);
  const [cropsState, setCropsState] = useState<any[]>([]);
  const [processRecipes, setProcessRecipes] = useState<ProcessImprovementRecipe[]>([]);
  const [farmDriveUrl, setFarmDriveUrl] = useState<string>('');
  const [showDriveModal, setShowDriveModal] = useState<boolean>(false);
  const [driveUrlInput, setDriveUrlInput] = useState<string>('');
  const [isSavingDrive, setIsSavingDrive] = useState<boolean>(false);

  const [profitabilityData, setProfitabilityData] = useState<any[]>([]);
  const [fieldData, setFieldData] = useState<any[]>([]);
  const [workerProductivityData, setWorkerProductivityData] = useState<any[]>([]);
  const [monthlyTrendData, setMonthlyTrendData] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    sales: 0,
    laborCost: 0,
    profit: 0,
    margin: 0,
    totalMinutes: 0,
    directMinutes: 0,
    careMinutes: 0,
    prepMinutes: 0,
    hourlyProfit: 0
  });
  const [tenantId, setTenantId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // 現場クイックアラート用ステート
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);
  const [todayWorkCount, setTodayWorkCount] = useState<number>(0);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  // 🚦 6大工程・信号機レーンの選択＆処方箋作成ステート
  const [selectedUnitKey, setSelectedUnitKey] = useState<string | null>(null);
  const [selectedStageKey, setSelectedStageKey] = useState<SixStageKey>('planting');
  const [recipeActionType, setRecipeActionType] = useState<RecipeActionType>('add_pre_step');
  const [recipeTitle, setRecipeTitle] = useState<string>('');
  const [recipeReason, setRecipeReason] = useState<string>('');
  const [recipeTargetHours, setRecipeTargetHours] = useState<number>(4);
  const [recipeTempWorkers, setRecipeTempWorkers] = useState<number>(5);
  const [recipeTargetDays, setRecipeTargetDays] = useState<number>(2);
  const [recipeDriveUrl, setRecipeDriveUrl] = useState<string>('');
  const [alsoScheduleTask, setAlsoScheduleTask] = useState<boolean>(true);
  const [scheduleTaskDate, setScheduleTaskDate] = useState<string>(() => getJSTDateWithOffset(7).dateStr);
  const [isSavingRecipe, setIsSavingRecipe] = useState<boolean>(false);
  const [showAllTrends, setShowAllTrends] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const currentOwnerId = await getCurrentTenantId();
      if (!currentOwnerId) {
        setIsLoading(false);
        return;
      }
      setTenantId(currentOwnerId);

      let rawWorkLogs: any[] = [];
      let rawSalesLogs: any[] = [];
      let rawB2bOrders: any[] = [];

      const srvRes = await getAdminDashboardDataAction(currentOwnerId);
      if (srvRes?.success) {
        rawWorkLogs = srvRes.workLogs || [];
        rawSalesLogs = srvRes.salesLogs || [];
        rawB2bOrders = srvRes.b2bOrders || [];
        setPlansState(srvRes.plans || []);
        setFieldsState(srvRes.fields || []);
        setCropsState(srvRes.crops || []);
        setProcessRecipes(srvRes.processRecipes || []);
        setFarmDriveUrl(srvRes.farmDriveUrl || '');
        setDriveUrlInput(srvRes.farmDriveUrl || '');
        if (srvRes.ownerId) setTenantId(srvRes.ownerId);
      } else {
        const [workRes, salesRes] = await Promise.all([
          supabase.from('work_logs').select(`
            id,
            work_date,
            work_type,
            task_title,
            duration_minutes,
            status,
            approval_status,
            memo,
            photo_url,
            crop_id,
            field_id,
            crops(id, name),
            workers(id, name, hourly_wage),
            fields(id, name, area_size)
          `).eq('user_id', currentOwnerId),
          supabase.from('sales_logs').select(`
            sales_date,
            total_sales,
            status,
            crop_id,
            crops(id, name),
            sales_channels(name)
          `).eq('user_id', currentOwnerId)
        ]);
        rawWorkLogs = workRes.data || [];
        rawSalesLogs = salesRes.data || [];
      }

      setRawWorkLogsState(rawWorkLogs);
      setRawSalesLogsState(rawSalesLogs);
      setRawB2bOrdersState(rawB2bOrders);

      const pendingCount = rawWorkLogs.filter((log: any) => log.status === 'completed' && log.approval_status === 'pending').length;
      const todayStr = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
      const todayCount = rawWorkLogs.filter((log: any) => log.work_date === todayStr).length;
      setPendingApprovalsCount(pendingCount);
      setTodayWorkCount(todayCount);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // 基本集計と6大工程・信号機レーンの構築
  const { signalRows, bottleneckCountTotal } = useMemo(() => {
    const workLogs = rawWorkLogsState.filter((log: any) =>
      dataViewMode === 'includePlanned' ? true : log.status === 'completed'
    );
    const salesLogs = rawSalesLogsState.filter((log: any) =>
      dataViewMode === 'includePlanned' ? true : log.status === 'completed'
    );
    const b2bOrders = rawB2bOrdersState.filter((ord: any) =>
      dataViewMode === 'includePlanned'
        ? ord.status !== 'cancelled'
        : (ord.status === 'delivered' || ord.status === 'invoiced' || ord.status === 'paid')
    );

    const cropHours: Record<string, number> = {};
    const workerHours: Record<string, number> = {};
    const fieldHours: Record<string, number> = {};
    const cropWageMap: Record<string, number> = {};
    const fieldWageMap: Record<string, number> = {};
    const workerCropHours: Record<string, Record<string, number>> = {};
    const workerWages: Record<string, number> = {};
    const workerTotalCost: Record<string, number> = {};
    const monthlyMap: Record<string, { 売上: number; 人件費: number }> = {};
    const cropToFieldHours: Record<string, Record<string, number>> = {};

    const cropSalesMap: Record<string, number> = {};
    let totalSales = 0;

    salesLogs.forEach((log: any) => {
      const cName = log.crops?.name || '未設定';
      const sales = Number(log.total_sales) || 0;
      const dateStr = log.sales_date;
      totalSales += sales;
      cropSalesMap[cName] = (cropSalesMap[cName] || 0) + sales;
      if (dateStr) {
        const monthStr = dateStr.substring(0, 7);
        if (!monthlyMap[monthStr]) monthlyMap[monthStr] = { 売上: 0, 人件費: 0 };
        monthlyMap[monthStr].売上 += sales;
      }
    });

    b2bOrders.forEach((ord: any) => {
      const dateStr = ord.delivery_date;
      const items = Array.isArray(ord.items) ? ord.items : [];
      if (items.length > 0) {
        items.forEach((item: any) => {
          const cName = item.crop_name || '未設定';
          const sales = Number(item.amount) || (Number(item.quantity || 0) * Number(item.unit_price || 0)) || 0;
          totalSales += sales;
          cropSalesMap[cName] = (cropSalesMap[cName] || 0) + sales;
          if (dateStr) {
            const monthStr = dateStr.substring(0, 7);
            if (!monthlyMap[monthStr]) monthlyMap[monthStr] = { 売上: 0, 人件費: 0 };
            monthlyMap[monthStr].売上 += sales;
          }
        });
      } else if (ord.total_amount) {
        const sales = Number(ord.total_amount) || 0;
        totalSales += sales;
        cropSalesMap['B2B注文'] = (cropSalesMap['B2B注文'] || 0) + sales;
        if (dateStr) {
          const monthStr = dateStr.substring(0, 7);
          if (!monthlyMap[monthStr]) monthlyMap[monthStr] = { 売上: 0, 人件費: 0 };
          monthlyMap[monthStr].売上 += sales;
        }
      }
    });

    let totalLaborCost = 0;
    let totalMinutes = 0;
    let directMinutes = 0;
    let careMinutes = 0;
    let prepMinutes = 0;

    workLogs.forEach((log: any) => {
      const cName = log.crops?.name || '共通・未指定';
      const wName = log.workers?.name || '不明';
      const fName = log.fields?.name || '共通・未指定';
      const dur = Number(log.duration_minutes) || 0;
      const wage = Number(log.workers?.hourly_wage) || 1000;
      const dateStr = log.work_date;

      const laborCost = (dur / 60) * wage;
      totalLaborCost += laborCost;
      totalMinutes += dur;

      const cat = classifyWorkProcess(log.work_type || log.task_title || '');
      if (cat === 'direct') directMinutes += dur;
      else if (cat === 'prep_cleanup') prepMinutes += dur;
      else careMinutes += dur;

      cropHours[cName] = (cropHours[cName] || 0) + dur;
      cropWageMap[cName] = (cropWageMap[cName] || 0) + laborCost;

      fieldHours[fName] = (fieldHours[fName] || 0) + dur;
      fieldWageMap[fName] = (fieldWageMap[fName] || 0) + laborCost;

      if (!cropToFieldHours[cName]) cropToFieldHours[cName] = {};
      cropToFieldHours[cName][fName] = (cropToFieldHours[cName][fName] || 0) + dur;

      workerHours[wName] = (workerHours[wName] || 0) + dur;
      if (!workerCropHours[wName]) workerCropHours[wName] = {};
      workerCropHours[wName][cName] = (workerCropHours[wName][cName] || 0) + dur;
      workerWages[wName] = wage;
      workerTotalCost[wName] = (workerTotalCost[wName] || 0) + laborCost;

      if (dateStr) {
        const monthStr = dateStr.substring(0, 7);
        if (!monthlyMap[monthStr]) monthlyMap[monthStr] = { 売上: 0, 人件費: 0 };
        monthlyMap[monthStr].人件費 += laborCost;
      }
    });

    const fieldSalesMap: Record<string, number> = {};
    Object.keys(cropSalesMap).forEach(cName => {
      const cSales = cropSalesMap[cName];
      const fHours = cropToFieldHours[cName];
      if (fHours) {
        const totalHrs = Object.values(fHours).reduce((sum, h) => sum + h, 0);
        Object.keys(fHours).forEach(fName => {
          const ratio = totalHrs > 0 ? fHours[fName] / totalHrs : 0;
          fieldSalesMap[fName] = (fieldSalesMap[fName] || 0) + cSales * ratio;
        });
      }
    });

    const roundedSales = Math.round(totalSales);
    const roundedLabor = Math.round(totalLaborCost);
    const totalProfit = roundedSales - roundedLabor;
    const profitMargin = roundedSales > 0 ? (totalProfit / roundedSales) * 100 : 0;
    const totalHours = totalMinutes / 60;
    const hourlyProfit = totalHours > 0 ? Math.round(totalProfit / totalHours) : 0;

    setSummary({
      sales: roundedSales,
      laborCost: roundedLabor,
      profit: totalProfit,
      margin: profitMargin,
      totalMinutes,
      directMinutes,
      careMinutes,
      prepMinutes,
      hourlyProfit
    });

    const cropNetProfits: Record<string, number> = {};
    const allCropsSet = new Set([...Object.keys(cropHours), ...Object.keys(cropSalesMap)]);
    const pData = Array.from(allCropsSet)
      .filter(k => k !== '共通・未指定' || (cropSalesMap[k] || 0) > 0)
      .map(k => {
        const hours = (cropHours[k] || 0) / 60;
        const sales = cropSalesMap[k] || 0;
        const laborCost = cropWageMap[k] || 0;
        const netProfit = sales - laborCost;
        cropNetProfits[k] = netProfit;
        return {
          name: k,
          時給換算: hours > 0 ? Math.round(netProfit / hours) : 0,
          売上: sales,
          コスト: Math.round(laborCost),
          利益: Math.round(netProfit),
          利益率: sales > 0 ? Math.round((netProfit / sales) * 100) : 0
        };
      })
      .sort((a, b) => b.利益 - a.利益);

    const fData = Object.keys(fieldHours)
      .map(k => {
        const sales = fieldSalesMap[k] || 0;
        const laborCost = fieldWageMap[k] || 0;
        const netProfit = sales - laborCost;
        return {
          name: k,
          売上: Math.round(sales),
          コスト: Math.round(laborCost),
          利益: Math.round(netProfit),
          利益率: sales > 0 ? Math.round((netProfit / sales) * 100) : 0
        };
      })
      .sort((a, b) => b.利益 - a.利益);

    const wpData = Object.keys(workerHours)
      .map(wName => {
        let createdValue = 0;
        const wCrops = workerCropHours[wName];
        Object.keys(wCrops).forEach(cName => {
          const myHours = wCrops[cName];
          const totalCropHrs = cropHours[cName];
          if (totalCropHrs > 0) {
            const myContributionRatio = myHours / totalCropHrs;
            createdValue += (cropNetProfits[cName] || 0) * myContributionRatio;
          }
        });
        const totalMyHours = workerHours[wName] / 60;
        const productivity = totalMyHours > 0 ? Math.round((createdValue - workerTotalCost[wName]) / totalMyHours) : 0;
        return {
          name: wName,
          生産性: productivity,
          時給: workerWages[wName] || 1000,
          貢献利益: Math.round(createdValue)
        };
      })
      .sort((a, b) => b.生産性 - a.生産性);

    let cumulativeProfit = 0;
    const mTrendData = Object.keys(monthlyMap)
      .sort()
      .map(monthStr => {
        const sales = monthlyMap[monthStr].売上;
        const labor = monthlyMap[monthStr].人件費;
        const profit = sales - labor;
        cumulativeProfit += profit;
        return {
          month: monthStr,
          売上: sales,
          コスト: Math.round(labor),
          単月利益: Math.round(profit),
          累計利益: Math.round(cumulativeProfit)
        };
      });

    setProfitabilityData(pData);
    setFieldData(fData);
    setWorkerProductivityData(wpData);
    setMonthlyTrendData(mTrendData);

    // =========================================================================
    // 🚦 作付け・品目ごとの「6大工程・信号機レーン」集計
    // =========================================================================
    const unitMap = new Map<string, {
      unitKey: string;
      fieldId: string;
      fieldName: string;
      cropId: string;
      cropName: string;
      areaAre: number;
      logs: any[];
    }>();

    // 1. 作付け計画（cultivation_plans_v2）から基本ユニットを作成
    plansState.forEach((p: any) => {
      if (!p.crop_id && !p.crops?.name) return;
      const fId = String(p.field_id || 'all');
      const cId = String(p.crop_id || 'all');
      const fName = p.fields?.name || fieldsState.find(f => String(f.id) === fId)?.name || '圃場未指定';
      const cName = p.crops?.name || cropsState.find(c => String(c.id) === cId)?.name || '作目未設定';
      const key = `${fId}__${cId}`;
      const areaAre = Number(p.fields?.area_size) || Number(p.calculated_area) || 10;
      if (!unitMap.has(key)) {
        unitMap.set(key, {
          unitKey: key,
          fieldId: fId,
          fieldName: fName,
          cropId: cId,
          cropName: cName,
          areaAre: areaAre > 0 ? areaAre : 10,
          logs: []
        });
      }
    });

    // 2. 作業ログ（work_logs）を各ユニットへ紐づけ（計画がない組み合わせも自動生成）
    workLogs.forEach((log: any) => {
      const fId = String(log.field_id || log.fields?.id || 'all');
      const cId = String(log.crop_id || log.crops?.id || 'all');
      const fName = log.fields?.name || fieldsState.find(f => String(f.id) === fId)?.name || '農園共通・未指定';
      const cName = log.crops?.name || cropsState.find(c => String(c.id) === cId)?.name || '共通作業';
      const key = `${fId}__${cId}`;

      if (!unitMap.has(key)) {
        const areaAre = Number(log.fields?.area_size) || 10;
        unitMap.set(key, {
          unitKey: key,
          fieldId: fId,
          fieldName: fName,
          cropId: cId,
          cropName: cName,
          areaAre: areaAre > 0 ? areaAre : 10,
          logs: []
        });
      }
      unitMap.get(key)!.logs.push(log);
    });

    // 3. 保存済みレシピしかないユニットも表示対象に含める
    processRecipes.forEach(rcp => {
      const key = `${rcp.fieldId || 'all'}__${rcp.cropId || 'all'}`;
      if (!unitMap.has(key)) {
        unitMap.set(key, {
          unitKey: key,
          fieldId: rcp.fieldId || 'all',
          fieldName: rcp.fieldName || '対象圃場',
          cropId: rcp.cropId || 'all',
          cropName: rcp.cropName || '対象品目',
          areaAre: 10,
          logs: []
        });
      }
    });

    let totalBottlenecks = 0;

    const rows: UnitSignalRow[] = Array.from(unitMap.values()).map(u => {
      const area10a = Math.max(0.5, u.areaAre / 10);
      const stages = {} as Record<SixStageKey, StageCellAnalysis>;

      let totalMins = 0;
      let directMins = 0;
      let prepCleanupMins = 0;
      let unitLaborCost = 0;
      let redCount = 0;
      let yellowCount = 0;

      SIX_STAGES_ORDER.forEach(stKey => {
        const meta = SIX_STAGE_META[stKey];
        const benchmarkHours = Math.round(meta.defaultBenchmarkHoursPer10a * area10a * 10) / 10;

        stages[stKey] = {
          stageKey: stKey,
          actualMinutes: 0,
          actualHours: 0,
          benchmarkHours,
          gapHours: 0,
          laborCost: 0,
          distinctDays: 0,
          logCount: 0,
          signal: 'green',
          signalReason: '順調',
          bottleneckLogs: [],
          recipes: processRecipes.filter(
            r =>
              r.stageKey === stKey &&
              ((r.fieldId === u.fieldId && r.cropId === u.cropId) ||
                (r.cropId === u.cropId && (r.fieldId === 'all' || u.fieldId === 'all')) ||
                (r.cropName === u.cropName && r.fieldName === u.fieldName))
          )
        };
      });

      const stageDatesMap: Record<SixStageKey, Set<string>> = {
        prep: new Set(),
        soil: new Set(),
        planting: new Set(),
        care: new Set(),
        harvest: new Set(),
        cleanup: new Set()
      };

      u.logs.forEach((log: any) => {
        const dur = Number(log.duration_minutes) || 0;
        const wage = Number(log.workers?.hourly_wage) || 1000;
        const cost = (dur / 60) * wage;
        const stKey = classifySixStage(log.work_type || log.task_title || '');
        const parsed = parseWorkMemoBottleneck(log.memo);

        totalMins += dur;
        unitLaborCost += cost;
        if (stKey === 'planting' || stKey === 'harvest') directMins += dur;
        else if (stKey === 'prep' || stKey === 'soil' || stKey === 'cleanup') prepCleanupMins += dur;

        const cell = stages[stKey];
        cell.actualMinutes += dur + (parsed.extraMinutes || 0);
        cell.laborCost += cost;
        cell.logCount += 1;
        if (log.work_date) stageDatesMap[stKey].add(log.work_date);

        if (parsed.hasBottleneck) {
          totalBottlenecks++;
          cell.bottleneckLogs.push({
            id: log.id || `${log.work_date}_${stKey}`,
            date: log.work_date || '',
            workerName: log.workers?.name || 'スタッフ',
            workType: log.work_type || log.task_title || metaLabel(stKey),
            durationMinutes: dur,
            causeTag: parsed.causeTag,
            extraMinutes: parsed.extraMinutes,
            cleanBody: parsed.cleanBody,
            nextActionIdea: parsed.nextActionIdea,
            driveUrl: parsed.driveUrl,
            photoUrl: log.photo_url || ''
          });
        }
      });

      SIX_STAGES_ORDER.forEach(stKey => {
        const cell = stages[stKey];
        cell.actualHours = Math.round((cell.actualMinutes / 60) * 10) / 10;
        cell.distinctDays = stageDatesMap[stKey].size;
        cell.gapHours = Math.round((cell.actualHours - cell.benchmarkHours) * 10) / 10;

        const hasStruggle = cell.bottleneckLogs.some(b => b.causeTag && !b.causeTag.includes('水田'));
        const hasCaution = cell.bottleneckLogs.length > 0;
        const isDraggedOutCleanupOrPrep =
          (stKey === 'cleanup' || stKey === 'prep') && (cell.distinctDays >= 3 || cell.actualHours >= 12);
        const isOverBenchmark =
          cell.actualHours > cell.benchmarkHours * 1.35 && cell.actualHours - cell.benchmarkHours >= 2;

        if (hasStruggle || isDraggedOutCleanupOrPrep || isOverBenchmark) {
          cell.signal = 'red';
          redCount++;
          if (hasStruggle) {
            cell.signalReason = cell.bottleneckLogs[0].causeTag || '現場から手こずり報告あり';
          } else if (isDraggedOutCleanupOrPrep) {
            cell.signalReason = `延べ${cell.distinctDays}日間（${cell.actualHours}h）拘束・短期圧縮対象`;
          } else {
            cell.signalReason = `目安+${cell.gapHours}h超過`;
          }
        } else if (hasCaution || (cell.actualHours > cell.benchmarkHours && cell.actualHours >= 2)) {
          cell.signal = 'yellow';
          yellowCount++;
          cell.signalReason = hasCaution ? '重要注意点・水平確認' : `目安+${cell.gapHours}h`;
        } else {
          cell.signal = 'green';
          cell.signalReason = '順調';
        }
      });

      const totalHrs = Math.round((totalMins / 60) * 10) / 10;
      const directHrs = Math.round((directMins / 60) * 10) / 10;
      const prepHrs = Math.round((prepCleanupMins / 60) * 10) / 10;
      const directRatio = totalMins > 0 ? Math.round((directMins / totalMins) * 100) : 0;
      const prepRatio = totalMins > 0 ? Math.round((prepCleanupMins / totalMins) * 100) : 0;

      // 品目の売上を作業時間比（または均等）で配分
      const cSalesTotal = cropSalesMap[u.cropName] || 0;
      const cTotalMins = cropHours[u.cropName] || 0;
      const unitSales = cTotalMins > 0 ? Math.round(cSalesTotal * (totalMins / cTotalMins)) : cSalesTotal;
      const unitProfit = Math.round(unitSales - unitLaborCost);
      const unitHourlyProfit = totalHrs > 0 ? Math.round(unitProfit / totalHrs) : 0;

      return {
        unitKey: u.unitKey,
        fieldId: u.fieldId,
        fieldName: u.fieldName,
        cropId: u.cropId,
        cropName: u.cropName,
        area10a,
        totalHours: totalHrs,
        directHours: directHrs,
        prepCleanupHours: prepHrs,
        directRatio,
        prepRatio,
        sales: unitSales,
        laborCost: Math.round(unitLaborCost),
        profit: unitProfit,
        hourlyProfit: unitHourlyProfit,
        redCount,
        yellowCount,
        stages
      };
    });

    // 赤信号が多い順 ➔ 作業時間が多い順でソート
    rows.sort((a, b) => {
      if (b.redCount !== a.redCount) return b.redCount - a.redCount;
      if (b.yellowCount !== a.yellowCount) return b.yellowCount - a.yellowCount;
      return b.totalHours - a.totalHours;
    });

    return { signalRows: rows, bottleneckCountTotal: totalBottlenecks };
  }, [rawWorkLogsState, rawSalesLogsState, rawB2bOrdersState, plansState, fieldsState, cropsState, processRecipes, dataViewMode]);

  function metaLabel(stKey: SixStageKey) {
    return SIX_STAGE_META[stKey]?.shortLabel || stKey;
  }

  // 初期選択：赤信号がある最初のユニット＆最初の赤信号ステージを自動選択
  useEffect(() => {
    if (!selectedUnitKey && signalRows.length > 0) {
      const firstRow = signalRows[0];
      setSelectedUnitKey(firstRow.unitKey);
      const redStage = SIX_STAGES_ORDER.find(k => firstRow.stages[k].signal === 'red');
      const yellowStage = SIX_STAGES_ORDER.find(k => firstRow.stages[k].signal === 'yellow');
      const targetSt = redStage || yellowStage || 'planting';
      handleSelectStageCell(firstRow, targetSt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signalRows.length]);

  const handleSelectStageCell = (row: UnitSignalRow, stKey: SixStageKey) => {
    setSelectedUnitKey(row.unitKey);
    setSelectedStageKey(stKey);
    const cell = row.stages[stKey];
    const firstLog = cell.bottleneckLogs[0];

    if (stKey === 'cleanup' || stKey === 'prep') {
      setRecipeActionType('temp_worker_compress');
      setRecipeTitle(
        firstLog?.nextActionIdea ||
          `【短期集中】${row.cropName}の${SIX_STAGE_META[stKey].shortLabel}を臨時雇用${recipeTempWorkers}名×${recipeTargetDays}日間で一気に完了させる`
      );
      setRecipeReason(
        firstLog?.cleanBody ||
          `${SIX_STAGE_META[stKey].shortLabel}に延べ${Math.max(1, cell.distinctDays)}日間（${cell.actualHours}h）拘束されているため、臨時雇用で圧縮し社員を直接利益作業へ回す`
      );
    } else if (stKey === 'soil' && (row.cropName.includes('水') || row.cropName.includes('米') || row.cropName.includes('稲') || firstLog?.causeTag.includes('水'))) {
      setRecipeActionType('lock_critical_step');
      setRecipeTitle(
        firstLog?.nextActionIdea || `【必須工程ロック】代かき前の水平均平調整（クレーター・水深ムラ防止）`
      );
      setRecipeReason(
        firstLog?.cleanBody || `土を平らに仕上げておかないとクレーターができて苗枯れ・収量ロスにつながるため`
      );
    } else {
      setRecipeActionType('add_pre_step');
      setRecipeTitle(
        firstLog?.nextActionIdea ||
          `【事前工程追加】${row.cropName}の定植前に「深耕・反転（硬い土の破砕）」を1工程挟む`
      );
      setRecipeReason(
        firstLog?.cleanBody ||
          `${SIX_STAGE_META[stKey].shortLabel}で土の硬い層により手こずり（実績${cell.actualHours}h / 目安${cell.benchmarkHours}h）が発生したため`
      );
    }
    setRecipeDriveUrl(firstLog?.driveUrl || farmDriveUrl || '');
  };

  const selectedRow = useMemo(
    () => signalRows.find(r => r.unitKey === selectedUnitKey) || null,
    [signalRows, selectedUnitKey]
  );

  const selectedCell = useMemo(
    () => (selectedRow ? selectedRow.stages[selectedStageKey] : null),
    [selectedRow, selectedStageKey]
  );

  // ワンクリック処方箋（次回レシピ＋予定タスク）保存ハンドラー
  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRow || !selectedCell || !tenantId) return;
    setIsSavingRecipe(true);
    try {
      const recipePayload: Partial<ProcessImprovementRecipe> = {
        fieldId: selectedRow.fieldId,
        fieldName: selectedRow.fieldName,
        cropId: selectedRow.cropId,
        cropName: selectedRow.cropName,
        stageKey: selectedStageKey,
        actionType: recipeActionType,
        title: recipeTitle.trim() || '工程改善アクション',
        reasonSummary: recipeReason.trim(),
        targetHours: Number(recipeTargetHours) || 4,
        tempWorkersCount: recipeActionType === 'temp_worker_compress' ? Number(recipeTempWorkers) || 5 : undefined,
        targetDays: recipeActionType === 'temp_worker_compress' ? Number(recipeTargetDays) || 2 : undefined,
        driveUrl: recipeDriveUrl.trim() || undefined
      };

      const plannedTaskPayload = alsoScheduleTask
        ? {
            workDate: scheduleTaskDate,
            workType:
              recipeActionType === 'add_pre_step'
                ? '耕起・深耕・土づくり'
                : recipeActionType === 'temp_worker_compress'
                ? '片付け・残渣撤去'
                : '畝立て・マルチ・水平調整',
            taskTitle: recipePayload.title!,
            cropId: selectedRow.cropId,
            fieldId: selectedRow.fieldId,
            durationMinutes: (Number(recipeTargetHours) || 4) * 60,
            memo: `【工程見直しPDCA処方箋】${recipePayload.title} / 理由:${recipePayload.reasonSummary}${recipePayload.driveUrl ? ` / 📁:${recipePayload.driveUrl}` : ''}`
          }
        : null;

      const res = await saveProcessImprovementRecipeAction(tenantId, recipePayload, plannedTaskPayload);
      if (res?.success) {
        setProcessRecipes(res.recipes || []);
        showToast(
          alsoScheduleTask
            ? `「${selectedRow.fieldName}・${selectedRow.cropName}」の次回レシピを保存し、${scheduleTaskDate}の作業予定に自動登録しました！`
            : `「${selectedRow.fieldName}・${selectedRow.cropName}」の次回改善レシピを保存しました！`
        );
        await fetchDashboardData();
      } else {
        alert(res?.error || '保存に失敗しました');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingRecipe(false);
    }
  };

  // MTGの3大現場事例（レタス深耕・モヤ片付け短期バイト化・水田クレーター防止水平出し）をワンクリックで実演投入するハンドラー
  const handleLoadMtgThreeExamples = async () => {
    if (!tenantId) return;
    setIsSavingRecipe(true);
    try {
      const f1 = fieldsState[0] || { id: 'all', name: '第1圃場' };
      const f2 = fieldsState[1] || fieldsState[0] || { id: 'all', name: '第2圃場' };
      const c1 = cropsState[0] || { id: 'all', name: 'レタス' };
      const c2 = cropsState[1] || cropsState[0] || { id: 'all', name: 'モヤ' };

      const sampleRecipes: Array<Partial<ProcessImprovementRecipe>> = [
        {
          id: 'mtg_example_lettuce_soil',
          fieldId: String(f1.id),
          fieldName: f1.name || 'レタス圃場',
          cropId: String(c1.id),
          cropName: c1.name || 'レタス',
          stageKey: 'planting',
          actionType: 'add_pre_step',
          title: '【事前工程追加】定植前の空き時期に「深耕・反転（硬盤破砕）」を1工程挟む',
          reasonSummary: 'レタス植え付け時、土の硬い層を崩すのに想定以上の時間（+15h超過）がかかったため',
          targetHours: 4,
          driveUrl: farmDriveUrl || undefined
        },
        {
          id: 'mtg_example_moya_cleanup',
          fieldId: String(f2.id),
          fieldName: f2.name || 'モヤ圃場',
          cropId: String(c2.id),
          cropName: c2.name || 'モヤ',
          stageKey: 'cleanup',
          actionType: 'temp_worker_compress',
          title: '【短期圧縮】片付け工程に臨時雇用5名を投入して2日間で一気に終わらせ、社員を3日目から次作へ回す',
          reasonSummary: '半年育てたモヤの最後の片付けで社員2人が10日間手こずり、利益と次作の種まき機会を圧迫したため',
          targetHours: 16,
          tempWorkersCount: 5,
          targetDays: 2,
          driveUrl: farmDriveUrl || undefined
        },
        {
          id: 'mtg_example_paddy_level',
          fieldId: String(f1.id),
          fieldName: f1.name || '水田圃場',
          cropId: String(c1.id),
          cropName: '水田・水稲',
          stageKey: 'soil',
          actionType: 'lock_critical_step',
          title: '【必須工程ロック】代かき前の「水平調整（クレーター・水深ムラ防止）」を事前スケジュール固定',
          reasonSummary: '平らな土を仕上げておかないと水が均一に行き渡らず、クレーターができて広大な面積の米をロスするため',
          targetHours: 6,
          driveUrl: farmDriveUrl || undefined
        }
      ];

      for (const rcp of sampleRecipes) {
        await saveProcessImprovementRecipeAction(tenantId, rcp, null);
      }
      showToast('MTGの3大見直し事例（レタス深耕・モヤ片付け2日圧縮・水田水平調整ロック）をボードに反映しました！');
      await fetchDashboardData();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingRecipe(false);
    }
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    if (!tenantId) return;
    const res = await deleteProcessImprovementRecipeAction(tenantId, recipeId);
    if (res?.success) {
      setProcessRecipes(res.recipes || []);
      showToast('工程見直しレシピを解除しました');
    }
  };

  const handleSaveDriveUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    setIsSavingDrive(true);
    try {
      const res = await saveFarmDriveUrlAction(tenantId, driveUrlInput);
      if (res?.success) {
        setFarmDriveUrl(driveUrlInput.trim());
        setShowDriveModal(false);
        showToast('農園のGoogleドライブ共有フォルダURLを保存しました！');
      }
    } finally {
      setIsSavingDrive(false);
    }
  };

  const directRate = summary.totalMinutes > 0 ? Math.round((summary.directMinutes / summary.totalMinutes) * 100) : 0;
  const careRate = summary.totalMinutes > 0 ? Math.round((summary.careMinutes / summary.totalMinutes) * 100) : 0;
  const prepRate = summary.totalMinutes > 0 ? Math.max(0, 100 - directRate - careRate) : 0;

  // 臨時雇用圧縮シミュレーターの計算（選択中ステージまたは全体の間接作業に対して）
  const compressionSim = useMemo(() => {
    const currentHours = selectedCell && selectedCell.actualHours > 0 ? selectedCell.actualHours : 80; // 例: 80時間(社員2人×5〜10日)
    const currentDays = selectedCell && selectedCell.distinctDays > 0 ? selectedCell.distinctDays : 10;
    const targetDays = Math.max(1, recipeTargetDays || 2);
    const savedDays = Math.max(0, currentDays - targetDays);
    const freedEmployeeHours = Math.max(8, Math.round(currentHours * 0.8));
    // 社員が🟢直益作業（収穫・播種）に回った場合の1時間あたり創出粗利（最低¥2,500/hまたは農園実績）
    const directValuePerHour = Math.max(2500, summary.hourlyProfit > 0 ? summary.hourlyProfit : 2800);
    const extraDirectProfit = Math.round(freedEmployeeHours * directValuePerHour);
    return {
      currentHours,
      currentDays,
      targetDays,
      savedDays,
      freedEmployeeHours,
      directValuePerHour,
      extraDirectProfit
    };
  }, [selectedCell, recipeTargetDays, summary.hourlyProfit]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6 pb-16 pt-3 sm:pt-6">
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl text-xs sm:text-sm font-black border-2 border-emerald-400 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ページヘッダー＆クイックコントロール */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">
                TOP専用・作業工程見直し司令塔
              </span>
              <span className="text-xs text-slate-500 font-bold">
                6大工程の信号機分析 ＆ 臨時雇用圧縮・次回レシピ自動反映ボード
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              業務工程PDCA・直接利益最大化ダッシュボード
            </h1>
          </div>

          {/* 右上アクションエリア：Googleドライブ連携 ＆ 現場URL配布 ＆ 詳細ボード導線 */}
          <div className="flex flex-wrap items-center gap-2">
            {farmDriveUrl ? (
              <div className="flex items-center gap-1">
                <a
                  href={farmDriveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 rounded-xl text-xs font-black transition-all shadow-2xs"
                >
                  <FolderOpen className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>📁 Googleドライブ（写真・手順書）を開く</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  type="button"
                  onClick={() => setShowDriveModal(true)}
                  className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
                  title="GoogleドライブURLを変更"
                >
                  変更
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowDriveModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 rounded-xl text-xs font-black transition-all cursor-pointer"
              >
                <FolderOpen className="w-4 h-4 text-blue-600 shrink-0" />
                <span>📁 Googleドライブ共有フォルダを連携</span>
              </button>
            )}

            {tenantId && (
              <button
                onClick={async () => {
                  const farmUrl = `${window.location.origin}/portal/${tenantId}`;
                  try {
                    await navigator.clipboard.writeText(farmUrl);
                    setCopiedUrl(true);
                    setTimeout(() => setCopiedUrl(false), 2500);
                  } catch (e) {
                    console.error(e);
                  }
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-emerald-700 font-black">現場URLをコピーしました！</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>📱 現場ポータルURL</span>
                  </>
                )}
              </button>
            )}

            <Link
              href={tenantId ? `/admin/cultivation-schedule?farm=${tenantId}` : '/admin/cultivation-schedule'}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black shadow-2xs transition-all"
            >
              <Calculator className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>面積比⇔時間比の按分比較へ</span>
            </Link>
          </div>
        </div>

        {/* 朝イチ現場アラートバー ＆ 予実切り替えタブ */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80">
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {pendingApprovalsCount > 0 ? (
              <Link
                href={tenantId ? `/admin/approvals?farm=${tenantId}` : '/admin/approvals'}
                className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl text-xs font-black text-amber-900 transition-colors shadow-2xs group"
              >
                <AlertCircle className="w-4 h-4 text-amber-600 animate-pulse shrink-0" />
                <span>未承認の日報が <strong className="text-sm text-amber-950 underline">{pendingApprovalsCount}件</strong> あります（承認・手こずり補足の確認へ）</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </Link>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>未承認の日報はありません（承認完了済）</span>
              </div>
            )}

            <div className="hidden lg:flex items-center gap-3 text-xs text-slate-600 font-bold border-l border-slate-200 pl-3">
              <span>本日の作業記録: <strong className="text-slate-900 font-black">{todayWorkCount}件</strong></span>
              <span>|</span>
              <span>現場の手こずり・注意点報告: <strong className="text-rose-600 font-black">{bottleneckCountTotal}件</strong></span>
              <span>|</span>
              <span>次回適用レシピ: <strong className="text-emerald-700 font-black">{processRecipes.length}件</strong></span>
            </div>
          </div>

          <div className="bg-slate-200/70 p-1 rounded-xl flex items-center shadow-inner w-full sm:w-auto">
            <button
              onClick={() => setDataViewMode('actualOnly')}
              className={`py-1.5 px-3.5 rounded-lg font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                dataViewMode === 'actualOnly'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${dataViewMode === 'actualOnly' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              確定実績のみ
            </button>
            <button
              onClick={() => setDataViewMode('includePlanned')}
              className={`py-1.5 px-3.5 rounded-lg font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                dataViewMode === 'includePlanned'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${dataViewMode === 'includePlanned' ? 'bg-amber-500' : 'bg-slate-400'}`} />
              予定＋実績
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-slate-500 font-bold tracking-widest text-sm">6大工程と手こずり補足を分析中...</p>
          </div>
        </div>
      ) : (
        <>
          {/* --- 1. 全作業時間の3分類バランス ＆ 経営KPIサマリー --- */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* 左7列: 直接利益を生む作業の割合バー */}
            <div className="lg:col-span-7 bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <span>⏱️ 直接利益を生む作業の比率（総労働: {(summary.totalMinutes / 60).toFixed(1)}時間）</span>
                  </h2>
                  <p className="text-xs text-slate-500 font-bold mt-0.5">
                    🔴 準備・片付け等の間接作業を臨時雇用や事前深耕で圧縮し、🟢 種まき・定植・収穫の割合を最大化します
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-3 py-1 rounded-xl bg-emerald-100 text-emerald-900 font-black text-xs border border-emerald-300">
                    🟢 直益作業 {directRate}%
                  </span>
                  <span className="px-3 py-1 rounded-xl bg-rose-100 text-rose-900 font-black text-xs border border-rose-300">
                    🔴 準備・片付 {prepRate}%
                  </span>
                </div>
              </div>

              <div className="w-full h-5 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200 my-2">
                <div style={{ width: `${directRate}%` }} className="bg-emerald-500 h-full transition-all" />
                <div style={{ width: `${careRate}%` }} className="bg-amber-400 h-full transition-all" />
                <div style={{ width: `${prepRate}%` }} className="bg-rose-500 h-full transition-all" />
              </div>

              <div className="grid grid-cols-3 gap-2 mt-2 text-xs font-bold">
                <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-2.5 text-emerald-950">
                  <div className="text-[11px] text-emerald-700">🟢 ③定植・播種 ／ ⑤収穫</div>
                  <div className="text-sm font-black mt-0.5">{(summary.directMinutes / 60).toFixed(1)}h ({directRate}%)</div>
                </div>
                <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-2.5 text-amber-950">
                  <div className="text-[11px] text-amber-700">🟡 ④育成・維持管理</div>
                  <div className="text-sm font-black mt-0.5">{(summary.careMinutes / 60).toFixed(1)}h ({careRate}%)</div>
                </div>
                <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-2.5 text-rose-950">
                  <div className="text-[11px] text-rose-700">🔴 ①準備・②土・⑥片付け</div>
                  <div className="text-sm font-black mt-0.5">{(summary.prepMinutes / 60).toFixed(1)}h ({prepRate}%)</div>
                </div>
              </div>
            </div>

            {/* 右5列: 出荷売上・投入人件費・現場労働粗利 */}
            <div className="lg:col-span-5 grid grid-cols-2 gap-3">
              <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-between">
                <span className="text-xs font-black text-slate-500 flex items-center gap-1">
                  <Banknote className="w-4 h-4 text-blue-600" /> 出荷・販売売上
                </span>
                <div className="text-xl sm:text-2xl font-black text-slate-900 my-1">
                  ¥{summary.sales.toLocaleString()}
                </div>
                <span className="text-[11px] text-slate-400 font-bold">
                  投入人件費: <strong className="text-rose-600">¥{summary.laborCost.toLocaleString()}</strong>
                </span>
              </div>

              <div className={`rounded-3xl p-4 border shadow-2xs flex flex-col justify-between ${
                summary.profit >= 0 ? 'bg-emerald-50/70 border-emerald-300' : 'bg-rose-50/70 border-rose-300'
              }`}>
                <span className="text-xs font-black text-slate-700 flex items-center justify-between">
                  <span>現場労働粗利</span>
                  <span className="px-2 py-0.5 rounded-full bg-white text-[10px] font-black border border-slate-200">
                    {formatCurrency(summary.hourlyProfit)}/h
                  </span>
                </span>
                <div className={`text-xl sm:text-2xl font-black my-1 ${summary.profit >= 0 ? 'text-emerald-800' : 'text-rose-700'}`}>
                  {formatCurrency(summary.profit)}
                </div>
                <span className="text-[11px] text-slate-600 font-bold">
                  粗利率 {summary.margin.toFixed(1)}%（資材・経理除外）
                </span>
              </div>
            </div>
          </div>

          {/* ========================================================================
              🚦 2. 【TOP画面の核心】6大工程・信号機レーン ＆ ワンクリック次回レシピ化ボード
             ======================================================================== */}
          <section className="bg-white rounded-3xl border-2 border-slate-900 shadow-md overflow-hidden">
            {/* セクションヘッダー */}
            <div className="bg-slate-900 text-white p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-400 text-slate-950 text-xs font-black">
                    1画面完結PDCA
                  </span>
                  <span className="text-xs text-emerald-300 font-bold">
                    ①見る（赤信号の工程を特定） ➔ ②原因・補足を確認 ➔ ③ボタン1つで次回の計画レシピ＆作業予定へ自動反映！
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
                  <span>🚦 作付け・品目別「6大工程・信号機レーン」見直しボード</span>
                </h2>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleLoadMtgThreeExamples}
                  disabled={isSavingRecipe}
                  className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>📖 MTGの3大見直し事例（レタス・モヤ・水田）を反映して試す</span>
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-6">
              {/* 凡例 */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="font-black text-slate-900">工程マスの見方（クリックで下に原因と改善ボタンが開きます）：</span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
                    <strong className="text-rose-700">🔴 要見直し</strong>（手こずり報告・時間超過・長期間ダラダラ拘束）
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
                    <strong className="text-amber-700">🟡 注意・重要確認</strong>（水田の水平調整等）
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                    <strong className="text-emerald-700">🟢 順調</strong>
                  </span>
                </div>
                <span className="text-[11px] text-slate-500">
                  ※ ✅マークは「次回改善レシピ（事前深耕・臨時バイト圧縮・必須ロック）」が設定済みの工程です
                </span>
              </div>

              {/* 6大工程・信号機レーン一覧 */}
              {signalRows.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-3">
                  <Sprout className="w-10 h-10 text-emerald-500 mx-auto" />
                  <p className="text-base font-black text-slate-800">まだ作業記録や作付けデータがありません</p>
                  <p className="text-xs font-bold text-slate-500">
                    右上の「📖 MTGの3大見直し事例（レタス・モヤ・水田）を反映して試す」ボタンを押すと、信号機PDCAの動きをすぐにご確認いただけます。
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {signalRows.map(row => {
                    const isRowSelected = row.unitKey === selectedUnitKey;
                    return (
                      <div
                        key={row.unitKey}
                        className={`rounded-2xl border-2 transition-all p-4 ${
                          isRowSelected
                            ? 'border-slate-900 bg-slate-50/70 shadow-md'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        {/* 作付け・品目ヘッダー */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-1 rounded-xl bg-slate-900 text-white text-xs font-black">
                              {row.fieldName}
                            </span>
                            <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-1.5">
                              <span>🌱 {row.cropName}</span>
                            </h3>
                            <span className="text-xs font-bold text-slate-500">
                              （目安面積 {(row.area10a * 10).toFixed(0)}a / 総作業 {row.totalHours}h）
                            </span>
                            {row.redCount > 0 && (
                              <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 text-xs font-black animate-pulse">
                                🔥 要見直し工程 {row.redCount}箇所
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs font-bold">
                            <span className="text-emerald-700 font-black">
                              🟢直益率 {row.directRatio}%
                            </span>
                            <span className="text-rose-700 font-black">
                              🔴間接率 {row.prepRatio}%
                            </span>
                            <span className="text-slate-400">|</span>
                            <span className="text-slate-800 font-black">
                              労働粗利: {formatCurrency(row.profit)} ({formatCurrency(row.hourlyProfit)}/h)
                            </span>
                          </div>
                        </div>

                        {/* 6大工程の横並び信号機レーン */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                          {SIX_STAGES_ORDER.map(stKey => {
                            const meta = SIX_STAGE_META[stKey];
                            const cell = row.stages[stKey];
                            const isSelected = isRowSelected && selectedStageKey === stKey;

                            const signalStyle =
                              cell.signal === 'red'
                                ? 'bg-rose-50 border-rose-400 text-rose-950 hover:bg-rose-100'
                                : cell.signal === 'yellow'
                                ? 'bg-amber-50 border-amber-400 text-amber-950 hover:bg-amber-100'
                                : 'bg-emerald-50/60 border-emerald-200 text-slate-800 hover:bg-emerald-50';

                            return (
                              <button
                                key={stKey}
                                type="button"
                                onClick={() => handleSelectStageCell(row, stKey)}
                                className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer relative flex flex-col justify-between min-h-[104px] ${signalStyle} ${
                                  isSelected ? 'ring-4 ring-slate-900/20 border-slate-900 scale-[1.02] shadow-md' : ''
                                }`}
                              >
                                <div>
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-xs font-black flex items-center gap-1">
                                      <span>{meta.icon}</span>
                                      <span>{meta.shortLabel}</span>
                                    </span>
                                    <span className="text-xs">
                                      {cell.signal === 'red' ? '🔴' : cell.signal === 'yellow' ? '🟡' : '🟢'}
                                    </span>
                                  </div>

                                  <div className="mt-1.5 flex items-baseline justify-between">
                                    <span className="text-lg font-black">
                                      {cell.actualHours}h
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-500">
                                      目安{cell.benchmarkHours}h
                                    </span>
                                  </div>

                                  {cell.distinctDays > 0 && (
                                    <div className="text-[10px] font-bold text-slate-600">
                                      延べ{cell.distinctDays}日間 / ¥{Math.round(cell.laborCost).toLocaleString()}
                                    </div>
                                  )}
                                </div>

                                <div className="mt-2 pt-1.5 border-t border-black/10 space-y-1">
                                  {cell.signal !== 'green' && (
                                    <div className={`text-[10px] font-black leading-tight truncate ${
                                      cell.signal === 'red' ? 'text-rose-700' : 'text-amber-800'
                                    }`}>
                                      ⚡ {cell.signalReason}
                                    </div>
                                  )}
                                  {cell.recipes.length > 0 ? (
                                    <div className="px-1.5 py-0.5 rounded bg-slate-900 text-emerald-300 text-[10px] font-black truncate">
                                      ✅ 改善レシピ済 ({cell.recipes.length})
                                    </div>
                                  ) : (
                                    <div className="text-[10px] font-bold text-slate-500">
                                      タップで詳細・見直し ▼
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ====================================================================
                  🔍 選択した工程マスの「原因・補足深掘り（Check） ＆ ワンクリック処方箋（Act）」パネル
                 ==================================================================== */}
              {selectedRow && selectedCell && (
                <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 border-2 border-emerald-400 shadow-xl space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-700 pb-4">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-black text-emerald-400 mb-1">
                        <span>🔍 選択中の工程分析 ＆ 次回への処方箋（ワンクリックPDCA）</span>
                      </div>
                      <h3 className="text-lg sm:text-xl font-black flex items-center gap-2 flex-wrap">
                        <span>{selectedRow.fieldName} × 🌱{selectedRow.cropName}</span>
                        <span className="text-emerald-400">➔</span>
                        <span className="px-3 py-1 rounded-xl bg-white text-slate-900 text-base">
                          {SIX_STAGE_META[selectedStageKey].icon} {SIX_STAGE_META[selectedStageKey].label}
                        </span>
                        <span className="text-sm font-bold text-slate-300">
                          （実績 {selectedCell.actualHours}h / 目安 {selectedCell.benchmarkHours}h / 延べ {selectedCell.distinctDays}日間）
                        </span>
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* 左6列：【Check】現場の「手こずり補足・写真」＆「臨時雇用2日圧縮シミュレーター」 */}
                    <div className="lg:col-span-6 space-y-4">
                      <div className="bg-slate-950/90 rounded-2xl p-4 border border-slate-800 space-y-3">
                        <h4 className="text-sm font-black text-rose-300 flex items-center justify-between">
                          <span>📌 1. 現場から上がった「手こずり・注意点補足」（なぜ時間がかかったか？）</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300">
                            {selectedCell.bottleneckLogs.length}件
                          </span>
                        </h4>

                        {selectedCell.bottleneckLogs.length === 0 ? (
                          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-1.5">
                            <p className="font-bold text-white">
                              この工程にはまだ現場からの手こずり補足メモはありません。
                            </p>
                            <p className="text-slate-400">
                              ※右側のフォームから、TOP・管理者として直接「事前の深耕追加」「片付けの臨時バイト短期集中」「水田の水平調整ロック」などの次期レシピを登録できます。
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                            {selectedCell.bottleneckLogs.map(b => (
                              <div key={b.id} className="p-3.5 rounded-2xl bg-slate-900 border border-rose-500/40 space-y-2">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <span className="px-2.5 py-0.5 rounded-lg bg-rose-500 text-white text-xs font-black">
                                    {b.causeTag}
                                  </span>
                                  <span className="text-[11px] font-bold text-slate-400">
                                    {b.date} / 担当: {b.workerName} / 作業: {b.durationMinutes}分
                                    {b.extraMinutes > 0 && <strong className="text-amber-300 ml-1">（ロス+{b.extraMinutes}分）</strong>}
                                  </span>
                                </div>
                                {b.cleanBody && (
                                  <p className="text-xs sm:text-sm font-bold text-white bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                                    💬 「{b.cleanBody}」
                                  </p>
                                )}
                                {b.nextActionIdea && (
                                  <div className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                                    <span>💡 現場からの改善案:</span>
                                    <span>{b.nextActionIdea}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-3 pt-1">
                                  {b.photoUrl && (
                                    <a
                                      href={b.photoUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs font-black text-amber-300 underline flex items-center gap-1"
                                    >
                                      📷 現場写真を見る <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                  {b.driveUrl && (
                                    <a
                                      href={b.driveUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs font-black text-blue-300 underline flex items-center gap-1"
                                    >
                                      📁 Googleドライブ資料を開く <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 🔥 非生産作業（片付け・準備等）の「社員ダラダラ vs 臨時雇用2日集中」圧縮シミュレーター */}
                      <div className="bg-gradient-to-br from-amber-950/80 to-slate-950 rounded-2xl p-4 border border-amber-500/40 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs sm:text-sm font-black text-amber-300 flex items-center gap-1.5">
                            <Users className="w-4 h-4" />
                            <span>🔥 社員ダラダラ日数 vs 臨時雇用（日雇い）短期圧縮シミュレーター</span>
                          </h4>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-400 text-slate-950">
                            直益シフト試算
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 font-bold leading-relaxed">
                          もし <strong className="text-white">{compressionSim.currentDays}日間（計{compressionSim.currentHours}h）</strong> かかる作業を、社員だけでダラダラ行う代わりに
                          <strong className="text-amber-300"> 臨時雇用（バイト）{recipeTempWorkers}名を入れて「{compressionSim.targetDays}日間」で一気に終わらせた場合</strong>：
                        </p>
                        <div className="grid grid-cols-2 gap-2.5 pt-1">
                          <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-700">
                            <span className="text-[10px] text-slate-400 font-bold block">社員が早く解放される日数</span>
                            <span className="text-lg font-black text-emerald-400">
                              ＋{compressionSim.savedDays}日間 短縮！
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              （社員の拘束を約{compressionSim.freedEmployeeHours}時間解放）
                            </span>
                          </div>
                          <div className="bg-slate-900/90 p-3 rounded-xl border border-emerald-500/40">
                            <span className="text-[10px] text-slate-400 font-bold block">浮いた社員を🟢収穫・種まきへ回した増益効果</span>
                            <span className="text-lg font-black text-amber-300">
                              ＋¥{compressionSim.extraDirectProfit.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              （直益時給生産性 ¥{compressionSim.directValuePerHour.toLocaleString()}/h 換算）
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 右6列：【Act ➔ Plan】ワンクリックで次回の作付けレシピ＆作業予定に組み込むフォーム */}
                    <form onSubmit={handleSaveRecipe} className="lg:col-span-6 bg-slate-950/90 rounded-2xl p-4 sm:p-5 border border-emerald-500/50 space-y-4">
                      <h4 className="text-sm font-black text-emerald-300 flex items-center gap-2">
                        <span>⚡ 2. 次回（来年・次作）への改善処方箋をワンクリック登録</span>
                      </h4>

                      {/* 処方箋タイプ3択 */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setRecipeActionType('add_pre_step');
                            setRecipeTitle(`【事前工程追加】${selectedRow.cropName}の前に「深耕・反転（土づくり）」を1工程挟む`);
                          }}
                          className={`p-2.5 rounded-xl border text-left text-xs font-black cursor-pointer transition-all ${
                            recipeActionType === 'add_pre_step'
                              ? 'bg-emerald-500 text-slate-950 border-white shadow-md'
                              : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                          }`}
                        >
                          <div>🚜 ① 事前工程を追加</div>
                          <div className="text-[10px] opacity-80 font-bold mt-0.5">例：レタス前の深耕・反転</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setRecipeActionType('temp_worker_compress');
                            setRecipeTitle(`【短期圧縮】${selectedRow.cropName}の片付けに臨時バイト${recipeTempWorkers}名を投入し${recipeTargetDays}日で完了させる`);
                          }}
                          className={`p-2.5 rounded-xl border text-left text-xs font-black cursor-pointer transition-all ${
                            recipeActionType === 'temp_worker_compress'
                              ? 'bg-amber-400 text-slate-950 border-white shadow-md'
                              : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                          }`}
                        >
                          <div>👥 ② 臨時バイト短期圧縮</div>
                          <div className="text-[10px] opacity-80 font-bold mt-0.5">例：モヤ片付けを2日で完了</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setRecipeActionType('lock_critical_step');
                            setRecipeTitle(`【必須工程ロック】${selectedRow.cropName}の「水平調整（クレーター防止）」を必須固定`);
                          }}
                          className={`p-2.5 rounded-xl border text-left text-xs font-black cursor-pointer transition-all ${
                            recipeActionType === 'lock_critical_step'
                              ? 'bg-sky-400 text-slate-950 border-white shadow-md'
                              : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                          }`}
                        >
                          <div>⭐ ③ 必須チェック固定</div>
                          <div className="text-[10px] opacity-80 font-bold mt-0.5">例：水田の水平均平・手順</div>
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-300 block">
                          次回自動でリマインド・追加する工程内容（タイトル）
                        </label>
                        <input
                          type="text"
                          value={recipeTitle}
                          onChange={e => setRecipeTitle(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm font-black text-white focus:outline-none focus:border-emerald-400"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="text-[11px] font-bold text-slate-400 block mb-1">目標作業時間(h)</label>
                          <input
                            type="number"
                            min={1}
                            value={recipeTargetHours}
                            onChange={e => setRecipeTargetHours(Number(e.target.value) || 1)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-black text-white"
                          />
                        </div>
                        {recipeActionType === 'temp_worker_compress' && (
                          <>
                            <div>
                              <label className="text-[11px] font-bold text-amber-300 block mb-1">臨時バイト人数(名)</label>
                              <input
                                type="number"
                                min={1}
                                value={recipeTempWorkers}
                                onChange={e => setRecipeTempWorkers(Number(e.target.value) || 1)}
                                className="w-full px-3 py-2 bg-slate-900 border border-amber-500/60 rounded-xl text-xs font-black text-amber-300"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-bold text-amber-300 block mb-1">目標完了日数(日)</label>
                              <input
                                type="number"
                                min={1}
                                value={recipeTargetDays}
                                onChange={e => setRecipeTargetDays(Number(e.target.value) || 1)}
                                className="w-full px-3 py-2 bg-slate-900 border border-amber-500/60 rounded-xl text-xs font-black text-amber-300"
                              />
                            </div>
                          </>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-400 block">
                          なぜこの見直しを行うか（現場の補足・理由メモ）
                        </label>
                        <input
                          type="text"
                          value={recipeReason}
                          onChange={e => setRecipeReason(e.target.value)}
                          placeholder="例：定植時に深さ15cmの硬い層で+15h超過したため"
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-slate-200"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-400 block">
                          📁 手順書・現場写真のGoogleドライブURL（任意）
                        </label>
                        <input
                          type="url"
                          value={recipeDriveUrl}
                          onChange={e => setRecipeDriveUrl(e.target.value)}
                          placeholder="https://drive.google.com/..."
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-slate-200"
                        />
                      </div>

                      {/* 作業予定（/admin/tasks）への同時スケジュール登録 */}
                      <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-xs font-black text-emerald-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={alsoScheduleTask}
                            onChange={e => setAlsoScheduleTask(e.target.checked)}
                            className="w-4 h-4 accent-emerald-500 rounded"
                          />
                          <span>📅 作業指示（予定カレンダー）にも今すぐ登録する</span>
                        </label>
                        {alsoScheduleTask && (
                          <input
                            type="date"
                            value={scheduleTaskDate}
                            onChange={e => setScheduleTaskDate(e.target.value)}
                            className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs font-black text-white"
                          />
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={isSavingRecipe}
                        className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl text-sm shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        <span>
                          {isSavingRecipe
                            ? '保存中...'
                            : '✅ この見直し処方箋を「次回レシピ」に保存してPDCAを確定する'}
                        </span>
                      </button>

                      {/* 既にこの工程に登録されているレシピ一覧 */}
                      {selectedCell.recipes.length > 0 && (
                        <div className="pt-3 border-t border-slate-800 space-y-2">
                          <div className="text-xs font-black text-emerald-400">
                            📌 この工程に設定済みの次回レシピ（作付け計画・作業指示に自動表示されます）：
                          </div>
                          {selectedCell.recipes.map(rcp => (
                            <div key={rcp.id} className="flex items-center justify-between gap-2 bg-slate-900 p-2.5 rounded-xl border border-emerald-500/40 text-xs">
                              <div className="min-w-0">
                                <div className="font-black text-white truncate">{rcp.title}</div>
                                <div className="text-[11px] text-slate-400 truncate">{rcp.reasonSummary}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteRecipe(rcp.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-400 cursor-pointer shrink-0"
                                title="解除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </form>
                  </div>
                </div>
              )}

              {/* 登録済みの全社「次回工程見直しレシピ（PDCA台帳）」一覧 */}
              {processRecipes.length > 0 && (
                <div className="bg-emerald-50/60 rounded-2xl p-4 sm:p-5 border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-sm sm:text-base font-black text-emerald-950 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span>📌 決定済みの「次回作付け・作業工程見直しレシピ」一覧（計{processRecipes.length}件）</span>
                    </h3>
                    <Link
                      href={tenantId ? `/admin/tasks?farm=${tenantId}` : '/admin/tasks'}
                      className="text-xs font-black text-emerald-700 hover:text-emerald-900 underline flex items-center gap-1"
                    >
                      <span>作業指示画面で予定に展開する</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {processRecipes.map(rcp => (
                      <div key={rcp.id} className="bg-white p-3.5 rounded-2xl border border-emerald-200 shadow-2xs flex flex-col justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white text-[10px] font-black">
                              {rcp.fieldName} × {rcp.cropName}（{SIX_STAGE_META[rcp.stageKey]?.shortLabel || rcp.stageKey}）
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteRecipe(rcp.id)}
                              className="text-slate-400 hover:text-rose-600 cursor-pointer"
                              title="レシピを削除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="text-xs font-black text-slate-900 leading-snug">
                            {rcp.title}
                          </div>
                          {rcp.reasonSummary && (
                            <p className="text-[11px] font-bold text-slate-500">
                              理由: {rcp.reasonSummary}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] font-bold text-emerald-800">
                          <span>
                            目安: {rcp.targetHours}h
                            {rcp.tempWorkersCount ? ` / 👥臨時${rcp.tempWorkersCount}名×${rcp.targetDays || 2}日` : ''}
                          </span>
                          {rcp.driveUrl && (
                            <a
                              href={rcp.driveUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 underline flex items-center gap-0.5"
                            >
                              📁ドライブ <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* --- 3. 補助グラフ（月別推移・品目別・圃場別・スタッフ別生産性：開閉式でスッキリ整理） --- */}
          <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5">
            <button
              type="button"
              onClick={() => setShowAllTrends(prev => !prev)}
              className="w-full flex items-center justify-between text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <CalendarDays className="w-5 h-5 text-slate-600" />
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-800">
                    📊 月別収支トレンド・品目別・圃場別・スタッフ別グラフを見る
                  </h2>
                  <p className="text-xs text-slate-500 font-bold">
                    月ごとの売上・人件費推移やスタッフ別の1時間あたり利益貢献度グラフを展開します
                  </p>
                </div>
              </div>
              <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-black flex items-center gap-1">
                {showAllTrends ? (
                  <>閉じる <ChevronUp className="w-4 h-4" /></>
                ) : (
                  <>グラフを開く <ChevronDown className="w-4 h-4" /></>
                )}
              </span>
            </button>

            {showAllTrends && (
              <div className="mt-6 space-y-6">
                <div className="w-full h-[340px]">
                  {monthlyTrendData.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">データがありません</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={monthlyTrendData} margin={{ top: 20, right: 20, bottom: 0, left: 20 }}>
                        <CartesianGrid stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="month" tick={{ fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={formatYAxisTenThousand} tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <Tooltip
                          formatter={(val: any, name: any) => [`¥${Math.round(val || 0).toLocaleString()}`, String(name || '')]}
                          contentStyle={{ borderRadius: '16px', border: 'none', fontWeight: 'bold' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px', fontWeight: 'bold' }} />
                        <Bar dataKey="売上" barSize={32} fill="#3b82f6" radius={[4, 4, 0, 0]} name="出荷売上" />
                        <Bar dataKey="コスト" barSize={32} fill="#ef4444" radius={[4, 4, 0, 0]} name="投入人件費" />
                        <Line type="monotone" dataKey="単月利益" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} name="単月労働粗利" />
                        <Area type="monotone" dataKey="累計利益" fill="#10b981" stroke="#10b981" fillOpacity={0.1} strokeWidth={3} name="累計労働粗利" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 h-[360px] flex flex-col">
                    <h3 className="text-base font-black text-slate-800 mb-3 flex items-center gap-2">
                      <Sprout className="w-5 h-5 text-emerald-600" /> 品目別 現場労働粗利
                    </h3>
                    <div className="flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={profitabilityData} margin={{ top: 0, right: 0, left: -20, bottom: 30 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} />
                          <YAxis tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={formatYAxisTenThousand} />
                          <Tooltip formatter={(val: any) => formatCurrency(Number(val))} />
                          <Bar dataKey="利益" radius={[6, 6, 0, 0]} maxBarSize={48}>
                            {profitabilityData.map((entry, idx) => (
                              <Cell key={`cell-${idx}`} fill={entry.利益 >= 0 ? '#10b981' : '#ef4444'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 h-[360px] flex flex-col">
                    <h3 className="text-base font-black text-slate-800 mb-3 flex items-center gap-2">
                      <UserCheck className="w-5 h-5 text-purple-600" /> スタッフ別 1時間あたり利益貢献度
                    </h3>
                    <div className="flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={workerProductivityData} margin={{ top: 0, right: 0, left: -20, bottom: 30 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} />
                          <YAxis tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={formatCurrency} />
                          <Tooltip formatter={(val: any) => `${formatCurrency(Number(val))}/h`} />
                          <Bar dataKey="生産性" radius={[6, 6, 0, 0]} maxBarSize={48}>
                            {workerProductivityData.map((entry, idx) => (
                              <Cell key={`wcell-${idx}`} fill={entry.生産性 >= 0 ? '#8b5cf6' : '#ef4444'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* 📁 Googleドライブ共有フォルダ設定モーダル */}
      {showDriveModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveDriveUrl} className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-blue-600" />
              <span>📁 農園のGoogleドライブ共有フォルダ連携</span>
            </h3>
            <p className="text-xs text-slate-600 font-bold leading-relaxed">
              圃場の写真・動画や、作業手順書（水田の水平調整マニュアル、モヤの片付け手順など）を入れているGoogleドライブのフォルダURLを登録しておくと、TOP画面や作業指示画面からワンクリックで開けます。
            </p>
            <input
              type="url"
              value={driveUrlInput}
              onChange={e => setDriveUrlInput(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDriveModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isSavingDrive}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black cursor-pointer"
              >
                {isSavingDrive ? '保存中...' : '保存する'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
