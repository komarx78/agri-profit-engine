"use client";

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  ChevronRight
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CultivationActionSheet, CultivationTarget } from '@/components/CultivationActionSheet';
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

function CultivationsHubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'cultivations';

  // メインタブ: cultivations(作付け) | spray(散布管理) | history(作業・散布履歴) | tasks(予定)
  const [activeMainTab, setActiveMainTab] = useState<string>(initialTab);

  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // マスタ
  const [crops, setCrops] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);

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
  const [sprayDate, setSprayDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [sprayWaterVolume, setSprayWaterVolume] = useState<string>('100');
  const [sprayMemo, setSprayMemo] = useState<string>('');
  const [isSavingSpray, setIsSavingSpray] = useState(false);

  // --- タブ3: 履歴ステート ---
  const [workLogs, setWorkLogs] = useState<any[]>([]);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'all' | 'sprayOnly' | 'workOnly'>('all');

  // --- タブ4: 予定ステート ---
  const [plannedTasks, setPlannedTasks] = useState<any[]>([]);

  // データ全取得
  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const [fRes, cRes, pRes, logsRes] = await Promise.all([
        supabase.from('fields').select('*').order('name'),
        supabase.from('crops').select('*').order('name'),
        supabase.from('cultivation_plans_v2').select('*, crops(*)').order('created_at', { ascending: false }),
        supabase.from('work_logs').select('*, crops(name), fields(name), workers(name)').order('work_date', { ascending: false })
      ]);

      const fetchedFields = fRes.data || [];
      const fetchedCrops = cRes.data || [];
      const fetchedPlans = pRes.data || [];
      const fetchedLogs = logsRes.data || [];

      setFields(fetchedFields);
      setCrops(fetchedCrops);

      if (fetchedCrops.length > 0 && !selectedSprayCropId) {
        setSelectedSprayCropId(fetchedCrops[0].id);
      }
      if (fetchedFields.length > 0 && selectedSprayFieldIds.length === 0) {
        setSelectedSprayFieldIds([fetchedFields[0].id]);
      }

      // 1. 作付け一覧の整形
      const cultList: CultivationItem[] = [];
      if (fetchedPlans.length > 0) {
        fetchedPlans.forEach((p: any) => {
          const matchedField = fetchedFields.find(f => f.id === p.field_id);
          const matchedCrop = p.crops || fetchedCrops.find(c => c.id === p.crop_id);
          const areaSqm = matchedField?.area_sqm || matchedField?.area_size || 0;
          const areaAcre = areaSqm > 0 ? Math.round((areaSqm / 100) * 10) / 10 : 10.0;
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
          const areaSqm = f.area_sqm || f.area_size || 0;
          const areaAcre = areaSqm > 0 ? Math.round((areaSqm / 100) * 10) / 10 : 10.0;
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

      // 2. 過去の散布ログと作業ログの分類
      const completedLogs = fetchedLogs.filter(l => l.status !== 'planned');
      const plannedLogs = fetchedLogs.filter(l => l.status === 'planned');
      setWorkLogs(completedLogs);
      setPlannedTasks(plannedLogs);

      // 3. 農薬マスターと使用回数集計
      const basePesticides: PesticideDisplayItem[] = [
        {
          id: 'p-1',
          name: 'カスケード乳剤',
          type: '殺虫剤',
          racCode: 'IR 15',
          targetPests: ['ミナミキイロアザミウマ', 'アザミウマ類', 'コナジラミ類'],
          maxCount: 3,
          usedCount: 0,
          dilution: '1000〜2000倍',
          usageTime: '収穫前日まで',
          method: '散布'
        },
        {
          id: 'p-2',
          name: 'コロマイト乳剤',
          type: '殺虫剤',
          racCode: 'IR 6',
          targetPests: ['コナジラミ類', 'ハダニ類', 'サビダニ類'],
          maxCount: 2,
          usedCount: 1,
          dilution: '1000〜1500倍',
          usageTime: '収穫前日まで',
          method: '散布'
        },
        {
          id: 'p-3',
          name: 'ダブルシューターSE',
          type: '殺虫剤',
          racCode: 'FR 「-」',
          targetPests: ['オオタバコガ', 'アザミウマ類', 'コナジラミ類', 'ハダニ類'],
          maxCount: 3,
          usedCount: 1,
          dilution: '1000倍',
          usageTime: '収穫7日前まで',
          method: '散布'
        },
        {
          id: 'p-4',
          name: 'フーモン',
          type: '殺虫剤',
          racCode: 'IR 「-」',
          targetPests: ['コナジラミ類', 'うどんこ病', 'ハダニ類', 'アブラムシ類'],
          maxCount: 0,
          usedCount: 2,
          dilution: '800〜1000倍',
          usageTime: '収穫前日まで',
          method: '散布'
        },
        {
          id: 'p-5',
          name: 'ダコニール1000',
          type: '殺菌剤',
          racCode: 'FR M5',
          targetPests: ['べと病', '疫病', '炭疽病', '斑点病', 'うどんこ病'],
          maxCount: 4,
          usedCount: 1,
          dilution: '1000倍',
          usageTime: '収穫前日まで',
          method: '散布'
        },
        {
          id: 'p-6',
          name: 'アミスター20フロアブル',
          type: '殺菌剤',
          racCode: 'FR 11',
          targetPests: ['うどんこ病', '炭疽病', '灰色かび病'],
          maxCount: 3,
          usedCount: 0,
          dilution: '2000倍',
          usageTime: '収穫前日まで',
          method: '散布'
        },
        {
          id: 'p-7',
          name: 'ラウンドアップマックスロード',
          type: '除草剤',
          racCode: 'HR 9',
          targetPests: ['一年生雑草', '多年生雑草'],
          maxCount: 3,
          usedCount: 0,
          dilution: '100倍',
          usageTime: '定植前または畦間処理',
          method: '散布'
        },
        {
          id: 'p-8',
          name: 'バスタ液剤',
          type: '除草剤',
          racCode: 'HR 10',
          targetPests: ['スギナ', '一年生雑草'],
          maxCount: 3,
          usedCount: 0,
          dilution: '100〜200倍',
          usageTime: '畦間散布',
          method: '散布'
        },
        {
          id: 'p-9',
          name: '展着剤 まくぴか',
          type: 'その他',
          racCode: '展着剤',
          targetPests: ['付着性・浸透性向上'],
          maxCount: 0,
          usedCount: 3,
          dilution: '3000〜5000倍',
          usageTime: '混用時',
          method: '混用'
        }
      ];

      // 過去ログから各農薬の散布回数をカウント
      basePesticides.forEach(p => {
        const count = completedLogs.filter(log => 
          log.memo && log.memo.includes(p.name)
        ).length;
        if (count > 0) p.usedCount = count;
      });

      setPesticides(basePesticides);

    } catch (err) {
      console.error('Error fetching data in cultivations hub:', err);
    } finally {
      setIsLoading(false);
    }
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

  // --- 履歴フィルタリング ---
  const filteredWorkLogs = useMemo(() => {
    return workLogs.filter(log => {
      const isSpray = log.work_type?.includes('農薬') || log.memo?.includes('[散布管理]');
      if (historyTypeFilter === 'sprayOnly' && !isSpray) return false;
      if (historyTypeFilter === 'workOnly' && isSpray) return false;

      if (historySearchQuery.trim()) {
        const q = historySearchQuery.toLowerCase();
        const mType = log.work_type?.toLowerCase().includes(q);
        const mField = log.fields?.name?.toLowerCase().includes(q);
        const mCrop = log.crops?.name?.toLowerCase().includes(q);
        const mMemo = log.memo?.toLowerCase().includes(q);
        if (!mType && !mField && !mCrop && !mMemo) return false;
      }
      return true;
    });
  }, [workLogs, historyTypeFilter, historySearchQuery]);

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

      const recordsToInsert = selectedSprayFieldIds.map(fId => ({
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

  // タスク完了処理
  const handleCompleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('work_logs')
        .update({ status: 'completed' })
        .eq('id', taskId);
      if (error) throw error;
      setToastMessage('予定作業を完了（実績化）しました！');
      fetchAllData();
    } catch (err: any) {
      console.error(err);
      alert('タスク完了の更新に失敗しました');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-36 font-sans">
      
      {/* 統合ヘッダー */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 py-3 sm:px-6">
          
          {/* 最上部：タイトル ＆ 地図ショートカット */}
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                <Sprout className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                  作付け・作業 統合司令塔
                </h1>
                <p className="text-xs font-bold text-slate-400">
                  日々の作付け、散布管理、作業日誌、タスクをワンストップ管理
                </p>
              </div>
            </div>

            <Link
              href="/admin/map"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              <MapIcon className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">作付地図を見る</span>
              <span className="sm:hidden">地図</span>
            </Link>
          </div>

          {/* 4大メインナビゲーションタブ */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 overflow-x-auto">
            
            <button
              type="button"
              onClick={() => setActiveMainTab('cultivations')}
              className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                activeMainTab === 'cultivations'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sprout className="w-4 h-4 text-emerald-600" />
              <span>作付け一覧</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMainTab('spray')}
              className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                activeMainTab === 'spray'
                  ? 'bg-white text-rose-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <FlaskConical className="w-4 h-4 text-rose-600" />
              <span>散布管理 (残回数)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMainTab('history')}
              className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                activeMainTab === 'history'
                  ? 'bg-white text-blue-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <History className="w-4 h-4 text-blue-600" />
              <span>作業・散布履歴</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMainTab('tasks')}
              className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                activeMainTab === 'tasks'
                  ? 'bg-white text-amber-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <CheckSquare className="w-4 h-4 text-amber-600" />
              <span>予定・タスク ({plannedTasks.length})</span>
            </button>

          </div>

        </div>
      </header>

      {/* メインコンテンツ領域 */}
      <main className="max-w-5xl mx-auto px-4 py-4 sm:px-6">
        
        {/* トースト */}
        {toastMessage && (
          <div className="mb-4 p-3.5 bg-emerald-600 text-white rounded-2xl shadow-lg flex items-center gap-2.5 text-sm font-bold animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 1. 作付け一覧 タブ */}
        {/* ========================================================================= */}
        {activeMainTab === 'cultivations' && (
          <div className="space-y-4">
            
            {/* 検索 ＆ 全選択バー */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchCultivationQuery}
                  onChange={(e) => setSearchCultivationQuery(e.target.value)}
                  placeholder="作目名や圃場名で検索..."
                  className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedIds.length === filteredCultivations.length) {
                      setSelectedIds([]);
                    } else {
                      setSelectedIds(filteredCultivations.map(c => c.id));
                    }
                  }}
                  className="px-3 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {selectedIds.length === filteredCultivations.length && filteredCultivations.length > 0 ? (
                    <>
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                      <span>全選択を解除</span>
                    </>
                  ) : (
                    <>
                      <Square className="w-3.5 h-3.5 text-slate-400" />
                      <span>全て選択</span>
                    </>
                  )}
                </button>

                <span className="text-[11px] sm:text-xs text-slate-500 flex items-center gap-1 font-medium">
                  <CheckSquare className="w-3 h-3 text-emerald-600" />
                  チェックした作付けに、まとめて日誌を登録できます
                </span>
              </div>
            </div>

            {/* カードリスト */}
            {isLoading ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mb-3 text-emerald-600" />
                <p className="text-xs font-bold">作付けデータを読み込み中...</p>
              </div>
            ) : filteredCultivations.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-3xl border border-slate-200 p-8 shadow-xs">
                <Sprout className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-700 mb-1">作付けが見つかりません</h3>
                <p className="text-xs text-slate-400">栽培計画表から作付けを登録してください。</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredCultivations.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedIds(prev => 
                          prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
                        );
                      }}
                      className={`relative flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer select-none ${
                        isSelected
                          ? 'bg-emerald-50/70 border-emerald-500 shadow-sm ring-1 ring-emerald-500'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                          isSelected ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-slate-100 border-slate-200 text-slate-500'
                        }`}>
                          <Folder className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                            {item.cropName}
                          </h4>
                          <p className="text-xs text-slate-400 font-medium mt-0.5">
                            {item.startDate}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <div className="text-sm font-bold text-slate-800 flex items-center justify-end gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>{item.fieldName}</span>
                          </div>
                          <div className="text-xs text-slate-500 font-semibold mt-0.5">
                            {item.areaAcre.toFixed(1)} a
                          </div>
                        </div>

                        <div className="pl-2">
                          <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}>
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 7大アクション・ボトムシート */}
            <CultivationActionSheet
              selectedCultivations={selectedCultivationTargets}
              onClearSelection={() => setSelectedIds([])}
              onSuccess={(msg) => {
                setToastMessage(msg);
                fetchAllData();
              }}
            />

          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. 散布管理 タブ */}
        {/* ========================================================================= */}
        {activeMainTab === 'spray' && (
          <div className="space-y-4">
            
            {/* 散布管理ヘッダー（作物選択 ＆ 検索 ＆ カテゴリタブ） */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">対象作目:</span>
                  <select
                    value={selectedSprayCropId}
                    onChange={(e) => setSelectedSprayCropId(e.target.value)}
                    className="px-3 py-1.5 text-xs font-bold bg-rose-50 border border-rose-300 text-rose-900 rounded-xl focus:outline-none"
                  >
                    {crops.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="relative flex-1 max-w-xs">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchSprayQuery}
                    onChange={(e) => setSearchSprayQuery(e.target.value)}
                    placeholder="農薬名・病害虫で検索..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-medium"
                  />
                </div>
              </div>

              {/* 殺虫剤 / 殺菌剤 / 除草剤 / その他 タブ */}
              <div className="grid grid-cols-4 border-b border-slate-200 text-center pt-1">
                {(['殺虫剤', '殺菌剤', '除草剤', 'その他'] as const).map((tab) => {
                  const isActive = sprayCategoryTab === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setSprayCategoryTab(tab)}
                      className={`py-2 text-xs sm:text-sm font-bold transition-all relative ${
                        isActive ? 'text-rose-600 font-extrabold' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {tab}
                      {isActive && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-600 rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>

            </div>

            {/* 農薬カードリスト */}
            <div className="space-y-3">
              {filteredPesticides.map((p) => {
                const isSelected = selectedPesticideIds.includes(p.id);
                const isUnlimited = p.maxCount === 0;
                const remaining = isUnlimited ? 999 : p.maxCount - p.usedCount;
                const isLimitReached = !isUnlimited && remaining <= 0;

                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      if (!isLimitReached) {
                        setSelectedPesticideIds(prev => 
                          prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                        );
                      }
                    }}
                    className={`relative p-4.5 rounded-2xl border transition-all cursor-pointer select-none ${
                      isLimitReached
                        ? 'bg-slate-100/80 border-slate-200 opacity-60 cursor-not-allowed'
                        : isSelected
                        ? 'bg-rose-50/70 border-rose-500 shadow-sm ring-1 ring-rose-500'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2 flex-1 min-w-0">
                        
                        <div className="flex items-baseline justify-between gap-2">
                          <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                            {p.name}
                          </h3>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-bold text-rose-600 mr-2">{p.type}</span>
                            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                              {p.racCode}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-start gap-2 pt-0.5">
                          <span className="shrink-0 text-[11px] font-bold text-white bg-slate-500 px-2 py-0.5 rounded-md">
                            適用病害虫
                          </span>
                          <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed">
                            {p.targetPests.join('、 ')}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span className="shrink-0 text-[11px] font-bold text-white bg-slate-500 px-2 py-0.5 rounded-md">
                            使用方法
                          </span>
                          
                          {isLimitReached ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-rose-100 text-rose-700 border border-rose-300">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              <span>使用上限到達 (残0回)</span>
                            </span>
                          ) : isUnlimited ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
                              <span className="px-1 py-0.2 bg-blue-600 text-white rounded text-[10px]">OK</span>
                              <span>{p.method} 上限なし</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
                              <span className="px-1 py-0.2 bg-blue-600 text-white rounded text-[10px]">OK</span>
                              <span>{p.method} 残り{remaining}回</span>
                            </span>
                          )}

                          <span className="text-xs text-slate-400 font-medium">
                            （希釈: {p.dilution} / {p.usageTime}）
                          </span>
                        </div>

                      </div>

                      <div className="pt-1 pl-2">
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-rose-600 border-rose-600 text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 散布選択アクションバー */}
            {selectedPesticideIds.length > 0 && (
              <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl p-4 animate-in slide-in-from-bottom-5">
                <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-rose-100 text-rose-700 border border-rose-300 rounded-full text-xs font-bold">
                      {selectedPesticideIds.length} 剤選択中
                    </span>
                    <span className="text-xs text-slate-500 hidden sm:inline truncate max-w-sm">
                      {pesticides.filter(p => selectedPesticideIds.includes(p.id)).map(p => p.name).join(' ＋ ')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPesticideIds([])}
                      className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-800"
                    >
                      クリア
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsSprayModalOpen(true)}
                      className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md flex items-center gap-2"
                    >
                      <FlaskConical className="w-4 h-4" />
                      <span>散布日誌を登録</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 散布モーダル */}
            {isSprayModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
                  <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                        <FlaskConical className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">散布記録の確定</h3>
                        <p className="text-xs text-slate-500">選択した農薬を圃場日誌に保存します</p>
                      </div>
                    </div>
                    <button onClick={() => setIsSprayModalOpen(false)} className="p-1.5 rounded-full text-slate-400 hover:text-slate-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveSprayLog} className="p-6 space-y-4 overflow-y-auto">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">散布農薬 (混用)</label>
                      <div className="space-y-1.5">
                        {pesticides.filter(p => selectedPesticideIds.includes(p.id)).map(p => (
                          <div key={p.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800">{p.name} ({p.racCode})</span>
                            <span className="text-slate-500 font-medium">{p.dilution}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">対象圃場 (複数選択可)</label>
                      <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                        {fields.map(f => {
                          const isFSelected = selectedSprayFieldIds.includes(f.id);
                          return (
                            <button
                              type="button"
                              key={f.id}
                              onClick={() => {
                                setSelectedSprayFieldIds(prev => 
                                  prev.includes(f.id) ? prev.filter(id => id !== f.id) : [...prev, f.id]
                                );
                              }}
                              className={`p-2 rounded-lg text-xs font-bold text-left border transition-all flex items-center justify-between ${
                                isFSelected ? 'bg-rose-50 border-rose-400 text-rose-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <span className="truncate">{f.name}</span>
                              {isFSelected && <Check className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">散布日</label>
                      <input
                        type="date"
                        required
                        value={sprayDate}
                        onChange={(e) => setSprayDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">散布水量 (L/10a)</label>
                      <input
                        type="number"
                        value={sprayWaterVolume}
                        onChange={(e) => setSprayWaterVolume(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">備考・メモ</label>
                      <textarea
                        rows={2}
                        value={sprayMemo}
                        onChange={(e) => setSprayMemo(e.target.value)}
                        placeholder="天候、ノズルなど"
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium resize-none"
                      />
                    </div>

                    <div className="pt-3 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setIsSprayModalOpen(false)}
                        className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm"
                      >
                        キャンセル
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingSpray || selectedSprayFieldIds.length === 0}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2"
                      >
                        {isSavingSpray ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        <span>散布実績を確定</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. 作業・散布履歴 タブ */}
        {/* ========================================================================= */}
        {activeMainTab === 'history' && (
          <div className="space-y-4">
            
            {/* 履歴フィルターバー */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  placeholder="作業内容、農薬名、圃場名で検索..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-medium"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setHistoryTypeFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    historyTypeFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  すべて ({workLogs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryTypeFilter('sprayOnly')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    historyTypeFilter === 'sprayOnly' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  農薬散布のみ
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryTypeFilter('workOnly')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    historyTypeFilter === 'workOnly' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  一般作業のみ
                </button>
              </div>
            </div>

            {/* 履歴タイムラインリスト */}
            {filteredWorkLogs.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-3xl border border-slate-200 p-8 shadow-xs">
                <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-700 mb-1">記録が見つかりません</h3>
                <p className="text-xs text-slate-400">条件を変更するか、作付け画面から日誌を登録してください。</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredWorkLogs.map((log) => {
                  const isSpray = log.work_type?.includes('農薬') || log.memo?.includes('[散布管理]');
                  return (
                    <div
                      key={log.id}
                      className={`p-4 rounded-2xl border transition-all bg-white shadow-xs ${
                        isSpray ? 'border-l-4 border-l-rose-500 hover:border-slate-300' : 'border-l-4 border-l-emerald-500 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-slate-500 flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {log.work_date}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                              isSpray ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}>
                              {log.work_type}
                            </span>
                            {log.fields?.name && (
                              <span className="text-xs font-bold text-slate-700 flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                {log.fields.name}
                              </span>
                            )}
                            {log.crops?.name && (
                              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                                {log.crops.name}
                              </span>
                            )}
                          </div>

                          {/* メモ・詳細 */}
                          {log.memo && (
                            <p className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed pt-1 whitespace-pre-wrap">
                              {log.memo}
                            </p>
                          )}

                          {/* 散布時のクイックアクション */}
                          {isSpray && (
                            <div className="pt-2 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setActiveMainTab('spray')}
                                className="text-[11px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 underline"
                              >
                                この農薬の残回数・RACを確認する ➔
                              </button>
                            </div>
                          )}

                        </div>

                        <div className="text-right shrink-0 text-xs text-slate-400 font-semibold flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{log.duration_minutes || 60}分</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

        {/* ========================================================================= */}
        {/* 4. 予定・タスク タブ */}
        {/* ========================================================================= */}
        {activeMainTab === 'tasks' && (
          <div className="space-y-4">
            
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">作業予定・指示一覧</h3>
                <p className="text-xs text-slate-400">実施が完了したタスクは「完了にする」を押すと実績に反映されます</p>
              </div>
              <span className="px-3 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-full text-xs font-bold">
                未完了 {plannedTasks.length} 件
              </span>
            </div>

            {plannedTasks.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-3xl border border-slate-200 p-8 shadow-xs">
                <CheckSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-700 mb-1">予定されている作業はありません</h3>
                <p className="text-xs text-slate-400">作付け一覧のボトムシートから「予定（指示）」を登録できます。</p>
              </div>
            ) : (
              <div className="space-y-3">
                {plannedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-4 rounded-2xl border border-amber-200 bg-amber-50/40 shadow-xs flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-amber-800 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          予定日: {task.work_date}
                        </span>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-xs font-bold">
                          {task.work_type}
                        </span>
                        {task.fields?.name && (
                          <span className="text-xs font-medium text-slate-700 bg-white px-2 py-0.5 rounded border border-amber-200">
                            {task.fields.name}
                          </span>
                        )}
                      </div>
                      {task.memo && (
                        <p className="text-xs text-slate-800 font-medium pt-1">
                          {task.memo}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCompleteTask(task.id)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all shrink-0 flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>完了にする</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

      </main>

    </div>
  );
}

export default function CultivationsHubPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-2" />
      </div>
    }>
      <CultivationsHubContent />
    </Suspense>
  );
}
