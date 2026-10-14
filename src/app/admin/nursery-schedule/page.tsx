"use client";

/**
 * 育苗スケジュール
 * - 「作付けこよみ（計画）」の植え付け時期と、作目マスタの育苗基準から
 *   「いつ・何枚のトレイに・何粒まくか」を自動で計算する。
 * - 実績（種まき・鉢上げ・植え付け）はボタンで記録し、その場で保存する。
 * - 推測の数字は使わない。マスタが未設定の項目は「未設定」と正直に表示する。
 *
 * 保存先: nursery_schedules_v2.schedule_data
 *   _records : [{ id, type: 'sowing'|'potting'|'planting', date: 'YYYY-MM-DD', qty, memo }]
 *   _loss_rate : 予備（%）
 *   _sow_date : まく日を手で変えた場合の日付（無ければ自動計算）
 *   ※ 旧形式（"YYYY-MM-DD": { quantity, type }）は消さずに残し、_records が無い間は記録として読み替える
 */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '@/lib/tenant';
import { getJSTDate } from '@/lib/dateUtils';
import { HelpTooltip } from '@/components/HelpTooltip';
import {
  Sprout,
  Loader2,
  Info,
  ChevronLeft,
  ChevronRight,
  Calendar,
  RefreshCw,
  X,
  Printer,
  AlertTriangle,
  Check,
  Trash2,
  Settings,
  Table,
  Calculator,
  Layers
} from 'lucide-react';

type RecordType = 'sowing' | 'germination' | 'potting' | 'planting';
type SeasonKey = 'spring' | 'summer' | 'autumn' | 'winter';
interface NurseryRecord {
  id: string;
  type: RecordType;
  date: string;
  qty: number;
  memo?: string;
}

const RECORD_LABEL: Record<RecordType, string> = { sowing: '種まき', germination: '発芽（芽が出た）', potting: '鉢上げ', planting: '植え付け' };
const RECORD_DONE_LABEL: Record<RecordType, string> = { sowing: 'まいた', germination: '芽が出た', potting: '鉢上げした', planting: '植えた' };
const RECORD_UNIT: Record<RecordType, string> = { sowing: '粒', germination: '本', potting: '本', planting: '本' };
const SEASON_LABEL: Record<SeasonKey, string> = { spring: '春植え（3〜5月）', summer: '夏植え（6〜8月）', autumn: '秋植え（9〜11月）', winter: '冬植え（12〜2月）' };
const SEASON_SHORT: Record<SeasonKey, string> = { spring: '🌸春植え', summer: '🌻夏植え', autumn: '🍁秋植え', winter: '❄️冬植え' };
const getSeasonByMonth = (m: number): SeasonKey => (m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter');

// ---------- 日付ユーティリティ（すべて 'YYYY-MM-DD' の文字列で扱う） ----------
const pad2 = (n: number) => String(n).padStart(2, '0');
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseDate = (s?: string | null): Date | null => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};
const addDays = (s: string, n: number) => {
  const d = parseDate(s) as Date;
  d.setDate(d.getDate() + n);
  return toDateStr(d);
};
const diffDays = (from?: string | null, to?: string | null): number | null => {
  const d1 = parseDate(from);
  const d2 = parseDate(to);
  if (!d1 || !d2) return null;
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
};
const WEEK_JA = ['日', '月', '火', '水', '木', '金', '土'];
const fmtMD = (s?: string | null) => {
  const d = parseDate(s);
  return d ? `${d.getMonth() + 1}/${d.getDate()}(${WEEK_JA[d.getDay()]})` : '—';
};
const mondayOf = (s: string) => {
  const d = parseDate(s) as Date;
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toDateStr(d);
};
const toNum = (v: any): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};
const fmtN = (n: number | null | undefined) => (n === null || n === undefined ? '—' : Math.round(n).toLocaleString());
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// variety カラムの「品種名 ||META:{...}」を分解
const parsePlanMeta = (raw: string | null | undefined) => {
  const str = String(raw || '');
  const idx = str.indexOf('||META:');
  if (idx === -1) return { clean: str.trim(), meta: {} as Record<string, any> };
  let meta: Record<string, any> = {};
  try {
    meta = JSON.parse(str.slice(idx + 7).trim()) || {};
  } catch {
    meta = {};
  }
  return { clean: str.slice(0, idx).trim(), meta };
};
const termLabel = (t?: number) => (t === 2 ? '中旬' : t === 3 ? '下旬' : '上旬');
// 旬の代表日（「ごろ」表示に使う。定植日が登録されていればそちらを優先）
const termDay = (t?: number) => (t === 2 ? 15 : t === 3 ? 25 : 5);

// 記録の読み込み（旧形式も読み替え。元データは消さない）
const readRecords = (sd: any): NurseryRecord[] => {
  if (!sd || typeof sd !== 'object') return [];
  if (Array.isArray(sd._records)) {
    return sd._records
      .filter((r: any) => r && ['sowing', 'germination', 'potting', 'planting'].includes(r.type) && r.date)
      .map((r: any) => ({
        id: String(r.id || newId()),
        type: r.type as RecordType,
        date: String(r.date).slice(0, 10),
        qty: Number(r.qty) || 0,
        memo: r.memo ? String(r.memo) : ''
      }));
  }
  return Object.entries(sd)
    .filter(([k, v]: [string, any]) => !k.startsWith('_') && /^\d{4}-\d{2}-\d{2}$/.test(k) && v && typeof v === 'object' && ['sowing', 'germination', 'potting', 'planting'].includes(v.type))
    .map(([k, v]: [string, any]) => ({
      id: `legacy-${k}-${v.type}`,
      type: v.type as RecordType,
      date: k,
      qty: Number(String(v.quantity ?? '').replace(/[^0-9.]/g, '')) || 0,
      memo: '以前の表から引き継いだ記録'
    }));
};

interface Row {
  plan: any;
  std: any | null;
  schedule: any | null;
  cropId: string;
  cropName: string;
  variety: string;
  fieldName: string;
  areaA: number | null;
  spp: number | null;
  needed: number | null;
  neededFromSaved: boolean;
  lossRate: number;
  withSpare: number | null;
  germRate: number | null;
  seedsPerCell: number | null;
  cells: number | null;
  seeds: number | null;
  trayCells: number | null;
  trays: number | null;
  nurseryDays: number | null;
  nurserySeasonUsed: SeasonKey | null;
  pottingDays: number | null;
  germDays: number | null;
  plantMonth: number;
  plantSeason: SeasonKey | null;
  plantDate: string | null;
  plantDateExact: boolean;
  plantLabel: string;
  sowPlanned: string | null;
  sowManual: boolean;
  records: NurseryRecord[];
  sownQty: number;
  germQty: number;
  pottedQty: number;
  plantedQty: number;
  firstSow: string | null;
  firstGerm: string | null;
  firstPlant: string | null;
  actualGermRate: number | null;
  actualGermDays: number | null;
  actualNurseryDays: number | null;
  sowBase: string | null;
  germCheck: string | null;
  pottingPlanned: string | null;
  missing: string[];
}

interface TaskItem {
  key: string;
  date: string;
  kind: RecordType | 'germ';
  row: Row;
  overdue: boolean;
}

export default function NurserySchedulePage() {
  const [farmId, setFarmId] = useState<string>('');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [plans, setPlans] = useState<any[]>([]);
  const [standards, setStandards] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [standardColumnsReady, setStandardColumnsReady] = useState(true);

  const [groupMode, setGroupMode] = useState<'sow' | 'crop' | 'field'>('sow');
  const [showWeekTable, setShowWeekTable] = useState(false);
  const [weekStart, setWeekStart] = useState<string>(() => addDays(mondayOf(getJSTDate()), -14));

  // 記録モーダル
  const [recordTarget, setRecordTarget] = useState<{ row: Row; type: RecordType } | null>(null);
  const [recordDate, setRecordDate] = useState<string>(() => getJSTDate());
  const [recordQty, setRecordQty] = useState<string>('');
  const [recordMemo, setRecordMemo] = useState<string>('');

  // 設定モーダル（予備・まく日の手動変更）
  const [settingsRow, setSettingsRow] = useState<Row | null>(null);
  const [settingsLoss, setSettingsLoss] = useState<string>('10');
  const [settingsSowDate, setSettingsSowDate] = useState<string>('');

  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const today = getJSTDate();
  const farmPrefix = farmId ? `farm=${farmId}&` : '';
  const planCalendarHref = `/admin/cultivations?${farmPrefix}tab=cultivations&focus=calendar`;
  const mastersHref = `/admin/masters${farmId ? `?farm=${farmId}` : ''}`;

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
      const tenantId = await getCurrentTenantId();
      if (!tenantId) {
        setLoadError('農園の情報が確認できませんでした。お手数ですが、もう一度ログインしてください。');
        return;
      }
      setFarmId(tenantId);

      // 自社のこの年度の作付け（作付けこよみで登録したもの）
      const { data: plansData, error: plansErr } = await supabase
        .from('cultivation_plans_v2')
        .select('*, fields(*), crops(name)')
        .eq('user_id', tenantId)
        .eq('year', year);
      if (plansErr) throw plansErr;
      const fetchedPlans = plansData || [];

      // 作目ごとの基準（自社の作目に限定）
      const cropIds = Array.from(new Set(fetchedPlans.map((p: any) => p.crop_id).filter(Boolean)));
      let fetchedStandards: any[] = [];
      if (cropIds.length > 0) {
        const { data: stdData, error: stdErr } = await supabase.from('crop_standards').select('*').in('crop_id', cropIds);
        if (stdErr) console.error('crop_standards fetch error:', stdErr);
        fetchedStandards = stdData || [];
      }
      // 育苗基準の列があるか（SQL実行済みか）を、取得できた行の項目で判定
      setStandardColumnsReady(fetchedStandards.length === 0 || fetchedStandards.some(s => 'nursery_days' in s));

      // 育苗の記録
      let fetchedSchedules: any[] = [];
      if (fetchedPlans.length > 0) {
        const { data: schData, error: schErr } = await supabase
          .from('nursery_schedules_v2')
          .select('*')
          .eq('user_id', tenantId)
          .in('plan_id', fetchedPlans.map((p: any) => p.id));
        if (schErr) throw schErr;
        fetchedSchedules = schData || [];
      }

      setPlans(fetchedPlans);
      setStandards(fetchedStandards);
      setSchedules(fetchedSchedules);
    } catch (err: any) {
      console.error(err);
      setLoadError('育苗のデータを読み込めませんでした。通信状態を確認して「再読み込み」を押してください。');
    } finally {
      setIsLoading(false);
    }
  };

  // ---------- 作付けごとの計算 ----------
  const rows: Row[] = useMemo(() => {
    return plans.map((plan: any) => {
      const { clean, meta } = parsePlanMeta(plan.variety);
      const std = standards.find(s => s.crop_id === plan.crop_id && !s.variety) || standards.find(s => s.crop_id === plan.crop_id) || null;
      const schedule = schedules.find(s => s.plan_id === plan.id) || null;
      const sd = schedule?.schedule_data || {};

      const field = plan.fields || null;
      const areaA = Number(field?.area_size) > 0
        ? Number(field.area_size)
        : Number(field?.area_sqm) > 0
          ? Math.round((Number(field.area_sqm) / 100) * 10) / 10
          : Number(plan.calculated_area) > 0
            ? Number(plan.calculated_area)
            : null;

      const spp = Number(std?.seedlings_per_10a) > 0 ? Number(std.seedlings_per_10a) : null;
      let needed: number | null = null;
      let neededFromSaved = false;
      if (spp && areaA) {
        needed = Math.ceil((areaA / 10) * spp);
      } else if (Number(plan.calculated_seedlings) > 0) {
        needed = Math.ceil(Number(plan.calculated_seedlings));
        neededFromSaved = true;
      }

      const lossRate = toNum(sd._loss_rate) ?? toNum(schedule?.loss_rate) ?? 10;
      const withSpare = needed !== null ? Math.ceil(needed * (1 + lossRate / 100)) : null;

      const germRate = toNum(std?.germination_rate);
      const seedsPerCell = toNum(std?.seeds_per_cell);
      const spcUsed = seedsPerCell && seedsPerCell > 0 ? seedsPerCell : 1;
      let cells: number | null = null;
      if (withSpare !== null) {
        // 1穴1粒まき：発芽しない分を見込んで穴数を増やす ／ 複数粒まき：穴数＝苗数（間引きで1本にする）
        cells = spcUsed <= 1 && germRate && germRate > 0 ? Math.ceil(withSpare / (germRate / 100)) : withSpare;
      }
      const seeds = cells !== null ? cells * spcUsed : null;
      const trayCells = toNum(std?.tray_cells);
      const trays = cells !== null && trayCells && trayCells > 0 ? Math.ceil(cells / trayCells) : null;

      // 植え付け日：こよみの定植日があればそれ、無ければ定植の旬の代表日（ごろ）
      const startMonth = Number(plan.start_month) || 0;
      const st = Number(meta.st) || 1;
      let plantDate: string | null = null;
      let plantDateExact = false;
      if (parseDate(meta.pd)) {
        plantDate = String(meta.pd).slice(0, 10);
        plantDateExact = true;
      } else if (startMonth >= 1 && startMonth <= 12) {
        plantDate = `${Number(plan.year) || year}-${pad2(startMonth)}-${pad2(termDay(st))}`;
      }
      const plantD = parseDate(plantDate);
      const plantMonth = plantD ? plantD.getMonth() + 1 : startMonth;
      const plantSeason: SeasonKey | null = plantMonth >= 1 && plantMonth <= 12 ? getSeasonByMonth(plantMonth) : null;

      // 季節ごとの育苗日数があれば優先し、無ければ基本の育苗日数を使う
      const seasonalDays = plantSeason ? toNum(std?.[`nursery_days_${plantSeason}`]) : null;
      const baseNurseryDays = toNum(std?.nursery_days);
      const nurseryDays = seasonalDays !== null ? seasonalDays : baseNurseryDays;
      const nurserySeasonUsed: SeasonKey | null = seasonalDays !== null ? plantSeason : null;

      const pottingDays = toNum(std?.potting_days);
      const germDays = toNum(std?.germination_days);

      const plantLabel = plantDateExact
        ? `${fmtMD(plantDate)}（こよみの定植日）`
        : startMonth
          ? `${startMonth}月${termLabel(st)}ごろ`
          : '未登録';

      const records = readRecords(sd).sort((a, b) => a.date.localeCompare(b.date));
      const sum = (t: RecordType) => records.filter(r => r.type === t).reduce((acc, r) => acc + (r.qty || 0), 0);
      const sownQty = sum('sowing');
      const germQty = sum('germination');
      const pottedQty = sum('potting');
      const plantedQty = sum('planting');
      const firstSow = records.find(r => r.type === 'sowing')?.date || null;
      const firstGerm = records.find(r => r.type === 'germination')?.date || null;
      const firstPlant = records.find(r => r.type === 'planting')?.date || null;

      // 実績から自動計算（1粒まき＝芽が出た本数÷まいた粒数、複数粒まき＝芽が出た穴数÷まいた穴数）
      const sownDenom = spcUsed > 1 && sownQty > 0 ? Math.round(sownQty / spcUsed) : sownQty;
      const actualGermRate = sownDenom > 0 && germQty > 0
        ? Math.min(100, Math.round((germQty / sownDenom) * 1000) / 10)
        : null;
      const rawGermDiff = diffDays(firstSow, firstGerm);
      const actualGermDays = rawGermDiff !== null && rawGermDiff >= 0 ? rawGermDiff : null;
      const rawNurseryDiff = diffDays(firstSow, firstPlant);
      const actualNurseryDays = rawNurseryDiff !== null && rawNurseryDiff >= 0 ? rawNurseryDiff : null;

      const manualSow = parseDate(sd._sow_date) ? String(sd._sow_date).slice(0, 10) : null;
      const sowPlanned = manualSow || (plantDate && nurseryDays !== null ? addDays(plantDate, -nurseryDays) : null);
      const sowBase = firstSow || sowPlanned;
      const germCheck = sowBase && germDays !== null ? addDays(sowBase, germDays) : null;
      const pottingPlanned = sowBase && pottingDays ? addDays(sowBase, pottingDays) : null;

      const missing: string[] = [];
      if (!spp) missing.push('10aあたりの苗数');
      if (nurseryDays === null) missing.push('育苗日数');
      if (germRate === null) missing.push('発芽率');
      if (trayCells === null) missing.push('トレイの穴の数');

      return {
        plan,
        std,
        schedule,
        cropId: String(plan.crop_id || ''),
        cropName: plan.crops?.name || '作目未設定',
        variety: clean,
        fieldName: field?.name || '畑未設定',
        areaA,
        spp,
        needed,
        neededFromSaved,
        lossRate,
        withSpare,
        germRate,
        seedsPerCell,
        cells,
        seeds,
        trayCells,
        trays,
        nurseryDays,
        nurserySeasonUsed,
        pottingDays,
        germDays,
        plantMonth,
        plantSeason,
        plantDate,
        plantDateExact,
        plantLabel,
        sowPlanned,
        sowManual: !!manualSow,
        records,
        sownQty,
        germQty,
        pottedQty,
        plantedQty,
        firstSow,
        firstGerm,
        firstPlant,
        actualGermRate,
        actualGermDays,
        actualNurseryDays,
        sowBase,
        germCheck,
        pottingPlanned,
        missing
      } as Row;
    });
  }, [plans, standards, schedules, year]);

  // 苗の数が出せる（または記録がある）作付け ／ 計算できない作付け
  const nurseryRows = useMemo(() => rows.filter(r => r.needed !== null || r.records.length > 0), [rows]);
  const uncountableRows = useMemo(() => rows.filter(r => r.needed === null && r.records.length === 0), [rows]);

  // ---------- うちの農園の実際の発芽率・日数（記録から自動学習） ----------
  const cropLearnings = useMemo(() => {
    const byCrop = new Map<string, Row[]>();
    nurseryRows.forEach(r => {
      if (!r.cropId) return;
      if (!byCrop.has(r.cropId)) byCrop.set(r.cropId, []);
      byCrop.get(r.cropId)!.push(r);
    });
    const avg = (ns: number[]) => (ns.length > 0 ? Math.round((ns.reduce((a, b) => a + b, 0) / ns.length) * 10) / 10 : null);
    const avgInt = (ns: number[]) => (ns.length > 0 ? Math.round(ns.reduce((a, b) => a + b, 0) / ns.length) : null);

    return Array.from(byCrop.entries()).map(([cropId, list]) => {
      const first = list[0];
      const std = first.std;
      const germRates = list.map(r => r.actualGermRate).filter((v): v is number => v !== null);
      const germDaysList = list.map(r => r.actualGermDays).filter((v): v is number => v !== null);
      const nurseryDaysList = list.map(r => r.actualNurseryDays).filter((v): v is number => v !== null);

      const seasonNursery: Record<SeasonKey, { actual: number | null; count: number; master: number | null }> = {
        spring: { actual: null, count: 0, master: toNum(std?.nursery_days_spring) },
        summer: { actual: null, count: 0, master: toNum(std?.nursery_days_summer) },
        autumn: { actual: null, count: 0, master: toNum(std?.nursery_days_autumn) },
        winter: { actual: null, count: 0, master: toNum(std?.nursery_days_winter) }
      };
      (['spring', 'summer', 'autumn', 'winter'] as SeasonKey[]).forEach(sk => {
        const vals = list.filter(r => r.plantSeason === sk && r.actualNurseryDays !== null).map(r => r.actualNurseryDays as number);
        seasonNursery[sk].actual = avgInt(vals);
        seasonNursery[sk].count = vals.length;
      });

      const actualGermRateAvg = avg(germRates);
      const actualGermDaysAvg = avgInt(germDaysList);
      const actualNurseryDaysAvg = avgInt(nurseryDaysList);
      const hasAnyActual = actualGermRateAvg !== null || actualGermDaysAvg !== null || actualNurseryDaysAvg !== null;

      return {
        cropId,
        cropName: first.cropName,
        std,
        masterGermRate: toNum(std?.germination_rate),
        masterGermDays: toNum(std?.germination_days),
        masterNurseryDays: toNum(std?.nursery_days),
        actualGermRateAvg,
        germRateCount: germRates.length,
        actualGermDaysAvg,
        germDaysCount: germDaysList.length,
        actualNurseryDaysAvg,
        nurseryDaysCount: nurseryDaysList.length,
        seasonNursery,
        hasAnyActual
      };
    });
  }, [nurseryRows]);

  const applyLearningToMaster = async (info: (typeof cropLearnings)[number]) => {
    if (!info.hasAnyActual) return;
    const lines: string[] = [];
    const payload: Record<string, any> = {};
    if (info.actualGermRateAvg !== null) {
      payload.germination_rate = Math.round(info.actualGermRateAvg);
      lines.push(`・発芽率：${info.masterGermRate ?? '未設定'}% → ${payload.germination_rate}%`);
    }
    if (info.actualGermDaysAvg !== null) {
      payload.germination_days = info.actualGermDaysAvg;
      lines.push(`・発芽までの日数：${info.masterGermDays ?? '未設定'}日 → ${payload.germination_days}日`);
    }
    if (info.actualNurseryDaysAvg !== null) {
      payload.nursery_days = info.actualNurseryDaysAvg;
      lines.push(`・育苗日数（基本）：${info.masterNurseryDays ?? '未設定'}日 → ${payload.nursery_days}日`);
    }
    (['spring', 'summer', 'autumn', 'winter'] as SeasonKey[]).forEach(sk => {
      const s = info.seasonNursery[sk];
      if (s.actual !== null) {
        payload[`nursery_days_${sk}`] = s.actual;
        lines.push(`・${SEASON_SHORT[sk]}の育苗日数：${s.master ?? '未設定'}日 → ${s.actual}日`);
      }
    });
    if (!confirm(`「${info.cropName}」の農園実績を、作目マスタの基準に反映しますか？\n\n${lines.join('\n')}`)) return;

    setIsSaving(true);
    try {
      const runSave = async (data: Record<string, any>) => {
        if (info.std?.id) {
          return supabase.from('crop_standards').update(data).eq('id', info.std.id);
        }
        return supabase.from('crop_standards').insert([{ crop_id: info.cropId, variety: null, seedlings_per_10a: 0, materials_per_10a: [], ...data }]);
      };
      let { error } = await runSave(payload);
      if (error && /nursery_days_(spring|summer|autumn|winter)/i.test(`${error.message || ''} ${(error as any).details || ''}`)) {
        const fallback = { ...payload };
        delete fallback.nursery_days_spring;
        delete fallback.nursery_days_summer;
        delete fallback.nursery_days_autumn;
        delete fallback.nursery_days_winter;
        const retry = await runSave(fallback);
        error = retry.error;
        if (!error) {
          alert('発芽率・発芽日数・基本の育苗日数をマスタに反映しました。\n※季節ごとの育苗日数も保存するには「18_育苗基準カラム追加.sql」をSupabaseで一度実行してください。');
        }
      }
      if (error) throw error;
      setToast(`「${info.cropName}」の実績をマスタの基準に反映しました`);
      await fetchData();
    } catch (err: any) {
      console.error(err);
      alert('マスタへの反映に失敗しました。通信状態やデータベースの設定（18番SQL）をご確認ください。');
    } finally {
      setIsSaving(false);
    }
  };

  // ---------- 今週・来週やること ----------
  const tasks: TaskItem[] = useMemo(() => {
    const end = addDays(today, 13);
    const list: TaskItem[] = [];
    nurseryRows.forEach(r => {
      if (r.plantedQty > 0) return; // 植え付け済みは完了
      if (r.sownQty === 0 && r.sowPlanned && r.sowPlanned <= end) {
        list.push({ key: `${r.plan.id}-sow`, date: r.sowPlanned, kind: 'sowing', row: r, overdue: r.sowPlanned < today });
      }
      if (r.sownQty > 0 && r.germQty === 0 && r.germCheck && r.germCheck >= addDays(today, -5) && r.germCheck <= end && r.pottedQty === 0) {
        list.push({ key: `${r.plan.id}-germ`, date: r.germCheck, kind: 'germ', row: r, overdue: r.germCheck < today });
      }
      if (r.sownQty > 0 && r.pottingPlanned && r.pottedQty === 0 && r.pottingPlanned <= end) {
        list.push({ key: `${r.plan.id}-pot`, date: r.pottingPlanned, kind: 'potting', row: r, overdue: r.pottingPlanned < today });
      }
      if (r.sownQty > 0 && r.plantDate && r.plantDate <= end) {
        list.push({ key: `${r.plan.id}-plant`, date: r.plantDate, kind: 'planting', row: r, overdue: r.plantDate < today });
      }
    });
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [nurseryRows, today]);

  // ---------- まとめ表示 ----------
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; sub?: string; rows: Row[] }>();
    nurseryRows.forEach(r => {
      let key = '';
      let label = '';
      let sub = '';
      if (groupMode === 'sow') {
        if (r.sowBase) {
          key = mondayOf(r.sowBase);
          label = `${fmtMD(key)} 〜 ${fmtMD(addDays(key, 6))} の週にまく`;
          if (key <= today && today <= addDays(key, 6)) sub = '今週';
          else if (addDays(key, 6) < today) sub = r.sownQty > 0 ? 'まき終わり' : '過ぎています';
        } else {
          key = '9999-zz';
          label = 'まく日が決まっていない作付け';
          sub = '育苗日数が未設定です';
        }
      } else if (groupMode === 'crop') {
        key = r.cropName;
        label = `${r.cropName}`;
      } else {
        key = r.fieldName;
        label = `${r.fieldName}`;
      }
      if (!map.has(key)) map.set(key, { key, label, sub, rows: [] });
      map.get(key)!.rows.push(r);
    });
    const arr = Array.from(map.values());
    arr.forEach(g => g.rows.sort((a, b) => (a.sowBase || '9999').localeCompare(b.sowBase || '9999') || a.cropName.localeCompare(b.cropName)));
    return arr.sort((a, b) => a.key.localeCompare(b.key, 'ja'));
  }, [nurseryRows, groupMode, today]);

  // 同じ週・同じ作目の合計（まく日ごと表示で、まとめてまく量を一目で分かるように）
  const cropTotals = (rs: Row[]) => {
    const m = new Map<string, { crop: string; count: number; cells: number; seeds: number; trays: number; traysKnown: boolean }>();
    rs.forEach(r => {
      const cur = m.get(r.cropName) || { crop: r.cropName, count: 0, cells: 0, seeds: 0, trays: 0, traysKnown: true };
      cur.count += 1;
      cur.cells += r.cells || 0;
      cur.seeds += r.seeds || 0;
      if (r.trays === null) cur.traysKnown = false;
      cur.trays += r.trays || 0;
      m.set(r.cropName, cur);
    });
    return Array.from(m.values()).filter(t => t.count > 1);
  };

  // ---------- 保存 ----------
  const saveSchedule = async (row: Row, patch: { records?: NurseryRecord[]; lossRate?: number; sowDate?: string | null }) => {
    setIsSaving(true);
    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('農園の情報が確認できませんでした。もう一度ログインしてください。');

      const base = { ...(row.schedule?.schedule_data || {}) };
      const records = patch.records ?? row.records;
      base._records = records.map(r => ({ id: r.id, type: r.type, date: r.date, qty: r.qty, memo: r.memo || '' }));
      base._loss_rate = patch.lossRate ?? row.lossRate;
      if (patch.sowDate === null) delete base._sow_date;
      else if (patch.sowDate) base._sow_date = patch.sowDate;
      const sownQuantity = records.filter(r => r.type === 'sowing').reduce((a, r) => a + (r.qty || 0), 0);

      if (row.schedule?.id) {
        const { data, error } = await supabase
          .from('nursery_schedules_v2')
          .update({ schedule_data: base, sown_quantity: sownQuantity })
          .eq('id', row.schedule.id)
          .eq('user_id', tenantId)
          .select()
          .single();
        if (error) throw error;
        setSchedules(prev => prev.map(s => (s.id === row.schedule.id ? data : s)));
      } else {
        const { data, error } = await supabase
          .from('nursery_schedules_v2')
          .insert({ user_id: tenantId, plan_id: row.plan.id, schedule_data: base, sown_quantity: sownQuantity })
          .select()
          .single();
        if (error) throw error;
        setSchedules(prev => [...prev, data]);
      }
      return true;
    } catch (err: any) {
      console.error(err);
      alert('保存できませんでした。通信状態を確認して、もう一度お試しください。\n（くり返す場合は管理者にご連絡ください）');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const openRecord = (row: Row, type: RecordType) => {
    setRecordTarget({ row, type });
    setRecordDate(today);
    const spc = row.seedsPerCell && row.seedsPerCell > 0 ? row.seedsPerCell : 1;
    const defaultGerm = row.withSpare ?? (row.sownQty > 0 ? Math.round(row.sownQty / spc) : null);
    const suggested =
      type === 'sowing' ? row.seeds :
      type === 'germination' ? defaultGerm :
      type === 'potting' ? (row.germQty > 0 ? row.germQty : row.withSpare) :
      row.needed;
    setRecordQty(suggested ? String(suggested) : '');
    setRecordMemo('');
  };

  const submitRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordTarget) return;
    const qty = Number(recordQty);
    if (!parseDate(recordDate)) {
      alert('日付を選んでください。');
      return;
    }
    if (!qty || qty <= 0) {
      alert('数を入力してください（例: 2000）。');
      return;
    }
    const rec: NurseryRecord = { id: newId(), type: recordTarget.type, date: recordDate, qty, memo: recordMemo.trim() };
    const ok = await saveSchedule(recordTarget.row, { records: [...recordTarget.row.records, rec] });
    if (ok) {
      setToast(`「${recordTarget.row.cropName}（${recordTarget.row.fieldName}）」の${RECORD_LABEL[recordTarget.type]}を記録しました`);
      setRecordTarget(null);
    }
  };

  const deleteRecord = async (row: Row, recId: string) => {
    if (!confirm('この記録を取り消しますか？')) return;
    const ok = await saveSchedule(row, { records: row.records.filter(r => r.id !== recId) });
    if (ok) setToast('記録を取り消しました');
  };

  const openSettings = (row: Row) => {
    setSettingsRow(row);
    setSettingsLoss(String(row.lossRate));
    setSettingsSowDate(row.sowManual && row.sowPlanned ? row.sowPlanned : '');
  };

  const submitSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsRow) return;
    const loss = Number(settingsLoss);
    if (Number.isNaN(loss) || loss < 0 || loss > 100) {
      alert('予備は 0〜100 の数で入力してください（例: 10）。');
      return;
    }
    const ok = await saveSchedule(settingsRow, { lossRate: loss, sowDate: settingsSowDate ? settingsSowDate : null });
    if (ok) {
      setToast('予備とまく日を保存しました');
      setSettingsRow(null);
    }
  };

  // ---------- 週の一覧表 ----------
  const weeks = useMemo(() => Array.from({ length: 16 }).map((_, i) => addDays(weekStart, i * 7)), [weekStart]);
  const weekCell = (r: Row, wStart: string) => {
    const wEnd = addDays(wStart, 6);
    const inW = (d: string | null) => !!d && d >= wStart && d <= wEnd;
    const firstPot = r.records.find(x => x.type === 'potting')?.date || r.pottingPlanned;
    const firstPlant = r.records.find(x => x.type === 'planting')?.date || r.plantDate;
    if (inW(r.sowBase)) return { cls: 'bg-orange-400 text-white', label: '種まき' };
    if (inW(firstPot)) return { cls: 'bg-pink-400 text-white', label: '鉢上げ' };
    if (inW(firstPlant)) return { cls: 'bg-green-600 text-white', label: '植付' };
    if (r.sowBase && firstPlant && wStart > r.sowBase && wEnd < firstPlant) return { cls: 'bg-emerald-100 text-emerald-700', label: '育苗' };
    return { cls: '', label: '' };
  };

  const printTasks = tasks.filter(t => t.date <= addDays(today, 13));

  // ---------- 表示部品 ----------
  const taskText = (t: TaskItem) => {
    if (t.kind === 'sowing') return '種まき';
    if (t.kind === 'germ') return '芽が出たか確認';
    if (t.kind === 'potting') return '鉢上げ';
    return '植え付け';
  };
  const taskColor = (k: TaskItem['kind']) =>
    k === 'sowing' ? 'bg-orange-100 text-orange-800 border-orange-200' :
    k === 'germ' ? 'bg-sky-100 text-sky-800 border-sky-200' :
    k === 'potting' ? 'bg-pink-100 text-pink-800 border-pink-200' :
    'bg-green-100 text-green-800 border-green-200';

  const NumberBreakdown = ({ r }: { r: Row }) => (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-1.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-slate-500">① 植え付けに必要な苗</span>
        <span className="font-black text-slate-800">{fmtN(r.needed)} 本</span>
      </div>
      <p className="text-[10px] text-slate-400 -mt-1 text-right">
        {r.neededFromSaved
          ? '以前に保存された数（マスタの10aあたり苗数が未設定のため）'
          : r.areaA && r.spp
            ? `${r.areaA}a × ${r.spp.toLocaleString()}本/10a`
            : ''}
      </p>
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-slate-500">② 予備 {r.lossRate}% を足す</span>
        <span className="font-black text-slate-800">{fmtN(r.withSpare)} 本</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-slate-500">③ まく穴の数</span>
        <span className="font-black text-slate-800">{fmtN(r.cells)} 穴</span>
      </div>
      <p className="text-[10px] text-right -mt-1 leading-snug">
        {(r.seedsPerCell ?? 1) > 1 ? (
          <span className="text-slate-400">1穴{r.seedsPerCell}粒まき（間引いて1本にする）ので、穴の数＝苗の数</span>
        ) : r.germRate ? (
          <span className="text-slate-400">発芽率{r.germRate}%で、芽が出ない分を多めに</span>
        ) : (
          <span className="text-amber-600 font-bold">発芽率が未設定のため、芽が出ない分は見込んでいません</span>
        )}
      </p>
      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200">
        <span className="font-black text-emerald-800">🟩 セルトレイ</span>
        {r.trays !== null ? (
          <span className="font-black text-emerald-700 text-sm">{r.trays.toLocaleString()} 枚 <span className="text-[10px] font-bold text-slate-400">（{r.trayCells}穴）</span></span>
        ) : (
          <span className="text-[11px] font-bold text-amber-600">穴の数が未設定</span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="font-black text-emerald-800">🌰 種</span>
        <span className="font-black text-emerald-700 text-sm">
          {fmtN(r.seeds)} 粒
          {r.seedsPerCell === null && r.seeds !== null && <span className="block text-[10px] font-bold text-slate-400 text-right">1穴1粒として計算</span>}
        </span>
      </div>
    </div>
  );

  const StepChips = ({ r }: { r: Row }) => {
    const steps: { type: RecordType; planned: string | null; done: number; show: boolean }[] = [
      { type: 'sowing', planned: r.sowPlanned, done: r.sownQty, show: true },
      { type: 'germination', planned: r.germCheck, done: r.germQty, show: true },
      { type: 'potting', planned: r.pottingPlanned, done: r.pottedQty, show: !!r.pottingDays || r.pottedQty > 0 },
      { type: 'planting', planned: r.plantDate, done: r.plantedQty, show: true }
    ];
    return (
      <div className="flex items-stretch gap-1.5 flex-wrap">
        {steps.filter(s => s.show).map((s, i) => {
          const doneRec = r.records.filter(x => x.type === s.type);
          const isDone = s.done > 0;
          const late = !isDone && s.planned && s.planned < today && (s.type === 'sowing' || r.sownQty > 0);
          return (
            <React.Fragment key={s.type}>
              {i > 0 && <span className="self-center text-slate-300 font-black">→</span>}
              <div className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold min-w-[92px] ${
                isDone ? 'bg-emerald-600 text-white border-emerald-700' : late ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-white text-slate-600 border-slate-200'
              }`}>
                <div className="flex items-center gap-1">
                  {isDone && <Check className="w-3 h-3" />}
                  <span>{s.type === 'germination' ? '発芽' : RECORD_LABEL[s.type]}</span>
                </div>
                <div className={`text-[10px] ${isDone ? 'text-emerald-50' : ''}`}>
                  {isDone
                    ? `${fmtMD(doneRec[0]?.date)} ${s.done.toLocaleString()}${RECORD_UNIT[s.type]}`
                    : s.type === 'planting'
                      ? `予定 ${r.plantLabel.replace('（こよみの定植日）', '')}`
                      : s.planned
                        ? `予定 ${fmtMD(s.planned)}${late ? '（過ぎています）' : ''}`
                        : '予定日 未定'}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const RowCard = ({ r }: { r: Row }) => (
    <article className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-black text-slate-800 truncate">
            {r.cropName}
            {r.variety && <span className="ml-1.5 text-xs font-bold text-emerald-600">{r.variety}</span>}
          </h3>
          <p className="text-xs font-bold text-slate-500">
            📍 {r.fieldName}{r.areaA ? `（${r.areaA}a）` : '（面積未登録）'} ／ 植え付け {r.plantLabel}
            {r.plantSeason && <span className="ml-1 text-[11px] text-slate-400">[{SEASON_SHORT[r.plantSeason]}]</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => openSettings(r)}
          className="shrink-0 px-2.5 py-1.5 text-[11px] font-black text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1 cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5" />
          予備・まく日
        </button>
      </div>

      {/* まく日 */}
      <div className={`rounded-2xl px-3 py-2 border text-xs ${r.sowPlanned ? 'bg-orange-50 border-orange-200' : 'bg-amber-50 border-amber-200'}`}>
        {r.firstSow ? (
          <span className="font-black text-orange-800">🌱 {fmtMD(r.firstSow)} にまきました（{r.sownQty.toLocaleString()}粒）</span>
        ) : r.sowPlanned ? (
          <span className="font-black text-orange-800">
            🌱 まく日の目安：{fmtMD(r.sowPlanned)}
            <span className="ml-1 text-[10px] font-bold text-orange-600">
              {r.sowManual
                ? '（手で変更した日）'
                : `（植え付け${r.plantDateExact ? '日' : 'の旬'} − ${r.nurserySeasonUsed ? `${SEASON_SHORT[r.nurserySeasonUsed]}の育苗` : '育苗'}${r.nurseryDays}日）`}
            </span>
          </span>
        ) : (
          <span className="font-bold text-amber-800">
            🌱 まく日を計算できません：{!r.plantDate ? '作付けこよみの植え付け時期が未登録です。' : 'この作目の「育苗日数」が未設定です。'}
            <Link href={!r.plantDate ? planCalendarHref : mastersHref} className="ml-1 underline font-black">
              {!r.plantDate ? '作付けこよみで登録' : 'マスタで設定'}
            </Link>
            <span className="block text-[10px] font-bold text-amber-700 mt-0.5">右上の「予備・まく日」から、まく日を手で決めることもできます。</span>
          </span>
        )}
        {r.firstGerm ? (
          <span className="block text-[11px] font-black text-sky-800 mt-0.5">
            👀 {fmtMD(r.firstGerm)} に芽が出ました（{r.germQty.toLocaleString()}本）
            {r.actualGermRate !== null && ` ／ 実際の発芽率 ${r.actualGermRate}%（マスタ ${r.germRate !== null ? `${r.germRate}%` : '未設定'}）`}
            {r.actualGermDays !== null && ` ／ 発芽まで${r.actualGermDays}日（マスタ ${r.germDays !== null ? `${r.germDays}日` : '未設定'}）`}
          </span>
        ) : r.germCheck && r.sownQty > 0 && r.pottedQty === 0 && r.plantedQty === 0 ? (
          <span className="block text-[11px] font-bold text-sky-700 mt-0.5">👀 芽が出るのは {fmtMD(r.germCheck)} ごろ（発芽まで{r.germDays}日）→ 芽が出たら下の「✅ 芽が出た」で記録してください</span>
        ) : null}
        {r.actualNurseryDays !== null && (
          <span className="block text-[11px] font-black text-emerald-800 mt-0.5">
            🚜 実際の育苗日数：{r.actualNurseryDays}日（まいた日 {fmtMD(r.firstSow)} → 植えた日 {fmtMD(r.firstPlant)} ／ マスタ {r.nurseryDays !== null ? `${r.nurseryDays}日` : '未設定'}）
          </span>
        )}
      </div>

      {StepChips({ r })}
      {NumberBreakdown({ r })}

      {r.missing.length > 0 && (
        <p className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
          ⚠️ 未設定：{r.missing.join('・')}（<Link href={mastersHref} className="underline">マスタ管理 → 作目</Link>で設定すると自動で計算されます）
        </p>
      )}

      {/* 実績ボタン */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {(['sowing', 'germination', 'potting', 'planting'] as RecordType[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => openRecord(r, t)}
            className={`py-2.5 rounded-xl text-xs font-black border cursor-pointer transition-colors ${
              t === 'sowing' ? 'bg-orange-500 hover:bg-orange-600 text-white border-orange-600' :
              t === 'germination' ? 'bg-sky-500 hover:bg-sky-600 text-white border-sky-600' :
              t === 'potting' ? 'bg-white hover:bg-pink-50 text-pink-700 border-pink-200' :
              'bg-green-600 hover:bg-green-700 text-white border-green-700'
            }`}
          >
            ✅ {RECORD_DONE_LABEL[t]}
          </button>
        ))}
      </div>

      {r.records.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer font-black text-slate-500">これまでの記録（{r.records.length}件）</summary>
          <ul className="mt-2 space-y-1">
            {r.records.map(rec => (
              <li key={rec.id} className="flex items-center justify-between gap-2 bg-slate-50 rounded-lg px-2.5 py-1.5">
                <span className="font-bold text-slate-700">
                  {fmtMD(rec.date)} {RECORD_LABEL[rec.type]} {rec.qty.toLocaleString()}{RECORD_UNIT[rec.type]}
                  {rec.memo && <span className="ml-1 text-[10px] text-slate-400">{rec.memo}</span>}
                </span>
                <button type="button" onClick={() => deleteRecord(r, rec.id)} className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer" title="取り消す">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-16 relative">
      {/* 印刷用スタイル：育苗ハウス掲示用の表だけを印刷する */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #nursery-print, #nursery-print * { visibility: visible !important; }
          #nursery-print { position: absolute; left: 0; top: 0; width: 100%; display: block !important; }
        }
      `}</style>

      {/* ヘッダー */}
      <header className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-800 flex items-center gap-2.5">
              <Sprout className="w-7 h-7 text-emerald-600" />
              <span>育苗スケジュール</span>
              <HelpTooltip content="作付けこよみの植え付け時期と、作目マスタの育苗日数・発芽率・トレイの穴の数から、まく日と必要な数を自動で計算します。" className="ml-1" />
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-bold mt-1">
              「いつ・トレイ何枚に・種を何粒まくか」が分かります。まいたら「まいた」、芽が出たら「芽が出た」ボタンで記録してください。
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200 text-xs font-black">
              <button type="button" onClick={() => setYear(y => y - 1)} className="px-2 py-1.5 text-slate-600 hover:text-slate-900 cursor-pointer flex items-center" title="前の年度">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 bg-white text-emerald-700 rounded-lg shadow-2xs">{year}年度の作付け</span>
              <button type="button" onClick={() => setYear(y => y + 1)} className="px-2 py-1.5 text-slate-600 hover:text-slate-900 cursor-pointer flex items-center" title="次の年度">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <button type="button" onClick={fetchData} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer">
              <RefreshCw className="w-3.5 h-3.5" />
              再読み込み
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              今週・来週の作業を印刷
            </button>
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex gap-2.5 text-emerald-900 text-xs font-bold leading-relaxed">
          <Info className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
          <p>
            このリストは<strong>「作付けこよみ（計画）」と連動</strong>しています。新しい苗を追加したい場合は、先に
            <Link href={planCalendarHref} className="font-black underline text-emerald-700 hover:text-emerald-900">「作付けこよみ（計画）」</Link>
            で、どの畑に何をいつ植えるかを登録してください。育苗日数・発芽率・トレイの穴の数は
            <Link href={mastersHref} className="font-black underline text-emerald-700 hover:text-emerald-900">「マスタ管理 → 作目」</Link>
            で作目ごとに一度だけ設定します（種の袋の裏に書かれています）。
          </p>
        </div>

        {!standardColumnsReady && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex gap-2.5 text-amber-900 text-xs font-bold leading-relaxed">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <p>育苗の基準（育苗日数・発芽率・トレイなど）の保存先が、まだデータベースに準備されていません。管理者の方にお渡ししたSQLを実行すると、まく日やトレイ枚数が自動で計算されるようになります。</p>
          </div>
        )}
      </header>

      {isLoading ? (
        <div className="bg-white p-16 rounded-3xl border border-slate-200 flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-xs font-bold">作付けこよみと育苗の記録を読み込んでいます...</p>
        </div>
      ) : loadError ? (
        <div className="bg-rose-50 p-8 rounded-3xl border border-rose-200 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="text-sm font-black text-rose-800">{loadError}</p>
          <button type="button" onClick={fetchData} className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-black cursor-pointer">再読み込み</button>
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-white p-10 rounded-3xl border border-slate-200 text-center space-y-3">
          <Sprout className="w-10 h-10 text-emerald-500 mx-auto" />
          <p className="text-base font-black text-slate-800">{year}年度の作付けがまだ登録されていません</p>
          <p className="text-xs font-bold text-slate-500">「作付けこよみ（計画）」で、どの畑に何をいつ植えるかを登録すると、ここに育苗の予定が自動で出ます。</p>
          <Link href={planCalendarHref} className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-black shadow-sm">
            <Calendar className="w-4 h-4" />
            作付けこよみで登録する
          </Link>
        </div>
      ) : (
        <>
          {/* ① 今週・来週やること */}
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-3">
            <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
              📋 今週・来週やること
              <span className="text-[11px] font-bold text-slate-400">（{fmtMD(today)} 〜 {fmtMD(addDays(today, 13))}）</span>
            </h2>
            {tasks.length === 0 ? (
              <p className="text-sm font-bold text-slate-500 bg-slate-50 rounded-2xl p-4 text-center">
                この2週間にやる育苗の作業はありません。
                {nurseryRows.some(r => !r.sowBase) && <span className="block text-xs text-amber-700 mt-1">※ まく日が決まっていない作付けがあります（下の一覧を確認してください）</span>}
              </p>
            ) : (
              <ul className="space-y-2">
                {tasks.map(t => {
                  const recType: RecordType = t.kind === 'germ' ? 'germination' : t.kind;
                  return (
                    <li key={t.key} className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-2xl border p-3 ${t.overdue ? 'border-rose-200 bg-rose-50/60' : 'border-slate-200'}`}>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-black border ${taskColor(t.kind)}`}>{taskText(t)}</span>
                        <span className={`text-sm font-black ${t.overdue ? 'text-rose-700' : 'text-slate-800'}`}>
                          {fmtMD(t.date)}{t.kind === 'planting' && !t.row.plantDateExact ? 'ごろ' : ''}
                          {t.overdue && <span className="ml-1 text-[10px]">（過ぎています）</span>}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0 text-xs font-bold text-slate-600">
                        <span className="font-black text-slate-800">{t.row.cropName}</span>
                        {t.row.variety && <span className="ml-1 text-emerald-600">{t.row.variety}</span>}
                        <span className="ml-1">／ {t.row.fieldName}</span>
                        <span className="block text-[11px] text-slate-500 mt-0.5">
                          {t.kind === 'sowing' && (
                            <>トレイ <strong className="text-emerald-700">{t.row.trays !== null ? `${t.row.trays.toLocaleString()}枚` : '（穴の数が未設定）'}</strong> ／ 種 <strong className="text-emerald-700">{fmtN(t.row.seeds)}粒</strong>（植える苗 {fmtN(t.row.needed)}本）</>
                          )}
                          {t.kind === 'germ' && <>{fmtMD(t.row.firstSow)} にまいた分の芽が出ているか見て、「芽が出た」ボタンで数を記録してください</>}
                          {t.kind === 'potting' && <>苗 約{fmtN(t.row.withSpare)}本をポットへ</>}
                          {t.kind === 'planting' && <>苗 {fmtN(t.row.needed)}本を植え付け</>}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => openRecord(t.row, recType)}
                        className={`shrink-0 px-3 py-2 text-white rounded-xl text-xs font-black cursor-pointer ${
                          t.kind === 'germ' ? 'bg-sky-600 hover:bg-sky-700' : 'bg-emerald-600 hover:bg-emerald-700'
                        }`}
                      >
                        ✅ {RECORD_DONE_LABEL[recType]}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ①-2 うちの農園の実際の発芽率・日数（記録から自動で計算・マスタと比較） */}
          {cropLearnings.length > 0 && (
            <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                    📊 うちの農園の実際の発芽率・日数（マスタの数字と比較）
                  </h2>
                  <p className="text-xs font-bold text-slate-500 mt-0.5">
                    各カードの「✅ まいた」「✅ 芽が出た」「✅ 植えた」を記録すると、ご自身の農園の実際の発芽率・発芽日数・季節ごとの育苗日数が自動で計算されます。
                  </p>
                </div>
                <Link href={mastersHref} className="shrink-0 text-xs font-black text-emerald-700 underline">
                  マスタ管理 → 作目を開く
                </Link>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {cropLearnings.map(c => (
                  <div key={c.cropId} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-black text-slate-800">🌱 {c.cropName}</span>
                      {c.hasAnyActual ? (
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => applyLearningToMaster(c)}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black cursor-pointer disabled:opacity-50"
                        >
                          ✨ この実績をマスタの基準に反映する
                        </button>
                      ) : (
                        <span className="text-[11px] font-bold text-slate-400">「芽が出た」「植えた」を記録すると実績が出ます</span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-white rounded-xl border border-slate-200 p-2.5">
                        <div className="text-[10px] font-bold text-slate-400">発芽率</div>
                        <div className="text-sm font-black text-sky-700 mt-0.5">
                          {c.actualGermRateAvg !== null ? `実績 ${c.actualGermRateAvg}%` : '実績 —'}
                        </div>
                        <div className="text-[10px] font-bold text-slate-500">
                          マスタ：{c.masterGermRate !== null ? `${c.masterGermRate}%` : '未設定'}
                          {c.germRateCount > 0 && `（${c.germRateCount}作平均）`}
                        </div>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 p-2.5">
                        <div className="text-[10px] font-bold text-slate-400">発芽までの日数</div>
                        <div className="text-sm font-black text-sky-700 mt-0.5">
                          {c.actualGermDaysAvg !== null ? `実績 ${c.actualGermDaysAvg}日` : '実績 —'}
                        </div>
                        <div className="text-[10px] font-bold text-slate-500">
                          マスタ：{c.masterGermDays !== null ? `${c.masterGermDays}日` : '未設定'}
                          {c.germDaysCount > 0 && `（${c.germDaysCount}作平均）`}
                        </div>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 p-2.5">
                        <div className="text-[10px] font-bold text-slate-400">育苗日数（全体）</div>
                        <div className="text-sm font-black text-emerald-700 mt-0.5">
                          {c.actualNurseryDaysAvg !== null ? `実績 ${c.actualNurseryDaysAvg}日` : '実績 —'}
                        </div>
                        <div className="text-[10px] font-bold text-slate-500">
                          マスタ：{c.masterNurseryDays !== null ? `${c.masterNurseryDays}日` : '未設定'}
                          {c.nurseryDaysCount > 0 && `（${c.nurseryDaysCount}作平均）`}
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-2.5">
                      <div className="text-[10px] font-bold text-slate-500 mb-1">☀️❄️ 季節ごとの育苗日数（春・夏・秋・冬）</div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {(['spring', 'summer', 'autumn', 'winter'] as SeasonKey[]).map(sk => {
                          const s = c.seasonNursery[sk];
                          return (
                            <div key={sk} className="bg-slate-50 rounded-lg px-2 py-1.5">
                              <div className="text-[10px] font-black text-slate-600">{SEASON_SHORT[sk]}</div>
                              <div className="text-xs font-black text-emerald-700">
                                {s.actual !== null ? `実績 ${s.actual}日` : '実績 —'}
                              </div>
                              <div className="text-[10px] font-bold text-slate-400">
                                基準：{s.master !== null ? `${s.master}日` : c.masterNurseryDays !== null ? `基本(${c.masterNurseryDays}日)` : '未設定'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ② まとめ方の切り替え */}
          <section className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                作付けごとの育苗（{nurseryRows.length}件）
              </h2>
              <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200 text-xs font-black">
                {([
                  { k: 'sow', label: 'まく日ごと' },
                  { k: 'crop', label: '作目ごと' },
                  { k: 'field', label: '畑ごと' }
                ] as const).map(o => (
                  <button
                    key={o.k}
                    type="button"
                    onClick={() => setGroupMode(o.k)}
                    className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${groupMode === o.k ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {nurseryRows.length === 0 ? (
              <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center text-sm font-bold text-slate-500">
                苗の数を計算できる作付けがありません。下の「苗の数を計算できない作付け」を確認してください。
              </div>
            ) : (
              groups.map(g => {
                const totals = groupMode === 'sow' ? cropTotals(g.rows) : [];
                return (
                  <div key={g.key} className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap px-1">
                      <h3 className="text-sm font-black text-slate-700">{g.label}</h3>
                      {g.sub && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                          g.sub === '今週' ? 'bg-orange-100 text-orange-700' : g.sub === '過ぎています' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'
                        }`}>{g.sub}</span>
                      )}
                      <span className="text-[11px] font-bold text-slate-400">{g.rows.length}件</span>
                    </div>
                    {totals.length > 0 && (
                      <div className="bg-orange-50 border border-orange-200 rounded-2xl px-3.5 py-2 text-xs font-bold text-orange-900 space-y-0.5">
                        {totals.map(t => (
                          <div key={t.crop}>
                            🧮 {t.crop}（{t.count}か所分まとめてまく場合）：トレイ <strong>{t.traysKnown ? `${t.trays.toLocaleString()}枚` : '一部の穴の数が未設定'}</strong> ／ 種 <strong>{t.seeds.toLocaleString()}粒</strong>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {g.rows.map(r => <React.Fragment key={r.plan.id}>{RowCard({ r })}</React.Fragment>)}
                    </div>
                  </div>
                );
              })
            )}
          </section>

          {/* ③ 苗の数を計算できない作付け */}
          {uncountableRows.length > 0 && (
            <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-2">
              <h2 className="text-sm font-black text-slate-700 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-slate-400" />
                苗の数を計算できない作付け（{uncountableRows.length}件）
              </h2>
              <p className="text-xs font-bold text-slate-500">
                じかまきの作目なら、このままで問題ありません。苗を作る作目なら、
                <Link href={mastersHref} className="underline text-emerald-700">マスタ管理 → 作目</Link>で「10aあたりの必要苗数」を設定するか、畑の面積を登録してください。
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {uncountableRows.map(r => (
                  <li key={r.plan.id} className="text-xs font-bold text-slate-600 bg-slate-50 rounded-xl px-3 py-2">
                    {r.cropName}{r.variety && <span className="text-emerald-600 ml-1">{r.variety}</span>} ／ {r.fieldName}
                    <span className="block text-[10px] text-amber-700">
                      {!r.spp ? '10aあたりの苗数が未設定' : '畑の面積が未登録'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ④ 週ごとの一覧表（見るだけ・自動で色付け） */}
          {nurseryRows.length > 0 && (
            <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-3">
              <button type="button" onClick={() => setShowWeekTable(v => !v)} className="w-full flex items-center justify-between text-sm font-black text-slate-700 cursor-pointer">
                <span className="flex items-center gap-2"><Table className="w-4 h-4 text-slate-400" />週ごとの一覧表（全体の流れを見る）</span>
                <span className="text-xs text-emerald-700">{showWeekTable ? '閉じる ▲' : '開く ▼'}</span>
              </button>
              {showWeekTable && (
                <>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-400" />種まき</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200" />育苗中</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-pink-400" />鉢上げ</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-600" />植え付け</span>
                    </div>
                    <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200 text-xs font-black">
                      <button type="button" onClick={() => setWeekStart(w => addDays(w, -28))} className="px-2 py-1 text-slate-600 cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
                      <span className="px-2 text-slate-600">{fmtMD(weekStart)} 〜</span>
                      <button type="button" onClick={() => setWeekStart(w => addDays(w, 28))} className="px-2 py-1 text-slate-600 cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs whitespace-nowrap">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600">
                          <th className="px-2 py-2 text-left font-black sticky left-0 bg-slate-50 min-w-[150px]">作目 ／ 畑</th>
                          {weeks.map(w => (
                            <th key={w} className={`px-1 py-2 font-bold min-w-[52px] ${w <= today && today <= addDays(w, 6) ? 'text-orange-600' : ''}`}>{fmtMD(w).replace(/\(.\)/, '')}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...nurseryRows].sort((a, b) => (a.sowBase || '9999').localeCompare(b.sowBase || '9999')).map(r => (
                          <tr key={r.plan.id} className="border-t border-slate-100">
                            <td className="px-2 py-1.5 font-bold text-slate-700 sticky left-0 bg-white">
                              {r.cropName}<span className="text-slate-400"> ／ {r.fieldName}</span>
                            </td>
                            {weeks.map(w => {
                              const c = weekCell(r, w);
                              return (
                                <td key={w} className="p-0.5">
                                  <div className={`h-7 rounded text-[10px] font-black flex items-center justify-center ${c.cls}`}>{c.label}</div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          )}
        </>
      )}

      {/* 印刷用（画面には出ない）：育苗ハウスに貼る「今週・来週やること」 */}
      <div id="nursery-print" className="hidden">
        <h1 style={{ fontSize: '18pt', fontWeight: 900, marginBottom: '4pt' }}>育苗 今週・来週やること</h1>
        <p style={{ fontSize: '10pt', marginBottom: '10pt' }}>{fmtMD(today)} 〜 {fmtMD(addDays(today, 13))}　（印刷日 {today}）</p>
        {printTasks.length === 0 ? (
          <p style={{ fontSize: '12pt' }}>この2週間にやる育苗の作業はありません。</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11pt' }}>
            <thead>
              <tr>
                {['済', '日付', '作業', '作目・畑', 'トレイ', '種・苗の数'].map(h => (
                  <th key={h} style={{ border: '1px solid #333', padding: '4pt', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {printTasks.map(t => (
                <tr key={t.key}>
                  <td style={{ border: '1px solid #333', padding: '4pt', width: '24pt' }}>□</td>
                  <td style={{ border: '1px solid #333', padding: '4pt' }}>{fmtMD(t.date)}{t.overdue ? '（遅れ）' : ''}</td>
                  <td style={{ border: '1px solid #333', padding: '4pt' }}>{taskText(t)}</td>
                  <td style={{ border: '1px solid #333', padding: '4pt' }}>{t.row.cropName}{t.row.variety ? ` ${t.row.variety}` : ''} ／ {t.row.fieldName}</td>
                  <td style={{ border: '1px solid #333', padding: '4pt' }}>{t.kind === 'sowing' ? (t.row.trays !== null ? `${t.row.trays}枚（${t.row.trayCells}穴）` : '—') : ''}</td>
                  <td style={{ border: '1px solid #333', padding: '4pt' }}>
                    {t.kind === 'sowing' ? `種 ${fmtN(t.row.seeds)}粒` : t.kind === 'potting' ? `苗 約${fmtN(t.row.withSpare)}本` : t.kind === 'planting' ? `苗 ${fmtN(t.row.needed)}本` : '芽が出たか確認'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 記録モーダル */}
      {recordTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={() => !isSaving && setRecordTarget(null)}>
          <form onSubmit={submitRecord} onClick={e => e.stopPropagation()} className="bg-white rounded-3xl shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-black text-slate-800">✅ {RECORD_LABEL[recordTarget.type]}を記録する</h3>
                <p className="text-xs font-bold text-slate-500">{recordTarget.row.cropName}{recordTarget.row.variety ? ` ${recordTarget.row.variety}` : ''} ／ {recordTarget.row.fieldName}</p>
              </div>
              <button type="button" onClick={() => setRecordTarget(null)} className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="block text-xs font-black text-slate-600 mb-1">
                {recordTarget.type === 'germination' ? '芽が出そろった日' : 'やった日'}
              </label>
              <input type="date" value={recordDate} onChange={e => setRecordDate(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-600 mb-1">
                {recordTarget.type === 'sowing'
                  ? 'まいた種の数（粒）'
                  : recordTarget.type === 'germination'
                    ? '芽が出た苗の数（本／穴）'
                    : recordTarget.type === 'potting'
                      ? '鉢上げした苗の数（本）'
                      : '植えた苗の数（本）'}
              </label>
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={recordQty}
                onChange={e => setRecordQty(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-lg focus:outline-none focus:border-emerald-500"
                placeholder="例: 2000"
              />
              <p className="text-[11px] font-bold text-slate-400 mt-1">
                {recordTarget.type === 'germination'
                  ? 'まいた数と芽が出た日から、うちの農園の「実際の発芽率」と「発芽までの日数」を自動で計算します。'
                  : 'はじめは計算した数が入っています。実際の数に直してください。'}
              </p>
            </div>
            <div>
              <label className="block text-xs font-black text-slate-600 mb-1">メモ（任意）</label>
              <input type="text" value={recordMemo} onChange={e => setRecordMemo(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-emerald-500" placeholder="例: 2号ハウスでまいた" />
            </div>
            <button type="submit" disabled={isSaving} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              記録する
            </button>
          </form>
        </div>
      )}

      {/* 予備・まく日モーダル */}
      {settingsRow && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={() => !isSaving && setSettingsRow(null)}>
          <form onSubmit={submitSettings} onClick={e => e.stopPropagation()} className="bg-white rounded-3xl shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-black text-slate-800">⚙️ 予備・まく日を変える</h3>
                <p className="text-xs font-bold text-slate-500">{settingsRow.cropName} ／ {settingsRow.fieldName}</p>
              </div>
              <button type="button" onClick={() => setSettingsRow(null)} className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="block text-xs font-black text-slate-600 mb-1">予備（植え替えの失敗や欠株にそなえて多めに作る割合）</label>
              <div className="flex items-center gap-2">
                <input type="number" min="0" max="100" value={settingsLoss} onChange={e => setSettingsLoss(e.target.value)} className="w-28 p-3 bg-slate-50 border border-slate-200 rounded-xl font-black focus:outline-none focus:border-emerald-500" />
                <span className="text-sm font-black text-slate-600">%</span>
                <div className="flex gap-1 ml-auto">
                  {[5, 10, 15, 20].map(v => (
                    <button key={v} type="button" onClick={() => setSettingsLoss(String(v))} className="px-2 py-1 text-xs font-bold bg-white border border-slate-200 rounded-lg hover:bg-emerald-50 cursor-pointer">{v}%</button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-black text-slate-600 mb-1">まく日（空欄なら自動で計算）</label>
              <input type="date" value={settingsSowDate} onChange={e => setSettingsSowDate(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-emerald-500" />
              <p className="text-[11px] font-bold text-slate-400 mt-1">
                {settingsRow.plantDate && settingsRow.nurseryDays !== null
                  ? `自動で計算した日：${fmtMD(addDays(settingsRow.plantDate, -settingsRow.nurseryDays))}（植え付け ${settingsRow.plantLabel} − 育苗${settingsRow.nurseryDays}日）`
                  : '育苗日数か植え付け時期が未設定のため、自動では計算できません。'}
              </p>
              {settingsSowDate && (
                <button type="button" onClick={() => setSettingsSowDate('')} className="mt-1 text-xs font-black text-emerald-700 underline cursor-pointer">自動の日に戻す</button>
              )}
            </div>
            <button type="submit" disabled={isSaving} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              保存する
            </button>
          </form>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl text-sm font-bold">
          {toast}
        </div>
      )}
    </div>
  );
}
