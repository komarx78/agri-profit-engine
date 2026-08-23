"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Truck, Layout, Home,
  Clock, MapPin, Sprout, CheckCircle2, User, Sparkles, Play, Square, Package, 
  History, LogOut, Loader2, AlertCircle, Coffee, LogIn, LogOut as LogOutIcon, Sun, CloudRain, Plus, X,
  ImageIcon, FileText, Video, MessageSquare, Globe2, MessageCircle, Trash2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getB2BOrders, updateB2BOrderStatus } from '@/app/actions/b2b';
import { WorkerGate } from '@/components/WorkerGate';
import { HelpTooltip } from '@/components/HelpTooltip';
import { t, getTranslatedName, LANGUAGES, LanguageCode } from '@/lib/i18n';
import imageCompression from 'browser-image-compression';

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
  const [activeTab, setActiveTab] = useState<'attendance' | 'work' | 'sales'>('attendance');
  
  // --- 出荷・納品用ステート ---
  const [b2bOrders, setB2bOrders] = useState<any[]>([]);
  const [loadingB2bOrders, setLoadingB2bOrders] = useState(false);
  const [salesChannels, setSalesChannels] = useState<any[]>([]);
  const [selectedSalesChannel, setSelectedSalesChannel] = useState('');
  const [selectedSalesCrop, setSelectedSalesCrop] = useState('');
  const [salesQuantity, setSalesQuantity] = useState('');
  const [isSubmittingSales, setIsSubmittingSales] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [attendanceLog, setAttendanceLog] = useState<any>(null);
  const [workerProfile, setWorkerProfile] = useState<any>(null);
  const [gpsStatus, setGpsStatus] = useState<string>('');
  const [currentAddress, setCurrentAddress] = useState<string>('');

  // --- 掲示板用状態 ---
  const [boardPosts, setBoardPosts] = useState<any[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostCategory, setNewPostCategory] = useState('life');
  const [boardFilter, setBoardFilter] = useState<'all' | 'work' | 'life' | 'general'>('all');

  // フォーム状態
  const [selectedCrop, setSelectedCrop] = useState<string>('');
  const [selectedField, setSelectedField] = useState<string>('');
  const [workType, setWorkType] = useState<string>('');
  const [duration, setDuration] = useState<string>('');
  const [manualDate, setManualDate] = useState<string>(() => getJSTDate());
  const [memo, setMemo] = useState<string>('');
  const [selectedMaterial, setSelectedMaterial] = useState<string>('');
  const [materialQuantity, setMaterialQuantity] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // 残業申請用ステート
  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  const [overtimeDate, setOvertimeDate] = useState(''); // useEffectで初期化
  const [overtimeTime, setOvertimeTime] = useState('18:00');
  const [overtimeReason, setOvertimeReason] = useState('');
  const [overtimeStatus, setOvertimeStatus] = useState<string | null>(null);

  const [inputMode, setInputMode] = useState<'timer' | 'manual'>('timer');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const [activeWorkLog, setActiveWorkLog] = useState<any>(null);
  const [elapsedMinutes, setElapsedMinutes] = useState<number>(0);
  const [customWorkTypes, setCustomWorkTypes] = useState<string[]>([]);
  const [isAddingWorkType, setIsAddingWorkType] = useState(false);
  const [newWorkType, setNewWorkType] = useState('');
  
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const workTypes = ['収穫', '播種', '定植', '水やり', '肥料・農薬', '草刈り', '片付け・メンテ'];

  // 初回マウント確認
  useEffect(() => {
    setIsMounted(true);
    const savedUser = localStorage.getItem('agri_current_worker');
    const savedLang = localStorage.getItem('agri_lang') || localStorage.getItem('agri_lang_sales') as LanguageCode;
    if (savedLang && LANGUAGES.some(l => l.code === savedLang)) {
      setLanguage(savedLang as LanguageCode);
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
          // tasks取得
          let dId = null;
          if (wRes.data && wRes.data.department_id) dId = wRes.data.department_id;
          
          const { data: tData } = await supabase.from('work_logs')
            .select('id, task_title, departments(name), crops(name), fields(name)')
            .eq('user_id', wRes.data?.user_id || 'unknown')
            .eq('status', 'planned')
            .eq('work_date', getJSTDate());
          
          if (tData) {
            // 全体、自分の部署、自分個人のいずれかに宛てられたタスクをフィルタ
            const myTasks = tData.filter((t:any) => 
              (!t.department_id && !t.worker_id) || 
              (t.department_id === dId) || 
              (t.worker_id === currentUser.id)
            );
            setTasks(myTasks);
          }

        if (cRes.data) setCrops(cRes.data);
        if (fRes.data) setFields(fRes.data);
        if (mRes.data) setMaterials(mRes.data);
        if (wRes.data) setWorkerProfile(wRes.data);
        if (!cRes.error) setIsConnected(true);

        if (!cRes.error && currentUser) {
          // 今日の打刻状態を取得
          const { data: aLog } = await supabase
            .from('attendance_logs')
            .select('*')
            .eq('worker_id', currentUser.id)
            .eq('date', getJSTDate())
            .maybeSingle();
          if (aLog) setAttendanceLog(aLog);

          // 今日の残業申請を取得
          const { data: oReq } = await supabase
            .from('overtime_requests')
            .select('*')
            .eq('worker_id', currentUser.id)
            .eq('date', getJSTDate())
            .maybeSingle();
          if (oReq) setOvertimeStatus(oReq.status);

          setOvertimeDate(getJSTDate()); // 初期値は今日

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

          // カスタム作業内容取得（農園全体で共有）
          const { data: farmWorkers } = await supabase
            .from('workers')
            .select('id')
            .eq('user_id', wRes.data.user_id);
          const workerIds = farmWorkers?.map(w => w.id) || [currentUser.id];

          const { data: pastLogs } = await supabase
            .from('work_logs')
            .select('work_type')
            .in('worker_id', workerIds);
          if (pastLogs) {
            const allTypes = pastLogs.map(l => l.work_type).filter(Boolean);
            const uniqueTypes = Array.from(new Set(allTypes));
            const allDefaults = [
              ...workTypes, 
              '定植・播種', '播種・定植', '水やり・追肥', '草引き・防除', '収穫・調整', '片付け・その他'
            ];
            const cTypes = uniqueTypes.filter(t => !allDefaults.includes(t));
            setCustomWorkTypes(cTypes);
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

          // 掲示板データ取得
          const { data: bPosts } = await supabase
            .from('board_posts')
            .select(`*, workers(name)`)
            .order('created_at', { ascending: false })
            .limit(50);
          if (bPosts) setBoardPosts(bPosts);
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
    setSelectedField('');
    setWorkType('');
    setDuration('');
    setManualDate(getJSTDate());
    setMemo('');
    setSelectedMaterial('');
    setMaterialQuantity('');
    setErrorMsg('');
    setIsAddingWorkType(false);
    setNewWorkType('');
    clearPhoto();
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

  const handleLogout = () => {
    if(confirm(t('confirmLogout', language) || 'ログアウトしますか？')) {
      localStorage.removeItem('agri_current_worker');
      setCurrentUser(null);
    }
  };

  const handlePostBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newPostContent.trim()) return;
    setIsSubmitting(true);
    try {
      // 投稿時に全言語（英語、ベトナム語、インドネシア語、中国語、シンハラ語、クメール語）へ一括翻訳
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: newPostContent, 
          targetLanguages: ['en', 'vi', 'id', 'zh', 'si', 'km'] 
        })
      });
      const tData = await res.json();
      const translations = tData.translations || {};

      const { data, error } = await supabase.from('board_posts').insert([{
        worker_id: currentUser.id,
        category: newPostCategory,
        content: newPostContent,
        translations: translations
      }]).select('*, workers(name)').single();
      
      if (error) throw error;
      setBoardPosts([data, ...boardPosts]);
      setNewPostContent('');
    } catch (err) {
      console.error(err);
      alert('投稿または翻訳に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('この投稿を削除しますか？')) return;
    try {
      const { error } = await supabase.from('board_posts').delete().eq('id', postId);
      if (error) throw error;
      setBoardPosts(boardPosts.filter(p => p.id !== postId));
    } catch (err) {
      console.error(err);
      alert('削除に失敗しました');
    }
  };

  // --- 勤怠打刻アクション ---
  // --- 残業申請アクション ---
  const handleOvertimeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !overtimeTime) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('overtime_requests').insert([{
        worker_id: currentUser.id,
        date: overtimeDate,
        scheduled_end_time: overtimeTime.length === 5 ? overtimeTime + ':00' : overtimeTime,
        reason: overtimeReason,
        status: 'pending'
      }]);
      if (error) throw error;
      
      setOvertimeStatus('pending');
      setShowOvertimeModal(false);
      alert('残業申請を送信しました！');
    } catch(err) {
      console.error(err);
      alert('残業申請の送信に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

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

        let uploadedPhotoUrl = null;
        let uploadedVideoUrl = null;

        if (photoFile) {
            const options = { maxSizeMB: 1, maxWidthOrHeight: 1280, useWebWorker: true };
            const compressedFile = await imageCompression(photoFile, options);
            const fileName = `${workerProfile?.user_id || 'unknown'}/${currentUser.id}/${Date.now()}.jpg`;
            const { error: uploadError } = await supabase.storage.from('work_photos').upload(fileName, compressedFile);
            if (uploadError) throw uploadError;
            uploadedPhotoUrl = supabase.storage.from('work_photos').getPublicUrl(fileName).data.publicUrl;
        }

        if (videoFile) {
            const fileName = `${workerProfile?.user_id || 'unknown'}/${currentUser.id}/${Date.now()}_video.mp4`;
            const { error: uploadError } = await supabase.storage.from('work_videos').upload(fileName, videoFile);
            if (uploadError) throw uploadError;
            uploadedVideoUrl = fileName;
        }

        const { data, error } = await supabase.from('work_logs').insert([{
          user_id: workerProfile?.user_id || null,
          farm_id: workerProfile?.farm_id || null,
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
          photo_url: uploadedPhotoUrl,
          video_url: uploadedVideoUrl,
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

        let uploadedPhotoUrl = null;
        let uploadedVideoUrl = null;

        if (photoFile) {
            const options = { maxSizeMB: 1, maxWidthOrHeight: 1280, useWebWorker: true };
            const compressedFile = await imageCompression(photoFile, options);
            const fileName = `${workerProfile?.user_id || 'unknown'}/${currentUser.id}/${Date.now()}.jpg`;
            const { error: uploadError } = await supabase.storage.from('work_photos').upload(fileName, compressedFile);
            if (uploadError) throw uploadError;
            uploadedPhotoUrl = supabase.storage.from('work_photos').getPublicUrl(fileName).data.publicUrl;
        }

        if (videoFile) {
            const fileName = `${workerProfile?.user_id || 'unknown'}/${currentUser.id}/${Date.now()}_video.mp4`;
            const { error: uploadError } = await supabase.storage.from('work_videos').upload(fileName, videoFile);
            if (uploadError) throw uploadError;
            uploadedVideoUrl = fileName;
        }

        const { error } = await supabase.from('work_logs').insert([{
          user_id: workerProfile?.user_id || null,
          farm_id: workerProfile?.farm_id || null,
          worker_id: currentUser.id,
          crop_id: cropId || null,
          field_id: fieldId || null,
          work_type: workType,
          duration_minutes: parseInt(duration, 10),
          status: 'completed',
          work_date: manualDate,
          material_id: matId || null,
          material_quantity: materialQuantity ? parseFloat(materialQuantity) : null,
          memo: memo || null,
          photo_url: uploadedPhotoUrl,
          video_url: uploadedVideoUrl,
          approval_status: 'pending'
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
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 backdrop-blur-md bg-emerald-950/90 border-b border-emerald-800/50 px-2.5 py-2 shadow-lg flex flex-col gap-2">
        <div className="max-w-md w-full mx-auto flex items-center justify-between gap-1 flex-wrap sm:flex-nowrap">
          
          {/* 左側：アプリアイコン＆タイトル */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <div className="p-1.5 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-lg shadow-md text-emerald-950 flex-shrink-0">
              <Sprout className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-black tracking-tight text-white truncate leading-tight">
                {t('systemTitle', language)}
              </h1>
              <p className="text-[10px] font-bold text-emerald-400 truncate">
                {language === 'ja' ? `${getTranslatedName(currentUser, language)} さん` : getTranslatedName(currentUser, language)}
              </p>
            </div>
          </div>

          {/* 右側：コントロール (ポータル戻る・言語・ログアウト) */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => router.push('/portal')}
              className="flex items-center gap-1 px-2 py-1 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 hover:text-white border border-blue-500/40 rounded-lg text-[11px] font-bold transition-all shadow-sm whitespace-nowrap"
              title="ポータル画面へ戻る"
            >
              <Layout className="w-3 h-3 flex-shrink-0" />
              <span>ポータル</span>
            </button>
            <select
              value={language}
              onChange={(e) => {
                const newLang = e.target.value as LanguageCode;
                setLanguage(newLang);
                localStorage.setItem('agri_lang', newLang);
                localStorage.setItem('agri_lang_sales', newLang);
                const langKeys = Object.keys(localStorage).filter(k => k.startsWith('agri_lang'));
                langKeys.forEach(key => localStorage.setItem(key, newLang));
              }}
              className="bg-emerald-900 text-emerald-300 text-[11px] font-bold rounded-lg px-1.5 py-1 focus:outline-none border border-emerald-800"
            >
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.flag} {l.code.toUpperCase()}</option>
              ))}
            </select>
            <button onClick={handleLogout} className="p-1 bg-emerald-900/80 text-emerald-400 rounded-lg hover:bg-emerald-800 transition-colors" title="ログアウト">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* タブ切り替え (3等分均等グリッド配置) */}
        <div className="max-w-md w-full mx-auto grid grid-cols-3 gap-1 bg-emerald-900/60 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`py-1.5 px-0.5 text-[11px] sm:text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1 text-center truncate ${
              activeTab === 'attendance' ? 'bg-emerald-500 text-emerald-950 shadow-md scale-[1.02]' : 'text-emerald-300/70 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5 flex-shrink-0 hidden sm:inline" />
            <span className="truncate">{t('attendance', language)}</span>
          </button>
          <button
            onClick={() => setActiveTab('work')}
            className={`py-1.5 px-0.5 text-[11px] sm:text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1 text-center truncate ${
              activeTab === 'work' ? 'bg-emerald-500 text-emerald-950 shadow-md scale-[1.02]' : 'text-emerald-300/70 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5 flex-shrink-0 hidden sm:inline" />
            <span className="truncate">{t('workRecord', language)}</span>
          </button>
          <button
            onClick={() => setActiveTab('sales')}
            className={`py-1.5 px-0.5 text-[11px] sm:text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1 text-center truncate ${
              activeTab === 'sales' ? 'bg-emerald-500 text-emerald-950 shadow-md scale-[1.02]' : 'text-emerald-300/70 hover:text-white'
            }`}
          >
            <Truck className="w-3.5 h-3.5 flex-shrink-0 hidden sm:inline" />
            <span className="truncate">出荷・納品</span>
          </button>
        </div>
        
        {/* GPS住所の表示 */}
        <div className="max-w-md w-full mx-auto flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-400 truncate">
          <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
          <span className="truncate">{currentAddress}</span>
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

            {/* 残業申請エリア（事前申請も可能） */}
            <div className="mt-8 p-5 bg-slate-800/60 rounded-3xl border border-slate-700 flex flex-col items-center gap-4">
              <h3 className="text-white font-bold w-full flex items-center gap-2 mb-1">
                <Clock className="w-5 h-5 text-amber-400" /> 残業の申請（事前申請可）
              </h3>
              
              {overtimeStatus === 'pending' && (
                <div className="w-full py-3 bg-amber-500/20 text-amber-400 font-bold rounded-xl text-center border border-amber-500/30">
                  【本日】残業申請中（承認待ち）
                </div>
              )}
              {overtimeStatus === 'approved' && (
                <div className="w-full py-3 bg-emerald-500/20 text-emerald-400 font-bold rounded-xl text-center border border-emerald-500/30 flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5" /> 【本日】残業申請 承認済み
                </div>
              )}
              {overtimeStatus === 'rejected' && (
                <div className="w-full py-3 bg-rose-500/20 text-rose-400 font-bold rounded-xl text-center border border-rose-500/30 flex items-center justify-center gap-2">
                  <AlertCircle className="w-5 h-5" /> 【本日】残業申請 却下
                </div>
              )}
              
              <button
                onClick={() => {
                  setOvertimeDate(getJSTDate());
                  setShowOvertimeModal(true);
                }}
                className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
              >
                <Clock className="w-5 h-5" /> 残業を申請する
              </button>
            </div>

            {/* LINE連携・通知設定エリア */}
            <div className="mt-12 bg-slate-800/50 border border-slate-700 p-6 rounded-3xl shadow-inner">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-[#06C755]"><path d="M12 2C6.48 2 2 5.82 2 10.53c0 4.23 3.64 7.77 8.56 8.41.33.07.78.22.89.5.1.25.07.64-.03 1.05-.16.63-.53 2.05-.53 2.05s-.16.65.25.79c.41.14.94-.23 1.3-.5 3.09-2.27 6.09-4.8 7.98-7.39C21.6 13.56 22 12.09 22 10.53 22 5.82 17.52 2 12 2z"/></svg>
                {t('lineAlertTitle', language)}
              </h3>
              
              {!workerProfile?.line_user_id ? (
                <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700">
                  <p className="text-sm text-slate-300 font-bold mb-4">
                    {t('lineAlertDesc1', language)}<br/>
                    {t('lineAlertDesc2', language)}<br/>
                    {t('lineAlertDesc3', language)}
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
                      {t('lineConnectBtn', language)}
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
                      <div className="text-emerald-400 font-bold text-sm">{t('lineLinked', language)}</div>
                      <div className="text-xs text-slate-400 mt-1">{t('lineNotifyDesc', language)}</div>
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
            <div>
              {errorMsg && <div className="p-4 bg-rose-500/20 border border-rose-500/50 text-rose-400 rounded-xl text-sm font-bold flex items-start gap-3"><AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /><span>{errorMsg}</span></div>}
            </div>

            
            {tasks.length > 0 && (
              <div className="bg-emerald-950/80 p-4 rounded-2xl border border-emerald-500/30 mb-6 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                <h3 className="text-sm font-black text-emerald-400 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> 本日の指示・タスク ({tasks.length})
                </h3>
                <div className="space-y-2">
                  {tasks.map(t => (
                    <div key={t.id} className="bg-emerald-900/40 border border-emerald-800/50 p-3 rounded-xl flex flex-col gap-1.5">
                      <div className="text-white font-bold text-sm flex items-center gap-2">
                        {t.task_title}
                      </div>
                      <div className="flex gap-3 text-xs font-medium text-emerald-300/80">
                        {t.crops && <span>🌱 {t.crops.name}</span>}
                        {t.fields && <span>📍 {t.fields.name}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                      <button key={`default-${w}`} type="button" onClick={() => setWorkType(w)} className={`py-2 px-1 rounded-lg font-bold text-xs border transition-all ${workType === w ? 'bg-amber-500 text-amber-950 border-amber-300' : 'bg-emerald-950/60 text-slate-300 border-emerald-800'}`}>{t(w, language)}</button>
                    ))}
                    {customWorkTypes.map(cw => (
                      <div key={`custom-${cw}`} className="relative flex group">
                        <button 
                          type="button" 
                          onClick={() => setWorkType(cw)} 
                          className={`flex-1 py-2 px-1 rounded-lg font-bold text-xs border transition-all flex items-center justify-center gap-1 ${workType === cw ? 'bg-amber-500 text-amber-950 border-amber-300' : 'bg-emerald-900/20 text-emerald-200 border-emerald-700/50'}`}
                        >
                          <Sparkles className="w-3 h-3 text-amber-500/70" /> {cw}
                        </button>
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm(`独自作業「${cw}」をリストから削除しますか？\n※この作業で保存された過去の記録は『片付け・メンテ』に名称統合されます。`)) {
                              setIsSubmitting(true);
                              try {
                                const { data: farmWorkers } = await supabase.from('workers').select('id').eq('user_id', workerProfile?.user_id);
                                const workerIds = farmWorkers?.map(w => w.id) || [currentUser.id];
                                await supabase.from('work_logs').update({ work_type: '片付け・メンテ' }).in('worker_id', workerIds).eq('work_type', cw);
                                setCustomWorkTypes(customWorkTypes.filter(t => t !== cw));
                                if (workType === cw) setWorkType('');
                              } catch(err) {
                                alert('削除に失敗しました');
                              } finally {
                                setIsSubmitting(false);
                              }
                            }
                          }}
                          className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-emerald-500 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-colors opacity-70 hover:opacity-100"
                          title="この独自作業を削除"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <button
                      key="add-new-btn"
                      type="button"
                      onClick={() => setIsAddingWorkType(!isAddingWorkType)}
                      className="py-2 px-1 rounded-lg font-bold text-xs border border-dashed border-emerald-500/50 text-emerald-400 hover:bg-emerald-900/40 flex items-center justify-center gap-1 transition-all"
                    >
                      <Plus className="w-3 h-3" /> 新規追加
                    </button>
                  </div>

                  <div>
                    {isAddingWorkType && (
                      <div className="mt-3 flex gap-2 animate-in slide-in-from-top-2">
                        <input
                          type="text"
                          value={newWorkType}
                          onChange={(e) => setNewWorkType(e.target.value)}
                          placeholder="作業内容を入力"
                          className="flex-1 bg-emerald-950/60 border border-emerald-800/60 text-white rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = newWorkType.trim();
                            if (val) {
                              setWorkType(val);
                              if (!customWorkTypes.includes(val) && !workTypes.includes(val)) {
                                setCustomWorkTypes([...customWorkTypes, val]);
                              }
                              setNewWorkType('');
                              setIsAddingWorkType(false);
                            }
                          }}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg px-3 py-1.5 text-xs transition-colors"
                        >
                          決定
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <section className="bg-slate-900/40 p-4 rounded-2xl border border-slate-700/50 shadow-sm space-y-4">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-2">
                    <Package className="w-4 h-4" />{t('material', language)}
                  </h2>
                  <div className="space-y-3">
                    <select value={selectedMaterial} onChange={(e) => setSelectedMaterial(e.target.value)} className="w-full bg-slate-950 p-3 rounded-xl border border-slate-700 text-sm font-bold">
                        <option value="">--</option>
                        {materials.map(m => <option key={m.id} value={m.name}>{getTranslatedName(m, language)}</option>)}
                    </select>
                    {selectedMaterial && (
                      <div className="flex items-center gap-3">
                        <input type="number" value={materialQuantity} onChange={(e) => setMaterialQuantity(e.target.value)} placeholder="使用量" className="flex-1 px-3 py-3 bg-slate-950 border border-slate-700 text-white rounded-xl font-bold" />
                        <div className="text-sm font-bold text-slate-400">{materials.find(m => m.name === selectedMaterial)?.unit}</div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />{t('photo', language)}
                  </h2>
                  {!photoPreview ? (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-700 border-dashed rounded-xl cursor-pointer bg-slate-800/50 hover:bg-slate-800 transition-colors">
                      <span className="text-3xl mb-2">📷</span>
                      <span className="text-xs text-slate-400 font-bold">撮影 または ファイルを選択</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
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
                    <FileText className="w-4 h-4" />メモ
                  </h2>
                  <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="作業メモ..." className="w-full h-24 p-3 bg-slate-950 border border-slate-700 text-white rounded-xl text-sm" />
                </div>

                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-2">
                    <Video className="w-4 h-4" />動画
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
              </section>

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

        {/* ===================== 掲示板セクション ===================== */}
        {activeTab === 'board' && (
          <div className="space-y-6 pb-20">
            {/* 投稿フォーム */}
            <form onSubmit={handlePostBoard} className="bg-slate-800/60 p-4 rounded-3xl border border-slate-700 shadow-sm">
              <textarea
                value={newPostContent}
                onChange={e => setNewPostContent(e.target.value)}
                placeholder={t('boardPostPlaceholder', language)}
                className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 mb-3"
                rows={3}
                required
              />
              <div className="flex items-center justify-between gap-3">
                <select
                  value={newPostCategory}
                  onChange={e => setNewPostCategory(e.target.value)}
                  className="bg-slate-900 text-sm font-bold text-slate-300 border border-slate-700 rounded-xl px-3 py-2 focus:outline-none"
                >
                  <option value="life">🛒 {t('boardFilterLife', language)}</option>
                  <option value="work">🚜 {t('boardFilterWork', language)}</option>
                  <option value="general">💬 {t('boardFilterGeneral', language)}</option>
                </select>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : t('boardSend', language)}
                </button>
              </div>
            </form>

            {/* フィルターUI */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => setBoardFilter('all')}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all ${boardFilter === 'all' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
              >{t('boardFilterAll', language)}</button>
              <button
                onClick={() => setBoardFilter('work')}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all ${boardFilter === 'work' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
              >🚜 {t('boardFilterWork', language)}</button>
              <button
                onClick={() => setBoardFilter('life')}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all ${boardFilter === 'life' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
              >🛒 {t('boardFilterLife', language)}</button>
              <button
                onClick={() => setBoardFilter('general')}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all ${boardFilter === 'general' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
              >💬 {t('boardFilterGeneral', language)}</button>
            </div>

            {/* タイムライン */}
            <div className="space-y-4">
              {boardPosts.filter(p => boardFilter === 'all' || p.category === boardFilter).map(post => (
                <div key={post.id} className="bg-slate-800/40 p-5 rounded-3xl border border-slate-700/50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-black border border-blue-500/30">
                        {post.workers?.name?.charAt(0) || '?'}
                      </div>
                      <span className="text-white font-bold text-sm">{post.workers?.name}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-500 bg-slate-900 px-2 py-1 rounded-lg">
                      {new Date(post.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <div className="mb-4 text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">
                    {(language !== 'ja' && post.translations && post.translations[language]) 
                      ? post.translations[language] 
                      : post.content}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
                    <span className="text-xs font-bold text-slate-500 px-2 py-1 rounded-md bg-slate-900/50">
                      {post.category === 'life' ? `🛒 ${t('boardFilterLife', language)}` : post.category === 'work' ? `🚜 ${t('boardFilterWork', language)}` : `💬 ${t('boardFilterGeneral', language)}`}
                    </span>
                    {currentUser?.role === 'admin' && (
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        className="text-xs font-bold text-rose-500 hover:text-rose-400 p-1.5 hover:bg-rose-500/10 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> {t('boardDelete', language)}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {boardPosts.filter(p => boardFilter === 'all' || p.category === boardFilter).length === 0 && (
                <div className="text-center py-12 text-slate-500 font-bold flex flex-col items-center">
                  <MessageCircle className="w-10 h-10 mb-3 opacity-20" />
                  {t('boardNoPosts', language)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 残業申請モーダル */}
      {showOvertimeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-800 rounded-3xl p-6 w-full max-w-sm border border-slate-700 shadow-2xl">
            <h3 className="text-xl font-black text-white mb-4 flex items-center gap-2">
              <Clock className="w-6 h-6 text-amber-400" /> 残業の申請
            </h3>
            <form onSubmit={handleOvertimeSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-1">残業する日付</label>
                <input
                  type="date"
                  required
                  value={overtimeDate}
                  onChange={e => setOvertimeDate(e.target.value)}
                  className="w-full p-4 bg-slate-900 border border-slate-700 rounded-2xl text-white font-black text-xl text-center focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-1">残業終了(予定)時刻</label>
                <input
                  type="time"
                  required
                  value={overtimeTime}
                  onChange={e => setOvertimeTime(e.target.value)}
                  className="w-full p-4 bg-slate-900 border border-slate-700 rounded-2xl text-white font-black text-xl text-center focus:outline-none focus:border-amber-500"
                />
                <p className="text-xs text-emerald-400 mt-2 font-bold">
                  ※承認されると、LINEの退勤忘れアラートは「この予定時刻の30分後」に自動で延長されます。
                </p>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-1">残業の理由・作業内容</label>
                <textarea
                  required
                  value={overtimeReason}
                  onChange={e => setOvertimeReason(e.target.value)}
                  placeholder="例: トマトの収穫が長引いたため"
                  className="w-full p-4 bg-slate-900 border border-slate-700 rounded-2xl text-white focus:outline-none focus:border-amber-500"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOvertimeModal(false)}
                  className="py-3 bg-slate-700 text-slate-300 font-bold rounded-xl"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="py-3 bg-amber-500 hover:bg-amber-400 text-amber-950 font-black rounded-xl disabled:opacity-50"
                >
                  {isSubmitting ? '送信中...' : '申請する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
