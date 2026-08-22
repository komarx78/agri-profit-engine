"use client";

import React, { useState, useEffect } from 'react';
import { Database, Upload, FileText, CheckCircle2, AlertTriangle, Loader2, Search, ArrowLeft, Trash2 } from 'lucide-react';
import Papa from 'papaparse';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';

export default function AdminPesticidesPage() {
  const [basicFile, setBasicFile] = useState<File | null>(null);
  const [usageFile, setUsageFile] = useState<File | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const [dbStats, setDbStats] = useState({ basicCount: 0, usageCount: 0 });
  const [previewLoading, setPreviewLoading] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetchDbStats = async () => {
    setPreviewLoading(true);
    try {
      const { count: basicCount } = await supabase.from('m_pesticides').select('*', { count: 'exact', head: true });
      const { count: usageCount } = await supabase.from('m_pesticide_usages').select('*', { count: 'exact', head: true });
      
      setDbStats({
        basicCount: basicCount || 0,
        usageCount: usageCount || 0
      });
    } catch (error) {
      console.error('Fetch stats error:', error);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    fetchDbStats();
  }, []);

  const getValue = (row: any, possibleKeys: string[]) => {
    for (const k of Object.keys(row)) {
      const cleanKey = k.replace(/[\s　]+/g, '').replace(/["']/g, '');
      for (const pk of possibleKeys) {
        const cleanPk = pk.replace(/[\s　]+/g, '');
        if (cleanKey.includes(cleanPk)) {
          return row[k] || '';
        }
      }
    }
    return '';
  };

  // 1. 基本部CSVのインポート処理（最強フォールバック搭載）
  const handleImportBasic = async () => {
    if (!basicFile) return;
    setLoading(true);
    setStatus({ type: 'info', message: '基本部CSVを読み込んでいます...' });

    Papa.parse(basicFile, {
      header: true,
      skipEmptyLines: true,
      encoding: 'Shift-JIS',
      complete: async (results) => {
        try {
          const rawData = results.data.map((row: any) => {
            // もしヘッダー名が完全に化けていても、列の順番（インデックス）で強制的に取得する最強フォールバック
            const vals = Object.values(row);
            return {
              registration_no: String(getValue(row, ['登録番号', 'registration_no']) || vals[0] || '').trim(),
              pesticide_type: String(getValue(row, ['農薬の種類', 'pesticide_type']) || vals[1] || '').trim(),
              pesticide_name: String(getValue(row, ['農薬の名称', 'pesticide_name']) || vals[2] || '').trim(),
              applicant_name: String(getValue(row, ['登録を有する者の名称', '登録を有する者の略称', 'applicant_name']) || vals[3] || '').trim(),
              purpose: String(getValue(row, ['用途', 'purpose']) || vals[8] || '').trim()
            };
          }).filter((item: any) => item.registration_no && item.pesticide_name);

          if (rawData.length === 0) throw new Error('有効なデータが1件も見つかりませんでした。');

          const uniqueData = Array.from(new Map(rawData.map((item: any) => [item.registration_no, item])).values());
          setStatus({ type: 'info', message: `${uniqueData.length}件のデータをデータベースに保存中...` });

          const chunkSize = 1000;
          for (let i = 0; i < uniqueData.length; i += chunkSize) {
            const chunk = uniqueData.slice(i, i + chunkSize);
            const { error } = await supabase.from('m_pesticides').upsert(chunk, { onConflict: 'registration_no' });
            if (error) throw error;
          }

          setStatus({ type: 'success', message: `基本部のインポートが完了しました。(${uniqueData.length}件)` });
          setBasicFile(null);
          fetchDbStats();
        } catch (error: any) {
          setStatus({ type: 'error', message: `エラーが発生しました: ${error.message}` });
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleImportUsage = async () => {
    if (!usageFile) return;
    setLoading(true);
    setStatus({ type: 'info', message: '適用部CSVを読み込んでいます...' });

    Papa.parse(usageFile, {
      header: true,
      skipEmptyLines: true,
      encoding: 'Shift-JIS',
      complete: async (results) => {
        try {
          const data = results.data.map((row: any) => {
            const vals = Object.values(row);
            return {
              registration_no: String(getValue(row, ['登録番号', 'registration_no']) || vals[0] || '').trim(),
              crop_name: String(getValue(row, ['作物名', 'crop_name']) || vals[5] || '').trim(),
              target_pest: String(getValue(row, ['適用病害虫雑草名', '適用病害虫', 'target_pest']) || vals[7] || '').trim(),
              usage_time: String(getValue(row, ['使用時期', 'usage_time']) || vals[11] || '').trim(),
              usage_method: String(getValue(row, ['使用方法', 'usage_method']) || vals[13] || '').trim(),
              usage_amount: String(getValue(row, ['希釈倍数使用量', '希釈倍率', '使用量', 'usage_amount']) || vals[9] || '').trim(),
              usage_count: String(getValue(row, ['本剤の使用回数', '使用回数', 'usage_count']) || vals[12] || '').trim(),
              application_place: String(getValue(row, ['適用場所', 'application_place']) || vals[6] || '').trim(),
              usage_purpose: String(getValue(row, ['使用目的', 'usage_purpose']) || vals[8] || '').trim(),
              spray_amount: String(getValue(row, ['散布液量', 'spray_amount']) || vals[10] || '').trim(),
              fumigation_time: String(getValue(row, ['くん蒸時間', 'fumigation_time']) || vals[14] || '').trim(),
              fumigation_temp: String(getValue(row, ['くん蒸温度', 'fumigation_temp']) || vals[15] || '').trim(),
              applicable_soil: String(getValue(row, ['適用土壌', 'applicable_soil']) || vals[16] || '').trim(),
              applicable_region: String(getValue(row, ['適用地帯名', 'applicable_region']) || vals[17] || '').trim(),
              applicable_pesticide: String(getValue(row, ['適用農薬名', 'applicable_pesticide']) || vals[18] || '').trim(),
              mix_count: String(getValue(row, ['混合数', 'mix_count']) || vals[19] || '').trim(),
              active_ingredient_count_1: String(getValue(row, ['有効成分①', '有効成分1']) || vals[20] || '').trim(),
              active_ingredient_count_2: String(getValue(row, ['有効成分②', '有効成分2']) || vals[21] || '').trim(),
              active_ingredient_count_3: String(getValue(row, ['有効成分③', '有効成分3']) || vals[22] || '').trim(),
              active_ingredient_count_4: String(getValue(row, ['有効成分④', '有効成分4']) || vals[23] || '').trim(),
              active_ingredient_count_5: String(getValue(row, ['有効成分⑤', '有効成分5']) || vals[24] || '').trim()
            };
          }).filter((item: any) => item.registration_no && item.crop_name);

          if (data.length === 0) throw new Error('有効なデータが1件も見つかりませんでした。');

          setStatus({ type: 'info', message: `${data.length}件のデータを追加保存中...` });

          const chunkSize = 1000;
          for (let i = 0; i < data.length; i += chunkSize) {
            const chunk = data.slice(i, i + chunkSize);
            const { error } = await supabase.from('m_pesticide_usages').insert(chunk);
            if (error) throw error;
          }

          setStatus({ type: 'success', message: `適用部のインポートが完了しました。(${data.length}件)` });
          setUsageFile(null);
          fetchDbStats();
        } catch (error: any) {
          setStatus({ type: 'error', message: `エラーが発生しました: ${error.message}` });
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleClearUsages = async () => {
    if (!window.confirm('適用部（作物・使用法など）のデータをすべて削除します。よろしいですか？')) return;
    setLoading(true);
    setStatus({ type: 'info', message: '適用部データを削除中...' });
    try {
      const { error } = await supabase.from('m_pesticide_usages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      setStatus({ type: 'success', message: '適用部データをすべて削除しました。' });
      fetchDbStats();
    } catch (error: any) {
      setStatus({ type: 'error', message: `削除エラー: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleClearBasics = async () => {
    if (!window.confirm('基本部（農薬名など）のデータをすべて削除します。よろしいですか？')) return;
    setLoading(true);
    setStatus({ type: 'info', message: '基本部データを削除中...' });
    try {
      const { error } = await supabase.from('m_pesticides').delete().neq('registration_no', '00000');
      if (error) throw error;
      setStatus({ type: 'success', message: '基本部データをすべて削除しました。' });
      fetchDbStats();
    } catch (error: any) {
      setStatus({ type: 'error', message: `削除エラー: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
          <Database className="w-5 h-5 text-teal-600" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">農薬マスター管理</h1>
          <p className="text-sm font-bold text-slate-400 mt-1">FAMIC公開データのインポートと更新</p>
        </div>
      </div>

      {status && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-bold ${
          status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
          status.type === 'error' ? 'bg-rose-50 text-rose-700 border-rose-200' :
          'bg-blue-50 text-blue-700 border-blue-200'
        }`}>
          {status.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
          {status.type === 'error' && <AlertTriangle className="w-5 h-5" />}
          {status.type === 'info' && <Loader2 className="w-5 h-5 animate-spin" />}
          {status.message}
        </div>
      )}

      {/* データベース統計 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-sm font-bold text-slate-400 mb-1">現在の基本部データ数</p>
          <div className="text-3xl font-black text-slate-800">
            {previewLoading ? <Loader2 className="w-6 h-6 animate-spin text-slate-300" /> : dbStats.basicCount.toLocaleString()} <span className="text-sm font-bold text-slate-400">件</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-sm font-bold text-slate-400 mb-1">現在の適用部データ数</p>
          <div className="text-3xl font-black text-slate-800">
            {previewLoading ? <Loader2 className="w-6 h-6 animate-spin text-slate-300" /> : dbStats.usageCount.toLocaleString()} <span className="text-sm font-bold text-slate-400">件</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. 基本部インポート */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:border-slate-300">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <span className="bg-slate-100 text-slate-500 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
              農薬マスター（基本部）
            </h2>
            <button onClick={handleClearBasics} className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="基本部データを全削除">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs font-bold text-slate-400 mb-6 leading-relaxed">
            「農薬の種類」や「メーカー名」などの基本情報を読み込みます。<br/>
            ファイル名例: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">kihon.csv</code>
          </p>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center relative hover:bg-slate-50 transition-colors">
              <input type="file" accept=".csv" onChange={(e) => setBasicFile(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={loading} />
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-600">{basicFile ? basicFile.name : 'クリックしてCSVファイルを選択'}</p>
            </div>
            <button onClick={handleImportBasic} disabled={!basicFile || loading} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-50">
              <Upload className="w-4 h-4 inline-block mr-2 -mt-1" />
              基本部を更新する
            </button>
          </div>
        </div>

        {/* 2. 適用部インポート */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:border-slate-300">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <span className="bg-slate-100 text-slate-500 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
              農薬適用表（適用部）
            </h2>
            <button onClick={handleClearUsages} className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="適用部データを全削除">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs font-bold text-slate-400 mb-6 leading-relaxed">
            対象作物や使用量などの適用情報を読み込みます。<br/>
            ファイル名例: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">tekiyou.csv</code>
          </p>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center relative hover:bg-slate-50 transition-colors">
              <input type="file" accept=".csv" onChange={(e) => setUsageFile(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={loading} />
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-600">{usageFile ? usageFile.name : 'クリックしてCSVファイルを選択'}</p>
            </div>
            <button onClick={handleImportUsage} disabled={!usageFile || loading} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-50">
              <Upload className="w-4 h-4 inline-block mr-2 -mt-1" />
              適用部を追加する
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

