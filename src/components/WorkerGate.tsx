"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Lock, ArrowRight, Loader2, Globe, Eye, EyeOff, Building, RefreshCw, Camera, QrCode } from 'lucide-react';
import { t, getTranslatedName, LANGUAGES, LanguageCode } from '@/lib/i18n';
import { reportSystemError } from '@/lib/errorReporter';
import { QrScannerModal } from '@/components/QrScannerModal';

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
  const [step, setStep] = useState<'enter_farm_code' | 'select_worker' | 'enter_pin'>('select_worker');
  const [pinCode, setPinCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [language, setLanguage] = useState<LanguageCode>('ja');
  const [debugOwnerId, setDebugOwnerId] = useState('');
  const [isLineBrowser, setIsLineBrowser] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [inputFarmId, setInputFarmId] = useState('');
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<'choose' | 'manual'>('choose');

  // 短縮農園コードの既知辞書（案Aの名前+数字および従来の短縮コード両対応）
  const SHORT_FARM_CODES: Record<string, string> = {
    'sahara-789': '62163024-2c8e-4057-a872-2455dbc58d32',
    'sahara789': '62163024-2c8e-4057-a872-2455dbc58d32',
    'sahara': '62163024-2c8e-4057-a872-2455dbc58d32',
    'kap-101': '83b1d7ad-6240-4fbf-8174-3dd4e2ff0c04',
    'kap101': '83b1d7ad-6240-4fbf-8174-3dd4e2ff0c04',
    'kap': '83b1d7ad-6240-4fbf-8174-3dd4e2ff0c04',
  };

  // 農園コードの照合と自社バインド（案Aの名前+数字およびQR自動入力対応）
  const handleVerifyFarmCode = async (e?: React.FormEvent, overrideCode?: string) => {
    if (e) e.preventDefault();
    const raw = (overrideCode !== undefined ? overrideCode : inputFarmId).trim();
    if (!raw) {
      setErrorMsg('農園コードを入力してください');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      // 全角英数 ➔ 半角変換・空白除去・小文字化
      const normalized = raw
        .replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
        .replace(/\s+/g, '');
      const lower = normalized.toLowerCase();
      const noHyphen = lower.replace(/-/g, '');

      let matchedUserId = '';
      let matchedFarmName = '';

      // ① DBの farm_code カラムで大文字小文字無視のピンポイント照合（ハイフン有無両対応）
      try {
        const { data: farmByCode } = await supabase
          .from('company_settings')
          .select('id, user_id, company_name, farm_code')
          .or(`farm_code.ilike.${lower},farm_code.ilike.${noHyphen}`)
          .maybeSingle();
        if (farmByCode) {
          matchedUserId = farmByCode.user_id;
          matchedFarmName = farmByCode.company_name;
        }
      } catch (codeErr) {
        // カラム未作成時等の安全スルー
      }

      // ② 既知短縮コード（sahara-789, sahara, kap-101 等）の直接解決
      if (!matchedUserId && (SHORT_FARM_CODES[lower] || SHORT_FARM_CODES[noHyphen])) {
        matchedUserId = SHORT_FARM_CODES[lower] || SHORT_FARM_CODES[noHyphen];
      }

      // ③ UUID または ID によるピンポイント照合
      if (!matchedUserId) {
        try {
          const { data: farmById } = await supabase
            .from('company_settings')
            .select('id, user_id, company_name')
            .or(`user_id.eq.${normalized},id.eq.${normalized}`)
            .maybeSingle();
          if (farmById) {
            matchedUserId = farmById.user_id;
            matchedFarmName = farmById.company_name;
          }
        } catch (idErr) {
          // UUID形式外の場合は無視
        }
      }

      if (matchedUserId) {
        if (!matchedFarmName) {
          const { data: farm } = await supabase
            .from('company_settings')
            .select('company_name')
            .eq('user_id', matchedUserId)
            .maybeSingle();
          if (farm && farm.company_name) {
            matchedFarmName = farm.company_name;
          }
        }

        setCurrentFarmName(matchedFarmName);
        safeStorage.setItem('agri_owner_id', matchedUserId);
        if (matchedFarmName) {
          safeStorage.setItem('agri_cached_company_name', matchedFarmName);
        }
        await loadWorkersForOwner(matchedUserId);
      } else {
        setErrorMsg('該当する農園が見つかりませんでした。\n農園コードをご確認の上、農園管理者にお問い合わせください。');
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('Farm verify error:', err);
      setErrorMsg('照合エラーが発生しました: ' + (err.message || ''));
    }
  };

  // 📷 QRコード読み取り結果の解析と自動接続
  const handleQrScan = (scannedText: string) => {
    let detected = scannedText.trim();
    // URLから農園IDまたは農園コードを抽出
    if (detected.includes('/portal/')) {
      const parts = detected.split('/portal/');
      if (parts[1]) {
        detected = parts[1].split('?')[0].split('/')[0];
      }
    } else if (detected.includes('?farm=')) {
      try {
        const url = new URL(detected);
        detected = url.searchParams.get('farm') || detected;
      } catch (e) {}
    } else if (detected.includes('?code=')) {
      try {
        const url = new URL(detected);
        detected = url.searchParams.get('code') || detected;
      } catch (e) {}
    }

    setInputFarmId(detected);
    handleVerifyFarmCode(undefined, detected);
  };

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
    if (!targetOwnerId || targetOwnerId === 'null' || targetOwnerId === 'undefined') {
      // 農園IDが未設定の場合は即座に農園コード入力画面へ遷移（他社一覧は絶対に取得しない）
      setStep('enter_farm_code');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      let workerList: any[] = [];
      let resolvedOwnerId = targetOwnerId;

      // 1. 指定農園のみをピンポイント照合（他社一覧の全件取得は完全遮断）
      try {
        const { data: farm } = await supabase
          .from('company_settings')
          .select('id, user_id, company_name')
          .or(`user_id.eq.${targetOwnerId},id.eq.${targetOwnerId}`)
          .maybeSingle();

        if (farm) {
          resolvedOwnerId = farm.user_id;
          setCurrentFarmName(farm.company_name);
          safeStorage.setItem('agri_cached_company_name', farm.company_name);
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

      // 4. 農園が未指定または見つからない場合は、必ず農園コード入力画面へ戻す（憲法3条）
      if (!targetOwnerId) {
        setStep('enter_farm_code');
        setIsLoading(false);
        return;
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
            【ステップ0】農園初期連携画面（初回アクセス・農園ID未設定時）
            ※他社契約一覧は一切取得・表示せず、入力されたコードのみピンポイント照合（憲法3条）
            ══════════════════════════════════════════════════════ */}
        {step === 'enter_farm_code' && (
          <div>
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black mb-3">
                <Building className="w-3.5 h-3.5" />
                <span>現場ポータル 初期接続</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {entryMode === 'choose' ? '接続方法を選択してください' : '農園コードを手入力'}
              </h1>
              <p className="text-xs text-slate-300 mt-2 max-w-xs mx-auto leading-relaxed font-medium">
                {entryMode === 'choose'
                  ? '一度接続すれば、次回からは自動で当農園が開きます。'
                  : '農園の管理者から案内された【農園コード】を入力してください。'}
              </p>
            </div>

            {/* 🌟 2択選択画面（chooseモード） */}
            {entryMode === 'choose' ? (
              <div className="space-y-4 max-w-sm mx-auto mb-6">
                {/* 選択肢①：📷 ポスターのQRコードを読み取る（おすすめ） */}
                <button
                  type="button"
                  onClick={() => setIsQrModalOpen(true)}
                  className="w-full p-5 rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white text-left shadow-xl shadow-emerald-950/40 border border-emerald-400/30 transition-all active:scale-98 cursor-pointer group relative overflow-hidden"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                      <Camera className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-black text-base text-white tracking-wide">
                          QRコードを読み取る
                        </span>
                        <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs">
                          おすすめ
                        </span>
                      </div>
                      <p className="text-xs text-emerald-100 font-medium leading-relaxed">
                        休憩所のA4ポスターにカメラをかざすだけ！文字入力不要で1秒接続できます。
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-white/15 flex items-center justify-between text-xs text-emerald-200 font-bold">
                    <span>カメラを起動してスキャン</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* 選択肢②：⌨️ 農園コードを手入力する */}
                <button
                  type="button"
                  onClick={() => setEntryMode('manual')}
                  className="w-full p-4 rounded-2xl bg-slate-800/90 hover:bg-slate-800 text-white text-left shadow-md border border-slate-700 hover:border-slate-600 transition-all active:scale-98 cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center shrink-0 text-slate-300 font-bold">
                      <span className="font-mono font-black text-sm">#</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-slate-200 group-hover:text-white">
                        農園コードを手入力する
                      </div>
                      <p className="text-[11px] text-slate-400">
                        案内されたコード（例: SAHARA-789）を直接入力
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
                  </div>
                </button>

                <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-[11px] text-slate-400 space-y-1.5 leading-relaxed text-center">
                  <p className="text-emerald-400 font-bold">💡 次回からの自動表示について</p>
                  <p>一度接続すれば、次回以降はアプリを開くだけで自動的に当農園が開きます（再入力は一切不要です）。</p>
                </div>
              </div>
            ) : (
              /* ⌨️ 手入力フォーム（manualモード） */
              <form onSubmit={handleVerifyFarmCode} className="space-y-4 max-w-sm mx-auto mb-6">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setEntryMode('choose');
                      setErrorMsg('');
                    }}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-bold inline-flex items-center gap-1 cursor-pointer py-1"
                  >
                    <span>← 接続方法の選択に戻る</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsQrModalOpen(true)}
                    className="text-xs text-slate-400 hover:text-emerald-300 font-bold inline-flex items-center gap-1 cursor-pointer py-1"
                  >
                    <Camera className="w-3.5 h-3.5 text-emerald-400" />
                    <span>QR読み取りにする</span>
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    農園コード
                  </label>
                  <input
                    type="text"
                    value={inputFarmId}
                    onChange={(e) => setInputFarmId(e.target.value)}
                    placeholder="例: SAHARA-789"
                    className="w-full px-4 py-3.5 rounded-2xl bg-slate-800/90 border-2 border-slate-700 text-white placeholder-slate-500 font-bold text-base focus:border-emerald-500 focus:outline-none transition-all text-center tracking-wider uppercase"
                    autoFocus
                  />
                </div>

                {errorMsg && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-300 font-bold whitespace-pre-line text-center leading-relaxed">
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !inputFarmId.trim()}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-lg shadow-emerald-900/30 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>照合中...</span>
                    </>
                  ) : (
                    <>
                      <span>農園に接続する</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-[11px] text-slate-400 space-y-1.5 leading-relaxed">
                  <p className="font-bold text-emerald-400 flex items-center gap-1">
                    <span>💡</span>
                    <span>ご利用のご案内</span>
                  </p>
                  <p>・一度接続すると、次回から自動でこの農園が開きます（再入力不要）。</p>
                  <p>・農園コードは、管理画面の【設定 ＞ 自社情報】で確認できます。</p>
                </div>
              </form>
            )}

            <div className="text-center pt-2">
              <a
                href="/login"
                className="text-xs text-slate-400 hover:text-emerald-400 transition-colors inline-flex items-center gap-1 font-bold"
              >
                <span>管理者の方はこちら（ログイン）</span>
                <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            【ステップ1】お名前選択画面（スタッフカード一覧）
            ══════════════════════════════════════════════════════ */}
        {step === 'select_worker' && (
          <div>
            <div className="text-center mb-5">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-xs font-black text-emerald-300">
                  <Building className="w-3.5 h-3.5" />
                  <span>{currentFarmName || '所属農園'}</span>
                </div>
                {!farmId && (
                  <button
                    type="button"
                    onClick={() => {
                      safeStorage.clearWorkerCache();
                      setWorkers([]);
                      setCurrentFarmName('');
                      setInputFarmId('');
                      setErrorMsg('');
                      setStep('enter_farm_code');
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
                  >
                    <RefreshCw className="w-3 h-3 text-emerald-400" />
                    <span>農園を変更</span>
                  </button>
                )}
              </div>
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

      {/* 📷 QRコードカメラ読み取りモーダル */}
      <QrScannerModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        onScan={handleQrScan}
      />
    </div>
  );
}
