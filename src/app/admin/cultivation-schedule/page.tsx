"use client";

/**
 * 作付け別の収支・時間按分ボード（業務管理・直接利益最大化特化版）
 *
 * 方針:
 *  - 資材購入や光熱費・機械償却などの経理機能は専用経理ソフトへ切り離し、現場の「作業時間・工程効率・人件費按分・出荷売上」に完全特化。
 *  - 農園共通の準備・片付け・草刈り等の時間を、ワンクリックで「📐 面積比按分」⇔「⏱️ 直接作業時間比按分」⇔「🚫 按分なし」に切り替えて配賦。
 *  - 各作付けごとに「🟢 直接利益を生む作業（播種・定植・収穫・出荷）」「🟡 育成管理」「🔴 準備・片付け等（短縮対象）」の割合と時間あたり利益を可視化。
 */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '@/lib/tenant';
import { getJSTDate } from '@/lib/dateUtils';
import { AdminOnlyGuard } from '@/components/AdminOnlyGuard';
import {
  getTenantCultivationPlansAction,
  saveTenantCultivationPlanAction,
  getCultivationSchedulePageDataAction
} from '@/app/actions/farm';
import { classifyWorkProcess, PROCESS_CATEGORY_META } from '@/lib/workProcessUtils';
import {
  Calendar,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  Trash2,
  Target,
  Package,
  FileText,
  TrendingUp,
  AlertTriangle,
  Clock,
  Sprout,
  RefreshCw,
  Sliders,
  Image as ImageIcon,
  ArrowRight
} from 'lucide-react';

// 時給が未設定の作業者に使う仮の時給（画面上で必ず明示する）
const FALLBACK_HOURLY_WAGE = 1000;

type AllocationMode = 'area' | 'hours' | 'none';
type MetaObj = Record<string, any>;

const parsePlanMeta = (raw: string | null | undefined): { clean: string; meta: MetaObj } => {
  const str = String(raw || '');
  const idx = str.indexOf('||META:');
  if (idx === -1) return { clean: str.trim(), meta: {} };
  let meta: MetaObj = {};
  try {
    meta = JSON.parse(str.slice(idx + 7).trim()) || {};
  } catch (e) {
    meta = {};
  }
  return { clean: str.slice(0, idx).trim(), meta };
};

const serializePlanMeta = (clean: string, meta: MetaObj) =>
  `${clean.trim()} ||META:${JSON.stringify(meta)}`.trim();

const termLabel = (t?: number) => (t === 2 ? '中旬' : t === 3 ? '下旬' : '上旬');

const yen = (n: number) => `¥${Math.round(n || 0).toLocaleString()}`;
const kg = (n: number) => `${(Math.round((n || 0) * 10) / 10).toLocaleString()} kg`;
const hoursLabel = (h: number) => {
  const totalMin = Math.round((h || 0) * 60);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  if (hh === 0) return `${mm}分`;
  return mm === 0 ? `${hh}時間` : `${hh}時間${mm}分`;
};

const pad2 = (n: number) => String(n).padStart(2, '0');
const lastDayOf = (y: number, m: number) => new Date(y, m, 0).getDate();

const getPlanWindow = (plan: any, meta: MetaObj) => {
  const y = Number(plan.year) || new Date().getFullYear();
  const sm = Number(plan.start_month) || 1;
  const em = Number(plan.end_month) || sm;
  const seedM = Number(meta.sm) || 0;

  let startY = y;
  let startM = sm;
  if (seedM > 0) {
    startM = seedM;
    startY = seedM > sm ? y - 1 : y;
  }
  const endY = em < sm ? y + 1 : y;

  const salesEndM = em === 12 ? 1 : em + 1;
  const salesEndY = em === 12 ? endY + 1 : endY;

  return {
    start: `${startY}-${pad2(startM)}-01`,
    end: `${endY}-${pad2(em)}-${pad2(lastDayOf(endY, em))}`,
    salesEnd: `${salesEndY}-${pad2(salesEndM)}-${pad2(lastDayOf(salesEndY, salesEndM))}`
  };
};

export default function CultivationSchedulePage() {
  const [tenantId, setTenantId] = useState<string>('');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>('');

  const [fields, setFields] = useState<any[]>([]);
  const [crops, setCrops] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [workLogs, setWorkLogs] = useState<any[]>([]);
  const [salesLogs, setSalesLogs] = useState<any[]>([]);

  const [cropFilter, setCropFilter] = useState<string>('all');
  const [sortMode, setSortMode] = useState<'profit' | 'profitPerHour' | 'directRatio' | 'area' | 'field'>('profit');

  // ⚡ ワンクリック按分モード切替（面積比 ⇔ 直接作業時間比 ⇔ 按分なし）
  const [allocationMode, setAllocationMode] = useState<AllocationMode>('area');

  // 目標設定モーダル
  const [targetPlan, setTargetPlan] = useState<any | null>(null);
  const [targetYieldInput, setTargetYieldInput] = useState('');
  const [targetPriceInput, setTargetPriceInput] = useState('');
  const [isSavingTarget, setIsSavingTarget] = useState(false);

  // 出荷・売上記録モーダル
  const [salesPlan, setSalesPlan] = useState<any | null>(null);
  const [salesDate, setSalesDate] = useState<string>(() => getJSTDate());
  const [salesQty, setSalesQty] = useState('');
  const [salesUnitPrice, setSalesUnitPrice] = useState('');
  const [salesTotal, setSalesTotal] = useState('');
  const [salesMemo, setSalesMemo] = useState('');
  const [isSavingSales, setIsSavingSales] = useState(false);

  // 明細ドロワー
  const [detailPlanId, setDetailPlanId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'process' | 'work' | 'sales'>('process');

  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const fetchData = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const tid = await getCurrentTenantId();
      if (!tid) {
        setLoadError('農園の情報が確認できませんでした。お手数ですが、もう一度ログインしてください。');
        setIsLoading(false);
        return;
      }
      setTenantId(tid);

      const pageRes = await getCultivationSchedulePageDataAction(tid, year);
      if (pageRes.success) {
        if (pageRes.ownerId && pageRes.ownerId !== tid) {
          setTenantId(pageRes.ownerId);
        }
        setFields(pageRes.fields || []);
        setCrops(pageRes.crops || []);
        setPlans(pageRes.plans || []);
        setWorkLogs(pageRes.workLogs || []);
        setSalesLogs(pageRes.salesLogs || []);
      } else {
        const rangeStart = `${year - 1}-01-01`;
        const rangeEnd = `${year + 1}-12-31`;

        const [fRes, cRes, pRes, wRes, sRes] = await Promise.all([
          supabase.from('fields').select('*').eq('user_id', tid).order('name'),
          supabase.from('crops').select('*').eq('user_id', tid).order('name'),
          getTenantCultivationPlansAction(tid, year),
          supabase
            .from('work_logs')
            .select('*, workers(name, hourly_wage)')
            .eq('user_id', tid)
            .gte('work_date', rangeStart)
            .lte('work_date', rangeEnd),
          supabase.from('sales_logs').select('*').eq('user_id', tid).gte('sales_date', rangeStart).lte('sales_date', rangeEnd)
        ]);

        if (!pRes.success) throw new Error(pRes.error || '計画取得エラー');
        if (wRes.error) throw wRes.error;
        if (sRes.error) throw sRes.error;

        setFields(fRes.data || []);
        setCrops(cRes.data || []);
        setPlans(pRes.data || []);
        setWorkLogs(wRes.data || []);
        setSalesLogs(sRes.data || []);
      }
    } catch (err: any) {
      console.error(err);
      setLoadError('データの読み込みに失敗しました。通信環境をご確認のうえ「再読み込み」を押してください。');
    } finally {
      setIsLoading(false);
    }
  };

  // --- 作付けごとの直接集計 ＆ 共通作業（準備・片付け等）の自動按分エンジン ---
  const { planReports, commonPoolSummary } = useMemo(() => {
    const matchedLogIds = new Set<string>();

    // 第1パス: 各作付けに直接紐づく作業記録・出荷記録を集計
    const baseReports = plans.map(plan => {
      const { clean: varietyName, meta } = parsePlanMeta(plan.variety);
      const field = fields.find(f => f.id === plan.field_id);
      const crop = plan.crops || crops.find(c => c.id === plan.crop_id);
      const fieldName = field?.name || '圃場未設定';
      const cropName = crop?.name || '作目未設定';
      const areaRaw = Number(field?.area_size) || Number(plan.calculated_area) || 0;
      const hasArea = areaRaw > 0;
      const win = getPlanWindow(plan, meta);

      const pWorks = workLogs.filter(w => {
        if (w.status === 'planned' || w.approval_status === 'rejected') return false;
        if (w.plan_id) {
          const isMatch = w.plan_id === plan.id;
          if (isMatch && w.id) matchedLogIds.add(w.id);
          return isMatch;
        }
        if (!w.field_id || w.field_id !== plan.field_id) return false;
        if (w.crop_id && w.crop_id !== plan.crop_id) return false;
        const d = String(w.work_date || '');
        const inWin = d >= win.start && d <= win.end;
        if (inWin && w.id) matchedLogIds.add(w.id);
        return inWin;
      });

      let recordedHours = 0;
      let recordedLaborCost = 0;
      let fallbackWageCount = 0;
      let directCatHours = 0;
      let careCatHours = 0;
      let prepCatHours = 0;
      let directCatCost = 0;
      let careCatCost = 0;
      let prepCatCost = 0;

      const processBreakdownMap: Record<string, { workType: string; category: string; hours: number; cost: number; count: number }> = {};

      pWorks.forEach(w => {
        const h = (Number(w.duration_minutes) || 0) / 60;
        if (h <= 0) return;
        recordedHours += h;
        const wage = Number(w.workers?.hourly_wage) || 0;
        const effectiveWage = wage > 0 ? wage : FALLBACK_HOURLY_WAGE;
        if (wage <= 0) fallbackWageCount++;
        const c = h * effectiveWage;
        recordedLaborCost += c;

        const cat = classifyWorkProcess(w.work_type || w.task_title);
        if (cat === 'direct') {
          directCatHours += h;
          directCatCost += c;
        } else if (cat === 'prep_cleanup') {
          prepCatHours += h;
          prepCatCost += c;
        } else {
          careCatHours += h;
          careCatCost += c;
        }

        const wtName = String(w.work_type || w.task_title || '一般作業').trim();
        if (!processBreakdownMap[wtName]) {
          processBreakdownMap[wtName] = { workType: wtName, category: cat, hours: 0, cost: 0, count: 0 };
        }
        processBreakdownMap[wtName].hours += h;
        processBreakdownMap[wtName].cost += c;
        processBreakdownMap[wtName].count += 1;
      });

      // 出荷・売上
      const pSales = salesLogs.filter(s => {
        if (s.status === 'planned') return false;
        if (s.plan_id) return s.plan_id === plan.id;
        if (s.field_id !== plan.field_id) return false;
        if (s.crop_id && s.crop_id !== plan.crop_id) return false;
        const d = String(s.sales_date || '');
        return d >= win.start && d <= win.salesEnd;
      });

      let actualYieldKg = 0;
      let actualSales = 0;
      let nonKgCount = 0;
      pSales.forEach(s => {
        actualSales += Number(s.total_sales) || 0;
        const isAmountOnly = String(s.memo || '').includes(':売上]');
        const unit = String(s.unit || 'kg').toLowerCase();
        if (!isAmountOnly) {
          if (unit === 'kg' || unit === 'ｋｇ') actualYieldKg += Number(s.quantity) || 0;
          else if (Number(s.quantity) > 0) nonKgCount++;
        }
      });

      const targetYieldKg = Number(meta.ty) || 0;
      const targetUnitPrice = Number(meta.tp) || 0;
      const targetSales = targetYieldKg > 0 && targetUnitPrice > 0 ? targetYieldKg * targetUnitPrice : 0;

      return {
        plan,
        meta,
        varietyName,
        fieldName,
        cropName,
        cropId: plan.crop_id,
        areaRaw,
        hasArea,
        periodLabel: `${plan.start_month}月${termLabel(meta.st)}〜${plan.end_month}月${termLabel(meta.et)}`,
        harvestLabel: meta.hm ? `${meta.hm}月${termLabel(meta.ht)}〜` : '',
        win,
        works: pWorks,
        sales: pSales,
        recordedHours,
        recordedLaborCost,
        fallbackWageCount,
        directCatHours,
        careCatHours,
        prepCatHours,
        directCatCost,
        careCatCost,
        prepCatCost,
        processBreakdown: Object.values(processBreakdownMap).sort((a, b) => b.hours - a.hours),
        actualYieldKg,
        actualSales,
        nonKgCount,
        targetYieldKg,
        targetUnitPrice,
        targetSales
      };
    });

    // 第2パス: 特定の作付けに紐づかなかった当該年度の共通作業（農園全体の準備・片付け・草刈り・品目のみ指定等）を抽出
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    const unassignedLogs = workLogs.filter(w => {
      if (w.status === 'planned' || w.approval_status === 'rejected') return false;
      if (w.id && matchedLogIds.has(w.id)) return false;
      const d = String(w.work_date || '');
      return d >= yearStart && d <= yearEnd && (Number(w.duration_minutes) || 0) > 0;
    });

    let commonHoursTotal = 0;
    let commonCostTotal = 0;
    unassignedLogs.forEach(w => {
      const h = (Number(w.duration_minutes) || 0) / 60;
      const wage = Number(w.workers?.hourly_wage) || FALLBACK_HOURLY_WAGE;
      commonHoursTotal += h;
      commonCostTotal += h * wage;
    });

    const totalPlansArea = baseReports.reduce((s, r) => s + (r.areaRaw || 0), 0);
    const totalPlansRecordedHours = baseReports.reduce((s, r) => s + (r.recordedHours || 0), 0);
    const planCount = baseReports.length || 1;

    // 第3パス: 選択された按分モード（area: 面積比 / hours: 直接作業時間比 / none: 按分なし）で各作付けに配賦
    const finalReports = baseReports.map(r => {
      let shareRatio = 0;
      if (allocationMode === 'area') {
        shareRatio = totalPlansArea > 0 ? r.areaRaw / totalPlansArea : 1 / planCount;
      } else if (allocationMode === 'hours') {
        shareRatio = totalPlansRecordedHours > 0 ? r.recordedHours / totalPlansRecordedHours : 1 / planCount;
      } else {
        shareRatio = 0;
      }

      const allocatedCommonHours = commonHoursTotal * shareRatio;
      const allocatedCommonCost = commonCostTotal * shareRatio;

      const workHours = r.recordedHours + allocatedCommonHours;
      const laborCost = r.recordedLaborCost + allocatedCommonCost;
      const totalPrepHours = r.prepCatHours + allocatedCommonHours;
      const totalPrepCost = r.prepCatCost + allocatedCommonCost;

      const directRatio = workHours > 0 ? Math.round((r.directCatHours / workHours) * 100) : 0;
      const careRatio = workHours > 0 ? Math.round((r.careCatHours / workHours) * 100) : 0;
      const prepRatio = workHours > 0 ? Math.max(0, 100 - directRatio - careRatio) : 0;

      const profit = r.actualSales - laborCost;
      const profitPer10a = r.hasArea ? profit * (10 / r.areaRaw) : null;
      const hoursPer10a = r.hasArea ? workHours * (10 / r.areaRaw) : null;
      const profitPerHour = workHours > 0 ? profit / workHours : null;
      const yieldProgress = r.targetYieldKg > 0 ? Math.round((r.actualYieldKg / r.targetYieldKg) * 100) : null;
      const salesProgress = r.targetSales > 0 ? Math.round((r.actualSales / r.targetSales) * 100) : null;

      return {
        ...r,
        shareRatio,
        allocatedCommonHours,
        allocatedCommonCost,
        workHours,
        laborCost,
        totalPrepHours,
        totalPrepCost,
        directRatio,
        careRatio,
        prepRatio,
        profit,
        profitPer10a,
        hoursPer10a,
        profitPerHour,
        yieldProgress,
        salesProgress
      };
    });

    return {
      planReports: finalReports,
      commonPoolSummary: {
        count: unassignedLogs.length,
        hours: commonHoursTotal,
        cost: commonCostTotal
      }
    };
  }, [plans, fields, crops, workLogs, salesLogs, year, allocationMode]);

  const visibleReports = useMemo(() => {
    const list = planReports.filter(r => cropFilter === 'all' || r.cropId === cropFilter);
    return [...list].sort((a, b) => {
      if (sortMode === 'profitPerHour') return (b.profitPerHour ?? -999999) - (a.profitPerHour ?? -999999);
      if (sortMode === 'directRatio') return b.directRatio - a.directRatio;
      if (sortMode === 'area') return b.areaRaw - a.areaRaw;
      if (sortMode === 'field') return a.fieldName.localeCompare(b.fieldName, 'ja');
      return b.profit - a.profit;
    });
  }, [planReports, cropFilter, sortMode]);

  const summary = useMemo(() => {
    const s = visibleReports.reduce(
      (acc, r) => {
        acc.area += r.areaRaw;
        acc.targetSales += r.targetSales;
        acc.actualSales += r.actualSales;
        acc.laborCost += r.laborCost;
        acc.hours += r.workHours;
        acc.directHours += r.directCatHours;
        acc.careHours += r.careCatHours;
        acc.prepHours += r.totalPrepHours;
        acc.targetYield += r.targetYieldKg;
        acc.actualYield += r.actualYieldKg;
        if (r.targetSales <= 0) acc.noTargetCount++;
        return acc;
      },
      {
        area: 0,
        targetSales: 0,
        actualSales: 0,
        laborCost: 0,
        hours: 0,
        directHours: 0,
        careHours: 0,
        prepHours: 0,
        targetYield: 0,
        actualYield: 0,
        noTargetCount: 0
      }
    );
    const profit = s.actualSales - s.laborCost;
    const directRatio = s.hours > 0 ? Math.round((s.directHours / s.hours) * 100) : 0;
    const prepRatio = s.hours > 0 ? Math.round((s.prepHours / s.hours) * 100) : 0;
    return {
      ...s,
      profit,
      directRatio,
      prepRatio,
      profitPerHour: s.hours > 0 ? profit / s.hours : null,
      salesProgress: s.targetSales > 0 ? Math.round((s.actualSales / s.targetSales) * 100) : null
    };
  }, [visibleReports]);

  const cropChips = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    planReports.forEach(r => {
      if (!r.cropId) return;
      const prev = map.get(r.cropId) || { id: r.cropId, name: r.cropName, count: 0 };
      prev.count++;
      map.set(r.cropId, prev);
    });
    return Array.from(map.values());
  }, [planReports]);

  const detailReport = useMemo(
    () => planReports.find(r => r.plan.id === detailPlanId) || null,
    [planReports, detailPlanId]
  );

  const farmQuery = tenantId ? `?farm=${tenantId}` : '';
  const farmPrefix = tenantId ? `farm=${tenantId}&` : '';
  const calendarHref = `/admin/cultivations?${farmPrefix}tab=cultivations&focus=calendar`;
  const diaryHref = `/admin/cultivations?${farmPrefix}tab=history`;

  // --- 目標設定 ---
  const openTargetModal = (r: any) => {
    setTargetPlan(r);
    setTargetYieldInput(r.targetYieldKg > 0 ? String(r.targetYieldKg) : '');
    setTargetPriceInput(r.targetUnitPrice > 0 ? String(r.targetUnitPrice) : '');
  };

  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPlan) return;
    const yieldVal = Number(targetYieldInput);
    const priceVal = Number(targetPriceInput);
    if (targetYieldInput !== '' && (isNaN(yieldVal) || yieldVal < 0)) {
      alert('目標収穫量は0以上の数字で入力してください（例: 8000）');
      return;
    }
    if (targetPriceInput !== '' && (isNaN(priceVal) || priceVal < 0)) {
      alert('目標単価は0以上の数字で入力してください（例: 120）');
      return;
    }
    setIsSavingTarget(true);
    try {
      const { clean, meta } = parsePlanMeta(targetPlan.plan.variety);
      const nextMeta = { ...meta, ty: targetYieldInput === '' ? '' : yieldVal, tp: targetPriceInput === '' ? '' : priceVal };
      const saveRes = await saveTenantCultivationPlanAction(tenantId, targetPlan.plan.id, {
        variety: serializePlanMeta(clean, nextMeta)
      });
      if (!saveRes.success) throw new Error(saveRes.error || '保存エラー');
      setTargetPlan(null);
      setToast(`「${targetPlan.fieldName}・${targetPlan.cropName}」の目標を保存しました`);
      await fetchData();
    } catch (err: any) {
      console.error(err);
      alert('目標の保存に失敗しました。時間をおいてもう一度お試しください。');
    } finally {
      setIsSavingTarget(false);
    }
  };

  // --- 出荷・売上記録 ---
  const openSalesModal = (r: any) => {
    setSalesPlan(r);
    setSalesDate(getJSTDate());
    setSalesQty('');
    setSalesUnitPrice(r.targetUnitPrice > 0 ? String(r.targetUnitPrice) : '');
    setSalesTotal('');
    setSalesMemo('');
  };

  const computedSalesTotal = useMemo(() => {
    if (salesTotal !== '') return Number(salesTotal) || 0;
    const q = Number(salesQty) || 0;
    const p = Number(salesUnitPrice) || 0;
    return q > 0 && p > 0 ? Math.round(q * p) : 0;
  }, [salesQty, salesUnitPrice, salesTotal]);

  const handleSaveSales = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salesPlan) return;
    const q = Number(salesQty);
    if (!salesDate) {
      alert('出荷日を選んでください');
      return;
    }
    if (salesQty === '' || isNaN(q) || q <= 0) {
      alert('出荷量（kg）を入力してください（例: 120）');
      return;
    }
    setIsSavingSales(true);
    try {
      const { error } = await supabase.from('sales_logs').insert([
        {
          user_id: tenantId,
          plan_id: salesPlan.plan.id,
          field_id: salesPlan.plan.field_id,
          crop_id: salesPlan.plan.crop_id,
          sales_date: salesDate,
          quantity: q,
          unit: 'kg',
          total_sales: computedSalesTotal > 0 ? computedSalesTotal : null,
          memo: salesMemo.trim() || null,
          status: 'completed'
        }
      ]);
      if (error) throw error;
      setSalesPlan(null);
      setToast(`出荷 ${q}kg${computedSalesTotal > 0 ? `（${yen(computedSalesTotal)}）` : ''} を記録しました`);
      await fetchData();
    } catch (err: any) {
      console.error(err);
      alert('出荷・売上の保存に失敗しました。時間をおいてもう一度お試しください。');
    } finally {
      setIsSavingSales(false);
    }
  };

  const handleDeleteSales = async (salesId: string) => {
    if (!confirm('この出荷・売上の記録を削除しますか？（元に戻せません）')) return;
    try {
      const { error } = await supabase.from('sales_logs').delete().eq('id', salesId).eq('user_id', tenantId);
      if (error) throw error;
      setToast('出荷・売上の記録を削除しました');
      await fetchData();
    } catch (err: any) {
      console.error(err);
      alert('削除に失敗しました。時間をおいてもう一度お試しください。');
    }
  };

  const ProgressBar = ({ value }: { value: number | null }) => {
    if (value === null) return null;
    const w = Math.max(0, Math.min(100, value));
    const color = value >= 100 ? 'bg-emerald-500' : value >= 60 ? 'bg-amber-400' : 'bg-rose-400';
    return (
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${w}%` }} />
      </div>
    );
  };

  return (
    <AdminOnlyGuard>
      <div className="max-w-6xl mx-auto space-y-5 pb-16">
        {toast && (
          <div className="fixed bottom-5 right-5 z-50 bg-emerald-900 text-white px-4 py-3 rounded-2xl shadow-xl text-xs font-black border border-emerald-500">
            ✅ {toast}
          </div>
        )}

        {/* ヘッダー */}
        <header className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-black mb-2">
                <Clock className="w-3.5 h-3.5" />
                <span>業務管理・労働時間按分・直接利益最大化</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2.5">
                <TrendingUp className="w-7 h-7 text-emerald-600" />
                <span>作付け別の収支・時間按分ボード</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-bold mt-1">
                どの圃場・品目にどれだけの時間（直接作業 vs 準備・片付け）と人件費をかけ、1時間あたりいくら利益を生んだかを比較します。
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200 text-xs font-black">
                <button type="button" onClick={() => setYear(y => y - 1)} className="px-2 py-1.5 text-slate-600 hover:text-slate-900 cursor-pointer flex items-center">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 bg-white text-emerald-700 rounded-lg shadow-2xs">{year}年度</span>
                <button type="button" onClick={() => setYear(y => y + 1)} className="px-2 py-1.5 text-slate-600 hover:text-slate-900 cursor-pointer flex items-center">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={fetchData}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                再読み込み
              </button>
            </div>
          </div>

          {/* ⚡ ワンクリック按分ルール切替バー（面積比 ⇔ 直接作業時間比 ⇔ 按分なし） */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-inner">
            <div className="space-y-0.5">
              <div className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                <Sliders className="w-4 h-4" />
                <span>共通作業・準備・片付け時間の自動按分ルール（ワンクリック切替）</span>
              </div>
              <p className="text-[11px] text-slate-300 font-bold">
                特定の作付けに紐づかない農園共通作業（{commonPoolSummary.count}件・計 {hoursLabel(commonPoolSummary.hours)} / {yen(commonPoolSummary.cost)}）の配賦方法：
              </p>
            </div>

            <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setAllocationMode('area')}
                className={`px-3 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  allocationMode === 'area'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                📐 面積比で按分
              </button>
              <button
                type="button"
                onClick={() => setAllocationMode('hours')}
                className={`px-3 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  allocationMode === 'hours'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                ⏱️ 作業時間比で按分
              </button>
              <button
                type="button"
                onClick={() => setAllocationMode('none')}
                className={`px-3 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  allocationMode === 'none'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                🚫 按分なし
              </button>
            </div>
          </div>
        </header>

        {isLoading ? (
          <div className="bg-white p-16 rounded-3xl border border-slate-200 flex flex-col items-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="text-xs font-bold">作付けごとの作業時間・人件費按分・出荷売上を集計しています...</p>
          </div>
        ) : loadError ? (
          <div className="bg-rose-50 p-8 rounded-3xl border border-rose-200 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
            <p className="text-sm font-black text-rose-800">{loadError}</p>
            <button type="button" onClick={fetchData} className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-black cursor-pointer">
              再読み込み
            </button>
          </div>
        ) : planReports.length === 0 ? (
          <div className="bg-white p-10 rounded-3xl border border-slate-200 text-center space-y-3">
            <Sprout className="w-10 h-10 text-emerald-500 mx-auto" />
            <p className="text-base font-black text-slate-800">{year}年度の作付けがまだ登録されていません</p>
            <p className="text-xs font-bold text-slate-500">
              「作付けこよみ（計画）」で、畑と作目・日程を登録すると、ここに作付けごとの時間按分と収支が自動で表示されます。
            </p>
            <Link
              href={calendarHref}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-black shadow-sm"
            >
              <Calendar className="w-4 h-4" />
              作付けを登録しにいく
            </Link>
          </div>
        ) : (
          <>
            {/* 農園全体サマリー（直接利益作業率 ＆ 時間あたり採算） */}
            <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[11px] font-bold text-slate-400 block">🟢 直接利益作業の割合</span>
                <div className="text-xl font-black text-emerald-700">
                  {summary.directRatio}%
                </div>
                <div className="text-[11px] font-bold text-slate-500">
                  直接 {hoursLabel(summary.directHours)} / 🔴準備・片付 {summary.prepRatio}%
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[11px] font-bold text-slate-400 block">💰 出荷売上（実績 / 目標）</span>
                <div className="text-lg font-black text-slate-900">{yen(summary.actualSales)}</div>
                <div className="text-[11px] font-bold text-slate-500">
                  目標 {summary.targetSales > 0 ? yen(summary.targetSales) : '未設定'}
                  {summary.salesProgress !== null && <span className="ml-1 text-emerald-700">（{summary.salesProgress}%）</span>}
                </div>
                <ProgressBar value={summary.salesProgress} />
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 block">👷 投入人件費（按分込）</span>
                <div className="text-lg font-black text-rose-700 mt-0.5">{yen(summary.laborCost)}</div>
                <div className="text-[11px] font-bold text-slate-500">総労働 {hoursLabel(summary.hours)}</div>
              </div>

              <div className={`p-4 rounded-2xl border shadow-2xs ${summary.profit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                <span className="text-[11px] font-bold text-slate-500 block">📈 現場労働粗利（売上−人件費）</span>
                <div className={`text-lg font-black mt-0.5 ${summary.profit >= 0 ? 'text-emerald-800' : 'text-rose-700'}`}>{yen(summary.profit)}</div>
                <div className="text-[11px] font-bold text-slate-500">※資材・経理経費は切り離し</div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs col-span-2 lg:col-span-1">
                <span className="text-[11px] font-bold text-slate-400 block">⏱️ 1時間あたり労働粗利</span>
                <div className="text-lg font-black text-slate-900 mt-0.5">
                  {summary.profitPerHour !== null ? `${yen(summary.profitPerHour)}/h` : '—'}
                </div>
                <div className="text-[11px] font-bold text-slate-500">
                  {visibleReports.length}作付け（計 {Math.round(summary.area * 10) / 10}a）
                </div>
              </div>
            </section>

            {/* 絞り込み・並び替え */}
            <section className="bg-white p-3.5 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <span className="text-[11px] font-black text-slate-400 mr-1 shrink-0">品目:</span>
                <button
                  type="button"
                  onClick={() => setCropFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap cursor-pointer ${
                    cropFilter === 'all' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  すべて ({planReports.length})
                </button>
                {cropChips.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCropFilter(cropFilter === c.id ? 'all' : c.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap cursor-pointer ${
                      cropFilter === c.id ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    🌱 {c.name} ({c.count})
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-black text-slate-400">並び順:</span>
                <select
                  value={sortMode}
                  onChange={e => setSortMode(e.target.value as any)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 cursor-pointer"
                >
                  <option value="profit">労働粗利が多い順</option>
                  <option value="profitPerHour">1時間あたり利益が高い順</option>
                  <option value="directRatio">🟢直接利益作業の割合が高い順</option>
                  <option value="area">面積が広い順</option>
                  <option value="field">圃場名順</option>
                </select>
              </div>
            </section>

            {/* 作付けごとの時間按分・採算カード */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {visibleReports.map(r => (
                <article key={r.plan.id} className="bg-white rounded-3xl border border-slate-200 shadow-2xs p-4 sm:p-5 space-y-4">
                  {/* 見出し */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h2 className="text-base font-black text-slate-900">{r.fieldName}</h2>
                        <span className="px-2 py-0.5 text-[11px] font-black bg-slate-100 text-slate-700 border border-slate-200 rounded-lg">
                          {r.hasArea ? `${r.areaRaw}a` : '面積未設定'}
                        </span>
                        {allocationMode !== 'none' && r.allocatedCommonHours > 0 && (
                          <span className="px-2 py-0.5 text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg">
                            共通按分 +{hoursLabel(r.allocatedCommonHours)} ({Math.round(r.shareRatio * 100)}%)
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-black text-emerald-800 mt-0.5 truncate">
                        🌱 {r.cropName}
                        {r.varietyName ? <span className="text-xs font-bold text-emerald-600">（{r.varietyName}）</span> : null}
                      </p>
                      <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                        📅 {r.periodLabel}
                        {r.harvestLabel && <span className="ml-1.5">🧺 収穫 {r.harvestLabel}</span>}
                      </p>
                    </div>
                    <div className={`shrink-0 text-right px-3 py-2 rounded-2xl border ${r.profit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                      <span className="text-[10px] font-bold text-slate-500 block whitespace-nowrap">現場労働粗利（売上−人件費）</span>
                      <span className={`text-sm sm:text-base font-black ${r.profit >= 0 ? 'text-emerald-800' : 'text-rose-700'}`}>{yen(r.profit)}</span>
                    </div>
                  </div>

                  {/* ⏱️ 作業工程3分類バー（🟢直接利益作業 vs 🟡管理 vs 🔴準備・片付け） */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs font-black">
                      <span className="text-slate-700">⏱️ 作業時間の内訳（計 {hoursLabel(r.workHours)}）</span>
                      <span className="text-emerald-700">🟢 直接利益作業 {r.directRatio}%</span>
                    </div>

                    {r.workHours > 0 ? (
                      <>
                        <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden flex">
                          <div
                            className="bg-emerald-500 h-full transition-all"
                            style={{ width: `${r.directRatio}%` }}
                            title={`直接利益作業: ${hoursLabel(r.directCatHours)}`}
                          />
                          <div
                            className="bg-amber-400 h-full transition-all"
                            style={{ width: `${r.careRatio}%` }}
                            title={`育成管理作業: ${hoursLabel(r.careCatHours)}`}
                          />
                          <div
                            className="bg-rose-500 h-full transition-all"
                            style={{ width: `${r.prepRatio}%` }}
                            title={`準備・片付け・共通按分: ${hoursLabel(r.totalPrepHours)}`}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 text-[11px] font-bold pt-0.5">
                          <div className="text-emerald-800 truncate">
                            🟢 直接: <span className="font-black">{hoursLabel(r.directCatHours)}</span>
                          </div>
                          <div className="text-amber-800 truncate text-center">
                            🟡 管理: <span className="font-black">{hoursLabel(r.careCatHours)}</span>
                          </div>
                          <div className="text-rose-700 truncate text-right">
                            🔴 準備・片付: <span className="font-black">{hoursLabel(r.totalPrepHours)}</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-[11px] font-bold text-slate-400">まだ作業記録がありません</p>
                    )}
                  </div>

                  {/* 収穫量・売上予実 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1.5">
                      <span className="text-[11px] font-black text-slate-500 block">🧺 収穫量</span>
                      <div className="text-sm font-black text-slate-900">{kg(r.actualYieldKg)}</div>
                      <div className="text-[11px] font-bold text-slate-500">
                        目標 {r.targetYieldKg > 0 ? kg(r.targetYieldKg) : '未設定'}
                        {r.yieldProgress !== null && <span className="ml-1 text-emerald-700">（{r.yieldProgress}%）</span>}
                      </div>
                      <ProgressBar value={r.yieldProgress} />
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1.5">
                      <span className="text-[11px] font-black text-slate-500 block">💰 出荷売上</span>
                      <div className="text-sm font-black text-slate-900">{yen(r.actualSales)}</div>
                      <div className="text-[11px] font-bold text-slate-500">
                        目標 {r.targetSales > 0 ? yen(r.targetSales) : '未設定'}
                        {r.salesProgress !== null && <span className="ml-1 text-emerald-700">（{r.salesProgress}%）</span>}
                      </div>
                      <ProgressBar value={r.salesProgress} />
                    </div>
                  </div>

                  {/* 人件費・時間効率サマリー */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="grid grid-cols-3 text-center divide-x divide-slate-200 bg-white">
                      <div className="px-1.5 py-2 sm:p-2.5 min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 block truncate">👷 投入人件費（計）</span>
                        <span className="text-[11px] sm:text-xs font-black text-rose-700 block truncate">{yen(r.laborCost)}</span>
                        <span className="text-[10px] font-bold text-slate-400 block truncate">
                          直接 {yen(r.recordedLaborCost)}
                        </span>
                      </div>
                      <div className="px-1.5 py-2 sm:p-2.5 min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 block truncate">📐 10aあたり労働時間</span>
                        <span className="text-[11px] sm:text-xs font-black text-slate-800 block truncate">
                          {r.hoursPer10a !== null ? hoursLabel(r.hoursPer10a) : '面積未設定'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 block truncate">
                          10a粗利 {r.profitPer10a !== null ? yen(r.profitPer10a) : '—'}
                        </span>
                      </div>
                      <div className="px-1.5 py-2 sm:p-2.5 min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 block truncate">⚡ 1時間あたり利益</span>
                        <span className="text-[11px] sm:text-xs font-black text-emerald-700 block truncate">
                          {r.profitPerHour !== null ? `${yen(r.profitPerHour)}/h` : '記録なし'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 block truncate">時給換算の採算</span>
                      </div>
                    </div>
                  </div>

                  {/* 操作ボタン */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => openSalesModal(r)}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <Package className="w-3.5 h-3.5" />
                      出荷・売上を記録
                    </button>
                    <button
                      type="button"
                      onClick={() => openTargetModal(r)}
                      className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer"
                    >
                      <Target className="w-3.5 h-3.5" />
                      目標を設定
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDetailPlanId(r.plan.id);
                        setDetailTab('process');
                      }}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      工程・日報を見る
                    </button>
                    <a
                      href={`/admin/report/${r.plan.id}${farmQuery}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black flex items-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      PDF
                    </a>
                    <Link
                      href={calendarHref}
                      className="ml-auto px-3 py-2 text-emerald-700 hover:bg-emerald-50 rounded-xl text-xs font-black flex items-center gap-1"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      日程変更
                    </Link>
                  </div>
                </article>
              ))}
            </section>
          </>
        )}
      </div>

      {/* 🎯 目標設定モーダル */}
      {targetPlan && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <Target className="w-5 h-5 text-amber-600" />
                  目標を設定
                </h3>
                <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                  {targetPlan.fieldName}・{targetPlan.cropName}（{targetPlan.hasArea ? `${targetPlan.areaRaw}a` : '面積未設定'}）
                </p>
              </div>
              <button type="button" onClick={() => setTargetPlan(null)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveTarget} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">目標収穫量（kg）</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={targetYieldInput}
                  onChange={e => setTargetYieldInput(e.target.value)}
                  placeholder="例: 8000"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-black text-slate-800 outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">目標単価（円 / kg）</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={targetPriceInput}
                  onChange={e => setTargetPriceInput(e.target.value)}
                  placeholder="例: 120"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-black text-slate-800 outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-xs font-bold text-amber-900">
                目標売上：
                <span className="text-base font-black ml-1">
                  {Number(targetYieldInput) > 0 && Number(targetPriceInput) > 0
                    ? yen(Number(targetYieldInput) * Number(targetPriceInput))
                    : '収穫量と単価を入れると自動で計算します'}
                </span>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={() => setTargetPlan(null)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer">
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSavingTarget}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  {isSavingTarget && <Loader2 className="w-4 h-4 animate-spin" />}
                  目標を保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📦 出荷・売上記録モーダル */}
      {salesPlan && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-600" />
                  出荷・売上を記録
                </h3>
                <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                  {salesPlan.fieldName}・{salesPlan.cropName} の作付けに記録します
                </p>
              </div>
              <button type="button" onClick={() => setSalesPlan(null)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveSales} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">出荷日</label>
                  <input
                    type="date"
                    value={salesDate}
                    onChange={e => setSalesDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">出荷量（kg）</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.1"
                    value={salesQty}
                    onChange={e => setSalesQty(e.target.value)}
                    placeholder="例: 120"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-800 outline-none focus:ring-2 focus:ring-emerald-400"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">単価（円 / kg・任意）</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={salesUnitPrice}
                    onChange={e => {
                      setSalesUnitPrice(e.target.value);
                      setSalesTotal('');
                    }}
                    placeholder="例: 120"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">売上金額（円・任意）</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={salesTotal}
                    onChange={e => setSalesTotal(e.target.value)}
                    placeholder={computedSalesTotal > 0 ? String(computedSalesTotal) : '例: 14400'}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none"
                  />
                </div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-emerald-900">
                記録される売上：
                <span className="text-base font-black ml-1">{computedSalesTotal > 0 ? yen(computedSalesTotal) : '金額未定（出荷量のみ記録）'}</span>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">メモ（出荷先など・任意）</label>
                <input
                  type="text"
                  value={salesMemo}
                  onChange={e => setSalesMemo(e.target.value)}
                  placeholder="例: JA出荷、直売所 など"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={() => setSalesPlan(null)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer">
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSavingSales}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  {isSavingSales && <Loader2 className="w-4 h-4 animate-spin" />}
                  記録する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 明細ドロワー（工程別内訳・写真付き作業日報・出荷履歴） */}
      {detailReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex justify-end" onClick={() => setDetailPlanId(null)}>
          <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100 flex items-start justify-between gap-2 bg-slate-50">
              <div>
                <h3 className="text-base font-black text-slate-800">
                  {detailReport.fieldName}・{detailReport.cropName}
                </h3>
                <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                  集計期間: {detailReport.win.start.replace(/-/g, '/')} 〜 {detailReport.win.end.replace(/-/g, '/')}
                </p>
              </div>
              <button type="button" onClick={() => setDetailPlanId(null)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex border-b border-slate-200">
              {[
                { id: 'process', label: `⏱️ 工程・按分内訳` },
                { id: 'work', label: `📷 作業・日報 (${detailReport.works.length})` },
                { id: 'sales', label: `📦 出荷・売上 (${detailReport.sales.length})` }
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDetailTab(t.id as any)}
                  className={`flex-1 py-3 text-xs font-black border-b-2 cursor-pointer ${
                    detailTab === t.id ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-3">
              {detailTab === 'process' && (
                <div className="space-y-3">
                  {/* 3大カテゴリ集計 */}
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden text-sm">
                    <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 text-xs font-black text-slate-700">
                      1. 作業工程3分類と人件費按分
                    </div>
                    {[
                      {
                        label: `🟢 直接利益作業（播種・定植・収穫・出荷）`,
                        hours: detailReport.directCatHours,
                        cost: detailReport.directCatCost,
                        color: 'text-emerald-700'
                      },
                      {
                        label: `🟡 育成・維持管理作業`,
                        hours: detailReport.careCatHours,
                        cost: detailReport.careCatCost,
                        color: 'text-amber-700'
                      },
                      {
                        label: `🔴 準備・片付け等（この圃場の直接記録分）`,
                        hours: detailReport.prepCatHours,
                        cost: detailReport.prepCatCost,
                        color: 'text-rose-700'
                      },
                      {
                        label: `🌐 農園共通作業からの自動按分（${allocationMode === 'area' ? '面積比' : allocationMode === 'hours' ? '作業時間比' : '按分なし'}）`,
                        hours: detailReport.allocatedCommonHours,
                        cost: detailReport.allocatedCommonCost,
                        color: 'text-indigo-700'
                      }
                    ].map(row => (
                      <div key={row.label} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-600">{row.label}</span>
                        <div className="text-right">
                          <span className={`text-xs font-black ${row.color} block`}>{hoursLabel(row.hours)}</span>
                          <span className="text-[11px] font-bold text-slate-500">{yen(row.cost)}</span>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                      <span className="text-xs font-black text-slate-700">総労働時間 ・ 投入人件費合計</span>
                      <div className="text-right">
                        <span className="text-sm font-black text-rose-700 block">{hoursLabel(detailReport.workHours)} / {yen(detailReport.laborCost)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-xs font-black text-slate-700">売上 {yen(detailReport.actualSales)} − 人件費 ＝ 現場労働粗利</span>
                      <span className={`text-base font-black ${detailReport.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{yen(detailReport.profit)}</span>
                    </div>
                  </div>

                  {/* 作業内容別の詳細ランキング */}
                  {detailReport.processBreakdown.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                      <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 text-xs font-black text-slate-700">
                        2. 作業工程ごとの所要時間内訳
                      </div>
                      {detailReport.processBreakdown.map((p: any) => {
                        const meta = PROCESS_CATEGORY_META[p.category as keyof typeof PROCESS_CATEGORY_META] || PROCESS_CATEGORY_META.care;
                        return (
                          <div key={p.workType} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`px-2 py-0.5 text-[10px] font-black rounded-md border ${meta.badgeClass}`}>
                                {meta.shortLabel}
                              </span>
                              <span className="text-xs font-black text-slate-800 truncate">{p.workType}</span>
                              <span className="text-[10px] font-bold text-slate-400">({p.count}回)</span>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-xs font-black text-slate-900">{hoursLabel(p.hours)}</span>
                              <span className="text-[10px] font-bold text-slate-400 ml-1.5">({yen(p.cost)})</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {detailTab === 'work' &&
                (detailReport.works.length === 0 ? (
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center text-xs font-bold text-slate-500 space-y-2">
                    <p>この作付けの作業記録はまだありません。</p>
                    <Link href={diaryHref} className="inline-block px-4 py-2 bg-emerald-600 text-white rounded-xl font-black">
                      作業日誌を開く
                    </Link>
                  </div>
                ) : (
                  [...detailReport.works]
                    .sort((a: any, b: any) => String(b.work_date).localeCompare(String(a.work_date)))
                    .map((w: any) => {
                      const h = (Number(w.duration_minutes) || 0) / 60;
                      const wage = Number(w.workers?.hourly_wage) || 0;
                      const cat = classifyWorkProcess(w.work_type || w.task_title);
                      const meta = PROCESS_CATEGORY_META[cat];
                      return (
                        <div key={w.id} className="bg-white p-3.5 rounded-2xl border border-slate-200 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 flex-wrap">
                                <span>{String(w.work_date || '').replace(/-/g, '/')}</span>
                                {w.workers?.name && <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded">{w.workers.name}</span>}
                                <span className={`px-1.5 py-0.5 text-[10px] font-black rounded border ${meta.badgeClass}`}>
                                  {meta.shortLabel}
                                </span>
                              </div>
                              <div className="text-sm font-black text-slate-800 mt-1">{w.work_type || w.task_title || '作業'}</div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-xs font-black text-slate-800 flex items-center gap-1 justify-end">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {hoursLabel(h)}
                              </div>
                              <div className="text-[10px] font-bold text-slate-400">
                                {wage > 0 ? `時給${yen(wage)}` : `仮時給${yen(FALLBACK_HOURLY_WAGE)}`}
                              </div>
                            </div>
                          </div>
                          {w.memo && (
                            <p className="text-xs font-bold text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 whitespace-pre-line">
                              💬 {w.memo}
                            </p>
                          )}
                          {w.photo_url && (
                            <a href={w.photo_url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-slate-200">
                              <img src={w.photo_url} alt="作業日報写真" className="w-full h-36 object-cover hover:opacity-90 transition-opacity" />
                            </a>
                          )}
                        </div>
                      );
                    })
                ))}

              {detailTab === 'sales' && (
                <>
                  <button
                    type="button"
                    onClick={() => openSalesModal(detailReport)}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Package className="w-4 h-4" />
                    出荷・売上を記録する
                  </button>
                  {detailReport.sales.length === 0 ? (
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center text-xs font-bold text-slate-500">
                      この作付けの出荷・売上はまだ記録されていません。
                    </div>
                  ) : (
                    [...detailReport.sales]
                      .sort((a: any, b: any) => String(b.sales_date).localeCompare(String(a.sales_date)))
                      .map((s: any) => (
                        <div key={s.id} className="bg-white p-3 rounded-xl border border-slate-200 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[11px] font-bold text-slate-500">{String(s.sales_date || '').replace(/-/g, '/')}</div>
                            <div className="text-sm font-black text-slate-800">
                              {s.quantity} {s.unit || 'kg'}
                            </div>
                            {s.memo && <div className="text-[11px] font-bold text-slate-500 truncate">{s.memo}</div>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm font-black text-emerald-700">
                              {s.total_sales ? yen(Number(s.total_sales)) : '金額未定'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteSales(s.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title="削除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminOnlyGuard>
  );
}
