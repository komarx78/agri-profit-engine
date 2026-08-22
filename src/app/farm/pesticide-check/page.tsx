"use client";

import React, { useState } from 'react';
import { ShieldCheck, Search, AlertTriangle, CheckCircle2, ArrowLeft, Loader2, Save, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';

export default function PesticideCheckPage() {
  const [cropName, setCropName] = useState('');
  const [pesticideName, setPesticideName] = useState('');
  const [targetPest, setTargetPest] = useState('');
  const [usageAmount, setUsageAmount] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // 追加状態
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [showColumns, setShowColumns] = useState({
    target_pest: true,
    usage_amount: true,
    usage_time: true,
    usage_method: false,
    usage_count: false,
    type: false,
    applicant: false
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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
        body: JSON.stringify({ cropName, pesticideName, targetPest, usageAmount })
      });

      if (!res.ok) {
        let errorMsg = 'データベース検索に失敗しました。';
        try {
          const errData = await res.json();
          if (errData.error) errorMsg = errData.error;
        } catch (e) {
          // JSONパースに失敗した場合は無視
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();
      setResult(data);

      // 判定結果をデータベースに保存
      const { data: userData } = await supabase.auth.getUser();
      const testFarmId = '00000000-0000-0000-0000-000000000001';

      await supabase.from('pesticide_checks').insert({
        farm_id: testFarmId,
        user_id: userData?.user?.id || null,
        crop_name: cropName,
        pesticide_name: pesticideName,
        target_pest: targetPest,
        usage_amount: usageAmount,
        judgment: data.judgment,
        message: data.message
      });

    } catch (err: any) {
      setError(err.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const toggleColumn = (key: keyof typeof showColumns) => {
    setShowColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/" className="text-slate-400 hover:text-slate-600 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-teal-600" />
            </div>
            <h1 className="font-black text-xl text-slate-800 tracking-tight">農薬・防除チェッカー</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 mb-8">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-amber-800 text-sm">【免責事項】必ずお読みください</h3>
            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
              本システムはFAMIC（農林水産消費安全技術センター）のオープンデータを基に参考情報を提示するものです。
              検索結果が不正確であったり最新でない可能性があります。
              実際の農薬散布にあたっては、必ず<span className="font-bold underline">農薬の容器ラベル</span>等で最新の登録内容をご確認ください。
            </p>
          </div>
        </div>

        <div className="flex flex-col space-y-8">
          {/* 入力フォーム */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
              <Search className="w-5 h-5 text-slate-400" />
              チェック条件の入力
            </h2>
            <form onSubmit={handleCheck} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">作物名 <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  value={cropName}
                  onChange={(e) => setCropName(e.target.value)}
                  placeholder="例: トマト、キャベツ、水稲" 
                  className="w-full rounded-lg border-slate-300 focus:border-teal-500 focus:ring-teal-500 shadow-sm text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">農薬名（商品名） <span className="text-slate-400 font-normal text-xs ml-2">※任意</span></label>
                <input 
                  type="text" 
                  value={pesticideName}
                  onChange={(e) => setPesticideName(e.target.value)}
                  placeholder="例: プレバソンフロアブル5" 
                  className="w-full rounded-lg border-slate-300 focus:border-teal-500 focus:ring-teal-500 shadow-sm text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">対象病害虫・雑草 <span className="text-slate-400 font-normal text-xs ml-2">※任意</span></label>
                <input 
                  type="text" 
                  value={targetPest}
                  onChange={(e) => setTargetPest(e.target.value)}
                  placeholder="例: アオムシ、うどんこ病" 
                  className="w-full rounded-lg border-slate-300 focus:border-teal-500 focus:ring-teal-500 shadow-sm text-sm"
                />
              </div>

              <button 
                type="submit" 
                disabled={loading || !cropName}
                className="w-full mt-4 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                {loading ? 'データベースを検索中...' : '使える農薬をデータベースから検索する'}
              </button>
            </form>
          </div>

          {/* 結果表示エリア */}
          <div className="bg-slate-100 rounded-2xl border border-slate-200 p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-slate-800">検索結果</h2>
              
              {/* 表示項目設定ボタン */}
              {result && result.pesticides && result.pesticides.length > 0 && (
                <div className="relative">
                  <button 
                    onClick={() => setShowColumnSettings(!showColumnSettings)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <Settings2 className="w-4 h-4" />
                    表示項目
                  </button>
                  
                  {showColumnSettings && (
                    <div className="absolute right-0 top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-lg p-4 w-48 z-10">
                      <p className="text-xs font-bold text-slate-400 mb-3">表示する列を選択</p>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                          <input type="checkbox" checked={showColumns.target_pest} onChange={() => toggleColumn('target_pest')} className="rounded text-teal-600 focus:ring-teal-500" />
                          対象病害虫
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                          <input type="checkbox" checked={showColumns.usage_amount} onChange={() => toggleColumn('usage_amount')} className="rounded text-teal-600 focus:ring-teal-500" />
                          希釈/使用量
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                          <input type="checkbox" checked={showColumns.usage_time} onChange={() => toggleColumn('usage_time')} className="rounded text-teal-600 focus:ring-teal-500" />
                          使用時期
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                          <input type="checkbox" checked={showColumns.usage_method} onChange={() => toggleColumn('usage_method')} className="rounded text-teal-600 focus:ring-teal-500" />
                          使用方法
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                          <input type="checkbox" checked={showColumns.usage_count} onChange={() => toggleColumn('usage_count')} className="rounded text-teal-600 focus:ring-teal-500" />
                          使用回数
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                          <input type="checkbox" checked={showColumns.type} onChange={() => toggleColumn('type')} className="rounded text-teal-600 focus:ring-teal-500" />
                          農薬の種類
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                          <input type="checkbox" checked={showColumns.applicant} onChange={() => toggleColumn('applicant')} className="rounded text-teal-600 focus:ring-teal-500" />
                          メーカー・登録者
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {error && (
              <div className="bg-rose-50 text-rose-600 p-4 rounded-xl border border-rose-200 text-sm font-bold">
                {error}
              </div>
            )}

            {!result && !error && !loading && (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <ShieldCheck className="w-16 h-16 mb-4 opacity-20" />
                <p className="font-bold text-sm text-center">左のフォームに条件を入力してください。<br/>農薬名を空欄にすると、使える農薬を検索します。</p>
              </div>
            )}

            {loading && (
              <div className="flex-1 flex flex-col items-center justify-center text-teal-600 space-y-4 py-12">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-teal-200 rounded-full animate-pulse"></div>
                  <Loader2 className="w-8 h-8 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin" />
                </div>
                <p className="font-bold text-sm animate-pulse">FAMICデータベースと照合しています...</p>
              </div>
            )}

            {result && (
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm animate-fade-in flex flex-col h-full">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    {result.judgment === 'DB検索完了' ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-amber-500" />
                    )}
                    <h3 className="font-black text-slate-800 text-lg">
                      判定: <span className={
                        result.judgment === 'DB検索完了' ? 'text-emerald-600' :
                        'text-amber-600'
                      }>{result.judgment}</span>
                    </h3>
                  </div>
                  {result.pesticides && result.pesticides.length > 0 && (
                    <div className="px-4 py-1.5 bg-teal-100 border border-teal-200 text-teal-700 font-black rounded-full text-sm shadow-sm">
                      {result.pesticides.length} 件ヒット
                    </div>
                  )}
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 mb-4 flex-1">
                  <p className="text-xs font-bold text-slate-400 mb-2">検索レポート</p>
                  <div className="whitespace-pre-wrap text-slate-700 font-medium leading-relaxed mb-4">
                    {result.message}
                  </div>
                  
                  {/* テーブル表示 */}
                  {result.pesticides && result.pesticides.length > 0 && (
                    <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-white bg-teal-600 uppercase whitespace-nowrap">
                          <tr>
                            <th className="px-4 py-3">農薬名</th>
                            {showColumns.target_pest && <th className="px-4 py-3">対象病害虫</th>}
                            {showColumns.usage_amount && <th className="px-4 py-3">希釈/使用量</th>}
                            {showColumns.usage_time && <th className="px-4 py-3">使用時期</th>}
                            {showColumns.usage_method && <th className="px-4 py-3">使用方法</th>}
                            {showColumns.usage_count && <th className="px-4 py-3">使用回数</th>}
                            {showColumns.type && <th className="px-4 py-3">農薬の種類</th>}
                            {showColumns.applicant && <th className="px-4 py-3">メーカー・登録者</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {result.pesticides.map((p: any, i: number) => (
                            <React.Fragment key={i}>
                              <tr 
                                onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                                className="border-b border-slate-100 hover:bg-teal-50 last:border-0 cursor-pointer transition-colors group"
                              >
                                <td className="px-4 py-3 font-bold text-slate-800">
                                  <div className="flex items-center justify-between gap-4">
                                    <div>
                                      <span className="group-hover:text-teal-700 transition-colors">{p.name}</span>
                                      <div className="text-[10px] text-slate-400 font-normal mt-0.5">登録: {p.registration_no}</div>
                                    </div>
                                    <div className="flex-shrink-0 text-slate-300 group-hover:text-teal-500 transition-colors">
                                      {expandedRow === i ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </div>
                                  </div>
                                </td>
                                {showColumns.target_pest && <td className="px-4 py-3 font-medium text-slate-600">{p.target_pest}</td>}
                                {showColumns.usage_amount && <td className="px-4 py-3 font-medium text-slate-600">{p.usage_amount}</td>}
                                {showColumns.usage_time && <td className="px-4 py-3 font-medium text-slate-600">{p.usage_time}</td>}
                                {showColumns.usage_method && <td className="px-4 py-3 font-medium text-slate-600">{p.usage_method}</td>}
                                {showColumns.usage_count && <td className="px-4 py-3 font-medium text-slate-600">{p.usage_count}</td>}
                                {showColumns.type && <td className="px-4 py-3 font-medium text-slate-600">{p.type}</td>}
                                {showColumns.applicant && <td className="px-4 py-3 font-medium text-slate-600">{p.applicant}</td>}
                              </tr>
                              
                              {/* 展開される詳細行 */}
                              {expandedRow === i && (
                                <tr className="bg-slate-50 border-b border-slate-200">
                                  <td colSpan={1 + Object.values(showColumns).filter(Boolean).length} className="px-6 py-6 shadow-inner">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-sm">
                                      <div>
                                        <p className="text-xs font-bold text-slate-400 mb-1">農薬名（商品名）</p>
                                        <p className="font-black text-slate-800">{p.name}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs font-bold text-slate-400 mb-1">農薬の種類</p>
                                        <p className="font-medium text-slate-700">{p.type}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs font-bold text-slate-400 mb-1">メーカー・登録者</p>
                                        <p className="font-medium text-slate-700">{p.applicant}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs font-bold text-slate-400 mb-1">農林水産省 登録番号</p>
                                        <p className="font-medium text-slate-700 bg-white inline-block px-2 py-0.5 rounded border border-slate-200">{p.registration_no}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs font-bold text-slate-400 mb-1">対象病害虫・雑草</p>
                                        <p className="font-bold text-rose-600">{p.target_pest}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs font-bold text-slate-400 mb-1">希釈倍数・使用量</p>
                                        <p className="font-medium text-slate-700">{p.usage_amount}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs font-bold text-slate-400 mb-1">使用時期</p>
                                        <p className="font-medium text-slate-700">{p.usage_time}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs font-bold text-slate-400 mb-1">使用方法</p>
                                        <p className="font-medium text-slate-700">{p.usage_method}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs font-bold text-slate-400 mb-1">本剤の使用回数</p>
                                        <p className="font-medium text-slate-700">{p.usage_count}</p>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-white p-3 rounded-xl border border-slate-200 mt-auto">
                  <Save className="w-4 h-4" />
                  この結果はデータベースに記録されました。
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
