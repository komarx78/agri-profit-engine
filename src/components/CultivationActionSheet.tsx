"use client";
// CultivationActionSheet v2.1 (Smart Multi-Field Allocation & TDZ Safe)

import React, { useState, useMemo } from 'react';
import { 
  Sprout, 
  FlaskConical, 
  PenTool, 
  Bug, 
  Ruler, 
  Package, 
  Coins, 
  X, 
  Check, 
  Calendar, 
  Clock, 
  Loader2, 
  AlertCircle,
  FileText,
  MapPin,
  Calculator,
  Layers,
  Plus,
  Search
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '@/lib/tenant';
import Link from 'next/link';

export interface CultivationTarget {
  id: string; // plan_id または field_id + crop_id
  fieldId: string;
  fieldName: string;
  cropId?: string;
  cropName: string;
  areaAcre?: number; // a (アール)
  startDate?: string;
}

interface CultivationActionSheetProps {
  selectedCultivations: CultivationTarget[];
  onClearSelection: () => void;
  onSuccess: (message: string) => void;
}

type ActionCategory = 'fertilizer' | 'pesticide' | 'work' | 'pest' | 'growth' | 'shipment' | 'sales' | null;

export const CultivationActionSheet: React.FC<CultivationActionSheetProps> = ({
  selectedCultivations,
  onClearSelection,
  onSuccess
}) => {
  // =========================================================================
  // 1. すべての useState 宣言（最上部に配置してTDZ参照エラーを完全防止）
  // =========================================================================
  const [activeTab, setActiveTab] = useState<'record' | 'plan'>('record');
  const [activeCategory, setActiveCategory] = useState<ActionCategory>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 自社登録農薬マスタリスト & 散布履歴
  const [farmPesticides, setFarmPesticides] = useState<any[]>([]);
  const [farmFertilizers, setFarmFertilizers] = useState<any[]>([]);
  const [tenantSprayLogs, setTenantSprayLogs] = useState<any[]>([]);
  const [selectedPesticideMode, setSelectedPesticideMode] = useState<'select' | 'custom'>('select');

  // 公的肥料マスター検索用ステート
  const [showFertilizerSearchModal, setShowFertilizerSearchModal] = useState(false);
  const [publicFertQuery, setPublicFertQuery] = useState('');
  const [publicFertResults, setPublicFertResults] = useState<any[]>([]);
  const [searchingPublicFert, setSearchingPublicFert] = useState(false);

  // 新規自社肥料登録ステート
  const [isAddingNewToMaster, setIsAddingNewToMaster] = useState(false);
  const [newFertName, setNewFertName] = useState('');
  const [newFertN, setNewFertN] = useState('0');
  const [newFertP, setNewFertP] = useState('0');
  const [newFertK, setNewFertK] = useState('0');
  const [newFertPrice, setNewFertPrice] = useState('0');
  const [newFertWeight, setNewFertWeight] = useState('20');
  const [isSavingMaster, setIsSavingMaster] = useState(false);

  // 農薬リアルタイム安全判定ステート
  const [isCheckingPesticide, setIsCheckingPesticide] = useState(false);
  const [pesticideFamicData, setPesticideFamicData] = useState<any>(null);

  // 共通フォームステート
  const [formDate, setFormDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [durationMinutes, setDurationMinutes] = useState<string>('60');
  const [durationMode, setDurationMode] = useState<'total_proportional' | 'uniform'>('total_proportional');
  const [memo, setMemo] = useState<string>('');

  // 作業用
  const [workType, setWorkType] = useState<string>('定植');

  // 肥料専用ステート（自社マスタまたは公的マスター連動）
  const [selectedFertilizerName, setSelectedFertilizerName] = useState<string>('その他（手入力）');
  const [fertilizerType, setFertilizerType] = useState<'元肥' | '追肥1回目' | '追肥2回目' | '土壌改良' | '葉面散布'>('元肥');
  const [fertInputMode, setFertInputMode] = useState<'bags' | 'kg'>('bags');
  const [fertBags, setFertBags] = useState<string>('3'); // 袋数
  const [fertTotalKg, setFertTotalKg] = useState<string>('60'); // kg
  const [customN, setCustomN] = useState<string>('0');
  const [customP, setCustomP] = useState<string>('0');
  const [customK, setCustomK] = useState<string>('0');
  const [fertPricePerBag, setFertPricePerBag] = useState<string>('0');

  // その他の品名・数量・金額 ＆ 複数圃場スマート面積按分ステート
  const [itemName, setItemName] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [quantityMode, setQuantityMode] = useState<'total_proportional' | 'per_10a' | 'uniform'>('total_proportional');
  const [unit, setUnit] = useState<string>('ml');
  const [priceAmount, setPriceAmount] = useState<string>('');

  // =========================================================================
  // 2. ヘルパー関数 & useMemo 計算プロパティ
  // =========================================================================
  const targetCropName = selectedCultivations[0]?.cropName || '';
  const cleanTargetCrop = targetCropName.replace(/\(.*?\)/g, '').trim();

  // 表記揺れ正規化ヘルパー
  const normalizeText = (str: string) => {
    if (!str) return '';
    return str
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[\u3041-\u3096]/g, m => String.fromCharCode(m.charCodeAt(0) + 0x60))
      .replace(/[\s　・･()（）\[\]【】]/g, '');
  };

  // 選択中圃場の合計面積(a)
  const totalAreaAcre = useMemo(() => {
    return selectedCultivations.reduce((sum, c) => sum + (c.areaAcre || 10), 0);
  }, [selectedCultivations]);

  // 複数圃場におけるスマート面積比例配分（自動按分計算エンジン）
  const fieldDistributions = useMemo(() => {
    const numFields = selectedCultivations.length;
    const parsedQty = parseFloat(quantity) || 0;
    const parsedDuration = parseFloat(durationMinutes) || 0;

    return selectedCultivations.map(c => {
      const fieldArea = c.areaAcre || 10;
      const ratio = totalAreaAcre > 0 ? fieldArea / totalAreaAcre : 1 / (numFields || 1);

      let fieldQty = 0;
      if (quantityMode === 'total_proportional') {
        fieldQty = numFields > 1 ? Math.round(parsedQty * ratio * 10) / 10 : parsedQty;
      } else if (quantityMode === 'per_10a') {
        fieldQty = Math.round(((parsedQty * fieldArea) / 10) * 10) / 10;
      } else {
        fieldQty = parsedQty;
      }

      let fieldDur = 0;
      if (durationMode === 'total_proportional' && numFields > 1) {
        fieldDur = Math.round(parsedDuration * ratio);
      } else {
        fieldDur = Math.round(parsedDuration);
      }

      return {
        id: c.id,
        fieldId: c.fieldId,
        fieldName: c.fieldName,
        cropId: c.cropId,
        cropName: c.cropName,
        areaAcre: fieldArea,
        ratioPercent: Math.round(ratio * 1000) / 10,
        quantity: fieldQty,
        durationMinutes: fieldDur
      };
    });
  }, [selectedCultivations, quantity, durationMinutes, quantityMode, durationMode, totalAreaAcre]);

  // 肥料成分のリアルタイム計算
  const fertCalculation = useMemo(() => {
    const farmItem = farmFertilizers.find(f => f.name === selectedFertilizerName);

    let nRatio = 0, pRatio = 0, kRatio = 0, bagKg = 20, bagPrice = 0;

    if (farmItem) {
      nRatio = parseFloat(farmItem.n_percent ?? farmItem.n_ratio) || (parseFloat(customN) || 0);
      pRatio = parseFloat(farmItem.p_percent ?? farmItem.p_ratio) || (parseFloat(customP) || 0);
      kRatio = parseFloat(farmItem.k_percent ?? farmItem.k_ratio) || (parseFloat(customK) || 0);
      bagKg = parseFloat(farmItem.bag_weight || farmItem.capacity) || 20;
      bagPrice = parseFloat(farmItem.default_price || farmItem.unit_price) || (parseFloat(fertPricePerBag) || 0);
    } else {
      nRatio = parseFloat(customN) || 0;
      pRatio = parseFloat(customP) || 0;
      kRatio = parseFloat(customK) || 0;
      bagKg = 20;
      bagPrice = parseFloat(fertPricePerBag) || 0;
    }

    let totalWeightKg = 0;
    let bagsCount = 0;

    if (fertInputMode === 'bags') {
      bagsCount = parseFloat(fertBags) || 0;
      totalWeightKg = bagsCount * bagKg;
    } else {
      totalWeightKg = parseFloat(fertTotalKg) || 0;
      bagsCount = bagKg > 0 ? totalWeightKg / bagKg : 0;
    }

    // 10a (1反) あたりの施肥量
    const weightPer10a = totalAreaAcre > 0 ? (totalWeightKg / totalAreaAcre) * 10 : totalWeightKg;

    // N-P-K 純成分量 (kg/10a)
    const nPer10a = (weightPer10a * nRatio) / 100;
    const pPer10a = (weightPer10a * pRatio) / 100;
    const kPer10a = (weightPer10a * kRatio) / 100;

    // 概算総コスト (円)
    const totalCost = bagsCount * bagPrice;

    return {
      totalWeightKg: Math.round(totalWeightKg * 10) / 10,
      bagsCount: Math.round(bagsCount * 10) / 10,
      nPer10a: Math.round(nPer10a * 10) / 10,
      pPer10a: Math.round(pPer10a * 10) / 10,
      kPer10a: Math.round(kPer10a * 10) / 10,
      totalCost: Math.round(totalCost)
    };
  }, [selectedFertilizerName, fertInputMode, fertBags, fertTotalKg, customN, customP, customK, fertPricePerBag, totalAreaAcre, farmFertilizers]);

  // 有効成分ごとの合算使用回数 & 重複判定 & RACローテーション判定（厳密数学・法規監査済み）
  const complianceReport = useMemo(() => {
    if (activeCategory !== 'pesticide') return null;

    const selectedFieldIds = selectedCultivations.map(c => c.fieldId);
    const normTargetCrop = normalizeText(cleanTargetCrop);

    // 作付期間（シーズン）の特定: 最も古い startDate または 直近180日以内
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 180); // デフォルト180日以内
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    // 該当圃場・該当作物の今シーズンの過去散布ログを抽出
    const relevantLogs = tenantSprayLogs.filter(log => {
      const isSpray = log.work_type?.includes('農薬') || log.memo?.includes('[散布') || log.memo?.includes('農薬');
      const isCompleted = log.status !== 'planned';
      const matchField = !log.field_id || selectedFieldIds.includes(log.field_id);
      
      const logCropNorm = normalizeText(log.crops?.name || '');
      const matchCrop = !logCropNorm || !normTargetCrop || logCropNorm.includes(normTargetCrop) || normTargetCrop.includes(logCropNorm);
      
      // 今シーズン内のログ
      const isCurrentSeason = !log.work_date || log.work_date >= cutoffDateStr;

      return isSpray && isCompleted && matchField && matchCrop && isCurrentSeason;
    });

    // 1. 直前の直近散布ログからRACコードを取得
    let lastSprayInfo: { date: string; name: string; rac: string } | null = null;
    if (relevantLogs.length > 0) {
      const lastLog = relevantLogs[0];
      const lastMemo = lastLog.memo || '';
      const racMatch = lastMemo.match(/\[RAC:(.*?)\]/) || lastMemo.match(/RAC:(.*?)\s/);
      const nameMatch = lastMemo.match(/品名:(.*?)\s/) || lastMemo.match(/品名:(.*?)$/);
      lastSprayInfo = {
        date: lastLog.work_date || '前回',
        name: nameMatch ? nameMatch[1].trim() : lastMemo.slice(0, 15),
        rac: racMatch ? racMatch[1].trim() : ''
      };
    }

    // 2. 今回の農薬の有効成分リストの厳密パース & 合算計算
    const activeIngredients: { 
      name: string; 
      maxLimit: number; 
      pastCount: number; 
      thisCount: number;
      totalCount: number; 
      remaining: number;
      isOver: boolean; 
      isAtLimit: boolean;
      isUnlimited: boolean;
    }[] = [];
    
    const ingredientsFromFamic = pesticideFamicData?.active_ingredients || [];
    
    // 全体の上限回数パース
    let generalLimit = 0;
    const usageCountStr = String(pesticideFamicData?.usage_count || '');
    const countMatch = usageCountStr.match(/(\d+)回/);
    if (countMatch) {
      generalLimit = parseInt(countMatch[1], 10);
    }

    const normItemName = normalizeText(itemName);

    if (ingredientsFromFamic.length > 0) {
      ingredientsFromFamic.forEach((ing: any) => {
        const ingName = ing.name || String(ing);
        const normIngName = normalizeText(ingName);
        const limit = ing.maxCount !== undefined && ing.maxCount !== null ? ing.maxCount : (generalLimit || 0);
        const isUnlimited = limit === 0;

        // 過去ログから該当成分（または同一商品名）の散布実績を厳密カウント
        let pastCount = 0;
        relevantLogs.forEach(log => {
          const normMemo = normalizeText(log.memo || '');
          if (normMemo.includes(normIngName) || (normItemName && normMemo.includes(normItemName))) {
            pastCount++;
          }
        });

        const thisCount = 1;
        const totalCount = pastCount + thisCount;
        const remaining = isUnlimited ? 999 : Math.max(0, limit - totalCount);
        const isOver = !isUnlimited && totalCount > limit;
        const isAtLimit = !isUnlimited && totalCount === limit;

        activeIngredients.push({
          name: ingName,
          maxLimit: limit,
          pastCount,
          thisCount,
          totalCount,
          remaining,
          isOver,
          isAtLimit,
          isUnlimited
        });
      });
    } else if (itemName) {
      // FAMIC未照合・手入力農薬の場合
      let pastCount = 0;
      relevantLogs.forEach(log => {
        const normMemo = normalizeText(log.memo || '');
        if (normMemo.includes(normItemName)) {
          pastCount++;
        }
      });
      const limit = generalLimit || 3;
      const thisCount = 1;
      const totalCount = pastCount + thisCount;
      const remaining = Math.max(0, limit - totalCount);

      activeIngredients.push({
        name: itemName,
        maxLimit: limit,
        pastCount,
        thisCount,
        totalCount,
        remaining,
        isOver: totalCount > limit,
        isAtLimit: totalCount === limit,
        isUnlimited: false
      });
    }

    // RACコードの重複（同一系統連用）チェック
    const currentRac = pesticideFamicData?.rac_code || pesticideFamicData?.racCode || '';
    const isRacDuplicate = Boolean(
      currentRac && 
      lastSprayInfo?.rac && 
      normalizeText(lastSprayInfo.rac) === normalizeText(currentRac) && 
      !currentRac.includes('「-」') &&
      !currentRac.includes('未分類')
    );

    const hasOverLimit = activeIngredients.some(ing => ing.isOver);
    const hasAtLimit = activeIngredients.some(ing => ing.isAtLimit);

    return {
      activeIngredients,
      currentRac,
      lastSprayInfo,
      isRacDuplicate,
      hasOverLimit,
      hasAtLimit,
      relevantLogsCount: relevantLogs.length,
      famicData: pesticideFamicData
    };
  }, [activeCategory, itemName, pesticideFamicData, tenantSprayLogs, selectedCultivations, cleanTargetCrop]);

  // =========================================================================
  // 3. useEffect 副作用（マスタ取得 & 農薬FAMIC照合）
  // =========================================================================
  React.useEffect(() => {
    const fetchTenantData = async () => {
      try {
        const tenantId = await getCurrentTenantId();
        if (!tenantId) return;

        const [matRes, fertMatRes, logsRes] = await Promise.all([
          supabase
            .from('materials')
            .select('*')
            .eq('user_id', tenantId)
            .or('category.eq.農薬費,material_type.eq.pesticide')
            .order('name'),
          supabase
            .from('materials')
            .select('*')
            .eq('user_id', tenantId)
            .or('category.eq.肥料費,category.eq.肥料,material_type.eq.fertilizer')
            .order('name'),
          supabase
            .from('work_logs')
            .select('*, crops(name), fields(name)')
            .eq('user_id', tenantId)
            .order('work_date', { ascending: false })
        ]);

        if (matRes.data) {
          setFarmPesticides(matRes.data);
          if (matRes.data.length > 0 && !itemName) {
            setItemName(matRes.data[0].name);
            setUnit(matRes.data[0].unit || 'ml');
          }
        }
        if (fertMatRes.data) {
          setFarmFertilizers(fertMatRes.data);
          if (fertMatRes.data.length > 0) {
            const first = fertMatRes.data[0];
            setSelectedFertilizerName(first.name);
            setCustomN(String(first.n_percent ?? first.n_ratio ?? 0));
            setCustomP(String(first.p_percent ?? first.p_ratio ?? 0));
            setCustomK(String(first.k_percent ?? first.k_ratio ?? 0));
            setFertPricePerBag(String(first.default_price || first.unit_price || 0));
          }
        }
        if (logsRes.data) {
          setTenantSprayLogs(logsRes.data);
        }
      } catch (e) {
        console.warn('Failed to fetch farm data in action sheet:', e);
      }
    };
    fetchTenantData();
  }, []);

  React.useEffect(() => {
    if (activeCategory !== 'pesticide' || !itemName) {
      setPesticideFamicData(null);
      return;
    }

    let isMounted = true;
    const checkPesticide = async () => {
      setIsCheckingPesticide(true);
      try {
        const res = await fetch('/api/pesticide-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            cropName: cleanTargetCrop,
            pesticideName: itemName 
          })
        });

        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.pesticides && data.pesticides.length > 0) {
            const matched = data.pesticides.find((p: any) => 
              p.name === itemName || itemName.includes(p.name) || p.name.includes(itemName)
            ) || data.pesticides[0];
            setPesticideFamicData(matched);
          } else {
            setPesticideFamicData(null);
          }
        }
      } catch (e) {
        console.warn('Pesticide check error in modal:', e);
      } finally {
        if (isMounted) setIsCheckingPesticide(false);
      }
    };

    const timer = setTimeout(() => {
      checkPesticide();
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [activeCategory, itemName, cleanTargetCrop]);

  if (selectedCultivations.length === 0) {
    return null;
  }

  const handleOpenModal = (category: ActionCategory) => {
    setActiveCategory(category);
    setErrorMessage('');
    setMemo('');
    setQuantity('');
    setPriceAmount('');

    if (category === 'fertilizer') {
      const initialF = farmFertilizers.length > 0 ? farmFertilizers[0] : null;
      setSelectedFertilizerName(initialF ? initialF.name : 'その他（手入力）');
      setCustomN(String(initialF?.n_percent ?? initialF?.n_ratio ?? 0));
      setCustomP(String(initialF?.p_percent ?? initialF?.p_ratio ?? 0));
      setCustomK(String(initialF?.k_percent ?? initialF?.k_ratio ?? 0));
      setFertPricePerBag(String(initialF?.default_price || initialF?.unit_price || 0));
      setFertilizerType('元肥');
      setFertBags('3');
    } else if (category === 'pesticide') {
      const initialP = farmPesticides.length > 0 ? farmPesticides[0] : null;
      setItemName(initialP ? initialP.name : 'カスケード乳剤');
      setUnit(initialP?.unit || 'ml');
      setSelectedPesticideMode('select');
    } else if (category === 'work') {
      setWorkType('定植');
    } else if (category === 'pest') {
      setItemName('アブラムシ類');
    } else if (category === 'growth') {
      setItemName('草丈・本葉展開');
    } else if (category === 'shipment') {
      setItemName('JA出荷');
      setUnit('kg');
    } else if (category === 'sales') {
      setItemName('直売所売上');
      setUnit('円');
    }
  };

  const handleCloseModal = () => {
    setActiveCategory(null);
  };

  // 日本語・英数・カナの全角半角正規化バリエーション生成ヘルパー
  const generateSearchKeywords = (query: string): string[] => {
    if (!query || !query.trim()) return [];
    const raw = query.trim();
    const set = new Set<string>();
    set.add(raw);

    // 1. 半角英数記号 -> 全角英数記号 (例: 21.0 -> ２１．０, ube -> ＵＢＥ)
    const toZenkaku = raw.replace(/[A-Za-z0-9!-~]/g, (s) =>
      String.fromCharCode(s.charCodeAt(0) + 0xFEE0)
    ).replace(/ /g, '　');
    set.add(toZenkaku);

    // 2. 全角英数記号 -> 半角英数記号 (例: ２１ -> 21)
    const toHankaku = raw.replace(/[！-～]/g, (s) =>
      String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
    ).replace(/　/g, ' ');
    set.add(toHankaku);

    // 3. ひらがな -> カタカナ (例: りゅうさん -> リュウサン, あんもにあ -> アンモニア)
    const toKatakana = raw.replace(/[\u3041-\u3096]/g, (m) =>
      String.fromCharCode(m.charCodeAt(0) + 0x60)
    );
    set.add(toKatakana);

    // 4. カタカナ -> ひらがな (例: アンモニア -> あんもにあ)
    const toHiragana = raw.replace(/[\u30A1-\u30F6]/g, (m) =>
      String.fromCharCode(m.charCodeAt(0) - 0x60)
    );
    set.add(toHiragana);

    // 5. カタカナの全角半角複合
    const toZenkakuKana = toKatakana.replace(/[A-Za-z0-9!-~]/g, (s) =>
      String.fromCharCode(s.charCodeAt(0) + 0xFEE0)
    );
    set.add(toZenkakuKana);

    return Array.from(set).filter(k => k.length > 0);
  };

  const handleSearchPublicFertilizer = async (query: string) => {
    setPublicFertQuery(query);
    if (!query.trim()) {
      setPublicFertResults([]);
      return;
    }
    setSearchingPublicFert(true);
    try {
      const keywords = generateSearchKeywords(query);
      const orConditions = keywords.flatMap(k => [
        `fertilizer_name.ilike.%${k}%`,
        `applicant_name.ilike.%${k}%`,
        `fertilizer_type.ilike.%${k}%`,
        `registration_no.ilike.%${k}%`
      ]).join(',');

      const { data, error } = await supabase
        .from('m_fertilizers')
        .select('*')
        .or(orConditions)
        .limit(30);

      if (!error && data) {
        setPublicFertResults(data);
      }
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setSearchingPublicFert(false);
    }
  };

  const handleSelectPublicFertilizer = (item: any) => {
    setSelectedFertilizerName(item.fertilizer_name);
    setCustomN(String(item.n_percent || 0));
    setCustomP(String(item.p_percent || 0));
    setCustomK(String(item.k_percent || 0));
    setShowFertilizerSearchModal(false);
  };

  // 公的肥料を自社マスタ（materials）に登録して即時適用
  const handleRegisterPublicToMaster = async (item: any) => {
    setIsSavingMaster(true);
    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('テナント認証情報が見つかりません');

      let payload: any = {
        user_id: tenantId,
        name: item.fertilizer_name,
        category: '肥料費',
        material_type: 'fertilizer',
        unit: '袋',
        n_percent: item.n_percent || 0,
        p_percent: item.p_percent || 0,
        k_percent: item.k_percent || 0,
        fertilizer_type: item.fertilizer_type || '化成肥料',
        fertilizer_usage: '共通',
        bag_weight_kg: 20,
        default_price: 0,
        memo: `FAMIC公的登録: ${item.registration_no || ''} (${item.fertilizer_type || ''})`
      };

      let { data, error } = await supabase.from('materials').insert([payload]).select();

      // スキーマ未定義カラムがあった場合の自動フォールバック
      if (error && (error.code === 'PGRST204' || error.message?.includes('schema cache') || error.message?.includes('column'))) {
        const basicPayload = {
          user_id: tenantId,
          name: item.fertilizer_name,
          category: '肥料費',
          material_type: 'fertilizer',
          unit: '袋',
          default_price: 0,
          memo: `FAMIC公的登録: ${item.registration_no || ''} | N:${item.n_percent}% P:${item.p_percent}% K:${item.k_percent}%`
        };
        const fallbackRes = await supabase.from('materials').insert([basicPayload]).select();
        data = fallbackRes.data;
        error = fallbackRes.error;
      }

      if (error) throw error;

      if (data && data[0]) {
        // メモリ上のデータにN-P-Kを補完
        const savedItem = {
          ...data[0],
          n_percent: item.n_percent || 0,
          p_percent: item.p_percent || 0,
          k_percent: item.k_percent || 0
        };
        setFarmFertilizers(prev => [savedItem, ...prev]);
      }

      // フォームに適用
      setSelectedFertilizerName(item.fertilizer_name);
      setCustomN(String(item.n_percent || 0));
      setCustomP(String(item.p_percent || 0));
      setCustomK(String(item.k_percent || 0));
      setFertPricePerBag('0');
      setShowFertilizerSearchModal(false);
    } catch (e: any) {
      alert(`自社マスタへの登録に失敗しました: ${e.message}`);
    } finally {
      setIsSavingMaster(false);
    }
  };

  // 手動で新規肥料を自社マスタ（materials）に登録して即時適用
  const handleCreateCustomMasterFertilizer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFertName.trim()) return;
    setIsSavingMaster(true);
    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('テナント認証情報が見つかりません');

      let payload: any = {
        user_id: tenantId,
        name: newFertName.trim(),
        category: '肥料費',
        material_type: 'fertilizer',
        unit: '袋',
        n_percent: parseFloat(newFertN) || 0,
        p_percent: parseFloat(newFertP) || 0,
        k_percent: parseFloat(newFertK) || 0,
        default_price: parseFloat(newFertPrice) || 0,
        bag_weight_kg: parseFloat(newFertWeight) || 20,
        fertilizer_type: '化成肥料',
        fertilizer_usage: '共通',
        memo: '施肥入力画面より手動登録'
      };

      let { data, error } = await supabase.from('materials').insert([payload]).select();

      // スキーマ未定義カラムがあった場合の自動フォールバック
      if (error && (error.code === 'PGRST204' || error.message?.includes('schema cache') || error.message?.includes('column'))) {
        const basicPayload = {
          user_id: tenantId,
          name: newFertName.trim(),
          category: '肥料費',
          material_type: 'fertilizer',
          unit: '袋',
          default_price: parseFloat(newFertPrice) || 0,
          memo: `施肥画面手動登録 | N:${newFertN}% P:${newFertP}% K:${newFertK}%`
        };
        const fallbackRes = await supabase.from('materials').insert([basicPayload]).select();
        data = fallbackRes.data;
        error = fallbackRes.error;
      }

      if (error) throw error;

      if (data && data[0]) {
        const savedItem = {
          ...data[0],
          n_percent: parseFloat(newFertN) || 0,
          p_percent: parseFloat(newFertP) || 0,
          k_percent: parseFloat(newFertK) || 0
        };
        setFarmFertilizers(prev => [savedItem, ...prev]);
      }

      // フォームに適用
      setSelectedFertilizerName(newFertName.trim());
      setCustomN(String(parseFloat(newFertN) || 0));
      setCustomP(String(parseFloat(newFertP) || 0));
      setCustomK(String(parseFloat(newFertK) || 0));
      setFertPricePerBag(String(parseFloat(newFertPrice) || 0));
      
      // リセット
      setIsAddingNewToMaster(false);
      setNewFertName('');
      setNewFertN('0');
      setNewFertP('0');
      setNewFertK('0');
      setNewFertPrice('0');
      setNewFertWeight('20');
      setShowFertilizerSearchModal(false);
    } catch (e: any) {
      alert(`自社マスタへの登録に失敗しました: ${e.message}`);
    } finally {
      setIsSavingMaster(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const isRecord = activeTab === 'record';
      const timestamp = new Date().toISOString();

      // ログイン中のテナントIDを取得（マルチテナント会社分離の鉄則）
      const currentUserId = await getCurrentTenantId();

      if (activeCategory === 'fertilizer') {
        // 肥料（施肥）の登録: work_logs と material_costs に連動
        const fertMemoText = `[施肥:${fertilizerType}] ${selectedFertilizerName} ${fertCalculation.totalWeightKg}kg (${fertCalculation.bagsCount}袋) | N:${fertCalculation.nPer10a}kg P:${fertCalculation.pPer10a}kg K:${fertCalculation.kPer10a}kg/10a | 費用:¥${fertCalculation.totalCost.toLocaleString()} ${memo}`.trim();

        // 1. work_logs へ Insert
        const workRecords = selectedCultivations.map(c => ({
          user_id: currentUserId,
          field_id: c.fieldId || null,
          crop_id: c.cropId || null,
          work_date: formDate,
          work_type: `施肥 (${fertilizerType})`,
          duration_minutes: parseInt(durationMinutes, 10) || 60,
          status: isRecord ? 'completed' : 'planned',
          memo: `[一括${isRecord ? '記録' : '予定'}] ${fertMemoText}`,
          created_at: timestamp
        }));
        const { error: workErr } = await supabase.from('work_logs').insert(workRecords);
        if (workErr) throw workErr;

        // 2. 実績の場合、資材経費 (material_costs) にも原価を自動計上
        if (isRecord && fertCalculation.totalCost > 0) {
          const costPerField = fertCalculation.totalCost / selectedCultivations.length;
          const costRecords = selectedCultivations.map(c => ({
            user_id: currentUserId,
            crop_id: c.cropId || null,
            expense_date: formDate,
            item_name: `肥料: ${selectedFertilizerName} (${fertilizerType}) - ${c.fieldName}`,
            amount: Math.round(costPerField),
            memo: fertMemoText,
            created_at: timestamp
          }));
          await supabase.from('material_costs').insert(costRecords);
        }

      } else if (activeCategory === 'shipment' || activeCategory === 'sales') {
        // sales_logs に一括登録（面積按分または一律）
        const recordsToInsert = fieldDistributions.map(dist => ({
          user_id: currentUserId,
          field_id: dist.fieldId || null,
          crop_id: dist.cropId || null,
          sales_date: formDate,
          quantity: activeCategory === 'shipment' ? (dist.quantity || 0) : 1,
          unit: unit || 'kg',
          total_sales: activeCategory === 'sales' ? (parseFloat(priceAmount) || 0) : null,
          memo: `[一括${isRecord ? '記録' : '予定'}:${activeCategory === 'shipment' ? '出荷' : '売上'}] ${itemName} ${memo}`.trim(),
          created_at: timestamp
        }));
        const { error } = await supabase.from('sales_logs').insert(recordsToInsert);
        if (error) throw error;

      } else {
        // 通常作業・農薬・病害虫・生育調査の work_logs 登録
        const typeLabelMap: Record<string, string> = {
          pesticide: '農薬散布',
          work: workType || '一般作業',
          pest: '病害虫記録',
          growth: '生育調査'
        };

        const racTag = complianceReport?.currentRac ? ` [RAC:${complianceReport.currentRac}]` : '';
        const ingTag = complianceReport?.activeIngredients?.length 
          ? ` [成分:${complianceReport.activeIngredients.map(i => i.name).join(',')}]` 
          : '';

        const recordsToInsert = fieldDistributions.map(dist => ({
          user_id: currentUserId,
          field_id: dist.fieldId || null,
          crop_id: dist.cropId || null,
          work_date: formDate,
          work_type: typeLabelMap[activeCategory || 'work'] || '農作業',
          duration_minutes: dist.durationMinutes || 0,
          status: isRecord ? 'completed' : 'planned',
          memo: `[一括${isRecord ? '記録' : '予定'}] ${itemName ? `品名:${itemName}${racTag}${ingTag} ` : ''}${dist.quantity ? `数量:${dist.quantity}${unit} ` : ''}${memo}`.trim(),
          created_at: timestamp
        }));

        const { error } = await supabase.from('work_logs').insert(recordsToInsert);
        if (error) throw error;
      }

      onSuccess(`${selectedCultivations.length}件の作付けに一括${isRecord ? '記録' : '予定'}を登録しました！`);
      handleCloseModal();
      onClearSelection();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || '登録中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = [
    { id: 'fertilizer' as const, label: '肥料', icon: Sprout, color: 'bg-amber-100 text-amber-600 border-amber-300 hover:bg-amber-200' },
    { id: 'pesticide' as const, label: '農薬', icon: FlaskConical, color: 'bg-rose-100 text-rose-600 border-rose-300 hover:bg-rose-200' },
    { id: 'work' as const, label: '作業', icon: PenTool, color: 'bg-emerald-100 text-emerald-600 border-emerald-300 hover:bg-emerald-200' },
    { id: 'pest' as const, label: '病害虫', icon: Bug, color: 'bg-stone-100 text-stone-600 border-stone-300 hover:bg-stone-200' },
    { id: 'growth' as const, label: '生育調査', icon: Ruler, color: 'bg-cyan-100 text-cyan-600 border-cyan-300 hover:bg-cyan-200' },
    { id: 'shipment' as const, label: '出荷', icon: Package, color: 'bg-blue-100 text-blue-600 border-blue-300 hover:bg-blue-200' },
    { id: 'sales' as const, label: '売上', icon: Coins, color: 'bg-yellow-100 text-yellow-600 border-yellow-300 hover:bg-yellow-200' },
  ];

  return (
    <>
      {/* 画面下部に固定されるボトムシートバー */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl transition-all duration-300 animate-in slide-in-from-bottom-5">
        <div className="max-w-5xl mx-auto px-4 py-3 sm:px-6">
          
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-100 rounded-full border border-emerald-200">
                {selectedCultivations.length} 件選択中
              </span>
              <span className="text-xs text-slate-500 hidden sm:inline font-medium">
                合計面積: {totalAreaAcre.toFixed(1)} a
              </span>
              <button
                onClick={onClearSelection}
                className="text-xs text-slate-500 hover:text-rose-600 underline ml-2 transition-colors"
              >
                選択解除
              </button>
            </div>

            {/* 「記録」と「予定」の切り替えタブ */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab('record')}
                className={`px-5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'record'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                記録 (実績)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('plan')}
                className={`px-5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'plan'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                予定 (指示)
              </button>
            </div>
          </div>

          {/* 7大アクション丸アイコンボタン群 */}
          <div className="grid grid-cols-7 gap-2 sm:gap-4 pt-1">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleOpenModal(cat.id)}
                  className="flex flex-col items-center justify-center group focus:outline-none"
                >
                  <div className={`w-11 h-11 sm:w-13 sm:h-13 rounded-2xl flex items-center justify-center border transition-all duration-200 group-hover:scale-105 group-active:scale-95 shadow-sm ${cat.color}`}>
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <span className="text-[11px] sm:text-xs font-bold text-slate-700 mt-1.5 group-hover:text-emerald-700 transition-colors">
                    {cat.label}
                  </span>
                </button>
              );
            })}
          </div>

        </div>
      </div>

      {/* 一括入力モーダル */}
      {activeCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            
            {/* モーダルヘッダー */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${categories.find(c => c.id === activeCategory)?.color}`}>
                  {React.createElement(categories.find(c => c.id === activeCategory)?.icon || FileText, { className: 'w-4 h-4' })}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    一括{activeTab === 'record' ? '記録' : '予定'}登録：{categories.find(c => c.id === activeCategory)?.label}
                  </h3>
                  <p className="text-xs text-slate-500">
                    選択中の {selectedCultivations.length} 圃場 (計 {totalAreaAcre.toFixed(1)}a) に保存されます
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 対象一覧プレビュー */}
            <div className="px-6 py-2 bg-emerald-50/60 border-b border-emerald-100 flex items-center gap-2 overflow-x-auto text-xs text-emerald-800">
              <MapPin className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
              <span className="font-semibold shrink-0">対象:</span>
              <div className="flex gap-1.5 flex-nowrap">
                {selectedCultivations.map((c, i) => (
                  <span key={i} className="bg-white px-2 py-0.5 rounded-md border border-emerald-200 font-medium whitespace-nowrap">
                    {c.cropName} ({c.fieldName})
                  </span>
                ))}
              </div>
            </div>

            {/* モーダルフォーム */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* 日付 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {activeTab === 'record' ? '実施日' : '予定日'}
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>
              </div>

              {/* ========================================================= */}
              {/* 肥料専用入力ブロック（N-P-K計算 & コスト連動） */}
              {/* ========================================================= */}
              {activeCategory === 'fertilizer' && (
                <div className="space-y-3.5 p-4 bg-amber-50/50 border border-amber-200 rounded-2xl">
                  
                  {/* 施肥区分 */}
                  <div>
                    <label className="block text-xs font-bold text-amber-900 mb-1.5">施肥区分</label>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-center">
                      {(['元肥', '追肥1回目', '追肥2回目', '土壌改良', '葉面散布'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setFertilizerType(t)}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all border ${
                            fertilizerType === t
                              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                              : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 肥料選択 */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-amber-900">肥料・資材名</label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowFertilizerSearchModal(true);
                          setPublicFertQuery('');
                          setPublicFertResults([]);
                        }}
                        className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-100/80 hover:bg-emerald-200/80 border border-emerald-300 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-all shadow-2xs"
                      >
                        <Search className="w-3 h-3 text-emerald-600" />
                        公的肥料マスターから検索
                      </button>
                    </div>

                    <select
                      value={selectedFertilizerName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedFertilizerName(val);
                        
                        // 自社登録肥料から選択された場合
                        const farmItem = farmFertilizers.find(f => f.name === val);
                        if (farmItem) {
                          setCustomN(String(farmItem.n_percent ?? farmItem.n_ratio ?? 0));
                          setCustomP(String(farmItem.p_percent ?? farmItem.p_ratio ?? 0));
                          setCustomK(String(farmItem.k_percent ?? farmItem.k_ratio ?? 0));
                          setFertPricePerBag(String(farmItem.default_price || farmItem.unit_price || 0));
                        }
                      }}
                      className="w-full px-3 py-2 text-sm bg-white border border-amber-300 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      {farmFertilizers.length > 0 ? (
                        <>
                          <optgroup label="🏢 自農園マスタ登録肥料（資材マスタ）">
                            {farmFertilizers.map((f) => (
                              <option key={f.id} value={f.name}>
                                {f.name} {f.default_price ? `(単価:約¥${Number(f.default_price).toLocaleString()})` : ''}
                              </option>
                            ))}
                          </optgroup>
                          <option value="その他（手入力）">✏️ その他（手入力・公的マスターから適用）</option>
                        </>
                      ) : (
                        <>
                          <option value="その他（手入力）">🔍 自農園マスタ未登録（公的マスター検索または手入力）</option>
                        </>
                      )}
                    </select>
                  </div>

                  {/* 施肥量入力（袋数 または kg） */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold text-amber-900">投入量</label>
                        <div className="flex text-[10px] font-bold bg-amber-200/60 p-0.5 rounded-md">
                          <button
                            type="button"
                            onClick={() => setFertInputMode('bags')}
                            className={`px-1.5 py-0.5 rounded ${fertInputMode === 'bags' ? 'bg-white text-amber-900 shadow-xs' : 'text-amber-700'}`}
                          >
                            袋数
                          </button>
                          <button
                            type="button"
                            onClick={() => setFertInputMode('kg')}
                            className={`px-1.5 py-0.5 rounded ${fertInputMode === 'kg' ? 'bg-white text-amber-900 shadow-xs' : 'text-amber-700'}`}
                          >
                            kg
                          </button>
                        </div>
                      </div>

                      {fertInputMode === 'bags' ? (
                        <div className="relative">
                          <input
                            type="number"
                            step="any"
                            value={fertBags}
                            onChange={(e) => setFertBags(e.target.value)}
                            placeholder="3"
                            className="w-full px-3 py-2 text-sm bg-white border border-amber-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">袋</span>
                        </div>
                      ) : (
                        <div className="relative">
                          <input
                            type="number"
                            step="any"
                            value={fertTotalKg}
                            onChange={(e) => setFertTotalKg(e.target.value)}
                            placeholder="60"
                            className="w-full px-3 py-2 text-sm bg-white border border-amber-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">kg</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-amber-900 mb-1.5">袋単価 (概算)</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={fertPricePerBag}
                          onChange={(e) => setFertPricePerBag(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white border border-amber-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">円/袋</span>
                      </div>
                    </div>
                  </div>

                  {/* N-P-K 成分量 ＆ コスト自動計算サマリー */}
                  <div className="p-3 bg-white border border-amber-200 rounded-xl shadow-xs space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                      <span className="flex items-center gap-1">
                        <Calculator className="w-3.5 h-3.5 text-amber-600" />
                        10aあたり純成分投入量 (kg/10a)
                      </span>
                      <span className="text-amber-700">総量: {fertCalculation.totalWeightKg}kg</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="text-[10px] font-extrabold text-blue-600">N (窒素)</div>
                        <div className="text-sm font-black text-blue-900">{fertCalculation.nPer10a} <span className="text-[10px]">kg</span></div>
                      </div>
                      <div className="p-2 bg-orange-50 border border-orange-200 rounded-lg">
                        <div className="text-[10px] font-extrabold text-orange-600">P (リン酸)</div>
                        <div className="text-sm font-black text-orange-900">{fertCalculation.pPer10a} <span className="text-[10px]">kg</span></div>
                      </div>
                      <div className="p-2 bg-purple-50 border border-purple-200 rounded-lg">
                        <div className="text-[10px] font-extrabold text-purple-600">K (カリ)</div>
                        <div className="text-sm font-black text-purple-900">{fertCalculation.kPer10a} <span className="text-[10px]">kg</span></div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-amber-100 text-xs font-bold">
                      <span className="text-slate-600">概算肥料原価 (合計):</span>
                      <span className="text-emerald-700 text-sm font-black">¥{fertCalculation.totalCost.toLocaleString()}</span>
                    </div>
                  </div>

                </div>
              )}

              {/* 作業内容 */}
              {activeCategory === 'work' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">作業内容</label>
                  <select
                    value={workType}
                    onChange={(e) => setWorkType(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  >
                    <option value="播種">播種（種まき）</option>
                    <option value="定植">定植（植え付け）</option>
                    <option value="水やり・灌水">水やり・灌水</option>
                    <option value="草引き・除草">草引き・除草</option>
                    <option value="剪定・整枝">剪定・整枝・芽かき</option>
                    <option value="収穫・調製">収穫・調製</option>
                    <option value="片付け・耕起">片付け・耕起</option>
                    <option value="その他">その他管理作業</option>
                  </select>
                </div>
              )}

              {/* 農薬専用入力ブロック（自社農薬マスタ連動 & 有効成分合算 & RAC重複判定） */}
              {activeCategory === 'pesticide' && (
                <div className="space-y-3.5 p-4 bg-rose-50/60 border border-rose-200 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-rose-950">
                      農薬名（自社登録農薬）
                    </label>
                    <Link
                      href="/admin/cultivations?tab=spray"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-800 underline flex items-center gap-1"
                    >
                      残回数・RAC管理画面を開く (別タブ) ➔
                    </Link>
                  </div>

                  {farmPesticides.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-600 font-medium">
                          自農園マスタ（{farmPesticides.length}品目）から選択:
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedPesticideMode === 'select') {
                              setSelectedPesticideMode('custom');
                              setItemName('');
                            } else {
                              setSelectedPesticideMode('select');
                              setItemName(farmPesticides[0]?.name || '');
                            }
                          }}
                          className="text-[11px] text-rose-700 font-bold underline"
                        >
                          {selectedPesticideMode === 'select' ? '手入力に切り替え' : 'マスタ選択に戻る'}
                        </button>
                      </div>

                      {selectedPesticideMode === 'select' ? (
                        <select
                          value={itemName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setItemName(val);
                            const matched = farmPesticides.find(p => p.name === val);
                            if (matched && matched.unit) {
                              setUnit(matched.unit);
                            }
                          }}
                          className="w-full px-3 py-2 text-sm bg-white border border-rose-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-xs"
                        >
                          {farmPesticides.map((p) => (
                            <option key={p.id || p.name} value={p.name}>
                              {p.name} {p.unit ? `(${p.unit})` : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          required
                          value={itemName}
                          onChange={(e) => setItemName(e.target.value)}
                          placeholder="農薬名を手入力してください"
                          className="w-full px-3 py-2 text-sm bg-white border border-rose-300 rounded-xl font-medium text-slate-900 focus:ring-2 focus:ring-rose-500 shadow-xs"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="p-2.5 bg-rose-100/70 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between gap-2">
                        <span>自社農薬マスタに農薬が未登録です</span>
                        <Link
                          href="/farm/pesticide-check"
                          target="_blank"
                          className="px-2 py-1 bg-rose-600 text-white rounded-lg text-[10px] font-bold shrink-0 shadow-xs"
                        >
                          農薬カルテから追加
                        </Link>
                      </div>
                      <input
                        type="text"
                        required
                        value={itemName}
                        onChange={(e) => setItemName(e.target.value)}
                        placeholder="農薬名を入力してください"
                        className="w-full px-3 py-2 text-sm bg-white border border-rose-300 rounded-xl font-medium text-slate-900 focus:ring-2 focus:ring-rose-500 shadow-xs"
                      />
                    </div>
                  )}

                  {/* ========================================================= */}
                  {/* 【最高峰・安全エンジン】有効成分合算 & RAC重複リアルタイム診断パネル */}
                  {/* ========================================================= */}
                  {isCheckingPesticide ? (
                    <div className="p-3 bg-white border border-rose-200 rounded-xl text-xs text-rose-600 flex items-center gap-2 animate-pulse">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>公的FAMICマスタ照合 ＆ 有効成分合算チェック中...</span>
                    </div>
                  ) : complianceReport && (
                    <div className="space-y-2.5 pt-1">
                      
                      {/* 1. 有効成分ごとの合算使用回数判定 */}
                      <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                          <span className="flex items-center gap-1.5 text-rose-900">
                            <FlaskConical className="w-3.5 h-3.5 text-rose-600" />
                            <span>有効成分ごとの通算使用回数 (自農園実績)</span>
                          </span>
                          <span className="text-[10px] font-normal text-slate-400">
                            対象作目: {cleanTargetCrop}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          {complianceReport.activeIngredients.map((ing, idx) => {
                            const remaining = Math.max(0, ing.maxLimit - ing.totalCount);
                            return (
                              <div 
                                key={idx} 
                                className={`p-2.5 rounded-lg border text-xs ${
                                  ing.isOver 
                                    ? 'bg-rose-50 border-rose-300 text-rose-900' 
                                    : ing.isAtLimit 
                                    ? 'bg-amber-50 border-amber-300 text-amber-900' 
                                    : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                                }`}
                              >
                                <div className="flex items-center justify-between font-bold mb-1">
                                  <span className="truncate max-w-[200px]">{ing.name}</span>
                                  <span>
                                    通算 {ing.totalCount}回 / 上限{ing.maxLimit}回
                                    {ing.isOver && <span className="ml-1 text-rose-600 font-black">【上限超過🚨】</span>}
                                    {ing.isAtLimit && <span className="ml-1 text-amber-700 font-black">【今回で上限到達⚠️】</span>}
                                    {!ing.isOver && !ing.isAtLimit && <span className="ml-1 text-emerald-700">（残{remaining}回）</span>}
                                  </span>
                                </div>
                                <div className="text-[10px] opacity-80 flex items-center justify-between">
                                  <span>過去実績: {ing.pastCount}回 ＋ 今回散布: 1回</span>
                                  <span>※同一成分を含む別商品も自動合算済み</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 2. RACローテーション（作用機構重複）警告 */}
                      {complianceReport.currentRac && (
                        <div className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                          complianceReport.isRacDuplicate
                            ? 'bg-amber-50 border-amber-300 text-amber-900'
                            : 'bg-blue-50/70 border-blue-200 text-blue-900'
                        }`}>
                          <span className="shrink-0 px-2 py-0.5 rounded font-black text-[11px] bg-white border border-slate-300 shadow-2xs">
                            RAC: {complianceReport.currentRac}
                          </span>
                          <div className="flex-1 min-w-0">
                            {complianceReport.isRacDuplicate ? (
                              <p className="font-bold leading-relaxed">
                                ⚠️ <span className="font-extrabold text-amber-700">前回散布と同じ系統（{complianceReport.currentRac}）です。</span>
                                <span className="font-normal block text-[11px] text-amber-800">
                                  害虫・菌の薬剤抵抗性（耐性）を防ぐため、他系統の農薬へのローテーション散布を推奨します。
                                </span>
                              </p>
                            ) : (
                              <p className="font-medium text-[11px] leading-relaxed">
                                ✨ 作用機構分類: <span className="font-bold">{complianceReport.currentRac}</span>
                                {complianceReport.lastSprayInfo?.rac && (
                                  <span className="text-slate-500 ml-1">
                                    （前回 {complianceReport.lastSprayInfo.date}: {complianceReport.lastSprayInfo.rac || '別系統'} から良好にローテーション中）
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 3. 公的希釈倍率・使用時期ガイド */}
                      {complianceReport.famicData && (
                        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-bold text-slate-700">
                            <span>💧 希釈: {complianceReport.famicData.usage_amount || '規定倍率'}</span>
                            <span>⏳ 時期: {complianceReport.famicData.usage_time || '収穫前日まで'}</span>
                          </div>
                          {complianceReport.famicData.target_pest && (
                            <p className="truncate text-slate-500">
                              🎯 適用: {complianceReport.famicData.target_pest}
                            </p>
                          )}
                        </div>
                      )}

                    </div>
                  )}

                </div>
              )}

              {/* 病害虫・生育調査・出荷・売上の一般名称入力 */}
              {(activeCategory === 'pest' || activeCategory === 'growth' || activeCategory === 'shipment' || activeCategory === 'sales') && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {activeCategory === 'pest' && '病害虫・雑草名'}
                    {activeCategory === 'growth' && '調査項目'}
                    {activeCategory === 'shipment' && '出荷先 / 販路'}
                    {activeCategory === 'sales' && '販売先・用途'}
                  </label>
                  <input
                    type="text"
                    required
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="名称を入力してください"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>
              )}

              {/* 数量・単位 (出荷・売上・農薬等) */}
              {(activeCategory === 'pesticide' || activeCategory === 'shipment' || activeCategory === 'sales') && (
                <div className="space-y-2.5">
                  {/* 複数圃場選択時の配分モード選択 */}
                  {selectedCultivations.length > 1 && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold text-slate-700">
                          数量の配分方法 ({selectedCultivations.length}圃場 / 計{totalAreaAcre.toFixed(1)}a)
                        </label>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => setQuantityMode('total_proportional')}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all border ${
                            quantityMode === 'total_proportional'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          📊 合計から面積按分
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuantityMode('per_10a')}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all border ${
                            quantityMode === 'per_10a'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          🌱 10aあたり基準量
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuantityMode('uniform')}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all border ${
                            quantityMode === 'uniform'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          📝 各圃場一律
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        {selectedCultivations.length > 1 ? (
                          quantityMode === 'total_proportional' 
                            ? `合計使用量 (計${totalAreaAcre.toFixed(1)}a分)` 
                            : quantityMode === 'per_10a' 
                            ? '10a(1反)あたり使用量' 
                            : '各圃場あたりの数量'
                        ) : '使用数量'}
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder={quantityMode === 'total_proportional' ? '例: 200' : '例: 10'}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">単位</label>
                      <input
                        type="text"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        placeholder="ml, g, L, kg など"
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 売上金額 */}
              {activeCategory === 'sales' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">売上金額 (円)</label>
                  <div className="relative">
                    <Coins className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      value={priceAmount}
                      onChange={(e) => setPriceAmount(e.target.value)}
                      placeholder="例: 50000"
                      className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium"
                    />
                  </div>
                </div>
              )}

              {/* 所要時間 */}
              {activeCategory !== 'sales' && (
                <div className="space-y-2.5">
                  {selectedCultivations.length > 1 && (
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-700">所要時間の計算</label>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setDurationMode('total_proportional')}
                          className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                            durationMode === 'total_proportional'
                              ? 'bg-slate-800 text-white border-slate-800'
                              : 'bg-white text-slate-600 border-slate-200'
                          }`}
                        >
                          合計時間を面積按分
                        </button>
                        <button
                          type="button"
                          onClick={() => setDurationMode('uniform')}
                          className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                            durationMode === 'uniform'
                              ? 'bg-slate-800 text-white border-slate-800'
                              : 'bg-white text-slate-600 border-slate-200'
                          }`}
                        >
                          各圃場一律
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {selectedCultivations.length > 1 && durationMode === 'total_proportional'
                        ? `合計所要時間 (計${totalAreaAcre.toFixed(1)}a分・分)`
                        : '所要時間 (分/圃場)'}
                    </label>
                    <div className="relative">
                      <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="number"
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(e.target.value)}
                        placeholder="60"
                        className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 複数圃場選択時の自動按分内訳プレビューカード */}
              {selectedCultivations.length > 1 && (parseFloat(quantity) > 0 || parseFloat(durationMinutes) > 0) && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-bold text-slate-700 text-[11px] border-b border-slate-200 pb-1">
                    <span className="flex items-center gap-1 text-emerald-800">
                      <MapPin className="w-3 h-3 text-emerald-600" />
                      <span>圃場ごとの自動配分プレビュー (面積比例)</span>
                    </span>
                    <span>合計 {totalAreaAcre.toFixed(1)}a</span>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto pt-0.5">
                    {fieldDistributions.map((dist, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px] bg-white p-1.5 rounded border border-slate-100">
                        <span className="font-semibold text-slate-800 truncate max-w-[140px]">
                          {dist.fieldName} <span className="text-slate-400 font-normal">({dist.areaAcre}a / {dist.ratioPercent}%)</span>
                        </span>
                        <div className="flex items-center gap-2 font-bold text-slate-700 shrink-0">
                          {dist.quantity > 0 && (
                            <span className="text-emerald-700">{dist.quantity} {unit}</span>
                          )}
                          {dist.durationMinutes > 0 && (
                            <span className="text-slate-500 font-normal">{dist.durationMinutes}分</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* メモ */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">備考・メモ</label>
                <textarea
                  rows={2}
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="施肥機設定、作業メモ等"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium resize-none"
                />
              </div>

              {/* ボタン */}
              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-100 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>保存中...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>一括{activeTab === 'record' ? '記録' : '予定'}を保存</span>
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* 公的肥料マスター検索・自社マスタ登録モーダル */}
      {showFertilizerSearchModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[88vh] flex flex-col">
            
            {/* モーダルヘッダー */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <FlaskConical className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">肥料マスター選択・自社マスタ登録</h3>
                  <p className="text-[11px] text-slate-400">公的4.5万件から検索、または新規肥料を自社資材マスタに即時登録できます</p>
                </div>
              </div>
              <button 
                onClick={() => setShowFertilizerSearchModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* モード切り替えタブ */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => setIsAddingNewToMaster(false)}
                className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  !isAddingNewToMaster
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                全国公的マスターから検索・登録
              </button>
              <button
                type="button"
                onClick={() => setIsAddingNewToMaster(true)}
                className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  isAddingNewToMaster
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                手動で自社マスタに新規登録
              </button>
            </div>

            {/* 1. 公的マスター検索モード */}
            {!isAddingNewToMaster ? (
              <>
                {/* 検索入力バー */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="肥料名・銘柄・メーカー名（例: 21, 硫酸, 14-14-14, ube）..."
                    value={publicFertQuery}
                    onChange={(e) => handleSearchPublicFertilizer(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* 検索結果リスト */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[240px]">
                  {searchingPublicFert ? (
                    <div className="py-12 text-center text-slate-500 text-sm flex flex-col items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mb-2" />
                      データベースを検索中...
                    </div>
                  ) : publicFertResults.length > 0 ? (
                    publicFertResults.map((item) => {
                      const isAlreadyInFarm = farmFertilizers.some(f => f.name === item.fertilizer_name);
                      return (
                        <div
                          key={item.id}
                          className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-white text-sm flex items-center gap-2 flex-wrap">
                              <span>{item.fertilizer_name}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                {item.fertilizer_type || '肥料'}
                              </span>
                              {isAlreadyInFarm && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                                  自社マスタ登録済
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5 truncate">
                              {item.applicant_name ? `${item.applicant_name} | ` : ''}登録番号: {item.registration_no || '-'}
                            </div>
                            
                            {/* N-P-K 比率 */}
                            <div className="flex items-center gap-1.5 font-mono text-xs mt-1.5">
                              <span className="px-1.5 py-0.2 bg-blue-950 text-blue-300 border border-blue-800 rounded text-[11px] font-black">
                                N {item.n_percent}%
                              </span>
                              <span className="px-1.5 py-0.2 bg-amber-950 text-amber-300 border border-amber-800 rounded text-[11px] font-black">
                                P {item.p_percent}%
                              </span>
                              <span className="px-1.5 py-0.2 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded text-[11px] font-black">
                                K {item.k_percent}%
                              </span>
                              {item.other_ingredients && (
                                <span className="text-[10px] text-slate-500 font-sans truncate max-w-[200px]">
                                  {item.other_ingredients}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* アクションボタン群 */}
                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => handleSelectPublicFertilizer(item)}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all"
                            >
                              今回のみ適用
                            </button>
                            <button
                              type="button"
                              disabled={isSavingMaster}
                              onClick={() => handleRegisterPublicToMaster(item)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1 disabled:opacity-50"
                            >
                              {isSavingMaster ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                              自社マスタに登録
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : publicFertQuery.trim() ? (
                    <div className="py-12 text-center text-slate-500 text-sm space-y-2">
                      <p>一致する肥料銘柄が見つかりませんでした。</p>
                      <button
                        type="button"
                        onClick={() => {
                          setNewFertName(publicFertQuery.trim());
                          setIsAddingNewToMaster(true);
                        }}
                        className="text-xs font-bold text-emerald-400 hover:underline inline-flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        「{publicFertQuery.trim()}」を手動で自社マスタに新規登録する ➔
                      </button>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-slate-500 text-xs space-y-2">
                      <p>上の検索バーに肥料名やメーカー名を入力してください。</p>
                      <button
                        type="button"
                        onClick={() => setIsAddingNewToMaster(true)}
                        className="text-xs font-bold text-emerald-400 hover:underline inline-flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        手動で新規肥料を登録する場合はこちら ➔
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* 2. 手動で自社マスタ新規登録フォーム */
              <form onSubmit={handleCreateCustomMasterFertilizer} className="flex-1 overflow-y-auto space-y-3.5 pr-1">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">肥料の名称 (銘柄名) *</label>
                  <input
                    type="text"
                    required
                    placeholder="例: マイガーデンベジタブル, 自家配合ボカシ"
                    value={newFertName}
                    onChange={(e) => setNewFertName(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* N-P-K 保証成分 */}
                <div>
                  <label className="block text-xs font-bold text-emerald-400 mb-1">保証成分比率 (%)</label>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[10px] text-blue-400 font-bold block mb-0.5">窒素 (N %)</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={newFertN}
                        onChange={(e) => setNewFertN(e.target.value)}
                        className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-amber-400 font-bold block mb-0.5">りん酸 (P %)</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={newFertP}
                        onChange={(e) => setNewFertP(e.target.value)}
                        className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-400 font-bold block mb-0.5">加里 (K %)</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={newFertK}
                        onChange={(e) => setNewFertK(e.target.value)}
                        className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 単価・袋容量 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">袋単価 (標準仕入価格)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        value={newFertPrice}
                        onChange={(e) => setNewFertPrice(e.target.value)}
                        className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">円/袋</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">1袋あたりの重量</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        value={newFertWeight}
                        onChange={(e) => setNewFertWeight(e.target.value)}
                        className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">kg</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingNewToMaster(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingMaster}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isSavingMaster ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    自社マスタに登録して施肥入力に適用
                  </button>
                </div>
              </form>
            )}

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowFertilizerSearchModal(false)}
                className="px-4 py-1.5 text-xs font-bold text-slate-400 hover:text-white"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
