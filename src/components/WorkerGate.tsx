"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Lock, ArrowRight, Loader2, Globe } from 'lucide-react';
import { t, getTranslatedName, LANGUAGES, LanguageCode } from '@/lib/i18n';

interface WorkerGateProps {
  onLogin: (user: any) => void;
}

// 安全なlocalStorageラッパー（Safari プライベートブラウズ等の例外クラッシュ防止）
const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window === 'undefined') return null;
      return window.localStorage.getItem(key);
    } catch (e) {
      console.warn(`safeStorage.getItem error for ${key}:`, e);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn(`safeStorage.setItem error for ${key}:`, e);
    }
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn(`safeStorage.removeItem error for ${key}:`, e);
    }
  },
  clearWorkerCache: (): void => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('agri_current_worker');
        window.localStorage.removeItem('agri_owner_id');
        window.localStorage.removeItem('agri_cached_company_name');
        const keys = Object.keys(window.localStorage);
        keys.forEach(k => {
          if (k.startsWith('sb-') || k.startsWith('agri_attendance_') || k.startsWith('agri_payment_')) {
            window.localStorage.removeItem(k);
          }
        });
      }
    } catch (e) {
      console.warn('safeStorage.clearWorkerCache error:', e);
    }
  }
};

export function WorkerGate({ onLogin }: WorkerGateProps) {
  const [workers, setWorkers] = useState<any[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [pinCode, setPinCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [language, setLanguage] = useState<LanguageCode>('ja');
  const [debugOwnerId, setDebugOwnerId] = useState('');
  const [isLineBrowser, setIsLineBrowser] = useState(false);

  useEffect(() => {
    let loadedLang = 'ja' as LanguageCode;
    const savedGlobalLang = safeStorage.getItem('agri_language') as LanguageCode;
    if (savedGlobalLang && LANGUAGES.some(l => l.code === savedGlobalLang)) {
        loadedLang = savedGlobalLang;
    }
    setLanguage(loadedLang);

    if (typeof window !== 'undefined' && /Line\//i.test(navigator.userAgent)) {
      setIsLineBrowser(true);
    }
  }, []);

  const [showManualSetup, setShowManualSetup] = useState(false);
  const [inputFarmId, setInputFarmId] = useState('');

  const loadWorkersForOwner = async (targetOwnerId: string) => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      let workerList: any[] = [];
      let resolvedOwnerId = targetOwnerId;

      // 1. targetOwnerId がある場合はまずクライアントSDKで直接取得（2秒タイムアウト保護）
      if (targetOwnerId && targetOwnerId !== 'null' && targetOwnerId !== 'undefined') {
        try {
          const clientPromise = supabase
            .from('workers')
            .select('*')
            .eq('user_id', targetOwnerId)
            .order('name');
          const timeoutPromise = new Promise<any>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 2000)
          );
          const { data, error } = await Promise.race([clientPromise, timeoutPromise]);
          if (!error && data && data.length > 0) {
            workerList = data;
          }
        } catch (e) {
          console.warn('Client SDK fetch failed or timed out, trying API:', e);
        }
      }

      // 2. クライアントで取れなかった、またはtargetOwnerId未指定の場合はAPI経由で取得（2.5秒タイムアウト保護）
      if (workerList.length === 0) {
        try {
          const controller = new AbortController();
          const tId = setTimeout(() => controller.abort(), 2500);
          const apiUrl = targetOwnerId && targetOwnerId !== 'null' && targetOwnerId !== 'undefined'
            ? `/api/workers?ownerId=${encodeURIComponent(targetOwnerId)}`
            : `/api/workers`;
          const res = await fetch(apiUrl, {
            signal: controller.signal
          });
          clearTimeout(tId);
          const json = await res.json();
          if (json.workers && json.workers.length > 0) {
            workerList = json.workers;
            if (json.ownerId) {
              resolvedOwnerId = json.ownerId;
            }
          } else if (json.error) {
            setErrorMsg(json.error);
          }
        } catch (e) {
          console.error('API fetch failed:', e);
        }
      }

      if (workerList.length > 0) {
        setErrorMsg('');
        setWorkers(workerList);
        if (resolvedOwnerId) {
          safeStorage.setItem('agri_owner_id', resolvedOwnerId);
          setDebugOwnerId(resolvedOwnerId);
        }
      } else if (!targetOwnerId) {
        setErrorMsg('所属農園が未設定です。管理者から案内された専用URLまたはQRコードからアクセスしてください。');
      } else {
        setErrorMsg('この農園に登録された作業者が見つかりません。管理者画面（スタッフマスタ）から作業者を登録してください。');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('データ取得エラー: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // 3.5秒で何があってもスピナーを強制解除する安全脱出タイマー
    const failsafeTimer = setTimeout(() => {
      setIsLoading(false);
    }, 3500);

    let ownerId = safeStorage.getItem('agri_owner_id') || '';

    // URLクエリパラメータ（?farm=xxx または ?tenant=xxx、?reset=1）を取得・処理
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        
        // リセット指令があれば端末の古い認証・作業者キャッシュを全パージ
        if (params.get('reset') === '1' || params.get('clear') === '1') {
          safeStorage.clearWorkerCache();
          ownerId = '';
        }

        const paramFarmId = params.get('farm') || params.get('tenant');
        if (paramFarmId && paramFarmId !== 'null' && paramFarmId !== 'undefined') {
          ownerId = paramFarmId;
          safeStorage.setItem('agri_owner_id', paramFarmId);
        }
      } catch (urlErr) {
        console.warn('URL parsing error in WorkerGate:', urlErr);
      }
    }

    setDebugOwnerId(ownerId || '未設定');

    // ownerIdが未指定でも、単一農園運用環境の自動解決を試みる
    loadWorkersForOwner(ownerId);

    return () => clearTimeout(failsafeTimer);
  }, []);

  const handleManualSetupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputFarmId.trim()) return;
    const cleanId = inputFarmId.trim();
    loadWorkersForOwner(cleanId);
  };

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
          role: data.role || 'staff',
          type: data.type || data.employment_type || 'パート',
          employment_type: data.type || data.employment_type || 'パート',
          user_id: data.user_id
        };

        safeStorage.setItem('agri_current_worker', JSON.stringify(user));
        if (data.user_id) {
          safeStorage.setItem('agri_owner_id', data.user_id);
        }
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
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-emerald-500 gap-4">
        <Loader2 className="w-10 h-10 animate-spin" />
        <div className="text-center">
          <p className="text-sm font-bold text-slate-300">スタッフ画面を準備中...</p>
          <p className="text-xs text-slate-500 mt-1">電波状況により数秒かかる場合があります</p>
        </div>
        <button
          onClick={() => setIsLoading(false)}
          className="mt-3 px-4 py-2 bg-slate-900 border border-slate-700 hover:bg-slate-800 text-emerald-400 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
        >
          画面が進まない場合はここをタップ
        </button>
      </div>
    );
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
        {isLineBrowser && (
          <div className="mb-6 p-3 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-300 text-xs leading-relaxed">
            <p className="font-bold mb-1">⚠️ LINEアプリ内で開かれています</p>
            <p className="text-[11px] text-amber-200/90">
              画面右下の「…」または右上のメニューから<strong>「Safariで開く」</strong>または<strong>「ブラウザで開く」</strong>を選ぶと、より快適・高速に動作します。
            </p>
          </div>
        )}

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

        <div className="mt-6 pt-6 border-t border-slate-800 text-center space-y-3">
          <div>
            <button
              type="button"
              onClick={() => setShowManualSetup(!showManualSetup)}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              {showManualSetup ? '▲ 農園コード入力を閉じる' : '⚙️ 所属農園コードを手動で入力する'}
            </button>
            {showManualSetup && (
              <form onSubmit={handleManualSetupSubmit} className="mt-3 p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <p className="text-[11px] text-slate-400 text-left">
                  管理者から共有された農園ID（UUID）を入力してください
                </p>
                <input
                  type="text"
                  value={inputFarmId}
                  onChange={(e) => setInputFarmId(e.target.value)}
                  placeholder="例: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1.5 px-3 text-xs text-white outline-none focus:border-emerald-500 font-mono"
                />
                <button
                  type="submit"
                  disabled={!inputFarmId.trim()}
                  className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors"
                >
                  農園を設定して読み込む
                </button>
              </form>
            )}
          </div>
          <div>
            <a
              href="/login"
              className="text-xs font-bold text-slate-400 hover:text-emerald-400 transition-colors inline-flex items-center gap-1"
            >
              <span>👨‍💼 管理者アカウントでログインする</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
          <div className="pt-2 border-t border-slate-800/60">
            <button
              type="button"
              onClick={() => {
                safeStorage.clearWorkerCache();
                if (typeof window !== 'undefined') {
                  const url = new URL(window.location.href);
                  url.searchParams.set('reset', '1');
                  window.location.href = url.toString();
                }
              }}
              className="text-[11px] text-slate-500 hover:text-amber-400 transition-colors inline-block"
            >
              🔄 画面が固まる・更新されない場合はここをタップ（端末初期化）
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
