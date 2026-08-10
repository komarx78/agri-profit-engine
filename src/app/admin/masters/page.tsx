"use client";

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Database, User, Sprout, MapPin, Package, Banknote, Upload, CheckCircle2, Download, Plus, Edit2, Trash2, X, Loader2 } from 'lucide-react';
import Papa from 'papaparse';

type MasterType = 'materials' | 'sales_prices' | 'crops' | 'fields' | 'workers';

export default function MastersPage() {
  const [crops, setCrops] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [salesPrices, setSalesPrices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadStatus, setUploadStatus] = useState<{type: string, message: string} | null>(null);

  // モーダル・CRUD状態管理
  const [modalType, setModalType] = useState<MasterType | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null); // null = 新規作成
  const [formData, setFormData] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRefMats = useRef<HTMLInputElement>(null);
  const fileInputRefPrices = useRef<HTMLInputElement>(null);
  const fileInputRefCrops = useRef<HTMLInputElement>(null);
  const fileInputRefFields = useRef<HTMLInputElement>(null);
  const fileInputRefWorkers = useRef<HTMLInputElement>(null);

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

  // --- CRUD (モーダル) 処理 ---
  const handleOpenModal = (type: MasterType, item: any = null) => {
    setModalType(type);
    setEditingItem(item);
    if (item) {
      setFormData({ ...item });
    } else {
      // 新規作成時の初期値
      if (type === 'workers') setFormData({ name: '', hourly_wage: 1000, pin_code: '0000' });
      else if (type === 'materials') setFormData({ name: '', unit: '', default_price: 0 });
      else if (type === 'sales_prices') setFormData({ crop_name: '', channel_name: '', price_per_unit: 0 });
      else setFormData({ name: '' });
    }
  };

  const handleCloseModal = () => {
    setModalType(null);
    setEditingItem(null);
    setFormData({});
  };

  const handleSave = async () => {
    if (!modalType) return;
    setIsSaving(true);
    
    try {
      const table = modalType;
      
      // Validation
      if (['crops', 'fields', 'workers', 'materials'].includes(table) && !formData.name) {
        throw new Error('名前は必須です');
      }
      if (table === 'sales_prices' && (!formData.crop_name || !formData.channel_name)) {
        throw new Error('作目名と販路名は必須です');
      }

      let query;
      if (editingItem) {
        // 更新
        query = supabase.from(table).update(formData).eq('id', editingItem.id);
      } else {
        // 新規作成
        // IDは自動生成されるためformDataから削除(念のため)
        const { id, created_at, ...insertData } = formData;
        query = supabase.from(table).insert([insertData]);
      }

      const { error } = await query;
      if (error) throw error;
      
      setUploadStatus({ type: 'success', message: '保存しました！' });
      setTimeout(() => setUploadStatus(null), 3000);
      handleCloseModal();
      fetchMasters(); // 再取得
    } catch (err: any) {
      alert(`保存エラー: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (type: MasterType, id: string) => {
    if (!confirm('本当に削除しますか？\n（このマスタを使用している過去の作業記録がある場合、削除できないことがあります）')) return;
    
    try {
      setUploadStatus({ type: 'info', message: '削除中...' });
      const { error } = await supabase.from(type).delete().eq('id', id);
      if (error) throw error;
      
      setUploadStatus({ type: 'success', message: '削除しました' });
      setTimeout(() => setUploadStatus(null), 3000);
      fetchMasters();
    } catch (err: any) {
      alert(`削除エラー: ${err.message}`);
      setUploadStatus(null);
    }
  };


  // --- CSVアップロード処理 ---
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, type: MasterType) => {
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
          } else if (type === 'crops') {
            insertData = data.map((row: any) => ({ name: row['作目名'] || row.name }));
            const { error } = await supabase.from('crops').insert(insertData);
            if (error) throw error;
          } else if (type === 'fields') {
            insertData = data.map((row: any) => ({ name: row['圃場名'] || row.name }));
            const { error } = await supabase.from('fields').insert(insertData);
            if (error) throw error;
          } else if (type === 'workers') {
            insertData = data.map((row: any) => ({
              name: row['作業者名'] || row.name,
              hourly_wage: parseFloat(row['時給']) || parseFloat(row.hourly_wage) || 1000,
              pin_code: String(row['暗証番号'] || row.pin_code || '0000').padStart(4, '0').slice(0,4)
            }));
            const { error } = await supabase.from('workers').insert(insertData);
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
  const handleDownloadTemplate = (type: MasterType) => {
    let content = "";
    if (type === 'materials') content = "資材名,単位,単価\n苦土石灰,袋,1500\n化成肥料(8-8-8),kg,200\n液肥アミノ酸,L,800";
    else if (type === 'sales_prices') content = "作目名,販路名,単価\n伏見唐辛子,JA,500\n伏見唐辛子,直売所,650\n米（キヌヒカリ）,JA,12000";
    else if (type === 'crops') content = "作目名\n伏見唐辛子\n米\n九条ネギ";
    else if (type === 'fields') content = "圃場名\nA-1 ハウス\n北側 第2農地\n南側 露地";
    else if (type === 'workers') content = "作業者名,時給,暗証番号\n京都 太郎,1000,1234\n農場 花子,1100,5678";
    
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template_${type}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportData = (type: MasterType) => {
    let data: Record<string, any>[] = [];
    if (type === 'materials') data = materials.map(m => ({ '資材名': m.name, '単位': m.unit, '単価': m.default_price }));
    else if (type === 'sales_prices') data = salesPrices.map(s => ({ '作目名': s.crop_name, '販路名': s.channel_name, '単価': s.price_per_unit }));
    else if (type === 'crops') data = crops.map(c => ({ '作目名': c.name }));
    else if (type === 'fields') data = fields.map(f => ({ '圃場名': f.name }));
    else if (type === 'workers') data = workers.map(w => ({ '作業者名': w.name, '時給': w.hourly_wage, '暗証番号': w.pin_code || '0000' }));
      
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

  const CardHeader = ({ icon: Icon, title, type }: { icon: any, title: string, type: MasterType }) => (
    <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
      <div className="flex items-center gap-2 text-slate-800 font-bold text-lg">
        <Icon className="w-5 h-5 text-emerald-600" />
        {title}
      </div>
      <button 
        onClick={() => handleOpenModal(type)}
        className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-3 py-1 rounded-lg text-sm font-bold flex items-center gap-1 transition-colors"
      >
        <Plus className="w-4 h-4" />追加
      </button>
    </div>
  );

  const CsvActionButtons = ({ type, inputRef }: { type: MasterType, inputRef: React.RefObject<HTMLInputElement | null> }) => (
    <div className="pt-4 border-t border-slate-100 space-y-3 mt-auto">
      <div className="flex gap-2">
        <button 
          onClick={() => handleDownloadTemplate(type)}
          className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-xs flex items-center justify-center gap-2 transition-colors"
        >
          <Download className="w-3 h-3" />雛形DL
        </button>
        <button 
          onClick={() => handleExportData(type)}
          className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg text-xs flex items-center justify-center gap-2 transition-colors"
        >
          <Download className="w-3 h-3" />データDL
        </button>
      </div>
      <input 
        type="file" 
        accept=".csv" 
        className="hidden" 
        ref={inputRef as React.RefObject<HTMLInputElement>}
        onChange={(e) => handleFileUpload(e, type)}
      />
      <button 
        onClick={() => inputRef.current?.click()}
        className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"
      >
        <Upload className="w-4 h-4" />CSVで一括追加
      </button>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12 relative">
      <div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
          <Database className="w-8 h-8 text-emerald-600" />
          マスタ管理
        </h1>
        <p className="text-slate-500 mt-2 font-medium">現場の入力画面に表示される選択肢や、計算用の単価データの一覧です。画面から直接追加・編集できます。</p>
      </div>

      {uploadStatus && (
        <div className={`p-4 rounded-xl flex items-center justify-center gap-3 font-bold sticky top-20 z-10 shadow-lg ${
          uploadStatus.type === 'success' ? 'bg-emerald-500 text-white' :
          uploadStatus.type === 'error' ? 'bg-red-500 text-white' :
          'bg-blue-500 text-white'
        }`}>
          {uploadStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <Loader2 className="w-5 h-5 animate-spin" />}
          {uploadStatus.message}
        </div>
      )}

      {isLoading ? (
        <div className="p-12 flex justify-center text-emerald-600">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : (
        <>
          <h2 className="text-xl font-bold text-slate-700 mt-8 mb-4 border-b-2 border-slate-200 inline-block pb-1">基本マスタ</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* 作目一覧 */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[420px]">
              <CardHeader icon={Sprout} title={`作目 (${crops.length})`} type="crops" />
              <div className="space-y-2 overflow-y-auto flex-1 mb-4 pr-1">
                {crops.length === 0 ? <p className="text-slate-400 text-sm">データなし</p> : null}
                {crops.map(c => (
                  <div key={c.id} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 flex justify-between items-center group transition-colors">
                    <span className="font-bold text-slate-700">{c.name}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleOpenModal('crops', c)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete('crops', c.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <CsvActionButtons type="crops" inputRef={fileInputRefCrops} />
            </div>

            {/* 圃場一覧 */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[420px]">
              <CardHeader icon={MapPin} title={`圃場 (${fields.length})`} type="fields" />
              <div className="space-y-2 overflow-y-auto flex-1 mb-4 pr-1">
                {fields.length === 0 ? <p className="text-slate-400 text-sm">データなし</p> : null}
                {fields.map(f => (
                  <div key={f.id} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 flex justify-between items-center group transition-colors">
                    <span className="font-bold text-slate-700">{f.name}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleOpenModal('fields', f)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete('fields', f.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <CsvActionButtons type="fields" inputRef={fileInputRefFields} />
            </div>

            {/* 作業者一覧 */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[420px]">
              <CardHeader icon={User} title={`作業者 (${workers.length})`} type="workers" />
              <div className="space-y-2 overflow-y-auto flex-1 mb-4 pr-1">
                {workers.length === 0 ? <p className="text-slate-400 text-sm">データなし</p> : null}
                {workers.map(w => (
                  <div key={w.id} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 flex justify-between items-center group transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-700">{w.name}</span>
                        <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-bold">PIN: {w.pin_code || '0000'}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">時給: ¥{w.hourly_wage}</div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleOpenModal('workers', w)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete('workers', w.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <CsvActionButtons type="workers" inputRef={fileInputRefWorkers} />
            </div>
          </div>

          {/* 単価・計算用マスタ */}
          <div className="flex items-center justify-between mt-12 mb-4">
            <h2 className="text-xl font-bold text-slate-700 border-b-2 border-slate-200 pb-1">単価・計算用マスタ</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* 資材マスタ */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[450px]">
              <CardHeader icon={Package} title={`資材・農薬 (${materials.length})`} type="materials" />
              
              <div className="space-y-2 overflow-y-auto flex-1 mb-4 pr-1">
                {materials.length === 0 ? <p className="text-slate-400 text-sm">データなし</p> : null}
                {materials.map(m => (
                  <div key={m.id} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 flex justify-between items-center group transition-colors">
                    <div>
                      <div className="font-bold text-slate-700">{m.name}</div>
                      <div className="text-xs text-slate-400">{m.unit}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="font-bold text-emerald-600">¥{m.default_price}</div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleOpenModal('materials', m)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete('materials', m.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <CsvActionButtons type="materials" inputRef={fileInputRefMats} />
            </div>

            {/* 販売価格マスタ */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[450px]">
              <CardHeader icon={Banknote} title={`販売価格 (${salesPrices.length})`} type="sales_prices" />
              
              <div className="space-y-2 overflow-y-auto flex-1 mb-4 pr-1">
                {salesPrices.length === 0 ? <p className="text-slate-400 text-sm">データなし</p> : null}
                {salesPrices.map(s => (
                  <div key={s.id} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 flex justify-between items-center group transition-colors">
                    <div>
                      <div className="font-bold text-slate-700">{s.crop_name}</div>
                      <div className="text-xs text-slate-400">販路: {s.channel_name}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="font-bold text-blue-600">¥{s.price_per_unit}</div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleOpenModal('sales_prices', s)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete('sales_prices', s.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <CsvActionButtons type="sales_prices" inputRef={fileInputRefPrices} />
            </div>

          </div>
        </>
      )}

      {/* --- モーダルダイアログ --- */}
      {modalType && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-black text-slate-800">
                {editingItem ? 'データを編集' : '新規追加'}
              </h3>
              <button onClick={handleCloseModal} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* 作目 / 圃場 / 資材 / 作業者 共通 */}
              {['crops', 'fields', 'materials', 'workers'].includes(modalType) && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">名前 (必須)</label>
                  <input 
                    type="text" 
                    value={formData.name || ''} 
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-bold"
                    placeholder="例: 伏見唐辛子"
                  />
                </div>
              )}

              {/* 作業者専用 */}
              {modalType === 'workers' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">時給 (円)</label>
                      <input 
                        type="number" 
                        value={formData.hourly_wage || ''} 
                        onChange={e => setFormData({...formData, hourly_wage: Number(e.target.value)})}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">ログイン暗証番号 (4桁)</label>
                      <input 
                        type="text" 
                        maxLength={4}
                        value={formData.pin_code || ''} 
                        onChange={e => setFormData({...formData, pin_code: e.target.value.replace(/[^0-9]/g, '')})}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-bold tracking-widest text-center"
                        placeholder="0000"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* 資材専用 */}
              {modalType === 'materials' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">単位</label>
                    <input 
                      type="text" 
                      value={formData.unit || ''} 
                      onChange={e => setFormData({...formData, unit: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-bold"
                      placeholder="例: kg, 袋, L"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">単価 (円)</label>
                    <input 
                      type="number" 
                      value={formData.default_price || ''} 
                      onChange={e => setFormData({...formData, default_price: Number(e.target.value)})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-bold text-emerald-700"
                    />
                  </div>
                </div>
              )}

              {/* 販売価格専用 */}
              {modalType === 'sales_prices' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">作目名 (必須)</label>
                    <input 
                      type="text" 
                      value={formData.crop_name || ''} 
                      onChange={e => setFormData({...formData, crop_name: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-bold"
                      placeholder="例: 伏見唐辛子"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">販路名 (必須)</label>
                    <input 
                      type="text" 
                      value={formData.channel_name || ''} 
                      onChange={e => setFormData({...formData, channel_name: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-bold"
                      placeholder="例: JA, 直売所, スーパーA"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">販売単価 (円)</label>
                    <input 
                      type="number" 
                      value={formData.price_per_unit || ''} 
                      onChange={e => setFormData({...formData, price_per_unit: Number(e.target.value)})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-bold text-blue-700"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="p-4 bg-slate-50 flex gap-3">
              <button 
                onClick={handleCloseModal}
                disabled={isSaving}
                className="flex-1 py-3 text-slate-500 font-bold bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                キャンセル
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 py-3 text-white font-bold bg-emerald-600 rounded-xl hover:bg-emerald-700 shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : '保存する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
