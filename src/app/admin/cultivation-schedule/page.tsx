"use client";

/**
 * 栽培計画・予実（作付け別の採算ボード）
 *
 * 役割分担:
 *  - 作付けの日程（いつ・どの畑で・何を育てるか）の登録・変更 →「作付け・作業日誌」(/admin/cultivations) に一本化
 *  - 本画面 → 登録済みの作付けごとに「目標 vs 実績（収量・売上）」「かかった費用」「残った所得」を答え合わせする
 *
 * 集計の根拠（すべて実データ）:
 *  - 作業時間・人件費: work_logs（plan_id一致 または 同じ圃場×作目×栽培期間内）× workers.hourly_wage
 *  - 資材費: work_logs.material_quantity × materials.default_price ＋ material_costs（同じ作目×期間内×品目名に圃場名を含む）
 *  - 光熱・機械・その他: monthly_expenses の実費を面積で按分（実費の無い月のみ作目マスタの概算値を使用し、その旨を表示）
 *  - 収量・売上: sales_logs（plan_id一致 または 同じ圃場×作目×栽培期間〜終了1ヶ月後）
 *  - 目標収量・目標単価: cultivation_plans_v2.variety 内のメタ情報（||META: ty / tp）に保存（DB構造の変更なし）
 */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '@/lib/tenant';
import { getJSTDate } from '@/lib/dateUtils';
import { AdminOnlyGuard } from '@/components/AdminOnlyGuard';
import { getTenantCultivationPlansAction, saveTenantCultivationPlanAction, getCultivationSchedulePageDataAction } from '@/app/actions/farm';
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
  Wallet
} from 'lucide-react';

// 時給が未設定の作業者に使う仮の時給（画面上で必ず明示する）
const FALLBACK_HOURLY_WAGE = 1000;

type MetaObj = Record<string, any>;

// variety カラムの「品種名 ||META:{...}」を分解
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

// 作付けの集計対象期間（育苗開始月〜収穫完了月の月末）
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

  // 売上は収穫完了後の出荷も含めるため、終了月の翌月末まで
  const salesEndM = em === 12 ? 1 : em + 1;
  const salesEndY = em === 12 ? endY + 1 : endY;

  return {
    start: `${startY}-${pad2(startM)}-01`,
    end: `${endY}-${pad2(em)}-${pad2(lastDayOf(endY, em))}`,
    salesEnd: `${salesEndY}-${pad2(salesEndM)}-${pad2(lastDayOf(salesEndY, salesEndM))}`,
    months: (() => {
      const list: string[] = [];
      let cy = startY;
      let cm = startM;
      for (let i = 0; i < 24; i++) {
        list.push(`${cy}-${pad2(cm)}`);
        if (cy === endY && cm === em) break;
        cm++;
        if (cm > 12) {
          cm = 1;
          cy++;
        }
      }
      return list;
    })()
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
  const [materialCosts, setMaterialCosts] = useState<any[]>([]);
  const [monthlyExpenses, setMonthlyExpenses] = useState<any[]>([]);

  const [cropFilter, setCropFilter] = useState<string>('all');
  const [sortMode, setSortMode] = useState<'profit' | 'area' | 'progress' | 'field'>('profit');

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
  const [detailTab, setDetailTab] = useState<'cost' | 'work' | 'sales'>('cost');

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
        setMaterialCosts(pageRes.materialCosts || []);
        setMonthlyExpenses(pageRes.monthlyExpenses || []);
      } else {
        // フォールバック: クライアント直接取得
        const rangeStart = `${year - 1}-01-01`;
        const rangeEnd = `${year + 1}-12-31`;

        const [fRes, cRes, pRes, wRes, sRes, mcRes, expRes] = await Promise.all([
          supabase.from('fields').select('*').eq('user_id', tid).order('name'),
          supabase.from('crops').select('*').eq('user_id', tid).order('name'),
          getTenantCultivationPlansAction(tid, year),
          supabase
            .from('work_logs')
            .select('*, workers(name, hourly_wage), materials(name, default_price, category, unit)')
            .eq('user_id', tid)
            .gte('work_date', rangeStart)
            .lte('work_date', rangeEnd),
          supabase.from('sales_logs').select('*').eq('user_id', tid).gte('sales_date', rangeStart).lte('sales_date', rangeEnd),
          supabase.from('material_costs').select('*').eq('user_id', tid).gte('expense_date', rangeStart).lte('expense_date', rangeEnd),
          supabase.from('monthly_expenses').select('*').eq('user_id', tid)
        ]);

        if (!pRes.success) throw new Error(pRes.error || '計画取得エラー');
        if (wRes.error) throw wRes.error;
        if (sRes.error) throw sRes.error;

        setFields(fRes.data || []);
        setCrops(cRes.data || []);
        setPlans(pRes.data || []);
        setWorkLogs(wRes.data || []);
        setSalesLogs(sRes.data || []);
        setMaterialCosts(mcRes.error ? [] : mcRes.data || []);
        setMonthlyExpenses(expRes.error ? [] : expRes.data || []);
      }
    } catch (err: any) {
      console.error(err);
      setLoadError('データの読み込みに失敗しました。通信環境をご確認のうえ「再読み込み」を押してください。');
    } finally {
      setIsLoading(false);
    }
  };

  const totalFarmArea = useMemo(
    () => fields.reduce((sum, f) => sum + (Number(f.area_size) || 0), 0),
    [fields]
  );

  // --- 作付けごとの予実・採算レポート ---
  const planReports = useMemo(() => {
    return plans.map(plan => {
      const { clean: varietyName, meta } = parsePlanMeta(plan.variety);
      const field = fields.find(f => f.id === plan.field_id);
      const crop = plan.crops || crops.find(c => c.id === plan.crop_id);
      const fieldName = field?.name || '圃場未設定';
      const cropName = crop?.name || '作目未設定';
      const areaRaw = Number(field?.area_size) || Number(plan.calculated_area) || 0;
      const hasArea = areaRaw > 0;
      const win = getPlanWindow(plan, meta);

      // 1. 作業記録（予定・差し戻しは除外）
      const pWorks = workLogs.filter(w => {
        if (w.status === 'planned' || w.approval_status === 'rejected') return false;
        if (w.plan_id) return w.plan_id === plan.id;
        if (w.field_id !== plan.field_id) return false;
        if (w.crop_id && w.crop_id !== plan.crop_id) return false;
        const d = String(w.work_date || '');
        return d >= win.start && d <= win.end;
      });

      let workHours = 0;
      let laborCost = 0;
      let fallbackWageCount = 0;
      let workMaterialCost = 0;
      pWorks.forEach(w => {
        const h = (Number(w.duration_minutes) || 0) / 60;
        workHours += h;
        const wage = Number(w.workers?.hourly_wage) || 0;
        if (wage > 0) {
          laborCost += h * wage;
        } else {
          laborCost += h * FALLBACK_HOURLY_WAGE;
          if (h > 0) fallbackWageCount++;
        }
        if (w.material_quantity && w.materials?.default_price) {
          workMaterialCost += Number(w.material_quantity) * Number(w.materials.default_price);
        }
      });

      // 2. 資材経費（material_costs：圃場名が品目名に含まれ、同じ作目・期間内のもの）
      const pMatCosts = materialCosts.filter(mc => {
        if (mc.crop_id && mc.crop_id !== plan.crop_id) return false;
        const d = String(mc.expense_date || '');
        if (d < win.start || d > win.end) return false;
        return field?.name ? String(mc.item_name || '').includes(field.name) : false;
      });
      const extraMaterialCost = pMatCosts.reduce((s, mc) => s + (Number(mc.amount) || 0), 0);
      const materialCost = workMaterialCost + extraMaterialCost;

      // 3. 光熱・機械・その他（月次実費の面積按分／実費の無い月は作目マスタの概算）
      const areaRatio = totalFarmArea > 0 && hasArea ? areaRaw / totalFarmArea : 0;
      const monthsCount = win.months.length || 1;
      const estFuel = ((Number(crop?.est_fuel_cost_10a) || 0) * (areaRaw / 10)) / monthsCount;
      const estMachine = ((Number(crop?.est_machinery_cost_10a) || 0) * (areaRaw / 10)) / monthsCount;
      const estOther = ((Number(crop?.est_other_cost_10a) || 0) * (areaRaw / 10)) / monthsCount;
      let overheadCost = 0;
      let overheadActualMonths = 0;
      let overheadEstimatedMonths = 0;
      win.months.forEach(mStr => {
        const rows = monthlyExpenses.filter(e => e.month === mStr);
        if (rows.length > 0) {
          const sum = rows
            .filter(e => ['fuel', 'machinery', 'other'].includes(e.expense_type))
            .reduce((s, e) => s + (Number(e.amount) || 0), 0);
          overheadCost += sum * areaRatio;
          overheadActualMonths++;
        } else {
          const est = estFuel + estMachine + estOther;
          if (est > 0) overheadEstimatedMonths++;
          overheadCost += est;
        }
      });

      // 4. 出荷・売上
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

      // 5. 目標
      const targetYieldKg = Number(meta.ty) || 0;
      const targetUnitPrice = Number(meta.tp) || 0;
      const targetSales = targetYieldKg > 0 && targetUnitPrice > 0 ? targetYieldKg * targetUnitPrice : 0;

      const totalCost = laborCost + materialCost + overheadCost;
      const profit = actualSales - totalCost;
      const profitPer10a = hasArea ? profit * (10 / areaRaw) : null;
      const profitPerHour = workHours > 0 ? profit / workHours : null;
      const yieldProgress = targetYieldKg > 0 ? Math.round((actualYieldKg / targetYieldKg) * 100) : null;
      const salesProgress = targetSales > 0 ? Math.round((actualSales / targetSales) * 100) : null;

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
        matCosts: pMatCosts,
        workHours,
        laborCost,
        fallbackWageCount,
        workMaterialCost,
        extraMaterialCost,
        materialCost,
        overheadCost,
        overheadActualMonths,
        overheadEstimatedMonths,
        actualYieldKg,
        actualSales,
        nonKgCount,
        targetYieldKg,
        targetUnitPrice,
        targetSales,
        totalCost,
        profit,
        profitPer10a,
        profitPerHour,
        yieldProgress,
        salesProgress
      };
    });
  }, [plans, fields, crops, workLogs, salesLogs, materialCosts, monthlyExpenses, totalFarmArea]);

  const visibleReports = useMemo(() => {
    const list = planReports.filter(r => cropFilter === 'all' || r.cropId === cropFilter);
    return [...list].sort((a, b) => {
      if (sortMode === 'area') return b.areaRaw - a.areaRaw;
      if (sortMode === 'progress') return (b.salesProgress ?? b.yieldProgress ?? -1) - (a.salesProgress ?? a.yieldProgress ?? -1);
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
        acc.cost += r.totalCost;
        acc.hours += r.workHours;
        acc.targetYield += r.targetYieldKg;
        acc.actualYield += r.actualYieldKg;
        if (r.targetSales <= 0) acc.noTargetCount++;
        return acc;
      },
      { area: 0, targetSales: 0, actualSales: 0, cost: 0, hours: 0, targetYield: 0, actualYield: 0, noTargetCount: 0 }
    );
    const profit = s.actualSales - s.cost;
    return {
      ...s,
      profit,
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
  // 左メニューと同じ入口へ直接移動するリンク（?farm= を必ず引き継ぐ）
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
        {/* ヘッダー */}
        <header className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2.5">
                <TrendingUp className="w-7 h-7 text-blue-600" />
                <span>作付けごとの収支（予実）</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-bold mt-1">
                作付けごとに「目標に対して、どれだけ穫れて・売れて・お金がかかり・いくら残ったか」を答え合わせする画面です。
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200 text-xs font-black">
                <button type="button" onClick={() => setYear(y => y - 1)} className="px-2 py-1.5 text-slate-600 hover:text-slate-900 cursor-pointer flex items-center">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 bg-white text-blue-700 rounded-lg shadow-2xs">{year}年度</span>
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

          {/* 役割分担の案内 */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs font-bold text-blue-900 leading-relaxed">
              💡 <span className="font-black">作付けの日程（いつ・どの畑で・何を育てるか）</span>の登録や変更は
              <span className="font-black">「作付けこよみ（計画）」</span>、日々の作業・防除・施肥の記録は<span className="font-black">「作業日誌」</span>で行います。ここではその結果を、お金と収量で確認します。
            </p>
            <Link
              href={calendarHref}
              className="shrink-0 w-full sm:w-auto justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm"
            >
              <Calendar className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap">作付けの日程を登録・変更する</span>
            </Link>
          </div>
        </header>

        {isLoading ? (
          <div className="bg-white p-16 rounded-3xl border border-slate-200 flex flex-col items-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-xs font-bold">作付けごとの収量・売上・費用を集計しています...</p>
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
              「作付けこよみ（計画）」で、畑と作目・日程を登録すると、ここに作付けごとの収支が自動で表示されます。
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
            {/* 農園全体サマリー */}
            <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 block">🌱 作付け数・面積</span>
                <div className="text-lg font-black text-slate-900 mt-0.5">
                  {visibleReports.length}件 <span className="text-xs font-bold text-slate-500">({Math.round(summary.area * 10) / 10}a)</span>
                </div>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[11px] font-bold text-slate-400 block">💰 売上（実績 / 目標）</span>
                <div className="text-lg font-black text-slate-900">{yen(summary.actualSales)}</div>
                <div className="text-[11px] font-bold text-slate-500">
                  目標 {summary.targetSales > 0 ? yen(summary.targetSales) : '未設定'}
                  {summary.salesProgress !== null && <span className="ml-1 text-blue-700">（{summary.salesProgress}%）</span>}
                </div>
                <ProgressBar value={summary.salesProgress} />
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 block">💸 かかった費用（概算）</span>
                <div className="text-lg font-black text-rose-700 mt-0.5">{yen(summary.cost)}</div>
                <div className="text-[11px] font-bold text-slate-500">人件費・資材費・光熱/機械など</div>
              </div>
              <div className={`p-4 rounded-2xl border shadow-2xs ${summary.profit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                <span className="text-[11px] font-bold text-slate-500 block">📈 残ったお金（所得・概算）</span>
                <div className={`text-lg font-black mt-0.5 ${summary.profit >= 0 ? 'text-emerald-800' : 'text-rose-700'}`}>{yen(summary.profit)}</div>
                <div className="text-[11px] font-bold text-slate-500">売上 − 費用</div>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs col-span-2 lg:col-span-1">
                <span className="text-[11px] font-bold text-slate-400 block">⏱️ 1時間あたりの所得</span>
                <div className="text-lg font-black text-slate-900 mt-0.5">
                  {summary.profitPerHour !== null ? yen(summary.profitPerHour) : '—'}
                </div>
                <div className="text-[11px] font-bold text-slate-500">作業 {hoursLabel(summary.hours)}</div>
              </div>
            </section>

            {summary.noTargetCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-amber-900 flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  {summary.noTargetCount}件の作付けで目標（収穫量・単価）が未設定です。各カードの「🎯 目標を設定」から入れると、達成率が表示されます。
                </span>
              </div>
            )}

            {/* 絞り込み・並び替え */}
            <section className="bg-white p-3.5 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <span className="text-[11px] font-black text-slate-400 mr-1 shrink-0">作目:</span>
                <button
                  type="button"
                  onClick={() => setCropFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap cursor-pointer ${
                    cropFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                      cropFilter === c.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                  <option value="profit">残ったお金が多い順</option>
                  <option value="progress">達成率が高い順</option>
                  <option value="area">面積が広い順</option>
                  <option value="field">圃場名順</option>
                </select>
              </div>
            </section>

            {/* 作付けごとの採算カード */}
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
                    <div className={`shrink-0 text-right px-2.5 sm:px-3 py-2 rounded-2xl border ${r.profit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                      <span className="text-[10px] font-bold text-slate-500 block whitespace-nowrap">残ったお金（概算）</span>
                      <span className={`text-sm sm:text-base font-black ${r.profit >= 0 ? 'text-emerald-800' : 'text-rose-700'}`}>{yen(r.profit)}</span>
                    </div>
                  </div>

                  {/* 予実 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1.5">
                      <span className="text-[11px] font-black text-slate-500 block">🧺 収穫量</span>
                      <div className="text-sm font-black text-slate-900">{kg(r.actualYieldKg)}</div>
                      <div className="text-[11px] font-bold text-slate-500">
                        目標 {r.targetYieldKg > 0 ? kg(r.targetYieldKg) : '未設定'}
                        {r.yieldProgress !== null && <span className="ml-1 text-blue-700">（{r.yieldProgress}%）</span>}
                      </div>
                      <ProgressBar value={r.yieldProgress} />
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1.5">
                      <span className="text-[11px] font-black text-slate-500 block">💰 売上</span>
                      <div className="text-sm font-black text-slate-900">{yen(r.actualSales)}</div>
                      <div className="text-[11px] font-bold text-slate-500">
                        目標 {r.targetSales > 0 ? yen(r.targetSales) : '未設定'}
                        {r.salesProgress !== null && <span className="ml-1 text-blue-700">（{r.salesProgress}%）</span>}
                      </div>
                      <ProgressBar value={r.salesProgress} />
                    </div>
                  </div>

                  {/* 費用内訳 */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="grid grid-cols-3 text-center divide-x divide-slate-200 bg-white">
                      <div className="px-1.5 py-2 sm:p-2.5 min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 block truncate">👷 人件費</span>
                        <span className="text-[11px] sm:text-xs font-black text-slate-800 block truncate">{yen(r.laborCost)}</span>
                        <span className="text-[10px] font-bold text-slate-400 block truncate">{hoursLabel(r.workHours)}</span>
                      </div>
                      <div className="px-1.5 py-2 sm:p-2.5 min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 block truncate">🧪 資材費</span>
                        <span className="text-[11px] sm:text-xs font-black text-slate-800 block truncate">{yen(r.materialCost)}</span>
                        <span className="text-[10px] font-bold text-slate-400 block truncate">農薬・肥料など</span>
                      </div>
                      <div className="px-1.5 py-2 sm:p-2.5 min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 block truncate">⛽ 光熱・機械等</span>
                        <span className="text-[11px] sm:text-xs font-black text-slate-800 block truncate">{yen(r.overheadCost)}</span>
                        <span className="text-[10px] font-bold text-slate-400 block truncate">面積で按分</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 text-center divide-x divide-slate-200 bg-slate-50 border-t border-slate-200">
                      <div className="px-1.5 py-2 sm:p-2 min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 block truncate">費用合計</span>
                        <span className="text-[11px] sm:text-xs font-black text-rose-700 block truncate">{yen(r.totalCost)}</span>
                      </div>
                      <div className="px-1.5 py-2 sm:p-2 min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 block truncate">10aあたり所得</span>
                        <span className="text-[11px] sm:text-xs font-black text-slate-800 block truncate">{r.profitPer10a !== null ? yen(r.profitPer10a) : '面積未設定'}</span>
                      </div>
                      <div className="px-1.5 py-2 sm:p-2 min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 block truncate">1時間あたり所得</span>
                        <span className="text-[11px] sm:text-xs font-black text-slate-800 block truncate">{r.profitPerHour !== null ? yen(r.profitPerHour) : '作業記録なし'}</span>
                      </div>
                    </div>
                  </div>

                  {/* 注意書き（推定値を隠さない） */}
                  {(r.fallbackWageCount > 0 || r.overheadEstimatedMonths > 0 || r.sales.length === 0 || r.nonKgCount > 0) && (
                    <ul className="space-y-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                      {r.sales.length === 0 && <li>・出荷・売上がまだ記録されていません（下の「📦 出荷・売上を記録」から入力できます）</li>}
                      {r.fallbackWageCount > 0 && (
                        <li>・時給が未設定の作業者の記録が{r.fallbackWageCount}件あり、仮に時給{yen(FALLBACK_HOURLY_WAGE)}で計算しています（マスタ管理で時給を設定すると正確になります）</li>
                      )}
                      {r.overheadEstimatedMonths > 0 && (
                        <li>・光熱・機械等は、実費の無い{r.overheadEstimatedMonths}ヶ月分を作目マスタの概算値で計算しています</li>
                      )}
                      {r.nonKgCount > 0 && <li>・kg以外の単位の出荷が{r.nonKgCount}件あり、収穫量には含めていません</li>}
                    </ul>
                  )}

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
                        setDetailTab('cost');
                      }}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer"
                    >
                      <Wallet className="w-3.5 h-3.5" />
                      明細を見る
                    </button>
                    <a
                      href={`/admin/report/${r.plan.id}${farmQuery}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black flex items-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      PDFレポート
                    </a>
                    <Link
                      href={calendarHref}
                      className="ml-auto px-3 py-2 text-blue-700 hover:bg-blue-50 rounded-xl text-xs font-black flex items-center gap-1"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      日程を変更
                    </Link>
                  </div>
                </article>
              ))}
            </section>

            {visibleReports.length === 0 && (
              <div className="bg-white p-10 rounded-3xl border border-slate-200 text-center space-y-2">
                <p className="text-sm font-black text-slate-700">この作目の作付けは見つかりませんでした。</p>
                <button type="button" onClick={() => setCropFilter('all')} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black cursor-pointer">
                  すべての作目を表示する
                </button>
              </div>
            )}
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
                <p className="text-[10px] font-bold text-emerald-700 mt-0.5">※金額が後で決まる場合は空欄のままで大丈夫です。</p>
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

      {/* 明細ドロワー */}
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
                  （出荷は {detailReport.win.salesEnd.replace(/-/g, '/')} まで）
                </p>
              </div>
              <button type="button" onClick={() => setDetailPlanId(null)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex border-b border-slate-200">
              {[
                { id: 'cost', label: `💸 費用の内訳` },
                { id: 'work', label: `👷 作業 (${detailReport.works.length})` },
                { id: 'sales', label: `📦 出荷・売上 (${detailReport.sales.length})` }
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDetailTab(t.id as any)}
                  className={`flex-1 py-3 text-xs font-black border-b-2 cursor-pointer ${
                    detailTab === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-3">
              {detailTab === 'cost' && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden text-sm">
                  {[
                    { label: `👷 人件費（作業 ${hoursLabel(detailReport.workHours)}）`, value: detailReport.laborCost },
                    { label: '🧪 資材費（作業記録の使用資材）', value: detailReport.workMaterialCost },
                    { label: `🧾 資材費（資材経費の記録 ${detailReport.matCosts.length}件）`, value: detailReport.extraMaterialCost },
                    {
                      label: `⛽ 光熱・機械等（実費${detailReport.overheadActualMonths}ヶ月・概算${detailReport.overheadEstimatedMonths}ヶ月）`,
                      value: detailReport.overheadCost
                    }
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-600">{row.label}</span>
                      <span className="text-sm font-black text-slate-800">{yen(row.value)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                    <span className="text-xs font-black text-slate-700">費用合計</span>
                    <span className="text-base font-black text-rose-700">{yen(detailReport.totalCost)}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-xs font-black text-slate-700">売上 {yen(detailReport.actualSales)} − 費用 ＝ 残ったお金</span>
                    <span className={`text-base font-black ${detailReport.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{yen(detailReport.profit)}</span>
                  </div>
                </div>
              )}

              {detailTab === 'work' &&
                (detailReport.works.length === 0 ? (
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center text-xs font-bold text-slate-500 space-y-2">
                    <p>この作付けの作業記録はまだありません。</p>
                    <Link href={diaryHref} className="inline-block px-4 py-2 bg-blue-600 text-white rounded-xl font-black">
                      作業日誌で記録する
                    </Link>
                  </div>
                ) : (
                  [...detailReport.works]
                    .sort((a: any, b: any) => String(b.work_date).localeCompare(String(a.work_date)))
                    .map((w: any) => {
                      const h = (Number(w.duration_minutes) || 0) / 60;
                      const wage = Number(w.workers?.hourly_wage) || 0;
                      return (
                        <div key={w.id} className="bg-white p-3 rounded-xl border border-slate-200 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                              <span>{String(w.work_date || '').replace(/-/g, '/')}</span>
                              {w.workers?.name && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">{w.workers.name}</span>}
                            </div>
                            <div className="text-sm font-black text-slate-800 truncate">{w.work_type || w.task_title || '作業'}</div>
                            {w.materials?.name && w.material_quantity ? (
                              <div className="text-[11px] font-bold text-rose-700">
                                🧪 {w.materials.name} {w.material_quantity}
                                {w.materials.unit || ''}
                              </div>
                            ) : null}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs font-black text-slate-800 flex items-center gap-1 justify-end">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {hoursLabel(h)}
                            </div>
                            <div className="text-[10px] font-bold text-slate-400">
                              {wage > 0 ? `時給${yen(wage)}` : `時給未設定（仮${yen(FALLBACK_HOURLY_WAGE)}）`}
                            </div>
                          </div>
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
                              {Number(s.quantity) || 0}
                              {s.unit || 'kg'}
                            </div>
                            {s.memo && <div className="text-[11px] font-bold text-slate-500 truncate">{s.memo}</div>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm font-black text-emerald-700">
                              {s.total_sales !== null && s.total_sales !== undefined ? yen(Number(s.total_sales)) : '金額未定'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteSales(s.id)}
                              className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title="この記録を削除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

      {toast && (
        <div className="fixed top-20 right-6 z-[60] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl text-xs font-black">
          {toast}
        </div>
      )}
    </AdminOnlyGuard>
  );
}
