"use client";

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { HelpTooltip } from '@/components/HelpTooltip';
import { Database, User, Sprout, MapPin, Package, Banknote, Upload, CheckCircle2, Download, Plus, Edit2, Trash2, X, Loader2, ListTree, AlignLeft, Coffee, Briefcase, FlaskConical, Wheat, Truck, Smartphone, MessageSquare, Search, Table, LayoutGrid } from 'lucide-react';
import Papa from 'papaparse';
import { autoTranslateMasterData } from '@/app/actions/translate';
import { getCurrentTenantId } from '@/lib/tenant';
import { LineLinkModal } from '@/components/LineLinkModal';

type MasterType = 'materials' | 'pesticides' | 'fertilizers' | 'sales_prices' | 'crops' | 'fields' | 'workers' | 'departments' | 'sales_channels';

// 4桁英数字のLINE専用連携コード生成（視認性の高い32文字）
const generateLineLinkCode = (): string => {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const MATERIAL_CATEGORIES = [
  '諸材料費',
  '種苗費',
  '肥料費',
  '農薬費',
  '動力光熱費',
  '機械・車両費',
  'その他経費'
];

export default function MastersPage() {
  const [crops, setCrops] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [salesPrices, setSalesPrices] = useState<any[]>([]);
  const [cropStandards, setCropStandards] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadStatus, setUploadStatus] = useState<{type: string, message: string} | null>(null);
  const [selectedWorkerForLine, setSelectedWorkerForLine] = useState<any | null>(null);

  // モーダル・CRUD状態管理
  const [modalType, setModalType] = useState<MasterType | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null); // null = 新規作成
  const [formData, setFormData] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);

  // コピー機能用ステート
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copySource, setCopySource] = useState("");
  const [copyTarget, setCopyTarget] = useState("");
  const [isCopying, setIsCopying] = useState(false);

  // 販売価格マスタの表示モード ('byCrop' | 'byChannel')
  const [priceViewMode, setPriceViewMode] = useState<'byCrop' | 'byChannel'>('byCrop');

  // 生産・資材統合管理コンソール用の状態管理
  const [materialSearchQuery, setMaterialSearchQuery] = useState("");
  const [materialActiveTab, setMaterialActiveTab] = useState<'all' | 'pesticide' | 'fertilizer' | 'other'>('all');
  const [materialViewMode, setMaterialViewMode] = useState<'card' | 'table'>('table');
  const [pesticideSubFilter, setPesticideSubFilter] = useState<'all' | 'insecticide' | 'fungicide' | 'herbicide'>('all');

  const fileInputRefMats = useRef<HTMLInputElement>(null);
  const fileInputRefPesticides = useRef<HTMLInputElement>(null);
  const fileInputRefFertilizers = useRef<HTMLInputElement>(null);
  const fileInputRefPrices = useRef<HTMLInputElement>(null);
  const fileInputRefCrops = useRef<HTMLInputElement>(null);
  const fileInputRefFields = useRef<HTMLInputElement>(null);
  const fileInputRefWorkers = useRef<HTMLInputElement>(null);
  const fileInputRefChannels = useRef<HTMLInputElement>(null);

  const fetchMasters = async () => {
    try {
      setIsLoading(true);
      const userId = await getCurrentTenantId();
      
      if (!userId) {
        // セッションが切れている場合はログイン画面へ
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return;
      }

      const [cRes, fRes, wRes, mRes, spRes, csRes, chRes, dRes] = await Promise.all([
        supabase.from('crops').select('*').eq('user_id', userId).order('name'),
        supabase.from('fields').select('*').eq('user_id', userId).order('name'),
        supabase.from('workers').select('*').eq('user_id', userId).order('name'),
        supabase.from('materials').select('*').eq('user_id', userId).order('name'),
        supabase.from('sales_prices').select('*').eq('user_id', userId).order('crop_name'),
        supabase.from('crop_standards').select('*'),
        supabase.from('sales_channels').select('*').eq('user_id', userId).order('name'),
        supabase.from('departments').select('*').eq('tenant_id', userId).order('name')
      ]);
      
      setCrops(cRes.data || []);
      setFields(fRes.data || []);

      // 未連携スタッフにLINE専用連携コードが未発行の場合、自動発行して画面＆DBに即時反映
      const rawWorkers = wRes.data || [];
      const populatedWorkers = rawWorkers.map(w => {
        if (!w.line_user_id && (!w.line_link_pin || w.line_link_pin.trim() === '')) {
          const generatedCode = generateLineLinkCode();
          supabase
            .from('workers')
            .update({ 
              line_link_pin: generatedCode,
              line_link_pin_expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
            })
            .eq('id', w.id)
            .then(() => {})
            .catch(() => {});
          return { ...w, line_link_pin: generatedCode };
        }
        return w;
      });
      setWorkers(populatedWorkers);

      setDepartments(dRes.data || []);
      setMaterials(mRes.data || []);
      setSalesPrices(spRes.data || []);
      setCropStandards(csRes.data || []);
      setChannels(chRes.data || []);
    } catch (err) {
      console.error('fetchMasters Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMasters();
  }, []);

  // --- CRUD (モーダル) 処理 ---
  const handleOpenModal = (type: MasterType, item: any = null, defaultValues: any = {}) => {
    setModalType(type);
    setEditingItem(item);
    if (item) {
      let initial = { ...item };
      if (type === 'crops') {
        const standard = cropStandards.find(s => s.crop_id === item.id);
        if (standard) {
          initial.seedlings_per_10a = standard.seedlings_per_10a;
          initial.materials_per_10a = standard.materials_per_10a || [];
        } else {
          initial.materials_per_10a = [];
        }
      }
      setFormData(initial);
    } else {
      const initial: any = { ...defaultValues };
      if (type === 'workers') {
        initial.name = initial.name || '';
        initial.hourly_wage = initial.hourly_wage || 1000;
        initial.pin_code = initial.pin_code || '0000';
      }
      else if (type === 'pesticides') {
        initial.name = initial.name || '';
        initial.material_type = 'pesticide';
        initial.category = '農薬費';
        initial.pesticide_type = initial.pesticide_type || '殺虫剤';
        initial.rac_code = initial.rac_code || '';
        initial.dilution = initial.dilution || '1000倍';
        initial.target_pests = initial.target_pests || '';
        initial.usage_time = initial.usage_time || '収穫前日まで';
        initial.max_count = initial.max_count || 3;
        initial.unit = initial.unit || '本';
        initial.default_price = initial.default_price || 0;
      }
      else if (type === 'fertilizers') {
        initial.name = initial.name || '';
        initial.material_type = 'fertilizer';
        initial.category = '肥料費';
        initial.fertilizer_type = initial.fertilizer_type || '化成肥料';
        initial.fertilizer_usage = initial.fertilizer_usage || '共通';
        initial.n_percent = initial.n_percent ?? 8;
        initial.p_percent = initial.p_percent ?? 8;
        initial.k_percent = initial.k_percent ?? 8;
        initial.bag_weight_kg = initial.bag_weight_kg ?? 20;
        initial.unit = initial.unit || '袋';
        initial.default_price = initial.default_price || 0;
      }
      else if (type === 'materials') {
        initial.name = initial.name || '';
        initial.material_type = 'general';
        initial.unit = initial.unit || '個';
        initial.default_price = initial.default_price || 0;
        initial.category = initial.category || '諸材料費';
      }
      else if (type === 'sales_prices') {
        initial.crop_name = initial.crop_name || '';
        initial.channel_name = initial.channel_name || '';
        initial.price_per_unit = initial.price_per_unit || 0;
      }
      else if (type === 'crops') {
        initial.name = initial.name || '';
        initial.seedlings_per_10a = initial.seedlings_per_10a || 0;
        initial.materials_per_10a = initial.materials_per_10a || [];
        initial.est_fuel_cost_10a = initial.est_fuel_cost_10a || 0;
        initial.est_machinery_cost_10a = initial.est_machinery_cost_10a || 0;
        initial.est_other_cost_10a = initial.est_other_cost_10a || 0;
      }
      else {
        initial.name = initial.name || '';
      }
      setFormData(initial);
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
      const table = (modalType === 'pesticides' || modalType === 'fertilizers') ? 'materials' : modalType;
      
      // Validation
      if (['crops', 'fields', 'workers', 'materials', 'pesticides', 'fertilizers', 'sales_channels'].includes(modalType) && !formData.name) {
        throw new Error('名前は必須です');
      }
      if (modalType === 'sales_prices' && (!formData.crop_name || !formData.channel_name)) {
        throw new Error('作目名と販路名は必須です');
      }

      let dataToSave = { ...formData };

      // 自動セット
      if (modalType === 'pesticides') {
        dataToSave.material_type = 'pesticide';
        dataToSave.category = '農薬費';
      } else if (modalType === 'fertilizers') {
        dataToSave.material_type = 'fertilizer';
        dataToSave.category = '肥料費';
      }

      // テナントIDを取得してセット
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('テナントIDが特定できません。ログイン状態を確認してください。');
      if (table === 'departments') {
        dataToSave.tenant_id = tenantId;
      } else {
        dataToSave.user_id = tenantId;
      }

      if (['crops', 'fields', 'materials', 'pesticides', 'fertilizers', 'sales_channels'].includes(modalType) && dataToSave.name) {
        setUploadStatus({ type: 'info', message: '多言語翻訳を生成中...' });
        const translations = await autoTranslateMasterData(dataToSave.name);
        dataToSave = { ...dataToSave, ...translations };
      }

      // cropsテーブルには存在しないカラムを除外する
      if (table === 'crops') {
        delete dataToSave.seedlings_per_10a;
        delete dataToSave.materials_per_10a;
      }

      // sales_prices 保存時
      if (table === 'sales_prices' && dataToSave.channel_name) {
        const existsInChannels = channels.some(ch => ch.name === dataToSave.channel_name);
        if (!existsInChannels) {
          await supabase.from('sales_channels').insert([{ 
            name: dataToSave.channel_name,
            user_id: tenantId 
          }]);
        }
        delete dataToSave.isCustomChannel;
      }

      let query;
      let insertedId = editingItem?.id;
      let savedData: any = null;
      
      if (editingItem) {
        let updateQuery = supabase.from(table).update(dataToSave).eq('id', editingItem.id);
        if (tenantId) {
          updateQuery = (table === 'departments') ? updateQuery.eq('tenant_id', tenantId) : updateQuery.eq('user_id', tenantId);
        }
        const { data, error } = await updateQuery.select();
        if (error) {
          console.warn('Update failed with multilang, retrying with fallback:', error);
          // 多言語カラムを除去してリトライ
          const fallbackData = { ...dataToSave };
          delete fallbackData.name_en;
          delete fallbackData.name_vi;
          delete fallbackData.name_id;
          delete fallbackData.name_zh;
          delete fallbackData.name_si;
          delete fallbackData.name_km;
          let retryQuery = supabase.from(table).update(fallbackData).eq('id', editingItem.id);
          if (tenantId) {
            retryQuery = (table === 'departments') ? retryQuery.eq('tenant_id', tenantId) : retryQuery.eq('user_id', tenantId);
          }
          const { data: retryData, error: retryErr } = await retryQuery.select();
          if (retryErr) throw retryErr;
          savedData = retryData;
        } else {
          savedData = data;
        }
      } else {
        const { id, created_at, ...insertData } = dataToSave;
        const { data, error } = await supabase.from(table).insert([insertData]).select();
        if (error) {
          console.warn('Insert failed with multilang, retrying with fallback:', error);
          // 多言語カラムを除去してリトライ
          const fallbackInsert = { ...insertData };
          delete fallbackInsert.name_en;
          delete fallbackInsert.name_vi;
          delete fallbackInsert.name_id;
          delete fallbackInsert.name_zh;
          delete fallbackInsert.name_si;
          delete fallbackInsert.name_km;
          const { data: retryData, error: retryErr } = await supabase.from(table).insert([fallbackInsert]).select();
          if (retryErr) throw retryErr;
          savedData = retryData;
        } else {
          savedData = data;
        }
      }
      
      if (!insertedId && savedData && savedData.length > 0) {
        insertedId = savedData[0].id;
      }
      
      // 作目の場合は基準値も保存
      if (table === 'crops' && insertedId) {
        // formData.seedlings_per_10a が入力されていれば保存、なければ削除
        if (formData.seedlings_per_10a || formData.seedlings_per_10a === 0 || formData.materials_per_10a) {
          const standardData = {
            crop_id: insertedId,
            variety: formData.variety || null,
            seedlings_per_10a: Number(formData.seedlings_per_10a) || 0,
            materials_per_10a: formData.materials_per_10a || []
          };
          
          // 一旦既存の基準があるか確認
          const { data: existingStandard } = await supabase
            .from('crop_standards')
            .select('id')
            .eq('crop_id', insertedId)
            .is('variety', null) // シンプル化のため一旦variety=nullの基本基準として扱う
            .single();
            
          if (existingStandard) {
            await supabase.from('crop_standards').update(standardData).eq('id', existingStandard.id);
          } else {
            await supabase.from('crop_standards').insert([standardData]);
          }
        }
      }
      
      setUploadStatus({ type: 'success', message: '保存・翻訳完了しました！' });
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
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('テナントIDが特定できません。ログイン状態を確認してください。');
      const table = (type === 'pesticides' || type === 'fertilizers') ? 'materials' : type;
      const deleteQuery = supabase.from(table).delete().eq('id', id);
      const scopedDelete = (table === 'departments') ? deleteQuery.eq('tenant_id', tenantId) : deleteQuery.eq('user_id', tenantId);
      const { error } = await scopedDelete;
      if (error) throw error;
      
      setUploadStatus({ type: 'success', message: '削除しました' });
      setTimeout(() => setUploadStatus(null), 3000);
      fetchMasters();
    } catch (err: any) {
      alert(`削除エラー: ${err.message}`);
      setUploadStatus(null);
    }
  };

  const handleCopyChannel = async () => {
    if (!copySource || !copyTarget) {
      alert('コピー元と新しい販路名の両方を入力してください');
      return;
    }
    
    setIsCopying(true);
    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('テナントIDが特定できません');

      // コピー元のデータを取得
      const sourceData = salesPrices.filter(sp => sp.channel_name === copySource);
      if (sourceData.length === 0) {
        throw new Error('指定されたコピー元のデータが見つかりません');
      }

      // コピー先のデータを作成
      const insertData = sourceData.map(sp => ({
        user_id: tenantId,
        crop_name: sp.crop_name,
        channel_name: copyTarget,
        price_per_unit: sp.price_per_unit
      }));

      // 一括追加
      const { error } = await supabase.from('sales_prices').insert(insertData);
      if (error) throw error;

      // もし sales_channels に存在しなければ自動登録
      const existsInChannels = channels.some(ch => ch.name === copyTarget);
      if (!existsInChannels) {
        await supabase.from('sales_channels').insert([{ 
          name: copyTarget,
          user_id: tenantId
        }]);
      }

      setUploadStatus({ type: 'success', message: `${copyTarget} として一括追加しました！` });
      setTimeout(() => setUploadStatus(null), 3000);
      setIsCopyModalOpen(false);
      setCopySource("");
      setCopyTarget("");
      fetchMasters();
    } catch (err: any) {
      alert(`コピーエラー: ${err.message}`);
    } finally {
      setIsCopying(false);
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
          const tenantId = await getCurrentTenantId();
          if (!tenantId) throw new Error('テナントIDが特定できません');

          const data = results.data;
          let insertData = [];

          if (type === 'materials') {
            insertData = data.map((row: any) => ({
              user_id: tenantId,
              name: row['資材名'] || row.name,
              category: row['カテゴリ'] || row.category || '未設定',
              specification: row['規格'] || row.specification || null,
              unit: row['単位'] || row.unit,
              default_price: parseFloat(row['単価']) || parseFloat(row.price) || 0
            }));
            const { error } = await supabase.from('materials').insert(insertData);
            if (error) throw error;
          } else if (type === 'sales_prices') {
            insertData = data.map((row: any) => ({
              user_id: tenantId,
              crop_name: row['作目名'] || row.crop_name,
              channel_name: row['販路名'] || row.channel_name,
              price_per_unit: parseFloat(row['単価']) || parseFloat(row.price) || 0
            }));
            const { error } = await supabase.from('sales_prices').insert(insertData);
            if (error) throw error;
          } else if (type === 'crops') {
            insertData = data.map((row: any) => ({ 
              user_id: tenantId,
              name: row['作目名'] || row.name 
            }));
            const { error } = await supabase.from('crops').insert(insertData);
            if (error) throw error;
          } else if (type === 'fields') {
            insertData = data.map((row: any) => ({ 
              user_id: tenantId,
              name: row['圃場名'] || row.name,
              area_size: parseFloat(row['面積(a)']) || parseFloat(row.area_size) || null
            }));
            const { error } = await supabase.from('fields').insert(insertData);
            if (error) throw error;
          } else if (type === 'workers') {
            insertData = data.map((row: any) => ({
              user_id: tenantId,
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
    if (type === 'materials') content = "資材名,カテゴリ,規格,単位,単価\n苦土石灰,肥料費,20kg袋,袋,1500\n化成肥料(8-8-8),肥料費,20kg袋,袋,2500\n液肥アミノ酸,肥料費,1L,L,800";
    else if (type === 'sales_prices') content = "作目名,販路名,単価\n伏見唐辛子,JA,500\n伏見唐辛子,直売所,650\n米（キヌヒカリ）,JA,12000";
    else if (type === 'crops') content = "作目名\n伏見唐辛子\n米\n九条ネギ";
    else if (type === 'fields') content = "圃場名,面積(a)\nA-1 ハウス,10\n北側 第2農地,24\n南側 露地,14";
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
    if (type === 'materials') data = materials.map(m => ({ '資材名': m.name, 'カテゴリ': m.category || '未設定', '規格': m.specification || '', '単位': m.unit, '単価': m.default_price }));
    else if (type === 'sales_prices') data = salesPrices.map(s => ({ '作目名': s.crop_name, '販路名': s.channel_name, '単価': s.price_per_unit }));
    else if (type === 'crops') data = crops.map(c => ({ '作目名': c.name }));
    else if (type === 'fields') data = fields.map(f => ({ '圃場名': f.name, '面積(a)': f.area_size || '' }));
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

  const CardHeader = ({ icon: Icon, title, type }: { icon: any, title: string, type: MasterType }) => {
    let helpContent = "";
    if (type === 'materials') helpContent = "肥料や農薬などの資材を登録します。登録すると作業記録の際に選べるようになります。";
    else if (type === 'sales_prices') helpContent = "作目ごとの販売価格（単価）を登録します。JAや直売所など、販路別に異なる単価を設定できます。";
    else if (type === 'crops') helpContent = "栽培する作目を登録します。登録した作目は、作業記録や売上登録の際に選択肢として表示されます。";
    else if (type === 'fields') helpContent = "農地（圃場）を登録します。面積を入力しておくと、ダッシュボードでの利益分析に活用できます。";
    else if (type === 'workers') helpContent = "農作業を行うスタッフを登録します。時給を設定すると、ダッシュボードで人件費として自動計算されます。";

    return (
      <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3 gap-2">
        <div className="flex items-center gap-1.5 text-slate-800 font-bold text-base sm:text-lg min-w-0">
          <Icon className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="truncate">{title}</span>
          <HelpTooltip content={helpContent} />
        </div>
        <button 
          onClick={() => handleOpenModal(type)}
          className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-2.5 py-1 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1 transition-colors shrink-0 whitespace-nowrap cursor-pointer shadow-2xs"
        >
          <Plus className="w-3.5 h-3.5" />追加
        </button>
      </div>
    );
  };

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

  // 販売価格マスタのグルーピング処理
  const getGroupedSalesPrices = () => {
    const groups: { [key: string]: any[] } = {};
    
    salesPrices.forEach(sp => {
      const groupKey = priceViewMode === 'byCrop' ? sp.crop_name : sp.channel_name;
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(sp);
    });
    
    return groups;
  };
  const groupedSalesPrices = getGroupedSalesPrices();

  // 生産・資材の統合フィルタリングロジック
  const countAll = materials.length;
  const countPesticide = materials.filter(m => m.material_type === 'pesticide' || m.category === '農薬費').length;
  const countFertilizer = materials.filter(m => m.material_type === 'fertilizer' || m.category === '肥料費').length;
  const countOther = materials.filter(m => m.material_type !== 'pesticide' && m.material_type !== 'fertilizer' && m.category !== '農薬費' && m.category !== '肥料費').length;

  const filteredMaterials = materials.filter(m => {
    // 1. 分類タブによるフィルタ
    const isPest = m.material_type === 'pesticide' || m.category === '農薬費';
    const isFert = m.material_type === 'fertilizer' || m.category === '肥料費';
    const isOth = !isPest && !isFert;

    if (materialActiveTab === 'pesticide' && !isPest) return false;
    if (materialActiveTab === 'fertilizer' && !isFert) return false;
    if (materialActiveTab === 'other' && !isOth) return false;

    // 2. 農薬選択時のサブフィルター（殺虫・殺菌・除草）
    if (materialActiveTab === 'pesticide' && pesticideSubFilter !== 'all') {
      const typeStr = `${m.pesticide_type || ''} ${m.specification || ''} ${m.name || ''}`.toLowerCase();
      if (pesticideSubFilter === 'insecticide' && !typeStr.includes('殺虫') && !typeStr.includes('インセクト')) return false;
      if (pesticideSubFilter === 'fungicide' && !typeStr.includes('殺菌') && !typeStr.includes('ファンジ')) return false;
      if (pesticideSubFilter === 'herbicide' && !typeStr.includes('除草') && !typeStr.includes('ハービ')) return false;
    }

    // 3. リアルタイム検索クエリ（品名、公的登録番号、RAC、成分、規格、カテゴリ）
    if (materialSearchQuery.trim()) {
      const q = materialSearchQuery.trim().toLowerCase();
      const matchName = (m.name || '').toLowerCase().includes(q);
      const matchSpec = (m.specification || '').toLowerCase().includes(q);
      const matchRac = (m.rac_code || '').toLowerCase().includes(q);
      const matchCategory = (m.category || '').toLowerCase().includes(q);
      const matchDilution = (m.dilution || '').toLowerCase().includes(q);
      const matchUsage = (m.fertilizer_usage || '').toLowerCase().includes(q);
      const matchNpk = `${m.n_percent || 0}-${m.p_percent || 0}-${m.k_percent || 0}`.includes(q);
      
      if (!matchName && !matchSpec && !matchRac && !matchCategory && !matchDilution && !matchUsage && !matchNpk) {
        return false;
      }
    }

    return true;
  });

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
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
                      <span className="font-bold text-slate-700">{f.name}</span>
                      {f.area_size && <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap">{f.area_size}a</span>}
                      {f.polygon_coordinates && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold border border-emerald-200 whitespace-nowrap shrink-0 inline-block">マップ連携済</span>}
                    </div>
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
                  <div key={w.id} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 flex justify-between items-center group transition-colors gap-2">
                    <div className="space-y-1.5 flex-1 min-w-0 pr-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800 text-sm">{w.name}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-300 px-1.5 py-0.5 rounded font-mono font-bold whitespace-nowrap" title="現場打刻・ログイン用暗証番号（4桁）">
                          打刻PIN: {w.pin_code || '0000'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        {w.line_user_id ? (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-black flex items-center gap-1 border border-emerald-300 whitespace-nowrap">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> LINE連携済
                          </span>
                        ) : (
                          <div 
                            onClick={() => setSelectedWorkerForLine(w)} 
                            className="flex items-center gap-1.5 flex-wrap cursor-pointer group/line" 
                            title="クリックしてこのスタッフ専用のLINE連携案内を開く"
                          >
                            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold border border-amber-300 whitespace-nowrap">
                              LINE未連携
                            </span>
                            <span className="text-[11px] font-mono font-black text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded shadow-2xs whitespace-nowrap flex items-center gap-1 transition-colors" title="スタッフが公式LINEに送信する専用コード">
                              <span className="text-[9px] text-emerald-600 font-bold">LINEコード:</span>
                              <strong className="text-emerald-950 font-mono tracking-wider font-black">{w.line_link_pin || '----'}</strong>
                            </span>
                          </div>
                        )}
                        <span className="text-xs text-slate-400 whitespace-nowrap">時給: ¥{w.hourly_wage}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!w.line_user_id && (
                        <button 
                          onClick={() => setSelectedWorkerForLine(w)} 
                          className="px-2 py-1 text-emerald-700 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                          title="このスタッフ専用のLINE連携QR・コード案内を表示"
                        >
                          <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="hidden sm:inline">LINE案内</span>
                        </button>
                      )}
                      <button onClick={() => handleOpenModal('workers', w)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg opacity-60 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete('workers', w.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-60 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <CsvActionButtons type="workers" inputRef={fileInputRefWorkers} />
            </div>

            {/* 部署 */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[420px]">
              <CardHeader icon={Briefcase} title={`部署 (${departments.length})`} type="departments" />
              <div className="space-y-2 overflow-y-auto flex-1 mb-4 pr-1">
                {departments.length === 0 ? <p className="text-slate-400 text-sm">データなし</p> : null}
                {departments.map(d => (
                  <div key={d.id} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 flex justify-between items-center group transition-colors">
                    <span className="font-bold text-slate-700">{d.name}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleOpenModal('departments', d)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete('departments', d.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <CsvActionButtons type="departments" inputRef={undefined as any} />
            </div>
          </div>

              


              


              


          {/* 生産・資材マスタ（統合コンソール・フルワイド） */}
          <div className="mt-12 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
            {/* ヘッダー部: タイトル ＆ 新規追加ボタングループ */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <FlaskConical className="w-6 h-6 text-emerald-600 shrink-0" />
                  <h2 className="text-xl font-black text-slate-800 tracking-tight">生産・資材マスタ 統合管理コンソール</h2>
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-black px-2.5 py-0.5 rounded-full border border-emerald-300">
                    全 {countAll} 件
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  農薬・肥料・生産資材を一元管理。リアルタイム検索や分類フィルター、一覧表（Excel風）で直感操作できます。
                </p>
              </div>

              {/* 新規登録ボタングループ */}
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <button 
                  onClick={() => handleOpenModal('pesticides')}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  title="新しい農薬を登録（公的DB検索からも可能）"
                >
                  <Plus className="w-4 h-4" />農薬を追加
                </button>
                <button 
                  onClick={() => handleOpenModal('fertilizers')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  title="新しい肥料・施肥資材を登録"
                >
                  <Plus className="w-4 h-4" />肥料を追加
                </button>
                <button 
                  onClick={() => handleOpenModal('materials')}
                  className="bg-slate-700 hover:bg-slate-800 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  title="マルチや防虫ネットなどの資材を登録"
                >
                  <Plus className="w-4 h-4" />その他資材
                </button>
              </div>
            </div>

            {/* コントロールツールバー: 検索窓 ＋ 分類タブ ＋ 表示切替 */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              {/* 検索窓 */}
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={materialSearchQuery}
                  onChange={(e) => setMaterialSearchQuery(e.target.value)}
                  placeholder="商品名・公的登録番号・RAC・成分比率等で検索..."
                  className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-slate-400"
                />
                {materialSearchQuery && (
                  <button 
                    onClick={() => setMaterialSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-0.5 rounded-full hover:bg-slate-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* 分類タブ */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 overflow-x-auto shrink-0">
                <button
                  onClick={() => { setMaterialActiveTab('all'); setPesticideSubFilter('all'); }}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                    materialActiveTab === 'all' 
                      ? 'bg-slate-800 text-white shadow-2xs' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  すべて ({countAll})
                </button>
                <button
                  onClick={() => setMaterialActiveTab('pesticide')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                    materialActiveTab === 'pesticide' 
                      ? 'bg-teal-600 text-white shadow-2xs' 
                      : 'text-slate-600 hover:text-teal-700 hover:bg-teal-50'
                  }`}
                >
                  💊 農薬 ({countPesticide})
                </button>
                <button
                  onClick={() => setMaterialActiveTab('fertilizer')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                    materialActiveTab === 'fertilizer' 
                      ? 'bg-emerald-600 text-white shadow-2xs' 
                      : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  🌱 肥料 ({countFertilizer})
                </button>
                <button
                  onClick={() => setMaterialActiveTab('other')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                    materialActiveTab === 'other' 
                      ? 'bg-amber-600 text-white shadow-2xs' 
                      : 'text-slate-600 hover:text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  📦 その他資材 ({countOther})
                </button>
              </div>

              {/* 表示切替スイッチ (一覧表 ⇄ カード) */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center bg-white p-1 rounded-lg border border-slate-200">
                  <button
                    onClick={() => setMaterialViewMode('table')}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      materialViewMode === 'table'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="Excel風の一覧テーブルで一望"
                  >
                    <Table className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">一覧表</span>
                  </button>
                  <button
                    onClick={() => setMaterialViewMode('card')}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      materialViewMode === 'card'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="カード形式でゆったり確認"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">カード</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 農薬タブ選択時のサブフィルター（殺虫・殺菌・除草） */}
            {materialActiveTab === 'pesticide' && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 pl-1 flex-wrap">
                <span className="font-bold text-[11px] text-slate-400">農薬絞り込み:</span>
                <button
                  onClick={() => setPesticideSubFilter('all')}
                  className={`px-2 py-0.5 rounded-md font-bold text-[11px] transition-colors cursor-pointer ${
                    pesticideSubFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-200 bg-slate-100'
                  }`}
                >
                  すべて ({countPesticide})
                </button>
                <button
                  onClick={() => setPesticideSubFilter('insecticide')}
                  className={`px-2 py-0.5 rounded-md font-bold text-[11px] transition-colors cursor-pointer ${
                    pesticideSubFilter === 'insecticide' ? 'bg-rose-600 text-white' : 'text-rose-700 hover:bg-rose-100 bg-rose-50 border border-rose-200'
                  }`}
                >
                  🦟 殺虫剤
                </button>
                <button
                  onClick={() => setPesticideSubFilter('fungicide')}
                  className={`px-2 py-0.5 rounded-md font-bold text-[11px] transition-colors cursor-pointer ${
                    pesticideSubFilter === 'fungicide' ? 'bg-sky-600 text-white' : 'text-sky-700 hover:bg-sky-100 bg-sky-50 border border-sky-200'
                  }`}
                >
                  🍄 殺菌剤
                </button>
                <button
                  onClick={() => setPesticideSubFilter('herbicide')}
                  className={`px-2 py-0.5 rounded-md font-bold text-[11px] transition-colors cursor-pointer ${
                    pesticideSubFilter === 'herbicide' ? 'bg-amber-600 text-white' : 'text-amber-800 hover:bg-amber-100 bg-amber-50 border border-amber-200'
                  }`}
                >
                  🌿 除草剤
                </button>
              </div>
            )}

            {/* メイン一覧（テーブル or カード） */}
            {filteredMaterials.length === 0 ? (
              <div className="p-12 text-center bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-slate-500 font-bold text-sm">
                  {materialSearchQuery 
                    ? `「${materialSearchQuery}」に一致する資材は見つかりませんでした。` 
                    : '資材データが登録されていません。'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  上のボタン、またはCSV一括追加から登録してください。
                </p>
              </div>
            ) : materialViewMode === 'table' ? (
              /* 📊 一覧テーブル表示（Excel風） */
              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs max-h-[580px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10 backdrop-blur-xs">
                    <tr>
                      <th className="py-2.5 px-3 whitespace-nowrap">分類</th>
                      <th className="py-2.5 px-3 min-w-[180px]">品名</th>
                      <th className="py-2.5 px-3 min-w-[140px]">公的登録番号・仕様</th>
                      <th className="py-2.5 px-3 min-w-[150px]">成分・RAC・希釈</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">用途・荷姿</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">単価 (税込)</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredMaterials.map(m => {
                      const isPest = m.material_type === 'pesticide' || m.category === '農薬費';
                      const isFert = m.material_type === 'fertilizer' || m.category === '肥料費';
                      return (
                        <tr key={m.id} className="hover:bg-slate-50 transition-colors group">
                          {/* 分類バッジ */}
                          <td className="py-2 px-3 whitespace-nowrap">
                            {isPest ? (
                              <span className="text-[10px] bg-teal-100 text-teal-800 px-2 py-0.5 rounded font-black border border-teal-200">農薬</span>
                            ) : isFert ? (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-black border border-emerald-200">肥料</span>
                            ) : (
                              <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold border border-slate-200">{m.category || '資材'}</span>
                            )}
                          </td>
                          {/* 品名 */}
                          <td className="py-2 px-3 font-bold text-slate-800 text-sm">
                            {m.name}
                          </td>
                          {/* 登録番号・仕様 */}
                          <td className="py-2 px-3">
                            {m.specification ? (
                              <span className="text-[10px] bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded font-mono font-bold inline-block shadow-2xs">
                                {m.specification}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          {/* 成分・RAC・希釈 */}
                          <td className="py-2 px-3">
                            <div className="flex flex-wrap items-center gap-1">
                              {m.rac_code && (
                                <span className="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded font-bold border border-rose-200 whitespace-nowrap">
                                  RAC: {m.rac_code}
                                </span>
                              )}
                              {m.dilution && (
                                <span className="text-[10px] bg-teal-50 text-teal-800 px-1.5 py-0.5 rounded font-bold border border-teal-200 whitespace-nowrap">
                                  {m.dilution}
                                </span>
                              )}
                              {(m.n_percent !== undefined || m.p_percent !== undefined || m.k_percent !== undefined) && (
                                <span className="text-[10px] bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded font-black border border-emerald-300 font-mono whitespace-nowrap">
                                  N-P-K: {m.n_percent || 0}-{m.p_percent || 0}-{m.k_percent || 0}
                                </span>
                              )}
                            </div>
                          </td>
                          {/* 用途・荷姿 */}
                          <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {m.fertilizer_usage && (
                                <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold border border-blue-200">
                                  {m.fertilizer_usage}
                                </span>
                              )}
                              {m.max_count ? (
                                <span className="text-[10px] bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded font-bold border border-amber-200">
                                  上限{m.max_count}回
                                </span>
                              ) : null}
                              <span className="text-xs text-slate-500">
                                {m.bag_weight_kg ? `${m.bag_weight_kg}kg/袋` : m.unit ? `(${m.unit})` : ''}
                              </span>
                            </div>
                          </td>
                          {/* 単価 */}
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-800 text-sm whitespace-nowrap">
                            ¥{Number(m.default_price || 0).toLocaleString()}
                          </td>
                          {/* 操作 */}
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleOpenModal(isPest ? 'pesticides' : isFert ? 'fertilizers' : 'materials', m)}
                                className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                                title="編集"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete('materials', m.id)}
                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                title="削除"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* 🗂️ カード表示モード（フルワイドグリッド） */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[580px] overflow-y-auto pr-1">
                {filteredMaterials.map(m => {
                  const isPest = m.material_type === 'pesticide' || m.category === '農薬費';
                  const isFert = m.material_type === 'fertilizer' || m.category === '肥料費';
                  return (
                    <div key={m.id} className="p-3.5 bg-slate-50 hover:bg-slate-100/90 rounded-xl border border-slate-200/80 transition-colors group space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {isPest ? (
                              <span className="text-[9px] bg-teal-100 text-teal-800 px-1.5 py-0.2 rounded font-black border border-teal-200 shrink-0">農薬</span>
                            ) : isFert ? (
                              <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-black border border-emerald-200 shrink-0">肥料</span>
                            ) : (
                              <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-bold border border-slate-300 shrink-0">{m.category || '資材'}</span>
                            )}
                            <span className="font-bold text-slate-800 text-sm leading-snug break-words">
                              {m.name}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                          <span className="font-mono font-bold text-slate-800 text-sm whitespace-nowrap">
                            ¥{Number(m.default_price || 0).toLocaleString()}
                          </span>
                          <div className="flex items-center opacity-70 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleOpenModal(isPest ? 'pesticides' : isFert ? 'fertilizers' : 'materials', m)} className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded" title="編集">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete('materials', m.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" title="削除">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {m.specification && (
                        <div>
                          <span className="text-[10px] bg-slate-800 text-amber-300 px-2 py-0.5 rounded font-mono font-bold inline-flex items-center shadow-2xs max-w-full truncate" title={m.specification}>
                            {m.specification}
                          </span>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        {m.rac_code && (
                          <span className="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded font-bold border border-rose-200 whitespace-nowrap">
                            RAC: {m.rac_code}
                          </span>
                        )}
                        {m.dilution && (
                          <span className="text-[10px] bg-teal-50 text-teal-800 px-1.5 py-0.5 rounded font-bold border border-teal-200 whitespace-nowrap">
                            {m.dilution}
                          </span>
                        )}
                        {(m.n_percent !== undefined || m.p_percent !== undefined || m.k_percent !== undefined) && (
                          <span className="text-[10px] bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded font-black border border-emerald-300 font-mono whitespace-nowrap">
                            N-P-K: {m.n_percent || 0}-{m.p_percent || 0}-{m.k_percent || 0}
                          </span>
                        )}
                        {m.fertilizer_usage && (
                          <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold border border-blue-200 whitespace-nowrap">
                            {m.fertilizer_usage}
                          </span>
                        )}
                        {m.max_count ? (
                          <span className="text-[10px] bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded font-bold border border-amber-200 whitespace-nowrap">
                            上限{m.max_count}回
                          </span>
                        ) : null}
                        <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
                          {m.bag_weight_kg ? `${m.bag_weight_kg}kg/袋` : m.unit ? `(${m.unit})` : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* フッター: CSV一括処理バー */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
              <span className="text-slate-400 font-medium">
                表示中: <strong className="text-slate-700">{filteredMaterials.length}</strong> 件 / 全 {countAll} 件
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {/* 隠しファイル入力（各タイプ別） */}
                <input type="file" accept=".csv" className="hidden" ref={fileInputRefMats} onChange={(e) => handleFileUpload(e, 'materials')} />
                <input type="file" accept=".csv" className="hidden" ref={fileInputRefPesticides} onChange={(e) => handleFileUpload(e, 'pesticides')} />
                <input type="file" accept=".csv" className="hidden" ref={fileInputRefFertilizers} onChange={(e) => handleFileUpload(e, 'fertilizers')} />

                <button 
                  onClick={() => handleDownloadTemplate(materialActiveTab === 'pesticide' ? 'pesticides' : materialActiveTab === 'fertilizer' ? 'fertilizers' : 'materials')}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />雛形DL
                </button>
                <button 
                  onClick={() => handleExportData(materialActiveTab === 'pesticide' ? 'pesticides' : materialActiveTab === 'fertilizer' ? 'fertilizers' : 'materials')}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />データDL
                </button>
                <button 
                  onClick={() => {
                    if (materialActiveTab === 'pesticide') fileInputRefPesticides.current?.click();
                    else if (materialActiveTab === 'fertilizer') fileInputRefFertilizers.current?.click();
                    else fileInputRefMats.current?.click();
                  }}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Upload className="w-3.5 h-3.5" />CSV一括追加
                </button>
              </div>
            </div>
          </div>

          {/* 販売・出荷マスタ */}
          <div className="flex items-center justify-between mt-12 mb-4">
            <h2 className="text-xl font-bold text-slate-700 border-b-2 border-slate-200 pb-1">販売・出荷マスタ</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* 1. 販路（出荷先）マスタ */}
            <div className="lg:col-span-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[520px]">
              <CardHeader icon={Truck} title={`🚚 販路・出荷先 (${channels.length})`} type="sales_channels" />
              <p className="text-xs text-slate-400 mb-2 font-medium">日報の出荷記録で選択できる出荷先（JA、直売所、小売店など）です。</p>
              
              <div className="space-y-2 overflow-y-auto flex-1 mb-4 pr-1">
                {channels.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-8">販路データなし<br/>下のボタンから追加してください</p>
                ) : null}
                {channels.map(ch => (
                  <div key={ch.id} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 flex justify-between items-center group transition-colors">
                    <div>
                      <span className="font-bold text-slate-700">{ch.name}</span>
                      {ch.description && <span className="text-[10px] text-slate-400 ml-2">{ch.description}</span>}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleOpenModal('sales_channels', ch)} 
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer" 
                        title="編集"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete('sales_channels', ch.id)} 
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer" 
                        title="削除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => handleOpenModal('sales_channels')}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer active:scale-98"
              >
                <Plus className="w-4 h-4" />新しい販路（出荷先）を追加
              </button>
            </div>

            {/* 2. 販売価格マスタ (ツリー表示対応) */}
            <div className="lg:col-span-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[520px]">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-lg">
                  <Banknote className="w-5 h-5 text-emerald-600" />
                  {`販売価格 (${salesPrices.length})`}
                  <HelpTooltip content="作目ごとの販売価格（単価）を登録します。JAや直売所など、販路別に異なる単価を設定できます。" />
                </div>
                
                {/* 状態切り替えトグル */}
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button 
                    onClick={() => setPriceViewMode('byCrop')}
                    className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1 transition-all ${priceViewMode === 'byCrop' ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <ListTree className="w-3 h-3" />作目別
                  </button>
                  <button 
                    onClick={() => setPriceViewMode('byChannel')}
                    className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1 transition-all ${priceViewMode === 'byChannel' ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <AlignLeft className="w-3 h-3" />販路別
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 mb-4 pr-1 space-y-4">
                
                {/* 完全に新しいカテゴリの追加を一番上に移動 */}
                <div className="pb-2">
                  <button 
                    onClick={() => handleOpenModal('sales_prices')}
                    className="w-full py-2.5 border-2 border-dashed border-emerald-200 hover:border-emerald-400 bg-emerald-50/30 text-emerald-700 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all"
                  >
                    <Plus className="w-4 h-4" />新しい販売価格を追加
                  </button>
                </div>

                {Object.keys(groupedSalesPrices).length === 0 ? (
                  <p className="text-slate-400 text-sm text-center pt-8">販売価格データがありません<br/>「新しい販売価格を追加」から単価を設定してください</p>
                ) : (
                  Object.keys(groupedSalesPrices).map(groupKey => (
                    <div key={groupKey} className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                      <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 font-black text-slate-700 flex items-center gap-2">
                        {priceViewMode === 'byCrop' ? '📦' : '🚚'} {groupKey}
                      </div>
                      <div className="divide-y divide-slate-100">
                        {groupedSalesPrices[groupKey].map(s => (
                          <div key={s.id} className="p-3 pl-6 flex justify-between items-center group hover:bg-slate-100 transition-colors">
                            <div className="text-sm font-bold text-slate-600 flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                              {priceViewMode === 'byCrop' ? s.channel_name : s.crop_name}
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="font-black text-blue-600">¥{s.price_per_unit}</div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleOpenModal('sales_prices', s)} className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleDelete('sales_prices', s.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* 子要素としての追加ボタン */}
                      <button 
                        onClick={() => handleOpenModal(
                          'sales_prices', 
                          null, 
                          priceViewMode === 'byCrop' ? { crop_name: groupKey } : { channel_name: groupKey }
                        )}
                        className="w-full py-2 px-4 text-xs font-bold text-emerald-600 bg-emerald-50/50 hover:bg-emerald-100 flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-3 h-3" /> 
                        {priceViewMode === 'byCrop' ? 'この作目の販路を追加' : 'この販路の商品を追加'}
                      </button>
                    </div>
                  ))
                )}
                {/* 既存の販路から一括コピーなどのボタン群 */}
                <div className="pt-2 space-y-2">
                  <button 
                    onClick={() => setIsCopyModalOpen(true)}
                    className="w-full py-2.5 border-2 border-dashed border-blue-200 hover:border-blue-400 bg-blue-50/30 text-blue-700 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all"
                  >
                    <AlignLeft className="w-4 h-4" />既存の販路から価格設定を一括コピー追加
                  </button>
                </div>
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
              {/* 作目 / 圃場 / 資材 / 作業者 / 販路 共通 */}
              {['crops', 'fields', 'materials', 'workers', 'sales_channels'].includes(modalType) && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    {modalType === 'sales_channels' ? '販路（出荷先）名 (必須)' : '名前 (必須)'}
                  </label>
                  <input 
                    type="text" 
                    value={formData.name || ''} 
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-bold"
                    placeholder={
                      modalType === 'crops' ? '例: カリフラワー' : 
                      modalType === 'sales_channels' ? '例: JA〇〇支店、〇〇スーパー、直売所' : 
                      '例: 伏見唐辛子'
                    }
                  />
                </div>
              )}

              {/* 作目専用 */}
              {modalType === 'crops' && (
                <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-sm font-black text-slate-700 mb-3">栽培基準 (自動計算用)</div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">10aあたりの必要苗数 (株/本)</label>
                    <input 
                      type="number" 
                      value={formData.seedlings_per_10a || ''} 
                      onChange={e => setFormData({...formData, seedlings_per_10a: Number(e.target.value)})}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-bold"
                      placeholder="例: 4000"
                    />
                    <p className="text-xs text-slate-400 mt-1">※ 栽培計画入力時に、圃場面積×この値で必要苗数が自動計算されます。</p>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <label className="block text-xs font-bold text-slate-500 mb-2">10aあたりの必要資材 (肥料・農薬など)</label>
                    <div className="space-y-2 mb-2">
                      {(formData.materials_per_10a || []).map((m: any, idx: number) => {
                        const mat = materials.find(x => x.id === m.material_id);
                        return (
                          <div key={idx} className="flex items-center gap-2 bg-white p-2 border border-slate-200 rounded-lg">
                            <span className="flex-1 text-sm font-bold text-slate-700">{mat ? mat.name : '不明な資材'}</span>
                            <input 
                              type="number" 
                              value={m.amount || ''}
                              onChange={(e) => {
                                const newMats = [...formData.materials_per_10a];
                                newMats[idx].amount = Number(e.target.value);
                                setFormData({...formData, materials_per_10a: newMats});
                              }}
                              className="w-20 p-1.5 border border-slate-200 rounded focus:outline-none focus:border-emerald-500 text-right text-sm"
                              placeholder="数量"
                            />
                            <span className="text-xs text-slate-500 w-8">{mat ? mat.unit : ''}</span>
                            <button 
                              onClick={() => {
                                const newMats = formData.materials_per_10a.filter((_: any, i: number) => i !== idx);
                                setFormData({...formData, materials_per_10a: newMats});
                              }}
                              className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <select 
                        id="addMaterialSelect"
                        className="flex-1 p-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 font-bold"
                      >
                        <option value="">資材を選択して追加</option>
                        {materials.map(m => (
                          <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                        ))}
                      </select>
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          const select = document.getElementById('addMaterialSelect') as HTMLSelectElement;
                          if (select.value) {
                            const newMats = [...(formData.materials_per_10a || []), { material_id: select.value, amount: 0 }];
                            setFormData({...formData, materials_per_10a: newMats});
                            select.value = "";
                          }
                        }}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-bold flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-4 h-4" /> 追加
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">※ 必要な資材を追加し、10aあたりの使用量を設定してください。</p>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <div className="text-sm font-black text-slate-700 mb-3 flex items-center gap-2">
                      <Banknote className="w-4 h-4 text-emerald-600" />
                      10aあたり概算経費 (予算)
                    </div>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                      ※ 月次の実績経費が未入力の月に、レポートの予測計算として使用されます。
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">動力光熱費 (円)</label>
                        <input 
                          type="number" 
                          value={formData.est_fuel_cost_10a || ''} 
                          onChange={e => setFormData({...formData, est_fuel_cost_10a: Number(e.target.value)})}
                          className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 font-bold"
                          placeholder="例: 0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">機械・車両費 (円)</label>
                        <input 
                          type="number" 
                          value={formData.est_machinery_cost_10a || ''} 
                          onChange={e => setFormData({...formData, est_machinery_cost_10a: Number(e.target.value)})}
                          className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 font-bold"
                          placeholder="例: 0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">その他経費 (円)</label>
                        <input 
                          type="number" 
                          value={formData.est_other_cost_10a || ''} 
                          onChange={e => setFormData({...formData, est_other_cost_10a: Number(e.target.value)})}
                          className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 font-bold"
                          placeholder="例: 0"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 圃場専用 */}
              {modalType === 'fields' && (
                <div className="mt-4">
                  <label className="block text-xs font-bold text-slate-500 mb-1">面積 (a)</label>
                  <input 
                    type="number" 
                    value={formData.area_size || ''} 
                    onChange={e => setFormData({...formData, area_size: Number(e.target.value)})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-bold"
                    placeholder="例: 14"
                  />
                </div>
              )}

              {/* 作業者専用 */}
              
              {modalType === 'departments' && (
                <div className="mb-4">
                  <label className="block text-xs font-bold text-slate-500 mb-1">部署名 <span className="text-rose-500">*</span></label>
                  <input 
                    type="text" 
                    value={formData.name || ''} 
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-bold"
                    placeholder="例: 栽培部"
                  />
                </div>
              )}

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
                      <label className="block text-xs font-bold text-slate-500 mb-1">現場打刻・ログイン暗証番号 (4桁数字)</label>
                      <input 
                        type="text" 
                        maxLength={4}
                        value={formData.pin_code || ''} 
                        onChange={e => setFormData({...formData, pin_code: e.target.value.replace(/[^0-9]/g, '')})}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-bold tracking-widest text-center"
                        placeholder="0000"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">※現場アプリでの打刻専用PINです（LINE連携コードとは別物です）</p>
                    </div>
                  </div>
                    <div className="col-span-2 mt-4">
                      <label className="block text-xs font-bold text-slate-500 mb-1">権限 (Role)</label>
                      <select
                        value={formData.role || 'worker'}
                        onChange={e => setFormData({...formData, role: e.target.value})}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-bold"
                      >
                        <option value="worker">一般スタッフ</option>
                        <option value="admin">管理者 (admin)</option>
                      </select>
                    </div>

                    <div className="col-span-2 mt-4">
                      <label className="block text-xs font-bold text-slate-500 mb-1">所属部署</label>
                      <select
                        value={formData.department_id || ''}
                        onChange={e => setFormData({...formData, department_id: e.target.value})}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-bold text-slate-700"
                      >
                        <option value="">未所属</option>
                        {departments.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>


                </>
              )}

              {/* 農薬専用 */}
              {modalType === 'pesticides' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">農薬区分</label>
                    <select
                      value={formData.pesticide_type || '殺虫剤'}
                      onChange={e => setFormData({...formData, pesticide_type: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 font-bold text-slate-700"
                    >
                      <option value="殺虫剤">殺虫剤</option>
                      <option value="殺菌剤">殺菌剤</option>
                      <option value="除草剤">除草剤</option>
                      <option value="植物成長調整剤">植物成長調整剤</option>
                      <option value="展着剤">展着剤</option>
                      <option value="その他">その他</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">RACコード (作用機構)</label>
                    <input 
                      type="text" 
                      value={formData.rac_code || ''} 
                      onChange={e => setFormData({...formData, rac_code: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 font-bold"
                      placeholder="例: 1A, 3, FR M5, IR 4A"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">標準希釈倍数</label>
                    <input 
                      type="text" 
                      value={formData.dilution || ''} 
                      onChange={e => setFormData({...formData, dilution: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 font-bold"
                      placeholder="例: 1000〜2000倍"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">総使用可能回数 (上限)</label>
                    <input 
                      type="number" 
                      value={formData.max_count ?? 3} 
                      onChange={e => setFormData({...formData, max_count: Number(e.target.value)})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 font-bold text-teal-700"
                      placeholder="例: 3"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 mb-1">対象病害虫・雑草</label>
                    <input 
                      type="text" 
                      value={formData.target_pests || ''} 
                      onChange={e => setFormData({...formData, target_pests: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 font-bold"
                      placeholder="例: アブラムシ類、うどんこ病、アザミウマ"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 mb-1">使用時期</label>
                    <input 
                      type="text" 
                      value={formData.usage_time || ''} 
                      onChange={e => setFormData({...formData, usage_time: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 font-bold"
                      placeholder="例: 収穫前日まで、定植時"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">単位</label>
                    <input 
                      type="text" 
                      value={formData.unit || '本'} 
                      onChange={e => setFormData({...formData, unit: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 font-bold"
                      placeholder="例: 本, 袋, L, kg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">購入単価 (円)</label>
                    <input 
                      type="number" 
                      value={formData.default_price || ''} 
                      onChange={e => setFormData({...formData, default_price: Number(e.target.value)})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 font-bold text-teal-700"
                      placeholder="例: 2800"
                    />
                  </div>
                </div>
              )}

              {/* 肥料専用 */}
              {modalType === 'fertilizers' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">肥料種類</label>
                    <select
                      value={formData.fertilizer_type || '化成肥料'}
                      onChange={e => setFormData({...formData, fertilizer_type: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-bold text-slate-700"
                    >
                      <option value="化成肥料">化成肥料</option>
                      <option value="有機質肥料">有機質肥料</option>
                      <option value="配合肥料">配合肥料</option>
                      <option value="液体肥料">液体肥料</option>
                      <option value="土壌改良材">土壌改良材 (石灰・堆肥等)</option>
                      <option value="その他">その他</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">用途区分</label>
                    <select
                      value={formData.fertilizer_usage || '共通'}
                      onChange={e => setFormData({...formData, fertilizer_usage: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-bold text-slate-700"
                    >
                      <option value="元肥">元肥</option>
                      <option value="追肥">追肥</option>
                      <option value="葉面散布">葉面散布</option>
                      <option value="共通">共通</option>
                    </select>
                  </div>

                  {/* N-P-K 比率 */}
                  <div className="col-span-2 bg-emerald-50 p-3.5 rounded-xl border border-emerald-200">
                    <label className="block text-xs font-black text-emerald-900 mb-2">
                      🌱 N-P-K 純成分比率 (%)
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <span className="text-[11px] font-bold text-emerald-800">窒素 (N) %</span>
                        <input 
                          type="number" 
                          step="0.1"
                          value={formData.n_percent ?? 0} 
                          onChange={e => setFormData({...formData, n_percent: Number(e.target.value)})}
                          className="w-full p-2 bg-white border border-emerald-300 rounded-lg font-black text-emerald-900"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-emerald-800">リン酸 (P) %</span>
                        <input 
                          type="number" 
                          step="0.1"
                          value={formData.p_percent ?? 0} 
                          onChange={e => setFormData({...formData, p_percent: Number(e.target.value)})}
                          className="w-full p-2 bg-white border border-emerald-300 rounded-lg font-black text-emerald-900"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-emerald-800">カリ (K) %</span>
                        <input 
                          type="number" 
                          step="0.1"
                          value={formData.k_percent ?? 0} 
                          onChange={e => setFormData({...formData, k_percent: Number(e.target.value)})}
                          className="w-full p-2 bg-white border border-emerald-300 rounded-lg font-black text-emerald-900"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">1袋の重量 (kg)</label>
                    <input 
                      type="number" 
                      value={formData.bag_weight_kg ?? 20} 
                      onChange={e => setFormData({...formData, bag_weight_kg: Number(e.target.value)})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-bold"
                      placeholder="例: 20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">単位</label>
                    <input 
                      type="text" 
                      value={formData.unit || '袋'} 
                      onChange={e => setFormData({...formData, unit: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-bold"
                      placeholder="例: 袋, kg, L"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">購入単価 (円)</label>
                    <input 
                      type="number" 
                      value={formData.default_price || ''} 
                      onChange={e => setFormData({...formData, default_price: Number(e.target.value)})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-bold text-emerald-700"
                      placeholder="例: 2600"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 mb-1">公的登録番号・規格（例: 登録: 生第82941号）</label>
                    <input 
                      type="text" 
                      value={formData.specification || ''} 
                      onChange={e => setFormData({...formData, specification: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-bold font-mono"
                      placeholder="例: 登録: 生第105321号"
                    />
                  </div>
                </div>
              )}

              {/* 資材専用 */}
              {modalType === 'materials' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 mb-1">カテゴリ</label>
                    <select
                      value={formData.category || '諸材料費'}
                      onChange={e => setFormData({...formData, category: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-bold text-slate-700"
                    >
                      <option value="諸材料費">諸材料費 (マルチ・ネット等)</option>
                      <option value="種苗費">種苗費 (種子・苗)</option>
                      <option value="動力光熱費">動力光熱費 (燃料・電気)</option>
                      <option value="機械・車両費">機械・車両費</option>
                      <option value="その他経費">その他経費</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 mb-1">規格 (詳細レポート用)</label>
                    <input 
                      type="text" 
                      value={formData.specification || ''} 
                      onChange={e => setFormData({...formData, specification: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-bold"
                      placeholder="例: 0.02mm×95cm×200m, 200穴セルトレイ"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">単位</label>
                    <input 
                      type="text" 
                      value={formData.unit || ''} 
                      onChange={e => setFormData({...formData, unit: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-bold"
                      placeholder="例: 巻, 本, 枚, 箱"
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
                    <select
                      value={formData.crop_name || ''}
                      onChange={e => setFormData({...formData, crop_name: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-bold text-slate-700"
                    >
                      <option value="">-- 作目を選択してください --</option>
                      {crops.map(c => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">販路名 (必須)</label>
                    {(() => {
                      const allChannelNames = Array.from(new Set([
                        ...channels.map(c => c.name),
                        ...salesPrices.map(sp => sp.channel_name)
                      ])).filter(Boolean).sort();

                      if (allChannelNames.length === 0) {
                        return (
                          <div className="space-y-1">
                            <input 
                              type="text" 
                              value={formData.channel_name || ''} 
                              onChange={e => setFormData({...formData, channel_name: e.target.value})}
                              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-bold"
                              placeholder="例: JA、直売所、〇〇スーパー"
                            />
                            <p className="text-[11px] text-slate-400">※ 入力した販路名は自動的に出荷先マスタにも保存されます。</p>
                          </div>
                        );
                      }

                      const isCustom = formData.isCustomChannel || (formData.channel_name && !allChannelNames.includes(formData.channel_name));

                      return (
                        <div className="space-y-2">
                          <select
                            value={isCustom ? '__custom__' : (formData.channel_name || '')} 
                            onChange={e => {
                              if (e.target.value === '__custom__') {
                                setFormData({...formData, channel_name: '', isCustomChannel: true});
                              } else {
                                setFormData({...formData, channel_name: e.target.value, isCustomChannel: false});
                              }
                            }}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-bold text-slate-700"
                          >
                            <option value="">-- 販路を選択してください --</option>
                            {allChannelNames.map(chName => {
                              const isRegistered = formData.crop_name ? salesPrices.some(sp => sp.crop_name === formData.crop_name && sp.channel_name === chName) : false;
                              const isCurrentEditing = editingItem && editingItem.crop_name === formData.crop_name && editingItem.channel_name === chName;
                              const isDisabled = isRegistered && !isCurrentEditing;
                              return (
                                <option key={chName} value={chName} disabled={isDisabled}>
                                  {chName} {isDisabled ? '(この作目で登録済み)' : ''}
                                </option>
                              );
                            })}
                            <option value="__custom__">＋ 新しい販路名を直接入力する...</option>
                          </select>

                          {isCustom && (
                            <div className="space-y-1">
                              <input
                                type="text"
                                value={formData.channel_name || ''}
                                onChange={e => setFormData({...formData, channel_name: e.target.value, isCustomChannel: true})}
                                placeholder="新しい販路名を入力（例: JA、直売所、〇〇スーパー）"
                                className="w-full p-3 bg-white border-2 border-emerald-500 rounded-xl focus:outline-none font-bold text-slate-800"
                                autoFocus
                              />
                              <p className="text-[11px] text-slate-400">※ 入力した販路名は自動的に出荷先マスタにも保存されます。</p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
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

      {/* --- コピー用モーダル --- */}
      {isCopyModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-blue-50/50">
              <h3 className="text-lg font-black text-blue-800 flex items-center gap-2">
                <AlignLeft className="w-5 h-5" />
                販売価格の一括コピー
              </h3>
              <button onClick={() => setIsCopyModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="text-sm font-medium text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4">
                既存の販路（例: スーパーA）のすべての作目の価格設定を丸ごとコピーして、新しい販路（例: スーパーB）として一気に登録します。
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">コピー元 (既存の販路名)</label>
                <select
                  value={copySource}
                  onChange={e => setCopySource(e.target.value)}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-bold"
                >
                  <option value="">選択してください</option>
                  {Array.from(new Set(salesPrices.map(sp => sp.channel_name))).sort().map(ch => (
                    <option key={ch} value={ch}>{ch}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">コピー先 (新しい販路名)</label>
                <input 
                  type="text" 
                  value={copyTarget} 
                  onChange={e => setCopyTarget(e.target.value)}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-bold"
                  placeholder="例: スーパーB"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 flex gap-3">
              <button 
                onClick={() => setIsCopyModalOpen(false)}
                disabled={isCopying}
                className="flex-1 py-3 text-slate-500 font-bold bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                キャンセル
              </button>
              <button 
                onClick={handleCopyChannel}
                disabled={isCopying || !copySource || !copyTarget}
                className="flex-1 py-3 text-white font-bold bg-blue-600 rounded-xl hover:bg-blue-700 shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isCopying ? <Loader2 className="w-5 h-5 animate-spin" /> : 'コピーして追加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📱 管理者用：各スタッフのLINE連携案内モーダル */}
      <LineLinkModal
        isOpen={!!selectedWorkerForLine}
        onClose={() => setSelectedWorkerForLine(null)}
        worker={selectedWorkerForLine}
        onLinkedSuccess={fetchMasters}
      />
    </div>
  );
}
