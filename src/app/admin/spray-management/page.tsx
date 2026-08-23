"use client";

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  FlaskConical, 
  Search, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ShieldAlert, 
  ShieldCheck, 
  Check, 
  X, 
  Calendar, 
  MapPin, 
  Sprout,
  Info,
  ChevronDown
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface PesticideDisplayItem {
  id: string;
  name: string;
  type: '殺虫剤' | '殺菌剤' | '除草剤' | 'その他';
  racCode: string; // 例: IR 15, FR 6, HR 1
  targetPests: string[];
  maxCount: number; // 使用可能上限回数 (0なら上限なし)
  usedCount: number; // 今期使用済み回数
  dilution: string; // 希釈倍率 (例: 1000~2000倍)
  usageTime: string; // 収穫前日数等
  method: string; // 散布
}

function SprayManagementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 選択中の作目・圃場
  const [crops, setCrops] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [selectedCropId, setSelectedCropId] = useState<string>('');
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | '殺虫剤' | '殺菌剤' | '除草剤' | 'その他'>('殺虫剤');
  const [searchQuery, setSearchQuery] = useState('');
  
  // 選択された農薬リスト
  const [selectedPesticideIds, setSelectedPesticideIds] = useState<string[]>([]);
  
  // 散布登録モーダル
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [sprayDate, setSprayDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [waterVolume, setWaterVolume] = useState<string>('100'); // 散布水量 (L/10a)
  const [sprayMemo, setSprayMemo] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 農薬リスト（デフォルトマスター + DB連動）
  const [pesticides, setPesticides] = useState<PesticideDisplayItem[]>([]);

  // 初期データ読み込み
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [cropsRes, fieldsRes, workLogsRes, mPesticidesRes] = await Promise.all([
        supabase.from('crops').select('*').order('name'),
        supabase.from('fields').select('*').order('name'),
        supabase.from('work_logs').select('*').like('work_type', '%農薬%'),
        supabase.from('m_pesticides').select('*').limit(100)
      ]);

      const fetchedCrops = cropsRes.data || [];
      const fetchedFields = fieldsRes.data || [];
      const pastSprays = workLogsRes.data || [];
      
      setCrops(fetchedCrops);
      setFields(fetchedFields);

      // URLパラメータがあれば初期設定
      const urlCrop = searchParams.get('cropId');
      const urlField = searchParams.get('fieldId');

      if (urlCrop) {
        setSelectedCropId(urlCrop);
      } else if (fetchedCrops.length > 0) {
        setSelectedCropId(fetchedCrops[0].id);
      }

      if (urlField) {
        setSelectedFieldIds([urlField]);
      } else if (fetchedFields.length > 0) {
        setSelectedFieldIds([fetchedFields[0].id]);
      }

      // 標準農薬マスター（FAMIC及び代表的な農薬）
      const baseList: PesticideDisplayItem[] = [
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
          maxCount: 0, // 上限なし
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
          dilution: '100倍 (畦間・株間処理)',
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

      // 過去の散布履歴から使用回数を集計
      baseList.forEach(p => {
        const matchingLogs = pastSprays.filter(log => 
          log.memo && log.memo.includes(p.name)
        );
        if (matchingLogs.length > 0) {
          p.usedCount = matchingLogs.length;
        }
      });

      setPesticides(baseList);

    } catch (err) {
      console.error('Error fetching spray data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // トースト通知
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // フィルタリング
  const filteredPesticides = useMemo(() => {
    return pesticides.filter(p => {
      // タブフィルター
      if (activeTab !== 'all' && p.type !== activeTab) {
        return false;
      }
      // 検索フィルター
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesPest = p.targetPests.some(pest => pest.toLowerCase().includes(q));
        const matchesRac = p.racCode.toLowerCase().includes(q);
        if (!matchesName && !matchesPest && !matchesRac) return false;
      }
      return true;
    });
  }, [pesticides, activeTab, searchQuery]);

  // 選択トグル
  const handleTogglePesticide = (id: string) => {
    setSelectedPesticideIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // 散布登録実行
  const handleSaveSpray = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPesticideIds.length === 0 || selectedFieldIds.length === 0) {
      alert('圃場と農薬を選択してください');
      return;
    }

    setIsSaving(true);
    try {
      const selectedPesticideObjects = pesticides.filter(p => selectedPesticideIds.includes(p.id));
      const pesticideNames = selectedPesticideObjects.map(p => `${p.name}(${p.dilution})`).join(' ＋ ');
      const racCodes = selectedPesticideObjects.map(p => p.racCode).join(', ');

      const timestamp = new Date().toISOString();

      // 各圃場ごとに work_logs へ Insert
      const recordsToInsert = selectedFieldIds.map(fId => ({
        field_id: fId,
        crop_id: selectedCropId || null,
        work_date: sprayDate,
        work_type: '農薬散布',
        duration_minutes: 60,
        status: 'completed',
        memo: `[散布管理] 使用農薬: ${pesticideNames} | RAC: ${racCodes} | 散布水量: ${waterVolume}L/10a | ${sprayMemo}`.trim(),
        created_at: timestamp
      }));

      const { error } = await supabase.from('work_logs').insert(recordsToInsert);
      if (error) throw error;

      setToastMessage(`${selectedFieldIds.length}箇所の圃場に ${selectedPesticideObjects.length}種の農薬散布を記録しました！`);
      setIsSubmitModalOpen(false);
      setSelectedPesticideIds([]);
      fetchData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || '散布登録に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const tabs: ('殺虫剤' | '殺菌剤' | '除草剤' | 'その他')[] = ['殺虫剤', '殺菌剤', '除草剤', 'その他'];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-36 font-sans">
      
      {/* 上部ヘッダー */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:px-6">
          
          {/* タイトル ＆ 戻るリンク */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Link 
                href="/admin/cultivations"
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-rose-600" />
                <span>散布管理</span>
              </h1>
            </div>

            {/* 対象作目セレクター */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 hidden sm:inline">対象作目:</span>
              <select
                value={selectedCropId}
                onChange={(e) => setSelectedCropId(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {crops.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 検索バー */}
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="農薬名、適用病害虫、RACコードで検索..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium transition-all"
            />
          </div>

          {/* カテゴリタブ（殺虫剤・殺菌剤・除草剤・その他） */}
          <div className="grid grid-cols-4 border-b border-slate-200 text-center">
            {tabs.map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-2 text-xs sm:text-sm font-bold transition-all relative ${
                    isActive
                      ? 'text-rose-600 font-extrabold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-600 rounded-full animate-in fade-in" />
                  )}
                </button>
              );
            })}
          </div>

        </div>
      </header>

      {/* メインリスト */}
      <main className="max-w-4xl mx-auto px-4 py-4 sm:px-6">
        
        {/* トースト */}
        {toastMessage && (
          <div className="mb-4 p-3.5 bg-emerald-600 text-white rounded-2xl shadow-lg flex items-center gap-2.5 text-sm font-bold animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-rose-600" />
            <p className="text-xs font-bold">農薬台帳および散布履歴を照合中...</p>
          </div>
        ) : filteredPesticides.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-3xl border border-slate-200 p-8 shadow-xs">
            <FlaskConical className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-700 mb-1">農薬が見つかりません</h3>
            <p className="text-xs text-slate-400">検索条件を変更するか、別のカテゴリタブをお選びください。</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPesticides.map((p) => {
              const isSelected = selectedPesticideIds.includes(p.id);
              const isUnlimited = p.maxCount === 0;
              const remaining = isUnlimited ? 999 : p.maxCount - p.usedCount;
              const isLimitReached = !isUnlimited && remaining <= 0;

              return (
                <div
                  key={p.id}
                  onClick={() => !isLimitReached && handleTogglePesticide(p.id)}
                  className={`relative p-4.5 rounded-2xl border transition-all cursor-pointer select-none ${
                    isLimitReached
                      ? 'bg-slate-100/80 border-slate-200 opacity-60 cursor-not-allowed'
                      : isSelected
                      ? 'bg-rose-50/70 border-rose-500 shadow-sm ring-1 ring-rose-500'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    
                    {/* 左側：農薬名・適用病害虫・使用方法 */}
                    <div className="space-y-2 flex-1 min-w-0">
                      
                      {/* 農薬名 ＆ RACコード */}
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

                      {/* 適用病害虫 */}
                      <div className="flex items-start gap-2 pt-0.5">
                        <span className="shrink-0 text-[11px] font-bold text-white bg-slate-500 px-2 py-0.5 rounded-md">
                          適用病害虫
                        </span>
                        <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed">
                          {p.targetPests.join('、 ')}
                        </p>
                      </div>

                      {/* 使用方法 ＆ 残使用回数バッジ */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="shrink-0 text-[11px] font-bold text-white bg-slate-500 px-2 py-0.5 rounded-md">
                          使用方法
                        </span>
                        
                        {/* 残り回数判定バッジ */}
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

                    {/* 右側：チェックボックス */}
                    <div className="pt-1 pl-2">
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-rose-600 border-rose-600 text-white'
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

      </main>

      {/* 下部固定アクションバー（農薬選択時） */}
      {selectedPesticideIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl p-4 animate-in slide-in-from-bottom-5">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-rose-100 text-rose-700 border border-rose-300 rounded-full text-xs font-bold">
                {selectedPesticideIds.length} 剤選択中
              </span>
              <span className="text-xs text-slate-500 hidden sm:inline truncate max-w-xs">
                {pesticides.filter(p => selectedPesticideIds.includes(p.id)).map(p => p.name).join(' ＋ ')}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedPesticideIds([])}
                className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
              >
                クリア
              </button>
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(true)}
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
              >
                <FlaskConical className="w-4 h-4" />
                <span>散布日誌を登録</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 散布登録モーダル */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                  <FlaskConical className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">散布記録の確定</h3>
                  <p className="text-xs text-slate-500">選択した農薬を圃場の作業日誌に保存します</p>
                </div>
              </div>
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSpray} className="p-6 space-y-4 overflow-y-auto">
              
              {/* 選択中の農薬プレビュー */}
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

              {/* 対象圃場の複数選択 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">対象圃場</label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  {fields.map(f => {
                    const isFSelected = selectedFieldIds.includes(f.id);
                    return (
                      <button
                        type="button"
                        key={f.id}
                        onClick={() => {
                          setSelectedFieldIds(prev => 
                            prev.includes(f.id) ? prev.filter(id => id !== f.id) : [...prev, f.id]
                          );
                        }}
                        className={`p-2 rounded-lg text-xs font-bold text-left border transition-all flex items-center justify-between ${
                          isFSelected
                            ? 'bg-rose-50 border-rose-400 text-rose-800'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="truncate">{f.name}</span>
                        {isFSelected && <Check className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 散布日 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">散布日</label>
                <input
                  type="date"
                  required
                  value={sprayDate}
                  onChange={(e) => setSprayDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                />
              </div>

              {/* 散布水量 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">散布水量 (L/10a)</label>
                <input
                  type="number"
                  value={waterVolume}
                  onChange={(e) => setWaterVolume(e.target.value)}
                  placeholder="例: 100"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                />
              </div>

              {/* メモ */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">散布メモ</label>
                <textarea
                  rows={2}
                  value={sprayMemo}
                  onChange={(e) => setSprayMemo(e.target.value)}
                  placeholder="天候、ノズル種類、散布機など"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium resize-none"
                />
              </div>

              {/* 送信ボタン */}
              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-100 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSaving || selectedFieldIds.length === 0}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>保存中...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>散布実績を確定保存</span>
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}

export default function SprayManagementPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-rose-600 mb-2" />
      </div>
    }>
      <SprayManagementContent />
    </Suspense>
  );
}

