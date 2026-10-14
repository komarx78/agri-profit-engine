"use client";

import React, { useState, useEffect } from 'react';
import { Database, Upload, FileText, CheckCircle2, AlertTriangle, Loader2, Search, ArrowLeft, ExternalLink, Calendar, X } from 'lucide-react';
import Papa from 'papaparse';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';

export default function AdminPesticidesPage() {
  const [basicFile, setBasicFile] = useState<File | null>(null);
  const [usageFiles, setUsageFiles] = useState<File[]>([]);
  
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

  // 🧹 鉄壁サニタイズ（PostgreSQLの NULバイト \u0000 拒絶および制御文字エラーを根絶）
  const cleanText = (val: any): string => {
    if (val === null || val === undefined) return '';
    return String(val)
      .replace(/\0/g, '') // NUL文字 (0x00) を完全除去
      .replace(/\\u0000/g, '') // エスケープされた \u0000 を除去
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // 改行・タブ以外の制御文字を除去
      .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '') // 孤立サロゲートを除去
      .trim();
  };

  // 🛡️ 文字コード自動判定 ＆ 安全デコード（UTF-8 BOM / UTF-8 / Shift-JIS / CP932 を全自動判別）
  const readFileTextSafely = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // 1. UTF-8 BOM (0xEF, 0xBB, 0xBF)
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      return new TextDecoder('utf-8').decode(bytes.slice(3));
    }

    // 2. UTF-8 で厳格デコード試行 (fatal: true)
    try {
      const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
      return utf8Decoder.decode(bytes);
    } catch {
      // 3. 失敗した場合は Shift-JIS (Windows-31J / CP932) でデコード
      try {
        const sjisDecoder = new TextDecoder('shift-jis');
        return sjisDecoder.decode(bytes);
      } catch {
        // 4. 万が一のフォールバック
        return new TextDecoder('utf-8').decode(bytes);
      }
    }
  };

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

  // 1. 基本部CSVのインポート処理（文字コード自動判定・完全サニタイズ・進捗表示）
  const handleImportBasic = async () => {
    if (!basicFile) return;
    setLoading(true);
    setStatus({ type: 'info', message: '基本部CSVを安全にデコード中...' });

    try {
      const csvText = await readFileTextSafely(basicFile);

      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const rawData = results.data.map((row: any) => {
              const vals = Object.values(row);
              return {
                registration_no: cleanText(getValue(row, ['登録番号', 'registration_no']) || vals[0] || ''),
                pesticide_type: cleanText(getValue(row, ['農薬の種類', 'pesticide_type']) || vals[1] || ''),
                pesticide_name: cleanText(getValue(row, ['農薬の名称', 'pesticide_name']) || vals[2] || ''),
                applicant_name: cleanText(getValue(row, ['登録を有する者の名称', '登録を有する者の略称', 'applicant_name']) || vals[3] || ''),
                purpose: cleanText(getValue(row, ['用途', 'purpose']) || vals[8] || '')
              };
            }).filter((item: any) => item.registration_no && item.pesticide_name);

            if (rawData.length === 0) throw new Error('有効な基本部データが1件も見つかりませんでした。');

            const uniqueData = Array.from(new Map(rawData.map((item: any) => [item.registration_no, item])).values());
            const total = uniqueData.length;
            const chunkSize = 500;

            for (let i = 0; i < total; i += chunkSize) {
              const chunk = uniqueData.slice(i, i + chunkSize);
              const processed = Math.min(i + chunkSize, total);
              const percent = Math.round((processed / total) * 100);
              setStatus({ 
                type: 'info', 
                message: `基本部データを保存中... (${processed.toLocaleString()} / ${total.toLocaleString()}件 - ${percent}%)` 
              });
              const { error } = await supabase.from('m_pesticides').upsert(chunk, { onConflict: 'registration_no' });
              if (error) throw error;
            }

            setStatus({ type: 'success', message: `🎉 基本部のインポートが完了しました！（全${total.toLocaleString()}件）` });
            setBasicFile(null);
            fetchDbStats();
          } catch (error: any) {
            console.error(error);
            setStatus({ type: 'error', message: `エラーが発生しました: ${error.message}` });
          } finally {
            setLoading(false);
          }
        },
        error: (err: Error) => {
          setLoading(false);
          setStatus({ type: 'error', message: `CSVの解析に失敗しました: ${err.message}` });
        }
      });
    } catch (err: any) {
      setLoading(false);
      setStatus({ type: 'error', message: `ファイルの読み込みに失敗しました: ${err.message}` });
    }
  };

  // 適用部ファイルの選択ハンドラー（複数ファイル対応・重複防止）
  const handleUsageFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    setUsageFiles(prev => {
      const combined = [...prev];
      for (const f of newFiles) {
        if (!combined.some(item => item.name === f.name)) {
          combined.push(f);
        }
      }
      return combined;
    });
    e.target.value = '';
  };

  const handleRemoveUsageFile = (index: number) => {
    setUsageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearUsageFiles = () => {
    setUsageFiles([]);
  };

  // 2. 適用部CSVのインポート処理（複数ファイル・文字コード自動判定・完全サニタイズ・進捗表示）
  const handleImportUsage = async () => {
    if (usageFiles.length === 0) return;

    // 事前確認：適用部データを全クリアして最新化するか？
    const shouldClear = window.confirm(
      `適用部（${usageFiles.length}ファイル）をインポートします。\n\n既存の古い適用部データをクリアして、完全に最新のデータに入れ直しますか？\n（「キャンセル」を押すと、既存データを残したまま追加登録されます）`
    );

    setLoading(true);

    try {
      if (shouldClear) {
        setStatus({ type: 'info', message: '古い適用部データをクリーンアップ中...' });
        const { error: clearErr } = await supabase
          .from('m_pesticide_usages')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
        if (clearErr) throw clearErr;
      }

      let grandTotalInserted = 0;

      for (let fIdx = 0; fIdx < usageFiles.length; fIdx++) {
        const file = usageFiles[fIdx];
        const filePrefix = usageFiles.length > 1 ? `[${fIdx + 1}/${usageFiles.length}ファイル目: ${file.name}] ` : '';

        setStatus({ type: 'info', message: `${filePrefix}CSVを安全にデコード中...` });

        const csvText = await readFileTextSafely(file);

        // PromiseでPapaParseをラップして同期的に実行
        const parsedRows: any[] = await new Promise((resolve, reject) => {
          Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => resolve(results.data),
            error: (err: Error) => reject(err)
          });
        });

        const data = parsedRows.map((row: any) => {
          const vals = Object.values(row);
          return {
            registration_no: cleanText(getValue(row, ['登録番号', 'registration_no']) || vals[0] || ''),
            crop_name: cleanText(getValue(row, ['作物名', 'crop_name']) || vals[5] || ''),
            target_pest: cleanText(getValue(row, ['適用病害虫雑草名', '適用病害虫', 'target_pest']) || vals[7] || ''),
            usage_time: cleanText(getValue(row, ['使用時期', 'usage_time']) || vals[11] || ''),
            usage_method: cleanText(getValue(row, ['使用方法', 'usage_method']) || vals[13] || ''),
            usage_amount: cleanText(getValue(row, ['希釈倍数使用量', '希釈倍率', '使用量', 'usage_amount']) || vals[9] || ''),
            usage_count: cleanText(getValue(row, ['本剤の使用回数', '使用回数', 'usage_count']) || vals[12] || ''),
            application_place: cleanText(getValue(row, ['適用場所', 'application_place']) || vals[6] || ''),
            usage_purpose: cleanText(getValue(row, ['使用目的', 'usage_purpose']) || vals[8] || ''),
            spray_amount: cleanText(getValue(row, ['散布液量', 'spray_amount']) || vals[10] || ''),
            fumigation_time: cleanText(getValue(row, ['くん蒸時間', 'fumigation_time']) || vals[14] || ''),
            fumigation_temp: cleanText(getValue(row, ['くん蒸温度', 'fumigation_temp']) || vals[15] || ''),
            applicable_soil: cleanText(getValue(row, ['適用土壌', 'applicable_soil']) || vals[16] || ''),
            applicable_region: cleanText(getValue(row, ['適用地帯名', 'applicable_region']) || vals[17] || ''),
            applicable_pesticide: cleanText(getValue(row, ['適用農薬名', 'applicable_pesticide']) || vals[18] || ''),
            mix_count: cleanText(getValue(row, ['混合数', 'mix_count']) || vals[19] || ''),
            active_ingredient_count_1: cleanText(getValue(row, ['有効成分①', '有効成分1']) || vals[20] || ''),
            active_ingredient_count_2: cleanText(getValue(row, ['有効成分②', '有効成分2']) || vals[21] || ''),
            active_ingredient_count_3: cleanText(getValue(row, ['有効成分③', '有効成分3']) || vals[22] || ''),
            active_ingredient_count_4: cleanText(getValue(row, ['有効成分④', '有効成分4']) || vals[23] || ''),
            active_ingredient_count_5: cleanText(getValue(row, ['有効成分⑤', '有効成分5']) || vals[24] || '')
          };
        }).filter((item: any) => item.registration_no && item.crop_name);

        if (data.length === 0) {
          console.warn(`${file.name}: 有効な適用部データが見つかりませんでした。`);
          continue;
        }

        const total = data.length;
        const chunkSize = 500;

        for (let i = 0; i < total; i += chunkSize) {
          const chunk = data.slice(i, i + chunkSize);
          const processed = Math.min(i + chunkSize, total);
          const percent = Math.round((processed / total) * 100);
          setStatus({ 
            type: 'info', 
            message: `${filePrefix}データを追加中... (${processed.toLocaleString()} / ${total.toLocaleString()}件 - ${percent}%)` 
          });
          const { error } = await supabase.from('m_pesticide_usages').insert(chunk);
          if (error) throw error;
        }

        grandTotalInserted += data.length;
      }

      setStatus({ 
        type: 'success', 
        message: `🎉 適用部（${usageFiles.length}ファイル）のインポートが完了しました！（合計: ${grandTotalInserted.toLocaleString()}件）` 
      });
      setUsageFiles([]);
      fetchDbStats();
    } catch (error: any) {
      console.error(error);
      setStatus({ type: 'error', message: `適用部のインポート中にエラーが発生しました: ${error.message}` });
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

      {/* FAMIC公式ダウンロード導線 ＆ 更新スケジュール案内カード */}
      <div className="bg-gradient-to-r from-teal-50 via-emerald-50 to-teal-50 border-2 border-teal-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 bg-teal-600 text-white text-xs font-black px-2.5 py-1 rounded-full tracking-wide">
                <Calendar className="w-3.5 h-3.5" />
                更新時期: 原則毎月月初
              </span>
              <span className="text-xs font-bold text-teal-800">（月1回定期更新）</span>
            </div>
            <h2 className="text-lg font-black text-slate-800 tracking-tight">
              FAMIC（農林水産消費安全技術センター）公式データ取得
            </h2>
            <p className="text-xs font-bold text-slate-600 leading-relaxed max-w-2xl">
              農薬の「新規登録」「適用拡大（対象作物追加等）」「登録失効」は法令に基づき毎月更新されます。<br />
              公式ページを開き、「<strong>同意する</strong>」ボタンを押して最新の基本部（<code className="bg-white/80 px-1 py-0.5 rounded text-teal-800">kihon.csv</code>）および適用部（<code className="bg-white/80 px-1 py-0.5 rounded text-teal-800">tekiyou.csv</code>）をダウンロードしてください。
            </p>
          </div>
          <a
            href="https://www.acis.famic.go.jp/ddownload/index.htm"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-black text-sm px-6 py-3.5 rounded-xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 shrink-0"
          >
            <span>FAMIC公式ダウンロードへ</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

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
          <div className="mb-4">
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <span className="bg-slate-100 text-slate-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black">1</span>
              農薬マスター（基本部）
            </h2>
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

        {/* 2. 適用部インポート（2ファイル一括対応） */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:border-slate-300">
          <div className="mb-4">
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <span className="bg-teal-100 text-teal-700 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black">2</span>
              農薬適用表（適用部）
            </h2>
          </div>

          <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-3 mb-4">
            <p className="text-xs font-black text-teal-900 mb-0.5 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
              FAMIC適用部は2ファイル（tekiyou1.csv & tekiyou2.csv）構成
            </p>
            <p className="text-2xs text-teal-700 leading-relaxed font-bold">
              2つのファイルをまとめて同時に選択（またはドラッグ＆ドロップ）してください。2ファイル連続で自動インポートされます（1ファイルのみの更新も可能です）。
            </p>
          </div>

          <div className="space-y-4">
            <div className="border-2 border-dashed border-teal-300 bg-teal-50/20 hover:bg-teal-50/50 rounded-xl p-6 text-center relative transition-colors">
              <input 
                type="file" 
                accept=".csv" 
                multiple 
                onChange={handleUsageFilesChange} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                disabled={loading} 
              />
              <FileText className="w-8 h-8 text-teal-500 mx-auto mb-2" />
              <p className="text-sm font-black text-slate-700">
                {usageFiles.length > 0 ? `📁 ${usageFiles.length}個のCSVファイルを選択中` : 'クリックまたはドラッグしてCSVを選択'}
              </p>
              <p className="text-2xs font-bold text-slate-400 mt-1">
                ※ 複数ファイル（tekiyou1.csv と tekiyou2.csv）を同時に選択可能です
              </p>
            </div>

            {/* 選択されたファイル一覧表示 */}
            {usageFiles.length > 0 && (
              <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-600 px-1">
                  <span>セットされたファイル ({usageFiles.length}件):</span>
                  <button 
                    type="button" 
                    onClick={handleClearUsageFiles} 
                    className="text-rose-500 hover:underline text-2xs cursor-pointer"
                    disabled={loading}
                  >
                    選択解除
                  </button>
                </div>
                <div className="space-y-1.5">
                  {usageFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs">
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-2xs shrink-0">{idx + 1}</span>
                        <span className="truncate">{file.name}</span>
                        <span className="text-2xs text-slate-400 font-medium">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
                      </div>
                      {!loading && (
                        <button 
                          type="button" 
                          onClick={() => handleRemoveUsageFile(idx)} 
                          className="text-slate-400 hover:text-rose-500 p-1 rounded transition-colors"
                          title="このファイルを削除"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button 
              onClick={handleImportUsage} 
              disabled={usageFiles.length === 0 || loading} 
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-black py-3.5 px-4 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              <Upload className="w-4 h-4 inline-block mr-1" />
              <span>{usageFiles.length > 1 ? `適用部（${usageFiles.length}ファイル一括）を更新する` : '適用部を更新する'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

