"use client";

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Database, User, Sprout, MapPin, Package, Banknote, Upload, CheckCircle2, Download } from 'lucide-react';
import Papa from 'papaparse';

export default function MastersPage() {
  const [crops, setCrops] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [salesPrices, setSalesPrices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadStatus, setUploadStatus] = useState<{type: string, message: string} | null>(null);

  const fileInputRefMats = useRef<HTMLInputElement>(null);
  const fileInputRefPrices = useRef<HTMLInputElement>(null);

  const fetchMasters = async () => {
    try {
      setIsLoading(true);
      const [cRes, fRes, wRes, mRes, spRes] = await Promise.all([
        supabase.from('crops').select('*').order('name'),
        supabase.from('fields').select('*').order('name'),
        supabase.from('workers').select('*').order('name'),
        supabase.from('materials').select('*').order('name'),
        supabase.from('sales_prices').select('*').order('crop_name')
      ]);
      
      setCrops(cRes.data || []);
      setFields(fRes.data || []);
      setWorkers(wRes.data || []);
      setMaterials(mRes.data || []);
      setSalesPrices(spRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMasters();
  }, []);

  // --- CSVアップロード処理 ---
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, type: 'materials' | 'sales_prices') => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadStatus({ type: 'info', message: '読み込み中...' });

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const data = results.data;
          let insertData = [];

          if (type === 'materials') {
            insertData = data.map((row: any) => ({
              name: row['資材名'] || row.name,
              unit: row['単位'] || row.unit,
              default_price: parseFloat(row['単価']) || parseFloat(row.price) || 0
            }));
            const { error } = await supabase.from('materials').insert(insertData);
            if (error) throw error;
          } else if (type === 'sales_prices') {
            insertData = data.map((row: any) => ({
              crop_name: row['作目名'] || row.crop_name,
              channel_name: row['販路名'] || row.channel_name,
              price_per_unit: parseFloat(row['単価']) || parseFloat(row.price) || 0
            }));
            const { error } = await supabase.from('sales_prices').insert(insertData);
            if (error) throw error;
          }

          setUploadStatus({ type: 'success', message: '一括登録が完了しました！' });
          fetchMasters(); // 再取得
          
          setTimeout(() => setUploadStatus(null), 3000);
        } catch (error: any) {
          console.error(error);
          setUploadStatus({ type: 'error', message: `エラーが発生しました: ${error.message}` });
        }
        
        event.target.value = '';
      },
      error: (error) => {
        setUploadStatus({ type: 'error', message: `CSVの読み込みに失敗しました: ${error.message}` });
      }
    });
  };

  // --- CSVダウンロード・エクスポート処理 ---
  const handleDownloadTemplate = (type: 'materials' | 'sales_prices') => {
    const content = type === 'materials' 
      ? "資材名,単位,単価\n苦土石灰,袋,1500\n化成肥料(8-8-8),kg,200\n液肥アミノ酸,L,800" 
      : "作目名,販路名,単価\n伏見唐辛子,JA,500\n伏見唐辛子,直売所,650\n米（キヌヒカリ）,JA,12000";
    
    // Excelで文字化けしないようにBOM (Byte Order Mark) を付与
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template_${type}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportData = (type: 'materials' | 'sales_prices') => {
    const data: Record<string, any>[] = type === 'materials' 
      ? materials.map(m => ({ '資材名': m.name, '単位': m.unit, '単価': m.default_price }))
      : salesPrices.map(s => ({ '作目名': s.crop_name, '販路名': s.channel_name, '単価': s.price_per_unit }));
      
    if (data.length === 0) {
      alert("エクスポートするデータがありません。");
      return;
    }
    
    const csv = Papa.unparse(data);
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export_current_${type}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const CardHeader = ({ icon: Icon, title, count }: { icon: any, title: string, count: number }) => (
    <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
      <div className="flex items-center gap-2 text-slate-800 font-bold text-lg">
        <Icon className="w-5 h-5 text-emerald-600" />
        {title}
      </div>
      <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-sm font-medium">
        {count} 件
      </span>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
          <Database className="w-8 h-8 text-emerald-600" />
          マスタ管理
        </h1>
        <p className="text-slate-500 mt-2 font-medium">現場の入力画面に表示される選択肢や、計算用の単価データの一覧です。</p>
      </div>

      {uploadStatus && (
        <div className={`p-4 rounded-xl flex items-center gap-3 font-bold ${
          uploadStatus.type === 'success' ? 'bg-emerald-100 text-emerald-700' :
          uploadStatus.type === 'error' ? 'bg-red-100 text-red-700' :
          'bg-blue-100 text-blue-700'
        }`}>
          {uploadStatus.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
          {uploadStatus.message}
        </div>
      )}

      {isLoading ? (
        <div className="p-8 text-center text-slate-400 font-medium">データを読み込み中...</div>
      ) : (
        <>
          <h2 className="text-xl font-bold text-slate-700 mt-8 mb-4 border-b-2 border-slate-200 inline-block pb-1">基本マスタ</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* 作目一覧 */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-80 flex flex-col">
              <CardHeader icon={Sprout} title="作目（作物）" count={crops.length} />
              <div className="space-y-2 overflow-y-auto flex-1">
                {crops.length === 0 ? <p className="text-slate-400 text-sm">データなし</p> : null}
                {crops.map(c => (
                  <div key={c.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                    <span className="font-bold text-slate-700">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 圃場一覧 */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-80 flex flex-col">
              <CardHeader icon={MapPin} title="圃場（場所）" count={fields.length} />
              <div className="space-y-2 overflow-y-auto flex-1">
                {fields.length === 0 ? <p className="text-slate-400 text-sm">データなし</p> : null}
                {fields.map(f => (
                  <div key={f.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                    <span className="font-bold text-slate-700">{f.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 作業者一覧 */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-80 flex flex-col">
              <CardHeader icon={User} title="作業者・スタッフ" count={workers.length} />
              <div className="space-y-2 overflow-y-auto flex-1">
                {workers.length === 0 ? <p className="text-slate-400 text-sm">データなし</p> : null}
                {workers.map(w => (
                  <div key={w.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-700">{w.name}</span>
                    </div>
                    {w.hourly_wage > 0 && (
                      <span className="text-xs text-slate-400 mt-1">時給設定: ¥{w.hourly_wage}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 新規マスタセクション */}
          <div className="flex items-center justify-between mt-12 mb-4">
            <h2 className="text-xl font-bold text-slate-700 border-b-2 border-slate-200 pb-1">単価・計算用マスタ（CSVインポート/エクスポート）</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* 資材マスタ */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[450px]">
              <CardHeader icon={Package} title="資材・農薬マスタ" count={materials.length} />
              
              <div className="space-y-2 overflow-y-auto flex-1 mb-4">
                {materials.length === 0 ? (
                  <div className="text-slate-400 text-sm text-center pt-8">
                    CSVをアップロードして資材を登録してください。<br/>
                    (ヘッダー行: 資材名, 単位, 単価)
                  </div>
                ) : null}
                {materials.map(m => (
                  <div key={m.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-700">{m.name}</div>
                      <div className="text-xs text-slate-400">{m.unit}</div>
                    </div>
                    <div className="font-bold text-emerald-600">¥{m.default_price}</div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleDownloadTemplate('materials')}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    雛形DL
                  </button>
                  <button 
                    onClick={() => handleExportData('materials')}
                    className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    現在データDL
                  </button>
                </div>
                
                <input 
                  type="file" 
                  accept=".csv" 
                  className="hidden" 
                  ref={fileInputRefMats}
                  onChange={(e) => handleFileUpload(e, 'materials')}
                />
                <button 
                  onClick={() => fileInputRefMats.current?.click()}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  資材マスタCSVをアップロード
                </button>
              </div>
            </div>

            {/* 販売価格マスタ */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[450px]">
              <CardHeader icon={Banknote} title="販売価格マスタ" count={salesPrices.length} />
              
              <div className="space-y-2 overflow-y-auto flex-1 mb-4">
                {salesPrices.length === 0 ? (
                  <div className="text-slate-400 text-sm text-center pt-8">
                    CSVをアップロードして販売価格を登録してください。<br/>
                    (ヘッダー行: 作目名, 販路名, 単価)
                  </div>
                ) : null}
                {salesPrices.map(s => (
                  <div key={s.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-700">{s.crop_name}</div>
                      <div className="text-xs text-slate-400">販路: {s.channel_name}</div>
                    </div>
                    <div className="font-bold text-blue-600">¥{s.price_per_unit}</div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleDownloadTemplate('sales_prices')}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    雛形DL
                  </button>
                  <button 
                    onClick={() => handleExportData('sales_prices')}
                    className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    現在データDL
                  </button>
                </div>

                <input 
                  type="file" 
                  accept=".csv" 
                  className="hidden" 
                  ref={fileInputRefPrices}
                  onChange={(e) => handleFileUpload(e, 'sales_prices')}
                />
                <button 
                  onClick={() => fileInputRefPrices.current?.click()}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  販売価格マスタCSVをアップロード
                </button>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
