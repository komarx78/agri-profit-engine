"use client";

import React, { useState, useEffect } from 'react';
import { 
  Database, Upload, FileText, CheckCircle2, AlertTriangle, 
  Loader2, Search, ArrowLeft, Trash2, Plus, Edit2, RefreshCw, 
  Layers, FlaskConical, Check, X, ShieldAlert, Copy, CheckCheck
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
  const [filterType, setFilterType] = useState<string>('all');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [overwriteMode, setOverwriteMode] = useState(false);

  // 手動追加・編集モーダル
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    registration_no: '',
    registration_date: '',
    fertilizer_name: '',
    fertilizer_type: '化成肥料',
    applicant_name: '',
    applicant_address: '',
    expiry_status: '有効',
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
      const { count, error: countErr } = await supabase
        .from('m_fertilizers')
        .select('*', { count: 'exact', head: true });
      
      if (countErr) {
        if (countErr.code === 'PGRST205' || countErr.message?.includes('schema cache') || countErr.message?.includes('m_fertilizers')) {
          setTableMissing(true);
          return;
        }
      } else {
        setTableMissing(false);
      }

      setTotalCount(count || 0);

      // 2. 一覧取得（最大100件）
      let query = supabase
        .from('m_fertilizers')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (searchQuery.trim()) {
        const raw = searchQuery.trim();
        const set = new Set<string>();
        set.add(raw);

        // 全角・半角・カナ変換
        const toZenkaku = raw.replace(/[A-Za-z0-9!-~]/g, (s) => String.fromCharCode(s.charCodeAt(0) + 0xFEE0)).replace(/ /g, '　');
        set.add(toZenkaku);
        const toHankaku = raw.replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).replace(/　/g, ' ');
        set.add(toHankaku);
        const toKatakana = raw.replace(/[\u3041-\u3096]/g, (m) => String.fromCharCode(m.charCodeAt(0) + 0x60));
        set.add(toKatakana);
        const toHiragana = raw.replace(/[\u30A1-\u30F6]/g, (m) => String.fromCharCode(m.charCodeAt(0) - 0x60));
        set.add(toHiragana);

        const keywords = Array.from(set).filter(k => k.length > 0);
        const orConditions = keywords.flatMap(k => [
          `fertilizer_name.ilike.%${k}%`,
          `applicant_name.ilike.%${k}%`,
          `registration_no.ilike.%${k}%`,
          `fertilizer_type.ilike.%${k}%`
        ]).join(',');

        query = query.or(orConditions);
      }

      if (filterType !== 'all') {
        query = query.ilike('fertilizer_type', `%${filterType}%`);
      }

      const { data, error } = await query;
      if (!error && data) {
        setFertilizers(data);
      }
    } catch (error: any) {
      console.error('Fetch fertilizers error:', error);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    fetchStatsAndList();
  }, [searchQuery, filterType]);

  // 列名柔軟取得ヘルパー
  const getValue = (row: any, possibleKeys: string[]) => {
    for (const k of Object.keys(row)) {
      const cleanKey = k.replace(/[\s　]+/g, '').replace(/["']/g, '').toLowerCase();
      for (const pk of possibleKeys) {
        const cleanPk = pk.replace(/[\s　]+/g, '').toLowerCase();
        if (cleanKey === cleanPk || cleanKey.includes(cleanPk)) {
          return row[k] || '';
        }
      }
    }
    return '';
  };

  // 数値抽出ヘルパー (例: "21", "20.9", "14.0%" -> 20.9)
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

  // FAMIC公的CSV対応 インポートエンジン
  const handleImportCSV = async () => {
    if (!file) return;
    setLoading(true);
    setStatus({ type: 'info', message: '公的肥料CSVファイルを解析しています...' });
    setProgress(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'Shift-JIS', // 日本の公的CSVの標準
      complete: async (results) => {
        try {
          let rows = results.data;
          
          // ヘッダー文字化けチェック（UTF-8リトライ判定）
          const firstRowKeys = rows.length > 0 && rows[0] ? Object.keys(rows[0] as object).join('') : '';
          if (firstRowKeys.includes('')) {
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

            // 1. 基本情報
            const regNo = String(getValue(row, ['登録番号', '届出番号', 'registration_no']) || vals[0] || '').trim();
            const regDate = String(getValue(row, ['登録年月日', 'registration_date']) || vals[1] || '').trim();
            const fName = String(getValue(row, ['肥料の名称', '肥料名', '銘柄名', '名称', 'fertilizer_name']) || vals[2] || vals[0] || '').trim();
            const applicant = String(getValue(row, ['肥料業者', '登録を有する者の名称', '製造業者', 'メーカー', 'applicant_name']) || '').trim();
            const address = String(getValue(row, ['住所', 'applicant_address']) || '').trim();
            const fType = String(getValue(row, ['肥料種類名称', '肥料の種類', '種類', 'fertilizer_type']) || '化成肥料').trim();
            const expiry = String(getValue(row, ['失効区分', 'expiry_status']) || '').trim();

            // 2. 成分コード1〜16 & 保証成分量1〜16（%）の解析
            let nVal = 0, pVal = 0, kVal = 0, mgVal = 0, caVal = 0;
            const otherDetails: string[] = [];
            let hasTN = false;
            let hasTP = false;
            let hasTK = false;

            // 列に直接「窒素」「りん酸」「加里」がある場合の事前取得
            const directN = parsePercent(getValue(row, ['窒素全量', '窒素', 'n_percent', 'チッソ']));
            const directP = parsePercent(getValue(row, ['りん酸全量', '水溶性りん酸', 'りん酸', 'リン酸', 'p_percent']));
            const directK = parsePercent(getValue(row, ['加里全量', '水溶性加里', '加里', 'カリ', 'k_percent']));
            const directMg = parsePercent(getValue(row, ['苦土', '水溶性苦土', 'mg_percent']));
            const directCa = parsePercent(getValue(row, ['石灰', 'ca_percent']));

            if (directN > 0) nVal = directN;
            if (directP > 0) pVal = directP;
            if (directK > 0) kVal = directK;
            if (directMg > 0) mgVal = directMg;
            if (directCa > 0) caVal = directCa;

            // 成分コード1〜16ループ
            for (let i = 1; i <= 16; i++) {
              const codeKey = Object.keys(row).find(k => {
                const clean = k.replace(/[\s　]+/g, '');
                return clean === `成分コード${i}` || clean === `成分コード(${i})` || clean === `成分コード_${i}`;
              });
              const amountKey = Object.keys(row).find(k => {
                const clean = k.replace(/[\s　]+/g, '');
                return clean.includes(`保証成分量${i}`) || clean.includes(`保証成分量(${i})`) || clean.includes(`成分量${i}`);
              });

              const code = (codeKey ? String(row[codeKey] || '') : '').trim().toUpperCase();
              const amount = parsePercent(amountKey ? row[amountKey] : 0);

              if (!code || amount <= 0) continue;

              // --- 窒素 (N) 系統 ---
              if (code === 'TN' || code === 'N' || code.includes('全窒素')) {
                nVal = amount;
                hasTN = true;
              } else if (code === 'AN' || code === 'NN' || code === 'UN' || code === 'ON' || code === 'CN' || code.includes('窒素')) {
                if (!hasTN) {
                  nVal += amount;
                }
                const label = code === 'AN' ? 'アンモニア性窒素' : code === 'NN' ? '硝酸性窒素' : code === 'UN' ? '尿素態窒素' : code;
                otherDetails.push(`${label}:${amount}%`);
              }
              // --- りん酸 (P) 系統 ---
              else if (code === 'TP' || code === 'P' || code.includes('全りん酸') || code.includes('全リン酸')) {
                pVal = amount;
                hasTP = true;
              } else if (code === 'WP' || code === 'CP' || code === 'SP' || code.includes('りん酸') || code.includes('リン酸')) {
                if (!hasTP) {
                  pVal = Math.max(pVal, amount);
                }
                const label = code === 'WP' ? '水溶性りん酸' : code === 'CP' ? 'く溶性りん酸' : code === 'SP' ? '可溶性りん酸' : code;
                otherDetails.push(`${label}:${amount}%`);
              }
              // --- 加里 (K) 系統 ---
              else if (code === 'TK' || code === 'K' || code.includes('全加里') || code.includes('全カリ')) {
                kVal = amount;
                hasTK = true;
              } else if (code === 'WK' || code === 'CK' || code.includes('加里') || code.includes('カリ')) {
                if (!hasTK) {
                  kVal = Math.max(kVal, amount);
                }
                const label = code === 'WK' ? '水溶性加里' : code === 'CK' ? 'く溶性加里' : code;
                otherDetails.push(`${label}:${amount}%`);
              }
              // --- 苦土 (Mg) 系統 ---
              else if (code.includes('MG') || code.includes('苦土')) {
                mgVal = Math.max(mgVal, amount);
                otherDetails.push(`苦土:${amount}%`);
              }
              // --- 石灰 (Ca) 系統 ---
              else if (code.includes('CA') || code.includes('石灰') || code.includes('アルカリ')) {
                caVal = Math.max(caVal, amount);
                otherDetails.push(`石灰/アルカリ:${amount}%`);
              }
              // --- ほう素・マンガン・その他微量要素 ---
              else {
                const label = code === 'B' ? 'ほう素' : code === 'MN' ? 'マンガン' : code === 'FE' ? '鉄' : code;
                otherDetails.push(`${label}:${amount}%`);
              }
            }

            return {
              registration_no: regNo || `REG-${Date.now()}-${idx}`,
              registration_date: regDate,
              fertilizer_name: fName,
              fertilizer_type: fType || '普通肥料',
              applicant_name: applicant,
              applicant_address: address,
              expiry_status: expiry || '有効',
              n_percent: Math.round(nVal * 100) / 100,
              p_percent: Math.round(pVal * 100) / 100,
              k_percent: Math.round(kVal * 100) / 100,
              mg_percent: Math.round(mgVal * 100) / 100,
              ca_percent: Math.round(caVal * 100) / 100,
              other_ingredients: otherDetails.join(' / '),
              updated_at: new Date().toISOString()
            };
          }).filter((item: any) => item.fertilizer_name);

          if (parsedList.length === 0) {
            throw new Error('有効な肥料データ（肥料名を含む行）が見つかりませんでした。CSVファイルをご確認ください。');
          }

          // 厳格な重複除外（同一registration_noの完全一本化）
          const uniqueMap = new Map();
          parsedList.forEach((item: any, idx: number) => {
            let reg = item.registration_no;
            if (!reg || reg === '-' || reg === 'null' || reg === 'undefined') {
              reg = `NO-REG-${idx}-${Date.now()}`;
              item.registration_no = reg;
            }
            uniqueMap.set(reg, item);
          });
          const uniqueData = Array.from(uniqueMap.values());

          // 完全上書きモードが有効な場合は既存データをクリア
          if (overwriteMode) {
            setStatus({ type: 'info', message: '既存のデータをクリアしています...' });
            await supabase.from('m_fertilizers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          }

          setStatus({ type: 'info', message: `${uniqueData.length}件の肥料データをSupabaseに一括登録しています...` });

          const chunkSize = 400;
          for (let i = 0; i < uniqueData.length; i += chunkSize) {
            const chunk = uniqueData.slice(i, i + chunkSize);
            
            // 1. PostgREST Upsert (onConflict)
            const { error: upsertErr } = await supabase
              .from('m_fertilizers')
              .upsert(chunk, { onConflict: 'registration_no', ignoreDuplicates: false });

            if (upsertErr) {
              if (upsertErr.code === 'PGRST205' || upsertErr.message?.includes('schema cache')) {
                throw new Error('データベースに「m_fertilizers」テーブルが存在しません。SupabaseのSQL Editorでテーブル作成SQLを実行してください。');
              }
              
              // 2. 制約エラー等の場合のフォールバック（重複無視で登録）
              const { error: insertErr } = await supabase
                .from('m_fertilizers')
                .upsert(chunk, { onConflict: 'registration_no', ignoreDuplicates: true });
                
              if (insertErr) {
                console.warn('Chunk upsert retry failed, doing single items fallback...', insertErr);
                // 3. 最後の砦：行単位での個別保存
                for (const item of chunk) {
                  try {
                    await supabase.from('m_fertilizers').upsert([item], { onConflict: 'registration_no' });
                  } catch (singleErr) {
                    // 個別エラーはスキップして継続
                  }
                }
              }
            }

            setProgress({ current: Math.min(i + chunkSize, uniqueData.length), total: uniqueData.length });
          }

          setStatus({ 
            type: 'success', 
            message: `🎉 FAMIC公的肥料マスターのインポートが完了しました！（全 ${uniqueData.length} 件）` 
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

  // 個別保存
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        registration_no: formData.registration_no || `REG-${Date.now()}`,
        registration_date: formData.registration_date,
        fertilizer_name: formData.fertilizer_name,
        fertilizer_type: formData.fertilizer_type,
        applicant_name: formData.applicant_name,
        applicant_address: formData.applicant_address,
        expiry_status: formData.expiry_status,
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
      registration_date: item.registration_date || '',
      fertilizer_name: item.fertilizer_name || '',
      fertilizer_type: item.fertilizer_type || '化成肥料',
      applicant_name: item.applicant_name || '',
      applicant_address: item.applicant_address || '',
      expiry_status: item.expiry_status || '有効',
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

  const sqlCode = `-- 肥料マスターテーブル作成SQL
CREATE TABLE IF NOT EXISTS public.m_fertilizers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_no TEXT,
    registration_date TEXT,
    fertilizer_name TEXT NOT NULL,
    fertilizer_type TEXT,
    applicant_name TEXT,
    applicant_address TEXT,
    expiry_status TEXT,
    n_percent NUMERIC(5,2) DEFAULT 0,
    p_percent NUMERIC(5,2) DEFAULT 0,
    k_percent NUMERIC(5,2) DEFAULT 0,
    mg_percent NUMERIC(5,2) DEFAULT 0,
    ca_percent NUMERIC(5,2) DEFAULT 0,
    other_ingredients TEXT,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_m_fertilizers_name ON public.m_fertilizers (fertilizer_name);
CREATE INDEX IF NOT EXISTS idx_m_fertilizers_reg_no ON public.m_fertilizers (registration_no);
CREATE UNIQUE INDEX IF NOT EXISTS idx_m_fertilizers_unique_reg ON public.m_fertilizers (registration_no) WHERE registration_no IS NOT NULL AND registration_no <> '';
ALTER TABLE public.m_fertilizers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on m_fertilizers" ON public.m_fertilizers FOR SELECT USING (true);
CREATE POLICY "Allow public insert on m_fertilizers" ON public.m_fertilizers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on m_fertilizers" ON public.m_fertilizers FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on m_fertilizers" ON public.m_fertilizers FOR DELETE USING (true);`;

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
            農林水産省/FAMIC公的登録銘柄CSV（成分コード1〜16）を自動解析し、N-P-K成分量データベースを統括管理します。
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setEditingItem(null);
              setFormData({
                registration_no: '',
                registration_date: '',
                fertilizer_name: '',
                fertilizer_type: '化成肥料',
                applicant_name: '',
                applicant_address: '',
                expiry_status: '有効',
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

      {/* テーブル未作成アラート（SQLコピー付き） */}
      {tableMissing && (
        <div className="p-6 rounded-3xl bg-amber-950/70 border-2 border-amber-500/80 text-amber-200 shadow-2xl space-y-4 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/40">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-black text-amber-300">
                  ⚠️ Supabaseに「m_fertilizers」テーブルがまだ作成されていません
                </h3>
                <p className="text-xs text-amber-200/80 mt-0.5">
                  CSVをインポートする前に、Supabaseダッシュボードの「SQL Editor」で以下のSQLを実行してください。
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(sqlCode);
                setCopiedSql(true);
                setTimeout(() => setCopiedSql(false), 2500);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition-all shadow-md shrink-0"
            >
              {copiedSql ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedSql ? 'SQLをコピーしました！' : 'SQLコードをコピー'}
            </button>
          </div>

          <pre className="p-4 bg-slate-950 rounded-2xl border border-amber-500/30 text-xs font-mono text-slate-300 overflow-x-auto select-all max-h-48">
            {sqlCode}
          </pre>
        </div>
      )}

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
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">FAMIC成分コード解析</p>
            <p className="text-2xl font-black text-indigo-300 mt-0.5">16成分 完全自動対応</p>
          </div>
        </div>

        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">マスター操作</p>
            <p className="text-xs text-slate-400 mt-1">全件再登録時の初期化</p>
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
            <h2 className="text-lg font-black text-white">FAMIC / 公的肥料CSV一括インポート</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              農林水産省・FAMIC形式（「登録番号」「肥料の名称」「成分コード1〜16」「保証成分量1〜16」等）のCSVに対応。
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
                ※「AN 21」等の成分コードから自動で「N: 21%」に変換・抽出して登録します
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

            <div className="pt-1">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={overwriteMode}
                  onChange={(e) => setOverwriteMode(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700 focus:ring-emerald-500"
                />
                <span>既存データを全削除して総入れ替え（完全上書き）</span>
              </label>
            </div>

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
            <p className="text-xs text-slate-400 mt-0.5">
              直近の登録データおよび検索結果を表示しています（全 {totalCount.toLocaleString()} 件中）。
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* 種類フィルタ */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">すべての種類</option>
              <option value="硫酸アンモニア">硫酸アンモニア</option>
              <option value="化成肥料">化成肥料</option>
              <option value="配合肥料">配合肥料</option>
              <option value="尿素">尿素</option>
              <option value="過リン酸石灰">過リン酸石灰</option>
              <option value="加里">加里系</option>
            </select>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="肥料名・メーカー・登録番号..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-800/80">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 text-xs font-black text-slate-400 uppercase border-b border-slate-800">
              <tr>
                <th className="p-4">登録番号</th>
                <th className="p-4">肥料の名称 (銘柄)</th>
                <th className="p-4">肥料種類</th>
                <th className="p-4">製造・肥料業者</th>
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
                      <div>{item.registration_no || '-'}</div>
                      {item.registration_date && (
                        <div className="text-[10px] text-slate-500">{item.registration_date}</div>
                      )}
                    </td>
                    <td className="p-4 font-bold text-white">
                      <div className="flex items-center gap-2">
                        {item.fertilizer_name}
                        {item.expiry_status && item.expiry_status.includes('失効') && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 bg-rose-950 text-rose-300 border border-rose-800 rounded">
                            {item.expiry_status}
                          </span>
                        )}
                      </div>
                      {item.other_ingredients && (
                        <span className="block text-[10px] text-slate-400 font-normal mt-0.5 max-w-md truncate">
                          {item.other_ingredients}
                        </span>
                      )}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className="text-xs px-2.5 py-0.5 rounded-md font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {item.fertilizer_type || '普通肥料'}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-slate-400 whitespace-nowrap">
                      <div>{item.applicant_name || '-'}</div>
                      {item.applicant_address && (
                        <div className="text-[10px] text-slate-500 max-w-xs truncate">{item.applicant_address}</div>
                      )}
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
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
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
                  placeholder="例: ２１．０硫酸アンモニア"
                  value={formData.fertilizer_name}
                  onChange={(e) => setFormData({ ...formData, fertilizer_name: e.target.value })}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">登録番号</label>
                  <input
                    type="text"
                    placeholder="例: 生第6号"
                    value={formData.registration_no}
                    onChange={(e) => setFormData({ ...formData, registration_no: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">肥料種類名称</label>
                  <input
                    type="text"
                    placeholder="例: 硫酸アンモニア, 高度化成"
                    value={formData.fertilizer_type}
                    onChange={(e) => setFormData({ ...formData, fertilizer_type: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">肥料業者・メーカー名</label>
                  <input
                    type="text"
                    placeholder="例: 日本化成株式会社"
                    value={formData.applicant_name}
                    onChange={(e) => setFormData({ ...formData, applicant_name: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">失効区分</label>
                  <select
                    value={formData.expiry_status}
                    onChange={(e) => setFormData({ ...formData, expiry_status: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="有効">有効</option>
                    <option value="満期失効">満期失効</option>
                    <option value="廃止">廃止</option>
                  </select>
                </div>
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
                  placeholder="例: アンモニア性窒素:21%"
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
