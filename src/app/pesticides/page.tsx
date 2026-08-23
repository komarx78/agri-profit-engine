"use client";

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Search, AlertTriangle, CheckCircle2, ArrowLeft, Loader2, Save, ChevronDown, ChevronUp, Settings2, FlaskConical, ExternalLink, Plus, Check, LayoutGrid, Table as TableIcon } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function PesticidesHubPage() {
  const [cropName, setCropName] = useState('');
  const [pesticideName, setPesticideName] = useState('');
  const [targetPest, setTargetPest] = useState('');
  const [usageAmount, setUsageAmount] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // 自社登録済み農薬マスタ
  const [adoptedPesticideNames, setAdoptedPesticideNames] = useState<string[]>([]);
  const [isAdopting, setIsAdopting] = useState<string | null>(null);

  const fetchAdoptedPesticides = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return;

      const { data } = await supabase
        .from('materials')
        .select('name')
        .eq('user_id', userId)
        .or('material_type.eq.pesticide,category.eq.農薬費');

      if (data) {
        setAdoptedPesticideNames(data.map(d => d.name));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAdoptedPesticides();
  }, []);

  // 自社農薬マスタへワンタップ登録
  const handleAdoptPesticide = async (pesticideInfo: any) => {
    const pName = pesticideInfo.name || pesticideName;
    setIsAdopting(pName);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        alert('ログインが必要です');
        return;
      }

      // 使用回数のパース (例: "3回以内" -> 3)
      let parsedCount = 3;
      if (pesticideInfo.usage_count) {
        const match = String(pesticideInfo.usage_count).match(/\d+/);
        if (match) parsedCount = parseInt(match[0], 10);
      }

      const newRecord = {
        user_id: userId,
        name: pName,
        material_type: 'pesticide',
        category: '農薬費',
        pesticide_type: pesticideInfo.type?.includes('殺菌') ? '殺菌剤' : pesticideInfo.type?.includes('除草') ? '除草剤' : '殺虫剤',
        rac_code: pesticideInfo.rac_code || '',
        dilution: pesticideInfo.usage_amount || '1000倍',
        target_pests: pesticideInfo.target_pest || '',
        usage_time: pesticideInfo.usage_time || '収穫前日まで',
        max_count: parsedCount,
        unit: '本',
        default_price: 0
      };

      const { error: insertErr } = await supabase.from('materials').insert([newRecord]);
      if (insertErr) throw insertErr;

      setAdoptedPesticideNames(prev => [...prev, pName]);
      setToastMessage(`「${pName}」を自社農薬マスタに登録しました！`);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      console.error(err);
      alert('マスタ登録に失敗しました: ' + err.message);
    } finally {
      setIsAdopting(null);
    }
  };

  // テーブル詳細・カラム表示設定
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [showColumns, setShowColumns] = useState({
    target_pest: true,
    usage_amount: true,
    usage_time: true,
    usage_method: true,
    usage_count: true,
    type: false,
    applicant: false
  });

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setExpandedRow(null);

    try {
      const res = await fetch('/api/pesticide-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cropName,
          pesticideName,
          targetPest,
          usageAmount
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '判定処理に失敗しました');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-24 font-sans">
      {/* 上部ヘッダー */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link 
              href="/"
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1.5 font-bold text-sm"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>ダッシュボードへ</span>
            </Link>
            <div className="h-6 w-px bg-slate-200"></div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-teal-100 text-teal-700 rounded-xl">
                <FlaskConical className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-black text-slate-800 leading-tight">農薬検索・適正使用チェッカー</h1>
                <p className="text-xs font-bold text-slate-400">FAMIC（農林水産消費安全技術センター）公式登録データベース連動</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/portal"
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl transition-colors flex items-center gap-1"
            >
              <span>ポータル</span>
            </Link>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* 左カラム：検索入力フォーム */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 font-black text-slate-800 text-base mb-6 border-b border-slate-100 pb-4">
                <Search className="w-5 h-5 text-teal-600" />
                <span>判定・検索条件の入力</span>
              </div>

              <form onSubmit={handleCheck} className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-600 mb-1.5">
                    栽培作物名 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="例: トマト、イチゴ、キャベツ、白菜"
                    value={cropName}
                    onChange={(e) => setCropName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white transition-all shadow-inner"
                  />
                  <p className="text-[11px] font-bold text-slate-400 mt-1">※ 漢字・ひらがな・カタカナに対応しています</p>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-600 mb-1.5">
                    使用する農薬名（商品名） <span className="text-slate-400 font-normal">(任意 - 空欄で全件検索)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="例: ダコニール、アファーム、コロマイト（空欄可）"
                    value={pesticideName}
                    onChange={(e) => setPesticideName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white transition-all shadow-inner"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-600 mb-1.5">
                      対象病害虫・雑草 <span className="text-slate-400 font-normal">(任意)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="例: うどんこ病、アザミウマ"
                      value={targetPest}
                      onChange={(e) => setTargetPest(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-600 mb-1.5">
                      予定使用量・希釈倍数 <span className="text-slate-400 font-normal">(任意)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="例: 1000倍、100ml"
                      value={usageAmount}
                      onChange={(e) => setUsageAmount(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading || !cropName.trim()}
                    className="w-full py-4 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-200 text-white font-black text-base rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                    <span>{pesticideName.trim() ? '適正使用を判定・検索する' : `「${cropName || '作物'}」の登録農薬を検索する`}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* FAMIC 公式データ案内カード */}
            <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-3xl">
              <h3 className="text-xs font-black text-emerald-900 mb-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                登録農薬・適用基準について
              </h3>
              <p className="text-xs text-emerald-800 font-bold leading-relaxed">
                本システムは農林水産省・FAMICに正式登録されている農薬適用データを参照し、指定した作物への適用可否、希釈倍数、収穫前使用日数、総使用可能回数を瞬時に判定します。
              </p>
            </div>
          </div>

          {/* 右カラム：判定結果・適用一覧テーブル */}
          <div className="lg:col-span-7 space-y-6">
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl font-bold text-sm flex items-center gap-2 animate-in fade-in">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {!result && !loading && !error && (
              <div className="bg-white rounded-3xl border border-slate-200 border-dashed p-16 text-center text-slate-400 space-y-3">
                <FlaskConical className="w-12 h-12 mx-auto text-slate-300" />
                <p className="font-black text-base text-slate-600">判定したい作物名を入力してください</p>
                <p className="text-xs font-bold text-slate-400">農薬名が空欄の場合は、その作付けに使える農薬が一覧表示されます</p>
              </div>
            )}

            {loading && (
              <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center text-slate-500 space-y-4 shadow-sm">
                <Loader2 className="w-10 h-10 animate-spin mx-auto text-teal-600" />
                <p className="font-black text-base text-slate-700">FAMIC登録データベースを照合中...</p>
                <p className="text-xs font-bold text-slate-400">表記の揺らぎ（ひらがな・カタカナ）を含めて適用基準を検索しています</p>
              </div>
            )}

            {result && (
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6 animate-in fade-in">
                
                {/* 判定バッジとステータス */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl flex items-center justify-center ${
                      result.status === 'success' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : result.status === 'warning'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}>
                      {result.status === 'success' ? (
                        <CheckCircle2 className="w-7 h-7" />
                      ) : (
                        <AlertTriangle className="w-7 h-7" />
                      )}
                    </div>
                    <div>
                      <span className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-full inline-block mb-1 ${
                        result.status === 'success' ? 'bg-emerald-100 text-emerald-800' :
                        result.status === 'warning' ? 'bg-amber-100 text-amber-800' :
                        'bg-rose-100 text-rose-800'
                      }`}>
                        {result.status === 'success' ? (pesticideName.trim() ? '使用可能（適用あり）' : '検索完了') : result.status === 'warning' ? '要確認（条件不一致の可能性）' : '適用外 / 未登録'}
                      </span>
                      <h2 className="text-lg font-black text-slate-800 leading-tight">
                        {pesticideName.trim() ? `${cropName} × ${pesticideName}` : `${cropName} の登録農薬一覧`}
                      </h2>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    {pesticideName.trim() && (
                      adoptedPesticideNames.includes(pesticideName) ? (
                        <span className="text-xs font-black bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-xl flex items-center gap-1 border border-emerald-200">
                          <Check className="w-4 h-4 text-emerald-600" />
                          自社マスタ採用済み
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={isAdopting === pesticideName}
                          onClick={() => handleAdoptPesticide(result.pesticides?.[0] || { name: pesticideName })}
                          className="text-xs font-black bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                        >
                          {isAdopting === pesticideName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                          <span>自社農薬マスタに登録</span>
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* 判定レポート文 */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm font-bold text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {result.message}
                </div>

                {/* 表示切替 ＆ カラム設定バー */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-700">表示形式:</span>
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setViewMode('cards')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                          viewMode === 'cards' 
                            ? 'bg-white text-teal-700 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span>見やすいカード一覧</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('table')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                          viewMode === 'table' 
                            ? 'bg-white text-teal-700 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <TableIcon className="w-3.5 h-3.5" />
                        <span>表形式</span>
                      </button>
                    </div>
                  </div>

                  {viewMode === 'table' && (
                    <button
                      type="button"
                      onClick={() => setShowColumnSettings(!showColumnSettings)}
                      className="text-xs font-bold text-slate-500 hover:text-teal-600 flex items-center gap-1 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 self-start sm:self-auto"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                      <span>列の表示設定</span>
                    </button>
                  )}
                </div>

                {viewMode === 'table' && showColumnSettings && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold text-slate-700">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={showColumns.target_pest} onChange={e => setShowColumns({...showColumns, target_pest: e.target.checked})} className="rounded text-teal-600" />
                      <span>対象病害虫</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={showColumns.usage_amount} onChange={e => setShowColumns({...showColumns, usage_amount: e.target.checked})} className="rounded text-teal-600" />
                      <span>希釈倍数/使用量</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={showColumns.usage_time} onChange={e => setShowColumns({...showColumns, usage_time: e.target.checked})} className="rounded text-teal-600" />
                      <span>使用時期</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={showColumns.usage_method} onChange={e => setShowColumns({...showColumns, usage_method: e.target.checked})} className="rounded text-teal-600" />
                      <span>使用方法</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={showColumns.usage_count} onChange={e => setShowColumns({...showColumns, usage_count: e.target.checked})} className="rounded text-teal-600" />
                      <span>総使用回数</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={showColumns.type} onChange={e => setShowColumns({...showColumns, type: e.target.checked})} className="rounded text-teal-600" />
                      <span>農薬の種類</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={showColumns.applicant} onChange={e => setShowColumns({...showColumns, applicant: e.target.checked})} className="rounded text-teal-600" />
                      <span>メーカー</span>
                    </label>
                  </div>
                )}

                {/* 1. カード一覧表示（全項目が見切れず一目瞭然） */}
                {viewMode === 'cards' && result.pesticides && result.pesticides.length > 0 && (
                  <div className="space-y-4">
                    {result.pesticides.map((p: any, i: number) => {
                      const isAlreadyAdopted = adoptedPesticideNames.includes(p.name);
                      const isDirect = p.match_type === 'direct';
                      return (
                        <div 
                          key={i} 
                          className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:border-teal-300 transition-all space-y-4"
                        >
                          {/* カードヘッダー */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-black text-base text-slate-800 tracking-tight">{p.name}</h3>
                                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                                  isDirect 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                    : p.match_type === 'subgroup'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-purple-50 text-purple-700 border-purple-200'
                                }`}>
                                  {p.scope_label || p.crop_name}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 font-bold mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                <span>登録番号: <strong className="text-slate-600">{p.registration_no}</strong></span>
                                <span>製造元: <strong className="text-slate-600">{p.applicant || '未登録'}</strong></span>
                                {p.type && <span>分類: <strong className="text-slate-600">{p.type}</strong></span>}
                              </div>
                            </div>

                            {/* 自社マスタ登録ボタン */}
                            <div className="self-start sm:self-center">
                              {isAlreadyAdopted ? (
                                <span className="text-xs font-black bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-xl inline-flex items-center gap-1 border border-emerald-200">
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  自社マスタ登録済
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isAdopting === p.name}
                                  onClick={() => handleAdoptPesticide(p)}
                                  className="text-xs font-black bg-teal-600 hover:bg-teal-700 text-white px-3.5 py-1.5 rounded-xl inline-flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                                >
                                  {isAdopting === p.name ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                  <span>自社農薬マスタに登録</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* AI包括登録の解説 */}
                          {!isDirect && (
                            <div className="bg-purple-50/80 border border-purple-200 p-3 rounded-2xl flex items-start gap-2.5 text-xs text-purple-900 font-bold">
                              <span className="text-base">🤖</span>
                              <div className="leading-relaxed">
                                <span className="font-black text-purple-950 block mb-0.5">AI適用解説</span>
                                本剤はFAMICにおいて「<span className="underline font-black">{p.crop_name}</span>」として包括登録されています。「{cropName}」は{p.crop_name}に該当するため、法令上**適正に使用可能**です。
                              </div>
                            </div>
                          )}

                          {/* 4大必須スペックグリッド（全情報が即座に見える） */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100 text-xs">
                            <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs">
                              <span className="text-[10px] font-black text-slate-400 block mb-0.5">🐛 対象病害虫・雑草</span>
                              <p className="font-black text-rose-600 text-xs leading-tight">{p.target_pest}</p>
                            </div>
                            <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs">
                              <span className="text-[10px] font-black text-slate-400 block mb-0.5">💧 希釈倍数・使用量</span>
                              <p className="font-black text-teal-700 text-xs leading-tight">{p.usage_amount}</p>
                            </div>
                            <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs">
                              <span className="text-[10px] font-black text-slate-400 block mb-0.5">⏳ 使用時期（収穫前等）</span>
                              <p className="font-black text-slate-800 text-xs leading-tight">{p.usage_time}</p>
                            </div>
                            <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs">
                              <span className="text-[10px] font-black text-slate-400 block mb-0.5">🔢 総使用可能回数</span>
                              <p className="font-black text-amber-700 text-xs leading-tight">{p.usage_count}</p>
                            </div>
                            <div className="col-span-2 sm:col-span-4 pt-1.5 border-t border-slate-200/60 text-slate-500 font-bold text-[11px] flex items-center gap-1.5">
                              <span>🚜 散布・使用方法:</span>
                              <span className="text-slate-800 font-black">{p.usage_method}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 2. テーブル一覧表示 */}
                {viewMode === 'table' && result.pesticides && result.pesticides.length > 0 && (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
                    <table className="w-full text-xs text-left">
                      <thead className="text-white bg-teal-700 font-bold whitespace-nowrap">
                        <tr>
                          <th className="px-4 py-3">農薬名 / 登録番号</th>
                          <th className="px-4 py-3">登録適用区分</th>
                          {showColumns.target_pest && <th className="px-4 py-3">対象病害虫</th>}
                          {showColumns.usage_amount && <th className="px-4 py-3">希釈倍数/使用量</th>}
                          {showColumns.usage_time && <th className="px-4 py-3">使用時期</th>}
                          {showColumns.usage_method && <th className="px-4 py-3">使用方法</th>}
                          {showColumns.usage_count && <th className="px-4 py-3">総使用回数</th>}
                          {showColumns.type && <th className="px-4 py-3">農薬の種類</th>}
                          {showColumns.applicant && <th className="px-4 py-3">メーカー</th>}
                          <th className="px-4 py-3 text-center">自社マスタ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {result.pesticides.map((p: any, i: number) => {
                          const isAlreadyAdopted = adoptedPesticideNames.includes(p.name);
                          const isDirect = p.match_type === 'direct';
                          return (
                            <React.Fragment key={i}>
                              <tr 
                                onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                                className="hover:bg-teal-50/60 cursor-pointer transition-colors group"
                              >
                                <td className="px-4 py-3 font-bold text-slate-800">
                                  <div className="flex items-center justify-between gap-2">
                                    <div>
                                      <span className="group-hover:text-teal-700 transition-colors font-black text-sm block">{p.name}</span>
                                      <span className="text-[10px] text-slate-400">登録: {p.registration_no}</span>
                                    </div>
                                    <div className="text-slate-300 group-hover:text-teal-600">
                                      {expandedRow === i ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full inline-block border ${
                                    isDirect 
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                      : p.match_type === 'subgroup'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : 'bg-purple-50 text-purple-700 border-purple-200'
                                  }`}>
                                    {p.scope_label || p.crop_name}
                                  </span>
                                </td>
                                {showColumns.target_pest && <td className="px-4 py-3 font-bold text-rose-600">{p.target_pest}</td>}
                                {showColumns.usage_amount && <td className="px-4 py-3 font-bold text-slate-700">{p.usage_amount}</td>}
                                {showColumns.usage_time && <td className="px-4 py-3 font-bold text-slate-700">{p.usage_time}</td>}
                                {showColumns.usage_method && <td className="px-4 py-3 font-medium text-slate-600">{p.usage_method}</td>}
                                {showColumns.usage_count && <td className="px-4 py-3 font-bold text-amber-600">{p.usage_count}</td>}
                                {showColumns.type && <td className="px-4 py-3 font-medium text-slate-600">{p.type}</td>}
                                {showColumns.applicant && <td className="px-4 py-3 font-medium text-slate-600">{p.applicant}</td>}
                                <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                                  {isAlreadyAdopted ? (
                                    <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-1 rounded-lg inline-flex items-center gap-1 border border-emerald-200">
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      登録済
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={isAdopting === p.name}
                                      onClick={() => handleAdoptPesticide(p)}
                                      className="text-[11px] font-black bg-teal-600 hover:bg-teal-700 text-white px-2.5 py-1 rounded-lg inline-flex items-center gap-1 shadow-sm active:scale-95 transition-all"
                                    >
                                      {isAdopting === p.name ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                                      <span>追加</span>
                                    </button>
                                  )}
                                </td>
                              </tr>

                              {/* 展開行（詳細） */}
                              {expandedRow === i && (
                                <tr className="bg-slate-50">
                                  <td colSpan={3 + Object.values(showColumns).filter(Boolean).length} className="p-5 shadow-inner">
                                    <div className="space-y-4">
                                      {/* AI解説ボックス */}
                                      {!isDirect && (
                                        <div className="bg-purple-50 border border-purple-200 p-3.5 rounded-2xl flex items-start gap-2.5 text-xs text-purple-900 font-bold">
                                          <span className="text-base">🤖</span>
                                          <div className="leading-relaxed">
                                            <span className="font-black text-purple-950 block mb-0.5">AI適用解説（作物群・包括登録）</span>
                                            本剤はFAMICにおいて「<span className="underline font-black">{p.crop_name}</span>」として包括登録されています。「{cropName}」は{p.crop_name}に該当するため、法令上**適正に使用可能**です。
                                          </div>
                                        </div>
                                      )}

                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs font-bold">
                                        <div>
                                          <span className="text-[10px] text-slate-400 block mb-0.5">農薬名</span>
                                          <p className="text-slate-800 font-black text-sm">{p.name}</p>
                                        </div>
                                        <div>
                                          <span className="text-[10px] text-slate-400 block mb-0.5">登録適用作物</span>
                                          <p className="text-slate-800 font-black">{p.crop_name}</p>
                                        </div>
                                        <div>
                                          <span className="text-[10px] text-slate-400 block mb-0.5">農林水産省 登録番号</span>
                                          <p className="text-slate-800">{p.registration_no}</p>
                                        </div>
                                        <div>
                                          <span className="text-[10px] text-slate-400 block mb-0.5">製造・登録メーカー</span>
                                          <p className="text-slate-800">{p.applicant || '未登録'}</p>
                                        </div>
                                        <div>
                                          <span className="text-[10px] text-slate-400 block mb-0.5">対象病害虫・雑草</span>
                                          <p className="text-rose-600">{p.target_pest}</p>
                                        </div>
                                        <div>
                                          <span className="text-[10px] text-slate-400 block mb-0.5">希釈倍数・使用量</span>
                                          <p className="text-slate-800">{p.usage_amount}</p>
                                        </div>
                                        <div>
                                          <span className="text-[10px] text-slate-400 block mb-0.5">使用時期（収穫前日数等）</span>
                                          <p className="text-slate-800">{p.usage_time}</p>
                                        </div>
                                        <div>
                                          <span className="text-[10px] text-slate-400 block mb-0.5">使用方法</span>
                                          <p className="text-slate-800">{p.usage_method}</p>
                                        </div>
                                        <div>
                                          <span className="text-[10px] text-slate-400 block mb-0.5">本剤の総使用可能回数</span>
                                          <p className="text-amber-700">{p.usage_count}</p>
                                        </div>
                                        <div className="sm:col-span-2 md:col-span-3 pt-2 border-t border-slate-200 flex justify-end">
                                          {isAlreadyAdopted ? (
                                            <span className="text-xs font-black bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-xl inline-flex items-center gap-1 border border-emerald-200">
                                              <Check className="w-4 h-4 text-emerald-600" />
                                              自社の採用農薬マスタに登録済みです
                                            </span>
                                          ) : (
                                            <button
                                              type="button"
                                              disabled={isAdopting === p.name}
                                              onClick={() => handleAdoptPesticide(p)}
                                              className="text-xs font-black bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl inline-flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                                            >
                                              {isAdopting === p.name ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                              <span>この基準情報で自社農薬マスタに登録する</span>
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
