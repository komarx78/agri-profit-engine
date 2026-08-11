"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, MapPin, Sprout, CheckCircle2, User, Sparkles, Play, Square, Package, History, LogOut, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { WorkerGate } from '@/components/WorkerGate';

interface MasterItem {
  id: string;
  name: string;
}

export default function WorkEntryPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<{id: string, name: string, role: string} | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const [crops, setCrops] = useState<MasterItem[]>([]);
  const [fields, setFields] = useState<MasterItem[]>([]);
  const [materials, setMaterials] = useState<MasterItem[]>([]);

  // フォーム状態
  const [selectedCrop, setSelectedCrop] = useState<string>('');
  const [selectedField, setSelectedField] = useState<string>('');
  const [workType, setWorkType] = useState<string>('');
  const [duration, setDuration] = useState<string>(''); // 手入力用
  const [memo, setMemo] = useState<string>('');
  const [selectedMaterial, setSelectedMaterial] = useState<string>('');
  const [materialQuantity, setMaterialQuantity] = useState<string>('');

  const [inputMode, setInputMode] = useState<'timer' | 'manual'>('timer');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>(''); // エラー表示用

  // 打刻関連の状態
  const [activeWorkLog, setActiveWorkLog] = useState<any>(null);
  const [elapsedMinutes, setElapsedMinutes] = useState<number>(0);

  const workTypes = ['収穫', '定植・播種', '水やり', '肥料・農薬', '草刈り', '片付け・メンテ'];

  useEffect(() => {
    setIsMounted(true);
    
    // ワーカーログインチェック（SaaSオーナーではなく、現場のワーカー）
    const savedUser = localStorage.getItem('agri_user');
    if (!savedUser) {
      // ログインしていなければ WorkerGate が表示されるようにする
      return;
    }
    const parsedUser = JSON.parse(savedUser);
    setCurrentUser(parsedUser);

    async function fetchData() {
      try {
        const [cRes, fRes, mRes] = await Promise.all([
          supabase.from('crops').select('id, name'),
          supabase.from('fields').select('id, name'),
          supabase.from('materials').select('id, name')
        ]);

        if (cRes.data) setCrops(cRes.data);
        if (fRes.data) setFields(fRes.data);
        if (mRes.data) setMaterials(mRes.data);
        if (!cRes.error) setIsConnected(true);

        // アクティブな作業がないかチェック（自分の直近1件のみ）
        if (!cRes.error && parsedUser) {
          const { data: activeLogs } = await supabase
            .from('work_logs')
            .select(`
              *,
              crops(name),
              fields(name),
              materials(name)
            `)
            .eq('worker_id', parsedUser.id)
            .eq('status', 'running')
            .order('created_at', { ascending: false })
            .limit(1);
            
          if (activeLogs && activeLogs.length > 0) {
            const log = activeLogs[0];
            setActiveWorkLog(log);
            // 進行中のデータをフォームに復元
            if (log.crops?.name) setSelectedCrop(log.crops.name);
            if (log.fields?.name) setSelectedField(log.fields.name);
            if (log.work_type) setWorkType(log.work_type);
            if (log.materials?.name) {
              setSelectedMaterial(log.materials.name);
              if (log.material_quantity) setMaterialQuantity(String(log.material_quantity));
            }
          }
        }
      } catch (err) {
        console.log('Using mock data mode:', err);
      }
    }
    fetchData();
  }, [router]);

  // 経過時間の計算タイマー
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeWorkLog && activeWorkLog.start_time) {
      const calcElapsed = () => {
        const start = new Date(activeWorkLog.start_time).getTime();
        const now = new Date().getTime();
        setElapsedMinutes(Math.floor((now - start) / 1000 / 60));
      };
      calcElapsed(); // 初回実行
      interval = setInterval(calcElapsed, 10000); // 10秒ごとに更新
    }
    return () => clearInterval(interval);
  }, [activeWorkLog]);

  const resetForm = () => {
    setSelectedCrop('');
    setSelectedField('');
    setWorkType('');
    setDuration('');
    setMemo('');
    setSelectedMaterial('');
    setMaterialQuantity('');
    setErrorMsg('');
  };

  const handleLogout = () => {
    if(confirm('ログアウトしますか？')) {
      localStorage.removeItem('agri_user');
      router.push('/login');
    }
  };

  const handleStartWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      if (isConnected) {
        const cropId = crops.find(c => c.name === selectedCrop)?.id;
        const fieldId = fields.find(f => f.name === selectedField)?.id;
        const matId = materials.find(m => m.name === selectedMaterial)?.id;

        const startTime = new Date().toISOString();

        const { data, error } = await supabase.from('work_logs').insert([
          {
            worker_id: currentUser.id,
            crop_id: cropId || null,
            field_id: fieldId || null,
            work_type: workType,
            start_time: startTime,
            status: 'running',
            work_date: startTime.split('T')[0],
            duration_minutes: 0, // 作業開始時点では時間を0として保存（DBのNOT NULL制約対策）
            material_id: matId || null,
            material_quantity: materialQuantity ? parseFloat(materialQuantity) : null,
            memo: memo || null,
          },
        ]).select(`
          *,
          crops(name),
          fields(name),
          materials(name)
        `);
        
        if (error) {
          console.error('Supabase Insert Error:', error);
          throw new Error(`データベース保存エラー: ${error.message} (おそらくSQLの実行忘れが原因です)`);
        }
        
        if (data && data.length > 0) setActiveWorkLog(data[0]);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 800));
        setActiveWorkLog({ start_time: new Date().toISOString(), work_type: workType });
      }
      setIsSubmitting(false);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || '通信エラーが発生しました');
      setIsSubmitting(false);
    }
  };

  const handleStopWork = async () => {
    if (!activeWorkLog) return;
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      if (isConnected && activeWorkLog.id) {
        const endTime = new Date();
        const startTime = new Date(activeWorkLog.start_time);
        const diffMins = Math.floor((endTime.getTime() - startTime.getTime()) / 1000 / 60);

        const { error } = await supabase.from('work_logs').update({
          end_time: endTime.toISOString(),
          duration_minutes: diffMins,
          status: 'completed'
        }).eq('id', activeWorkLog.id);
        
        if (error) {
          console.error('Supabase Update Error:', error);
          throw new Error(`データベース更新エラー: ${error.message}`);
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
      
      setActiveWorkLog(null);
      setIsSubmitting(false);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        resetForm(); // 終了時に初めてリセット
      }, 2500);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || '通信エラーが発生しました');
      setIsSubmitting(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      if (isConnected) {
        const cropId = crops.find(c => c.name === selectedCrop)?.id;
        const fieldId = fields.find(f => f.name === selectedField)?.id;
        const matId = materials.find(m => m.name === selectedMaterial)?.id;

        const { error } = await supabase.from('work_logs').insert([
          {
            worker_id: currentUser.id,
            crop_id: cropId || null,
            field_id: fieldId || null,
            work_type: workType,
            duration_minutes: parseInt(duration, 10),
            status: 'completed',
            work_date: new Date().toISOString().split('T')[0],
            material_id: matId || null,
            material_quantity: materialQuantity ? parseFloat(materialQuantity) : null,
            memo: memo || null,
          },
        ]);
        if (error) {
          console.error('Supabase Insert Error:', error);
          throw new Error(`データベース保存エラー: ${error.message}`);
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 800));
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

  if (!isMounted) return (
    <div className="min-h-screen bg-emerald-950 flex items-center justify-center text-emerald-500">
      <Loader2 className="w-8 h-8 animate-spin" />
    </div>
  );

  if (!currentUser) {
    return <WorkerGate onLogin={(user) => setCurrentUser(user)} />;
  }

  return (
    <main className="min-h-screen bg-emerald-950 text-slate-100 font-sans pb-32">
      <header className="sticky top-0 z-10 backdrop-blur-md bg-emerald-950/80 border-b border-emerald-800/50 px-4 pt-4 pb-2 shadow-lg flex flex-col gap-4">
        <div className="max-w-md w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-xl shadow-md text-emerald-950">
              <Clock className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white">作業記録</h1>
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

        {/* タブ切り替え（作業中は切り替え不可） */}
        <div className={`max-w-md w-full mx-auto flex bg-emerald-900/50 p-1 rounded-xl ${activeWorkLog ? 'opacity-50 pointer-events-none' : ''}`}>
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
            
            {/* エラーメッセージの表示エリア */}
            {errorMsg && (
              <div className="p-4 bg-rose-500/20 border border-rose-500/50 text-rose-400 rounded-xl text-sm font-bold flex items-start gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* ▼ フォーム入力部分（作業中は操作不可にする） */}
            <div className={`space-y-6 transition-all duration-300 ${activeWorkLog ? 'opacity-60 pointer-events-none grayscale-[30%]' : ''}`}>
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

              {/* 作業内容 */}
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

              {/* 資材の使用 */}
              <section className="bg-purple-900/30 p-4 rounded-2xl border border-purple-800/40 shadow-sm">
                <h2 className="text-xs font-bold uppercase tracking-wider text-purple-400 mb-2.5 flex items-center gap-2">
                  <Package className="w-4 h-4" />使った資材 (任意)
                </h2>
                <div className="space-y-3">
                  <select 
                    value={selectedMaterial}
                    onChange={(e) => setSelectedMaterial(e.target.value)}
                    className="w-full py-3 px-4 bg-emerald-950/80 rounded-xl border border-purple-800/60 text-slate-200 focus:outline-none focus:border-purple-400 font-bold"
                  >
                    <option value="">資材を選ばない</option>
                    {materials.map(m => (
                      <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                  
                  {selectedMaterial && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={materialQuantity}
                        onChange={(e) => setMaterialQuantity(e.target.value)}
                        placeholder="使用量"
                        className="flex-1 py-3 px-4 text-xl font-black bg-emerald-950/80 rounded-xl border border-purple-800/60 text-white placeholder-emerald-800 focus:outline-none focus:border-purple-400"
                      />
                      <span className="text-purple-300 font-bold">単位</span>
                    </div>
                  )}
                </div>
              </section>

              {/* 手入力モード時の時間指定 */}
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
            </div>

            {/* ▼ アクションボタン領域（作業中か否かで切り替わる） */}
            {activeWorkLog ? (
              <div className="mt-8 p-6 bg-emerald-900/40 border-2 border-emerald-500 rounded-3xl text-center shadow-[0_0_30px_rgba(16,185,129,0.2)] animate-in slide-in-from-bottom-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-400 animate-pulse"></div>
                <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold mb-2">
                  <Clock className="w-5 h-5 animate-spin-slow" style={{ animationDuration: '3s' }} />
                  現在作業中...
                </div>
                <div className="text-6xl font-black text-white tracking-tighter tabular-nums mb-4 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                  {elapsedMinutes}<span className="text-2xl text-emerald-400 ml-1">分</span>
                </div>
                <div className="text-emerald-200 font-bold text-sm mb-6 flex flex-col gap-1 items-center">
                  <span>{activeWorkLog.crops?.name || selectedCrop}</span>
                  <span className="bg-emerald-950/50 px-3 py-1 rounded-full">{activeWorkLog.work_type || workType}</span>
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
