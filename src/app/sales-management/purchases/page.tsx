"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { HelpTooltip } from '@/components/HelpTooltip';
import { Receipt, Search, Image as ImageIcon, Camera, UploadCloud, Calendar, DollarSign, Store, Tag, Plus, Loader2, Sparkles, AlertCircle, TrendingUp, BarChart3, CheckCircle2, ChevronDown, Download, Check, MapPin, FileText, History, ExternalLink } from 'lucide-react';

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  
  // OCR関連のステート
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // フォームステート
  const [formData, setFormData] = useState({
    purchase_date: new Date().toISOString().split('T')[0],
    material_id: '',
    supplier: '',
    unit_price: 0,
    quantity: 1,
    total_price: 0,
    notes: '',
    receipt_image_url: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      total_price: prev.unit_price * prev.quantity
    }));
  }, [formData.unit_price, formData.quantity]);

  const handleMaterialChange = (materialId: string) => {
    const mat = materials.find(m => m.id === materialId);
    setFormData(prev => ({
      ...prev,
      material_id: materialId,
      unit_price: mat ? mat.default_price : prev.unit_price,
    }));
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const { data: matData } = await supabase.from('materials').select('*').order('name');
      if (matData) setMaterials(matData);

      const { data: purData, error } = await supabase
        .from('material_purchases')
        .select(`
          *,
          materials (name, unit)
        `)
        .order('purchase_date', { ascending: false });

      if (error) {
        console.warn("Table material_purchases might not exist yet:", error.message);
        setPurchases([]);
      } else if (purData) {
        setPurchases(purData);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitSuccess(false);

    try {
      const { error } = await supabase.from('material_purchases').insert([{
        purchase_date: formData.purchase_date,
        material_id: formData.material_id || null,
        supplier: formData.supplier,
        unit_price: formData.unit_price,
        quantity: formData.quantity,
        total_price: formData.total_price,
        notes: formData.notes,
        receipt_image_url: formData.receipt_image_url
      }]);

      if (error) throw error;

      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
      
      setFormData(prev => ({
        ...prev,
        material_id: '',
        supplier: '',
        unit_price: 0,
        quantity: 1,
        total_price: 0,
        notes: '',
        receipt_image_url: ''
      }));

      fetchData();
    } catch (error: any) {
      console.error('Error adding purchase:', error.message);
      alert('エラーが発生しました: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('この購入記録を削除しますか？')) return;
    
    try {
      const { error } = await supabase.from('material_purchases').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error(error);
      alert('削除に失敗しました');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 2400;
        const MAX_HEIGHT = 2400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
        
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          await processReceiptImage(compressedBase64, blob);
        }, 'image/jpeg', 0.85);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processReceiptImage = async (imageBase64: string, fileBlob: Blob) => {
    setIsAnalyzing(true);
    setOcrError('');
    
    try {
      const aiResponse = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 })
      });
      const data = await aiResponse.json();
      if (!aiResponse.ok) throw new Error(data.error || '解析に失敗しました');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('認証情報が取得できません。再度ログインしてください。');

      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, fileBlob, {
          cacheControl: '31536000',
          upsert: false
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        throw new Error('画像の保存(Storage)に失敗しました。');
      }

      setFormData(prev => ({
        ...prev,
        purchase_date: data.date || prev.purchase_date,
        supplier: data.supplier || prev.supplier,
        unit_price: data.total_amount ? Number(data.total_amount) : prev.unit_price,
        quantity: 1,
        receipt_image_url: fileName
      }));
      
      alert('レシートの読み取りとクラウド保存に成功しました！');
    } catch (error: any) {
      console.error(error);
      setOcrError(error.message || 'レシートの解析・保存に失敗しました');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleViewReceipt = async (path: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('receipts')
        .createSignedUrl(path, 60);
      
      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Error generating signed URL:', error);
      alert('画像の取得に失敗しました。');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* ヘッダー */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-indigo-600" />
            資材購入・直接経費管理
            <HelpTooltip content="購入した資材や経費を記録し、レシート画像の保存も行えます。" className="ml-1" />
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">日々の資材購入履歴を記録し、経費を可視化します。</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 左側：登録フォーム */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden sticky top-6">
            <div className="bg-slate-50 p-4 border-b border-slate-200">
              <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                購入経費を記録
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              
              {/* OCR・レシート撮影 */}
              <div 
                onClick={() => !isAnalyzing && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all group relative overflow-hidden ${
                  isAnalyzing ? 'border-slate-300 bg-slate-50 cursor-wait' : 'border-indigo-200 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-50'
                }`}
              >
                {isAnalyzing ? (
                  <div className="flex flex-col items-center justify-center space-y-2 z-10">
                    <div className="w-6 h-6 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                    <span className="font-bold text-xs text-indigo-700">AIがレシートを解析中...</span>
                  </div>
                ) : (
                  <>
                    <Camera className="w-6 h-6 mb-1 group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-xs">レシートを撮影してAI自動入力</span>
                    <span className="text-[10px] text-indigo-600/70">スマホのカメラまたは画像ファイル</span>
                  </>
                )}
                <input 
                  type="file" 
                  accept="image/jpeg, image/png, image/jpg" 
                  capture="environment"
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                />
              </div>

              {ocrError && (
                <div className="bg-rose-50 text-rose-600 p-2.5 rounded-lg text-xs font-bold flex items-start gap-2 border border-rose-200">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{ocrError}</span>
                </div>
              )}

              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">購入日</label>
                  <input
                    type="date"
                    required
                    value={formData.purchase_date}
                    onChange={(e) => setFormData({...formData, purchase_date: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">購入先 (店舗など)</label>
                  <input
                    type="text"
                    placeholder="例: JA、コメリ、Amazon"
                    value={formData.supplier}
                    onChange={(e) => setFormData({...formData, supplier: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">資材品名</label>
                  <select
                    value={formData.material_id}
                    onChange={(e) => handleMaterialChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="">（選択しない / その他）</option>
                    {materials.map(mat => (
                      <option key={mat.id} value={mat.id}>{mat.name} ({mat.unit})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">数量</label>
                    <input
                      type="number"
                      min="0.01" step="0.01"
                      required
                      value={formData.quantity}
                      onChange={(e) => setFormData({...formData, quantity: Number(e.target.value)})}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">単価(税込)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-500 text-xs">¥</span>
                      <input
                        type="number"
                        min="0"
                        required
                        value={formData.unit_price}
                        onChange={(e) => setFormData({...formData, unit_price: Number(e.target.value)})}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-6 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-right"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 mb-1">合計金額(税込)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-500 font-bold text-xs">¥</span>
                    <input
                      type="number"
                      required
                      value={formData.total_price}
                      onChange={(e) => setFormData({...formData, total_price: Number(e.target.value)})}
                      className="w-full bg-white border-2 border-indigo-500 rounded-xl pl-6 pr-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 font-black text-indigo-700 text-sm text-right"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">メモ</label>
                  <textarea
                    rows={2}
                    placeholder="用途や備考など"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  ></textarea>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-2.5 rounded-xl font-bold text-xs text-white shadow-sm transition-all flex items-center justify-center gap-2 ${
                  submitSuccess ? 'bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {submitSuccess ? (
                  <><Check className="w-4 h-4" /> 記録しました</>
                ) : isSubmitting ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 保存中...</>
                ) : (
                  <><Plus className="w-4 h-4" /> 購入を記録する</>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* 右側：履歴一覧 */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden min-h-[450px] flex flex-col">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" />
                購入履歴
              </h2>
            </div>

            {isLoading ? (
              <div className="flex-1 flex justify-center items-center">
                <div className="animate-spin w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full"></div>
              </div>
            ) : purchases.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center space-y-2">
                <Receipt className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-bold text-xs text-slate-500">まだ購入履歴がありません</p>
                <p className="text-[11px]">左のフォームから日々の経費を記録しましょう</p>
              </div>
            ) : (
              <div className="flex-1 overflow-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-[11px] text-slate-500 uppercase bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 font-bold">購入日</th>
                      <th className="px-4 py-3 font-bold">購入先</th>
                      <th className="px-4 py-3 font-bold">資材内容</th>
                      <th className="px-4 py-3 font-bold text-right">金額 (税込)</th>
                      <th className="px-4 py-3 font-bold"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {purchases.map((purchase) => (
                      <tr key={purchase.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-medium">
                          {purchase.purchase_date}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-700 font-bold flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5 text-slate-400" />
                          {purchase.supplier || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-800">
                            {purchase.materials?.name || 'その他資材'}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            単価 ¥{purchase.unit_price?.toLocaleString() || 0} × {purchase.quantity} {purchase.materials?.unit || ''}
                          </div>
                          {purchase.notes && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {purchase.notes}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className="text-sm font-black text-slate-800">
                            ¥{purchase.total_price?.toLocaleString()}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1">
                            {purchase.receipt_image_url && (
                              <button 
                                onClick={() => handleViewReceipt(purchase.receipt_image_url)}
                                className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors"
                                title="レシート画像を見る"
                              >
                                <ImageIcon className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button 
                              onClick={() => handleDelete(purchase.id)}
                              className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all text-[11px]"
                            >
                              削除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
