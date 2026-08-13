"use client";

import React, { useState, useEffect, use } from 'react';
import { Clock, MapPin, Sprout, CheckCircle2, User, Sparkles, Play, Square, Package, History, LogOut, Loader2, AlertCircle, Building2, Video, Lock, X, FileText, Image as ImageIcon } from 'lucide-react';
import { getFarmInfo, getFarmWorkers, verifyWorkerPin, getFarmMasters, submitWorkLog, TenantInfo } from '@/app/actions/farm';
import { supabase } from '@/lib/supabase';
import imageCompression from 'browser-image-compression';
import { t, getTranslatedName, LANGUAGES, LanguageCode } from '@/lib/i18n';

interface MasterItem {
  id: string;
  name: string;
  unit?: string;
  name_en?: string;
  name_vi?: string;
  name_id?: string;
  name_zh?: string;
}

export default function FarmWorkerPage({ params }: { params: Promise<{ tenant_id: string }> }) {
  const unwrappedParams = use(params);
  const tenantId = unwrappedParams.tenant_id;
  
  const [isMounted, setIsMounted] = useState(false);
  
  const [farmInfo, setFarmInfo] = useState<TenantInfo | null>(null);
  const [workers, setWorkers] = useState<{id: string, name: string}[]>([]);
  const [currentUser, setCurrentUser] = useState<{id: string, name: string, role: string} | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [language, setLanguage] = useState<LanguageCode>('ja');

  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [crops, setCrops] = useState<MasterItem[]>([]);
  const [fields, setFields] = useState<MasterItem[]>([]);
  const [materials, setMaterials] = useState<MasterItem[]>([]);

  const [selectedCrop, setSelectedCrop] = useState('');
  const [selectedField, setSelectedField] = useState('');
  const [workType, setWorkType] = useState('');
  const [duration, setDuration] = useState('');
  const [memo, setMemo] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [materialQuantity, setMaterialQuantity] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const [inputMode, setInputMode] = useState<'timer' | 'manual' | 'manuals'>('timer');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const [manuals, setManuals] = useState<any[]>([]);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);

  const [activeWorkStartTime, setActiveWorkStartTime] = useState<string | null>(null);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const workTypes = [
    { ja: '播種・定植', en: 'Sowing/Planting', vi: 'Gieo hạt/Trồng cây', id: 'Menabur/Menanam', zh: '播种/种植' },
    { ja: '水やり・追肥', en: 'Watering/Fertilizing', vi: 'Tưới nước/Bón phân', id: 'Menyiram/Memupuk', zh: '浇水/施肥' },
    { ja: '草引き・防除', en: 'Weeding/Pest control', vi: 'Làm cỏ/Kiểm soát dịch hại', id: 'Menyiangi/Pengendalian hama', zh: '除草/害虫防治' },
    { ja: '収穫・調整', en: 'Harvesting/Adjustment', vi: 'Thu hoạch/Điều chỉnh', id: 'Memanen/Penyesuaian', zh: '收获/调整' },
    { ja: '片付け・その他', en: 'Cleanup/Other', vi: 'Dọn dẹp/Khác', id: 'Pembersihan/Lainnya', zh: '清理/其他' },
  ];

  useEffect(() => {
    setIsMounted(true);
    
    const init = async () => {
      const infoRes = await getFarmInfo(tenantId);
      if (!infoRes.success || !infoRes.data) {
        setErrorMsg(infoRes.error || '農園が見つかりません');
        setIsLoading(false);
        return;
      }
      setFarmInfo(infoRes.data);

      const workersRes = await getFarmWorkers(tenantId);
      if (workersRes.success && workersRes.data) {
        setWorkers(workersRes.data);
      }

      const savedLang = localStorage.getItem(`agri_lang_${tenantId}`) as LanguageCode;
      if (savedLang && LANGUAGES.some(l => l.code === savedLang)) {
        setLanguage(savedLang);
      }

      const savedSession = localStorage.getItem(`agri_worker_${tenantId}`);
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        setCurrentUser(parsed);
        fetchMasters();
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

  const fetchManuals = async () => {
    const { data, error } = await supabase
      .from('video_manuals')
      .select('*')
      .eq('user_id', tenantId)
      .order('created_at', { ascending: false });
        
    if (!error && data) setManuals(data);
  };

  useEffect(() => {
    if (tenantId) fetchManuals();
  }, [tenantId]);

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
      calcElapsed();
      interval = setInterval(calcElapsed, 1000);
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
    setVideoFile(null);
    setErrorMsg('');
  };

  const handleLanguageChange = (code: LanguageCode) => {
    setLanguage(code);
    localStorage.setItem(`agri_lang_${tenantId}`, code);
    
    // 出荷記録など他のページとも同期するため、存在するすべてのキーを更新
    const langKeys = Object.keys(localStorage).filter(k => k.startsWith('agri_lang_'));
    langKeys.forEach(key => localStorage.setItem(key, code));
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
      setErrorMsg(t('login', language) + 'に失敗しました');
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
      let uploadedPhotoUrl = null;
      let uploadedVideoUrl = null;

      if (photoFile) {
          const options = { maxSizeMB: 1, maxWidthOrHeight: 1280, useWebWorker: true };
          const compressedFile = await imageCompression(photoFile, options);
          const fileName = `${tenantId}/${currentUser.id}/${Date.now()}.jpg`;
          const { error: uploadError } = await supabase.storage.from('work_photos').upload(fileName, compressedFile);
          if (uploadError) throw uploadError;
          uploadedPhotoUrl = supabase.storage.from('work_photos').getPublicUrl(fileName).data.publicUrl;
      }
      
      if (videoFile) {
          const fileName = `${tenantId}/${currentUser.id}/${Date.now()}_video.mp4`;
          const { error: uploadError } = await supabase.storage.from('work_videos').upload(fileName, videoFile);
          if (uploadError) throw uploadError;
          uploadedVideoUrl = fileName;
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
        photo_url: uploadedPhotoUrl,
        video_url: uploadedVideoUrl
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
      let uploadedPhotoUrl = null;
      let uploadedVideoUrl = null;

      if (photoFile) {
          const options = { maxSizeMB: 1, maxWidthOrHeight: 1280, useWebWorker: true };
          const compressedFile = await imageCompression(photoFile, options);
          const fileName = `${tenantId}/${currentUser.id}/${Date.now()}.jpg`;
          const { error: uploadError } = await supabase.storage.from('work_photos').upload(fileName, compressedFile);
          if (uploadError) throw uploadError;
          uploadedPhotoUrl = supabase.storage.from('work_photos').getPublicUrl(fileName).data.publicUrl;
      }

      if (videoFile) {
          const fileName = `${tenantId}/${currentUser.id}/${Date.now()}_video.mp4`;
          const { error: uploadError } = await supabase.storage.from('work_videos').upload(fileName, videoFile);
          if (uploadError) throw uploadError;
          uploadedVideoUrl = fileName;
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
        photo_url: uploadedPhotoUrl,
        video_url: uploadedVideoUrl
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
      <p className="font-bold">Loading...</p>
    </div>
  );

  if (errorMsg && !farmInfo) return (
    <div className="min-h-screen bg-emerald-950 flex flex-col items-center justify-center text-rose-500 gap-4 p-6 text-center">
      <AlertCircle className="w-12 h-12" />
      <h1 className="text-xl font-bold">Error</h1>
      <p className="font-medium text-emerald-200">{errorMsg}</p>
    </div>
  );

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-emerald-950 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
          <div className="p-8 text-center bg-emerald-900/20 border-b border-emerald-900/50">
            <h1 className="text-xl font-black text-white">{farmInfo?.company_name}</h1>
          </div>
          <form onSubmit={handleLogin} className="p-8 space-y-6">
            <select
              value={selectedWorkerId}
              onChange={(e) => setSelectedWorkerId(e.target.value)}
              required
              className="w-full bg-slate-950 border-2 border-slate-800 text-white rounded-xl px-4 py-3.5"
            >
              <option value="">-- {t('worker', language)} --</option>
              {workers.map(w => (
                <option key={w.id} value={w.id}>{getTranslatedName(w, language)}</option>
              ))}
            </select>
            <input
              type="password"
              placeholder="••••"
              value={pinCode}
              onChange={(e) => setPinCode(e.target.value.replace(/[^0-9]/g, ''))}
              maxLength={4}
              className="w-full bg-slate-950 border-2 border-slate-800 text-white rounded-xl px-4 py-3.5 text-center text-xl tracking-[1em]"
            />
            <button type="submit" className="w-full py-4 rounded-xl bg-emerald-500 font-bold">
              {isLoggingIn ? '...' : t('login', language)}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-emerald-950 text-slate-100 font-sans pb-32">
      <header className="sticky top-0 z-10 backdrop-blur-md bg-emerald-950/80 border-b border-emerald-800/50 px-4 pt-4 pb-2 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 rounded-xl p-2"><Building2 className="w-5 h-5 text-emerald-950" /></div>
          <div>
            <h1 className="font-black text-white">{farmInfo?.company_name}</h1>
            <p className="text-xs text-emerald-400">{currentUser.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={language}
            onChange={e => handleLanguageChange(e.target.value as LanguageCode)}
            className="bg-emerald-800 text-white text-xs font-bold rounded-lg px-2 py-1 focus:outline-none"
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.flag} {l.code.toUpperCase()}</option>
            ))}
          </select>
          <button onClick={handleLogout} className="p-2 bg-emerald-900 rounded-full hover:bg-emerald-800 transition-colors">
            <LogOut className="w-5 h-5 text-emerald-400" />
          </button>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 pt-6">
        <div className="flex bg-emerald-900/50 p-1 rounded-xl mb-6">
          <button onClick={() => setInputMode('timer')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${inputMode === 'timer' ? 'bg-emerald-500 text-emerald-950' : 'text-emerald-300'}`}>{t('tabTimer', language)}</button>
          <button onClick={() => setInputMode('manual')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${inputMode === 'manual' ? 'bg-emerald-500 text-emerald-950' : 'text-emerald-300'}`}>{t('tabManual', language)}</button>
          {farmInfo?.plan_type === 'premium' && (
            <button onClick={() => setInputMode('manuals')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${inputMode === 'manuals' ? 'bg-emerald-500 text-emerald-950' : 'text-emerald-300'}`}>{t('tabManuals', language)}</button>
          )}
        </div>

        {isSuccess ? (
          <div className="my-12 p-8 bg-emerald-900/50 rounded-3xl border border-emerald-500 text-center space-y-4">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6 mx-auto">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-black text-white">{t('recordingComplete', language)}</h2>
            <p className="text-sm text-emerald-200">{t('goodJob', language)}</p>
          </div>
        ) : inputMode !== 'manuals' ? (
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
                    <Sprout className="w-4 h-4" />{t('crop', language)}
                  </h2>
                  <select value={selectedCrop} onChange={(e) => setSelectedCrop(e.target.value)} required className="w-full bg-emerald-950/60 p-3 rounded-xl border border-emerald-800/60 text-sm font-bold">
                      <option value="">-- {t('selectRequired', language)} --</option>
                      {crops.map(c => <option key={c.id} value={c.name}>{getTranslatedName(c, language)}</option>)}
                  </select>
                </section>

                <section className="bg-emerald-900/40 p-4 rounded-2xl border border-emerald-800/40 shadow-sm">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-teal-400 mb-2.5 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />{t('field', language)}
                  </h2>
                  <select value={selectedField} onChange={(e) => setSelectedField(e.target.value)} required className="w-full bg-emerald-950/60 p-3 rounded-xl border border-emerald-800/60 text-sm font-bold">
                      <option value="">-- {t('selectRequired', language)} --</option>
                      {fields.map(f => <option key={f.id} value={f.name}>{getTranslatedName(f, language)}</option>)}
                  </select>
                </section>
              </div>

              <section className="bg-emerald-900/40 p-4 rounded-2xl border border-emerald-800/40 shadow-sm">
                <h2 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2.5 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />{t('workType', language)}
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {workTypes.map(tData => (
                    <button
                      key={tData.ja}
                      type="button"
                      onClick={() => setWorkType(tData.ja)}
                      className={`py-2 px-2 rounded-xl font-bold text-xs transition-all border text-center ${
                        workType === tData.ja
                          ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 border-amber-200'
                          : 'bg-emerald-950/60 text-slate-300 border-emerald-800/60'
                      }`}
                    >
                      {(tData as any)[language] || tData.ja}
                    </button>
                  ))}
                </div>
              </section>

              <section className="bg-violet-900/30 p-4 rounded-2xl border border-violet-800/40 shadow-sm">
                <h2 className="text-xs font-bold uppercase tracking-wider text-violet-400 mb-2.5 flex items-center gap-2">
                  <Package className="w-4 h-4" />{t('material', language)}
                </h2>
                <div className="space-y-3">
                  <select value={selectedMaterial} onChange={(e) => setSelectedMaterial(e.target.value)} className="w-full bg-slate-950 p-3 rounded-xl border border-slate-700 text-sm font-bold">
                      <option value="">--</option>
                      {materials.map(m => <option key={m.id} value={m.name}>{getTranslatedName(m, language)}</option>)}
                  </select>
                  {selectedMaterial && (
                    <div className="flex items-center gap-3">
                      <input type="number" value={materialQuantity} onChange={(e) => setMaterialQuantity(e.target.value)} placeholder={t('amount', language)} className="flex-1 px-3 py-3 bg-slate-950 border border-slate-700 text-white rounded-xl font-bold" />
                      <div className="text-sm font-bold text-slate-400">{materials.find(m => m.name === selectedMaterial)?.unit}</div>
                    </div>
                  )}
                </div>
              </section>

              {inputMode === 'manual' && (
                <section className="bg-sky-900/30 p-4 rounded-2xl border border-sky-800/40 shadow-sm">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-sky-400 mb-2.5 flex items-center gap-2">
                    <Clock className="w-4 h-4" />作業時間 (分)
                  </h2>
                  <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="0" className="w-full py-4 px-4 text-3xl font-black text-center bg-emerald-950/80 rounded-xl border-2 border-sky-700/50 text-white" required />
                </section>
              )}

              <section className="bg-slate-900/40 p-4 rounded-2xl border border-slate-700/50 shadow-sm space-y-4">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />{t('photo', language)}
                  </h2>
                  {!photoPreview ? (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-700 border-dashed rounded-xl cursor-pointer bg-slate-800/50">
                      <span className="text-3xl mb-2">📷</span>
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
                    </label>
                  ) : (
                    <div className="relative w-full rounded-xl overflow-hidden border-2 border-emerald-500/50">
                      <img src={photoPreview} alt="Preview" className="w-full h-48 object-cover" />
                      <button type="button" onClick={clearPhoto} className="absolute top-2 right-2 bg-black/70 text-white w-8 h-8 rounded-full">×</button>
                    </div>
                  )}
                </div>
                
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-2">
                    <FileText className="w-4 h-4" />{t('memo', language)}
                  </h2>
                  <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder={t('memoPlaceholder', language)} className="w-full h-24 p-3 bg-slate-950 border border-slate-700 text-white rounded-xl text-sm" />
                </div>

                {farmInfo?.plan_type === 'premium' && (
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-2">
                      <Video className="w-4 h-4" />{t('video', language)}
                    </h2>
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                      <input 
                        type="file" 
                        accept="video/mp4,video/quicktime,video/webm" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file && file.size > 50 * 1024 * 1024) {
                            alert('動画のサイズは50MB以下にしてください。');
                            e.target.value = '';
                            setVideoFile(null);
                          } else {
                            setVideoFile(file || null);
                          }
                        }}
                        className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-emerald-500/20 file:text-emerald-400"
                      />
                    </div>
                  </div>
                )}
              </section>
            </div>

            {activeWorkStartTime ? (
              <div className="mt-8 p-6 bg-emerald-900/40 border-2 border-emerald-500 rounded-3xl text-center shadow-[0_0_30px_rgba(16,185,129,0.2)] animate-in slide-in-from-bottom-4">
                <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold mb-2">
                  <Clock className="w-5 h-5 animate-spin-slow" /> {t('workingNow', language)}
                </div>
                <div className="text-6xl font-black text-white tracking-tighter tabular-nums mb-4 flex items-baseline justify-center">
                  {elapsedMinutes}<span className="text-2xl text-emerald-400 ml-1 mr-2">m</span>
                  <span className="text-5xl">{elapsedSeconds.toString().padStart(2, '0')}</span><span className="text-xl text-emerald-400 ml-1">s</span>
                </div>
                
                <button type="button" onClick={handleStopWork} disabled={isSubmitting} className="w-full py-5 rounded-2xl font-black text-xl shadow-[0_0_20px_rgba(244,63,94,0.4)] flex items-center justify-center gap-3 bg-gradient-to-r from-rose-500 to-red-600 text-white">
                  {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Square className="w-6 h-6 fill-white" />{t('stopWork', language)}</>}
                </button>
              </div>
            ) : (
              <button
                type="submit"
                disabled={!selectedCrop || !selectedField || !workType || (inputMode === 'manual' && !duration) || isSubmitting}
                className={`w-full py-5 rounded-2xl font-black text-xl shadow-xl transition-all flex items-center justify-center gap-3 mt-8 ${
                  (!selectedCrop || !selectedField || !workType || (inputMode === 'manual' && !duration) || isSubmitting)
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    : 'bg-gradient-to-r from-emerald-400 to-teal-400 text-emerald-950'
                }`}
              >
                {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : inputMode === 'timer' ? <><Play className="w-6 h-6 fill-current" />{t('startWork', language)}</> : <><CheckCircle2 className="w-6 h-6" />{t('save', language)}</>}
              </button>
            )}
          </form>
        ) : (
          <div className="px-4 py-6 space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2 mb-4">
              <Video className="w-5 h-5 text-rose-500" /> {t('videoManuals', language)}
            </h2>
            
            {farmInfo?.plan_type !== 'premium' ? (
              <div className="bg-slate-900/60 rounded-2xl p-8 text-center border border-slate-800">
                <Lock className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                <h3 className="font-bold text-white mb-2">プレミアムプラン限定</h3>
              </div>
            ) : manuals.length === 0 ? (
              <div className="bg-slate-900/60 rounded-2xl p-8 text-center border border-slate-800">
                <p className="text-sm text-slate-400">{t('noManuals', language)}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {manuals.map(manual => (
                  <div key={manual.id} className="bg-slate-900/60 rounded-2xl overflow-hidden border border-slate-800">
                    <div 
                      className="aspect-video bg-black relative flex items-center justify-center cursor-pointer"
                      onClick={async () => {
                        try {
                          const { data, error } = await supabase.storage.from('work_videos').createSignedUrl(manual.video_url, 3600);
                          if (!error && data?.signedUrl) setPlayingVideo(data.signedUrl);
                        } catch (err) {
                          alert('動画の再生に失敗しました。');
                        }
                      }}
                    >
                      <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                        <Play className="w-6 h-6 text-white ml-1" />
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-white mb-1">{manual.title}</h3>
                      {manual.description && <p className="text-xs text-slate-400 line-clamp-2">{manual.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* マニュアル再生モーダル */}
        {playingVideo && (
          <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black">
            <div className="w-full flex justify-end p-4">
              <button onClick={() => setPlayingVideo(null)} className="p-2 bg-white/20 rounded-full text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <video src={playingVideo} controls autoPlay playsInline className="w-full max-h-[80vh] object-contain" />
          </div>
        )}
      </div>
    </main>
  );
}
