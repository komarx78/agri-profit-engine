"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { getCurrentTenantId } from '@/lib/tenant';
import {
  getMaterialRequirementsPageData,
  saveTenantCropStandardAction,
  saveMaterialInventoryAction,
  quickCreateMaterialAction
} from '@/app/actions/farm';
import { HelpTooltip } from '@/components/HelpTooltip';
import {
  Package,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Calculator,
  Plus,
  Trash2,
  Printer,
  CheckCircle2,
  AlertCircle,
  Sprout,
  ShoppingCart,
  Banknote,
  Settings2,
  RefreshCw,
  Check,
  X,
  Calendar,
  Boxes
} from 'lucide-react';

// 作付け計画の variety カラムから JSONメタデータ等を除去して綺麗な品種名だけを取り出す
function cleanVarietyLabel(rawVariety?: string | null): string {
  if (!rawVariety) return '';
  const str = String(rawVariety);
  const metaIdx = str.indexOf('||META:');
  const base = metaIdx >= 0 ? str.slice(0, metaIdx) : str;
  if (base.trim().startsWith('{') && base.trim().endsWith('}')) {
    try {
      const parsed = JSON.parse(base.trim());
      return parsed.variety || parsed.cleanVariety || '';
    } catch {
      return '';
    }
  }
  return base.trim();
}

// 作付け計画の面積(a)を取得（計画の面積が未設定なら畑マスタの面積を使用）
function getPlanAreaAcre(plan: any, fields: any[]): number {
  if (plan.calculated_area !== undefined && plan.calculated_area !== null && Number(plan.calculated_area) > 0) {
    return Math.round(Number(plan.calculated_area) * 10) / 10;
  }
  const f = plan.fields || fields.find((x: any) => x.id === plan.field_id);
  if (f?.area_size !== undefined && f?.area_size !== null && Number(f.area_size) > 0) {
    return Math.round(Number(f.area_size) * 10) / 10;
  }
  if (f?.area_sqm !== undefined && f?.area_sqm !== null && Number(f.area_sqm) > 0) {
    return Math.round((Number(f.area_sqm) / 100) * 10) / 10;
  }
  return 10;
}

// 資材の区分を分かりやすい3分類（肥料 / 資材 / 農薬）に判定
function getMaterialKind(mat: any): 'fertilizer' | 'material' | 'pesticide' {
  const mt = String(mat?.material_type || '').toLowerCase();
  const cat = String(mat?.category || '');
  if (mt === 'fertilizer' || cat.includes('肥料')) return 'fertilizer';
  if (mt === 'pesticide' || cat.includes('農薬')) return 'pesticide';
  return 'material';
}

export default function MaterialRequirementsPage() {
  const [tenantId, setTenantId] = useState<string>('');
  const [materials, setMaterials] = useState<any[]>([]);
  const [crops, setCrops] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [cropStandards, setCropStandards] = useState<any[]>([]);
  const [inventoryMap, setInventoryMap] = useState<Record<string, { stock?: number; ordered?: boolean }>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  // 画面モード: 'shopping' (買い物・注文リスト) | 'setup' (作目ごとに使う肥料・資材を設定)
  const [viewMode, setViewMode] = useState<'shopping' | 'setup'>('shopping');
  // 時期フィルター: 'all' (通年すべて) | 'spring' (1〜7月開始の作付け) | 'autumn' (8〜12月開始の作付け)
  const [seasonFilter, setSeasonFilter] = useState<'all' | 'spring' | 'autumn'>('all');
  // カテゴリフィルター
  const [kindFilter, setKindFilter] = useState<'all' | 'fertilizer' | 'material' | 'pesticide'>('all');

  // 作目別の資材設定追加用ローカルステート
  const [selectedAddMaterialByCrop, setSelectedAddMaterialByCrop] = useState<Record<string, string>>({});
  const [selectedAddAmountByCrop, setSelectedAddAmountByCrop] = useState<Record<string, string>>({});
  const [savingCropId, setSavingCropId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // 新規資材クイック登録モーダル用ステート
  const [isNewMatModalOpen, setIsNewMatModalOpen] = useState(false);
  const [newMatTargetCropId, setNewMatTargetCropId] = useState<string>('');
  const [newMatName, setNewMatName] = useState('');
  const [newMatKind, setNewMatKind] = useState<'fertilizer' | 'material' | 'pesticide'>('fertilizer');
  const [newMatUnit, setNewMatUnit] = useState('袋');
  const [newMatPrice, setNewMatPrice] = useState('');
  const [newMatSpec, setNewMatSpec] = useState('');
  const [newMatAmountPer10a, setNewMatAmountPer10a] = useState('1');
  const [isCreatingMat, setIsCreatingMat] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(prev => (prev === msg ? null : prev));
    }, 3500);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const tid = await getCurrentTenantId();
      if (!tid) {
        setIsLoading(false);
        return;
      }
      setTenantId(tid);

      const res = await getMaterialRequirementsPageData(tid);
      if (res.success) {
        setMaterials(res.materials || []);
        setCrops(res.crops || []);
        setFields(res.fields || []);
        setPlans(res.plans || []);
        setCropStandards(res.cropStandards || []);
        setInventoryMap(res.inventoryMap || {});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // 対象年度・時期フィルターに合致する作付け計画一覧
  const activePlans = useMemo(() => {
    return plans.filter((p: any) => {
      const matchYear = !p.year || Number(p.year) === year;
      if (!matchYear) return false;
      const sMonth = Number(p.start_month) || 1;
      if (seasonFilter === 'spring') return sMonth >= 1 && sMonth <= 7;
      if (seasonFilter === 'autumn') return sMonth >= 8 && sMonth <= 12;
      return true;
    });
  }, [plans, year, seasonFilter]);

  // 作付け計画に含まれる作目一覧（計画がある作目を優先表示）
  const plannedCropSummaryList = useMemo(() => {
    const map = new Map<string, { cropId: string; cropName: string; totalAreaAcre: number; plans: any[]; materialsPer10a: Array<{ material_id: string; amount: number }> }>();

    activePlans.forEach((p: any) => {
      const cropId = p.crop_id;
      if (!cropId) return;
      const cropObj = p.crops || crops.find((c: any) => c.id === cropId);
      const cropName = cropObj?.name || '名称未設定';
      const area = getPlanAreaAcre(p, fields);
      const std = cropStandards.find((s: any) => s.crop_id === cropId);
      const mats = Array.isArray(std?.materials_per_10a) ? std.materials_per_10a : [];

      if (!map.has(cropId)) {
        map.set(cropId, {
          cropId,
          cropName,
          totalAreaAcre: 0,
          plans: [],
          materialsPer10a: mats
        });
      }
      const entry = map.get(cropId)!;
      entry.totalAreaAcre = Math.round((entry.totalAreaAcre + area) * 10) / 10;
      entry.plans.push({ ...p, resolvedAreaAcre: area });
      entry.materialsPer10a = mats;
    });

    // 計画がまだない登録作目も後ろに追加（設定タブでいつでも設定できるようにする）
    crops.forEach((c: any) => {
      if (!map.has(c.id)) {
        const std = cropStandards.find((s: any) => s.crop_id === c.id);
        const mats = Array.isArray(std?.materials_per_10a) ? std.materials_per_10a : [];
        map.set(c.id, {
          cropId: c.id,
          cropName: c.name,
          totalAreaAcre: 0,
          plans: [],
          materialsPer10a: mats
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalAreaAcre - a.totalAreaAcre);
  }, [activePlans, crops, fields, cropStandards]);

  // 作付け計画があるのに、使う肥料・資材が1つも設定されていない作目
  const unconfiguredPlannedCrops = useMemo(() => {
    return plannedCropSummaryList.filter(c => c.totalAreaAcre > 0 && c.materialsPer10a.length === 0);
  }, [plannedCropSummaryList]);

  // 資材ごとの必要量・買い物リスト集計
  const shoppingList = useMemo(() => {
    const reqMap: Record<
      string,
      {
        material: any;
        kind: 'fertilizer' | 'material' | 'pesticide';
        totalExactAmount: number;
        recommendedBuyUnitCount: number;
        currentStock: number;
        shortageToBuy: number;
        unitPrice: number;
        estimatedCost: number;
        isOrdered: boolean;
        earliestMonth: number;
        details: Array<{
          plan: any;
          cropId: string;
          cropName: string;
          fieldName: string;
          areaAcre: number;
          amountPer10a: number;
          calculatedAmount: number;
          startMonth: number;
          endMonth: number;
          cleanVariety: string;
        }>;
      }
    > = {};

    activePlans.forEach((plan: any) => {
      const areaAcre = getPlanAreaAcre(plan, fields);
      if (areaAcre <= 0) return;

      const std = cropStandards.find((s: any) => s.crop_id === plan.crop_id);
      if (!std || !Array.isArray(std.materials_per_10a)) return;

      const cropObj = plan.crops || crops.find((c: any) => c.id === plan.crop_id);
      const cropName = cropObj?.name || '作目';
      const fieldObj = plan.fields || fields.find((f: any) => f.id === plan.field_id);
      const fieldName = fieldObj?.name || '畑未指定';

      std.materials_per_10a.forEach((m: any) => {
        const mat = materials.find((x: any) => x.id === m.material_id);
        if (!mat) return;
        const per10a = Number(m.amount) || 0;
        if (per10a <= 0) return;

        const calcAmt = (areaAcre / 10) * per10a;
        const kind = getMaterialKind(mat);
        const sMonth = Number(plan.start_month) || 1;
        const eMonth = Number(plan.end_month) || sMonth;

        if (!reqMap[mat.id]) {
          const inv = inventoryMap[mat.id] || {};
          reqMap[mat.id] = {
            material: mat,
            kind,
            totalExactAmount: 0,
            recommendedBuyUnitCount: 0,
            currentStock: Number(inv.stock) || 0,
            shortageToBuy: 0,
            unitPrice: Number(mat.default_price) || 0,
            estimatedCost: 0,
            isOrdered: Boolean(inv.ordered),
            earliestMonth: sMonth,
            details: []
          };
        }

        const item = reqMap[mat.id];
        item.totalExactAmount += calcAmt;
        if (sMonth < item.earliestMonth) item.earliestMonth = sMonth;
        item.details.push({
          plan,
          cropId: plan.crop_id,
          cropName,
          fieldName,
          areaAcre,
          amountPer10a: per10a,
          calculatedAmount: calcAmt,
          startMonth: sMonth,
          endMonth: eMonth,
          cleanVariety: cleanVarietyLabel(plan.variety)
        });
      });
    });

    return Object.values(reqMap)
      .map(item => {
        // 袋・巻・本・箱などは端数を切り上げて「買う数」を算出
        const recommendedBuyUnitCount = Math.ceil(Math.round(item.totalExactAmount * 100) / 100);
        const shortageToBuy = Math.max(0, recommendedBuyUnitCount - item.currentStock);
        const estimatedCost = shortageToBuy * item.unitPrice;
        return {
          ...item,
          totalExactAmount: Math.round(item.totalExactAmount * 10) / 10,
          recommendedBuyUnitCount,
          shortageToBuy,
          estimatedCost
        };
      })
      .filter(item => kindFilter === 'all' || item.kind === kindFilter)
      .sort((a, b) => a.earliestMonth - b.earliestMonth);
  }, [activePlans, fields, cropStandards, crops, materials, inventoryMap, kindFilter]);

  // 全体サマリー計算
  const summaryStats = useMemo(() => {
    const totalPlannedArea = Math.round(
      activePlans.reduce((sum, p) => sum + getPlanAreaAcre(p, fields), 0) * 10
    ) / 10;
    const uniqueCropCount = new Set(activePlans.map(p => p.crop_id).filter(Boolean)).size;
    const uniqueFieldCount = new Set(activePlans.map(p => p.field_id).filter(Boolean)).size;
    const totalItemsCount = shoppingList.length;
    const itemsToBuyCount = shoppingList.filter(i => i.shortageToBuy > 0 && !i.isOrdered).length;
    const totalEstimatedCost = shoppingList.reduce((sum, i) => sum + i.estimatedCost, 0);

    return {
      totalPlannedArea,
      uniqueCropCount,
      uniqueFieldCount,
      totalItemsCount,
      itemsToBuyCount,
      totalEstimatedCost
    };
  }, [activePlans, fields, shoppingList]);

  // 作目ごとの 10aあたり使用資材リストを更新してDB保存するハンドラ
  const handleUpdateCropMaterials = async (
    cropId: string,
    newMaterialsList: Array<{ material_id: string; amount: number }>
  ) => {
    if (!tenantId || !cropId) return;
    setSavingCropId(cropId);

    // 楽観的UI更新
    setCropStandards(prev => {
      const exists = prev.some(s => s.crop_id === cropId);
      if (exists) {
        return prev.map(s => (s.crop_id === cropId ? { ...s, materials_per_10a: newMaterialsList } : s));
      }
      return [...prev, { crop_id: cropId, materials_per_10a: newMaterialsList }];
    });

    const res = await saveTenantCropStandardAction(tenantId, cropId, {
      materials_per_10a: newMaterialsList
    });
    setSavingCropId(null);

    if (res.success) {
      showToast('10aあたりの使用量を保存し、必要量を再計算しました！');
    } else {
      alert('保存に失敗しました: ' + (res.error || ''));
    }
  };

  // 特定の作目・資材の 10aあたり数量を直接変更
  const handleChangeAmountPer10a = async (cropId: string, materialId: string, newAmount: number) => {
    const std = cropStandards.find(s => s.crop_id === cropId);
    const currentList: Array<{ material_id: string; amount: number }> = Array.isArray(std?.materials_per_10a)
      ? [...std.materials_per_10a]
      : [];
    const idx = currentList.findIndex(x => x.material_id === materialId);
    if (idx >= 0) {
      currentList[idx] = { ...currentList[idx], amount: Math.max(0, newAmount) };
    } else {
      currentList.push({ material_id: materialId, amount: Math.max(0, newAmount) });
    }
    await handleUpdateCropMaterials(cropId, currentList);
  };

  // 特定の作目から資材設定を削除
  const handleRemoveMaterialFromCrop = async (cropId: string, materialId: string) => {
    const std = cropStandards.find(s => s.crop_id === cropId);
    const currentList: Array<{ material_id: string; amount: number }> = Array.isArray(std?.materials_per_10a)
      ? std.materials_per_10a.filter((x: any) => x.material_id !== materialId)
      : [];
    await handleUpdateCropMaterials(cropId, currentList);
  };

  // 手持ち在庫数・注文済フラグ・単価の即時更新
  const handleUpdateInventoryOrPrice = async (
    materialId: string,
    patch: { stock?: number; ordered?: boolean; unitPrice?: number }
  ) => {
    if (!tenantId) return;

    if (patch.stock !== undefined || patch.ordered !== undefined) {
      setInventoryMap(prev => ({
        ...prev,
        [materialId]: {
          ...(prev[materialId] || {}),
          ...(patch.stock !== undefined ? { stock: Math.max(0, patch.stock) } : {}),
          ...(patch.ordered !== undefined ? { ordered: patch.ordered } : {})
        }
      }));
    }
    if (patch.unitPrice !== undefined) {
      setMaterials(prev =>
        prev.map(m => (m.id === materialId ? { ...m, default_price: Math.max(0, patch.unitPrice!) } : m))
      );
    }

    await saveMaterialInventoryAction(tenantId, materialId, patch);
  };

  // 新しい肥料・資材をその場でマスタ登録＆作目に紐付け
  const handleCreateNewMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !newMatName.trim()) return;
    setIsCreatingMat(true);
    try {
      const categoryLabel =
        newMatKind === 'fertilizer' ? '肥料' : newMatKind === 'pesticide' ? '農薬' : '資材・種苗等';
      const res = await quickCreateMaterialAction(tenantId, {
        name: newMatName.trim(),
        category: categoryLabel,
        material_type: newMatKind,
        unit: newMatUnit || '袋',
        default_price: Number(newMatPrice) || 0,
        specification: newMatSpec
      });

      if (res.success && res.data) {
        const createdMat = res.data;
        setMaterials(prev => [...prev, createdMat]);

        // 作目が指定されていればそのまま10a基準にも追加
        if (newMatTargetCropId) {
          const std = cropStandards.find(s => s.crop_id === newMatTargetCropId);
          const currentList = Array.isArray(std?.materials_per_10a) ? [...std.materials_per_10a] : [];
          currentList.push({
            material_id: createdMat.id,
            amount: Math.max(0.1, Number(newMatAmountPer10a) || 1)
          });
          await handleUpdateCropMaterials(newMatTargetCropId, currentList);
        }

        showToast(`「${createdMat.name}」を登録しました！`);
        setIsNewMatModalOpen(false);
        setNewMatName('');
        setNewMatPrice('');
        setNewMatSpec('');
      } else {
        alert(res.error || '登録に失敗しました');
      }
    } finally {
      setIsCreatingMat(false);
    }
  };

  return (
    <div className="max-w-[95vw] mx-auto px-4 sm:px-6 space-y-6 pb-16 pt-4 sm:pt-6 relative">
      {/* トースト通知 */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-700 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-sm font-black print:hidden">
          <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 1. ヘッダー ＆ 年度切替・注文メモ印刷ボタン */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2.5">
            <Calculator className="w-7 h-7 text-amber-600 shrink-0" />
            <span>肥料・資材の必要量（買い物・注文リスト）</span>
            <span className="print:hidden">
              <HelpTooltip content="「作付けこよみ（計画）」の面積から、今年買うべき肥料やマルチ・資材の数を自動計算します。この画面上で「10aあたり何袋使うか」や「いま納屋にある在庫数」を直接入力・調整でき、そのまま農協（JA）や資材店への注文メモとして印刷できます。" />
            </span>
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1.5 font-bold">
            作付け面積 × 10aあたり使用量から、「手持ち在庫を引いた今回買う数」と「概算金額」を自動計算します。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 print:hidden">
          {/* 年度セレクター */}
          <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => setYear(y => y - 1)}
              className="p-2.5 hover:bg-slate-100 transition-colors cursor-pointer"
              title="前年度"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <div className="px-4 font-black text-sm text-slate-800">{year}年度</div>
            <button
              type="button"
              onClick={() => setYear(y => y + 1)}
              className="p-2.5 hover:bg-slate-100 transition-colors cursor-pointer"
              title="翌年度"
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setNewMatTargetCropId(plannedCropSummaryList[0]?.cropId || '');
              setIsNewMatModalOpen(true);
            }}
            className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-600" />
            <span>新しい肥料・資材を登録</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>注文メモ（買い物リスト）を印刷</span>
          </button>

          <button
            type="button"
            onClick={fetchData}
            className="p-2.5 text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
            title="最新データを再読み込み"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. 4つの要点サマリーカード（一目で今年の必要規模と予算がわかる） */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <Sprout className="w-4 h-4 text-emerald-600" />
            <span>対象の作付け計画（{year}年）</span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-800">{summaryStats.uniqueCropCount}</span>
            <span className="text-xs font-bold text-slate-500">
              作目 / 延べ <strong className="text-slate-800">{summaryStats.totalPlannedArea}a</strong>（{summaryStats.uniqueFieldCount}圃場）
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <Package className="w-4 h-4 text-blue-600" />
            <span>必要な肥料・資材の種類</span>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <div>
              <span className="text-2xl font-black text-slate-800">{summaryStats.totalItemsCount}</span>
              <span className="text-xs font-bold text-slate-500 ml-1">品目</span>
            </div>
            {unconfiguredPlannedCrops.length > 0 && (
              <button
                type="button"
                onClick={() => setViewMode('setup')}
                className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-[11px] font-black transition-colors cursor-pointer print:hidden"
              >
                ⚠️ {unconfiguredPlannedCrops.length}作目が未設定 ➔
              </button>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <ShoppingCart className="w-4 h-4 text-amber-600" />
            <span>今回買い足す品目数（在庫差引後）</span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600">{summaryStats.itemsToBuyCount}</span>
            <span className="text-xs font-bold text-slate-500">
              品目を注文予定（全{summaryStats.totalItemsCount}品目中）
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/40 shadow-2xs">
          <div className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
            <Banknote className="w-4 h-4 text-emerald-600" />
            <span>買い足し概算金額（予算合計）</span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-700">
              ¥{summaryStats.totalEstimatedCost.toLocaleString()}
            </span>
            <span className="text-[11px] font-bold text-slate-400">（注文数 × 単価）</span>
          </div>
        </div>
      </div>

      {/* 3. 作付け計画があるのに資材未設定の作目がある場合の親切ガイドバナー */}
      {unconfiguredPlannedCrops.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-black text-amber-950">
                作付け計画がある作目のうち、まだ「使う肥料・資材」が登録されていない作目があります：
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {unconfiguredPlannedCrops.map(c => (
                  <span
                    key={c.cropId}
                    className="px-2.5 py-0.5 bg-white border border-amber-300 text-amber-900 rounded-lg text-xs font-black"
                  >
                    🌱 {c.cropName}（計画 {c.totalAreaAcre}a）
                  </span>
                ))}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'setup' ? 'shopping' : 'setup')}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shrink-0 shadow-2xs transition-colors cursor-pointer"
          >
            {viewMode === 'setup' ? '🛒 買い物リストに戻る' : '⚙️ この画面で使う肥料・資材を設定する ➔'}
          </button>
        </div>
      )}

      {/* 4. モード切替タブ ＆ 時期・カテゴリ絞り込みバー */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3 print:hidden">
        {/* 左側: 2大モード切替（買い物リスト vs 作目別設定） */}
        <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 self-start">
          <button
            type="button"
            onClick={() => setViewMode('shopping')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-black flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'shopping'
                ? 'bg-white text-amber-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>① 買い物・注文リスト ({shoppingList.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('setup')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-black flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'setup'
                ? 'bg-white text-emerald-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            <span>② 作目ごとに使う肥料・資材を設定 ({plannedCropSummaryList.length})</span>
          </button>
        </div>

        {/* 右側: 時期フィルター ＆ 資材区分フィルター */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 時期フィルター */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <span className="px-2 text-slate-400 font-black flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              時期:
            </span>
            {(
              [
                { id: 'all', label: '通年すべて' },
                { id: 'spring', label: '🌸 春〜夏作 (1〜7月)' },
                { id: 'autumn', label: '🍁 秋〜冬作 (8〜12月)' }
              ] as const
            ).map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSeasonFilter(s.id)}
                className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  seasonFilter === s.id ? 'bg-slate-800 text-white font-black' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* 資材カテゴリフィルター（買い物リスト表示時のみ） */}
          {viewMode === 'shopping' && (
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
              {(
                [
                  { id: 'all', label: 'すべて' },
                  { id: 'fertilizer', label: '🔬 肥料' },
                  { id: 'material', label: '📦 資材・マルチ' },
                  { id: 'pesticide', label: '🧪 農薬' }
                ] as const
              ).map(k => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setKindFilter(k.id)}
                  className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    kindFilter === k.id ? 'bg-amber-600 text-white font-black' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. メインコンテンツ */}
      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center gap-2 text-amber-600">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-xs font-bold text-slate-500">作付け計画と資材データを集計しています...</p>
        </div>
      ) : viewMode === 'shopping' ? (
        /* ========================================================================= */
        /* 🛒 モード①: 買い物・注文リスト（在庫差引・切り上げ購入数・概算金額・内訳） */
        /* ========================================================================= */
        <div className="space-y-5">
          {shoppingList.length === 0 ? (
            <div className="bg-white rounded-3xl shadow-2xs border border-slate-200 p-12 text-center space-y-4">
              <Boxes className="w-12 h-12 text-amber-500 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-800">
                  まだこの条件で計算できる肥料・資材の設定がありません
                </h3>
                <p className="text-xs font-bold text-slate-500 max-w-lg mx-auto leading-relaxed">
                  わざわざ別のマスタ画面へ移動しなくても、すぐ隣の「<strong>② 作目ごとに使う肥料・資材を設定</strong>」タブから、各作物に使う肥料やマルチをその場で登録できます！
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewMode('setup')}
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm transition-colors cursor-pointer"
              >
                ⚙️ 作目ごとに使う肥料・資材を設定する ➔
              </button>
            </div>
          ) : (
            shoppingList.map(item => {
              const kindBadge =
                item.kind === 'fertilizer'
                  ? { label: '🔬 肥料', cls: 'bg-teal-50 text-teal-800 border-teal-200' }
                  : item.kind === 'pesticide'
                  ? { label: '🧪 農薬', cls: 'bg-rose-50 text-rose-800 border-rose-200' }
                  : { label: '📦 農業資材', cls: 'bg-blue-50 text-blue-800 border-blue-200' };

              const unitLabel = item.material.unit || '袋';

              return (
                <div
                  key={item.material.id}
                  className={`bg-white rounded-3xl shadow-2xs border-2 overflow-hidden transition-all ${
                    item.isOrdered
                      ? 'border-emerald-300 bg-emerald-50/10'
                      : item.shortageToBuy > 0
                      ? 'border-slate-200'
                      : 'border-slate-200 opacity-90'
                  }`}
                >
                  {/* カード上部：資材名・手持ち在庫入力・今回買う数・単価・概算金額 */}
                  <div className="bg-slate-50/80 border-b border-slate-100 p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    {/* 左：資材名・区分・使う時期 */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black border ${kindBadge.cls}`}>
                          {kindBadge.label}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-slate-200/70 text-slate-700">
                          📅 {item.earliestMonth}月頃の作付けから使用
                        </span>
                        {item.material.specification && (
                          <span className="text-xs font-bold text-slate-500">
                            （規格: {item.material.specification}）
                          </span>
                        )}
                        {item.isOrdered && (
                          <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-emerald-600 text-white flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> 注文・手配済
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg sm:text-xl font-black text-slate-900">{item.material.name}</h3>
                    </div>

                    {/* 右：必要量 ➔ 手持ち在庫 ➔ 今回買う数 ➔ 単価・金額 ➔ 注文済ボタン */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 items-center bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs">
                      {/* ① 計算上の必要量 */}
                      <div className="px-2">
                        <div className="text-[10px] font-bold text-slate-400">① 畑の面積からの必要量</div>
                        <div className="text-base font-black text-slate-800 mt-0.5">
                          {item.recommendedBuyUnitCount.toLocaleString()}{' '}
                          <span className="text-xs font-bold text-slate-500">{unitLabel}</span>
                        </div>
                        {item.totalExactAmount !== item.recommendedBuyUnitCount && (
                          <div className="text-[10px] font-bold text-slate-400">
                            (計算値 {item.totalExactAmount} {unitLabel} を切上)
                          </div>
                        )}
                      </div>

                      {/* ② いま納屋にある在庫数 */}
                      <div className="px-2 border-l border-slate-100">
                        <label className="text-[10px] font-bold text-slate-500 block">
                          🏠 ② いまある手持ち在庫
                        </label>
                        <div className="flex items-center gap-1 mt-1">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={item.currentStock}
                            onChange={e =>
                              handleUpdateInventoryOrPrice(item.material.id, {
                                stock: Number(e.target.value)
                              })
                            }
                            className="w-16 px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-right text-sm font-black text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                          />
                          <span className="text-xs font-bold text-slate-500">{unitLabel}</span>
                        </div>
                      </div>

                      {/* ③ 今回買い足す数（注文数） */}
                      <div className="px-2 border-l border-slate-100">
                        <div className="text-[10px] font-black text-amber-700">🛒 ③ 今回買う数（不足分）</div>
                        {item.shortageToBuy > 0 ? (
                          <div className="text-xl font-black text-amber-600 mt-0.5">
                            {item.shortageToBuy.toLocaleString()}{' '}
                            <span className="text-xs font-bold">{unitLabel}</span>
                          </div>
                        ) : (
                          <div className="text-xs font-black text-emerald-600 mt-1">
                            ✨ 在庫で足ります (0{unitLabel})
                          </div>
                        )}
                      </div>

                      {/* ④ 単価 ＆ 概算金額 */}
                      <div className="px-2 border-l border-slate-100">
                        <label className="text-[10px] font-bold text-slate-500 block">
                          💴 1{unitLabel}の単価 / 概算額
                        </label>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs font-bold text-slate-400">¥</span>
                          <input
                            type="number"
                            min="0"
                            step="10"
                            value={item.unitPrice || ''}
                            placeholder="単価"
                            onChange={e =>
                              handleUpdateInventoryOrPrice(item.material.id, {
                                unitPrice: Number(e.target.value)
                              })
                            }
                            className="w-20 px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-right text-xs font-black text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          />
                        </div>
                        <div className="text-[11px] font-black text-emerald-700 mt-1">
                          小計: ¥{item.estimatedCost.toLocaleString()}
                        </div>
                      </div>

                      {/* ⑤ 注文済チェックボタン */}
                      <div className="px-2 border-l border-slate-100 flex justify-end print:hidden">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateInventoryOrPrice(item.material.id, {
                              ordered: !item.isOrdered
                            })
                          }
                          className={`w-full py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            item.isOrdered
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-200'
                          }`}
                        >
                          <Check className="w-4 h-4" />
                          <span>{item.isOrdered ? '注文・手配済' : '注文済にする'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* カード下部：どの畑・どの作物で何袋使うかの内訳テーブル（その場で10a基準も修正可能！） */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-500 bg-white border-b border-slate-100">
                        <tr>
                          <th className="px-5 py-2.5 font-bold">使う畑（面積）</th>
                          <th className="px-5 py-2.5 font-bold">作目・作付け時期</th>
                          <th className="px-5 py-2.5 font-bold text-right">
                            10a（1反）あたりの使用量 <span className="text-[10px] text-amber-600 font-black print:hidden">※直接変更可</span>
                          </th>
                          <th className="px-5 py-2.5 font-bold text-right">この畑での必要量</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {item.details.map((detail, dIdx) => (
                          <tr key={dIdx} className="hover:bg-slate-50/60">
                            <td className="px-5 py-2.5 font-black text-slate-800">
                              📍 {detail.fieldName}{' '}
                              <span className="text-xs text-slate-500 font-bold ml-1">({detail.areaAcre}a)</span>
                            </td>
                            <td className="px-5 py-2.5 font-bold text-slate-700">
                              🌱 {detail.cropName}
                              {detail.cleanVariety && (
                                <span className="text-xs text-slate-500 ml-1">({detail.cleanVariety})</span>
                              )}
                              <span className="text-xs text-slate-400 ml-2">
                                [{detail.startMonth}月〜{detail.endMonth}月]
                              </span>
                            </td>
                            <td className="px-5 py-2.5 text-right">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <span className="text-[11px] text-slate-400 font-bold">10aあたり</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={detail.amountPer10a}
                                  onChange={e =>
                                    handleChangeAmountPer10a(
                                      detail.cropId,
                                      item.material.id,
                                      Number(e.target.value)
                                    )
                                  }
                                  className="w-16 px-2 py-1 bg-amber-50/60 border border-amber-300 rounded-lg text-right text-xs font-black text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                                  title="ここを変えると、この作目の10aあたり使用基準がすぐに更新されます"
                                />
                                <span className="text-xs font-bold text-slate-600">{unitLabel}</span>
                              </div>
                            </td>
                            <td className="px-5 py-2.5 text-right font-black text-slate-900">
                              {Number(detail.calculatedAmount.toFixed(1)).toLocaleString()} {unitLabel}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* ⚙️ モード②: 作目ごとに使う肥料・資材をその場で設定（マスタ画面への移動不要！） */
        /* ========================================================================= */
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs sm:text-sm font-bold text-emerald-950">
              💡 <strong>作目ごとに「10a（1反）あたりどの肥料・資材を何袋（何巻）使うか」</strong>をここで直接登録・変更できます。登録するとすぐに「① 買い物・注文リスト」に反映されます。
            </div>
            <button
              type="button"
              onClick={() => {
                setNewMatTargetCropId(plannedCropSummaryList[0]?.cropId || '');
                setIsNewMatModalOpen(true);
              }}
              className="px-3.5 py-2 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-black shrink-0 cursor-pointer"
            >
              ＋ 選択肢にない新しい肥料・資材を登録する
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {plannedCropSummaryList.map(cropItem => {
              const selectedMatId = selectedAddMaterialByCrop[cropItem.cropId] || '';
              const selectedAmt = selectedAddAmountByCrop[cropItem.cropId] ?? '1';

              return (
                <div
                  key={cropItem.cropId}
                  className="bg-white rounded-3xl border border-slate-200 shadow-2xs p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    {/* 作目ヘッダー */}
                    <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-black text-slate-900">🌱 {cropItem.cropName}</span>
                        {cropItem.totalAreaAcre > 0 ? (
                          <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-black">
                            今年度の作付面積: 合計 {cropItem.totalAreaAcre}a（{cropItem.plans.length}圃場）
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-slate-100 text-slate-500 rounded-lg text-xs font-bold">
                            今年度の作付計画なし
                          </span>
                        )}
                      </div>
                      {savingCropId === cropItem.cropId && (
                        <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> 保存中...
                        </span>
                      )}
                    </div>

                    {/* 登録済みの10aあたり資材一覧 */}
                    {cropItem.materialsPer10a.length === 0 ? (
                      <div className="p-4 bg-amber-50/60 border border-dashed border-amber-200 rounded-2xl text-xs font-bold text-amber-900 text-center">
                        まだ「{cropItem.cropName}」で使う肥料・資材が設定されていません。下の欄から追加してください。
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {cropItem.materialsPer10a.map((m, idx) => {
                          const mat = materials.find(x => x.id === m.material_id);
                          const unit = mat?.unit || '袋';
                          const totalForCrop =
                            Math.round(((cropItem.totalAreaAcre / 10) * (Number(m.amount) || 0)) * 10) / 10;
                          return (
                            <div
                              key={`${m.material_id}-${idx}`}
                              className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl"
                            >
                              <div className="min-w-0 flex-1">
                                <span className="text-sm font-black text-slate-800 block truncate">
                                  {mat ? mat.name : '不明な資材'}
                                </span>
                                {cropItem.totalAreaAcre > 0 && (
                                  <span className="text-[11px] font-bold text-slate-500">
                                    {cropItem.totalAreaAcre}a 全体で <strong className="text-amber-700">{totalForCrop}{unit}</strong> 必要
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-xs font-bold text-slate-500">10aあたり</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={m.amount}
                                  onChange={e =>
                                    handleChangeAmountPer10a(
                                      cropItem.cropId,
                                      m.material_id,
                                      Number(e.target.value)
                                    )
                                  }
                                  className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-right text-sm font-black text-slate-800"
                                />
                                <span className="text-xs font-bold text-slate-600 w-7">{unit}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMaterialFromCrop(cropItem.cropId, m.material_id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="この資材設定を外す"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* この作目に使う肥料・資材を追加するフォーム */}
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <label className="text-[11px] font-black text-slate-500 block">
                      ＋「{cropItem.cropName}」で使う肥料・マルチ・資材を追加する
                    </label>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <select
                        value={selectedMatId}
                        onChange={e =>
                          setSelectedAddMaterialByCrop(prev => ({
                            ...prev,
                            [cropItem.cropId]: e.target.value
                          }))
                        }
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                      >
                        <option value="">資材・肥料を選択してください...</option>
                        {materials.map(mat => (
                          <option key={mat.id} value={mat.id}>
                            [{mat.category || '資材'}] {mat.name}（単位: {mat.unit || '袋'}）
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-500 whitespace-nowrap">10aに</span>
                        <input
                          type="number"
                          min="0.1"
                          step="0.5"
                          value={selectedAmt}
                          onChange={e =>
                            setSelectedAddAmountByCrop(prev => ({
                              ...prev,
                              [cropItem.cropId]: e.target.value
                            }))
                          }
                          className="w-16 px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-right text-xs font-black text-slate-800"
                        />
                        <button
                          type="button"
                          disabled={!selectedMatId}
                          onClick={() => {
                            if (!selectedMatId) return;
                            handleChangeAmountPer10a(
                              cropItem.cropId,
                              selectedMatId,
                              Math.max(0.1, Number(selectedAmt) || 1)
                            );
                            setSelectedAddMaterialByCrop(prev => ({ ...prev, [cropItem.cropId]: '' }));
                          }}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-black whitespace-nowrap transition-colors cursor-pointer"
                        >
                          ＋ 追加
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. 新しい肥料・資材をその場で登録するモーダル */}
      {isNewMatModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">
                ✨ 新しい肥料・資材を登録
              </h3>
              <button
                type="button"
                onClick={() => setIsNewMatModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewMaterial} className="space-y-3.5">
              <div>
                <label className="block text-xs font-black text-slate-600 mb-1">種類（区分）</label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'fertilizer', label: '🔬 肥料' },
                      { id: 'material', label: '📦 資材・マルチ' },
                      { id: 'pesticide', label: '🧪 農薬' }
                    ] as const
                  ).map(k => (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => {
                        setNewMatKind(k.id);
                        if (k.id === 'fertilizer') setNewMatUnit('袋');
                        if (k.id === 'material') setNewMatUnit('巻');
                        if (k.id === 'pesticide') setNewMatUnit('本');
                      }}
                      className={`py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                        newMatKind === k.id
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-600 mb-1">
                  商品名（肥料・資材の名前） <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newMatName}
                  onChange={e => setNewMatName(e.target.value)}
                  placeholder="例: 化成肥料 8-8-8、黒マルチ 135cm×200m"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-600 mb-1">数え方（単位）</label>
                  <input
                    type="text"
                    value={newMatUnit}
                    onChange={e => setNewMatUnit(e.target.value)}
                    placeholder="袋、巻、本、箱..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-600 mb-1">1単位あたりの単価（円）</label>
                  <input
                    type="number"
                    min="0"
                    value={newMatPrice}
                    onChange={e => setNewMatPrice(e.target.value)}
                    placeholder="例: 2400"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-2">
                <label className="block text-xs font-black text-slate-600">
                  同時に作目の「10aあたり使用量」にも追加する（任意）
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={newMatTargetCropId}
                    onChange={e => setNewMatTargetCropId(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="">作目には紐付けずマスタ登録のみ</option>
                    {crops.map(c => (
                      <option key={c.id} value={c.id}>
                        🌱 {c.name} に使う資材として追加
                      </option>
                    ))}
                  </select>
                  {newMatTargetCropId && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-slate-500">10aに</span>
                      <input
                        type="number"
                        min="0.1"
                        step="0.5"
                        value={newMatAmountPer10a}
                        onChange={e => setNewMatAmountPer10a(e.target.value)}
                        className="w-16 px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-right text-xs font-black text-slate-800"
                      />
                      <span className="text-xs font-bold text-slate-600">{newMatUnit}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewMatModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isCreatingMat || !newMatName.trim()}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-black cursor-pointer"
                >
                  {isCreatingMat ? '登録中...' : '登録して反映する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
