"use client";

import React, { useState, useEffect } from 'react';
import { 
  Database, Upload, FileText, CheckCircle2, AlertTriangle, 
  Loader2, Search, ArrowLeft, Trash2, Plus, Edit2, RefreshCw, 
  Layers, FlaskConical, Check, X, ShieldAlert 
} from 'lucide-react';
import Papa from 'papaparse';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';

export default function AdminFertilizersPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  // 統計・データステート
  const [totalCount, setTotalCount] = useState<number>(0);
  const [fertilizers, setFertilizers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  // 手動追加・編集モーダル
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    registration_no: '',
    fertilizer_name: '',
    fertilizer_type: '化成肥料',
    applicant_name: '',
    n_percent: '0',
    p_percent: '0',
    k_percent: '0',
    mg_percent: '0',
    ca_percent: '0',
    other_ingredients: ''
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetchStatsAndList = async () => {
    setPreviewLoading(true);
    try {
      // 1. 総件数
      const { count } = await supabase
        .from('m_fertilizers')
        .select('*', { count: 'exact', head: true });
      setTotalCount(count || 0);

      // 2. 直近・検索一覧（最大100件）
      let query = supabase
        .from('m_fertilizers')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (searchQuery.trim()) {
        query = query.or(`fertilizer_name.ilike.%${searchQuery.trim()}%,applicant_name.ilike.%${searchQuery.trim()}%,registration_no.ilike.%${searchQuery.trim()}%`);
      }

      const { data, error } = await query;
      if (!error && data) {
        setFertilizers(data);
      }
    } catch (error) {
      console.error('Fetch fertilizers error:', error);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    fetchStatsAndList();
  }, [searchQuery]);

  // CSV列名ゆらぎ自動取得ヘルパー
  const getValue = (row: any, possibleKeys: string[]) => {
    for (const k of Object.keys(row)) {
      const cleanKey = k.replace(/[\s　]+/g, '').replace(/["']/g, '').toLowerCase();
      for (const pk of possibleKeys) {
        const cleanPk = pk.replace(/[\s　]+/g, '').toLowerCase();
        if (cleanKey.includes(cleanPk)) {
          return row[k] || '';
        }
      }
    }
    return '';
  };

  // 数値抽出ヘルパー (例: "14.0%" -> 14.0, "0" -> 0)
  const parsePercent = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const str = String(val).trim();
    const match = str.match(/[-+]?[0-9]*\.?[0-9]+/);
    if (match) {
      const num = parseFloat(match[0]);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  };

  // CSV一括インポート処理
  const handleImportCSV = async () => {
    if (!file) return;
    setLoading(true);
    setStatus({ type: 'info', message: 'CSVファイルを解析しています...' });
    setProgress(null);

    // エンコーディング自動判定（Shift-JIS or UTF-8）
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'Shift-JIS', // 日本の公的CSVの多くはShift-JIS
      complete: async (results) => {
        try {
          let rows = results.data;
          
          // ヘッダーが文字化けしている場合のUTF-8リトライ判定
          const firstRowKeys = rows.length > 0 ? Object.keys(rows[0]).join('') : '';
          if (firstRowKeys.includes('')) {
            console.log('Shift-JIS文字化け検知。UTF-8で再パースします...');
            const utf8Results: any = await new Promise((resolve) => {
              Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                encoding: 'UTF-8',
                complete: resolve
              });
            });
            rows = utf8Results.data;
          }

          const parsedList = rows.map((row: any, idx: number) => {
            const vals = Object.values(row);
            
            const regNo = String(getValue(row, ['登録番号', '届出番号', 'registration_no', '番号']) || vals[0] || '').trim();
            const fName = String(getValue(row, ['肥料の名称', '肥料名', '銘柄名', '名称', 'fertilizer_name', '品名']) || vals[1] || vals[2] || '').trim();
            const fType = String(getValue(row, ['肥料の種類', '種類', 'fertilizer_type', '規格']) || vals[2] || vals[1] || '化成肥料').trim();
            const applicant = String(getValue(row, ['登録を有する者の名称', '製造業者', '業者名', 'メーカー', 'applicant_name']) || vals[3] || '').trim();

            const n = parsePercent(getValue(row, ['窒素全量', '窒素', 'n_percent', 'チッソ', 'n']));
            const p = parsePercent(getValue(row, ['りん酸全量', '水溶性りん酸', 'りん酸', 'リン酸', 'p_percent', 'p']));
            const k = parsePercent(getValue(row, ['加里全量', '水溶性加里', '加里', 'カリ', 'k_percent', 'k']));
            const mg = parsePercent(getValue(row, ['苦土', '水溶性苦土', 'mg_percent', 'mg']));
            const ca = parsePercent(getValue(row, ['石灰', 'ca_percent', 'ca']));
            const other = String(getValue(row, ['その他', '含有成分', '備考', 'other_ingredients']) || '').trim();

            return {
              registration_no: regNo || `REG-${Date.now()}-${idx}`,
              fertilizer_name: fName,
              fertilizer_type: fType || '普通肥料',
              applicant_name: applicant,
              n_percent: n,
              p_percent: p,
              k_percent: k,
              mg_percent: mg,
              ca_percent: ca,
              other_ingredients: other,
              updated_at: new Date().toISOString()
            };
          }).filter((item: any) => item.fertilizer_name);

          if (parsedList.length === 0) {
            throw new Error('有効な肥料データ（肥料名を含む行）が1件も見つかりませんでした。CSVの列名を確認してください。');
          }

          // 重複除去（登録番号または名称+メーカー単位）
          const uniqueMap = new Map();
          parsedList.forEach((item: any) => {
            const key = item.registration_no || `${item.fertilizer_name}_${item.applicant_name}`;
            uniqueMap.set(key, item);
          });
          const uniqueData = Array.from(uniqueMap.values());

          setStatus({ type: 'info', message: `${uniqueData.length}件の肥料データをSupabaseに一括登録しています...` });

          const chunkSize = 500;
          const totalChunks = Math.ceil(uniqueData.length / chunkSize);

          for (let i = 0; i < uniqueData.length; i += chunkSize) {
            const chunk = uniqueData.slice(i, i + chunkSize);
            const { error } = await supabase
              .from('m_fertilizers')
              .upsert(chunk, { onConflict: 'registration_no' });

            if (error) {
              // 登録番号のユニーク衝突等がある場合は通常insert
              const { error: insertErr } = await supabase.from('m_fertilizers').insert(chunk);
              if (insertErr) {
                console.warn('Upsert fallback warning:', insertErr);
              }
            }

            setProgress({ current: Math.min(i + chunkSize, uniqueData.length), total: uniqueData.length });
          }

          setStatus({ 
            type: 'success', 
            message: `🎉 肥料マスターのインポートが完了しました！（全 ${uniqueData.length} 件）` 
          });
          setFile(null);
          fetchStatsAndList();
        } catch (err: any) {
          console.error(err);
          setStatus({ type: 'error', message: `インポートエラー: ${err.message || 'CSVの解析に失敗しました'}` });
        } finally {
          setLoading(false);
          setProgress(null);
        }
      }
    });
  };

  // 全件リセット
  const handleClearAll = async () => {
    if (!confirm('⚠️ 【警告】本当に全ての肥料マスターデータを削除しますか？\n（この操作は取り消せません）')) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('m_fertilizers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      setStatus({ type: 'success', message: '全肥料データをリセットしました。' });
      fetchStatsAndList();
    } catch (err: any) {
      setStatus({ type: 'error', message: `削除エラー: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  // 個別保存（新規 or 編集）
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        registration_no: formData.registration_no || `REG-${Date.now()}`,
        fertilizer_name: formData.fertilizer_name,
        fertilizer_type: formData.fertilizer_type,
        applicant_name: formData.applicant_name,
        n_percent: parseFloat(formData.n_percent) || 0,
        p_percent: parseFloat(formData.p_percent) || 0,
        k_percent: parseFloat(formData.k_percent) || 0,
        mg_percent: parseFloat(formData.mg_percent) || 0,
        ca_percent: parseFloat(formData.ca_percent) || 0,
        other_ingredients: formData.other_ingredients,
        updated_at: new Date().toISOString()
      };

      if (editingItem && editingItem.id) {
        const { error } = await supabase.from('m_fertilizers').update(payload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('m_fertilizers').insert([payload]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      setEditingItem(null);
      fetchStatsAndList();
    } catch (err: any) {
      alert(`保存に失敗しました: ${err.message}`);
    }
  };

  const handleOpenEdit = (item: any) => {
    setEditingItem(item);
    setFormData({
      registration_no: item.registration_no || '',
      fertilizer_name: item.fertilizer_name || '',
      fertilizer_type: item.fertilizer_type || '化成肥料',
      applicant_name: item.applicant_name || '',
      n_percent: String(item.n_percent || 0),
      p_percent: String(item.p_percent || 0),
      k_percent: String(item.k_percent || 0),
      mg_percent: String(item.mg_percent || 0),
      ca_percent: String(item.ca_percent || 0),
      other_ingredients: item.other_ingredients || ''
    });
    setIsModalOpen(true);
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('この肥料データを削除しますか？')) return;
    try {
      const { error } = await supabase.from('m_fertilizers').delete().eq('id', id);
      if (error) throw error;
      fetchStatsAndList();
    } catch (err: any) {
      alert(`削除エラー: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      
      {/* ヘッダー */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
            <ShieldAlert className="w-4 h-4" />
            Super Admin Portal
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <FlaskConical className="w-8 h-8 text-emerald-400" />
            全国肥料公的マスター管理
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            農林水産省・FAMIC等の登録肥料銘柄CSVを一括インポートし、N-P-K成分量データベースを統括管理します。
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setEditingItem(null);
              setFormData({
                registration_no: '',
                fertilizer_name: '',
                fertilizer_type: '化成肥料',
                applicant_name: '',
                n_percent: '0',
                p_percent: '0',
                k_percent: '0',
                mg_percent: '0',
                ca_percent: '0',
                other_ingredients: ''
              });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            手動で肥料を追加
          </button>
          <button
            onClick={fetchStatsAndList}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
            title="最新情報に更新"
          >
            <RefreshCw className={`w-4 h-4 ${previewLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ステータスメッセージ */}
      {status && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 ${
          status.type === 'success' ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300' :
          status.type === 'error' ? 'bg-rose-950/60 border-rose-500/50 text-rose-300' :
          'bg-indigo-950/60 border-indigo-500/50 text-indigo-300'
        }`}>
          {status.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> :
           status.type === 'error' ? <AlertTriangle className="w-5 h-5 shrink-0" /> :
           <Loader2 className="w-5 h-5 shrink-0 animate-spin" />}
          <div className="flex-1 text-sm font-bold">{status.message}</div>
          <button onClick={() => setStatus(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 統計・件数サマリーカード */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">登録肥料 総件数</p>
            <p className="text-2xl font-black text-white mt-0.5">
              {totalCount.toLocaleString()} <span className="text-xs font-normal text-slate-400">件</span>
            </p>
          </div>
        </div>

        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <FlaskConical className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">N-P-K成分 照合可能</p>
            <p className="text-2xl font-black text-indigo-300 mt-0.5">100% リアルタイム</p>
          </div>
        </div>

        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">データベース操作</p>
            <p className="text-xs text-slate-400 mt-1">全件再登録時のリセット</p>
          </div>
          <button
            onClick={handleClearAll}
            disabled={loading || totalCount === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            全件クリア
          </button>
        </div>
      </div>

      {/* CSVインポートセクション */}
      <div className="bg-slate-950 p-6 md:p-8 rounded-3xl border border-slate-800 shadow-lg space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-800/80 pb-4">
          <div className="p-2 bg-emerald-600/20 text-emerald-400 rounded-xl border border-emerald-500/20">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">肥料CSV一括インポート</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              農林水産省/FAMICデータ、または独自の肥料CSVファイル（Shift-JIS / UTF-8）を選択してください。
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="md:col-span-2">
            <label className="border-2 border-dashed border-slate-700 hover:border-emerald-500/50 bg-slate-900/50 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors text-center">
              <FileText className="w-10 h-10 text-slate-500 mb-2" />
              <span className="text-sm font-bold text-slate-200">
                {file ? file.name : 'ここに肥料CSVファイルをドラッグ＆ドロップ、またはクリックして選択'}
              </span>
              <span className="text-xs text-slate-500 mt-1">
                ※「肥料名」「窒素(N)」「りん酸(P)」「加里(K)」等の列を自動判定してインポートします
              </span>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setFile(e.target.files[0]);
                  }
                }}
              />
            </label>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleImportCSV}
              disabled={!file || loading}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-base"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  インポート実行中...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  CSVを一括登録する
                </>
              )}
            </button>

            {progress && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-400 font-bold">
                  <span>進捗状況</span>
                  <span>{progress.current.toLocaleString()} / {progress.total.toLocaleString()} 件</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* データベース検索・一覧テーブル */}
      <div className="bg-slate-950 rounded-3xl border border-slate-800 shadow-lg overflow-hidden space-y-4 p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              登録済み 肥料マスター一覧
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">直近の登録データおよび検索結果を表示しています。</p>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="肥料名・メーカー・登録番号で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-800/80">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 text-xs font-black text-slate-400 uppercase border-b border-slate-800">
              <tr>
                <th className="p-4">登録番号</th>
                <th className="p-4">肥料の名称 (銘柄)</th>
                <th className="p-4">種類</th>
                <th className="p-4">製造・メーカー</th>
                <th className="p-4 text-center">N - P - K 保証成分比率</th>
                <th className="p-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {previewLoading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    データを読み込んでいます...
                  </td>
                </tr>
              ) : fertilizers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500">
                    登録されている肥料データがありません。上のフォームからCSVをインポートしてください。
                  </td>
                </tr>
              ) : (
                fertilizers.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="p-4 text-xs font-mono text-slate-400 whitespace-nowrap">
                      {item.registration_no || '-'}
                    </td>
                    <td className="p-4 font-bold text-white">
                      {item.fertilizer_name}
                      {item.other_ingredients && (
                        <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                          {item.other_ingredients}
                        </span>
                      )}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className="text-xs px-2.5 py-0.5 rounded-md font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {item.fertilizer_type || '化成肥料'}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-slate-400 whitespace-nowrap">
                      {item.applicant_name || '-'}
                    </td>
                    <td className="p-4 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 font-mono text-xs font-black">
                        <span className="px-2 py-0.5 bg-blue-950 text-blue-300 border border-blue-800 rounded">
                          N {item.n_percent}%
                        </span>
                        <span className="px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-800 rounded">
                          P {item.p_percent}%
                        </span>
                        <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded">
                          K {item.k_percent}%
                        </span>
                        {(item.mg_percent > 0 || item.ca_percent > 0) && (
                          <span className="text-[10px] text-slate-400 ml-1">
                            {item.mg_percent > 0 ? `Mg:${item.mg_percent}% ` : ''}
                            {item.ca_percent > 0 ? `Ca:${item.ca_percent}%` : ''}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-colors"
                          title="編集"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1.5 text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 rounded-lg transition-colors"
                          title="削除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 手動追加・編集モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-emerald-400" />
                {editingItem ? '肥料マスターの編集' : '新規肥料の手動登録'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">肥料の名称 (銘柄名) *</label>
                <input
                  type="text"
                  required
                  placeholder="例: オール14号化成"
                  value={formData.fertilizer_name}
                  onChange={(e) => setFormData({ ...formData, fertilizer_name: e.target.value })}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">登録番号 / 届出番号</label>
                  <input
                    type="text"
                    placeholder="例: 生第12345号"
                    value={formData.registration_no}
                    onChange={(e) => setFormData({ ...formData, registration_no: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">肥料の種類</label>
                  <select
                    value={formData.fertilizer_type}
                    onChange={(e) => setFormData({ ...formData, fertilizer_type: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="化成肥料">高度化成・化成肥料</option>
                    <option value="単肥">単肥 (硫安・尿素等)</option>
                    <option value="有機質肥料">有機質肥料 (油粕・鶏糞等)</option>
                    <option value="液肥">液肥・葉面散布剤</option>
                    <option value="微量要素複合">微量要素・土壌改良材</option>
                    <option value="普通肥料">その他普通肥料</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">製造業者・メーカー名</label>
                <input
                  type="text"
                  placeholder="例: 〇〇アグリ株式会社"
                  value={formData.applicant_name}
                  onChange={(e) => setFormData({ ...formData, applicant_name: e.target.value })}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* N-P-K 保証成分 */}
              <div>
                <label className="block text-xs font-bold text-emerald-400 mb-1.5">保証成分比率 (%)</label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-[10px] text-blue-400 font-bold block mb-0.5">窒素 (N %)</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={formData.n_percent}
                      onChange={(e) => setFormData({ ...formData, n_percent: e.target.value })}
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
                      value={formData.p_percent}
                      onChange={(e) => setFormData({ ...formData, p_percent: e.target.value })}
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
                      value={formData.k_percent}
                      onChange={(e) => setFormData({ ...formData, k_percent: e.target.value })}
                      className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block mb-0.5">苦土 (Mg %)</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={formData.mg_percent}
                    onChange={(e) => setFormData({ ...formData, mg_percent: e.target.value })}
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-slate-500"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block mb-0.5">石灰 (Ca %)</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={formData.ca_percent}
                    onChange={(e) => setFormData({ ...formData, ca_percent: e.target.value })}
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">その他成分・特徴・備考</label>
                <input
                  type="text"
                  placeholder="例: 微量要素入り、緩効性チッソ配合"
                  value={formData.other_ingredients}
                  onChange={(e) => setFormData({ ...formData, other_ingredients: e.target.value })}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white font-bold text-sm"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  保存する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
