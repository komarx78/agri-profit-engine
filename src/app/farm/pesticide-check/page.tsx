"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, Search, AlertTriangle, CheckCircle2, ArrowLeft, Loader2, 
  ChevronDown, ChevronUp, Layers, Zap, Plus, Minus, Trash2, Info, 
  Sparkles, Check, RefreshCw, Eye, BookOpen, AlertOctagon, HelpCircle
} from 'lucide-react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';

interface ActiveIngredient {
  raw: string;
  name: string;
  maxCount: number | null;
  limitDetails: string;
}

interface PesticideRecord {
  name: string;
  type: string;
  applicant: string;
  purpose: string;
  registration_no: string;
  crop_name: string;
  match_type: 'direct' | 'subgroup' | 'broad_group';
  scope_label: string;
  target_pest: string;
  usage_amount: string;
  usage_time: string;
  usage_method: string;
  usage_count: string;
  application_place: string;
  usage_purpose: string;
  spray_amount: string;
  fumigation_time: string;
  fumigation_temp: string;
  applicable_soil: string;
  applicable_region: string;
  applicable_pesticide: string;
  mix_count: string;
  active_ingredients: ActiveIngredient[];
}

interface SimulatorItem {
  id: string;
  pesticide: PesticideRecord;
  plannedCount: number;
}

export default function PesticideCheckPage() {
  // タブ状態: 'search' (カルテ検索) | 'simulator' (成分重複シミュレーター)
  const [activeTab, setActiveTab] = useState<'search' | 'simulator'>('search');

  // 検索フォーム状態
  const [cropName, setCropName] = useState('とうがらし');
  const [pesticideName, setPesticideName] = useState('');
  const [targetPest, setTargetPest] = useState('');
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>('all');
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // カード展開状態
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // シミュレーターに追加された農薬リスト
  const [simulatorList, setSimulatorList] = useState<SimulatorItem[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 自社農薬マスタ（materials）に登録済みの農薬名リスト
  const [registeredMasterNames, setRegisteredMasterNames] = useState<string[]>([]);
  const [isRegisteringMaster, setIsRegisteringMaster] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 自社農薬マスタの既存登録リストを取得
  useEffect(() => {
    const fetchMasterPesticides = async () => {
      try {
        const { data, error } = await supabase
          .from('materials')
          .select('name')
          .or("category.eq.農薬費,material_type.eq.pesticide");

        if (data) {
          setRegisteredMasterNames(data.map(d => d.name));
        }
      } catch (e) {
        console.warn('Failed to fetch existing materials:', e);
      }
    };
    fetchMasterPesticides();
  }, []);

  // ワンクリックで自社農薬マスタ（materials）に登録
  const handleRegisterToMaster = async (p: any) => {
    if (registeredMasterNames.includes(p.name)) {
      showToast(`「${p.name}」は既に自社農薬マスタに登録されています。`);
      return;
    }

    setIsRegisteringMaster(p.name);
    try {
      const pType = (p.purpose && p.purpose !== '-') ? p.purpose : (p.type && p.type !== '-') ? p.type : '殺虫剤';
      const maxCountNum = typeof p.usage_count === 'string' ? parseInt(p.usage_count.match(/\d+/)?.[0] || '4', 10) : 4;

      const { error } = await supabase.from('materials').insert({
        name: p.name,
        category: '農薬費',
        material_type: 'pesticide',
        pesticide_type: pType,
        dilution: p.usage_amount || '',
        target_pests: p.target_pest || '',
        usage_time: p.usage_time || '',
        max_count: maxCountNum,
        unit: '本'
      });

      if (error) throw error;

      setRegisteredMasterNames(prev => [...prev, p.name]);
      showToast(`🎉 「${p.name}」を自社農薬マスタに登録しました！`);
    } catch (err: any) {
      console.error('Master registration error:', err);
      showToast(`⚠️ マスタ登録に失敗しました: ${err.message || 'エラー'}`);
    } finally {
      setIsRegisteringMaster(null);
    }
  };

  // 検索実行
  const handleCheck = async (e?: React.FormEvent, stageOverride?: string) => {
    if (e) e.preventDefault();
    if (!cropName.trim()) return;

    const targetStage = stageOverride !== undefined ? stageOverride : selectedStageFilter;

    setLoading(true);
    setError(null);
    setExpandedCardId(null);

    try {
      const res = await fetch('/api/pesticide-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cropName, 
          pesticideName, 
          targetPest,
          stageFilter: targetStage
        })
      });

      if (!res.ok) {
        let errorMsg = 'データベース検索に失敗しました。';
        try {
          const errData = await res.json();
          if (errData.error) errorMsg = errData.error;
        } catch (e) {}
        throw new Error(errorMsg);
      }

      const data = await res.json();
      setResult(data);
      if (data.activeStage) {
        setSelectedStageFilter(data.activeStage);
      }

      // 履歴保存（バックグラウンド・失敗しても検索結果表示を妨げない）
      try {
        const { data: userData } = await supabase.auth.getUser();
        await supabase.from('pesticide_checks').insert({
          farm_id: '00000000-0000-0000-0000-000000000001',
          user_id: userData?.user?.id || null,
          crop_name: cropName,
          pesticide_name: pesticideName,
          target_pest: targetPest,
          judgment: data.judgment,
          message: data.message
        });
      } catch (insertErr) {
        console.warn('Failed to save search history:', insertErr);
      }

    } catch (err: any) {
      setError(err.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // シミュレーターへの追加 / 削除
  const toggleSimulatorItem = (p: PesticideRecord) => {
    const itemId = `${p.registration_no}_${p.crop_name}_${p.target_pest}_${p.usage_amount}`;
    const exists = simulatorList.some(item => item.id === itemId);

    if (exists) {
      setSimulatorList(prev => prev.filter(item => item.id !== itemId));
      showToast(`「${p.name}」をシミュレーターから解除しました`);
    } else {
      setSimulatorList(prev => [...prev, { id: itemId, pesticide: p, plannedCount: 2 }]);
      showToast(`「${p.name}」をシミュレーターに追加しました！`);
    }
  };

  // 回数変更
  const updatePlannedCount = (id: string, delta: number) => {
    setSimulatorList(prev => prev.map(item => {
      if (item.id === id) {
        const next = Math.max(1, Math.min(10, item.plannedCount + delta));
        return { ...item, plannedCount: next };
      }
      return item;
    }));
  };

  // 有効成分ごとの重複・上限判定ロジック（姜維設計）
  const ingredientSummary = useMemo(() => {
    const map = new Map<string, {
      name: string;
      maxLimit: number;
      totalPlanned: number;
      pesticides: { id: string; name: string; count: number; limitDetails: string }[];
      isOverLimit: boolean;
      limitDetails: string[];
    }>();

    simulatorList.forEach(item => {
      const p = item.pesticide;
      const ings = (p.active_ingredients && p.active_ingredients.length > 0)
        ? p.active_ingredients
        : [{ 
            name: p.type && p.type !== '-' ? p.type : p.name, 
            maxCount: 4, 
            limitDetails: p.usage_count || '4回以内', 
            raw: '' 
          }];

      ings.forEach(ing => {
        const ingName = ing.name;
        if (!map.has(ingName)) {
          map.set(ingName, {
            name: ingName,
            maxLimit: ing.maxCount || 4,
            totalPlanned: 0,
            pesticides: [],
            isOverLimit: false,
            limitDetails: []
          });
        }

        const entry = map.get(ingName)!;
        entry.totalPlanned += item.plannedCount;
        entry.pesticides.push({
          id: item.id,
          name: p.name,
          count: item.plannedCount,
          limitDetails: ing.limitDetails
        });

        if (ing.maxCount && ing.maxCount < entry.maxLimit) {
          entry.maxLimit = ing.maxCount;
        }
        if (ing.limitDetails && !entry.limitDetails.includes(ing.limitDetails)) {
          entry.limitDetails.push(ing.limitDetails);
        }
        entry.isOverLimit = entry.totalPlanned > entry.maxLimit;
      });
    });

    return Array.from(map.values());
  }, [simulatorList]);

  // 全体の超過ステータス
  const hasOverLimit = ingredientSummary.some(ing => ing.isOverLimit);
  const hasAtLimit = ingredientSummary.some(ing => ing.totalPlanned === ing.maxLimit);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-24">
      {/* トースト通知 */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-indigo-600 text-white px-5 py-3 rounded-2xl shadow-xl border border-indigo-400/30 flex items-center gap-3 animate-bounce">
          <Sparkles className="w-5 h-5 text-amber-300" />
          <span className="font-bold text-sm">{toastMessage}</span>
        </div>
      )}

      {/* ヘッダー */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-9 h-9 bg-emerald-500/20 border border-emerald-500/40 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                農薬スマートカルテ & 成分重複ガード
                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  FAMIC公式連動
                </span>
              </h1>
              <p className="text-xs font-semibold text-slate-400">農薬取締法遵守・有効成分（ジノテフラン等）重複検知</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link 
              href="/super-admin/pesticides"
              className="text-xs font-bold text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
            >
              マスタ管理
            </Link>
          </div>
        </div>

        {/* タブナビゲーション */}
        <div className="max-w-5xl mx-auto px-4 flex gap-2 border-t border-slate-800/60 pt-2 pb-2">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeTab === 'search'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Search className="w-4 h-4" />
            ① 農薬スマートカルテ（検索・一覧）
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all relative ${
              activeTab === 'simulator'
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-300" />
            ② 有効成分重複チェッカー＆併用シミュレーター
            {simulatorList.length > 0 && (
              <span className="ml-1 bg-amber-400 text-slate-950 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                {simulatorList.length}
              </span>
            )}
            {hasOverLimit && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping absolute top-1 right-1" />
            )}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* ========================================================================= */}
        {/* タブ①: 農薬スマートカルテ（検索＆一覧） */}
        {/* ========================================================================= */}
        {activeTab === 'search' && (
          <div className="space-y-6">
            {/* 検索カード */}
            <div className="bg-slate-800/60 border border-slate-700/80 rounded-3xl p-6 shadow-xl backdrop-blur-sm">
              <form onSubmit={handleCheck} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-300 mb-1.5">
                      対象作物名 <span className="text-emerald-400 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      value={cropName}
                      onChange={(e) => setCropName(e.target.value)}
                      placeholder="例: とうがらし, トマト, キャベツ"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-300 mb-1.5">
                      農薬名（商品名・任意）
                    </label>
                    <input
                      type="text"
                      value={pesticideName}
                      onChange={(e) => setPesticideName(e.target.value)}
                      placeholder="例: スタークル, アルバリン"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-300 mb-1.5">
                      対象病害虫・雑草名（任意）
                    </label>
                    <input
                      type="text"
                      value={targetPest}
                      onChange={(e) => setTargetPest(e.target.value)}
                      placeholder="例: アブラムシ類, アザミウマ"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={loading || !cropName.trim()}
                    className="w-full md:w-auto flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-8 py-3.5 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        データベース検索中...
                      </>
                    ) : (
                      <>
                        <Search className="w-5 h-5" />
                        農薬カルテを検索・照合する
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* エラー表示 */}
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-center gap-3 text-rose-300 text-sm font-bold">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                {error}
              </div>
            )}

            {/* 検索結果 */}
            {result && (
              <div className="space-y-4">
                {/* サマリーバー */}
                <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-slate-400">検索結果:</span>
                    <span className="text-lg font-black text-white ml-2">
                      {result.pesticides?.length || 0} 件ヒット
                    </span>
                    <span className="text-xs font-bold text-slate-400 ml-3">
                      （直接適用: {result.directCount || 0}件 / 包括適用: {result.groupCount || 0}件）
                    </span>
                  </div>

                  {simulatorList.length > 0 && (
                    <button
                      onClick={() => setActiveTab('simulator')}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black px-4 py-2 rounded-xl transition-all shadow-md shadow-indigo-600/30"
                    >
                      <Zap className="w-4 h-4 text-amber-300" />
                      選択中の農薬（{simulatorList.length}件）の成分重複チェックへ ➔
                    </button>
                  )}
                </div>

                {/* 【方法A：スマート用途・ステージセレクター】 */}
                {result.availableStages && (
                  <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-300 flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-emerald-400" />
                        用途・ステージを選択（農薬取締法 厳格適合）:
                      </span>
                      <span className="text-[11px] font-bold text-slate-400">
                        ※用途によって使える農薬が法律で厳格に異なります
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {result.availableStages.map((st: any) => {
                        const isSelected = selectedStageFilter === st.key;
                        const isZero = st.count === 0;
                        return (
                          <button
                            key={st.key}
                            type="button"
                            onClick={() => {
                              setSelectedStageFilter(st.key);
                              handleCheck(undefined, st.key);
                            }}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                              isSelected
                                ? st.key === 'seed'
                                  ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20 ring-2 ring-amber-300'
                                  : st.key === 'nursery'
                                  ? 'bg-teal-400 text-slate-950 shadow-lg shadow-teal-400/20 ring-2 ring-teal-300'
                                  : 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                                : isZero
                                ? 'bg-slate-900/40 text-slate-500 hover:text-slate-300 border border-slate-800'
                                : 'bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700'
                            }`}
                          >
                            <span>{st.label}</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                              isSelected 
                                ? 'bg-black/20 text-slate-950' 
                                : isZero 
                                ? 'bg-slate-800 text-slate-600' 
                                : 'bg-slate-800 text-slate-400'
                            }`}>
                              {st.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 採種用モード特大アラートバナー */}
                {selectedStageFilter === 'seed' && (
                  <div className="bg-amber-950/40 border border-amber-500/60 rounded-2xl p-4 text-amber-200 flex items-start gap-3 shadow-lg">
                    <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-black text-white">
                        🌱 【農薬取締法完全遵守】採種用（種採り用）専用モード作動中
                      </h4>
                      <p className="text-xs font-bold text-amber-300/80 mt-0.5">
                        種子採取用圃場に登録された農薬のみを表示しています。食用の農薬と混同することなく、安全に適法な防除計画を策定できます。
                      </p>
                    </div>
                  </div>
                )}

                {/* 育苗期モード特大アラートバナー */}
                {selectedStageFilter === 'nursery' && (
                  <div className="bg-teal-950/40 border border-teal-500/60 rounded-2xl p-4 text-teal-200 flex items-start gap-3 shadow-lg">
                    <Sparkles className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-black text-white">
                        🌿 【育苗期・苗床専用モード】
                      </h4>
                      <p className="text-xs font-bold text-teal-300/80 mt-0.5">
                        育苗トレイ潅注、苗床・床土くん蒸、苗立枯病防除など、育苗ステージに適用可能な農薬のみを表示しています。
                      </p>
                    </div>
                  </div>
                )}

                {/* カルテカード一覧 */}
                {result.pesticides && result.pesticides.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {result.pesticides.map((p: any, idx: number) => {
                      const cardId = `${p.registration_no}_${idx}`;
                      const isExpanded = expandedCardId === cardId;
                      const isSelected = simulatorList.some(item => 
                        item.id === `${p.registration_no}_${p.crop_name}_${p.target_pest}_${p.usage_amount}`
                      );

                      return (
                        <div 
                          key={cardId}
                          className={`bg-slate-800/70 border rounded-2xl transition-all overflow-hidden ${
                            isSelected 
                              ? 'border-indigo-500/80 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/50' 
                              : 'border-slate-700/60 hover:border-slate-600'
                          }`}
                        >
                          {/* カードヘッダー */}
                          <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/40">
                            <div>
                              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${
                                  p.match_type === 'direct' 
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                                    : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                                }`}>
                                  {p.scope_label}
                                </span>

                                {p.stage_badge && (
                                  <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${
                                    p.stage_category === 'seed'
                                      ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                                      : p.stage_category === 'nursery'
                                      ? 'bg-teal-400/20 text-teal-300 border-teal-400/40'
                                      : 'bg-slate-700/60 text-slate-300 border-slate-600'
                                  }`}>
                                    {p.stage_badge}
                                  </span>
                                )}

                                <span className="bg-slate-700/80 text-slate-300 text-[11px] font-bold px-2 py-0.5 rounded-md">
                                  登録番号: {p.registration_no}
                                </span>

                                {p.purpose && p.purpose !== '-' && (
                                  <span className="bg-amber-500/20 text-amber-300 text-[11px] font-bold px-2 py-0.5 rounded-md border border-amber-500/30">
                                    {p.purpose}
                                  </span>
                                )}
                              </div>

                              <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                                {p.name}
                                {p.type && p.type !== '-' && (
                                  <span className="text-xs font-bold text-slate-400">
                                    （{p.type}）
                                  </span>
                                )}
                              </h3>
                              <p className="text-xs font-bold text-slate-400 mt-0.5">
                                メーカー・登録者: <span className="text-slate-300">{p.applicant}</span>
                              </p>
                            </div>

                            {/* アクションボタン */}
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              {/* ワンクリック農薬マスタ登録ボタン */}
                              {registeredMasterNames.includes(p.name) ? (
                                <span className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-black bg-emerald-950/60 border border-emerald-500/50 text-emerald-400">
                                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                                  ✓ 自社マスタ登録済
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isRegisteringMaster === p.name}
                                  onClick={() => handleRegisterToMaster(p)}
                                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-slate-950 shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
                                >
                                  {isRegisteringMaster === p.name ? (
                                    <>
                                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                                      登録中...
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="w-4 h-4 text-slate-950" />
                                      自社マスタに登録
                                    </>
                                  )}
                                </button>
                              )}

                              {/* 成分重複チェッカー追加ボタン */}
                              <button
                                type="button"
                                onClick={() => toggleSimulatorItem(p)}
                                className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                                    : 'bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white border border-slate-600'
                                }`}
                              >
                                {isSelected ? (
                                  <>
                                    <Check className="w-4 h-4 text-emerald-400" />
                                    シミュレーター追加中
                                  </>
                                ) : (
                                  <>
                                    <Zap className="w-4 h-4 text-amber-400" />
                                    重複判定に追加
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* 主要スペック・グリッド */}
                          <div className="p-5 bg-slate-900/40 space-y-3">
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 mb-1.5 flex items-center justify-between">
                                <span>適用病害虫・雑草 ({p.target_pests_array?.length || 1}件):</span>
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {p.target_pests_array && p.target_pests_array.length > 0 ? (
                                  p.target_pests_array.map((pest: string, pI: number) => (
                                    <span key={pI} className="text-xs font-black bg-rose-950/60 border border-rose-500/40 text-rose-300 px-2.5 py-1 rounded-lg">
                                      {pest}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-xs font-bold text-rose-400">{p.target_pest}</span>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/50">
                                <p className="text-[10px] font-bold text-slate-400 mb-1">希釈倍数・使用量</p>
                                <p className="text-sm font-black text-white">{p.usage_amount}</p>
                              </div>

                              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/50">
                                <p className="text-[10px] font-bold text-slate-400 mb-1">使用時期（収穫前）</p>
                                <p className="text-sm font-black text-emerald-400">{p.usage_time || '収穫前日まで'}</p>
                              </div>

                              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/50">
                                <p className="text-[10px] font-bold text-slate-400 mb-1">使用方法</p>
                                <p className="text-sm font-black text-cyan-300">{p.usage_method}</p>
                              </div>

                              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/50">
                                <p className="text-[10px] font-bold text-slate-400 mb-1">散布液量(10a)</p>
                                <p className="text-sm font-black text-slate-200">{p.spray_amount || '-'}</p>
                              </div>
                            </div>
                          </div>

                          {/* 有効成分・ステージ制限バッジ */}
                          <div className="px-5 py-3 bg-slate-900/20 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px] font-black text-slate-400 flex items-center gap-1">
                                <Zap className="w-3.5 h-3.5 text-amber-400" />
                                有効成分制限:
                              </span>
                              {p.active_ingredients && p.active_ingredients.length > 0 ? (
                                p.active_ingredients.map((ing: any, i: number) => (
                                  <span 
                                    key={i}
                                    className="bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 text-[11px] font-bold px-2.5 py-0.5 rounded-lg"
                                  >
                                    {ing.raw}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs font-bold text-slate-500">
                                  本剤回数: {p.usage_count}
                                </span>
                              )}
                            </div>

                            <button
                              onClick={() => setExpandedCardId(isExpanded ? null : cardId)}
                              className="text-xs font-bold text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                            >
                              {isExpanded ? '詳細カルテを閉じる' : '病害虫ごとの適用詳細を展開'}
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>

                          {/* 展開された詳細情報 */}
                          {isExpanded && (
                            <div className="p-5 bg-slate-950/60 border-t border-slate-800 space-y-4 text-xs">
                              {p.usages_list && p.usages_list.length > 1 && (
                                <div>
                                  <p className="font-black text-slate-300 mb-2">📋 対象病害虫ごとの適用条件一覧:</p>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                      <thead>
                                        <tr className="border-b border-slate-800 text-slate-500">
                                          <th className="py-2 px-3">対象病害虫</th>
                                          <th className="py-2 px-3">希釈・使用量</th>
                                          <th className="py-2 px-3">使用時期</th>
                                          <th className="py-2 px-3">使用方法</th>
                                          <th className="py-2 px-3">回数</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {p.usages_list.map((u: any, uIdx: number) => (
                                          <tr key={uIdx} className="border-b border-slate-900/60 hover:bg-slate-900/40 text-slate-300">
                                            <td className="py-2 px-3 font-bold text-rose-400">{u.target_pest}</td>
                                            <td className="py-2 px-3">{u.usage_amount}</td>
                                            <td className="py-2 px-3 text-emerald-400">{u.usage_time}</td>
                                            <td className="py-2 px-3 text-cyan-300">{u.usage_method}</td>
                                            <td className="py-2 px-3">{u.usage_count}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2 border-t border-slate-800/60">
                                <div>
                                  <p className="font-bold text-slate-500 mb-0.5">本剤の使用回数制限</p>
                                  <p className="font-black text-slate-200">{p.usage_count || '-'}</p>
                                </div>
                                <div>
                                  <p className="font-bold text-slate-500 mb-0.5">適用場所</p>
                                  <p className="font-black text-slate-200">{p.application_place || '-'}</p>
                                </div>
                                <div>
                                  <p className="font-bold text-slate-500 mb-0.5">使用目的</p>
                                  <p className="font-black text-slate-200">{p.usage_purpose || '-'}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-slate-800/40 border border-slate-700/80 rounded-3xl p-10 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-white">
                        {selectedStageFilter === 'seed' 
                          ? '🌱 採種用（種採り用）専用の登録農薬：0件'
                          : selectedStageFilter === 'nursery'
                          ? '🌿 育苗期専用の登録農薬：0件'
                          : '該当する農薬が見つかりませんでした'}
                      </h4>
                      <p className="text-xs font-bold text-slate-300 max-w-lg mx-auto mt-2 leading-relaxed">
                        {selectedStageFilter === 'seed' 
                          ? '※この作物（たまねぎ等）には「採種用」に限定された登録農薬が存在しないため、農薬取締法上、通常の【🧅 食用（本圃）】登録の農薬が適用可能です。上部の「🧅 食用（本圃）」タブを選択してご確認ください。'
                          : selectedStageFilter === 'nursery'
                          ? '※育苗期に特化した専用農薬は見つかりませんでした。「すべて」または「食用（本圃）」から本圃用農薬をご確認ください。'
                          : result.message}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* タブ②: 有効成分重複チェッカー＆併用シミュレーター */}
        {/* ========================================================================= */}
        {activeTab === 'simulator' && (
          <div className="space-y-6">
            {/* 総合判定ステータスバナー */}
            <div className={`p-6 rounded-3xl border transition-all ${
              hasOverLimit
                ? 'bg-rose-950/40 border-rose-500/60 shadow-xl shadow-rose-950/50'
                : hasAtLimit
                ? 'bg-amber-950/40 border-amber-500/60 shadow-xl shadow-amber-950/50'
                : simulatorList.length > 0
                ? 'bg-emerald-950/40 border-emerald-500/60 shadow-xl shadow-emerald-950/50'
                : 'bg-slate-800/40 border-slate-700/60'
            }`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                    hasOverLimit
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                      : hasAtLimit
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : simulatorList.length > 0
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-slate-700/50 text-slate-400'
                  }`}>
                    {hasOverLimit ? (
                      <AlertOctagon className="w-8 h-8 animate-pulse" />
                    ) : hasAtLimit ? (
                      <AlertTriangle className="w-8 h-8" />
                    ) : simulatorList.length > 0 ? (
                      <CheckCircle2 className="w-8 h-8" />
                    ) : (
                      <HelpCircle className="w-8 h-8" />
                    )}
                  </div>

                  <div>
                    <span className="text-xs font-black tracking-widest text-slate-400 uppercase">
                      Safety Diagnostic Status
                    </span>
                    <h2 className="text-xl font-black text-white tracking-tight">
                      {hasOverLimit ? (
                        <span className="text-rose-400">🚨 有効成分の上限超過（違反リスク）を検知！</span>
                      ) : hasAtLimit ? (
                        <span className="text-amber-300">⚠️ 上限に到達している有効成分があります</span>
                      ) : simulatorList.length > 0 ? (
                        <span className="text-emerald-400">✅ 全ての有効成分が法定上限回数内です（安全）</span>
                      ) : (
                        <span className="text-slate-300">農薬を選択してシミュレーションを開始してください</span>
                      )}
                    </h2>
                    <p className="text-xs font-bold text-slate-400 mt-1">
                      {hasOverLimit
                        ? '同一成分（ジノテフラン等）を含む農薬の合算散布回数が法定基準を超過しています。農薬取締法違反（出荷停止）となるため散布計画を修正してください。'
                        : hasAtLimit
                        ? '今シーズンの上限回数ちょうどに達しています。これ以上の同一成分農薬の追加散布はできません。'
                        : simulatorList.length > 0
                        ? '選択された農薬の組み合わせは、有効成分ごとの総使用回数制限をクリアしています。'
                        : '「① 農薬スマートカルテ」タブから、今シーズン使用予定の農薬を複数選択してください。'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('search')}
                  className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-4 py-3 rounded-xl border border-slate-700 shrink-0 transition-colors"
                >
                  <Plus className="w-4 h-4 text-emerald-400" />
                  農薬を追加検索する
                </button>
              </div>
            </div>

            {/* 2カラムレイアウト: 選択農薬リスト vs 有効成分重複判定メーター */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* 左側: 選択した農薬一覧 (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    使用予定の農薬リスト ({simulatorList.length}剤)
                  </h3>
                  {simulatorList.length > 0 && (
                    <button
                      onClick={() => setSimulatorList([])}
                      className="text-[11px] font-bold text-rose-400 hover:text-rose-300 transition-colors"
                    >
                      すべてクリア
                    </button>
                  )}
                </div>

                {simulatorList.length === 0 ? (
                  <div className="bg-slate-800/40 border border-dashed border-slate-700 rounded-2xl p-8 text-center">
                    <p className="text-xs font-bold text-slate-400">
                      まだ農薬が選択されていません。<br />
                      「① 農薬スマートカルテ」から追加してください。
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {simulatorList.map((item) => (
                      <div 
                        key={item.id}
                        className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 shadow-md"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <span className="text-[10px] font-black bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                              {item.pesticide.crop_name}
                            </span>
                            <h4 className="text-sm font-black text-white mt-1">{item.pesticide.name}</h4>
                            <p className="text-[11px] font-bold text-slate-400">{item.pesticide.target_pest}</p>
                          </div>

                          <button
                            onClick={() => toggleSimulatorItem(item.pesticide)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                            title="削除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* 回数カウンター */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
                          <span className="text-xs font-bold text-slate-400">予定散布回数:</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updatePlannedCount(item.id, -1)}
                              className="w-7 h-7 bg-slate-700 hover:bg-slate-600 rounded-lg flex items-center justify-center text-white font-black text-sm transition-colors"
                            >
                              -
                            </button>
                            <span className="w-8 text-center text-base font-black text-amber-300">
                              {item.plannedCount} <span className="text-[10px] text-slate-400 font-normal">回</span>
                            </span>
                            <button
                              onClick={() => updatePlannedCount(item.id, 1)}
                              className="w-7 h-7 bg-slate-700 hover:bg-slate-600 rounded-lg flex items-center justify-center text-white font-black text-sm transition-colors"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 右側: 有効成分重複判定ゲージ (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  有効成分ごとの合算使用回数 & 重複判定
                </h3>

                {ingredientSummary.length === 0 ? (
                  <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-10 text-center">
                    <Info className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-400">
                      農薬を追加すると、成分ごとの合算制限が自動計算されます
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {ingredientSummary.map((ing, i) => {
                      const percent = Math.min(150, Math.round((ing.totalPlanned / ing.maxLimit) * 100));
                      const isMultiUsed = ing.pesticides.length > 1;

                      return (
                        <div 
                          key={i}
                          className={`p-5 rounded-2xl border transition-all ${
                            ing.isOverLimit 
                              ? 'bg-rose-950/30 border-rose-500/80 shadow-lg shadow-rose-950/40 ring-1 ring-rose-500/50' 
                              : ing.totalPlanned === ing.maxLimit
                              ? 'bg-amber-950/30 border-amber-500/80 shadow-md'
                              : 'bg-slate-800/70 border-slate-700/80'
                          }`}
                        >
                          {/* ヘッダー */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <h4 className="text-base font-black text-white flex items-center gap-2">
                                {ing.name}
                                {isMultiUsed && (
                                  <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-indigo-500/30">
                                    ⚠️ {ing.pesticides.length}剤で重複！
                                  </span>
                                )}
                              </h4>
                            </div>

                            <div className="text-right">
                              <span className={`text-xl font-black ${
                                ing.isOverLimit ? 'text-rose-400' : ing.totalPlanned === ing.maxLimit ? 'text-amber-300' : 'text-emerald-400'
                              }`}>
                                {ing.totalPlanned}
                              </span>
                              <span className="text-xs font-bold text-slate-400 ml-1">
                                / 最大 {ing.maxLimit} 回まで
                              </span>
                            </div>
                          </div>

                          {/* プログレスバー */}
                          <div className="w-full bg-slate-900 rounded-full h-3 mb-3 overflow-hidden p-0.5 border border-slate-700/50">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                ing.isOverLimit 
                                  ? 'bg-rose-500 animate-pulse' 
                                  : ing.totalPlanned === ing.maxLimit 
                                  ? 'bg-amber-400' 
                                  : 'bg-emerald-400'
                              }`}
                              style={{ width: `${Math.min(100, percent)}%` }}
                            />
                          </div>

                          {/* 警告メッセージ or 詳細 */}
                          {ing.isOverLimit ? (
                            <div className="bg-rose-500/20 border border-rose-500/40 rounded-xl p-3 text-xs font-bold text-rose-300 flex items-center gap-2 mb-3">
                              <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
                              <span>
                                【上限超過！】法定上限より <strong>{ing.totalPlanned - ing.maxLimit} 回オーバー</strong> しています！
                              </span>
                            </div>
                          ) : (
                            <div className="text-[11px] font-bold text-slate-400 mb-3 flex items-center justify-between">
                              <span>残り散布可能回数:</span>
                              <span className="text-emerald-400 font-black">
                                あと {ing.maxLimit - ing.totalPlanned} 回
                              </span>
                            </div>
                          )}

                          {/* 構成農薬の内訳 */}
                          <div className="bg-slate-900/60 rounded-xl p-3 space-y-1.5 text-xs">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              この成分を含む選択農薬の内訳:
                            </p>
                            {ing.pesticides.map((p, pIdx) => (
                              <div key={pIdx} className="flex items-center justify-between text-slate-300">
                                <span className="font-bold flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                  {p.name}
                                </span>
                                <span className="font-black text-slate-200">
                                  {p.count} 回 （制限: {p.limitDetails}）
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
