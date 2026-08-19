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
    receipt_image_url: '' // 画像保存先のパス
  });

  // 初期データ取得
  useEffect(() => {
    fetchData();
  }, []);

  // フォームの単価・数量が変わったら合計金額を自動計算
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      total_price: prev.unit_price * prev.quantity
    }));
  }, [formData.unit_price, formData.quantity]);

  // 資材選択時にデフォルト単価をセットする
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
      // 1. 資材マスタ取得
      const { data: matData } = await supabase.from('materials').select('*').order('name');
      if (matData) setMaterials(matData);

      // 2. 購入履歴取得 (テーブルが存在しない場合はエラーをキャッチして空にする)
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
      
      // フォームをリセット（日付は保持）
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

      // リスト再取得
      fetchData();
    } catch (error: any) {
      console.error('Error adding purchase:', error.message);
      alert('エラーが発生しました。データベースのテーブル(material_purchases)が作成されているか確認してください。\n' + error.message);
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

  // ----------------------------------------------------
  // レシートOCR (画像アップロードと解析)
  // ----------------------------------------------------
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ファイルサイズが大きい場合（スマホのカメラ等）はVercelのペイロード制限(4MB)に引っかかるため
    // Canvasを使ってブラウザ側でリサイズ・圧縮してから送信する
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        // 電子帳簿保存法（スキャナ保存）の解像度要件(200dpi以上)を安全にクリアするため
        // A4サイズ換算でも十分な解像度となる 長辺 2400px を上限に設定
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
        
        // JPEG形式で圧縮。視認性を損なわず電帳法の要件を満たす品質 0.85 を設定
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
        
        // CanvasからBlob（ファイルデータ）を作成してStorageアップロード用にする
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          await processReceiptImage(compressedBase64, blob);
        }, 'image/jpeg', 0.85);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    
    // 同じファイルを再度選べるようにリセット
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processReceiptImage = async (imageBase64: string, fileBlob: Blob) => {
    setIsAnalyzing(true);
    setOcrError('');
    
    try {
      // 1. AIによるOCR解析（並行してStorage保存も行うと速いが、エラーハンドリングをわかりやすくするため直列で）
      const aiResponse = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 })
      });
      const data = await aiResponse.json();
      if (!aiResponse.ok) throw new Error(data.error || '解析に失敗しました');

      // 2. ユーザー情報の取得（テナント分離用）
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('認証情報が取得できません。再度ログインしてください。');

      // 3. Supabase Storageへのアップロード
      // ファイル名はランダム＋タイムスタンプ
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, fileBlob, {
          cacheControl: '31536000',
          upsert: false
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        throw new Error('画像の保存(Storage)に失敗しました。SQLでのStorage開設が済んでいるか確認してください。');
      }

      // 解析結果と保存先URLをフォームに反映
      setFormData(prev => ({
        ...prev,
        purchase_date: data.date || prev.purchase_date,
        supplier: data.supplier || prev.supplier,
        unit_price: data.total_amount ? Number(data.total_amount) : prev.unit_price,
        quantity: 1,
        receipt_image_url: fileName // 保存されたパスを記録
      }));
      
      alert('レシートの読み取りとクラウド保存に成功しました！');
    } catch (error: any) {
      console.error(error);
      setOcrError(error.message || 'レシートの解析・保存に失敗しました');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 画像プレビューを開く
  const handleViewReceipt = async (path: string) => {
    try {
      // セキュアな署名付きURLを発行 (60秒間有効)
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8 pb-16 pt-4 sm:pt-8">
      
      {/* ヘッダー */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b-2 border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl md:text-4xl font-black text-slate-800 tracking-tight mb-2 flex items-center gap-2">
            資材・経費管理
            <HelpTooltip content="購入した資材や経費を記録し、レシート画像の保存も行えます。" className="ml-1" />
          </h1>
          <p className="text-sm md:text-base text-slate-500 font-medium">日々の資材購入履歴を記録し、経費を可視化します。</p>
        </div>
        <div className="flex gap-2">
          {/* 将来用：会計ソフト向けCSV出力 */}
          <button className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" /> 会計CSV出力
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 左側：登録フォーム */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden sticky top-6">
            <div className="bg-slate-50 p-6 border-b border-slate-200">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                購入を記録
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              
              {/* OCR・レシート撮影 */}
              <div 
                onClick={() => !isAnalyzing && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all group relative overflow-hidden ${
                  isAnalyzing ? 'border-slate-300 bg-slate-50 cursor-wait' : 'border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                {isAnalyzing ? (
                  <div className="flex flex-col items-center justify-center space-y-3 z-10">
                    <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                    <span className="font-bold text-sm text-emerald-700">AIがレシートを解析中...</span>
                    <span className="text-xs text-emerald-600/70">数秒かかる場合があります</span>
                  </div>
                ) : (
                  <>
                    <Camera className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-sm">レシートを撮影してAI自動入力</span>
                    <span className="text-xs text-emerald-600/70 mt-1">スマホのカメラまたは画像ファイル</span>
                  </>
                )}
                {/* 隠しファイル入力 */}
                <input 
                  type="file" 
                  accept="image/jpeg, image/png, image/jpg" 
                  capture="environment" // スマホで背面カメラを優先起動
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                />
              </div>

              {ocrError && (
                <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm font-bold flex items-start gap-2 border border-rose-200">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{ocrError}<br/><span className="text-xs font-normal opacity-80">※APIキーが未設定の場合はエラーになります</span></span>
                </div>
              )}

              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">購入日</label>
                  <input
                    type="date"
                    required
                    value={formData.purchase_date}
                    onChange={(e) => setFormData({...formData, purchase_date: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">購入先 (店舗など)</label>
                  <input
                    type="text"
                    placeholder="例: JA、コメリ、Amazon"
                    value={formData.supplier}
                    onChange={(e) => setFormData({...formData, supplier: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">資材</label>
                  <select
                    value={formData.material_id}
                    onChange={(e) => handleMaterialChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  >
                    <option value="">（選択しない / その他）</option>
                    {materials.map(mat => (
                      <option key={mat.id} value={mat.id}>{mat.name} ({mat.unit})</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-slate-700 mb-1">数量</label>
                    <input
                      type="number"
                      min="0.01" step="0.01"
                      required
                      value={formData.quantity}
                      onChange={(e) => setFormData({...formData, quantity: Number(e.target.value)})}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-right"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-slate-700 mb-1">単価(税込)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-2.5 text-slate-500">¥</span>
                      <input
                        type="number"
                        min="0"
                        required
                        value={formData.unit_price}
                        onChange={(e) => setFormData({...formData, unit_price: Number(e.target.value)})}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-right"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-black text-slate-800 mb-1">合計金額(税込)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-2.5 text-slate-500 font-bold">¥</span>
                    <input
                      type="number"
                      required
                      value={formData.total_price}
                      onChange={(e) => setFormData({...formData, total_price: Number(e.target.value)})}
                      className="w-full bg-white border-2 border-emerald-500 rounded-xl pl-8 pr-4 py-2.5 outline-none focus:ring-4 focus:ring-emerald-500/20 font-black text-emerald-700 text-lg text-right shadow-inner"
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">※自動計算されますが、手動で修正も可能です</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">メモ</label>
                  <textarea
                    rows={2}
                    placeholder="用途や備考など"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  ></textarea>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-3.5 rounded-xl font-black text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
                  submitSuccess ? 'bg-emerald-500' : 'bg-slate-800 hover:bg-slate-700'
                }`}
              >
                {submitSuccess ? (
                  <><Check className="w-5 h-5" /> 記録しました</>
                ) : isSubmitting ? (
                  <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 保存中...</>
                ) : (
                  <><Plus className="w-5 h-5" /> 購入を記録する</>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* 右側：履歴一覧 */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px] flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <History className="w-5 h-5 text-slate-500" />
                購入履歴
              </h2>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input 
                  type="text" 
                  placeholder="資材名や購入先を検索..." 
                  className="bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-sm outline-none focus:border-emerald-500 w-64 shadow-sm"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="flex-1 flex justify-center items-center">
                <div className="animate-spin w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full"></div>
              </div>
            ) : purchases.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center space-y-4">
                <div className="bg-slate-100 p-4 rounded-full">
                  <Receipt className="w-8 h-8 text-slate-300" />
                </div>
                <div>
                  <p className="font-bold text-slate-500">まだ購入履歴がありません</p>
                  <p className="text-sm mt-1">左のフォームから日々の経費を記録しましょう</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-4 font-black">購入日</th>
                      <th className="px-6 py-4 font-black">購入先</th>
                      <th className="px-6 py-4 font-black">資材内容</th>
                      <th className="px-6 py-4 font-black text-right">金額 (税込)</th>
                      <th className="px-6 py-4 font-black"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {purchases.map((purchase) => (
                      <tr key={purchase.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium">
                          {purchase.purchase_date}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-700 font-bold flex items-center gap-2">
                          <Store className="w-4 h-4 text-slate-400" />
                          {purchase.supplier || '-'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800">
                            {purchase.materials?.name || 'その他資材'}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            単価 ¥{purchase.unit_price?.toLocaleString() || 0} × {purchase.quantity} {purchase.materials?.unit || ''}
                          </div>
                          {purchase.notes && (
                            <div className="text-xs text-slate-400 mt-1 flex items-start gap-1">
                              <FileText className="w-3 h-3 flex-shrink-0 mt-0.5" />
                              <span className="truncate max-w-[200px]">{purchase.notes}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-base font-black text-slate-800">
                            ¥{purchase.total_price?.toLocaleString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            {purchase.receipt_image_url && (
                              <button 
                                onClick={() => handleViewReceipt(purchase.receipt_image_url)}
                                className="text-emerald-600 hover:bg-emerald-50 p-2 rounded-lg transition-colors group/btn relative"
                                title="レシート画像を見る"
                              >
                                <ImageIcon className="w-4 h-4" />
                                <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap">
                                  証憑を見る
                                </span>
                              </button>
                            )}
                            <button 
                              onClick={() => handleDelete(purchase.id)}
                              className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
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
