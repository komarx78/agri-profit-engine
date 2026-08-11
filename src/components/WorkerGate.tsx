"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Lock, ArrowRight, Loader2 } from 'lucide-react';

interface WorkerGateProps {
  onLogin: (user: { id: string, name: string, role: string }) => void;
}

export function WorkerGate({ onLogin }: WorkerGateProps) {
  const [workers, setWorkers] = useState<any[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [pinCode, setPinCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function fetchWorkers() {
      try {
        // 現在のテナント（オーナー）に紐づくワーカーのみを取得する
        // ※ workersテーブルにも user_id を追加してRLSをかけることが前提
        const { data, error } = await supabase.from('workers').select('id, name').order('name');
        if (data) setWorkers(data);
        if (error) throw error;
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchWorkers();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .eq('id', selectedWorkerId)
        .single();
        
      if (error) throw error;
      
      const expectedPin = data.pin_code || '0000';
      
      if (data && expectedPin === pinCode) {
        const user = {
          id: data.id,
          name: data.name,
          role: data.role || 'staff'
        };
        localStorage.setItem('agri_user', JSON.stringify(user));
        onLogin(user);
      } else {
        setErrorMsg('暗証番号が間違っています。');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('ログインに失敗しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl mx-auto flex items-center justify-center mb-4 border border-emerald-500/30">
            <User className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-black text-white">現場ログイン</h1>
          <p className="text-sm text-slate-400 mt-2">自分の名前と暗証番号を入力してください</p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-3 bg-rose-500/20 border border-rose-500/50 text-rose-400 rounded-lg text-sm text-center font-bold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">1. お名前</label>
            <select
              value={selectedWorkerId}
              onChange={(e) => setSelectedWorkerId(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-emerald-500 transition-colors font-bold"
            >
              <option value="" disabled>名前を選択してください</option>
              {workers.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">2. 暗証番号 (4桁)</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="password"
                maxLength={4}
                inputMode="numeric"
                pattern="[0-9]*"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                required
                placeholder="0000"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-emerald-500 transition-colors font-black tracking-[0.5em] text-xl"
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">※初期設定は「0000」です</p>
          </div>

          <button
            type="submit"
            disabled={!selectedWorkerId || pinCode.length !== 4 || isSubmitting}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black rounded-xl flex items-center justify-center gap-2 transition-colors mt-8"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                ログインして作業開始
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
