"use client";

import React, { useState, useEffect } from 'react';
import { Clock, MapPin, Sprout, CheckCircle2, User, AlertCircle, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Crop {
  id: string;
  name: string;
}

interface Field {
  id: string;
  name: string;
}

interface Worker {
  id: string;
  name: string;
}

export default function WorkEntryPage() {
  const [crops, setCrops] = useState<Crop[]>([
    { id: '1', name: '伏見唐辛子' },
    { id: '2', name: '米（キヌヒカリ）' },
    { id: '3', name: '九条ネギ' },
  ]);
  const [fields, setFields] = useState<Field[]>([
    { id: '1', name: '第1ハウス' },
    { id: '2', name: '第2ハウス' },
    { id: '3', name: '東田んぼ' },
    { id: '4', name: '西畑' },
  ]);
  const [workers, setWorkers] = useState<Worker[]>([
    { id: '1', name: '京都 太郎' },
    { id: '2', name: '農場 花子' },
  ]);

  const [selectedCrop, setSelectedCrop] = useState<string>('');
  const [selectedField, setSelectedField] = useState<string>('');
  const [selectedWorker, setSelectedWorker] = useState<string>('');
  const [workType, setWorkType] = useState<string>('');
  const [duration, setDuration] = useState<string>('');
  const [memo, setMemo] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const workTypes = ['収穫', '定植・播種', '水やり', '肥料・農薬', '草刈り', '片付け・メンテ'];

  useEffect(() => {
    // Supabaseから実際のデータを取得（設定されている場合）
    async function fetchData() {
      try {
        const [cropsRes, fieldsRes, workersRes] = await Promise.all([
          supabase.from('crops').select('id, name'),
          supabase.from('fields').select('id, name'),
          supabase.from('workers').select('id, name'),
        ]);

        if (cropsRes.data && cropsRes.data.length > 0) setCrops(cropsRes.data);
        if (fieldsRes.data && fieldsRes.data.length > 0) setFields(fieldsRes.data);
        if (workersRes.data && workersRes.data.length > 0) setWorkers(workersRes.data);

        if (!cropsRes.error) setIsConnected(true);
      } catch (err) {
        console.log('Using mock data mode:', err);
      }
    }
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (isConnected) {
        // Supabaseへデータを挿入
        const { error } = await supabase.from('work_logs').insert([
          {
            crop_id: crops.find(c => c.name === selectedCrop)?.id || null,
            field_id: fields.find(f => f.name === selectedField)?.id || null,
            worker_id: workers.find(w => w.name === selectedWorker)?.id || null,
            work_type: workType,
            duration_minutes: parseInt(duration, 10),
            memo: memo || null,
            work_date: new Date().toISOString().split('T')[0],
          },
        ]);
        if (error) console.error('Insert error:', error);
      } else {
        // デモ/モックモードの遅延シミュレーション
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      setIsSubmitting(false);
      setIsSuccess(true);

      setTimeout(() => {
        setIsSuccess(false);
        setSelectedCrop('');
        setSelectedField('');
        setSelectedWorker('');
        setWorkType('');
        setDuration('');
        setMemo('');
      }, 2500);
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-emerald-950 text-slate-100 font-sans pb-28">
      {/* ヒーローヘッダー */}
      <header className="sticky top-0 z-10 backdrop-blur-md bg-emerald-950/80 border-b border-emerald-800/50 px-4 py-4 shadow-lg">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-xl shadow-md text-emerald-950">
              <Clock className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                Agri-Profit Engine
              </h1>
              <p className="text-xs font-medium text-emerald-300/80">現場用・作業記録システム</p>
            </div>
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${
              isConnected
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            {isConnected ? 'Supabase連動中' : 'デモモード'}
          </span>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 pt-6">
        {/* 登録完了アニメーション */}
        {isSuccess ? (
          <div className="my-12 p-8 bg-gradient-to-b from-emerald-900/90 to-teal-950/90 rounded-3xl border border-emerald-500/40 shadow-2xl text-center flex flex-col items-center justify-center space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-400/40 shadow-inner">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-black text-white">記録完了！</h2>
            <p className="text-sm text-emerald-200">
              作業時間を正常に記録しました。<br />お疲れ様でした！🌱
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 1. 作業者選択 */}
            <section className="bg-emerald-900/40 p-4 rounded-2xl border border-emerald-800/40 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2.5 flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-400" />
                作業者
              </h2>
              <div className="flex flex-wrap gap-2">
                {workers.map((worker) => (
                  <button
                    key={worker.id}
                    type="button"
                    onClick={() => setSelectedWorker(worker.name)}
                    className={`flex-1 py-3 px-3 rounded-xl font-bold text-sm transition-all duration-200 border ${
                      selectedWorker === worker.name
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-emerald-950 border-emerald-300 shadow-md shadow-emerald-500/20 scale-[1.02]'
                        : 'bg-emerald-950/60 text-slate-300 border-emerald-800/60 hover:border-emerald-700'
                    }`}
                  >
                    {worker.name}
                  </button>
                ))}
              </div>
            </section>

            {/* 2. 作目選択 */}
            <section className="bg-emerald-900/40 p-4 rounded-2xl border border-emerald-800/40 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2.5 flex items-center gap-2">
                <Sprout className="w-4 h-4 text-emerald-400" />
                作目
              </h2>
              <div className="grid grid-cols-2 gap-2.5">
                {crops.map((crop) => (
                  <button
                    key={crop.id}
                    type="button"
                    onClick={() => setSelectedCrop(crop.name)}
                    className={`py-3.5 px-3 rounded-xl font-bold text-base transition-all duration-200 border text-center ${
                      selectedCrop === crop.name
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-emerald-950 border-emerald-300 shadow-md shadow-emerald-500/20 scale-[1.02]'
                        : 'bg-emerald-950/60 text-slate-300 border-emerald-800/60 hover:border-emerald-700'
                    }`}
                  >
                    {crop.name}
                  </button>
                ))}
              </div>
            </section>

            {/* 3. 圃場選択 */}
            <section className="bg-emerald-900/40 p-4 rounded-2xl border border-emerald-800/40 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wider text-teal-400 mb-2.5 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-teal-400" />
                圃場（場所）
              </h2>
              <div className="grid grid-cols-2 gap-2.5">
                {fields.map((field) => (
                  <button
                    key={field.id}
                    type="button"
                    onClick={() => setSelectedField(field.name)}
                    className={`py-3.5 px-3 rounded-xl font-bold text-base transition-all duration-200 border text-center ${
                      selectedField === field.name
                        ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 border-teal-300 shadow-md shadow-teal-500/20 scale-[1.02]'
                        : 'bg-emerald-950/60 text-slate-300 border-emerald-800/60 hover:border-emerald-700'
                    }`}
                  >
                    {field.name}
                  </button>
                ))}
              </div>
            </section>

            {/* 4. 作業内容 */}
            <section className="bg-emerald-900/40 p-4 rounded-2xl border border-emerald-800/40 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2.5 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                作業内容
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {workTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setWorkType(type)}
                    className={`py-3 px-2 rounded-xl font-bold text-xs transition-all duration-200 border text-center ${
                      workType === type
                        ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 border-amber-200 shadow-md shadow-amber-500/20 scale-[1.02]'
                        : 'bg-emerald-950/60 text-slate-300 border-emerald-800/60 hover:border-emerald-700'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </section>

            {/* 5. 作業時間 (分) */}
            <section className="bg-emerald-900/40 p-4 rounded-2xl border border-emerald-800/40 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wider text-sky-400 mb-2.5 flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-400" />
                作業時間 (分)
              </h2>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="0"
                className="w-full py-4 px-4 text-3xl font-black text-center bg-emerald-950/80 rounded-xl border-2 border-emerald-700 text-white placeholder-emerald-800 focus:border-emerald-400 focus:outline-none transition-all shadow-inner"
                required
              />
              <div className="grid grid-cols-4 gap-2 mt-3">
                {[30, 60, 90, 120].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDuration(mins.toString())}
                    className="py-2.5 bg-emerald-800/50 hover:bg-emerald-700/60 text-emerald-200 rounded-xl text-xs font-bold border border-emerald-700/50 active:scale-95 transition-all"
                  >
                    +{mins}分
                  </button>
                ))}
              </div>
            </section>

            {/* 6. メモ (任意) */}
            <section className="bg-emerald-900/40 p-4 rounded-2xl border border-emerald-800/40 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                メモ（任意）
              </h2>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="気付きや特記事項があれば入力"
                className="w-full py-3 px-3 text-sm bg-emerald-950/80 rounded-xl border border-emerald-800 text-slate-200 placeholder-emerald-700/70 focus:border-emerald-500 focus:outline-none"
              />
            </section>

            {/* 送信ボタン */}
            <button
              type="submit"
              disabled={!selectedCrop || !selectedField || !workType || !duration || isSubmitting}
              className={`w-full py-4 rounded-2xl font-black text-lg shadow-xl transition-all duration-200 flex items-center justify-center gap-2 ${
                !selectedCrop || !selectedField || !workType || !duration || isSubmitting
                  ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-emerald-950 hover:brightness-110 active:scale-[0.98] shadow-emerald-500/20'
              }`}
            >
              {isSubmitting ? (
                <span>送信中...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-6 h-6" />
                  <span>作業を記録する</span>
                </>
              )}
            </button>
          </form>
        )}

        {!isConnected && (
          <div className="mt-8 p-4 rounded-2xl bg-amber-950/40 border border-amber-700/40 text-amber-200/90 text-xs leading-relaxed flex gap-3 items-start">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-300 mb-0.5">現在デモモードで動作中です</p>
              Supabaseの接続キーを設定するには、<code>.env.local</code> に取得した URL と API Key を記載してください。
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
