"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Clock, MapPin, Sprout, CheckCircle2, User, Sparkles, Play, Square, Package, 
  History, LogOut, Loader2, AlertCircle, Coffee, LogIn, LogOut as LogOutIcon, Sun, CloudRain 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { WorkerGate } from '@/components/WorkerGate';
import { HelpTooltip } from '@/components/HelpTooltip';
import { t, getTranslatedName, LANGUAGES, LanguageCode } from '@/lib/i18n';

interface MasterItem {
  id: string;
  name: string;
  polygon_coordinates?: any;
}

// --- Helper Functions ---
async function fetchWeather(lat: number, lng: number) {
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`);
    const data = await res.json();
    if(data && data.current_weather) {
      const code = data.current_weather.weathercode;
      let text = '晴れ';
      if (code > 3 && code <= 49) text = '曇り';
      if (code >= 50 && code <= 69) text = '雨';
      if (code >= 70 && code <= 79) text = '雪';
      if (code >= 80) text = '荒天';
      return { temp: data.current_weather.temperature, text };
    }
  } catch(e) {
    console.error(e);
  }
  return { temp: null, text: null };
}

async function fetchAddress(lat: number, lng: number) {
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=ja`);
    const data = await res.json();
    return `${data.principalSubdivision || ''}${data.locality || ''}${data.city || ''}` || '住所不明';
  } catch(e) {
    return '住所取得失敗';
  }
}

function isPointInPolygon(point: {lat: number, lng: number}, vs: {lat: number, lng: number}[]) {
  if(!vs || vs.length === 0) return false;
  let x = point.lng, y = point.lat;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    let xi = vs[i].lng, yi = vs[i].lat;
    let xj = vs[j].lng, yj = vs[j].lat;
    let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

const getJSTDate = () => {
  const d = new Date();
  d.setHours(d.getHours() + 9);
  return d.toISOString().split('T')[0];
};

export default function WorkEntryPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<{id: string, name: string, role: string} | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [language, setLanguage] = useState<LanguageCode>('ja');

  const [crops, setCrops] = useState<MasterItem[]>([]);
  const [fields, setFields] = useState<MasterItem[]>([]);
  const [materials, setMaterials] = useState<MasterItem[]>([]);

  // --- タブと勤怠状態 ---
  const [activeTab, setActiveTab] = useState<'attendance' | 'work'>('attendance');
  const [attendanceLog, setAttendanceLog] = useState<any>(null);
  const [workerProfile, setWorkerProfile] = useState<any>(null);
  const [gpsStatus, setGpsStatus] = useState<string>('');
  const [currentAddress, setCurrentAddress] = useState<string>('');

  // フォーム状態
  const [selectedCrop, setSelectedCrop] = useState<string>('');
  const [selectedField, setSelectedField] = useState<string>('');
  const [workType, setWorkType] = useState<string>('');
  const [duration, setDuration] = useState<string>('');
  const [manualDate, setManualDate] = useState<string>(() => getJSTDate());
  const [memo, setMemo] = useState<string>('');
  const [selectedMaterial, setSelectedMaterial] = useState<string>('');
  const [materialQuantity, setMaterialQuantity] = useState<string>('');

  const [inputMode, setInputMode] = useState<'timer' | 'manual'>('timer');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const [activeWorkLog, setActiveWorkLog] = useState<any>(null);
  const [elapsedMinutes, setElapsedMinutes] = useState<number>(0);

  const workTypes = ['収穫', '播種', '定植', '水やり', '肥料・農薬', '草刈り', '片付け・メンテ'];

  // 初回マウント確認
  useEffect(() => {
    setIsMounted(true);
    const savedUser = localStorage.getItem('agri_current_worker');
    const savedLang = localStorage.getItem('agri_language') as LanguageCode;
    if (savedLang && LANGUAGES.some(l => l.code === savedLang)) {
      setLanguage(savedLang);
    }
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    async function fetchData() {
      try {
        const [cRes, fRes, mRes, wRes] = await Promise.all([
          supabase.from('crops').select('*'),
          supabase.from('fields').select('*'),
          supabase.from('materials').select('*'),
          supabase.from('workers').select('*').eq('id', currentUser.id).single()
        ]);
        if (cRes.data) setCrops(cRes.data);
        if (fRes.data) setFields(fRes.data);
        if (mRes.data) setMaterials(mRes.data);
        if (wRes.data) setWorkerProfile(wRes.data);
        if (!cRes.error) setIsConnected(true);

        if (!cRes.error && currentUser) {
          // 作業ログ取得
          const { data: activeLogs } = await supabase
            .from('work_logs')
            .select(`*, crops(name), fields(name), materials(name)`)
            .eq('worker_id', currentUser.id)
            .eq('status', 'running')
            .order('created_at', { ascending: false })
            .limit(1);
            
          if (activeLogs && activeLogs.length > 0) {
            const log = activeLogs[0];
            setActiveWorkLog(log);
            if (log.crops?.name) setSelectedCrop(log.crops.name);
            if (log.fields?.name) setSelectedField(log.fields.name);
            if (log.work_type) setWorkType(log.work_type);
            if (log.materials?.name) {
              setSelectedMaterial(log.materials.name);
              if (log.material_quantity) setMaterialQuantity(String(log.material_quantity));
            }
          }

          // 本日の勤怠ログ取得
          const today = getJSTDate();
          const { data: attLogs } = await supabase
            .from('attendance_logs')
            .select('*')
            .eq('worker_id', currentUser.id)
            .eq('date', today)
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (attLogs && attLogs.length > 0) {
            setAttendanceLog(attLogs[0]);
          }
        }
      } catch (err) {
        console.log(err);
      }
    }
    fetchData();

    // 初期マウント時にGPS住所を一度取得しておく
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const addr = await fetchAddress(pos.coords.latitude, pos.coords.longitude);
        setCurrentAddress(addr);
      }, () => {
        setCurrentAddress(t('locationOff', language));
      });
    }

  }, [currentUser?.id, language]); // languageを依存配列に追加

  // GPSによる自動圃場選択
  useEffect(() => {
    if (activeTab === 'work' && fields.length > 0 && !selectedField && navigator.geolocation) {
      setGpsStatus(t('gpsChecking', language));
      navigator.geolocation.getCurrentPosition((pos) => {
        const myPoint = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        let foundField = '';
        for (const f of fields) {
          if (f.polygon_coordinates && Array.isArray(f.polygon_coordinates)) {
            if (isPointInPolygon(myPoint, f.polygon_coordinates)) {
              foundField = f.name;
              break;
            }
          }
        }
        if (foundField) {
          setSelectedField(foundField);
          setGpsStatus(`${t('gpsAutoSelect', language)} ${foundField}`);
        } else {
          setGpsStatus(t('outOfField', language));
        }
      }, () => {
        setGpsStatus(t('gpsFailed', language));
      });
    }
  }, [activeTab, fields, language]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeWorkLog && activeWorkLog.start_time) {
      const calcElapsed = () => {
        const start = new Date(activeWorkLog.start_time).getTime();
        const now = new Date().getTime();
        setElapsedMinutes(Math.floor((now - start) / 1000 / 60));
      };
      calcElapsed();
      interval = setInterval(calcElapsed, 10000);
    }
    return () => clearInterval(interval);
  }, [activeWorkLog]);

  const resetForm = () => {
    setSelectedCrop('');
    setWorkType('');
    setDuration('');
    setManualDate(getJSTDate());
    setMemo('');
    setSelectedMaterial('');
    setMaterialQuantity('');
    setErrorMsg('');
  };

  const handleLogout = () => {
    if(confirm(t('confirmLogout', language) || 'ログアウトしますか？')) {
      localStorage.removeItem('agri_current_worker');
      setCurrentUser(null);
    }
  };

  // --- 勤怠打刻アクション ---
  const handleAttendance = async (action: 'clock_in' | 'break_start' | 'break_end' | 'clock_out') => {
    if (!currentUser) return;
    setIsSubmitting(true);
    try {
      let lat=0, lng=0;
      let weatherText = null, temp = null;

      if (action === 'clock_in' && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
          const w = await fetchWeather(lat, lng);
          weatherText = w.text;
          temp = w.temp;
        } catch(e) { console.log('GPS/Weather Error', e); }
      }

      const now = new Date().toISOString();
      const today = getJSTDate();

      if (action === 'clock_in') {
        const { data, error } = await supabase.from('attendance_logs').insert([{
          worker_id: currentUser.id,
          date: today,
          clock_in: now,
          weather: weatherText,
          temperature: temp
        }]).select();
        if (error) throw error;
        setAttendanceLog(data[0]);
      } else if (attendanceLog) {
        const updates: any = {};
        if (action === 'break_start') updates.break_start_time = now;
        if (action === 'break_end') {
          updates.break_end_time = now;
          if (attendanceLog.break_start_time) {
            const bStart = new Date(attendanceLog.break_start_time).getTime();
            const bEnd = new Date(now).getTime();
            const diffMins = Math.floor((bEnd - bStart) / 1000 / 60);
            updates.total_break_minutes = (attendanceLog.total_break_minutes || 0) + diffMins;
          }
        }
        if (action === 'clock_out') updates.clock_out = now;

        const { data, error } = await supabase.from('attendance_logs').update(updates).eq('id', attendanceLog.id).select();
        if (error) throw error;
        setAttendanceLog(data[0]);
      }
      setIsSubmitting(false);
    } catch(err) {
      console.error(err);
      alert('打刻エラーが発生しました');
      setIsSubmitting(false);
    }
  };

  // --- 作業記録アクション ---
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

        let weatherText = null, temp = null;
        if (navigator.geolocation) {
          try {
            const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
            const w = await fetchWeather(pos.coords.latitude, pos.coords.longitude);
            weatherText = w.text;
            temp = w.temp;
          } catch(e) {}
        }

        const { data, error } = await supabase.from('work_logs').insert([{
          worker_id: currentUser.id,
          crop_id: cropId || null,
          field_id: fieldId || null,
          work_type: workType,
          start_time: startTime,
          status: 'running',
          work_date: startTime.split('T')[0],
          duration_minutes: 0,
          material_id: matId || null,
          material_quantity: materialQuantity ? parseFloat(materialQuantity) : null,
          memo: memo || null,
          weather: weatherText,
          temperature: temp
        }]).select(`*, crops(name), fields(name), materials(name)`);
        
        if (error) throw error;
        if (data && data.length > 0) setActiveWorkLog(data[0]);
      }
      setIsSubmitting(false);
    } catch (err: any) {
      setErrorMsg(err.message || '通信エラー');
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
      }
      setActiveWorkLog(null);
      setIsSubmitting(false);
      setIsSuccess(true);
      setTimeout(() => { setIsSuccess(false); resetForm(); }, 2500);
    } catch (err: any) {
      setErrorMsg(err.message || '通信エラー');
      setIsSubmitting(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSubmitting(true);
    try {
      if (isConnected) {
        const cropId = crops.find(c => c.name === selectedCrop)?.id;
        const fieldId = fields.find(f => f.name === selectedField)?.id;
        const matId = materials.find(m => m.name === selectedMaterial)?.id;

        const { error } = await supabase.from('work_logs').insert([{
          worker_id: currentUser.id,
          crop_id: cropId || null,
          field_id: fieldId || null,
          work_type: workType,
          duration_minutes: parseInt(duration, 10),
          status: 'completed',
          work_date: manualDate,
          material_id: matId || null,
          material_quantity: materialQuantity ? parseFloat(materialQuantity) : null,
        }]);
        if (error) throw error;
      }
      setIsSubmitting(false);
      setIsSuccess(true);
      setTimeout(() => { setIsSuccess(false); resetForm(); }, 2500);
    } catch (err: any) {
      setErrorMsg(err.message || '通信エラー');
      setIsSubmitting(false);
    }
  };

  if (!isMounted) return <div className="min-h-screen bg-emerald-950 flex items-center justify-center text-emerald-500"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (!currentUser) return <WorkerGate onLogin={(user) => setCurrentUser(user)} />;

  return (
    <main className="min-h-screen bg-emerald-950 text-slate-100 font-sans pb-32">
      <header className="sticky top-0 z-10 backdrop-blur-md bg-emerald-950/80 border-b border-emerald-800/50 px-4 pt-4 pb-2 shadow-lg flex flex-col gap-4">
        <div className="max-w-md w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-xl shadow-md text-emerald-950">
              <Sprout className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white">{t('systemTitle', language)}</h1>
              <p className="text-xs font-medium text-emerald-400">{language === 'ja' ? `${getTranslatedName(currentUser, language)} さん` : getTranslatedName(currentUser, language)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={language}
              onChange={(e) => {
                const newLang = e.target.value as LanguageCode;
                setLanguage(newLang);
                localStorage.setItem('agri_lang', newLang);
              }}
              className="bg-emerald-900 text-emerald-300 text-xs font-bold rounded-lg px-2 py-1.5 focus:outline-none border border-emerald-800"
            >
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.flag} {l.code.toUpperCase()}</option>
              ))}
            </select>
            <button onClick={handleLogout} className="p-2 bg-emerald-900 text-emerald-400 rounded-full hover:bg-emerald-800 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* タブ切り替え */}
        <div className="max-w-md w-full mx-auto flex bg-emerald-900/50 p-1 rounded-xl mb-2">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'attendance' ? 'bg-emerald-500 text-emerald-950 shadow-sm' : 'text-emerald-300/70'
            }`}
          >
            <Clock className="w-4 h-4" />{t('attendance', language)}
          </button>
          <button
            onClick={() => setActiveTab('work')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'work' ? 'bg-emerald-500 text-emerald-950 shadow-sm' : 'text-emerald-300/70'
            }`}
          >
            <History className="w-4 h-4" />{t('workRecord', language)}
          </button>
        </div>
        
        {/* GPS住所の表示 */}
        <div className="max-w-md w-full mx-auto flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-400">
          <MapPin className="w-3.5 h-3.5" /> {currentAddress}
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 pt-6">
        
        {/* ===================== 勤怠タブ ===================== */}
        {activeTab === 'attendance' && (
          <div className="space-y-6">
            
            <div className="bg-emerald-900/40 p-6 rounded-3xl border border-emerald-800/40 shadow-sm text-center">
              <p className="text-sm text-emerald-400 font-bold mb-1">{getJSTDate()}</p>
              <h2 className="text-3xl font-black text-white mb-4">
                {!attendanceLog ? t('statusNotStarted', language) : attendanceLog.clock_out ? t('statusFinished', language) : attendanceLog.break_start_time && !attendanceLog.break_end_time ? t('statusBreak', language) : t('statusWorking', language)}
              </h2>
              {attendanceLog && attendanceLog.weather && (
                <div className="flex items-center justify-center gap-2 text-emerald-200 text-sm font-bold bg-emerald-950/50 py-2 rounded-xl">
                  {attendanceLog.weather === '晴れ' ? <Sun className="w-4 h-4 text-amber-400" /> : <CloudRain className="w-4 h-4 text-blue-400" />}
                  {t('weatherInfo', language)}: {attendanceLog.weather} ({attendanceLog.temperature}℃)
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => handleAttendance('clock_in')}
                disabled={!!attendanceLog || isSubmitting}
                className="py-8 bg-gradient-to-br from-blue-500 to-indigo-600 disabled:opacity-50 disabled:grayscale rounded-3xl shadow-lg flex flex-col items-center justify-center gap-2 text-white transition-all active:scale-95"
              >
                <LogIn className="w-8 h-8" />
                <span className="font-black">{t('clockIn', language)}</span>
              </button>

              <button 
                onClick={() => handleAttendance('clock_out')}
                disabled={!attendanceLog || !!attendanceLog.clock_out || isSubmitting}
                className="py-8 bg-gradient-to-br from-rose-500 to-red-600 disabled:opacity-50 disabled:grayscale rounded-3xl shadow-lg flex flex-col items-center justify-center gap-2 text-white transition-all active:scale-95"
              >
                <LogOutIcon className="w-8 h-8" />
                <span className="font-black">{t('clockOut', language)}</span>
              </button>

              <button 
                onClick={() => handleAttendance('break_start')}
                disabled={!attendanceLog || !!attendanceLog.clock_out || (attendanceLog.break_start_time && !attendanceLog.break_end_time) || isSubmitting}
                className="col-span-2 py-6 bg-emerald-800 disabled:opacity-50 disabled:grayscale border-2 border-emerald-600 rounded-3xl shadow-lg flex items-center justify-center gap-3 text-white transition-all active:scale-95"
              >
                <Coffee className="w-6 h-6" />
                <span className="font-bold text-lg">{t('breakStart', language)}</span>
              </button>

              {(attendanceLog?.break_start_time && !attendanceLog?.break_end_time) && (
                <button 
                  onClick={() => handleAttendance('break_end')}
                  disabled={isSubmitting}
                  className="col-span-2 py-6 bg-amber-500 rounded-3xl shadow-lg flex items-center justify-center gap-3 text-amber-950 transition-all active:scale-95 animate-pulse"
                >
                  <Coffee className="w-6 h-6" />
                  <span className="font-black text-lg">{t('breakEnd', language)}</span>
                </button>
              )}
            </div>

            {/* LINE連携・通知設定エリア */}
            <div className="mt-12 bg-slate-800/50 border border-slate-700 p-6 rounded-3xl shadow-inner">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-[#06C755]"><path d="M22.2 10.3c0-4.4-4.5-8-10.1-8s-10.1 3.6-10.1 8c0 4 3.7 7.4 8.6 7.9.4 0 .9.1 1 .5.1.3.1.5-.1 1-.1.4-.4 1.3-.4 1.3s-.1.4.1.5c.2.1.5 0 .5 0 2.9-1.8 5.7-4 7.6-6 1.8-1.7 2.9-3.4 2.9-5.2zm-12.7 3c-.2 0-.3-.1-.3-.3V8.8c0-.2.1-.3.3-.3h2.3c.2 0 .3.1.3.3v.8c0 .2-.1.3-.3.3h-1.4v.9h1.4c.2 0 .3.1.3.3v.8c0 .2-.1.3-.3.3h-1.4v.9h1.4c.2 0 .3.1.3.3v.8c0 .2-.1.3-.3zM7.3 13.3c-.2 0-.3-.1-.3-.3V8.8c0-.2.1-.3.3-.3h.8c.2 0 .3.1.3.3v4.2c0 .2-.1.3-.3.3h-.8zm-3 0c-.2 0-.3-.1-.3-.3V8.8c0-.2.1-.3.3-.3h.8c.2 0 .3.1.3.3v3h1.4c.2 0 .3.1.3.3v.8c0 .2-.1.3-.3.3h-2.8zm13.1-.3c0 .2-.1.3-.3.3h-.8c-.2 0-.3-.1-.3-.3v-3l-1.9 3c-.1.1-.2.2-.3.2h-.8c-.2 0-.3-.1-.3-.3V8.8c0-.2.1-.3.3-.3h.8c.2 0 .3.1.3.3v3l1.9-3c.1-.1.2-.2.3-.2h.8c.2 0 .3.1.3.3v4.2z"/></svg>
                打刻忘れ防止アラート（LINE通知）
              </h3>
              
              {!workerProfile?.line_user_id ? (
                <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700">
                  <p className="text-sm text-slate-300 font-bold mb-4">
                    退勤の押し忘れ時に、LINEへお知らせをお届けします。<br/>
                    下のボタンを押すと、自動的に連携用キーがコピーされてLINEが開きます。<br/>
                    トークの入力欄に「ペースト（貼り付け）」して送信してください。
                  </p>
                  <div className="flex flex-col items-center gap-3">
                    <button 
                      type="button"
                      onClick={() => {
                        if(workerProfile?.id) {
                          navigator.clipboard.writeText(workerProfile.id);
                        }
                        window.open("https://lin.ee/RD1vp8c", "_blank");
                      }}
                      className="w-full py-4 bg-[#06C755] hover:bg-[#05b34c] text-white font-black rounded-xl text-center flex items-center justify-center gap-2 mt-2"
                    >
                      システムとLINEを連携する
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-slate-900/80 p-4 rounded-2xl border border-emerald-900/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-emerald-400 font-bold text-sm">LINE連携済み</div>
                      <div className="text-xs text-slate-400 mt-1">退勤忘れ時に通知が届きます</div>
                    </div>
                  </div>
                  <button 
                    onClick={async () => {
                      const newVal = !workerProfile.is_line_notification_enabled;
                      await supabase.from('workers').update({ is_line_notification_enabled: newVal }).eq('id', workerProfile.id);
                      setWorkerProfile({...workerProfile, is_line_notification_enabled: newVal});
                    }}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${workerProfile.is_line_notification_enabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${workerProfile.is_line_notification_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ===================== 作業タブ ===================== */}
        {activeTab === 'work' && (
          <form onSubmit={inputMode === 'timer' ? handleStartWork : handleManualSubmit} className="space-y-6">
            {errorMsg && <div className="p-4 bg-rose-500/20 border border-rose-500/50 text-rose-400 rounded-xl text-sm font-bold flex items-start gap-3"><AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /><span>{errorMsg}</span></div>}

            <div className={`flex bg-emerald-950/80 p-1 rounded-xl mb-4 border border-emerald-800`}>
              <button type="button" onClick={() => setInputMode('timer')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg ${inputMode === 'timer' ? 'bg-emerald-600 text-white' : 'text-emerald-500'}`}>{t('realtimeRecord', language)}</button>
              <button type="button" onClick={() => setInputMode('manual')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg ${inputMode === 'manual' ? 'bg-emerald-600 text-white' : 'text-emerald-500'}`}>{t('manualRecord', language)}</button>
            </div>

            <div className={`space-y-6 transition-all duration-300 ${activeWorkLog ? 'opacity-60 pointer-events-none grayscale-[30%]' : ''}`}>
              
              <section className="bg-emerald-900/40 p-4 rounded-2xl border border-emerald-800/40 shadow-sm">
                <div className="flex items-center justify-between mb-2.5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />{t('field', language)}
                  </h2>
                  <span className="text-xs font-bold text-teal-300 bg-teal-950 px-2 py-1 rounded-lg">{gpsStatus}</span>
                </div>
                <select 
                  value={selectedField}
                  onChange={(e) => setSelectedField(e.target.value)}
                  className="w-full bg-emerald-950/80 text-white px-4 py-3 border border-teal-800/60 rounded-xl focus:outline-none focus:border-teal-400 font-bold"
                >
                  <option value="">{t('selectField', language)}</option>
                  {fields.map(f => <option key={f.id} value={f.name}>{getTranslatedName(f, language)}</option>)}
                </select>
              </section>

              <div className="grid grid-cols-2 gap-4">
                <section className="bg-emerald-900/40 p-4 rounded-2xl border border-emerald-800/40 shadow-sm">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2 mb-2.5"><Sprout className="w-4 h-4" />{t('crop', language)}</h2>
                  <div className="flex flex-col gap-2">
                    {crops.map(c => (
                      <button key={c.id} type="button" onClick={() => setSelectedCrop(c.name)} className={`py-2 px-1 rounded-lg font-bold text-xs border ${selectedCrop === c.name ? 'bg-emerald-500 text-emerald-950 border-emerald-300' : 'bg-emerald-950/60 text-slate-300 border-emerald-800'}`}>{getTranslatedName(c, language)}</button>
                    ))}
                  </div>
                </section>
                <section className="bg-emerald-900/40 p-4 rounded-2xl border border-emerald-800/40 shadow-sm">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2 mb-2.5"><Sparkles className="w-4 h-4" />{t('workType', language)}</h2>
                  <div className="flex flex-col gap-2">
                    {workTypes.map(w => (
                      <button key={w} type="button" onClick={() => setWorkType(w)} className={`py-2 px-1 rounded-lg font-bold text-xs border ${workType === w ? 'bg-amber-500 text-amber-950 border-amber-300' : 'bg-emerald-950/60 text-slate-300 border-emerald-800'}`}>{t(w, language)}</button>
                    ))}
                  </div>
                </section>
              </div>

              {inputMode === 'manual' && (
                <section className="bg-sky-900/30 p-4 rounded-2xl border border-sky-800/40">
                  <h2 className="text-xs font-bold text-sky-400 mb-2">{t('workingTime', language)}</h2>
                  <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full py-3 px-4 text-2xl font-black text-center bg-emerald-950/80 rounded-xl border border-sky-700/50 text-white" required />
                </section>
              )}
            </div>

            {activeWorkLog ? (
              <div className="mt-8 p-6 bg-emerald-900/40 border-2 border-emerald-500 rounded-3xl text-center shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                <div className="text-emerald-400 font-bold mb-2">{t('working', language)}</div>
                <div className="text-6xl font-black text-white mb-4">{elapsedMinutes}<span className="text-2xl text-emerald-400 ml-1">{t('minutes', language)}</span></div>
                <button type="button" onClick={handleStopWork} disabled={isSubmitting} className="w-full py-5 rounded-2xl font-black text-xl flex items-center justify-center gap-3 bg-rose-500 text-white">
                  {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Square className="w-6 h-6 fill-white" />{t('stopWork', language)}</>}
                </button>
              </div>
            ) : (
              <button type="submit" disabled={!selectedCrop || !selectedField || !workType || (inputMode === 'manual' && !duration) || isSubmitting} className="w-full py-5 rounded-2xl font-black text-xl bg-emerald-500 text-emerald-950 disabled:bg-slate-800 disabled:text-slate-500 mt-8 flex justify-center items-center gap-2">
                {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : t('startWork', language)}
              </button>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
