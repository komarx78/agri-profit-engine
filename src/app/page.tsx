"use client";

import React, { useState, useEffect } from 'react';
import { Clock, MapPin, Sprout, CheckCircle2, User, AlertCircle, Sparkles, Play, Square, Package, History } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface MasterItem {
  id: string;
  name: string;
}

export default function WorkEntryPage() {
  const [crops, setCrops] = useState<MasterItem[]>([]);
  const [fields, setFields] = useState<MasterItem[]>([]);
  const [workers, setWorkers] = useState<MasterItem[]>([]);
  const [materials, setMaterials] = useState<MasterItem[]>([]);

  // フォーム状態
  const [selectedWorker, setSelectedWorker] = useState<string>('');
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

  // 打刻関連の状態
  const [activeWorkLog, setActiveWorkLog] = useState<any>(null);
  const [elapsedMinutes, setElapsedMinutes] = useState<number>(0);

  const workTypes = ['収穫', '定植・播種', '水やり', '肥料・農薬', '草刈り', '片付け・メンテ'];

  useEffect(() => {
    async function fetchData() {
      try {
        const [cRes, fRes, wRes, mRes] = await Promise.all([
          supabase.from('crops').select('id, name'),
          supabase.from('fields').select('id, name'),
          supabase.from('workers').select('id, name'),
          supabase.from('materials').select('id, name')
        ]);

        if (cRes.data) setCrops(cRes.data);
        if (fRes.data) setFields(fRes.data);
        if (wRes.data) setWorkers(wRes.data);
        if (mRes.data) setMaterials(mRes.data);
        if (!cRes.error) setIsConnected(true);

        // アクティブな作業がないかチェック（直近1件）
        if (!cRes.error) {
          const { data: activeLogs } = await supabase
            .from('work_logs')
            .select('*')
            .eq('status', 'running')
            .order('created_at', { ascending: false })
            .limit(1);
            
          if (activeLogs && activeLogs.length > 0) {
            setActiveWorkLog(activeLogs[0]);
          }
        }
      } catch (err) {
        console.log('Using mock data mode:', err);
      }
    }
    fetchData();
  }, []);

  // 経過時間の計算タイマー
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeWorkLog && activeWorkLog.start_time) {
      const calcElapsed = () => {
        const start = new Date(activeWorkLog.start_time).getTime();
        const now = new Date().getTime();
        setElapsedMinutes(Math.floor((now - start) / 1000 / 60));
      };
      calcElapsed();
      interval = setInterval(calcElapsed, 60000); // 1分ごとに更新
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
  };

  const handleStartWork = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (isConnected) {
        const workerId = workers.find(w => w.name === selectedWorker)?.id;
        const cropId = crops.find(c => c.name === selectedCrop)?.id;
        const fieldId = fields.find(f => f.name === selectedField)?.id;
        const matId = materials.find(m => m.name === selectedMaterial)?.id;

        const startTime = new Date().toISOString();

        const { data, error } = await supabase.from('work_logs').insert([
          {
            worker_id: workerId || null,
            crop_id: cropId || null,
            field_id: fieldId || null,
            work_type: workType,
            start_time: startTime,
            status: 'running',
            work_date: startTime.split('T')[0],
            material_id: matId || null,
            material_quantity: materialQuantity ? parseFloat(materialQuantity) : null,
            memo: memo || null,
          },
        ]).select();
        
        if (error) throw error;
        if (data && data.length > 0) setActiveWorkLog(data[0]);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 800));
        setActiveWorkLog({ start_time: new Date().toISOString() });
      }
      setIsSubmitting(false);
      resetForm();
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  const handleStopWork = async () => {
    if (!activeWorkLog) return;
    setIsSubmitting(true);

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
        
        if (error) throw error;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
      
      setActiveWorkLog(null);
      setIsSubmitting(false);
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 2500);
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (isConnected) {
        const workerId = workers.find(w => w.name === selectedWorker)?.id;
        const cropId = crops.find(c => c.name === selectedCrop)?.id;
        const fieldId = fields.find(f => f.name === selectedField)?.id;
        const matId = materials.find(m => m.name === selectedMaterial)?.id;

        const { error } = await supabase.from('work_logs').insert([
          {
            worker_id: workerId || null,
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
        if (error) throw error;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      setIsSubmitting(false);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        resetForm();
      }, 2500);
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  // --- アクティブな作業がある場合（作業中画面） ---
  if (activeWorkLog) {
    return (
      <main className="min-h-screen bg-emerald-950 text-slate-100 font-sans pb-32 flex flex-col">
        <header className="px-4 py-6 text-center">
          <div className="inline-block p-2 bg-emerald-500/20 rounded-full animate-pulse mb-4">
            <Clock className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-black text-white">現在作業中</h1>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="text-sm text-emerald-300 font-bold mb-2">経過時間</div>
          <div className="text-8xl font-black text-white tracking-tighter tabular-nums drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]">
            {elapsedMinutes}<span className="text-4xl text-emerald-400 ml-2">分</span>
          </div>
          <div className="mt-8 p-6 w-full max-w-sm bg-emerald-900/40 border border-emerald-800/60 rounded-3xl backdrop-blur-sm text-center">
            <div className="text-emerald-200 font-bold text-lg mb-1">{activeWorkLog.work_type || '作業'}</div>
            <div className="text-slate-400 text-sm">{activeWorkLog.memo || 'がんばってください！'}</div>
          </div>
        </div>

        <div className="p-6 mt-auto">
          <button
            onClick={handleStopWork}
            disabled={isSubmitting}
            className="w-full py-5 rounded-full font-black text-xl shadow-[0_0_30px_rgba(244,63,94,0.3)] transition-all duration-200 flex items-center justify-center gap-3 bg-gradient-to-r from-rose-500 to-red-600 text-white hover:brightness-110 active:scale-[0.97]"
          >
            {isSubmitting ? '記録中...' : (
              <>
                <Square className="w-7 h-7 fill-white" />
                作業を終了する
              </>
            )}
          </button>
        </div>
      </main>
    );
  }

  // --- 通常の入力画面 ---
  return (
    <main className="min-h-screen bg-emerald-950 text-slate-100 font-sans pb-32">
      <header className="sticky top-0 z-10 backdrop-blur-md bg-emerald-950/80 border-b border-emerald-800/50 px-4 pt-4 pb-2 shadow-lg">
        <div className="max-w-md mx-auto flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-xl shadow-md text-emerald-950">
              <Clock className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white">作業記録</h1>
              <p className="text-xs font-medium text-emerald-300/80">
                {isConnected ? 'Supabase連動中' : 'デモモード'}
              </p>
            </div>
          </div>
        </div>

        {/* タブ切り替え */}
        <div className="max-w-md mx-auto flex bg-emerald-900/50 p-1 rounded-xl">
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
            
            {/* 1. 作業者 */}
            <section className="bg-emerald-900/40 p-4 rounded-2xl border border-emerald-800/40 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2.5 flex items-center gap-2">
                <User className="w-4 h-4" />作業者 (必須)
              </h2>
              <div className="flex flex-wrap gap-2">
                {workers.map(w => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setSelectedWorker(w.name)}
                    className={`flex-1 py-3 px-3 rounded-xl font-bold text-sm transition-all border ${
                      selectedWorker === w.name
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-emerald-950 border-emerald-300 shadow-md scale-[1.02]'
                        : 'bg-emerald-950/60 text-slate-300 border-emerald-800/60'
                    }`}
                  >
                    {w.name}
                  </button>
                ))}
              </div>
            </section>

            {/* 2. 作目と圃場（シンプルにまとめる） */}
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

            {/* 3. 作業内容 */}
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

            {/* 資材の使用 (新規追加・任意) */}
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

            <button
              type="submit"
              disabled={!selectedWorker || !selectedCrop || !selectedField || !workType || (inputMode === 'manual' && !duration) || isSubmitting}
              className={`w-full py-5 rounded-2xl font-black text-xl shadow-xl transition-all duration-200 flex items-center justify-center gap-3 ${
                (!selectedWorker || !selectedCrop || !selectedField || !workType || (inputMode === 'manual' && !duration) || isSubmitting)
                  ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-emerald-950 hover:brightness-110 active:scale-[0.98] shadow-emerald-500/20'
              }`}
            >
              {isSubmitting ? (
                <span>処理中...</span>
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
          </form>
        )}
      </div>
    </main>
  );
}
