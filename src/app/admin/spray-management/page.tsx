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
  ChevronDown,
  ExternalLink,
  Zap
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '@/lib/tenant';
import { getJSTDate } from '@/lib/dateUtils';
import Link from 'next/link';

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
  scopeLabel: string;
  activeIngredients: any[];
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
  const [isPesticidesLoading, setIsPesticidesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | '殺虫剤' | '殺菌剤' | '除草剤' | 'その他'>('殺虫剤');
  const [searchQuery, setSearchQuery] = useState('');
  
  // 選択された農薬リスト
  const [selectedPesticideIds, setSelectedPesticideIds] = useState<string[]>([]);
  
  // 散布登録モーダル
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [sprayDate, setSprayDate] = useState<string>(() => getJSTDate());
  const [waterVolume, setWaterVolume] = useState<string>('100');
  const [sprayMemo, setSprayMemo] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 農薬リスト（FAMIC本番DB連動）
  const [pesticides, setPesticides] = useState<PesticideDisplayItem[]>([]);

  // 1. 作目・圃場・散布履歴の初期読み込み
  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) {
        setIsLoading(false);
        return;
      }

      const [cropsRes, fieldsRes] = await Promise.all([
        supabase.from('crops').select('*').eq('user_id', tenantId).order('name'),
        supabase.from('fields').select('*').eq('user_id', tenantId).order('name')
      ]);

      const fetchedCrops = cropsRes.data || [];
      const fetchedFields = fieldsRes.data || [];
      
      setCrops(fetchedCrops);
      setFields(fetchedFields);

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

    } catch (err) {
      console.error('Error fetching initial spray data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. 作目が選択されたら、FAMICデータベースから本物の適用農薬を取得
  const fetchPesticidesForCrop = async (cropName: string) => {
    if (!cropName) return;
    setIsPesticidesLoading(true);
    try {
      const tenantId = await getCurrentTenantId();
      // 過去の自社散布履歴を取得（使用回数計算用）
      let sprayQuery = supabase
        .from('work_logs')
        .select('*')
        .like('work_type', '%農薬%');

      if (tenantId) {
        sprayQuery = sprayQuery.eq('user_id', tenantId);
      }

      const { data: pastSprays } = await sprayQuery;

      // 本番APIから作物の適用農薬を全件取得
      const res = await fetch('/api/pesticide-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cropName })
      });

      if (!res.ok) throw new Error('農薬マスタの取得に失敗しました');
      const data = await res.json();
      const rawList = data.pesticides || [];

      // 用途（殺虫剤・殺菌剤・除草剤・その他）の自動判定マッピング
      const mapped: PesticideDisplayItem[] = rawList.map((p: any, idx: number) => {
        let cat: '殺虫剤' | '殺菌剤' | '除草剤' | 'その他' = 'その他';
        const purposeStr = p.purpose || p.type || '';
        if (purposeStr.includes('殺虫') || purposeStr.includes('殺ダニ')) cat = '殺虫剤';
        else if (purposeStr.includes('殺菌')) cat = '殺菌剤';
        else if (purposeStr.includes('除草')) cat = '除草剤';
        else if (purposeStr.includes('展着') || purposeStr.includes('植物成長')) cat = 'その他';
        else {
          // 名称や害虫名からの類推
          if (p.target_pest?.includes('虫') || p.target_pest?.includes('ダニ')) cat = '殺虫剤';
          else if (p.target_pest?.includes('病') || p.target_pest?.includes('菌')) cat = '殺菌剤';
          else if (p.target_pest?.includes('草')) cat = '除草剤';
        }

        // 使用回数のパース
        let maxCount = 0;
        const countMatch = (p.usage_count || '').match(/(\d+)回/);
        if (countMatch) maxCount = parseInt(countMatch[1], 10);

        // 過去ログとの突合
        let usedCount = 0;
        if (pastSprays) {
          usedCount = pastSprays.filter(log => log.memo && log.memo.includes(p.name)).length;
        }

        // RACコード / 有効成分名
        const firstIng = p.active_ingredients?.[0]?.name || p.type || '-';

        return {
          id: `${p.registration_no}_${idx}`,
          name: p.name,
          type: cat,
          racCode: firstIng,
          targetPests: [p.target_pest],
          maxCount,
          usedCount,
          dilution: p.usage_amount,
          usageTime: p.usage_time,
          method: p.usage_method,
          scopeLabel: p.scope_label || '',
          activeIngredients: p.active_ingredients || []
        };
      });

      setPesticides(mapped);
    } catch (err) {
      console.error('Error fetching pesticides for crop:', err);
    } finally {
      setIsPesticidesLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // 選択作物が変わったら農薬リストを再ロード
  useEffect(() => {
    if (selectedCropId && crops.length > 0) {
      const selectedCrop = crops.find(c => c.id === selectedCropId);
      if (selectedCrop) {
        fetchPesticidesForCrop(selectedCrop.name);
      }
    }
  }, [selectedCropId, crops]);

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
      if (activeTab !== 'all' && p.type !== activeTab) {
        return false;
      }
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
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('農園テナントIDが特定できませんでした');

      const selectedPesticideObjects = pesticides.filter(p => selectedPesticideIds.includes(p.id));
      const pesticideNames = selectedPesticideObjects.map(p => `${p.name}(${p.dilution})`).join(' ＋ ');
      const racCodes = selectedPesticideObjects.map(p => p.racCode).join(', ');

      const timestamp = new Date().toISOString();

      const recordsToInsert = selectedFieldIds.map(fId => ({
        user_id: tenantId,
        field_id: fId,
        crop_id: selectedCropId || null,
        work_date: sprayDate,
        work_type: '農薬散布',
        duration_minutes: 60,
        status: 'completed',
        memo: `[散布管理] 使用農薬: ${pesticideNames} | 有効成分: ${racCodes} | 散布水量: ${waterVolume}L/10a | ${sprayMemo}`.trim(),
        created_at: timestamp
      }));

      const { error } = await supabase.from('work_logs').insert(recordsToInsert);
      if (error) throw error;

      setToastMessage(`${selectedFieldIds.length}箇所の圃場に ${selectedPesticideObjects.length}種の農薬散布を記録しました！`);
      setIsSubmitModalOpen(false);
      setSelectedPesticideIds([]);
      
      const selectedCrop = crops.find(c => c.id === selectedCropId);
      if (selectedCrop) fetchPesticidesForCrop(selectedCrop.name);
    } catch (err: any) {
      console.error(err);
      alert(err.message || '散布登録に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const tabs: ('殺虫剤' | '殺菌剤' | '除草剤' | 'その他')[] = ['殺虫剤', '殺菌剤', '除草剤', 'その他'];
  const currentCrop = crops.find(c => c.id === selectedCropId);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-36 font-sans">
      
      {/* 上部ヘッダー */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:px-6">
          
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Link 
                href="/admin/cultivations"
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                  <FlaskConical className="w-5 h-5 text-rose-600" />
                  <span>散布管理</span>
                  <span className="text-xs font-bold bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full border border-rose-200">
                    FAMICマスタ連動
                  </span>
                </h1>
              </div>
            </div>

            {/* 対象作目セレクター ＆ カルテリンク */}
            <div className="flex items-center gap-3">
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

              <Link
                href="/farm/pesticide-check"
                className="hidden md:flex items-center gap-1 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-xl border border-indigo-200 transition-colors"
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                重複シミュレーター
              </Link>
            </div>
          </div>

          {/* 検索バー */}
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="農薬名、適用病害虫、有効成分名で検索..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium transition-all"
            />
          </div>

          {/* カテゴリタブ */}
          <div className="grid grid-cols-4 border-b border-slate-200 text-center">
            {tabs.map((tab) => {
              const isActive = activeTab === tab;
              const count = pesticides.filter(p => p.type === tab).length;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-2 text-xs sm:text-sm font-bold transition-all relative flex items-center justify-center gap-1 ${
                    isActive
                      ? 'text-rose-600 font-extrabold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>{tab}</span>
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded-full">
                    {count}
                  </span>
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
        
        {toastMessage && (
          <div className="mb-4 p-3.5 bg-emerald-600 text-white rounded-2xl shadow-lg flex items-center gap-2.5 text-sm font-bold animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {isPesticidesLoading ? (
          <div className="py-20 text-center">
            <Loader2 className="w-8 h-8 text-rose-500 animate-spin mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-600">
              「{currentCrop?.name}」のFAMIC登録農薬マスターを取得中...
            </p>
          </div>
        ) : filteredPesticides.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-8 shadow-xs">
            <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">該当する農薬が見つかりませんでした</p>
            <p className="text-xs text-slate-400 mt-1">
              作目「{currentCrop?.name}」または検索条件を変更してお試しください
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPesticides.map((p) => {
              const isSelected = selectedPesticideIds.includes(p.id);
              const isOverLimit = p.maxCount > 0 && p.usedCount >= p.maxCount;

              return (
                <div
                  key={p.id}
                  onClick={() => handleTogglePesticide(p.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer select-none bg-white ${
                    isSelected
                      ? 'border-rose-500 shadow-md ring-2 ring-rose-500/20 bg-rose-50/10'
                      : 'border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[10px] font-extrabold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                          {p.racCode}
                        </span>
                        {p.scopeLabel && (
                          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200">
                            {p.scopeLabel}
                          </span>
                        )}
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                          p.type === '殺虫剤' ? 'bg-amber-100 text-amber-800' :
                          p.type === '殺菌剤' ? 'bg-sky-100 text-sky-800' :
                          p.type === '除草剤' ? 'bg-emerald-100 text-emerald-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {p.type}
                        </span>
                      </div>

                      <h3 className="text-base font-black text-slate-900 leading-tight">
                        {p.name}
                      </h3>

                      <p className="text-xs text-slate-600 font-medium mt-1">
                        <span className="font-bold text-slate-400 mr-1">適用:</span>
                        {p.targetPests.join(', ')}
                      </p>

                      <div className="flex items-center gap-4 mt-2 text-xs font-bold text-slate-500">
                        <span>希釈: <strong className="text-slate-700">{p.dilution}</strong></span>
                        <span>時期: <strong className="text-slate-700">{p.usageTime}</strong></span>
                        <span>方法: <strong className="text-slate-700">{p.method}</strong></span>
                      </div>
                    </div>

                    {/* チェックボックス */}
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all mt-1 ${
                      isSelected
                        ? 'bg-rose-600 border-rose-600 text-white'
                        : 'border-slate-300 bg-slate-50'
                    }`}>
                      {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>

      {/* 下部固定バー（選択中の農薬と散布登録ボタン） */}
      {selectedPesticideIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 p-4 z-40 shadow-2xl animate-in slide-in-from-bottom-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-slate-500">選択中の農薬</p>
              <p className="text-base font-black text-slate-900">
                {selectedPesticideIds.length} 剤選択中
              </p>
            </div>

            <button
              onClick={() => setIsSubmitModalOpen(true)}
              className="bg-rose-600 hover:bg-rose-700 text-white font-black px-6 py-3 rounded-xl shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2 text-sm"
            >
              <FlaskConical className="w-4 h-4" />
              散布実績を記録する
            </button>
          </div>
        </div>
      )}

      {/* 散布実績 登録モーダル */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-rose-600" />
                散布実績の登録
              </h3>
              <button 
                onClick={() => setIsSubmitModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSpray} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">散布日</label>
                <input
                  type="date"
                  value={sprayDate}
                  onChange={(e) => setSprayDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">対象圃場（複数選択可）</label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200">
                  {fields.map(f => {
                    const isChecked = selectedFieldIds.includes(f.id);
                    return (
                      <button
                        type="button"
                        key={f.id}
                        onClick={() => {
                          setSelectedFieldIds(prev => 
                            isChecked ? prev.filter(id => id !== f.id) : [...prev, f.id]
                          );
                        }}
                        className={`p-2 rounded-lg text-xs font-bold text-left border transition-all ${
                          isChecked
                            ? 'bg-rose-50 border-rose-300 text-rose-800'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        {f.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">散布水量 (L/10a)</label>
                <input
                  type="number"
                  value={waterVolume}
                  onChange={(e) => setWaterVolume(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">作業メモ</label>
                <input
                  type="text"
                  value={sprayMemo}
                  onChange={(e) => setSprayMemo(e.target.value)}
                  placeholder="例: 動噴散布、風微弱"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSaving || selectedFieldIds.length === 0}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-3 rounded-xl shadow-lg shadow-rose-600/30 transition-all disabled:opacity-50"
                >
                  {isSaving ? '登録中...' : '散布実績を日誌に記録'}
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-rose-600 animate-spin" />
      </div>
    }>
      <SprayManagementContent />
    </Suspense>
  );
}
