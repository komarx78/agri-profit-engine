"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Sprout, 
  FlaskConical, 
  History, 
  CheckSquare, 
  MapPin, 
  Calendar, 
  Search, 
  List, 
  Map as MapIcon, 
  Square, 
  Loader2, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Folder, 
  ShieldAlert, 
  Check, 
  Clock, 
  User, 
  X, 
  Filter, 
  ArrowRight,
  ChevronRight,
  ChevronDown,
  Copy,
  Printer,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '@/lib/tenant';
import { CultivationActionSheet, CultivationTarget } from '@/components/CultivationActionSheet';
import { PesticideLogReportModal } from '@/components/PesticideLogReportModal';
import { saveWorkerShareSettings, getWorkerShareSettings } from '@/app/actions/farm';
import { generateComprehensiveSearchKeywords, isFuzzyMatch } from '@/lib/fuzzySearch';
import { getJSTDate } from '@/lib/dateUtils';
import Link from 'next/link';

interface CultivationItem {
  id: string;
  fieldId: string;
  fieldName: string;
  cropId: string;
  cropName: string;
  areaAcre: number;
  startDate: string;
  status: string;
}

interface PesticideDisplayItem {
  id: string;
  name: string;
  type: '殺虫剤' | '殺菌剤' | '除草剤' | 'その他';
  racCode: string;
  targetPests: string[];
  maxCount: number;
  usedCount: number;
  dilution: string;
  usageTime: string;
  method: string;
}

interface CultivationsHubProps {
  initialSubTab?: string;
}

export default function CultivationsHub({ initialSubTab = 'cultivations' }: CultivationsHubProps) {
  const router = useRouter();

  // メインタブ: cultivations(作付け) | spray(散布管理) | history(作業・散布履歴) | tasks(予定)
  const [activeMainTab, setActiveMainTab] = useState<string>(initialSubTab);

  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [currentTenantId, setCurrentTenantId] = useState<string>('');

  // マスタ
  const [crops, setCrops] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [farmRegisteredPesticides, setFarmRegisteredPesticides] = useState<any[]>([]);

  // --- タブ1: 作付け一覧ステート ---
  const [cultivations, setCultivations] = useState<CultivationItem[]>([]);
  const [searchCultivationQuery, setSearchCultivationQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // --- タブ2: 散布管理ステート ---
  const [pesticides, setPesticides] = useState<PesticideDisplayItem[]>([]);
  const [selectedSprayCropId, setSelectedSprayCropId] = useState<string>('');
  const [selectedSprayFieldIds, setSelectedSprayFieldIds] = useState<string[]>([]);
  const [sprayCategoryTab, setSprayCategoryTab] = useState<'殺虫剤' | '殺菌剤' | '除草剤' | 'その他'>('殺虫剤');
  const [searchSprayQuery, setSearchSprayQuery] = useState('');
  const [selectedPesticideIds, setSelectedPesticideIds] = useState<string[]>([]);
  const [isSprayModalOpen, setIsSprayModalOpen] = useState(false);
  const [sprayDate, setSprayDate] = useState<string>(() => getJSTDate());
  const [sprayWaterVolume, setSprayWaterVolume] = useState<string>('100');
  const [sprayMemo, setSprayMemo] = useState<string>('');
  const [isSavingSpray, setIsSavingSpray] = useState(false);

  // --- タブ3: 肥料管理ステート ---
  const [officialFertilizers, setOfficialFertilizers] = useState<any[]>([]);
  const [farmRegisteredFertilizers, setFarmRegisteredFertilizers] = useState<any[]>([]);
  const [searchFertQuery, setSearchFertQuery] = useState('');
  const [fertCategoryTab, setFertCategoryTab] = useState<string>('all');
  const [isLoadingFertilizers, setIsLoadingFertilizers] = useState(false);
  const [fertAnalysisCropId, setFertAnalysisCropId] = useState<string>('all');
  const [fertAnalysisFieldId, setFertAnalysisFieldId] = useState<string>('all');

  // --- タブ4: 履歴ステート ---
  const [workLogs, setWorkLogs] = useState<any[]>([]);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'all' | 'sprayOnly' | 'fertOnly' | 'workOnly'>('all');
  const [historyGroupMode, setHistoryGroupMode] = useState<'date' | 'field' | 'crop' | 'type'>('date');
  const [historyFieldFilter, setHistoryFieldFilter] = useState<string>('all');
  const [historyCropFilter, setHistoryCropFilter] = useState<string>('all');
  const [collapsedHistoryGroups, setCollapsedHistoryGroups] = useState<Record<string, boolean>>({});

  // 履歴の訂正・編集用ステート
  const [editingLog, setEditingLog] = useState<any | null>(null);
  const [editWorkDate, setEditWorkDate] = useState<string>('');
  const [editFieldId, setEditFieldId] = useState<string>('');
  const [editCropId, setEditCropId] = useState<string>('');
  const [editWorkType, setEditWorkType] = useState<string>('');
  const [editDuration, setEditDuration] = useState<string>('');
  const [editMemo, setEditMemo] = useState<string>('');
  const [isUpdatingLog, setIsUpdatingLog] = useState(false);

  // 履歴の直接新規登録用ステート
  const [isDirectAddModalOpen, setIsDirectAddModalOpen] = useState(false);
  const [directAddDate, setDirectAddDate] = useState<string>(() => getJSTDate());
  const [directAddFieldId, setDirectAddFieldId] = useState<string>('');
  const [directAddCropId, setDirectAddCropId] = useState<string>('');
  const [directAddWorkType, setDirectAddWorkType] = useState<string>('収穫');
  const [directAddDuration, setDirectAddDuration] = useState<string>('60');
  const [directAddMemo, setDirectAddMemo] = useState<string>('');
  const [isDirectAdding, setIsDirectAdding] = useState(false);

  // 肥料検索用デバウンス＆リクエスト管理ref・キャッシュref
  const searchFertilizerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchFertilizerReqIdRef = useRef<number>(0);
  const hasLoadedOfficialFertsRef = useRef<boolean>(false);
  const famicCacheRef = useRef<Map<string, any[]>>(new Map());

  // 作業者向け生産性共有設定ステート
  const [isShareSettingsOpen, setIsShareSettingsOpen] = useState(false);
  const [shareSettings, setShareSettings] = useState<{
    showYieldPerHour: boolean;
    showRevenuePerHour: boolean;
    showTeamTotals: boolean;
  }>({
    showYieldPerHour: true,
    showRevenuePerHour: true,
    showTeamTotals: true
  });

  // 設定の初期読み込み（ローカルキャッシュ即時反映 ＋ バックグラウンドDB同期）
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('agri_worker_share_settings');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') setShareSettings(parsed);
        } catch (e) {}
      }
    }
    const loadSettings = async () => {
      try {
        const tenantId = await getCurrentTenantId();
        if (tenantId) {
          const res = await getWorkerShareSettings(tenantId);
          if (res.success && res.data) {
            setShareSettings(res.data);
            if (typeof window !== 'undefined') {
              localStorage.setItem('agri_worker_share_settings', JSON.stringify(res.data));
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load share settings:', e);
      }
    };
    loadSettings();
  }, []);

  const handleSaveShareSettings = async (newSettings: any) => {
    setShareSettings(newSettings);
    if (typeof window !== 'undefined') {
      localStorage.setItem('agri_worker_share_settings', JSON.stringify(newSettings));
    }
    try {
      const tenantId = await getCurrentTenantId();
      if (tenantId) {
        await saveWorkerShareSettings(tenantId, newSettings);
      }
    } catch (e) {
      console.warn('Failed to save share settings to DB:', e);
    }
    setIsShareSettingsOpen(false);
    showToast('作業者への生産性共有設定を全社反映・保存しました！');
  };

  // 公的防除日誌モーダルステート
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');

  // --- タブ5: 作業予定（タスク）ステート ---
  const [plannedTasks, setPlannedTasks] = useState<any[]>([]);
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [taskUrgencyFilter, setTaskUrgencyFilter] = useState<'all' | 'overdue' | 'today' | 'upcoming'>('all');
  const [taskGroupMode, setTaskGroupMode] = useState<'date' | 'field' | 'crop' | 'type'>('date');
  const [taskFieldFilter, setTaskFieldFilter] = useState<string>('all');
  const [taskCropFilter, setTaskCropFilter] = useState<string>('all');
  const [collapsedTaskGroups, setCollapsedTaskGroups] = useState<Record<string, boolean>>({});

  // 公的肥料マスタ初期60件のオンデマンド高速取得（フルスキャンソート回避）
  const ensureOfficialFertilizersLoaded = async () => {
    if (hasLoadedOfficialFertsRef.current) return;
    hasLoadedOfficialFertsRef.current = true;
    try {
      const { data } = await supabase.from('m_fertilizers').select('*').limit(60);
      if (data) setOfficialFertilizers(data);
    } catch (e) {
      console.warn('Failed to lazy-load official fertilizers:', e);
    }
  };

  // 肥料管理タブを開いた時にオンデマンド取得
  useEffect(() => {
    if (activeMainTab === 'fertilizers') {
      ensureOfficialFertilizersLoaded();
    }
  }, [activeMainTab]);

  // データ2段階爆速取得（Phase 1: ファーストビュー0.2秒即時描画 / Phase 2: バックグラウンド取得）
  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) {
        setIsLoading(false);
        return;
      }
      setCurrentTenantId(tenantId);

      // 🚀 【Phase 1】ファーストビュー（作付け一覧）に必須な超軽量データのみ最優先取得
      const [fRes, cRes, pRes, compRes] = await Promise.all([
        supabase.from('fields').select('*').eq('user_id', tenantId).order('name'),
        supabase.from('crops').select('*').eq('user_id', tenantId).order('name'),
        supabase.from('cultivation_plans_v2').select('*, crops(*)').eq('user_id', tenantId).order('created_at', { ascending: false }),
        supabase.from('company_settings').select('company_name').or(`user_id.eq.${tenantId},id.eq.${tenantId}`).maybeSingle()
      ]);

      const fetchedFields = fRes.data || [];
      const fetchedCrops = cRes.data || [];
      const fetchedPlans = pRes.data || [];
      let name = compRes?.data?.company_name || '';
      if (!name) {
        if (tenantId === '83b1d7ad-6240-4fbf-8174-3dd4e2ff0c04') name = '株式会社KAP';
        else if (tenantId === '62163024-2c8e-4057-a872-2455dbc58d32') name = '佐原農園株式会社';
        else name = '当農園';
      }
      setCompanyName(name);

      setFields(fetchedFields);
      setCrops(fetchedCrops);

      let initialCropId = selectedSprayCropId;
      if (fetchedCrops.length > 0 && !initialCropId) {
        initialCropId = fetchedCrops[0].id;
        setSelectedSprayCropId(initialCropId);
      }
      if (fetchedFields.length > 0 && selectedSprayFieldIds.length === 0) {
        setSelectedSprayFieldIds([fetchedFields[0].id]);
      }

      // 圃場面積（a: アール）の正確な算出ヘルパー
      const calculateFieldAreaAcre = (f: any): number => {
        if (!f) return 10.0;
        if (f.area_size !== undefined && f.area_size !== null && Number(f.area_size) > 0) {
          return Number(f.area_size);
        }
        if (f.area_sqm !== undefined && f.area_sqm !== null && Number(f.area_sqm) > 0) {
          return Math.round((Number(f.area_sqm) / 100) * 10) / 10;
        }
        return 10.0;
      };

      // 1. 作付け一覧の整形
      const cultList: CultivationItem[] = [];
      if (fetchedPlans.length > 0) {
        fetchedPlans.forEach((p: any) => {
          const matchedField = fetchedFields.find(f => f.id === p.field_id);
          const matchedCrop = p.crops || fetchedCrops.find(c => c.id === p.crop_id);
          const areaAcre = calculateFieldAreaAcre(matchedField);
          const startMonth = p.start_month || 8;
          const year = p.year || new Date().getFullYear();

          cultList.push({
            id: p.id,
            fieldId: p.field_id,
            fieldName: matchedField?.name || '圃場',
            cropId: p.crop_id,
            cropName: matchedCrop?.name || p.variety || '作目未設定',
            areaAcre: areaAcre,
            startDate: `${year}年 ${startMonth}月〜`,
            status: 'cultivating'
          });
        });
      }

      fetchedFields.forEach((f: any) => {
        if (!cultList.some(item => item.fieldId === f.id)) {
          const areaAcre = calculateFieldAreaAcre(f);
          const defaultCrop = fetchedCrops[0];

          cultList.push({
            id: `field-${f.id}`,
            fieldId: f.id,
            fieldName: f.name,
            cropId: defaultCrop?.id || '',
            cropName: defaultCrop?.name || '現在作付中',
            areaAcre: areaAcre,
            startDate: `${new Date().getFullYear()}年 8月〜`,
            status: 'active'
          });
        }
      });
      setCultivations(cultList);

      // ⚡ ここで即座にスピナーを解除し、ファーストビューを0.2秒で表示する！
      setIsLoading(false);

      // 🚀 【Phase 2】作業履歴・自社資材マスタをバックグラウンドで非同期取得（画面をブロックしない）
      const [logsRes, matRes, fertMatRes] = await Promise.all([
        supabase.from('work_logs').select('*, crops(name), fields(name), workers(name)').eq('user_id', tenantId).order('work_date', { ascending: false }).limit(500),
        supabase.from('materials').select('*').eq('user_id', tenantId).or('category.eq.農薬費,material_type.eq.pesticide').order('name'),
        supabase.from('materials').select('*').eq('user_id', tenantId).or('category.eq.肥料費,material_type.eq.fertilizer').order('name')
      ]);

      const fetchedLogs = logsRes.data || [];
      const fetchedMaterials = matRes.data || [];
      const fetchedFertMaterials = fertMatRes.data || [];

      setFarmRegisteredPesticides(fetchedMaterials);
      setFarmRegisteredFertilizers(fetchedFertMaterials);

      // 2. 過去の散布ログと作業ログの分類
      const completedLogs = fetchedLogs.filter(l => l.status !== 'planned');
      const plannedLogs = fetchedLogs.filter(l => l.status === 'planned');
      setWorkLogs(completedLogs);
      setPlannedTasks(plannedLogs);

      // 🚀 【Phase 3】選択作物の農薬適用情報＆散布実績を非同期バックグラウンドで準備
      if (initialCropId) {
        loadPesticidesForCrop(initialCropId, fetchedCrops, completedLogs, fetchedMaterials);
      }

    } catch (err) {
      console.error('Error fetching data in cultivations hub:', err);
      setIsLoading(false);
    }
  };

  // 自農園登録農薬（materials）に限定し、作物ごとのFAMIC適用情報と散布実績を結合（メモリキャッシュ対応）
  const [isLoadingPesticides, setIsLoadingPesticides] = useState(false);

  const loadPesticidesForCrop = async (
    cropId: string, 
    cropList: any[], 
    logsList: any[], 
    farmPesticidesList?: any[]
  ) => {
    const targetCrop = cropList.find(c => c.id === cropId);
    if (!targetCrop || !targetCrop.name) return;

    const materialsToUse = farmPesticidesList || farmRegisteredPesticides;

    setIsLoadingPesticides(true);
    try {
      // 1. FAMIC公的農薬APIから作物に適用のある農薬一覧を取得（メモリキャッシュがあれば0msで即利用）
      let famicItems: any[] = [];
      if (famicCacheRef.current.has(targetCrop.name)) {
        famicItems = famicCacheRef.current.get(targetCrop.name) || [];
      } else {
        const res = await fetch('/api/pesticide-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cropName: targetCrop.name })
        });

        if (res.ok) {
          const json = await res.json();
          famicItems = json.pesticides || [];
          famicCacheRef.current.set(targetCrop.name, famicItems);
        }
      }

      // 2. 「自社登録農薬マスタ（materials）」を主軸として、FAMIC情報と散布回数を結合
      const normalizeText = (str: string) => {
        if (!str) return '';
        return str
          .normalize('NFKC')
          .toLowerCase()
          .replace(/[\u3041-\u3096]/g, m => String.fromCharCode(m.charCodeAt(0) + 0x60))
          .replace(/[\s　・･()（）\[\]【】]/g, '');
      };

      const formattedPesticides: PesticideDisplayItem[] = materialsToUse.map((mat: any) => {
        const matName = mat.name;
        const normMatName = normalizeText(matName);

        // FAMIC公的データから該当農薬の適用情報を探す
        const famicMatch = famicItems.find((f: any) => {
          const normFamic = normalizeText(f.name);
          return normFamic.includes(normMatName) || normMatName.includes(normFamic);
        });

        // 過去の散布実績回数を集計
        const usedCount = logsList.filter(l => {
          const isTargetCrop = l.crop_id === cropId;
          const isSpray = l.work_type?.includes('農薬') || l.memo?.includes('[散布管理]');
          const isSamePesticide = l.memo?.includes(matName) || l.materials?.name === matName;
          return isTargetCrop && isSpray && isSamePesticide;
        }).length;

        // 最大使用可能回数
        const maxCount = famicMatch?.max_count ? parseInt(famicMatch.max_count, 10) : (mat.max_uses_per_crop || 5);

        // カテゴリ（殺虫剤、殺菌剤、除草剤、その他）
        const rawType = famicMatch?.type || mat.material_type || mat.category || 'その他';
        let category: '殺虫剤' | '殺菌剤' | '除草剤' | 'その他' = 'その他';
        if (rawType.includes('殺虫') || rawType.includes('殺ダニ')) {
          if (rawType.includes('殺菌')) {
            category = '殺虫剤';
          } else {
            category = '殺虫剤';
          }
        } else if (rawType.includes('殺菌')) {
          category = '殺菌剤';
        } else if (rawType.includes('除草')) {
          category = '除草剤';
        }

        // RACコード
        const rac = famicMatch?.rac_code || famicMatch?.racCode || (category === '殺虫剤' ? 'IR' : category === '殺菌剤' ? 'FR' : 'HR');

        return {
          id: mat.id || `mat-${matName}`,
          name: matName,
          type: category,
          racCode: rac,
          targetPests: famicMatch?.target_pests_array || (famicMatch?.target_pest ? famicMatch.target_pest.split(',').map((s: string) => s.trim()) : ['自社登録農薬']),
          maxCount: maxCount,
          usedCount: usedCount,
          dilution: famicMatch?.usage_amount || '規定倍率',
          usageTime: famicMatch?.usage_time || '収穫前日まで',
          method: famicMatch?.usage_method || '散布'
        };
      });

      setPesticides(formattedPesticides);
    } catch (err) {
      console.error('Error loading crop pesticides:', err);
    } finally {
      setIsLoadingPesticides(false);
    }
  };

  // 作物プルダウン変更時の連動
  const handleCropChange = async (newCropId: string) => {
    setSelectedSprayCropId(newCropId);
    setSelectedPesticideIds([]);
    await loadPesticidesForCrop(newCropId, crops, workLogs, farmRegisteredPesticides);
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // トースト制御
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // --- 作付け一覧フィルタリング ---
  const filteredCultivations = useMemo(() => {
    if (!searchCultivationQuery.trim()) return cultivations;
    const q = searchCultivationQuery.toLowerCase();
    return cultivations.filter(
      c => c.cropName.toLowerCase().includes(q) || c.fieldName.toLowerCase().includes(q)
    );
  }, [cultivations, searchCultivationQuery]);

  const selectedCultivationTargets: CultivationTarget[] = useMemo(() => {
    return cultivations
      .filter(c => selectedIds.includes(c.id))
      .map(c => ({
        id: c.id,
        fieldId: c.fieldId,
        fieldName: c.fieldName,
        cropId: c.cropId,
        cropName: c.cropName,
        areaAcre: c.areaAcre,
        startDate: c.startDate
      }));
  }, [cultivations, selectedIds]);

  // --- 散布管理フィルタリング ---
  const filteredPesticides = useMemo(() => {
    return pesticides.filter(p => {
      if (p.type !== sprayCategoryTab) return false;
      if (searchSprayQuery.trim()) {
        const q = searchSprayQuery.toLowerCase();
        const mName = p.name.toLowerCase().includes(q);
        const mPest = p.targetPests.some(pest => pest.toLowerCase().includes(q));
        const mRac = p.racCode.toLowerCase().includes(q);
        if (!mName && !mPest && !mRac) return false;
      }
      return true;
    });
  }, [pesticides, sprayCategoryTab, searchSprayQuery]);

  // --- 履歴カテゴリ判定ヘルパー ---
  const getLogCategory = (log: any): 'spray' | 'fert' | 'work' => {
    const wt = log.work_type || '';
    const memo = log.memo || '';
    if (wt.includes('施肥') || wt.includes('肥料') || wt.includes('元肥') || wt.includes('追肥') || memo.includes('[施肥') || memo.includes('合計N:')) {
      return 'fert';
    }
    if (wt.includes('農薬') || wt.includes('防除') || wt.includes('散布') || memo.includes('[散布管理]') || memo.includes('品名:')) {
      return 'spray';
    }
    return 'work';
  };

  // --- メモの構造化パーサー（システム暗号を見やすいバッジとテキストへ分解） ---
  const parseStructuredMemo = (memoStr?: string) => {
    if (!memoStr || !memoStr.trim()) return { badges: [] as { text: string; tone: 'rose' | 'teal' | 'blue' | 'amber' | 'slate' }[], cleanNote: '' };
    let working = memoStr.trim();
    const badges: { text: string; tone: 'rose' | 'teal' | 'blue' | 'amber' | 'slate' }[] = [];

    // 先頭のシステムタグ除去・バッジ化
    working = working
      .replace(/^\[一括記録\]\s*/g, '')
      .replace(/^\[直接登録\]\s*/g, '')
      .replace(/^\[散布管理\]\s*/g, '');

    const fertTagMatch = working.match(/^\[施肥:([^\]]+)\]\s*/);
    if (fertTagMatch) {
      badges.push({ text: `区分: ${fertTagMatch[1]}`, tone: 'teal' });
      working = working.replace(fertTagMatch[0], '');
    }

    // パイプ「|」で区切られている構造化データの分解
    const segments = working.split(/\s*\|\s*/).map(s => s.trim()).filter(Boolean);
    const noteParts: string[] = [];

    segments.forEach(seg => {
      if (seg.startsWith('使用農薬:')) {
        badges.push({ text: `🧪 ${seg.replace('使用農薬:', '').trim()}`, tone: 'rose' });
      } else if (seg.startsWith('品名:')) {
        // 例: 品名:「日農」ﾀﾞｺﾆｰﾙ1000 [成分:TPN] 数量:20本
        const compMatch = seg.match(/\[成分:([^\]]+)\]/);
        const qtyMatch = seg.match(/数量:([^\s]+)/);
        const namePart = seg.replace('品名:', '').replace(/\[成分:[^\]]+\]/, '').replace(/数量:[^\s]+/, '').trim();
        if (namePart) badges.push({ text: `🧪 ${namePart}${qtyMatch ? ` (${qtyMatch[1]})` : ''}`, tone: 'rose' });
        if (compMatch && compMatch[1]) badges.push({ text: `成分: ${compMatch[1]}`, tone: 'slate' });
      } else if (seg.startsWith('RAC:')) {
        badges.push({ text: `🛡️ RAC: ${seg.replace('RAC:', '').trim()}`, tone: 'amber' });
      } else if (seg.startsWith('散布水量:')) {
        badges.push({ text: `💧 水量: ${seg.replace('散布水量:', '').trim()}`, tone: 'blue' });
      } else if (/^(合計)?N:[\d.]+kg/i.test(seg)) {
        badges.push({ text: `📊 ${seg.replace(/^合計/, '')}`, tone: 'blue' });
      } else if (/^(総)?費用:¥[\d,]+/i.test(seg)) {
        const costText = seg.replace(/^(総)?費用:/, '').trim();
        if (costText !== '¥0') {
          badges.push({ text: `💰 費用: ${costText}`, tone: 'amber' });
        }
      } else if (/(\d+kg|\(\d+袋\))/i.test(seg) && badges.length <= 2) {
        badges.push({ text: `🔬 ${seg}`, tone: 'teal' });
      } else {
        noteParts.push(seg);
      }
    });

    return {
      badges,
      cleanNote: noteParts.join(' / ')
    };
  };

  // --- 分数を見やすい「〇時間〇分」に変換 ---
  const formatMinutesReadable = (mins: number) => {
    const m = Math.max(0, Math.round(mins || 0));
    if (m === 0) return '0分';
    const h = Math.floor(m / 60);
    const rem = m % 60;
    if (h === 0) return `${rem}分`;
    if (rem === 0) return `${h}時間 (${m}分)`;
    return `${h}時間${rem}分 (${m}分)`;
  };

  // --- 日付に曜日を付与するヘルパー ---
  const formatDateWithDay = (dateStr?: string) => {
    if (!dateStr) return '日付未設定';
    const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return dateStr;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const dayName = days[d.getDay()] || '';
    return `${m[1]}年${Number(m[2])}月${Number(m[3])}日 (${dayName})`;
  };

  // --- 履歴フィルタリング ---
  const filteredWorkLogs = useMemo(() => {
    return workLogs.filter(log => {
      const cat = getLogCategory(log);
      if (historyTypeFilter === 'sprayOnly' && cat !== 'spray') return false;
      if (historyTypeFilter === 'fertOnly' && cat !== 'fert') return false;
      if (historyTypeFilter === 'workOnly' && cat !== 'work') return false;

      if (historyFieldFilter !== 'all' && log.field_id !== historyFieldFilter && (log.fields?.name || '圃場未指定') !== historyFieldFilter) {
        return false;
      }
      if (historyCropFilter !== 'all' && log.crop_id !== historyCropFilter && (log.crops?.name || '作目未指定') !== historyCropFilter) {
        return false;
      }

      if (historySearchQuery.trim()) {
        const q = historySearchQuery.toLowerCase();
        const mType = log.work_type?.toLowerCase().includes(q);
        const mField = log.fields?.name?.toLowerCase().includes(q);
        const mCrop = log.crops?.name?.toLowerCase().includes(q);
        const mWorker = log.workers?.name?.toLowerCase().includes(q);
        const mMemo = log.memo?.toLowerCase().includes(q);
        const mDate = log.work_date?.toLowerCase().includes(q);
        if (!mType && !mField && !mCrop && !mWorker && !mMemo && !mDate) return false;
      }
      return true;
    });
  }, [workLogs, historyTypeFilter, historyFieldFilter, historyCropFilter, historySearchQuery]);

  // --- 履歴集計サマリー ---
  const historySummary = useMemo(() => {
    let totalMinutes = 0;
    let sprayCount = 0;
    let fertCount = 0;
    let workCount = 0;
    filteredWorkLogs.forEach(log => {
      totalMinutes += Number(log.duration_minutes) || 0;
      const cat = getLogCategory(log);
      if (cat === 'spray') sprayCount++;
      else if (cat === 'fert') fertCount++;
      else workCount++;
    });
    return {
      totalCount: filteredWorkLogs.length,
      totalMinutes,
      sprayCount,
      fertCount,
      workCount
    };
  }, [filteredWorkLogs]);

  // --- 4大まとめ表示（グルーピング）データ ---
  const groupedWorkLogs = useMemo(() => {
    const groupsMap = new Map<string, {
      key: string;
      title: string;
      subtitle: string;
      badgeTone: 'emerald' | 'blue' | 'teal' | 'rose' | 'slate';
      logs: any[];
      totalMinutes: number;
      sprayCount: number;
      fertCount: number;
      workCount: number;
      subItemsSet: Set<string>;
    }>();

    filteredWorkLogs.forEach(log => {
      let key = '';
      let title = '';
      let badgeTone: 'emerald' | 'blue' | 'teal' | 'rose' | 'slate' = 'slate';
      let subItem = '';

      const fieldName = log.fields?.name || '圃場未指定';
      const cropName = log.crops?.name || '作目未設定';
      const workType = log.work_type || '一般作業';
      const workDate = log.work_date || '日付未設定';
      const cat = getLogCategory(log);

      if (historyGroupMode === 'date') {
        key = workDate;
        title = formatDateWithDay(workDate);
        badgeTone = 'blue';
        subItem = `${fieldName} (${cropName})`;
      } else if (historyGroupMode === 'field') {
        key = fieldName;
        title = fieldName;
        badgeTone = 'emerald';
        subItem = cropName;
      } else if (historyGroupMode === 'crop') {
        key = cropName;
        title = cropName;
        badgeTone = 'teal';
        subItem = fieldName;
      } else {
        key = workType;
        title = workType;
        badgeTone = cat === 'spray' ? 'rose' : cat === 'fert' ? 'teal' : 'emerald';
        subItem = `${fieldName} (${cropName})`;
      }

      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          key,
          title,
          subtitle: '',
          badgeTone,
          logs: [],
          totalMinutes: 0,
          sprayCount: 0,
          fertCount: 0,
          workCount: 0,
          subItemsSet: new Set<string>()
        });
      }

      const grp = groupsMap.get(key)!;
      grp.logs.push(log);
      grp.totalMinutes += Number(log.duration_minutes) || 0;
      if (cat === 'spray') grp.sprayCount++;
      else if (cat === 'fert') grp.fertCount++;
      else grp.workCount++;
      if (subItem && subItem !== '作目未設定' && subItem !== '圃場未指定') {
        grp.subItemsSet.add(subItem);
      }
    });

    const result = Array.from(groupsMap.values()).map(g => ({
      ...g,
      subtitle: Array.from(g.subItemsSet).slice(0, 5).join('・') + (g.subItemsSet.size > 5 ? ` 他${g.subItemsSet.size - 5}件` : '')
    }));

    // 圃場別・作目別・作業別の場合は件数が多い順、日付別の場合は新しい順
    if (historyGroupMode !== 'date') {
      result.sort((a, b) => b.logs.length - a.logs.length);
    }
    return result;
  }, [filteredWorkLogs, historyGroupMode]);

  // --- 作業予定（タスク）の期限・緊急度判定ヘルパー ---
  const todayJstStr = useMemo(() => getJSTDate(), []);
  const getTaskUrgency = (dateStr?: string): 'overdue' | 'today' | 'upcoming' => {
    if (!dateStr) return 'upcoming';
    if (dateStr < todayJstStr) return 'overdue';
    if (dateStr === todayJstStr) return 'today';
    return 'upcoming';
  };

  // --- 作業予定（タスク）フィルタリング ---
  const filteredPlannedTasks = useMemo(() => {
    return plannedTasks.filter(task => {
      const urgency = getTaskUrgency(task.work_date);
      if (taskUrgencyFilter !== 'all' && urgency !== taskUrgencyFilter) return false;

      if (taskFieldFilter !== 'all' && task.field_id !== taskFieldFilter && (task.fields?.name || '圃場未指定') !== taskFieldFilter) {
        return false;
      }
      if (taskCropFilter !== 'all' && task.crop_id !== taskCropFilter && (task.crops?.name || '作目未指定') !== taskCropFilter) {
        return false;
      }

      if (taskSearchQuery.trim()) {
        const q = taskSearchQuery.toLowerCase();
        const mType = task.work_type?.toLowerCase().includes(q);
        const mField = task.fields?.name?.toLowerCase().includes(q);
        const mCrop = task.crops?.name?.toLowerCase().includes(q);
        const mWorker = task.workers?.name?.toLowerCase().includes(q);
        const mMemo = task.memo?.toLowerCase().includes(q);
        const mDate = task.work_date?.toLowerCase().includes(q);
        if (!mType && !mField && !mCrop && !mWorker && !mMemo && !mDate) return false;
      }
      return true;
    });
  }, [plannedTasks, taskUrgencyFilter, taskFieldFilter, taskCropFilter, taskSearchQuery, todayJstStr]);

  // --- 作業予定（タスク）集計サマリー ---
  const taskSummary = useMemo(() => {
    let totalMinutes = 0;
    let overdueCount = 0;
    let todayCount = 0;
    let upcomingCount = 0;

    filteredPlannedTasks.forEach(task => {
      totalMinutes += Number(task.duration_minutes) || 0;
      const u = getTaskUrgency(task.work_date);
      if (u === 'overdue') overdueCount++;
      else if (u === 'today') todayCount++;
      else upcomingCount++;
    });

    return {
      totalCount: filteredPlannedTasks.length,
      totalMinutes,
      overdueCount,
      todayCount,
      upcomingCount
    };
  }, [filteredPlannedTasks, todayJstStr]);

  // --- 作業予定（タスク）4大まとめ表示（グルーピング）データ ---
  const groupedPlannedTasks = useMemo(() => {
    const groupsMap = new Map<string, {
      key: string;
      title: string;
      subtitle: string;
      urgency: 'overdue' | 'today' | 'upcoming' | 'mixed';
      tasks: any[];
      totalMinutes: number;
      overdueCount: number;
      todayCount: number;
      upcomingCount: number;
      subItemsSet: Set<string>;
    }>();

    filteredPlannedTasks.forEach(task => {
      let key = '';
      let title = '';
      let subItem = '';

      const fieldName = task.fields?.name || '圃場未指定';
      const cropName = task.crops?.name || '作目未設定';
      const workType = task.work_type || '予定作業';
      const workDate = task.work_date || '日付未設定';
      const u = getTaskUrgency(task.work_date);

      if (taskGroupMode === 'date') {
        key = workDate;
        title = formatDateWithDay(workDate);
        subItem = `${fieldName} (${cropName})`;
      } else if (taskGroupMode === 'field') {
        key = fieldName;
        title = fieldName;
        subItem = `${cropName}・${workType}`;
      } else if (taskGroupMode === 'crop') {
        key = cropName;
        title = cropName;
        subItem = `${fieldName}・${workType}`;
      } else {
        key = workType;
        title = workType;
        subItem = `${fieldName} (${cropName})`;
      }

      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          key,
          title,
          subtitle: '',
          urgency: u,
          tasks: [],
          totalMinutes: 0,
          overdueCount: 0,
          todayCount: 0,
          upcomingCount: 0,
          subItemsSet: new Set<string>()
        });
      }

      const grp = groupsMap.get(key)!;
      grp.tasks.push(task);
      grp.totalMinutes += Number(task.duration_minutes) || 0;
      if (u === 'overdue') grp.overdueCount++;
      else if (u === 'today') grp.todayCount++;
      else grp.upcomingCount++;
      if (subItem && subItem !== '作目未設定' && subItem !== '圃場未指定') {
        grp.subItemsSet.add(subItem);
      }
    });

    const result = Array.from(groupsMap.values()).map(g => {
      let urgency: 'overdue' | 'today' | 'upcoming' = 'upcoming';
      if (g.overdueCount > 0) urgency = 'overdue';
      else if (g.todayCount > 0) urgency = 'today';

      return {
        ...g,
        urgency,
        subtitle: Array.from(g.subItemsSet).slice(0, 5).join('・') + (g.subItemsSet.size > 5 ? ` 他${g.subItemsSet.size - 5}件` : '')
      };
    });

    if (taskGroupMode === 'date') {
      // 日付順（古い未完了＝期限切れや今日の予定が上、または日付の昇順・降順で見やすく整理）
      result.sort((a, b) => a.key.localeCompare(b.key));
    } else {
      // 圃場・作目・作業別の場合は、期限切れを含むグループを優先しつつ件数順
      result.sort((a, b) => {
        if (b.overdueCount !== a.overdueCount) return b.overdueCount - a.overdueCount;
        return b.tasks.length - a.tasks.length;
      });
    }
    return result;
  }, [filteredPlannedTasks, taskGroupMode, todayJstStr]);

  // --- 肥料管理フィルタリング ---
  const filteredFertilizers = useMemo(() => {
    // 1. 「自社マスタ登録済のみ」タブの場合: 自農園マスタ（materials）から直接生成
    if (fertCategoryTab === 'registered') {
      return farmRegisteredFertilizers.map(rf => {
        const matchedOfficial = officialFertilizers.find(f => f.fertilizer_name === rf.name);
        return {
          id: rf.id,
          fertilizer_name: rf.name,
          applicant_name: matchedOfficial?.applicant_name || '自農園マスタ登録品',
          fertilizer_type: rf.fertilizer_type || matchedOfficial?.fertilizer_type || '自社登録肥料',
          registration_no: rf.specification || matchedOfficial?.registration_no || '',
          registration_date: matchedOfficial?.registration_date || '',
          n_percent: rf.n_percent ?? rf.n_ratio ?? matchedOfficial?.n_percent ?? 0,
          p_percent: rf.p_percent ?? rf.p_ratio ?? matchedOfficial?.p_percent ?? 0,
          k_percent: rf.k_percent ?? rf.k_ratio ?? matchedOfficial?.k_percent ?? 0,
          ca_percent: rf.ca_percent ?? matchedOfficial?.ca_percent ?? 0,
          mg_percent: rf.mg_percent ?? matchedOfficial?.mg_percent ?? 0,
          other_ingredients: matchedOfficial?.other_ingredients || '',
          default_price: rf.default_price || rf.unit_price,
          bag_weight: rf.bag_weight || rf.capacity || 20,
          isFarmRegistered: true
        };
      });
    }

    // 2. その他のカテゴリまたは検索時の場合
    return officialFertilizers.filter(f => {
      if (fertCategoryTab !== 'all') {
        if (!f.fertilizer_type?.includes(fertCategoryTab)) return false;
      }
      return true;
    });
  }, [officialFertilizers, farmRegisteredFertilizers, fertCategoryTab]);

  // 施肥ログのパースとN-P-K累計集計 (作目・圃場別)
  const fertilizerAnalytics = useMemo(() => {
    const fertLogs = workLogs.filter(log => {
      const isFert = log.work_type?.includes('施肥') || log.work_type?.includes('肥料') || log.memo?.includes('[施肥') || log.memo?.includes('合計N:');
      const isCompleted = log.status !== 'planned';
      const matchCrop = fertAnalysisCropId === 'all' || log.crop_id === fertAnalysisCropId;
      const matchField = fertAnalysisFieldId === 'all' || log.field_id === fertAnalysisFieldId;
      return isFert && isCompleted && matchCrop && matchField;
    });

    let totalN = 0;
    let totalP = 0;
    let totalK = 0;
    let totalCa = 0;
    let totalMg = 0;
    let totalCost = 0;
    let totalKg = 0;

    let basalN = 0;
    let basalP = 0;
    let basalK = 0;
    let basalCa = 0;
    let basalMg = 0;

    let topdressN = 0;
    let topdressP = 0;
    let topdressK = 0;
    let topdressCa = 0;
    let topdressMg = 0;

    const parsedLogs = fertLogs.map(log => {
      const memo = log.memo || '';
      
      // 合計N:3.1kg P:2.2kg K:0.5kg Ca:1.0kg Mg:0.5kg/10a のパース
      const nMatch = memo.match(/合計N:([\d.]+)kg/i) || memo.match(/N:([\d.]+)kg/i);
      const pMatch = memo.match(/P:([\d.]+)kg/i);
      const kMatch = memo.match(/K:([\d.]+)kg/i);
      const caMatch = memo.match(/Ca:([\d.]+)kg/i);
      const mgMatch = memo.match(/Mg:([\d.]+)kg/i);
      const costMatch = memo.match(/総費用:¥([\d,]+)/i) || memo.match(/¥([\d,]+)/i);
      const kgMatch = memo.match(/(\d+(\.\d+)?)\s*kg/i);

      const nVal = nMatch ? parseFloat(nMatch[1]) : 0;
      const pVal = pMatch ? parseFloat(pMatch[1]) : 0;
      const kVal = kMatch ? parseFloat(kMatch[1]) : 0;
      const caVal = caMatch ? parseFloat(caMatch[1]) : 0;
      const mgVal = mgMatch ? parseFloat(mgMatch[1]) : 0;
      const costVal = costMatch ? parseInt(costMatch[1].replace(/,/g, ''), 10) : 0;
      const kgVal = kgMatch ? parseFloat(kgMatch[1]) : 0;

      const isBasal = log.work_type?.includes('元肥') || memo.includes('元肥');
      const isTopdress = log.work_type?.includes('追肥') || memo.includes('追肥') || log.work_type?.includes('葉面');

      totalN += nVal;
      totalP += pVal;
      totalK += kVal;
      totalCa += caVal;
      totalMg += mgVal;
      totalCost += costVal;
      totalKg += kgVal;

      if (isBasal) {
        basalN += nVal;
        basalP += pVal;
        basalK += kVal;
        basalCa += caVal;
        basalMg += mgVal;
      }
      if (isTopdress) {
        topdressN += nVal;
        topdressP += pVal;
        topdressK += kVal;
        topdressCa += caVal;
        topdressMg += mgVal;
      }

      // 微量要素・土壌改良成分の検出（ホウ素、マンガン、ケイ酸、鉄、腐植酸等）
      const microNutrients: string[] = [];
      if (/ホウ素|ほう素|\bB\b/i.test(memo)) microNutrients.push('ホウ素 (B)');
      if (/マンガン|\bMn\b/i.test(memo)) microNutrients.push('マンガン (Mn)');
      if (/ケイ酸|珪酸|\bSiO2\b/i.test(memo)) microNutrients.push('ケイ酸 (SiO2)');
      if (/鉄|\bFe\b/i.test(memo)) microNutrients.push('鉄 (Fe)');
      if (/亜鉛|\bZn\b/i.test(memo)) microNutrients.push('亜鉛 (Zn)');
      if (/有機|堆肥|牛糞|豚糞|鶏糞|ボカシ|アミノ酸/i.test(memo)) microNutrients.push('有機質・アミノ酸');
      if (/石灰|カルシウム/i.test(memo) && caVal === 0) microNutrients.push('石灰質');
      if (/苦土|マグネシウム/i.test(memo) && mgVal === 0) microNutrients.push('苦土質');

      return {
        ...log,
        nVal,
        pVal,
        kVal,
        caVal,
        mgVal,
        costVal,
        kgVal,
        microNutrients,
        isBasal,
        isTopdress
      };
    });

    // 全ログから微量要素のユニークリストを集計
    const allMicroNutrients = Array.from(new Set(parsedLogs.flatMap(l => l.microNutrients)));

    return {
      totalN: Math.round(totalN * 10) / 10,
      totalP: Math.round(totalP * 10) / 10,
      totalK: Math.round(totalK * 10) / 10,
      totalCa: Math.round(totalCa * 10) / 10,
      totalMg: Math.round(totalMg * 10) / 10,
      totalCost,
      totalKg: Math.round(totalKg * 10) / 10,
      basalN: Math.round(basalN * 10) / 10,
      basalP: Math.round(basalP * 10) / 10,
      basalK: Math.round(basalK * 10) / 10,
      basalCa: Math.round(basalCa * 10) / 10,
      basalMg: Math.round(basalMg * 10) / 10,
      topdressN: Math.round(topdressN * 10) / 10,
      topdressP: Math.round(topdressP * 10) / 10,
      topdressK: Math.round(topdressK * 10) / 10,
      topdressCa: Math.round(topdressCa * 10) / 10,
      topdressMg: Math.round(topdressMg * 10) / 10,
      allMicroNutrients,
      parsedLogs
    };
  }, [workLogs, fertAnalysisCropId, fertAnalysisFieldId]);

  // 公的肥料マスター ＆ 自社マスタ統合検索（全方位あいまい検索・デバウンス対応・最大200件）
  const handleSearchFertilizers = (q: string) => {
    setSearchFertQuery(q);

    if (searchFertilizerTimerRef.current) {
      clearTimeout(searchFertilizerTimerRef.current);
    }

    if (!q.trim()) {
      setIsLoadingFertilizers(true);
      searchFertilizerTimerRef.current = setTimeout(async () => {
        const { data } = await supabase.from('m_fertilizers').select('*').limit(60);
        setOfficialFertilizers(data || []);
        setIsLoadingFertilizers(false);
      }, 150);
      return;
    }

    setIsLoadingFertilizers(true);
    const thisRequestId = ++searchFertilizerReqIdRef.current;

    searchFertilizerTimerRef.current = setTimeout(async () => {
      try {
        const keywords = generateComprehensiveSearchKeywords(q);
        const orConditions = keywords.flatMap(k => [
          `fertilizer_name.ilike.%${k}%`,
          `applicant_name.ilike.%${k}%`,
          `fertilizer_type.ilike.%${k}%`,
          `registration_no.ilike.%${k}%`,
          `other_ingredients.ilike.%${k}%`
        ]).join(',');

        // 1. 公的マスター検索（全4.5万件から最大200件ヒット）
        const { data: publicData, error } = await supabase
          .from('m_fertilizers')
          .select('*')
          .or(orConditions)
          .limit(200);

        if (thisRequestId !== searchFertilizerReqIdRef.current) return;

        // 2. 自農園マスタ（materials）からも全方位あいまい一致するものを抽出
        const matchedFarmItems = farmRegisteredFertilizers.filter(rf => {
          const targetStr = `${rf.name} ${rf.specification || ''} ${rf.fertilizer_type || ''}`;
          return isFuzzyMatch(targetStr, q) || keywords.some(k => targetStr.toLowerCase().includes(k.toLowerCase()));
        }).map(rf => ({
          id: rf.id,
          fertilizer_name: rf.name,
          applicant_name: '自農園マスタ登録品',
          fertilizer_type: rf.fertilizer_type || '自社登録肥料',
          registration_no: rf.specification || '',
          n_percent: rf.n_percent ?? rf.n_ratio ?? 0,
          p_percent: rf.p_percent ?? rf.p_ratio ?? 0,
          k_percent: rf.k_percent ?? rf.k_ratio ?? 0,
          ca_percent: rf.ca_percent ?? 0,
          mg_percent: rf.mg_percent ?? 0,
          default_price: rf.default_price || rf.unit_price,
          bag_weight: rf.bag_weight || rf.capacity || 20,
          isFarmRegistered: true
        }));

        // 公的マスターデータと自社マスタデータをマージ（自社品を先頭に）
        const publicItems = (!error && publicData) ? publicData : [];
        const combined = [
          ...matchedFarmItems,
          ...publicItems.filter(p => !matchedFarmItems.some(f => f.fertilizer_name === p.fertilizer_name))
        ];

        setOfficialFertilizers(combined);
      } catch (e) {
        console.error('Fertilizer search error:', e);
      } finally {
        if (thisRequestId === searchFertilizerReqIdRef.current) {
          setIsLoadingFertilizers(false);
        }
      }
    }, 200);
  };

  // 公的肥料を自社マスタ（materials）へ即座にワンクリック登録
  const handleRegisterFertToFarmMaster = async (item: any) => {
    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) return;

      const payload = {
        user_id: tenantId,
        name: item.fertilizer_name,
        category: '肥料費',
        material_type: 'fertilizer',
        unit: '袋',
        default_price: 0,
        n_percent: parseFloat(item.n_percent) || 0,
        p_percent: parseFloat(item.p_percent) || 0,
        k_percent: parseFloat(item.k_percent) || 0,
        bag_weight_kg: 20,
        fertilizer_type: item.fertilizer_type || '化成肥料',
        fertilizer_usage: '共通',
        specification: `FAMIC公的登録: ${item.registration_no || ''}`
      };

      const { data, error } = await supabase.from('materials').insert([payload]).select();
      if (error) throw error;

      if (data && data[0]) {
        setFarmRegisteredFertilizers(prev => [data[0], ...prev]);
        setToastMessage(`「${item.fertilizer_name}」を自社肥料マスタに登録しました！`);
      }
    } catch (e: any) {
      alert(`登録に失敗しました: ${e.message}`);
    }
  };

  // 散布記録の確定保存
  const handleSaveSprayLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPesticideIds.length === 0 || selectedSprayFieldIds.length === 0) {
      alert('圃場と農薬を選択してください');
      return;
    }

    setIsSavingSpray(true);
    try {
      const selectedPesticides = pesticides.filter(p => selectedPesticideIds.includes(p.id));
      const pesticideNames = selectedPesticides.map(p => `${p.name}(${p.dilution})`).join(' ＋ ');
      const racCodes = selectedPesticides.map(p => p.racCode).join(', ');
      const timestamp = new Date().toISOString();

      const tenantId = await getCurrentTenantId();

      const recordsToInsert = selectedSprayFieldIds.map(fId => ({
        user_id: tenantId,
        field_id: fId,
        crop_id: selectedSprayCropId || null,
        work_date: sprayDate,
        work_type: '農薬散布',
        duration_minutes: 60,
        status: 'completed',
        memo: `[散布管理] 使用農薬: ${pesticideNames} | RAC: ${racCodes} | 散布水量: ${sprayWaterVolume}L/10a | ${sprayMemo}`.trim(),
        created_at: timestamp
      }));

      const { error } = await supabase.from('work_logs').insert(recordsToInsert);
      if (error) throw error;

      setToastMessage(`${selectedSprayFieldIds.length}箇所の圃場に ${selectedPesticides.length}種の農薬散布を記録しました！`);
      setIsSprayModalOpen(false);
      setSelectedPesticideIds([]);
      fetchAllData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || '散布登録に失敗しました');
    } finally {
      setIsSavingSpray(false);
    }
  };

  // 作業記録の編集モーダルを開く
  const handleOpenEditModal = (log: any) => {
    setEditingLog(log);
    setEditWorkDate(log.work_date || getJSTDate());
    setEditFieldId(log.field_id || '');
    setEditCropId(log.crop_id || '');
    setEditWorkType(log.work_type || '農作業');
    setEditDuration(String(log.duration_minutes || 60));
    setEditMemo(log.memo || '');
  };

  // 作業記録の訂正・保存処理
  const handleUpdateWorkLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog) return;
    setIsUpdatingLog(true);
    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('テナントIDが特定できません');
      const { error } = await supabase
        .from('work_logs')
        .update({
          work_date: editWorkDate,
          field_id: editFieldId || null,
          crop_id: editCropId || null,
          work_type: editWorkType,
          duration_minutes: parseInt(editDuration, 10) || 60,
          memo: editMemo
        })
        .eq('id', editingLog.id)
        .eq('user_id', tenantId);

      if (error) throw error;
      setEditingLog(null);
      setToastMessage('作業記録を訂正・更新しました！');
      fetchAllData();
    } catch (err: any) {
      console.error(err);
      alert('更新に失敗しました: ' + err.message);
    } finally {
      setIsUpdatingLog(false);
    }
  };

  // 作業記録の削除処理
  const handleDeleteWorkLog = async (logId: string) => {
    if (!window.confirm('この作業記録を削除してもよろしいですか？\n※削除した記録は元に戻せません。')) return;
    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('テナントIDが特定できません');
      const { error } = await supabase
        .from('work_logs')
        .delete()
        .eq('id', logId)
        .eq('user_id', tenantId);

      if (error) throw error;
      setToastMessage('作業記録を削除しました');
      fetchAllData();
    } catch (err: any) {
      console.error(err);
      alert('削除に失敗しました: ' + err.message);
    }
  };

  // 作業記録・予定の直接新規登録処理
  const [directAddStatusMode, setDirectAddStatusMode] = useState<'completed' | 'planned'>('completed');
  const handleDirectAddWorkLog = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDirectAdding(true);
    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('テナント情報の取得に失敗しました');

      const { error } = await supabase
        .from('work_logs')
        .insert([{
          user_id: tenantId,
          work_date: directAddDate,
          field_id: directAddFieldId || null,
          crop_id: directAddCropId || null,
          work_type: directAddWorkType,
          duration_minutes: parseInt(directAddDuration, 10) || 60,
          memo: directAddMemo ? directAddMemo.trim() : `[直接登録] ${directAddWorkType}`,
          status: directAddStatusMode,
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;
      setIsDirectAddModalOpen(false);
      setDirectAddMemo('');
      setToastMessage(directAddStatusMode === 'planned' ? '新規の作業予定（タスク）を登録しました！' : '新規作業記録を登録しました！');
      fetchAllData();
    } catch (err: any) {
      console.error(err);
      alert('登録に失敗しました: ' + err.message);
    } finally {
      setIsDirectAdding(false);
    }
  };

  // タスク完了処理（単一・即時UI反映）
  const handleCompleteTask = async (taskId: string) => {
    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('テナントIDが特定できません');

      // 即時ローカルステート反映（0秒レスポンス）
      const targetTask = plannedTasks.find(t => t.id === taskId);
      setPlannedTasks(prev => prev.filter(t => t.id !== taskId));
      if (targetTask) {
        setWorkLogs(prev => [{ ...targetTask, status: 'completed' }, ...prev]);
      }

      const { error } = await supabase
        .from('work_logs')
        .update({ status: 'completed' })
        .eq('id', taskId)
        .eq('user_id', tenantId);

      if (error) throw error;
      setToastMessage('予定作業を完了（実績化）しました！');
    } catch (err: any) {
      console.error(err);
      alert('タスク完了の更新に失敗しました');
      fetchAllData();
    }
  };

  // グループ内タスクの一括完了処理
  const handleBatchCompleteTasks = async (taskIds: string[], groupLabel: string) => {
    if (taskIds.length === 0) return;
    if (!window.confirm(`「${groupLabel}」の予定タスク（全 ${taskIds.length} 件）をまとめて完了（実績化）しますか？`)) return;
    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('テナントIDが特定できません');

      // 即時ローカルステート反映
      const completedItems = plannedTasks
        .filter(t => taskIds.includes(t.id))
        .map(t => ({ ...t, status: 'completed' }));
      setPlannedTasks(prev => prev.filter(t => !taskIds.includes(t.id)));
      setWorkLogs(prev => [...completedItems, ...prev]);

      const { error } = await supabase
        .from('work_logs')
        .update({ status: 'completed' })
        .in('id', taskIds)
        .eq('user_id', tenantId);

      if (error) throw error;
      setToastMessage(`「${groupLabel}」の予定 ${taskIds.length}件 を一括完了（実績化）しました！`);
    } catch (err: any) {
      console.error(err);
      alert('一括完了の更新に失敗しました');
      fetchAllData();
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  return (
    <div className="space-y-6">
      
      {/* 5大メインナビゲーションタブ */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveMainTab('cultivations')}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black transition-all ${
            activeMainTab === 'cultivations'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Sprout className="w-4 h-4" />
          <span>作付け一覧</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('spray')}
          className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black transition-all ${
            activeMainTab === 'spray'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <FlaskConical className="w-4 h-4" />
          <span>散布管理 (残回数)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('fertilizers')}
          className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black transition-all ${
            activeMainTab === 'fertilizers'
              ? 'bg-teal-700 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>肥料管理 (成分・公的)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('history')}
          className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black transition-all ${
            activeMainTab === 'history'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <History className="w-4 h-4" />
          <span>作業・散布履歴</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('tasks')}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black transition-all ${
            activeMainTab === 'tasks'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>作業予定 (タスク)</span>
        </button>
      </div>

      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-xs font-bold">栽培データを読み込んでいます...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: 作付け一覧 */}
          {activeMainTab === 'cultivations' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="圃場名・作目で検索..." 
                    value={searchCultivationQuery}
                    onChange={e => setSearchCultivationQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-all"
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button 
                    type="button"
                    onClick={() => {
                      if (selectedIds.length === filteredCultivations.length) {
                        setSelectedIds([]);
                      } else {
                        setSelectedIds(filteredCultivations.map(c => c.id));
                      }
                    }}
                    className="px-3 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                  >
                    {selectedIds.length === filteredCultivations.length ? '全選択解除' : 'すべて選択'}
                  </button>
                  <Link
                    href={currentTenantId ? `/admin/cultivation-schedule?farm=${currentTenantId}` : "/admin/cultivation-schedule"}
                    className="px-3.5 py-2 text-xs font-black bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>作付計画表</span>
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCultivations.map(item => {
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <div 
                      key={item.id}
                      onClick={() => {
                        setSelectedIds(prev => 
                          prev.includes(item.id) ? prev.filter(i => i !== item.id) : [...prev, item.id]
                        );
                      }}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                        isSelected 
                          ? 'bg-emerald-50/70 border-emerald-500 shadow-sm ring-2 ring-emerald-500/20' 
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${
                            isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                          }`}>
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <div>
                            <h3 className="text-base font-black text-slate-800">{item.fieldName}</h3>
                            <p className="text-xs font-bold text-emerald-600 flex items-center gap-1 mt-0.5">
                              <Sprout className="w-3 h-3" /> {item.cropName}
                            </p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 text-slate-600 rounded-lg shrink-0">
                          {item.areaAcre} a
                        </span>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-medium">
                        <span>開始: {item.startDate}</span>
                        <span className="text-emerald-700 font-bold text-[11px] bg-emerald-50 px-2 py-0.5 rounded">作付中</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredCultivations.length === 0 && (
                <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 font-bold">
                  圃場データが見つかりません。「圃場マスタ」または「栽培計画表」から登録してください。
                </div>
              )}
            </div>
          )}

          {/* TAB 2: 散布管理 (残回数) */}
          {activeMainTab === 'spray' && (
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">対象作物を選択</label>
                    <select 
                      value={selectedSprayCropId} 
                      onChange={e => handleCropChange(e.target.value)}
                      className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-400 cursor-pointer"
                    >
                      {crops.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsSprayModalOpen(true)}
                      disabled={selectedPesticideIds.length === 0}
                      className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-black text-xs transition-all shadow-sm flex items-center gap-2"
                    >
                      <FlaskConical className="w-4 h-4" />
                      <span>選択農薬の散布を記録 ({selectedPesticideIds.length})</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 border-b border-slate-100 pt-2">
                  {(['殺虫剤', '殺菌剤', '除草剤', 'その他'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setSprayCategoryTab(tab)}
                      className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
                        sprayCategoryTab === tab 
                          ? 'border-rose-600 text-rose-800 bg-rose-50/50 font-black' 
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {isLoadingPesticides ? (
                <div className="p-12 flex justify-center text-rose-500">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPesticides.map(pest => {
                    const isSelected = selectedPesticideIds.includes(pest.id);
                    const remaining = pest.maxCount - pest.usedCount;
                    const isWarning = remaining <= 1;

                    return (
                      <div 
                        key={pest.id}
                        onClick={() => {
                          setSelectedPesticideIds(prev => 
                            prev.includes(pest.id) ? prev.filter(id => id !== pest.id) : [...prev, pest.id]
                          );
                        }}
                        className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-rose-50/40 border-rose-500 shadow-sm' 
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${
                              isSelected ? 'bg-rose-600 border-rose-600 text-white' : 'border-slate-300 bg-white'
                            }`}>
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-slate-800">{pest.name}</h4>
                              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                RAC: {pest.racCode}
                              </span>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                              isWarning ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              残 {remaining}回
                            </span>
                            <p className="text-[10px] text-slate-400 mt-1 font-bold">
                              使用済 {pest.usedCount} / 上限 {pest.maxCount}回
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1 font-medium">
                          <p>希釈倍率: <span className="font-bold text-slate-700">{pest.dilution}</span></p>
                          <p>対象病害虫: <span className="text-slate-600">{pest.targetPests.slice(0, 3).join(', ')}</span></p>
                        </div>
                      </div>
                    );
                  })}
                  {filteredPesticides.length === 0 && (
                    <div className="col-span-full bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 font-bold">
                      該当する登録農薬がありません。「資材マスタ」から農薬を登録してください。
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: 肥料管理 (成分・公的マスタ検索 ＆ N-P-K累計カルテ) */}
          {activeMainTab === 'fertilizers' && (
            <div className="space-y-6">
              
              {/* 🌾 施肥純成分 (N-P-K) 累計カルテ ＆ 進捗ダッシュボード */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 sm:p-6 rounded-3xl shadow-md border border-slate-700/50 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/60 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-400">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                        作物・圃場別 施肥純成分 (N-P-K) 累計カルテ
                      </h3>
                    </div>
                    <p className="text-xs text-slate-400 font-bold">
                      元肥および追肥の記録から10aあたりの純成分投入量を自動集計しています。
                    </p>
                  </div>

                  {/* 絞り込みセレクター */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                      <select
                        value={fertAnalysisCropId}
                        onChange={e => setFertAnalysisCropId(e.target.value)}
                        className="pl-3 pr-8 py-2 bg-slate-800 border border-slate-600 rounded-xl text-xs font-bold text-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-400 appearance-none cursor-pointer"
                      >
                        <option value="all">すべての作目</option>
                        {crops.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    <div className="relative">
                      <select
                        value={fertAnalysisFieldId}
                        onChange={e => setFertAnalysisFieldId(e.target.value)}
                        className="pl-3 pr-8 py-2 bg-slate-800 border border-slate-600 rounded-xl text-xs font-bold text-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-400 appearance-none cursor-pointer"
                      >
                        <option value="all">すべての圃場</option>
                        {fields.map(f => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* 5大主要養分メーターカード (N-P-K-Ca-Mg) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                  {/* 🔵 N (窒素) */}
                  <div className="bg-slate-800/90 border border-blue-500/30 rounded-2xl p-3.5 flex flex-col justify-between relative overflow-hidden shadow-inner">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black text-blue-300 uppercase tracking-wider">🔵 N (窒素)</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-200 border border-blue-400/30">kg/10a</span>
                    </div>
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">{fertilizerAnalytics.totalN}</span>
                        <span className="text-[11px] font-bold text-slate-400">kg</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-slate-700/50 text-[10px] text-slate-300 font-bold">
                        <span>元: <strong className="text-blue-400">{fertilizerAnalytics.basalN}</strong></span>
                        <span>•</span>
                        <span>追: <strong className="text-cyan-400">{fertilizerAnalytics.topdressN}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* 🟠 P (リン酸) */}
                  <div className="bg-slate-800/90 border border-amber-500/30 rounded-2xl p-3.5 flex flex-col justify-between relative overflow-hidden shadow-inner">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black text-amber-300 uppercase tracking-wider">🟠 P (リン酸)</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-400/30">kg/10a</span>
                    </div>
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">{fertilizerAnalytics.totalP}</span>
                        <span className="text-[11px] font-bold text-slate-400">kg</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-slate-700/50 text-[10px] text-slate-300 font-bold">
                        <span>元: <strong className="text-amber-400">{fertilizerAnalytics.basalP}</strong></span>
                        <span>•</span>
                        <span>追: <strong className="text-yellow-400">{fertilizerAnalytics.topdressP}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* 🟣 K (カリ) */}
                  <div className="bg-slate-800/90 border border-purple-500/30 rounded-2xl p-3.5 flex flex-col justify-between relative overflow-hidden shadow-inner">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black text-purple-300 uppercase tracking-wider">🟣 K (カリ)</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-200 border border-purple-400/30">kg/10a</span>
                    </div>
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">{fertilizerAnalytics.totalK}</span>
                        <span className="text-[11px] font-bold text-slate-400">kg</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-slate-700/50 text-[10px] text-slate-300 font-bold">
                        <span>元: <strong className="text-purple-400">{fertilizerAnalytics.basalK}</strong></span>
                        <span>•</span>
                        <span>追: <strong className="text-pink-400">{fertilizerAnalytics.topdressK}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* 🟡 Ca (カルシウム・石灰) */}
                  <div className="bg-slate-800/90 border border-yellow-500/30 rounded-2xl p-3.5 flex flex-col justify-between relative overflow-hidden shadow-inner">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black text-yellow-300 uppercase tracking-wider">🟡 Ca (石灰)</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-200 border border-yellow-400/30">kg/10a</span>
                    </div>
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">{fertilizerAnalytics.totalCa}</span>
                        <span className="text-[11px] font-bold text-slate-400">kg</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-slate-700/50 text-[10px] text-slate-300 font-bold">
                        <span>元: <strong className="text-yellow-400">{fertilizerAnalytics.basalCa}</strong></span>
                        <span>•</span>
                        <span>追: <strong className="text-amber-300">{fertilizerAnalytics.topdressCa}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* 🟢 Mg (苦土・マグネシウム) */}
                  <div className="bg-slate-800/90 border border-teal-500/30 rounded-2xl p-3.5 flex flex-col justify-between relative overflow-hidden shadow-inner">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black text-teal-300 uppercase tracking-wider">🟢 Mg (苦土)</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-200 border border-teal-400/30">kg/10a</span>
                    </div>
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">{fertilizerAnalytics.totalMg}</span>
                        <span className="text-[11px] font-bold text-slate-400">kg</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-slate-700/50 text-[10px] text-slate-300 font-bold">
                        <span>元: <strong className="text-teal-400">{fertilizerAnalytics.basalMg}</strong></span>
                        <span>•</span>
                        <span>追: <strong className="text-emerald-300">{fertilizerAnalytics.topdressMg}</strong></span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 🧪 微量要素・土壌改良・有機質投入状況パネル */}
                {fertilizerAnalytics.allMicroNutrients.length > 0 && (
                  <div className="p-3 bg-slate-800/80 rounded-2xl border border-teal-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-teal-300 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                        <span>投入済みの微量要素・土壌改良成分:</span>
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {fertilizerAnalytics.allMicroNutrients.map((item, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-teal-900/60 border border-teal-500/40 text-teal-200 rounded-lg text-[11px] font-black shadow-xs">
                            ✨ {item}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold hidden sm:inline">
                      ※微量要素（ホウ素・マンガン・ケイ酸等）は作物の生理障害防止・耐病性に寄与
                    </span>
                  </div>
                )}

                {/* 施肥実績タイムライン（直近の施肥履歴） */}
                {fertilizerAnalytics.parsedLogs.length > 0 && (
                  <div className="pt-2 border-t border-slate-700/60">
                    <h4 className="text-xs font-black text-slate-300 mb-2.5 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-teal-400" />
                      <span>施肥履歴内訳タイムライン ({fertilizerAnalytics.parsedLogs.length}件)</span>
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {fertilizerAnalytics.parsedLogs.map((log: any) => (
                        <div key={log.id} className="p-3 bg-slate-800/70 border border-slate-700 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-teal-300 font-black">{log.work_date}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                log.isBasal ? 'bg-blue-900/60 text-blue-300 border border-blue-700' : 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                              }`}>
                                {log.work_type}
                              </span>
                              <span className="text-slate-300 font-bold">{log.fields?.name || '圃場未指定'}</span>
                              <span className="text-emerald-400 font-bold">{log.crops?.name}</span>
                            </div>
                            <p className="text-[11px] text-slate-400 truncate">{log.memo}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                            {log.nVal > 0 && <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded text-[10px] font-bold">N:{log.nVal}kg</span>}
                            {log.pVal > 0 && <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded text-[10px] font-bold">P:{log.pVal}kg</span>}
                            {log.kVal > 0 && <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded text-[10px] font-bold">K:{log.kVal}kg</span>}
                            {log.caVal > 0 && <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-300 rounded text-[10px] font-bold">Ca:{log.caVal}kg</span>}
                            {log.mgVal > 0 && <span className="px-1.5 py-0.5 bg-teal-500/20 text-teal-300 rounded text-[10px] font-bold">Mg:{log.mgVal}kg</span>}
                            {log.microNutrients?.map((m: string, mIdx: number) => (
                              <span key={mIdx} className="px-1.5 py-0.5 bg-emerald-900/50 text-emerald-300 rounded text-[10px] font-bold border border-emerald-700/50">
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 検索 ＆ カテゴリフィルターバー */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="肥料名・メーカー・登録番号・成分（例: 昭和、21、高度化成、石灰）..." 
                      value={searchFertQuery}
                      onChange={e => handleSearchFertilizers(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                    />
                  </div>

                  <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                    <span>自農園マスタ登録数: <strong className="text-teal-700 font-black">{farmRegisteredFertilizers.length}</strong> 品目</span>
                    <Link
                      href={currentTenantId ? `/admin/masters?farm=${currentTenantId}` : "/admin/masters"}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                    >
                      マスタ管理へ ➔
                    </Link>
                  </div>
                </div>

                {/* 肥料カテゴリタブ */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold">
                  {[
                    { id: 'all', label: 'すべて' },
                    { id: '化成', label: '化成肥料' },
                    { id: '有機', label: '有機質肥料' },
                    { id: '石灰', label: '石灰・苦土 (Ca・Mg)' },
                    { id: '配合', label: '配合肥料' },
                    { id: '液肥', label: '液肥・葉面散布' },
                    { id: 'registered', label: '自社マスタ登録済のみ' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFertCategoryTab(tab.id)}
                      className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                        fertCategoryTab === tab.id
                          ? 'bg-teal-700 text-white shadow-xs font-black'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 肥料リスト */}
              {isLoadingFertilizers ? (
                <div className="p-16 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                  <p className="text-xs font-bold">肥料マスターを検索中...</p>
                </div>
              ) : filteredFertilizers.length === 0 ? (
                <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 space-y-2">
                  <p className="text-sm font-bold">該当する肥料が見つかりませんでした。</p>
                  <p className="text-xs">別のキーワード（メーカー名や銘柄名の一部）で検索をお試しください。</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredFertilizers.map((fert) => {
                    const isRegistered = farmRegisteredFertilizers.some(rf => rf.name === fert.fertilizer_name);
                    return (
                      <div
                        key={fert.id}
                        className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-teal-300 transition-all flex flex-col justify-between gap-3"
                      >
                        <div>
                          {/* 登録番号 ＆ 区分バッジ */}
                          <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <span 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (fert.registration_no) {
                                    navigator.clipboard.writeText(fert.registration_no);
                                    showToast(`登録番号「${fert.registration_no}」をコピーしました！`);
                                  }
                                }}
                                title="クリックで登録番号をコピー"
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-700 rounded-lg text-xs font-mono font-black tracking-wide cursor-pointer transition-colors shadow-2xs"
                              >
                                <span className="text-[10px] text-slate-400 font-sans">登録番号:</span>
                                {fert.registration_no || '登録番号なし'}
                                <Copy className="w-3 h-3 text-slate-400 hover:text-amber-300 ml-0.5" />
                              </span>
                              {fert.registration_date && (
                                <span className="text-[10px] text-slate-400 font-medium">
                                  ({fert.registration_date}登録)
                                </span>
                              )}
                            </div>
                            <span className="shrink-0 text-[10px] font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                              {fert.fertilizer_type || '化成肥料'}
                            </span>
                          </div>

                          <div className="mt-1">
                            <h4 className="text-base font-black text-slate-800 leading-snug">
                              {fert.fertilizer_name}
                            </h4>
                            <p className="text-xs font-bold text-slate-500 mt-0.5 flex items-center gap-1">
                              <span>業者名・申請者:</span>
                              <span className="text-slate-700 font-black">{fert.applicant_name || '未登録'}</span>
                            </p>
                          </div>

                          {/* 成分情報バッジ群（N, P, K, Mg, Ca, 微量要素） */}
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-md text-xs font-black">
                              窒素(N) {fert.n_percent}%
                            </span>
                            <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-xs font-black">
                              リン酸(P) {fert.p_percent}%
                            </span>
                            <span className="px-2 py-0.5 bg-purple-50 border border-purple-200 text-purple-800 rounded-md text-xs font-black">
                              カリ(K) {fert.k_percent}%
                            </span>
                            {parseFloat(fert.mg_percent) > 0 && (
                              <span className="px-2 py-0.5 bg-teal-50 border border-teal-200 text-teal-800 rounded-md text-xs font-black">
                                苦土(Mg) {fert.mg_percent}%
                              </span>
                            )}
                            {parseFloat(fert.ca_percent) > 0 && (
                              <span className="px-2 py-0.5 bg-orange-50 border border-orange-200 text-orange-800 rounded-md text-xs font-black">
                                石灰(Ca) {fert.ca_percent}%
                              </span>
                            )}
                          </div>

                          {fert.other_ingredients && (
                            <div className="mt-2 text-[11px] font-medium text-emerald-800 bg-emerald-50/80 border border-emerald-200 px-2 py-1 rounded-lg">
                              その他成分: {fert.other_ingredients}
                            </div>
                          )}

                          {/* 自社マスタ設定価格・荷姿情報 */}
                          {(fert.default_price || fert.bag_weight) && (
                            <div className="mt-2 text-xs font-bold text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                              {fert.bag_weight && <span>荷姿: <strong>{fert.bag_weight}kg / 袋</strong></span>}
                              {fert.default_price && <span className="text-emerald-800">購入単価: <strong>¥{Number(fert.default_price).toLocaleString()}</strong></span>}
                            </div>
                          )}
                        </div>

                        {/* アクション */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          {isRegistered || fert.isFarmRegistered ? (
                            <div className="w-full flex items-center justify-between">
                              <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> 自農園マスタ登録済
                              </span>
                              <Link
                                href={currentTenantId ? `/admin/masters?farm=${currentTenantId}` : "/admin/masters"}
                                className="text-[11px] font-bold text-slate-500 hover:text-slate-800 underline"
                              >
                                単価・荷姿を変更 ➔
                              </Link>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRegisterFertToFarmMaster(fert)}
                              className="w-full py-1.5 px-3 bg-teal-600 hover:bg-teal-700 text-white text-xs font-black rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              自農園マスタにワンクリック追加
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: 作業・散布履歴 */}
          {activeMainTab === 'history' && (
            <div className="space-y-4">
              {/* 1. コントロールパネル（まとめ切替 ＋ 検索・絞り込み ＋ アクション） */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3.5">
                {/* 上段: 4大まとめ表示（グルーピング）切替 ＆ 帳票・新規登録ボタン */}
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-black text-slate-400 mr-1 flex items-center gap-1">
                      <Folder className="w-3.5 h-3.5 text-slate-400" />
                      まとめ表示:
                    </span>
                    <button
                      type="button"
                      onClick={() => { setHistoryGroupMode('date'); setCollapsedHistoryGroups({}); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                        historyGroupMode === 'date'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>日付順 (標準)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setHistoryGroupMode('field'); setCollapsedHistoryGroups({}); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                        historyGroupMode === 'field'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>圃場（畑）ごとにまとめる</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setHistoryGroupMode('crop'); setCollapsedHistoryGroups({}); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                        historyGroupMode === 'crop'
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Sprout className="w-3.5 h-3.5" />
                      <span>作目ごとにまとめる</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setHistoryGroupMode('type'); setCollapsedHistoryGroups({}); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                        historyGroupMode === 'type'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <List className="w-3.5 h-3.5" />
                      <span>作業内容ごとにまとめる</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsReportModalOpen(true)}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                      title="農協（JA）・GAP提出用の病害虫防除日誌をA4横で印刷・PDF保存"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>📑 公的防除日誌を印刷・PDF出力</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDirectAddStatusMode('completed'); setIsDirectAddModalOpen(true); }}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>作業履歴を直接登録</span>
                    </button>
                  </div>
                </div>

                {/* 下段: 絞り込みフィルタ（区分・圃場・作目・フリーワード） */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-wrap flex-1">
                    <select 
                      value={historyTypeFilter} 
                      onChange={(e: any) => setHistoryTypeFilter(e.target.value)}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="all">📋 すべての作業区分</option>
                      <option value="sprayOnly">🧪 農薬散布のみ</option>
                      <option value="fertOnly">🔬 施肥（元肥・追肥）のみ</option>
                      <option value="workOnly">🌾 一般作業・収穫のみ</option>
                    </select>

                    <select
                      value={historyFieldFilter}
                      onChange={(e) => setHistoryFieldFilter(e.target.value)}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="all">📍 すべての圃場</option>
                      {fields.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>

                    <select
                      value={historyCropFilter}
                      onChange={(e) => setHistoryCropFilter(e.target.value)}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="all">🌱 すべての作目</option>
                      {crops.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>

                    <div className="relative flex-1 min-w-[180px] sm:max-w-xs">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input 
                        type="text" 
                        placeholder="資材名・作業者・メモで検索..." 
                        value={historySearchQuery}
                        onChange={e => setHistorySearchQuery(e.target.value)}
                        className="w-full pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-blue-400"
                      />
                      {historySearchQuery && (
                        <button
                          type="button"
                          onClick={() => setHistorySearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {(historyTypeFilter !== 'all' || historyFieldFilter !== 'all' || historyCropFilter !== 'all' || historySearchQuery) && (
                      <button
                        type="button"
                        onClick={() => {
                          setHistoryTypeFilter('all');
                          setHistoryFieldFilter('all');
                          setHistoryCropFilter('all');
                          setHistorySearchQuery('');
                        }}
                        className="px-2.5 py-1.5 text-[11px] font-black text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                      >
                        条件クリア
                      </button>
                    )}
                  </div>

                  {groupedWorkLogs.length > 1 && (
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => setCollapsedHistoryGroups({})}
                        className="px-2.5 py-1.5 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                      >
                        すべて開く
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const allClosed: Record<string, boolean> = {};
                          groupedWorkLogs.forEach(g => { allClosed[g.key] = true; });
                          setCollapsedHistoryGroups(allClosed);
                        }}
                        className="px-2.5 py-1.5 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                      >
                        すべて折りたたむ
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. 集計サマリーバー（件数・合計時間・内訳が一目でわかる） */}
              <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400">表示件数:</span>
                    <span className="text-sm font-black text-white">{historySummary.totalCount} 件</span>
                    <span className="text-[11px] font-bold text-slate-400">（{groupedWorkLogs.length} グループ）</span>
                  </div>
                  <div className="h-4 w-px bg-slate-700 hidden sm:block" />
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[11px] font-bold text-slate-400">合計作業時間:</span>
                    <span className="text-sm font-black text-amber-300">{formatMinutesReadable(historySummary.totalMinutes)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs font-black">
                  <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    🧪 農薬散布: {historySummary.sprayCount}件
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    🔬 施肥: {historySummary.fertCount}件
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    🌾 一般作業: {historySummary.workCount}件
                  </span>
                </div>
              </div>

              {/* 3. グループ別カード一覧 */}
              {groupedWorkLogs.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 font-bold text-sm">
                  条件に一致する作業記録がありません。
                </div>
              ) : (
                <div className="space-y-3">
                  {groupedWorkLogs.map(group => {
                    const isCollapsed = !!collapsedHistoryGroups[group.key];
                    const headerAccent =
                      group.badgeTone === 'emerald' ? 'border-l-4 border-l-emerald-500 bg-emerald-50/40' :
                      group.badgeTone === 'teal' ? 'border-l-4 border-l-teal-500 bg-teal-50/40' :
                      group.badgeTone === 'rose' ? 'border-l-4 border-l-rose-500 bg-rose-50/40' :
                      'border-l-4 border-l-blue-500 bg-slate-50/80';

                    return (
                      <div key={group.key} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                        {/* グループ見出しバー（クリックで開閉） */}
                        <button
                          type="button"
                          onClick={() => setCollapsedHistoryGroups(prev => ({ ...prev, [group.key]: !prev[group.key] }))}
                          className={`w-full px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left transition-colors hover:bg-slate-100/70 cursor-pointer ${headerAccent}`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {isCollapsed ? (
                              <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-700 shrink-0" />
                            )}
                            <span className="text-sm font-black text-slate-900 truncate">
                              {historyGroupMode === 'field' && '📍 '}
                              {historyGroupMode === 'crop' && '🌱 '}
                              {historyGroupMode === 'date' && '📅 '}
                              {historyGroupMode === 'type' && '🏷️ '}
                              {group.title}
                            </span>
                            {group.subtitle && (
                              <span className="text-xs font-bold text-slate-500 truncate hidden md:inline">
                                ― {group.subtitle}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0 flex-wrap pl-6 sm:pl-0">
                            {group.sprayCount > 0 && (
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-rose-100 text-rose-800">
                                散布 {group.sprayCount}
                              </span>
                            )}
                            {group.fertCount > 0 && (
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-teal-100 text-teal-800">
                                施肥 {group.fertCount}
                              </span>
                            )}
                            {group.workCount > 0 && (
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-emerald-100 text-emerald-800">
                                作業 {group.workCount}
                              </span>
                            )}
                            <span className="px-2.5 py-0.5 rounded-md text-xs font-black bg-slate-200/80 text-slate-800">
                              計 {group.logs.length}件
                            </span>
                            <span className="px-2.5 py-0.5 rounded-md text-xs font-black bg-amber-100 text-amber-900 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatMinutesReadable(group.totalMinutes)}
                            </span>
                          </div>
                        </button>

                        {/* グループ内の明細行 */}
                        {!isCollapsed && (
                          <div className="divide-y divide-slate-100 border-t border-slate-100">
                            {group.logs.map(log => {
                              const cat = getLogCategory(log);
                              const { badges, cleanNote } = parseStructuredMemo(log.memo);
                              const typeBadgeStyle =
                                cat === 'spray'
                                  ? 'bg-rose-100 text-rose-800 border-rose-200'
                                  : cat === 'fert'
                                  ? 'bg-teal-100 text-teal-800 border-teal-200'
                                  : 'bg-emerald-100 text-emerald-800 border-emerald-200';

                              return (
                                <div key={log.id} className="px-4 py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div className="space-y-1.5 min-w-0 flex-1">
                                    {/* 1行目: 日付・作業区分・圃場・作目・作業者 */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {historyGroupMode !== 'date' && (
                                        <span className="text-xs font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md font-mono">
                                          📅 {log.work_date}
                                        </span>
                                      )}
                                      <span className={`px-2.5 py-0.5 rounded-md text-xs font-black border ${typeBadgeStyle}`}>
                                        {cat === 'spray' ? '🧪 ' : cat === 'fert' ? '🔬 ' : '🌾 '}
                                        {log.work_type}
                                      </span>

                                      {historyGroupMode !== 'field' && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                                          <MapPin className="w-3 h-3 text-slate-500" />
                                          {log.fields?.name || '圃場未指定'}
                                        </span>
                                      )}

                                      {historyGroupMode !== 'crop' && log.crops?.name && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                          <Sprout className="w-3 h-3 text-emerald-600" />
                                          {log.crops.name}
                                        </span>
                                      )}

                                      {log.workers?.name && (
                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                          <User className="w-3 h-3 text-slate-400" />
                                          {log.workers.name}
                                        </span>
                                      )}
                                    </div>

                                    {/* 2行目: 構造化バッジ（使用資材・成分・水量・RAC等）＋ クリーンメモ */}
                                    {(badges.length > 0 || cleanNote) && (
                                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                        {badges.map((b, idx) => {
                                          const bClass =
                                            b.tone === 'rose' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                                            b.tone === 'teal' ? 'bg-teal-50 text-teal-800 border-teal-200' :
                                            b.tone === 'blue' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                                            b.tone === 'amber' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                            'bg-slate-100 text-slate-700 border-slate-200';
                                          return (
                                            <span key={idx} className={`px-2 py-0.5 rounded-md text-xs font-bold border ${bClass}`}>
                                              {b.text}
                                            </span>
                                          );
                                        })}
                                        {cleanNote && (
                                          <span className="text-xs text-slate-600 font-medium break-all">
                                            {cleanNote}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* 右側: 作業時間 ＆ 訂正・削除ボタン */}
                                  <div className="flex items-center justify-end gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-black flex items-center gap-1 ${
                                      Number(log.duration_minutes) > 0
                                        ? 'bg-slate-100 text-slate-700'
                                        : 'text-slate-400'
                                    }`}>
                                      <Clock className="w-3 h-3 text-slate-400" />
                                      {log.duration_minutes || 0}分
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditModal(log)}
                                      className="px-3 py-1 text-xs font-black text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                                    >
                                      訂正
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteWorkLog(log.id)}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                      title="削除"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: 作業予定 (タスク) */}
          {activeMainTab === 'tasks' && (
            <div className="space-y-4">
              {/* 1. コントロールパネル（まとめ切替 ＋ 期限・圃場・作目絞り込み ＋ 予定追加ボタン） */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3.5">
                {/* 上段: 4大まとめ表示切替 ＆ 作業予定の新規追加ボタン */}
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-black text-slate-400 mr-1 flex items-center gap-1">
                      <Folder className="w-3.5 h-3.5 text-slate-400" />
                      まとめ表示:
                    </span>
                    <button
                      type="button"
                      onClick={() => { setTaskGroupMode('date'); setCollapsedTaskGroups({}); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                        taskGroupMode === 'date'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>予定日順 (標準)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setTaskGroupMode('field'); setCollapsedTaskGroups({}); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                        taskGroupMode === 'field'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>圃場（畑）ごとにまとめる</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setTaskGroupMode('crop'); setCollapsedTaskGroups({}); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                        taskGroupMode === 'crop'
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Sprout className="w-3.5 h-3.5" />
                      <span>作目ごとにまとめる</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setTaskGroupMode('type'); setCollapsedTaskGroups({}); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                        taskGroupMode === 'type'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <List className="w-3.5 h-3.5" />
                      <span>作業内容ごとにまとめる</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => { setDirectAddStatusMode('planned'); setIsDirectAddModalOpen(true); }}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>作業予定（タスク）を追加</span>
                    </button>
                  </div>
                </div>

                {/* 下段: 絞り込みフィルタ（期限ステータス・圃場・作目・フリーワード） */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-wrap flex-1">
                    <select
                      value={taskUrgencyFilter}
                      onChange={(e: any) => setTaskUrgencyFilter(e.target.value)}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="all">📋 すべての期限</option>
                      <option value="overdue">🚨 期限超過（未完了）のみ</option>
                      <option value="today">📌 本日の作業予定のみ</option>
                      <option value="upcoming">📅 明日以降の予定のみ</option>
                    </select>

                    <select
                      value={taskFieldFilter}
                      onChange={(e) => setTaskFieldFilter(e.target.value)}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="all">📍 すべての圃場</option>
                      {fields.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>

                    <select
                      value={taskCropFilter}
                      onChange={(e) => setTaskCropFilter(e.target.value)}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="all">🌱 すべての作目</option>
                      {crops.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>

                    <div className="relative flex-1 min-w-[180px] sm:max-w-xs">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="作業名・圃場・メモで検索..."
                        value={taskSearchQuery}
                        onChange={e => setTaskSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-amber-400"
                      />
                      {taskSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setTaskSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {(taskUrgencyFilter !== 'all' || taskFieldFilter !== 'all' || taskCropFilter !== 'all' || taskSearchQuery) && (
                      <button
                        type="button"
                        onClick={() => {
                          setTaskUrgencyFilter('all');
                          setTaskFieldFilter('all');
                          setTaskCropFilter('all');
                          setTaskSearchQuery('');
                        }}
                        className="px-2.5 py-1.5 text-[11px] font-black text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                      >
                        条件クリア
                      </button>
                    )}
                  </div>

                  {groupedPlannedTasks.length > 1 && (
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => setCollapsedTaskGroups({})}
                        className="px-2.5 py-1.5 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                      >
                        すべて開く
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const allClosed: Record<string, boolean> = {};
                          groupedPlannedTasks.forEach(g => { allClosed[g.key] = true; });
                          setCollapsedTaskGroups(allClosed);
                        }}
                        className="px-2.5 py-1.5 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                      >
                        すべて折りたたむ
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. 集計サマリーバー（未完了タスク数・予定作業時間・緊急度内訳） */}
              <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400">未完了タスク:</span>
                    <span className="text-sm font-black text-white">{taskSummary.totalCount} 件</span>
                    <span className="text-[11px] font-bold text-slate-400">（{groupedPlannedTasks.length} グループ）</span>
                  </div>
                  <div className="h-4 w-px bg-slate-700 hidden sm:block" />
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[11px] font-bold text-slate-400">予定作業時間:</span>
                    <span className="text-sm font-black text-amber-300">{formatMinutesReadable(taskSummary.totalMinutes)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs font-black">
                  <button
                    type="button"
                    onClick={() => setTaskUrgencyFilter(taskUrgencyFilter === 'overdue' ? 'all' : 'overdue')}
                    className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      taskUrgencyFilter === 'overdue'
                        ? 'bg-rose-600 text-white border-rose-400 ring-2 ring-rose-400/50'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/30 hover:bg-rose-500/30'
                    }`}
                  >
                    🚨 期限超過: {taskSummary.overdueCount}件
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskUrgencyFilter(taskUrgencyFilter === 'today' ? 'all' : 'today')}
                    className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      taskUrgencyFilter === 'today'
                        ? 'bg-amber-500 text-slate-950 border-amber-300 ring-2 ring-amber-400/50'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30'
                    }`}
                  >
                    📌 本日予定: {taskSummary.todayCount}件
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskUrgencyFilter(taskUrgencyFilter === 'upcoming' ? 'all' : 'upcoming')}
                    className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      taskUrgencyFilter === 'upcoming'
                        ? 'bg-emerald-600 text-white border-emerald-400 ring-2 ring-emerald-400/50'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
                    }`}
                  >
                    📅 明日以降: {taskSummary.upcomingCount}件
                  </button>
                </div>
              </div>

              {/* 3. グループ別タスクカード一覧 */}
              {groupedPlannedTasks.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 font-bold text-sm">
                  条件に一致する予定作業タスクはありません。
                </div>
              ) : (
                <div className="space-y-3">
                  {groupedPlannedTasks.map(group => {
                    const isCollapsed = !!collapsedTaskGroups[group.key];
                    const headerAccent =
                      group.urgency === 'overdue'
                        ? 'border-l-4 border-l-rose-500 bg-rose-50/40'
                        : group.urgency === 'today'
                        ? 'border-l-4 border-l-amber-500 bg-amber-50/50'
                        : 'border-l-4 border-l-emerald-500 bg-slate-50/80';

                    return (
                      <div key={group.key} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                        {/* グループ見出しバー */}
                        <div className={`w-full px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${headerAccent}`}>
                          <button
                            type="button"
                            onClick={() => setCollapsedTaskGroups(prev => ({ ...prev, [group.key]: !prev[group.key] }))}
                            className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                          >
                            {isCollapsed ? (
                              <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-700 shrink-0" />
                            )}
                            <span className="text-sm font-black text-slate-900 truncate">
                              {taskGroupMode === 'field' && '📍 '}
                              {taskGroupMode === 'crop' && '🌱 '}
                              {taskGroupMode === 'date' && '📅 '}
                              {taskGroupMode === 'type' && '🏷️ '}
                              {group.title}
                            </span>
                            {group.subtitle && (
                              <span className="text-xs font-bold text-slate-500 truncate hidden md:inline">
                                ― {group.subtitle}
                              </span>
                            )}
                          </button>

                          <div className="flex items-center gap-2 shrink-0 flex-wrap pl-6 sm:pl-0">
                            {group.overdueCount > 0 && (
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                                🚨 期限超過 {group.overdueCount}件
                              </span>
                            )}
                            {group.todayCount > 0 && (
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                                📌 本日 {group.todayCount}件
                              </span>
                            )}
                            <span className="px-2.5 py-0.5 rounded-md text-xs font-black bg-slate-200/80 text-slate-800">
                              計 {group.tasks.length}件
                            </span>
                            <span className="px-2.5 py-0.5 rounded-md text-xs font-black bg-amber-100 text-amber-900 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatMinutesReadable(group.totalMinutes)}
                            </span>

                            {group.tasks.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleBatchCompleteTasks(group.tasks.map((t: any) => t.id), group.title)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-black flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                                title="このグループの予定をすべて完了（実績化）します"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>一括完了 ({group.tasks.length}件)</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* グループ内のタスク明細行 */}
                        {!isCollapsed && (
                          <div className="divide-y divide-slate-100 border-t border-slate-100">
                            {group.tasks.map((task: any) => {
                              const u = getTaskUrgency(task.work_date);
                              const cat = getLogCategory(task);
                              const { badges, cleanNote } = parseStructuredMemo(task.memo);

                              const urgencyBadge =
                                u === 'overdue'
                                  ? { label: '🚨 期限超過', cls: 'bg-rose-100 text-rose-800 border-rose-200' }
                                  : u === 'today'
                                  ? { label: '📌 本日予定', cls: 'bg-amber-100 text-amber-900 border-amber-300' }
                                  : { label: '📅 予定', cls: 'bg-slate-100 text-slate-700 border-slate-200' };

                              const typeBadgeStyle =
                                cat === 'spray'
                                  ? 'bg-rose-100 text-rose-800 border-rose-200'
                                  : cat === 'fert'
                                  ? 'bg-teal-100 text-teal-800 border-teal-200'
                                  : 'bg-amber-100 text-amber-900 border-amber-200';

                              return (
                                <div key={task.id} className="px-4 py-3.5 hover:bg-amber-50/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div className="space-y-1.5 min-w-0 flex-1">
                                    {/* 1行目: 緊急度・日付・作業内容・圃場・作目・担当者 */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-black border ${urgencyBadge.cls}`}>
                                        {urgencyBadge.label}
                                      </span>

                                      {taskGroupMode !== 'date' && (
                                        <span className="text-xs font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md font-mono">
                                          📅 {task.work_date}
                                        </span>
                                      )}

                                      <span className={`px-2.5 py-0.5 rounded-md text-xs font-black border ${typeBadgeStyle}`}>
                                        {cat === 'spray' ? '🧪 ' : cat === 'fert' ? '🔬 ' : '🚜 '}
                                        {task.work_type}
                                      </span>

                                      {taskGroupMode !== 'field' && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                                          <MapPin className="w-3 h-3 text-slate-500" />
                                          {task.fields?.name || '圃場未指定'}
                                        </span>
                                      )}

                                      {taskGroupMode !== 'crop' && task.crops?.name && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                          <Sprout className="w-3 h-3 text-emerald-600" />
                                          {task.crops.name}
                                        </span>
                                      )}

                                      {task.workers?.name && (
                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                          <User className="w-3 h-3 text-slate-400" />
                                          {task.workers.name}
                                        </span>
                                      )}
                                    </div>

                                    {/* 2行目: 構造化バッジ＋クリーンメモ */}
                                    {(badges.length > 0 || cleanNote) && (
                                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                        {badges.map((b, idx) => {
                                          const bClass =
                                            b.tone === 'rose' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                                            b.tone === 'teal' ? 'bg-teal-50 text-teal-800 border-teal-200' :
                                            b.tone === 'blue' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                                            b.tone === 'amber' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                            'bg-slate-100 text-slate-700 border-slate-200';
                                          return (
                                            <span key={idx} className={`px-2 py-0.5 rounded-md text-xs font-bold border ${bClass}`}>
                                              {b.text}
                                            </span>
                                          );
                                        })}
                                        {cleanNote && (
                                          <span className="text-xs text-slate-600 font-medium break-all">
                                            {cleanNote}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* 右側: 予定時間 ＆ 完了・訂正・削除ボタン */}
                                  <div className="flex items-center justify-end gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                                    <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-slate-100 text-slate-700 flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-slate-400" />
                                      {task.duration_minutes || 60}分
                                    </span>

                                    <button
                                      type="button"
                                      onClick={() => handleCompleteTask(task.id)}
                                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>完了にする</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditModal(task)}
                                      className="px-2.5 py-1.5 text-xs font-black text-blue-600 hover:bg-blue-50 rounded-xl border border-blue-200 transition-colors cursor-pointer"
                                      title="予定日や圃場・作業内容を訂正"
                                    >
                                      訂正
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteWorkLog(task.id)}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                      title="予定を削除"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* 画面下部 CultivationActionSheet（作付け一括操作バー） */}
      {selectedIds.length > 0 && (
        <CultivationActionSheet 
          selectedCultivations={selectedCultivationTargets}
          onClearSelection={() => setSelectedIds([])}
          onSuccess={(msg) => {
            showToast(msg);
            fetchAllData();
          }}
        />
      )}

      {/* 散布記録モーダル */}
      {isSprayModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-black text-slate-800 mb-4 flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-rose-600" /> 農薬散布記録の確定
            </h3>
            <form onSubmit={handleSaveSprayLog} className="space-y-4">
              {/* ⚠️ 散布基準セーフティ警告バナー */}
              {pesticides.filter(p => selectedPesticideIds.includes(p.id)).some(p => p.usedCount >= p.maxCount) && (
                <div className="p-3 bg-rose-50 border-2 border-rose-500 rounded-2xl flex items-start gap-2.5 text-rose-800 animate-pulse">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-black text-rose-700">【農薬取締法違反・出荷停止の危険】</p>
                    <p className="leading-snug">
                      選択中の農薬の中に、**今期の上限使用回数にすでに達している農薬**があります。散布すると出荷停止や回収命令の対象となる恐れがあります。
                    </p>
                    <ul className="list-disc list-inside font-bold text-rose-900 pt-0.5">
                      {pesticides
                        .filter(p => selectedPesticideIds.includes(p.id) && p.usedCount >= p.maxCount)
                        .map(p => (
                          <li key={p.id}>{p.name} (今期 {p.usedCount}回 / 上限 {p.maxCount}回)</li>
                        ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* ℹ️ 最終回アラート */}
              {!pesticides.filter(p => selectedPesticideIds.includes(p.id)).some(p => p.usedCount >= p.maxCount) &&
               pesticides.filter(p => selectedPesticideIds.includes(p.id)).some(p => p.usedCount + 1 === p.maxCount) && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-2.5 text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-0.5">
                    <p className="font-black text-amber-700">【今期最終散布のお知らせ】</p>
                    <p className="leading-snug">
                      今回の散布により、今期の上限使用回数に達する農薬があります（次回以降は散布できません）。
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">散布日</label>
                <input 
                  type="date" 
                  value={sprayDate} 
                  onChange={e => setSprayDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">散布対象の圃場（複数選択可）</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {fields.map(f => {
                    const isChecked = selectedSprayFieldIds.includes(f.id);
                    return (
                      <label key={f.id} className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={() => {
                            setSelectedSprayFieldIds(prev => 
                              prev.includes(f.id) ? prev.filter(id => id !== f.id) : [...prev, f.id]
                            );
                          }}
                          className="rounded text-rose-600"
                        />
                        <span>{f.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">10aあたり散布水量 (L)</label>
                <input 
                  type="number" 
                  value={sprayWaterVolume} 
                  onChange={e => setSprayWaterVolume(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none"
                  placeholder="100"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">備考・メモ</label>
                <textarea 
                  value={sprayMemo} 
                  onChange={e => setSprayMemo(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none h-20"
                  placeholder="散布時の天候や留意事項など..."
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSprayModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSavingSpray}
                  className="px-6 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-colors flex items-center gap-1.5"
                >
                  {isSavingSpray ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>散布を記録する</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 履歴訂正モーダル */}
      {editingLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-black text-slate-800 mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" /> 作業記録の訂正
            </h3>
            <form onSubmit={handleUpdateWorkLog} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">作業日</label>
                <input 
                  type="date" 
                  value={editWorkDate} 
                  onChange={e => setEditWorkDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">作業内容</label>
                <input 
                  type="text" 
                  value={editWorkType} 
                  onChange={e => setEditWorkType(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">圃場</label>
                  <select 
                    value={editFieldId} 
                    onChange={e => setEditFieldId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                  >
                    <option value="">未指定</option>
                    {fields.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">作目</label>
                  <select 
                    value={editCropId} 
                    onChange={e => setEditCropId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                  >
                    <option value="">未指定</option>
                    {crops.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">作業時間 (分)</label>
                <input 
                  type="number" 
                  value={editDuration} 
                  onChange={e => setEditDuration(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">メモ</label>
                <textarea 
                  value={editMemo} 
                  onChange={e => setEditMemo(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none h-16"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingLog(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingLog}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-colors"
                >
                  {isUpdatingLog ? '更新中...' : '訂正を保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 履歴・予定直接登録モーダル */}
      {isDirectAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-black text-slate-800 mb-4 flex items-center gap-2">
              <Plus className={`w-5 h-5 ${directAddStatusMode === 'planned' ? 'text-amber-600' : 'text-blue-600'}`} />
              {directAddStatusMode === 'planned' ? '作業予定（タスク）の追加' : '作業履歴の直接追加'}
            </h3>
            <form onSubmit={handleDirectAddWorkLog} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">
                  {directAddStatusMode === 'planned' ? '予定日' : '作業日'}
                </label>
                <input 
                  type="date" 
                  value={directAddDate} 
                  onChange={e => setDirectAddDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">作業内容</label>
                <input 
                  type="text" 
                  value={directAddWorkType} 
                  onChange={e => setDirectAddWorkType(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none"
                  placeholder="例: 収穫、定植、除草など"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">圃場</label>
                  <select 
                    value={directAddFieldId} 
                    onChange={e => setDirectAddFieldId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                  >
                    <option value="">未指定</option>
                    {fields.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">作目</label>
                  <select 
                    value={directAddCropId} 
                    onChange={e => setDirectAddCropId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                  >
                    <option value="">未指定</option>
                    {crops.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">
                  {directAddStatusMode === 'planned' ? '予定時間 (分)' : '作業時間 (分)'}
                </label>
                <input 
                  type="number" 
                  value={directAddDuration} 
                  onChange={e => setDirectAddDuration(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">メモ</label>
                <textarea 
                  value={directAddMemo} 
                  onChange={e => setDirectAddMemo(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none h-16"
                  placeholder="特記事項があれば記入..."
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDirectAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isDirectAdding}
                  className={`px-5 py-2 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-colors cursor-pointer ${
                    directAddStatusMode === 'planned'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {isDirectAdding ? '登録中...' : directAddStatusMode === 'planned' ? '予定を登録' : '履歴を登録'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📑 公的防除日誌（農薬使用台帳）A4横印刷プレビューモーダル */}
      <PesticideLogReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        workLogs={workLogs}
        crops={crops}
        fields={fields}
        companyName={companyName}
      />

      {/* トースト通知 */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-800 flex items-center gap-2.5 text-xs font-black animate-in slide-in-from-top-4 duration-200">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
