"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Lock, ArrowRight, Loader2, Globe } from 'lucide-react';
import { t, getTranslatedName, LANGUAGES, LanguageCode } from '@/lib/i18n';

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
  const [language, setLanguage] = useState<LanguageCode>('ja');

  useEffect(() => {
    let loadedLang = 'ja' as LanguageCode;
    const savedGlobalLang = localStorage.getItem('agri_language') as LanguageCode;
    if (savedGlobalLang && LANGUAGES.some(l => l.code === savedGlobalLang)) {
        loadedLang = savedGlobalLang;
    }
    setLanguage(loadedLang);
  }, []);

  useEffect(() => {
    async function fetchWorkers() {
      try {
        const ownerId = localStorage.getItem('agri_owner_id');
        if (!ownerId) {
          setErrorMsg('タブレットが設定されていません。一度管理者でログインしてください。');
          setIsLoading(false);
          return;
        }

        // 安全なAPIルート経由で、ownerIdに紐づくスタッフのみを取得
        const res = await fetch(`/api/workers?ownerId=${ownerId}`);
        const data = await res.json();
        
        if (data.error) throw new Error(data.error);
        if (data.workers) setWorkers(data.workers);
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
      const data = workers.find(w => w.id === selectedWorkerId);
      
      if (!data) throw new Error('Worker not found');
      
      const expectedPin = data.pin_code || '0000';
      
      if (data && expectedPin === pinCode) {
        const user = {
          id: data.id,
          name: data.name,
          name_en: data.name_en,
          name_vi: data.name_vi,
          name_id: data.name_id,
          name_zh: data.name_zh,
          name_si: data.name_si,
          name_km: data.name_km,
          role: data.role || 'staff'
        };

        localStorage.setItem('agri_current_worker', JSON.stringify(user));
        onLogin(user);
      } else {
        setErrorMsg(t('incorrectPin', language));
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(t('loginFailed', language));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
      {/* 言語切り替え */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <Globe className="w-4 h-4 text-slate-500" />
        <select 
          value={language}
          onChange={e => {
            const newLang = e.target.value as LanguageCode;
            setLanguage(newLang);
            localStorage.setItem('agri_language', newLang);
            const langKeys = Object.keys(localStorage).filter(k => k.startsWith('agri_lang_'));
            langKeys.forEach(key => localStorage.setItem(key, newLang));
          }}
          className="bg-slate-900 text-slate-300 text-sm font-bold rounded-lg px-2 py-1 focus:outline-none border border-slate-800"
        >
          {LANGUAGES.map(l => (
            <option key={l.code} value={l.code}>{l.flag} {l.code.toUpperCase()}</option>
          ))}
        </select>
      </div>

      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl mx-auto flex items-center justify-center mb-4 border border-emerald-500/30">
            <User className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-black text-white">{t('workerLogin', language)}</h1>
          <p className="text-sm text-slate-400 mt-2">{t('selectNamePrompt', language)}</p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-3 bg-rose-500/20 border border-rose-500/50 text-rose-400 rounded-lg text-sm text-center font-bold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">1. {t('yourName', language)}</label>
            <select
              value={selectedWorkerId}
              onChange={(e) => setSelectedWorkerId(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-emerald-500 transition-colors font-bold"
            >
              <option value="" disabled>{t('selectName', language)}</option>
              {workers.map(w => (
                <option key={w.id} value={w.id}>{getTranslatedName(w, language)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">2. {t('yourPin', language)}</label>
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
            <p className="text-xs text-slate-500 mt-2">{t('pinHint', language)}</p>
          </div>

          <button
            type="submit"
            disabled={!selectedWorkerId || pinCode.length !== 4 || isSubmitting}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black rounded-xl flex items-center justify-center gap-2 transition-colors mt-8"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                {t('loginAndStart', language)}
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
