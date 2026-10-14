"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { getCurrentTenantId } from '@/lib/tenant';
import {
  getMaterialRequirementsPageData,
  saveTenantCropStandardAction,
  savePlanMaterialOverrideAction,
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
  RefreshCw,
  Check,
  X,
  Calendar,
  MapPin,
  Copy,
  RotateCcw,
  ArrowDownUp,
  Sparkles
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
  // 畑（作付け計画ID）ごとの個別資材設定マップ: { [planId]: Array<{ material_id: string, amount: number }> }
  const [planMaterialMap, setPlanMaterialMap] = useState<Record<string, Array<{ material_id: string; amount: number }>>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  // 畑（圃場）フィルター: 'all' または field.id
  const [selectedFieldId, setSelectedFieldId] = useState<string>('all');
  // 時期フィルター: 'all' (通年すべて) | 'spring' (1〜7月開始の作付け) | 'autumn' (8〜12月開始の作付け)
  const [seasonFilter, setSeasonFilter] = useState<'all' | 'spring' | 'autumn'>('all');
  // カテゴリフィルター
  const [kindFilter, setKindFilter] = useState<'all' | 'fertilizer' | 'material' | 'pesticide'>('all');
  // 上下配置の切り替え（false = STEP1:畑ごとの準備が上 ➔ STEP2:買い物まとめ表が下 / true = 買い物まとめ表を一番上に表示）
  const [showShoppingTableFirst, setShowShoppingTableFirst] = useState<boolean>(false);

  // 各作付けカードでの資材追加用ローカルステート（キーは plan.id）
  const [selectedAddMaterialByPlan, setSelectedAddMaterialByPlan] = useState<Record<string, string>>({});
  const [selectedAddAmountByPlan, setSelectedAddAmountByPlan] = useState<Record<string, string>>({});
  // 追加時に「同じ野菜のすべての畑に反映('crop')」か「この畑だけ個別に設定('plan')」か（デフォルトはすでに個別設定中なら'plan'、そうでなければ'crop'）
  const [addScopeByPlan, setAddScopeByPlan] = useState<Record<string, 'crop' | 'plan'>>({});

  const [savingTargetId, setSavingTargetId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // 新規資材クイック登録モーダル用ステート
  const [isNewMatModalOpen, setIsNewMatModalOpen] = useState(false);
  const [newMatTargetPlanId, setNewMatTargetPlanId] = useState<string>('');
  const [newMatTargetCropId, setNewMatTargetCropId] = useState<string>('');
  const [newMatApplyScope, setNewMatApplyScope] = useState<'crop' | 'plan'>('crop');
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
        setPlanMaterialMap((res as any).planMaterialMap || {});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // 年度・時期に合致する全計画（畑フィルター適用前）
  const seasonFilteredPlans = useMemo(() => {
    return plans.filter((p: any) => {
      const matchYear = !p.year || Number(p.year) === year;
      if (!matchYear) return false;
      const sMonth = Number(p.start_month) || 1;
      if (seasonFilter === 'spring') return sMonth >= 1 && sMonth <= 7;
      if (seasonFilter === 'autumn') return sMonth >= 8 && sMonth <= 12;
      return true;
    });
  }, [plans, year, seasonFilter]);

  // 畑ごとのピルボタン一覧（作付けがある畑を面積・計画数付きで集計）
  const fieldPillList = useMemo(() => {
    const map = new Map<string, { fieldId: string; fieldName: string; areaAcre: number; planCount: number }>();
    seasonFilteredPlans.forEach((p: any) => {
      const fid = p.field_id || 'unassigned';
      const fieldObj = p.fields || fields.find((f: any) => f.id === p.field_id);
      const fname = fieldObj?.name || '畑未指定';
      const area = getPlanAreaAcre(p, fields);
      if (!map.has(fid)) {
        map.set(fid, { fieldId: fid, fieldName: fname, areaAcre: area, planCount: 0 });
      }
      const item = map.get(fid)!;
      item.planCount += 1;
    });
    return Array.from(map.values());
  }, [seasonFilteredPlans, fields]);

  // 畑フィルターも適用した現在表示対象の作付け計画一覧
  const activePlans = useMemo(() => {
    return seasonFilteredPlans
      .filter((p: any) => {
        if (selectedFieldId === 'all') return true;
        const fid = p.field_id || 'unassigned';
        return fid === selectedFieldId;
      })
      .sort((a: any, b: any) => (Number(a.start_month) || 1) - (Number(b.start_month) || 1));
  }, [seasonFilteredPlans, selectedFieldId]);

  // ある作付け計画(plan)で有効な 10aあたり資材リストを取得（畑個別設定があれば優先、なければ作目標準）
  const getEffectiveMaterialsForPlan = (plan: any): {
    isCustomOverride: boolean;
    list: Array<{ material_id: string; amount: number }>;
  } => {
    if (plan?.id && Array.isArray(planMaterialMap[plan.id])) {
      return {
        isCustomOverride: true,
        list: planMaterialMap[plan.id]
      };
    }
    const std = cropStandards.find((s: any) => s.crop_id === plan?.crop_id);
    const mats = Array.isArray(std?.materials_per_10a) ? std.materials_per_10a : [];
    return {
      isCustomOverride: false,
      list: mats
    };
  };

  // 同じ作目がいくつの畑（作付け計画）にあるかをカウント
  const cropPlanCountMap = useMemo(() => {
    const counts: Record<string, number> = {};
    seasonFilteredPlans.forEach((p: any) => {
      if (p.crop_id) {
        counts[p.crop_id] = (counts[p.crop_id] || 0) + 1;
      }
    });
    return counts;
  }, [seasonFilteredPlans]);

  // 資材が1つも設定されていない作付け計画の数
  const unconfiguredPlansCount = useMemo(() => {
    return activePlans.filter(p => getEffectiveMaterialsForPlan(p).list.length === 0).length;
  }, [activePlans, planMaterialMap, cropStandards]);

  // 資材ごとの必要量・買い物リスト集計（STEP 1の畑ごとの設定と100%連動）
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
          isCustomOverride: boolean;
        }>;
      }
    > = {};

    activePlans.forEach((plan: any) => {
      const areaAcre = getPlanAreaAcre(plan, fields);
      if (areaAcre <= 0) return;

      const { isCustomOverride, list } = getEffectiveMaterialsForPlan(plan);
      if (!list || list.length === 0) return;

      const cropObj = plan.crops || crops.find((c: any) => c.id === plan.crop_id);
      const cropName = cropObj?.name || '作目';
      const fieldObj = plan.fields || fields.find((f: any) => f.id === plan.field_id);
      const fieldName = fieldObj?.name || '畑未指定';

      list.forEach((m: any) => {
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
          cleanVariety: cleanVarietyLabel(plan.variety),
          isCustomOverride
        });
      });
    });

    return Object.values(reqMap)
      .map(item => {
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
  }, [activePlans, fields, cropStandards, planMaterialMap, crops, materials, inventoryMap, kindFilter]);

  // 全体サマリー計算
  const summaryStats = useMemo(() => {
    const totalPlannedArea =
      Math.round(activePlans.reduce((sum, p) => sum + getPlanAreaAcre(p, fields), 0) * 10) / 10;
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

  // A) 作目共通（同じ野菜のすべての畑に反映）の資材リストを保存
  const handleUpdateCropMaterials = async (
    cropId: string,
    newMaterialsList: Array<{ material_id: string; amount: number }>
  ) => {
    if (!tenantId || !cropId) return;
    setSavingTargetId(cropId);

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
    setSavingTargetId(null);

    if (res.success) {
      showToast('同じ野菜の畑すべてに使用量を反映し、買い物リストを再計算しました！');
    } else {
      alert('保存に失敗しました: ' + (res.error || ''));
    }
  };

  // B) 特定の畑（作付け計画 planId）だけの個別資材リストを保存・解除
  const handleUpdatePlanOverrideMaterials = async (
    planId: string,
    newMaterialsList: Array<{ material_id: string; amount: number }> | null,
    customToast?: string
  ) => {
    if (!tenantId || !planId) return;
    setSavingTargetId(planId);

    setPlanMaterialMap(prev => {
      const next = { ...prev };
      if (newMaterialsList === null) {
        delete next[planId];
      } else {
        next[planId] = newMaterialsList;
      }
      return next;
    });

    const res = await savePlanMaterialOverrideAction(tenantId, planId, newMaterialsList);
    setSavingTargetId(null);

    if (res.success) {
      showToast(
        customToast ||
          (newMaterialsList === null
            ? 'この畑の個別設定を解除し、野菜の共通設定に戻しました！'
            : 'この畑だけの個別設定として保存し、買い物リストを再計算しました！')
      );
    } else {
      alert('保存に失敗しました: ' + (res.error || ''));
    }
  };

  // カード内で資材の数量変更・追加を行う統合ハンドラ（scope: 'crop' = 同じ野菜すべて / 'plan' = この畑だけ）
  const handleUpsertMaterialOnPlan = async (
    plan: any,
    materialId: string,
    newAmount: number,
    scope: 'crop' | 'plan'
  ) => {
    const { list } = getEffectiveMaterialsForPlan(plan);
    const currentList = [...list];
    const idx = currentList.findIndex(x => x.material_id === materialId);
    if (idx >= 0) {
      currentList[idx] = { ...currentList[idx], amount: Math.max(0, newAmount) };
    } else {
      currentList.push({ material_id: materialId, amount: Math.max(0, newAmount) });
    }

    if (scope === 'plan') {
      await handleUpdatePlanOverrideMaterials(plan.id, currentList);
    } else {
      await handleUpdateCropMaterials(plan.crop_id, currentList);
    }
  };

  // カード内で資材を削除するハンドラ
  const handleRemoveMaterialOnPlan = async (plan: any, materialId: string, scope: 'crop' | 'plan') => {
    const { list } = getEffectiveMaterialsForPlan(plan);
    const nextList = list.filter(x => x.material_id !== materialId);
    if (scope === 'plan') {
      await handleUpdatePlanOverrideMaterials(
        plan.id,
        nextList,
        'この畑から該当の資材を外しました（他の畑には影響しません）！'
      );
    } else {
      await handleUpdateCropMaterials(plan.crop_id, nextList);
    }
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

  // 新しい肥料・資材をその場でマスタ登録＆指定の畑（または作目全体）に紐付け
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

        const targetPlan = plans.find(p => p.id === newMatTargetPlanId);
        if (targetPlan && newMatApplyScope === 'plan') {
          const { list } = getEffectiveMaterialsForPlan(targetPlan);
          const nextList = [
            ...list,
            { material_id: createdMat.id, amount: Math.max(0.1, Number(newMatAmountPer10a) || 1) }
          ];
          await handleUpdatePlanOverrideMaterials(targetPlan.id, nextList);
        } else if (newMatTargetCropId) {
          const std = cropStandards.find(s => s.crop_id === newMatTargetCropId);
          const currentList = Array.isArray(std?.materials_per_10a) ? [...std.materials_per_10a] : [];
          currentList.push({
            material_id: createdMat.id,
            amount: Math.max(0.1, Number(newMatAmountPer10a) || 1)
          });
          await handleUpdateCropMaterials(newMatTargetCropId, currentList);
        }

        showToast(`「${createdMat.name}」を登録して反映しました！`);
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

  // ============================================================================
  // 共通セクション描画関数: ① 畑・作付けごとの準備カード一覧 / ② 買い物・注文まとめ表
  // ============================================================================

  // セクションA: 📍 畑 × 作付けごとの肥料・資材 準備リスト
  const renderFieldPlanCardsSection = () => (
    <section id="field-plans-section" className="space-y-4 print:hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-emerald-50/90 border border-emerald-200 rounded-2xl px-4 py-3.5">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-emerald-700 text-white rounded-lg text-xs font-black">
              手順 1
            </span>
            <h2 className="text-base sm:text-lg font-black text-slate-900">
              📍 畑・作付けごとに「使う肥料・資材」を決める（{activePlans.length}件）
            </h2>
          </div>
          <p className="text-xs font-bold text-slate-600">
            各畑のカードの中で、使う肥料やマルチを直接追加・変更できます。<strong>「同じ野菜のすべての畑に一括反映」</strong>も、ハウスや露地の違いに合わせた<strong>「この畑だけ個別調整」</strong>もワンクリックで選べます。
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            const firstPlan = activePlans[0];
            setNewMatTargetPlanId(firstPlan?.id || '');
            setNewMatTargetCropId(firstPlan?.crop_id || crops[0]?.id || '');
            setNewMatApplyScope('crop');
            setIsNewMatModalOpen(true);
          }}
          className="px-3.5 py-2 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-black shrink-0 flex items-center gap-1.5 shadow-2xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>新しい肥料・資材をマスタ登録</span>
        </button>
      </div>

      {activePlans.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center space-y-2">
          <Sprout className="w-10 h-10 text-emerald-500 mx-auto" />
          <p className="text-sm font-black text-slate-800">
            この条件（{year}年）に該当する作付け計画がありません
          </p>
          <p className="text-xs font-bold text-slate-500">
            「作付けこよみ」で畑の作付け計画を登録すると、ここに自動で畑ごとのカードが表示されます。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {activePlans.map((plan: any) => {
            const areaAcre = getPlanAreaAcre(plan, fields);
            const fieldObj = plan.fields || fields.find((f: any) => f.id === plan.field_id);
            const fieldName = fieldObj?.name || '畑未指定';
            const cropObj = plan.crops || crops.find((c: any) => c.id === plan.crop_id);
            const cropName = cropObj?.name || '作目未設定';
            const cleanVar = cleanVarietyLabel(plan.variety);
            const sMonth = Number(plan.start_month) || 1;
            const eMonth = Number(plan.end_month) || sMonth;

            const { isCustomOverride, list: effectiveMaterials } = getEffectiveMaterialsForPlan(plan);
            const sameCropTotalCount = cropPlanCountMap[plan.crop_id] || 1;
            const currentAddScope: 'crop' | 'plan' =
              addScopeByPlan[plan.id] || (isCustomOverride ? 'plan' : 'crop');
            const selectedMatId = selectedAddMaterialByPlan[plan.id] || '';
            const selectedAmt = selectedAddAmountByPlan[plan.id] ?? '1';
            const isSavingThis = savingTargetId === plan.id || savingTargetId === plan.crop_id;

            return (
              <div
                key={plan.id}
                className={`bg-white rounded-3xl border-2 shadow-2xs p-4 sm:p-5 flex flex-col justify-between gap-4 transition-all ${
                  isCustomOverride
                    ? 'border-indigo-300 bg-indigo-50/10'
                    : effectiveMaterials.length === 0
                    ? 'border-amber-300'
                    : 'border-slate-200'
                }`}
              >
                <div className="space-y-3">
                  {/* カードヘッダー：畑名・面積・作目・時期 ＋ 個別調整切替ボタン */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 pb-3 border-b border-slate-100">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-1 bg-slate-800 text-white rounded-xl text-xs font-black flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                          {fieldName}（{areaAcre}a）
                        </span>
                        <span className="text-base font-black text-slate-900">
                          🌱 {cropName}
                          {cleanVar ? `（${cleanVar}）` : ''}
                        </span>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">
                          📅 {sMonth}月〜{eMonth}月
                        </span>
                      </div>

                      {/* 連動状態の分かりやすい表示 */}
                      <div className="flex items-center gap-2 flex-wrap pt-0.5">
                        {isCustomOverride ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg">
                            <Sparkles className="w-3 h-3" />
                            この畑（{fieldName}）専用の個別設定中
                          </span>
                        ) : sameCropTotalCount > 1 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500">
                            🔄 「{cropName}」の全{sameCropTotalCount}畑で同じ10a基準を共有中
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500">
                            📌 10aあたりの使用量から {areaAcre}a 分を自動計算
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 右上アクション：個別調整への切替 ／ 共通設定への復帰・一括コピー */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isSavingThis && (
                        <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> 保存中
                        </span>
                      )}

                      {sameCropTotalCount > 1 && !isCustomOverride && (
                        <button
                          type="button"
                          onClick={() => {
                            setAddScopeByPlan(prev => ({ ...prev, [plan.id]: 'plan' }));
                            handleUpdatePlanOverrideMaterials(
                              plan.id,
                              [...effectiveMaterials],
                              `「${fieldName}」を個別調整モードに切り替えました！この畑だけ自由に変更できます。`
                            );
                          }}
                          className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl text-[11px] font-black transition-colors cursor-pointer"
                          title="同じ野菜でもハウスと露地などで使う資材・量を変えたい場合に押してください"
                        >
                          📍 この畑だけ個別に調整する
                        </button>
                      )}

                      {isCustomOverride && (
                        <div className="flex items-center gap-1">
                          {sameCropTotalCount > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                handleUpdateCropMaterials(plan.crop_id, [...effectiveMaterials]);
                                handleUpdatePlanOverrideMaterials(
                                  plan.id,
                                  null,
                                  `この畑の設定を「${cropName}」のすべての畑にも一括反映しました！`
                                );
                                setAddScopeByPlan(prev => ({ ...prev, [plan.id]: 'crop' }));
                              }}
                              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-[11px] font-black flex items-center gap-1 transition-colors cursor-pointer"
                              title={`他の「${cropName}」の畑にもこの内容をそのまま反映します`}
                            >
                              <Copy className="w-3 h-3" />
                              他の{cropName}の畑にも反映
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setAddScopeByPlan(prev => ({ ...prev, [plan.id]: 'crop' }));
                              handleUpdatePlanOverrideMaterials(plan.id, null);
                            }}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            title="個別調整をやめて、野菜の共通設定に戻します"
                          >
                            <RotateCcw className="w-3 h-3" />
                            共通に戻す
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* この畑で使う肥料・資材リスト */}
                  {effectiveMaterials.length === 0 ? (
                    <div className="p-4 bg-amber-50/70 border border-dashed border-amber-300 rounded-2xl text-xs font-bold text-amber-900 text-center">
                      ⚠️ まだこの畑（{cropName}）で使う肥料・資材が登録されていません。すぐ下の欄から選んで追加してください。
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {effectiveMaterials.map((m, idx) => {
                        const mat = materials.find(x => x.id === m.material_id);
                        const unit = mat?.unit || '袋';
                        const kind = getMaterialKind(mat);
                        const kindTag =
                          kind === 'fertilizer'
                            ? { text: '肥料', cls: 'bg-teal-50 text-teal-800 border-teal-200' }
                            : kind === 'pesticide'
                            ? { text: '農薬', cls: 'bg-rose-50 text-rose-800 border-rose-200' }
                            : { text: '資材', cls: 'bg-blue-50 text-blue-800 border-blue-200' };
                        const calcForThisField =
                          Math.round(((areaAcre / 10) * (Number(m.amount) || 0)) * 10) / 10;

                        return (
                          <div
                            key={`${m.material_id}-${idx}`}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200/90 rounded-2xl"
                          >
                            <div className="min-w-0 flex-1 flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-black border shrink-0 ${kindTag.cls}`}
                              >
                                {kindTag.text}
                              </span>
                              <div className="min-w-0">
                                <span className="text-sm font-black text-slate-900 block truncate">
                                  {mat ? mat.name : '不明な資材'}
                                </span>
                                <span className="text-[11px] font-bold text-slate-500">
                                  この畑（{areaAcre}a）での必要量:{' '}
                                  <strong className="text-amber-700 text-xs">
                                    {calcForThisField} {unit}
                                  </strong>
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-1.5 shrink-0">
                              <span className="text-[11px] font-bold text-slate-500">10aに</span>
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={m.amount}
                                onChange={e =>
                                  handleUpsertMaterialOnPlan(
                                    plan,
                                    m.material_id,
                                    Number(e.target.value),
                                    isCustomOverride ? 'plan' : currentAddScope
                                  )
                                }
                                className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-right text-sm font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                              />
                              <span className="text-xs font-bold text-slate-600 w-6">{unit}</span>

                              {/* 同じ野菜が複数畑にあり、まだ共通設定中の場合は「この畑だけ外す」もワンクリックで可能 */}
                              {sameCropTotalCount > 1 && !isCustomOverride && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMaterialOnPlan(plan, m.material_id, 'plan')}
                                  className="px-2 py-1 text-[10px] font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                                  title="他の畑には残したまま、この畑からだけ外します"
                                >
                                  この畑だけ外す
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveMaterialOnPlan(
                                    plan,
                                    m.material_id,
                                    isCustomOverride ? 'plan' : 'crop'
                                  )
                                }
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title={
                                  isCustomOverride
                                    ? 'この畑から削除'
                                    : `「${cropName}」の基準から削除`
                                }
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

                {/* カード下部：その場で肥料・資材を追加するフォーム */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label className="text-[11px] font-black text-slate-600">
                      ＋ この畑（{fieldName} / {cropName}）に使う肥料・資材を追加
                    </label>

                    {/* 同じ野菜が複数畑にある場合、追加先を「全畑共通」か「この畑だけ」か選べる */}
                    {sameCropTotalCount > 1 && (
                      <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[10px] font-black">
                        <button
                          type="button"
                          onClick={() => setAddScopeByPlan(prev => ({ ...prev, [plan.id]: 'crop' }))}
                          className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                            currentAddScope === 'crop'
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          🔄 {cropName}の畑すべてに反映
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddScopeByPlan(prev => ({ ...prev, [plan.id]: 'plan' }))}
                          className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                            currentAddScope === 'plan'
                              ? 'bg-indigo-600 text-white'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          📍 この畑（{fieldName}）だけ
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <select
                      value={selectedMatId}
                      onChange={e => {
                        if (e.target.value === '__NEW__') {
                          setNewMatTargetPlanId(plan.id);
                          setNewMatTargetCropId(plan.crop_id);
                          setNewMatApplyScope(currentAddScope);
                          setIsNewMatModalOpen(true);
                          return;
                        }
                        setSelectedAddMaterialByPlan(prev => ({
                          ...prev,
                          [plan.id]: e.target.value
                        }));
                      }}
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                    >
                      <option value="">追加する肥料・マルチ・資材を選択...</option>
                      {materials.map(mat => (
                        <option key={mat.id} value={mat.id}>
                          [{mat.category || '資材'}] {mat.name}（単位: {mat.unit || '袋'}）
                        </option>
                      ))}
                      <option value="__NEW__">✨ ＋ リストにない新しい肥料・資材を登録する...</option>
                    </select>

                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-500 whitespace-nowrap">10aに</span>
                      <input
                        type="number"
                        min="0.1"
                        step="0.5"
                        value={selectedAmt}
                        onChange={e =>
                          setSelectedAddAmountByPlan(prev => ({
                            ...prev,
                            [plan.id]: e.target.value
                          }))
                        }
                        className="w-16 px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-right text-xs font-black text-slate-800"
                      />
                      <button
                        type="button"
                        disabled={!selectedMatId}
                        onClick={() => {
                          if (!selectedMatId) return;
                          handleUpsertMaterialOnPlan(
                            plan,
                            selectedMatId,
                            Math.max(0.1, Number(selectedAmt) || 1),
                            currentAddScope
                          );
                          setSelectedAddMaterialByPlan(prev => ({ ...prev, [plan.id]: '' }));
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
      )}
    </section>
  );

  // セクションB: 🛒 買い物・注文まとめ表（手順1の結果がリアルタイムで合算される一覧表）
  const renderShoppingSummarySection = () => (
    <section id="shopping-summary-section" className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-amber-50/90 border border-amber-200 rounded-2xl px-4 py-3.5 print:hidden">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-amber-600 text-white rounded-lg text-xs font-black">
              手順 2
            </span>
            <h2 className="text-base sm:text-lg font-black text-slate-900">
              🛒 買い物・注文まとめ表（在庫差引・概算金額：{shoppingList.length}品目）
            </h2>
          </div>
          <p className="text-xs font-bold text-slate-600">
            各畑で設定した肥料・資材が自動で合算されています。「② いまある在庫」と「単価」を入れると、<strong>今回買う数と金額</strong>がすぐに計算されます。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* カテゴリ絞り込み */}
          <div className="flex items-center bg-white border border-amber-200 p-1 rounded-xl text-xs font-bold">
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
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  kindFilter === k.id
                    ? 'bg-amber-600 text-white font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>この注文表を印刷</span>
          </button>
        </div>
      </div>

      {shoppingList.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-2">
          <ShoppingCart className="w-8 h-8 text-amber-500 mx-auto" />
          <p className="text-sm font-black text-slate-800">
            まだ集計できる肥料・資材がありません
          </p>
          <p className="text-xs font-bold text-slate-500">
            「手順 1：畑・作付けごとに使う肥料・資材を決める」の各カードで資材を追加すると、ここに自動で買い物リストが作成されます。
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-600 bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5 font-black">肥料・資材名（使う畑の内訳）</th>
                  <th className="px-4 py-3.5 font-black text-right whitespace-nowrap">
                    ① 畑での必要量
                  </th>
                  <th className="px-4 py-3.5 font-black text-right whitespace-nowrap">
                    🏠 ② いまある在庫
                  </th>
                  <th className="px-4 py-3.5 font-black text-right whitespace-nowrap bg-amber-50/60 text-amber-900">
                    🛒 ③ 今回買う数
                  </th>
                  <th className="px-4 py-3.5 font-black text-right whitespace-nowrap">
                    💴 単価
                  </th>
                  <th className="px-4 py-3.5 font-black text-right whitespace-nowrap">
                    概算金額（小計）
                  </th>
                  <th className="px-4 py-3.5 font-black text-center whitespace-nowrap print:hidden">
                    注文チェック
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {shoppingList.map(item => {
                  const unitLabel = item.material.unit || '袋';
                  const kindBadge =
                    item.kind === 'fertilizer'
                      ? { label: '🔬 肥料', cls: 'bg-teal-50 text-teal-800 border-teal-200' }
                      : item.kind === 'pesticide'
                      ? { label: '🧪 農薬', cls: 'bg-rose-50 text-rose-800 border-rose-200' }
                      : { label: '📦 資材', cls: 'bg-blue-50 text-blue-800 border-blue-200' };

                  return (
                    <tr
                      key={item.material.id}
                      className={`transition-colors ${
                        item.isOrdered ? 'bg-emerald-50/30' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      {/* 資材名 ＋ どの畑で何袋使うかの内訳タグ */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${kindBadge.cls}`}
                          >
                            {kindBadge.label}
                          </span>
                          <span className="text-base font-black text-slate-900">
                            {item.material.name}
                          </span>
                          <span className="text-xs font-bold text-slate-500">
                            （📅 {item.earliestMonth}月〜）
                          </span>
                        </div>

                        {/* 内訳バッジ：どの畑でどれだけ使うか一目で分かる */}
                        <div className="flex items-center gap-1.5 flex-wrap mt-2">
                          {item.details.map((d, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-bold"
                            >
                              📍 {d.fieldName}（{d.cropName} {d.areaAcre}a）:{' '}
                              <strong className="text-slate-900">
                                {Number(d.calculatedAmount.toFixed(1))}
                                {unitLabel}
                              </strong>
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* ① 畑での必要量 */}
                      <td className="px-4 py-3.5 text-right align-middle whitespace-nowrap">
                        <div className="text-base font-black text-slate-800">
                          {item.recommendedBuyUnitCount.toLocaleString()}{' '}
                          <span className="text-xs font-bold text-slate-500">{unitLabel}</span>
                        </div>
                        {item.totalExactAmount !== item.recommendedBuyUnitCount && (
                          <div className="text-[10px] font-bold text-slate-400">
                            (計算値 {item.totalExactAmount}
                            {unitLabel} を切上)
                          </div>
                        )}
                      </td>

                      {/* ② いまある手持ち在庫 */}
                      <td className="px-4 py-3.5 text-right align-middle whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
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
                            className="w-16 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-right text-sm font-black text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                          />
                          <span className="text-xs font-bold text-slate-500">{unitLabel}</span>
                        </div>
                      </td>

                      {/* ③ 今回買う数（不足分） */}
                      <td className="px-4 py-3.5 text-right align-middle whitespace-nowrap bg-amber-50/40">
                        {item.shortageToBuy > 0 ? (
                          <div className="text-xl font-black text-amber-600">
                            {item.shortageToBuy.toLocaleString()}{' '}
                            <span className="text-xs font-bold">{unitLabel}</span>
                          </div>
                        ) : (
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-black">
                            ✨ 在庫で足ります
                          </span>
                        )}
                      </td>

                      {/* ④ 単価 */}
                      <td className="px-4 py-3.5 text-right align-middle whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
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
                            className="w-20 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-right text-xs font-black text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          />
                        </div>
                      </td>

                      {/* ⑤ 概算金額 */}
                      <td className="px-4 py-3.5 text-right align-middle whitespace-nowrap">
                        <div className="text-base font-black text-emerald-700">
                          ¥{item.estimatedCost.toLocaleString()}
                        </div>
                      </td>

                      {/* ⑥ 注文済チェック */}
                      <td className="px-4 py-3.5 text-center align-middle whitespace-nowrap print:hidden">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateInventoryOrPrice(item.material.id, {
                              ordered: !item.isOrdered
                            })
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-black inline-flex items-center gap-1 transition-all cursor-pointer ${
                            item.isOrdered
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 border border-slate-200'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{item.isOrdered ? '注文済' : '注文済にする'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* 合計フッター */}
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td colSpan={3} className="px-4 py-3.5 text-right text-xs font-black text-slate-600">
                    今回買い足す品目: {summaryStats.itemsToBuyCount} 品目 ／ 注文金額 合計（目安）
                  </td>
                  <td colSpan={3} className="px-4 py-3.5 text-right text-xl font-black text-emerald-700">
                    ¥{summaryStats.totalEstimatedCost.toLocaleString()}
                  </td>
                  <td className="print:hidden" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </section>
  );

  return (
    <div className="max-w-[95vw] mx-auto px-4 sm:px-6 space-y-5 pb-16 pt-4 sm:pt-6 relative">
      {/* トースト通知 */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-700 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-sm font-black print:hidden">
          <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 1. ヘッダー ＆ 年度切替・並び順切替・印刷ボタン */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2.5">
            <Calculator className="w-7 h-7 text-amber-600 shrink-0" />
            <span>肥料・資材の必要量（畑ごとの準備 ＆ 買い物リスト）</span>
            <span className="print:hidden">
              <HelpTooltip content="1画面で「手順1：畑・作付けごとに使う肥料や資材を決める」➔「手順2：全体の買い物・注文まとめ表で在庫を引いて注文数を出す」が連動して完結します。" />
            </span>
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1 font-bold">
            【手順1】畑・作付けごとに使う肥料やマルチを決める ➔ 【手順2】自動で合算された買い物まとめ表で在庫を引いて注文する（1画面連動）
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
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

          {/* 上下入れ替えボタン（買い物まとめ表を一番上にしたい時にもワンクリック対応） */}
          <button
            type="button"
            onClick={() => setShowShoppingTableFirst(prev => !prev)}
            className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <ArrowDownUp className="w-4 h-4 text-indigo-600" />
            <span>
              {showShoppingTableFirst
                ? '📍 畑ごとの準備を上に表示する'
                : '🛒 買い物まとめ表を上に表示する'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>注文メモを印刷</span>
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

      {/* 2. 畑（圃場）ごとの絞り込みピルバー ＆ 時期切替（育苗スケジュールと完全統一！） */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* 畑ピルボタン */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-black text-slate-500 mr-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              畑で絞り込み:
            </span>
            <button
              type="button"
              onClick={() => setSelectedFieldId('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                selectedFieldId === 'all'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              すべての圃場 ({seasonFilteredPlans.length}件)
            </button>
            {fieldPillList.map(f => (
              <button
                key={f.fieldId}
                type="button"
                onClick={() => setSelectedFieldId(f.fieldId)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  selectedFieldId === f.fieldId
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                📍 {f.fieldName} ({f.areaAcre}a)
              </button>
            ))}
          </div>

          {/* 時期フィルター */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold shrink-0 self-start">
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
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  seasonFilter === s.id
                    ? 'bg-slate-800 text-white font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. 4つの要点サマリーバー（クリックで注文まとめ表や準備リストへスムーズ移動） */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <Sprout className="w-4 h-4 text-emerald-600" />
            <span>表示中の畑・作付け計画</span>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <div>
              <span className="text-2xl font-black text-slate-800">{activePlans.length}</span>
              <span className="text-xs font-bold text-slate-500 ml-1">
                作付け（延べ <strong className="text-slate-800">{summaryStats.totalPlannedArea}a</strong>）
              </span>
            </div>
            {unconfiguredPlansCount > 0 && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-lg text-[11px] font-black">
                未設定 {unconfiguredPlansCount}件
              </span>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <Package className="w-4 h-4 text-blue-600" />
            <span>集計された肥料・資材の種類</span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-800">{summaryStats.totalItemsCount}</span>
            <span className="text-xs font-bold text-slate-500">品目</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <ShoppingCart className="w-4 h-4 text-amber-600" />
            <span>今回買い足す品目数（在庫差引後）</span>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <div>
              <span className="text-2xl font-black text-amber-600">{summaryStats.itemsToBuyCount}</span>
              <span className="text-xs font-bold text-slate-500 ml-1">品目を注文予定</span>
            </div>
            <a
              href="#shopping-summary-section"
              className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-[11px] font-black transition-colors print:hidden"
            >
              🛒 注文表を見る ⬇
            </a>
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
            <span className="text-[11px] font-bold text-slate-400">（買う数 × 単価）</span>
          </div>
        </div>
      </div>

      {/* 4. メインコンテンツ：1画面で「手順1：畑・作付けごとの準備」と「手順2：買い物・注文まとめ表」を連動表示 */}
      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center gap-2 text-amber-600">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-xs font-bold text-slate-500">畑ごとの作付け計画と資材データを集計しています...</p>
        </div>
      ) : showShoppingTableFirst ? (
        <div className="space-y-8">
          {renderShoppingSummarySection()}
          {renderFieldPlanCardsSection()}
        </div>
      ) : (
        <div className="space-y-8">
          {renderFieldPlanCardsSection()}
          {renderShoppingSummarySection()}
        </div>
      )}

      {/* 5. 新しい肥料・資材をその場で登録するモーダル */}
      {isNewMatModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">✨ 新しい肥料・資材を登録</h3>
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
                  登録と同時に作付けへ追加する（任意）
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
