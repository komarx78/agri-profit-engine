"use client";

import React, { useState, useEffect, use } from 'react';
import { Clock, MapPin, Sprout, CheckCircle2, User, Sparkles, Play, Square, Package, History, LogOut, Loader2, AlertCircle, Building2 } from 'lucide-react';
import { getFarmInfo, getFarmWorkers, verifyWorkerPin, getFarmMasters, submitWorkLog, TenantInfo } from '@/app/actions/farm';
import { supabase } from '@/lib/supabase';
import imageCompression from 'browser-image-compression';

interface MasterItem {
  id: string;
  name: string;
}

export default function FarmWorkerPage({ params }: { params: Promise<{ tenant_id: string }> }) {
  const unwrappedParams = use(params);
  const tenantId = unwrappedParams.tenant_id;
  
  const [isMounted, setIsMounted] = useState(false);
  
  // 農園・ワーカー情報
  const [farmInfo, setFarmInfo] = useState<TenantInfo | null>(null);
  const [workers, setWorkers] = useState<{id: string, name: string}[]>([]);
  const [currentUser, setCurrentUser] = useState<{id: string, name: string, role: string} | null>(null);
  
  // ローディングとエラー状態
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  
  // ログインフォーム用
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // マスタデータ
  const [crops, setCrops] = useState<MasterItem[]>([]);
  const [fields, setFields] = useState<MasterItem[]>([]);
  const [materials, setMaterials] = useState<MasterItem[]>([]);

  // フォーム状態
  const [selectedCrop, setSelectedCrop] = useState<string>('');
  const [selectedField, setSelectedField] = useState<string>('');
  const [workType, setWorkType] = useState<string>('');
  const [duration, setDuration] = useState<string>('');
  const [memo, setMemo] = useState<string>('');
  const [selectedMaterial, setSelectedMaterial] = useState<string>('');
  const [materialQuantity, setMaterialQuantity] = useState<string>('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [inputMode, setInputMode] = useState<'timer' | 'manual'>('timer');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  // 打刻関連の状態 (簡易実装：今回は開始と同時に保存せず、完了時に一括保存する方式にします)
  const [activeWorkStartTime, setActiveWorkStartTime] = useState<string | null>(null);
  const [elapsedMinutes, setElapsedMinutes] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  const workTypes = ['収穫', '定植・播種', '水やり', '肥料・農薬', '草刈り', '片付け・メンテ'];

  useEffect(() => {
    setIsMounted(true);
    
    // 農園情報の取得
    const init = async () => {
      const infoRes = await getFarmInfo(tenantId);
      if (!infoRes.success || !infoRes.data) {
        setErrorMsg(infoRes.error || '農園が見つかりません');
        setIsLoading(false);
        return;
      }
      setFarmInfo(infoRes.data);

      // ワーカー一覧の取得
      const workersRes = await getFarmWorkers(tenantId);
      if (workersRes.success && workersRes.data) {
        setWorkers(workersRes.data);
      }

      // セッションの復元
      const savedSession = localStorage.getItem(`agri_worker_${tenantId}`);
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        setCurrentUser(parsed);
        fetchMasters(); // ログイン済みならマスタ取得
      }
      
      setIsLoading(false);
    };

    init();
  }, [tenantId]);

  const fetchMasters = async () => {
    const res = await getFarmMasters(tenantId);
    if (res.success && res.data) {
      setCrops(res.data.crops);
      setFields(res.data.fields);
      setMaterials(res.data.materials);
    }
  };

  // 経過時間の計算タイマー
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeWorkStartTime) {
      const calcElapsed = () => {
        const start = new Date(activeWorkStartTime).getTime();
        const now = new Date().getTime();
        const diffSecs = Math.floor((now - start) / 1000);
        setElapsedMinutes(Math.floor(diffSecs / 60));
        setElapsedSeconds(diffSecs % 60);
      };
      calcElapsed(); // 初回実行
      interval = setInterval(calcElapsed, 1000); // 1秒ごとに更新
    }
    return () => clearInterval(interval);
  }, [activeWorkStartTime]);

  const resetForm = () => {
    setSelectedCrop('');
    setSelectedField('');
    setWorkType('');
    setDuration('');
    setMemo('');
    setSelectedMaterial('');
    setMaterialQuantity('');
    setPhotoFile(null);
    setPhotoPreview(null);
    setErrorMsg('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkerId || !pinCode) return;
    
    setIsLoggingIn(true);
    setErrorMsg('');
    
    const res = await verifyWorkerPin(tenantId, selectedWorkerId, pinCode);
    if (res.success && res.data) {
      setCurrentUser(res.data);
      localStorage.setItem(`agri_worker_${tenantId}`, JSON.stringify(res.data));
      fetchMasters();
    } else {
      setErrorMsg(res.error || 'ログインに失敗しました');
    }
    
    setIsLoggingIn(false);
  };

  const handleLogout = () => {
    if(confirm('ログアウトしますか？')) {
      localStorage.removeItem(`agri_worker_${tenantId}`);
      setCurrentUser(null);
      setPinCode('');
      setSelectedWorkerId('');
      resetForm();
    }
  };

  const handleStartWork = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setErrorMsg('');
    setActiveWorkStartTime(new Date().toISOString());
  };

  const handleStopWork = async () => {
    if (!activeWorkStartTime || !currentUser) return;
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      // 1. 写真がある場合は圧縮してSupabase Storageにアップロード
      let photoUrl = null;
      if (photoFile) {
        try {
          // 画像の圧縮
          const options = {
            maxSizeMB: 1, // 最大1MB
            maxWidthOrHeight: 1280, // 最大1280px
            useWebWorker: true
          };
          const compressedFile = await imageCompression(photoFile, options);
          
          // 一意のファイル名を生成 (tenantId/workerId/timestamp.jpg)
          const fileExt = compressedFile.name.split('.').pop() || 'jpg';
          const fileName = `${tenantId}/${currentUser.id}/${Date.now()}.${fileExt}`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('work_photos')
            .upload(fileName, compressedFile, {
              cacheControl: '3600',
              upsert: false
            });
            
          if (uploadError) throw uploadError;
          
          // 公開URLを取得
          const { data: publicUrlData } = supabase.storage
            .from('work_photos')
            .getPublicUrl(fileName);
            
          photoUrl = publicUrlData.publicUrl;
        } catch (photoErr) {
          console.error('Photo upload failed:', photoErr);
          throw new Error('写真のアップロードに失敗しました。');
        }
      }

      const endTime = new Date();
      const startTime = new Date(activeWorkStartTime);
      const diffMins = Math.floor((endTime.getTime() - startTime.getTime()) / 1000 / 60);

      const cropId = crops.find(c => c.name === selectedCrop)?.id;
      const fieldId = fields.find(f => f.name === selectedField)?.id;
      const matId = materials.find(m => m.name === selectedMaterial)?.id;

      const logData = {
        crop_id: cropId || null,
        field_id: fieldId || null,
        work_type: workType,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: 'completed',
        work_date: startTime.toISOString().split('T')[0],
        duration_minutes: diffMins,
        material_id: matId || null,
        material_quantity: materialQuantity ? parseFloat(materialQuantity) : null,
        memo: memo || null,
        photo_url: photoUrl,
      };

      const res = await submitWorkLog(tenantId, currentUser.id, logData);
      
      if (!res.success) {
        throw new Error(res.error);
      }
      
      setActiveWorkStartTime(null);
      setIsSubmitting(false);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        resetForm();
      }, 2500);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || '保存に失敗しました');
      setIsSubmitting(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      // 1. 写真のアップロード処理
      let photoUrl = null;
      if (photoFile) {
        try {
          const options = { maxSizeMB: 1, maxWidthOrHeight: 1280, useWebWorker: true };
          const compressedFile = await imageCompression(photoFile, options);
          const fileExt = compressedFile.name.split('.').pop() || 'jpg';
          const fileName = `${tenantId}/${currentUser.id}/${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('work_photos')
            .upload(fileName, compressedFile);
            
          if (uploadError) throw uploadError;
          const { data: publicUrlData } = supabase.storage.from('work_photos').getPublicUrl(fileName);
          photoUrl = publicUrlData.publicUrl;
        } catch (photoErr) {
          throw new Error('写真のアップロードに失敗しました。');
        }
      }

      const cropId = crops.find(c => c.name === selectedCrop)?.id;
      const fieldId = fields.find(f => f.name === selectedField)?.id;
      const matId = materials.find(m => m.name === selectedMaterial)?.id;

      const logData = {
        crop_id: cropId || null,
        field_id: fieldId || null,
        work_type: workType,
        duration_minutes: parseInt(duration, 10),
        status: 'completed',
        work_date: new Date().toISOString().split('T')[0],
        material_id: matId || null,
        material_quantity: materialQuantity ? parseFloat(materialQuantity) : null,
        memo: memo || null,
      };

      const res = await submitWorkLog(tenantId, currentUser.id, logData);
      
      if (!res.success) {
        throw new Error(res.error);
      }

      setIsSubmitting(false);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        resetForm();
      }, 2500);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || '通信エラーが発生しました');
      setIsSubmitting(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      // プレビュー用のURL生成
      const previewUrl = URL.createObjectURL(file);
      setPhotoPreview(previewUrl);
    }
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  if (!isMounted || isLoading) return (
    <div className="min-h-screen bg-emerald-950 flex flex-col items-center justify-center text-emerald-500 gap-4">
      <Loader2 className="w-8 h-8 animate-spin" />
      <p className="font-bold">農園情報を読み込み中...</p>
    </div>
  );

  // エラー時（URL間違いなど）
  if (errorMsg && !farmInfo) return (
    <div className="min-h-screen bg-emerald-950 flex flex-col items-center justify-center text-rose-500 gap-4 p-6 text-center">
      <AlertCircle className="w-12 h-12" />
      <h1 className="text-xl font-bold">アクセスエラー</h1>
      <p className="font-medium text-emerald-200">{errorMsg}</p>
    </div>
  );

  // === ログイン画面 ===
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-emerald-950 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
          <div className="p-8 text-center bg-emerald-900/20 border-b border-emerald-900/50">
            <div className="w-16 h-16 bg-emerald-950/50 rounded-full mx-auto mb-4 flex items-center justify-center border border-emerald-800/50 shadow-inner">
              <Building2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h1 className="text-xl font-black text-white tracking-tight mb-1">{farmInfo?.company_name}</h1>
            <p className="text-sm font-medium text-emerald-500">現場ログイン</p>
          </div>
          
          <form onSubmit={handleLogin} className="p-8 space-y-6">
            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm font-bold text-center">
                {errorMsg}
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">1. お名前</label>
                <div className="relative">
                  <select
                    value={selectedWorkerId}
                    onChange={(e) => setSelectedWorkerId(e.target.value)}
                    required
                    className="w-full appearance-none bg-slate-950 border-2 border-slate-800 text-white rounded-xl px-4 py-3.5 outline-none focus:border-emerald-500 focus:bg-emerald-950/30 transition-all font-bold"
                  >
                    <option value="" disabled>名前を選択してください</option>
                    {workers.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">2. 暗証番号 (4桁)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value.replace(/[^0-9]/g, ''))}
                  required
                  placeholder="••••"
                  className="w-full bg-slate-950 border-2 border-slate-800 text-white rounded-xl px-4 py-3.5 outline-none focus:border-emerald-500 focus:bg-emerald-950/30 transition-all font-bold text-center text-xl tracking-[1em]"
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={!selectedWorkerId || pinCode.length !== 4 || isLoggingIn}
              className={`w-full py-4 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all ${
                (!selectedWorkerId || pinCode.length !== 4 || isLoggingIn)
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-emerald-950 hover:shadow-emerald-500/25'
              }`}
            >
              {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : 'ログインして作業開始'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // === 作業記録画面 ===
  return (
    <main className="min-h-screen bg-emerald-950 text-slate-100 font-sans pb-32">
      <header className="sticky top-0 z-10 backdrop-blur-md bg-emerald-950/80 border-b border-emerald-800/50 px-4 pt-4 pb-2 shadow-lg flex flex-col gap-4">
        <div className="max-w-md w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-xl shadow-md text-emerald-950">
              <Building2 className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white">{farmInfo?.company_name}</h1>
              <p className="text-xs font-medium text-emerald-400">
                お疲れ様です、{currentUser.name}さん！
              </p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 bg-emerald-900 text-emerald-400 rounded-full hover:bg-emerald-800 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* タブ切り替え */}
        <div className={`max-w-md w-full mx-auto flex bg-emerald-900/50 p-1 rounded-xl ${activeWorkStartTime ? 'opacity-50 pointer-events-none' : ''}`}>
          <button
            onClick={() => setInputMode('timer')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              inputMode === 'timer' ? 'bg-emerald-500 text-emerald-950 shadow-sm' : 'text-emerald-300/70'
            }`}
          >
            <Play className="w-4 h-4 fill-current" />
            作業開始(打刻)
          </button>
          <button
            onClick={() => setInputMode('manual')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              inputMode === 'manual' ? 'bg-emerald-500 text-emerald-950 shadow-sm' : 'text-emerald-300/70'
            }`}
          >
            <History className="w-4 h-4" />
            手入力(事後)
          </button>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 pt-6">
        {isSuccess ? (
          <div className="my-12 p-8 bg-gradient-to-b from-emerald-900/90 to-teal-950/90 rounded-3xl border border-emerald-500/40 shadow-2xl text-center flex flex-col items-center justify-center space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-400/40 shadow-inner">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-black text-white">記録完了！</h2>
            <p className="text-sm text-emerald-200">お疲れ様でした！🌱</p>
          </div>
        ) : (
          <form onSubmit={inputMode === 'timer' ? handleStartWork : handleManualSubmit} className="space-y-6">
            
            {errorMsg && (
              <div className="p-4 bg-rose-500/20 border border-rose-500/50 text-rose-400 rounded-xl text-sm font-bold flex items-start gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className={`space-y-6 transition-all duration-300 ${activeWorkStartTime ? 'opacity-60 pointer-events-none grayscale-[30%]' : ''}`}>
              <div className="grid grid-cols-2 gap-4">
                <section className="bg-emerald-900/40 p-4 rounded-2xl border border-emerald-800/40 shadow-sm">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2.5 flex items-center gap-2">
                    <Sprout className="w-4 h-4" />作目 (必須)
                  </h2>
                  <div className="flex flex-col gap-2">
                    {crops.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCrop(c.name)}
                        className={`py-2.5 px-2 rounded-lg font-bold text-sm transition-all border text-center ${
                          selectedCrop === c.name
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-emerald-950 border-emerald-300 shadow-md'
                            : 'bg-emerald-950/60 text-slate-300 border-emerald-800/60'
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="bg-emerald-900/40 p-4 rounded-2xl border border-emerald-800/40 shadow-sm">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-teal-400 mb-2.5 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />圃場 (必須)
                  </h2>
                  <div className="flex flex-col gap-2">
                    {fields.map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setSelectedField(f.name)}
                        className={`py-2.5 px-2 rounded-lg font-bold text-sm transition-all border text-center ${
                          selectedField === f.name
                            ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 border-teal-300 shadow-md'
                            : 'bg-emerald-950/60 text-slate-300 border-emerald-800/60'
                        }`}
                      >
                        {f.name}
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              <section className="bg-emerald-900/40 p-4 rounded-2xl border border-emerald-800/40 shadow-sm">
                <h2 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2.5 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />作業内容 (必須)
                </h2>
                <div className="grid grid-cols-3 gap-2">
                  {workTypes.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setWorkType(t)}
                      className={`py-3 px-2 rounded-xl font-bold text-xs transition-all border text-center ${
                        workType === t
                          ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 border-amber-200 shadow-md'
                          : 'bg-emerald-950/60 text-slate-300 border-emerald-800/60'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </section>

              {inputMode === 'manual' && (
                <section className="bg-sky-900/30 p-4 rounded-2xl border border-sky-800/40 shadow-sm">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-sky-400 mb-2.5 flex items-center gap-2">
                    <Clock className="w-4 h-4" />作業時間 (分) (必須)
                  </h2>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="0"
                    className="w-full py-4 px-4 text-3xl font-black text-center bg-emerald-950/80 rounded-xl border-2 border-sky-700/50 text-white placeholder-emerald-800 focus:border-sky-400 focus:outline-none"
                    required
                  />
                </section>
              )}

              {/* 写真＆メモセクション */}
              <section className="bg-slate-900/40 p-4 rounded-2xl border border-slate-700/50 shadow-sm space-y-4">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-2">
                    <span className="text-lg">📸</span> 写真を添付
                  </h2>
                  
                  {!photoPreview ? (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-700 border-dashed rounded-xl cursor-pointer bg-slate-800/50 hover:bg-slate-800 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6 text-slate-400">
                        <span className="text-3xl mb-2">📷</span>
                        <p className="text-sm font-bold">タップして写真を撮影・選択</p>
                      </div>
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} disabled={!!activeWorkStartTime} />
                    </label>
                  ) : (
                    <div className="relative w-full rounded-xl overflow-hidden border-2 border-emerald-500/50">
                      <img src={photoPreview} alt="Preview" className="w-full h-48 object-cover" />
                      <button
                        type="button"
                        onClick={clearPhoto}
                        disabled={!!activeWorkStartTime}
                        className="absolute top-2 right-2 bg-black/70 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold hover:bg-rose-500 transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-2">
                    <span className="text-lg">📝</span> 作業メモ・内容
                  </h2>
                  <textarea
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="今日の気づきや特記事項を入力..."
                    className="w-full h-24 p-3 bg-slate-950 border border-slate-700 text-white rounded-xl placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                  />
                </div>
              </section>
            </div>

            {activeWorkStartTime ? (
              <div className="mt-8 p-6 bg-emerald-900/40 border-2 border-emerald-500 rounded-3xl text-center shadow-[0_0_30px_rgba(16,185,129,0.2)] animate-in slide-in-from-bottom-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-400 animate-pulse"></div>
                <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold mb-2">
                  <Clock className="w-5 h-5 animate-spin-slow" style={{ animationDuration: '3s' }} />
                  現在作業中...
                </div>
                <div className="text-6xl font-black text-white tracking-tighter tabular-nums mb-4 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)] flex items-baseline justify-center">
                  {elapsedMinutes}<span className="text-2xl text-emerald-400 ml-1 mr-2">分</span>
                  <span className="text-5xl">{elapsedSeconds.toString().padStart(2, '0')}</span><span className="text-xl text-emerald-400 ml-1">秒</span>
                </div>
                
                <button
                  type="button"
                  onClick={handleStopWork}
                  disabled={isSubmitting}
                  className="w-full py-5 rounded-2xl font-black text-xl shadow-[0_0_20px_rgba(244,63,94,0.4)] flex items-center justify-center gap-3 bg-gradient-to-r from-rose-500 to-red-600 text-white hover:brightness-110 active:scale-[0.98] transition-all"
                >
                  {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                    <>
                      <Square className="w-6 h-6 fill-white" />
                      作業を終了する
                    </>
                  )}
                </button>
              </div>
            ) : (
              <button
                type="submit"
                disabled={!selectedCrop || !selectedField || !workType || (inputMode === 'manual' && !duration) || isSubmitting}
                className={`w-full py-5 rounded-2xl font-black text-xl shadow-xl transition-all duration-200 flex items-center justify-center gap-3 mt-8 ${
                  (!selectedCrop || !selectedField || !workType || (inputMode === 'manual' && !duration) || isSubmitting)
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    : 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-emerald-950 hover:brightness-110 active:scale-[0.98] shadow-emerald-500/20'
                }`}
              >
                {isSubmitting ? (
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-950" />
                ) : inputMode === 'timer' ? (
                  <>
                    <Play className="w-6 h-6 fill-current" />
                    作業を開始する
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-6 h-6" />
                    作業を記録する
                  </>
                )}
              </button>
            )}
            
          </form>
        )}
      </div>
    </main>
  );
}
