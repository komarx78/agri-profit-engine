"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Lock, ArrowRight, Loader2, Globe, Eye, EyeOff, Building, RefreshCw } from 'lucide-react';
import { t, getTranslatedName, LANGUAGES, LanguageCode } from '@/lib/i18n';
import { reportSystemError } from '@/lib/errorReporter';

interface WorkerGateProps {
  onLogin: (user: any) => void;
  farmId?: string;
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

export function WorkerGate({ onLogin, farmId }: WorkerGateProps) {
  const [workers, setWorkers] = useState<any[]>([]);
  const [currentFarmName, setCurrentFarmName] = useState<string>('');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [step, setStep] = useState<'select_farm' | 'select_worker' | 'enter_pin'>('select_worker');
  const [pinCode, setPinCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [language, setLanguage] = useState<LanguageCode>('ja');
  const [debugOwnerId, setDebugOwnerId] = useState('');
  const [isLineBrowser, setIsLineBrowser] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [inputFarmId, setInputFarmId] = useState('');

  // 全角数字 ➔ 半角数字自動変換 ＆ 非数字除去
  const normalizePin = (val: string) => {
    if (!val) return '';
    return val
      .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
      .replace(/\D/g, '')
      .slice(0, 4);
  };

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

  const loadWorkersForOwner = async (targetOwnerId: string) => {
    setIsLoading(true);
    setErrorMsg('');

    try {
      let workerList: any[] = [];
      let resolvedOwnerId = targetOwnerId;

      // 1. 農園IDの解決（company_settings の id でも user_id でも両対応、未指定時は主農園へ自動解決）
      try {
        const { data: companies } = await supabase
          .from('company_settings')
          .select('id, user_id, company_name');
        
        if (companies && companies.length > 0) {
          if (targetOwnerId && targetOwnerId !== 'null' && targetOwnerId !== 'undefined') {
            const matched = companies.find(c => c.user_id === targetOwnerId || c.id === targetOwnerId);
            if (matched) {
              resolvedOwnerId = matched.user_id;
              setCurrentFarmName(matched.company_name);
              safeStorage.setItem('agri_cached_company_name', matched.company_name);
            } else {
              resolvedOwnerId = targetOwnerId;
            }
          } else {
            // targetOwnerId が一切未指定の場合のみ主農園を自動解決
            const mainComp = companies.find(c => c.company_name?.includes('佐原')) || companies[0];
            if (mainComp) {
              resolvedOwnerId = mainComp.user_id;
              setCurrentFarmName(mainComp.company_name);
              safeStorage.setItem('agri_cached_company_name', mainComp.company_name);
            }
          }
        }
      } catch (cErr) {
        console.warn('Company resolution error:', cErr);
      }

      // 2. まずクライアントSDKで直接取得（2秒タイムアウト保護）
      if (resolvedOwnerId) {
        try {
          const clientPromise = supabase
            .from('workers')
            .select('*')
            .eq('user_id', resolvedOwnerId)
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

      // 3. クライアントで取れなかった場合はAPI経由で取得（自動解決付きAPI）
      if (workerList.length === 0) {
        try {
          const controller = new AbortController();
          const tId = setTimeout(() => controller.abort(), 2500);
          const apiUrl = `/api/workers?ownerId=${encodeURIComponent(resolvedOwnerId || '')}`;
          const res = await fetch(apiUrl, { signal: controller.signal });
          clearTimeout(tId);
          const json = await res.json();
          if (json.workers && json.workers.length > 0) {
            workerList = json.workers;
            if (json.farmName) {
              setCurrentFarmName(json.farmName);
              safeStorage.setItem('agri_cached_company_name', json.farmName);
            }
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

      // 4. 万が一まだ0件の場合（※農園IDが未指定の場合のみ、主農園をフェッチして救済）
      if (workerList.length === 0 && !targetOwnerId) {
        try {
          const { data: fallbackWorkers } = await supabase
            .from('workers')
            .select('*')
            .eq('user_id', '62163024-2c8e-4057-a872-2455dbc58d32')
            .order('name');
          if (fallbackWorkers && fallbackWorkers.length > 0) {
            workerList = fallbackWorkers;
            resolvedOwnerId = '62163024-2c8e-4057-a872-2455dbc58d32';
            setCurrentFarmName('佐原農園株式会社');
            safeStorage.setItem('agri_cached_company_name', '佐原農園株式会社');
          }
        } catch (fbErr) {
          console.warn('Fallback workers fetch error:', fbErr);
        }
      }

      if (workerList.length > 0) {
        setErrorMsg('');
        setWorkers(workerList);
        setStep('select_worker');
        if (resolvedOwnerId) {
          safeStorage.setItem('agri_owner_id', resolvedOwnerId);
          setDebugOwnerId(resolvedOwnerId);
        }
      } else {
        setWorkers([]);
        setErrorMsg(t('noWorkersInFarm', language));
      }
    } catch (err: any) {
      console.error(err);
      reportSystemError({
        category: 'login',
        message: `現場ワーカー取得エラー: ${err?.message || 'Unknown error'}`,
        error: err,
        companyName: currentFarmName
      });
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

    let ownerId = farmId || safeStorage.getItem('agri_owner_id') || '';

    // URLクエリパラメータ（?farm=xxx または ?tenant=xxx、?reset=1）を取得・処理
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        
        // リセット指令があれば端末の古い認証・作業者キャッシュを全パージ
        if (params.get('reset') === '1' || params.get('clear') === '1') {
          safeStorage.clearWorkerCache();
          ownerId = farmId || '';
        }

        let paramFarmId = farmId || params.get('farm') || params.get('tenant') || params.get('ownerId') || params.get('farmId') || params.get('tenant_id');
        if (!paramFarmId) {
          const match = window.location.pathname.match(/\/(?:portal|farm)\/([a-zA-Z0-9_-]+)/);
          if (match && match[1]) {
            paramFarmId = match[1];
          }
        }
        if (paramFarmId && paramFarmId !== 'null' && paramFarmId !== 'undefined') {
          ownerId = paramFarmId;
          safeStorage.setItem('agri_owner_id', paramFarmId);
        }
      } catch (urlErr) {
        console.warn('URL parsing error in WorkerGate:', urlErr);
      }
    }

    setDebugOwnerId(ownerId || '未設定');

    // 指定された農園の作業者一覧をロード
    loadWorkersForOwner(ownerId);

    return () => clearTimeout(failsafeTimer);
  }, [farmId]);

  const handleManualSetupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputFarmId.trim()) return;
    const cleanId = inputFarmId.trim();
    loadWorkersForOwner(cleanId);
  };

  // 認証・ログインの実行（共通ロジック）
  const executeLogin = async (workerId: string, pinToTest: string) => {
    if (!workerId) return;
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const data = workers.find(w => w.id === workerId);
      if (!data) throw new Error('Worker not found');

      const expectedPin = (data.pin_code || '0000').trim();
      const enteredPin = normalizePin(pinToTest);
      const paddedEntered = enteredPin.padStart(expectedPin.length, '0');

      // 半角変換値、または桁数補完値（例: 129 -> 0129）のいずれかが一致すればパス
      const isMatch = (enteredPin === expectedPin) || (paddedEntered === expectedPin);

      if (data && isMatch) {
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
        const isDefaultZero = expectedPin === '0000';
        const enteredPinText = enteredPin ? t('inputPinNumber', language).replace('{pin}', enteredPin) : '';
        const hintText = isDefaultZero ? t('pinHintDefault', language) : t('pinHintBirthday', language);
        setErrorMsg(
          t('incorrectPin', language) + enteredPinText + '\n' + hintText
        );
        setPinCode('');
      }
    } catch (err: any) {
      console.error(err);
      reportSystemError({
        category: 'login',
        message: `現場ログインPIN照合エラー: ${err?.message || '不明なエラー'}`,
        error: err,
        workerId,
        companyName: currentFarmName
      });
      setErrorMsg(t('loginFailed', language));
    } finally {
      setIsSubmitting(false);
    }
  };

  // スタッフ選択ハンドラー（即座にPIN画面へ遷移）
  const handleSelectWorker = (workerId: string) => {
    setSelectedWorkerId(workerId);
    setPinCode('');
    setErrorMsg('');
    setStep('enter_pin');
  };

  // ATMテンキー操作
  const handleKeypadPress = (digit: string) => {
    if (isSubmitting) return;
    setErrorMsg('');
    if (pinCode.length >= 4) return;
    const nextPin = pinCode + digit;
    setPinCode(nextPin);
    if (nextPin.length === 4) {
      executeLogin(selectedWorkerId, nextPin);
    }
  };

  const handleKeypadBackspace = () => {
    if (isSubmitting) return;
    setErrorMsg('');
    setPinCode(prev => prev.slice(0, -1));
  };

  const handleKeypadAuto0000 = () => {
    if (isSubmitting) return;
    setErrorMsg('');
    setPinCode('0000');
    executeLogin(selectedWorkerId, '0000');
  };

  const selectedWorker = workers.find(w => w.id === selectedWorkerId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
      {/* 言語切り替え */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
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

      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
        {isLineBrowser && (
          <div className="mb-4 p-3 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-300 text-xs leading-relaxed">
            <p className="font-bold mb-1">{t('lineBrowserAlertTitle', language)}</p>
            <p className="text-[11px] text-amber-200/90">
              {t('lineBrowserAlertSub', language)}
            </p>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            【ステップ0】所属農園選択画面（初回アクセス・農園未設定時）
            ══════════════════════════════════════════════════════ */}
        {step === 'select_farm' && (
          <div>
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-emerald-500/20 rounded-2xl mx-auto flex items-center justify-center mb-3 border border-emerald-500/30">
                <Building className="w-7 h-7 text-emerald-400" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white">{t('farmPortalConnect', language)}</h1>
              <p className="text-xs sm:text-sm text-slate-400 font-medium mt-1.5 leading-relaxed">
                {t('farmPortalConnectSub', language)}
              </p>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-500/20 border border-rose-500/50 text-rose-400 rounded-xl text-xs text-center font-bold whitespace-pre-line">
                {errorMsg}
              </div>
            )}

            <div className="space-y-4 mb-6">
              {/* 農園コード・ID入力フォーム */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {t('connectFarmWithCode', language)}
                </label>
                <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                  {t('farmIdPrompt', language)}
                </p>
                <form onSubmit={handleManualSetupSubmit} className="space-y-3">
                  <input
                    type="text"
                    value={inputFarmId}
                    onChange={(e) => setInputFarmId(e.target.value)}
                    placeholder="例: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-3 text-xs text-white outline-none focus:border-emerald-500 font-mono"
                  />
                  <button
                    type="submit"
                    disabled={!inputFarmId.trim() || isLoading}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-black rounded-xl text-xs transition-all cursor-pointer shadow-lg active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>{t('enterFarmPortalBtn', language)}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* 管理者ログイン案内 */}
              <div className="text-center pt-2">
                <p className="text-[11px] text-slate-500 mb-2">
                  {t('farmOwnerGuide', language)}
                </p>
                <a
                  href="/login"
                  className="w-full py-2.5 bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700/80 font-bold rounded-xl text-xs transition-all inline-flex items-center justify-center gap-2"
                >
                  <span>{t('adminLoginBtnWithUrl', language)}</span>
                  <ArrowRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            【ステップ1】お名前選択画面（スタッフカード一覧）
            ══════════════════════════════════════════════════════ */}
        {step === 'select_worker' && (
          <div>
            <div className="text-center mb-5">
              {currentFarmName && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-xs font-black text-emerald-300 mb-2">
                  <Building className="w-3.5 h-3.5" />
                  <span>{currentFarmName}</span>
                </div>
              )}
              <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl mx-auto flex items-center justify-center mb-2 border border-emerald-500/30">
                <User className="w-6 h-6 text-emerald-400" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white">{t('workerLogin', language)}</h1>
              <p className="text-xs sm:text-sm text-emerald-400 font-bold mt-1">{t('tapNamePrompt', language)}</p>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-500/20 border border-rose-500/50 text-rose-400 rounded-xl text-xs text-center font-bold whitespace-pre-line">
                {errorMsg}
              </div>
            )}

            {/* スタッフ一覧カード（スマホ幅でも押しやすい特大タッチボタン） */}
            <div className="space-y-2 mb-4 max-h-[45vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-2">
                {workers.map(w => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => handleSelectWorker(w.id)}
                    className="p-3 bg-slate-950/80 hover:bg-emerald-500/20 active:scale-95 active:bg-emerald-500 active:text-slate-950 border border-slate-800 hover:border-emerald-500/50 rounded-2xl text-left transition-all group flex flex-col justify-between min-h-[72px] cursor-pointer shadow-sm"
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <div className="w-6 h-6 rounded-full bg-slate-800 group-hover:bg-emerald-500/30 flex items-center justify-center text-[10px] font-black text-emerald-400">
                        {w.name.charAt(0)}
                      </div>
                      {w.role === 'admin' && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/20 text-amber-300 font-black rounded-md border border-amber-500/30">
                          {t('adminRole', language)}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="font-black text-white text-sm group-hover:text-emerald-300 truncate">
                        {w.name}
                      </div>
                      {(w.name_en || w.name_si || w.name_vi) && (
                        <div className="text-[10px] text-slate-500 truncate">
                          {getTranslatedName(w, language)}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {workers.length === 0 && !isLoading && (
                <div className="text-center py-6 text-slate-400 text-xs space-y-3">
                  <p>{t('noWorkersFound', language)}</p>
                  <button
                    type="button"
                    onClick={() => loadWorkersForOwner('62163024-2c8e-4057-a872-2455dbc58d32')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs inline-flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>佐原農園のスタッフを読み込む</span>
                  </button>
                </div>
              )}
            </div>

            {/* セレクトボックス（万が一用） */}
            <div className="pt-2.5 border-t border-slate-800/80">
              <label className="block text-[11px] text-slate-400 font-bold mb-1">{t('orSelectFromList', language)}</label>
              <select
                value={selectedWorkerId}
                onChange={(e) => {
                  if (e.target.value) {
                    handleSelectWorker(e.target.value);
                  }
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-white text-xs font-bold focus:outline-none focus:border-emerald-500"
              >
                <option value="">{t('selectName', language)}</option>
                {workers.map(w => (
                  <option key={w.id} value={w.id} className="bg-slate-900 text-white">
                    {getTranslatedName(w, language)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            【ステップ2】暗証番号（PINコード）入力画面（ATMテンキー）
            ══════════════════════════════════════════════════════ */}
        {step === 'enter_pin' && selectedWorker && (
          <div>
            {/* 戻るボタン */}
            <button
              type="button"
              onClick={() => {
                setStep('select_worker');
                setErrorMsg('');
                setPinCode('');
              }}
              className="text-xs text-slate-400 hover:text-white font-bold inline-flex items-center gap-1 mb-4 cursor-pointer active:scale-95 transition-all"
            >
              <ArrowRight className="w-3.5 h-3.5 rotate-180 text-emerald-400" />
              <span>{t('reselectName', language)}</span>
            </button>

            <div className="text-center mb-5">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full mb-2">
                <User className="w-4 h-4 text-emerald-400" />
                <span className="font-black text-white text-sm">
                  {getTranslatedName(selectedWorker, language)}{t('sanSuffix', language)}
                </span>
              </div>
              <h2 className="text-base font-black text-slate-200">{t('yourPin', language)}</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">{t('tapKeypadPrompt', language)}</p>
            </div>

            {/* 4桁インジケーター ＆ 表示切替 */}
            <div className="flex flex-col items-center justify-center mb-4">
              <div className="flex items-center gap-3 py-2 px-4 bg-slate-950 rounded-2xl border border-slate-800 shadow-inner">
                {[0, 1, 2, 3].map((idx) => {
                  const hasDigit = pinCode.length > idx;
                  const digitChar = pinCode[idx];
                  return (
                    <div
                      key={idx}
                      className={`w-10 h-11 rounded-xl flex items-center justify-center text-lg font-black transition-all ${
                        hasDigit
                          ? 'bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 shadow-sm shadow-emerald-500/30 scale-105'
                          : 'bg-slate-900 border border-slate-700 text-slate-600'
                      }`}
                    >
                      {hasDigit ? (showPin ? digitChar : '●') : ''}
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="p-1.5 text-slate-400 hover:text-white ml-1 cursor-pointer"
                  title={showPin ? t('hidePin', language) : t('showPin', language)}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-500/20 border border-rose-500/50 text-rose-400 rounded-xl text-xs text-center font-bold whitespace-pre-line leading-relaxed">
                {errorMsg}
              </div>
            )}

            {/* ⚡ 銀行ATM型・超大型ソフトウェアテンキー（キーボード不要・100%押しやすい） */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeypadPress(String(num))}
                  disabled={isSubmitting}
                  className="h-14 bg-slate-950 hover:bg-slate-800 active:scale-90 active:bg-emerald-500 active:text-slate-950 border border-slate-800 text-white font-black text-2xl rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {num}
                </button>
              ))}
              
              {/* 「0000」一発入力ボタン */}
              <button
                type="button"
                onClick={handleKeypadAuto0000}
                disabled={isSubmitting}
                className="h-14 bg-emerald-500/15 hover:bg-emerald-500/25 active:scale-90 active:bg-emerald-500 active:text-slate-950 border border-emerald-500/30 text-emerald-300 font-black text-xs rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer shadow-sm disabled:opacity-50 px-1 text-center"
              >
                <span>0000</span>
                <span className="text-[9px] font-bold">{t('autoFill', language)}</span>
              </button>

              {/* 「0」ボタン */}
              <button
                type="button"
                onClick={() => handleKeypadPress('0')}
                disabled={isSubmitting}
                className="h-14 bg-slate-950 hover:bg-slate-800 active:scale-90 active:bg-emerald-500 active:text-slate-950 border border-slate-800 text-white font-black text-2xl rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-sm disabled:opacity-50"
              >
                0
              </button>

              {/* 「⌫ 消去」ボタン */}
              <button
                type="button"
                onClick={handleKeypadBackspace}
                disabled={isSubmitting || pinCode.length === 0}
                className="h-14 bg-slate-950 hover:bg-slate-800 active:scale-90 active:bg-rose-500 active:text-white border border-slate-800 text-slate-400 hover:text-white font-black text-sm rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-sm disabled:opacity-30"
              >
                ⌫ {t('keypadBackspace', language)}
              </button>
            </div>

            {/* ログインボタン */}
            <button
              type="button"
              onClick={() => executeLogin(selectedWorkerId, pinCode)}
              disabled={normalizePin(pinCode).length < 3 || isSubmitting}
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-black rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95 text-sm"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>{t('loginAndStart', language)}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}

        {/* 共通フッターリンク */}
        <div className="mt-6 pt-5 border-t border-slate-800 text-center space-y-3">
          {step !== 'select_farm' && (
            <div>
              <button
                type="button"
                onClick={() => {
                  safeStorage.clearWorkerCache();
                  setWorkers([]);
                  setCurrentFarmName('');
                  setStep('select_farm');
                }}
                className="text-xs text-slate-400 hover:text-emerald-400 font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Building className="w-3.5 h-3.5" />
                <span>🏢 {t('switchFarm', language)}</span>
              </button>
            </div>
          )}

          <div>
            <a
              href="/login"
              className="text-[11px] font-bold text-slate-400 hover:text-emerald-400 transition-colors inline-flex items-center gap-1"
            >
              <span>👨‍💼 {t('adminLoginLink', language)}</span>
              <ArrowRight className="w-3 h-3" />
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
              className="text-[10px] text-slate-500 hover:text-amber-400 transition-colors inline-block"
            >
              🔄 {t('resetTerminalLink', language)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
