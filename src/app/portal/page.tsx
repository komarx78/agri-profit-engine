"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Calendar as CalendarIcon, Clock, CheckCircle2, Inbox, 
  MapPin, LogOut, LayoutDashboard, Briefcase, FileText,
  AlertCircle, Loader2, ArrowRight, ArrowLeft, PlayCircle, Globe2,
  MessageSquare, Plus, Trash2, X, Send, Sparkles, CornerDownRight, RefreshCw,
  Coffee, CalendarPlus, CheckCircle, UserCheck, BookOpen, Video, Play,
  PackageOpen, Sprout, Smartphone, Receipt, TrendingUp, Pointer, Banknote,
  FileSpreadsheet, Store, Calculator, Database, Camera, ExternalLink, HelpCircle,
  Truck, Scissors, Sliders, Check, Languages, Wand2, Edit3, Save, RotateCcw,
  FlaskConical, History, CheckSquare, BarChart3, Users, Settings
} from 'lucide-react';
import dynamic from 'next/dynamic';
import VideoPlayerWithSubtitles, { Narration } from '@/components/VideoPlayerWithSubtitles';
import CultivationsHub from '@/components/CultivationsHub';
import HrManagementHub from '@/components/HrManagementHub';
import { t, getTranslatedName, getTranslatedWorkType, LANGUAGES, LanguageCode } from '@/lib/i18n';
import { WorkerGate } from '@/components/WorkerGate';
import { getPortalTasks } from '@/app/actions/farm';
import { translateSingleText } from '@/app/actions/translate';
import Link from 'next/link';

const CalendarWrapper = dynamic(() => import('@/components/CalendarWrapper'), { 
  ssr: false, 
  loading: () => <div className="h-[600px] flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div> 
});

// 日本時間のYYYY-MM-DDを取得
const getJSTDate = () => {
  const d = new Date();
  d.setHours(d.getHours() + 9);
  return d.toISOString().split('T')[0];
};
const getJSTTime = () => {
  const d = new Date();
  d.setHours(d.getHours() + 9);
  return d.toISOString().split('T')[1].substring(0, 5);
};

export default function PortalPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <PortalContent />
    </Suspense>
  );
}

function PortalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as 'home' | 'cultivations' | 'hr' | 'sales') || 'home';

  // 4大統合タブステート: home(現場ホーム) | cultivations(栽培司令塔) | hr(勤怠・労務) | sales(経営・販売)
  const [activePortalTab, setActivePortalTab] = useState<'home' | 'cultivations' | 'hr' | 'sales'>(initialTab);

  useEffect(() => {
    const tabParam = searchParams.get('tab') as any;
    if (tabParam && ['home', 'cultivations', 'hr', 'sales'].includes(tabParam)) {
      setActivePortalTab(tabParam);
    }
  }, [searchParams]);

  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [workerProfile, setWorkerProfile] = useState<any>(null);
  const [role, setRole] = useState<'admin' | 'worker'>('worker');
  const [companyName, setCompanyName] = useState<string>('会社名');
  const [language, setLanguage] = useState<LanguageCode>('ja');
  
  // Data States
  const [tasks, setTasks] = useState<any[]>([]);
  const [dynamicTranslations, setDynamicTranslations] = useState<{ [rawText: string]: string }>({});
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [boardPosts, setBoardPosts] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any>(null);
  const [showWorkerGate, setShowWorkerGate] = useState(false);
  const [showBoardModal, setShowBoardModal] = useState(false);
  const [allBoardPosts, setAllBoardPosts] = useState<any[]>([]);
  const [boardFilter, setBoardFilter] = useState<'all' | 'work' | 'life' | 'general'>('all');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostCategory, setNewPostCategory] = useState<'work' | 'life' | 'general'>('life');
  const [isPostingBoard, setIsPostingBoard] = useState(false);
  const [replyInputs, setReplyInputs] = useState<{ [postId: string]: string }>({});
  const [isSubmittingReply, setIsSubmittingReply] = useState<{ [postId: string]: boolean }>({});
  const [openReplyThread, setOpenReplyThread] = useState<{ [postId: string]: boolean }>({});

  // マニュアル・動画モーダル用ステート
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualTab, setManualTab] = useState<'video' | 'guide'>('video');
  const [videoManuals, setVideoManuals] = useState<any[]>([]);
  const [isLoadingManuals, setIsLoadingManuals] = useState(false);
  const [playingVideoUrl, setPlayingVideoUrl] = useState<string | null>(null);
  const [activeGuideStep, setActiveGuideStep] = useState<number>(1);
  const [showAddVideoModal, setShowAddVideoModal] = useState(false);
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [newVideoDescription, setNewVideoDescription] = useState('');
  const [newVideoFile, setNewVideoFile] = useState<File | null>(null);
  const [isSubmittingVideo, setIsSubmittingVideo] = useState(false);
  const [videoModalMessage, setVideoModalMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  // 🎬 動画編集スタジオ（テロップ・トリミング）用ステート
  const [editingManual, setEditingManual] = useState<any | null>(null);
  const [editingVideoUrl, setEditingVideoUrl] = useState<string | null>(null);
  const [editingNarrations, setEditingNarrations] = useState<Narration[]>([]);
  const [isLoadingNarrations, setIsLoadingNarrations] = useState(false);
  const [studioPlaybackTime, setStudioPlaybackTime] = useState<number>(0);
  const [trimStartInput, setTrimStartInput] = useState<string>('0');
  const [trimEndInput, setTrimEndInput] = useState<string>('');
  
  // テロップ作成フォーム
  const [telopStartSec, setTelopStartSec] = useState<string>('0');
  const [telopEndSec, setTelopEndSec] = useState<string>('3');
  const [telopJa, setTelopJa] = useState<string>('');
  const [telopTranslations, setTelopTranslations] = useState<Record<string, string>>({});
  const [isTranslatingTelop, setIsTranslatingTelop] = useState(false);
  const [isSavingStudio, setIsSavingStudio] = useState(false);
  const [studioToast, setStudioToast] = useState<string | null>(null);

  // 再生中動画用のテロップ一覧・トリミング
  const [playingNarrations, setPlayingNarrations] = useState<Narration[]>([]);
  const [playingTrimStart, setPlayingTrimStart] = useState<number>(0);
  const [playingTrimEnd, setPlayingTrimEnd] = useState<number | undefined>(undefined);

  // 自由入力タスクタイトルのリアルタイム自動翻訳
  useEffect(() => {
    if (language === 'ja' || tasks.length === 0) return;

    const translateTitles = async () => {
      const untranslated: string[] = [];
      tasks.forEach(t => {
        const title = t.task_title || t.work_type;
        if (title && !dynamicTranslations[title]) {
          untranslated.push(title);
        }
      });

      if (untranslated.length === 0) return;

      const uniqueList = Array.from(new Set(untranslated));
      const newMap = { ...dynamicTranslations };

      await Promise.all(
        uniqueList.map(async (rawText) => {
          try {
            const trans = await translateSingleText(rawText, language);
            if (trans) newMap[rawText] = trans;
          } catch (e) {
            console.error('Translation error:', e);
          }
        })
      );

      setDynamicTranslations(newMap);
    };

    translateTitles();
  }, [language, tasks]);

  // 有給・休暇関連ステート
  const [leaveBalance, setLeaveBalance] = useState<{ carryover: number; balance: number; total: number } | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [allWorkers, setAllWorkers] = useState<any[]>([]);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);
  const [leaveToast, setLeaveToast] = useState<string | null>(null);
  const [leaveForm, setLeaveForm] = useState({
    worker_id: '',
    type: '有給休暇',
    start_date: getJSTDate(),
    end_date: getJSTDate(),
    reason: ''
  });

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        let ownerId = '';
        let currentRole = 'worker';
        let profile = null;

        // URLクエリパラメータ（?farm=xxx または ?tenant=xxx）の最優先取得
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          const farmParam = urlParams.get('farm') || urlParams.get('tenant');
          if (farmParam && farmParam !== 'null' && farmParam !== 'undefined') {
            localStorage.setItem('agri_owner_id', farmParam);
            ownerId = farmParam;
          }
        }

        // 1. 現場作業者情報（agri_current_worker）を最優先で確認
        const savedUser = typeof window !== 'undefined' ? localStorage.getItem('agri_current_worker') : null;

        if (savedUser) {
          try {
            const workerData = JSON.parse(savedUser);
            const isWorkerAdmin = workerData.role === 'admin';
            currentRole = isWorkerAdmin ? 'admin' : 'worker';
            setRole(isWorkerAdmin ? 'admin' : 'worker');
            profile = workerData;
            setWorkerProfile(workerData);
            setCurrentUser(workerData);

            // 所属農園ID（user_id）の確定
            ownerId = workerData.user_id || (session ? session.user.id : '') || localStorage.getItem('agri_owner_id') || '';

            // 旧キャッシュ対策：もしownerIdが空なら、自身(workerData.id)からDBを参照して農園IDを修復
            if (!ownerId && workerData.id) {
              const { data: wRecord } = await supabase.from('workers').select('user_id').eq('id', workerData.id).maybeSingle();
              if (wRecord && wRecord.user_id) {
                ownerId = wRecord.user_id;
              }
            }

            if (ownerId) {
              localStorage.setItem('agri_owner_id', ownerId);
            }

            // 会社名の取得
            if (ownerId) {
              const { data: companyData } = await supabase.from('company_settings').select('company_name').eq('user_id', ownerId).maybeSingle();
              if (companyData && companyData.company_name) {
                setCompanyName(companyData.company_name);
                if (typeof window !== 'undefined') {
                  localStorage.setItem(`agri_company_${ownerId}`, companyData.company_name);
                  localStorage.removeItem('agri_cached_company_name');
                }
              } else {
                setCompanyName('');
              }
            }
          } catch (e) {
            console.error('Failed to parse saved worker:', e);
          }
        } else if (session) {
          // 2. 現場作業者が未選択で、Supabase Auth セッションがある場合は管理者として起動
          ownerId = session.user.id;
          localStorage.setItem('agri_owner_id', ownerId);

          const { data: companyData } = await supabase.from('company_settings').select('company_name').eq('user_id', ownerId).maybeSingle();
          if (companyData && companyData.company_name) {
            setCompanyName(companyData.company_name);
            if (typeof window !== 'undefined') {
              localStorage.setItem(`agri_company_${ownerId}`, companyData.company_name);
              localStorage.removeItem('agri_cached_company_name');
            }
          } else {
            setCompanyName('');
          }

          currentRole = 'admin';
          setRole('admin');
          setCurrentUser({ name: '管理者', name_en: 'Admin', role: 'admin' });
        } else {
          // 3. 作業者もセッションもない場合は WorkerGate（選択画面）を表示
          setShowWorkerGate(true);
          setIsLoading(false);
          return;
        }

        await fetchPortalData(ownerId, currentRole, profile);

        // URLクエリに manual=1 または openManual=true があればマニュアルモーダルを開く
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          if (params.get('manual') || params.get('openManual')) {
            handleOpenManualModal('video');
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [router]);

  const fetchPortalData = async (userId: string, currentRole: string, profile: any) => {
    const today = getJSTDate();

    // 1. タスク (カレンダー用: サーバーアクション経由でRLSを回避し確実に取得)
    const targetUserId = userId;
    const taskRes = await getPortalTasks(targetUserId);
    if (taskRes.success && taskRes.data && taskRes.data.length > 0) {
      setTasks(taskRes.data);
    } else {
      // クライアント側でもフォールバック試行
      const { data: taskData } = await supabase.from('work_logs')
        .select('*, crops(*), fields(*), workers(*)')
        .eq('user_id', targetUserId)
        .eq('status', 'planned')
        .order('work_date', { ascending: true });
      if (taskData) setTasks(taskData);
    }

    // 2. 承認待ち (現場スタッフが完了報告した作業: status='completed' かつ approval_status='pending')
    if (currentRole === 'admin') {
      const { data: appData } = await supabase.from('work_logs')
        .select('id, task_title, work_date, workers(name)')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .eq('approval_status', 'pending');
      if (appData) setPendingApprovals(appData);
    }

    // 3. 掲示板最新3件 (自社テナントのみ)
    let boardQuery = supabase.from('board_posts').select('*');
    if (targetUserId) {
      boardQuery = boardQuery.eq('user_id', targetUserId);
    }
    const { data: boardData } = await boardQuery
      .order('created_at', { ascending: false })
      .limit(3);
    if (boardData) setBoardPosts(boardData);

    // 4. 今日の打刻状態
    const workerId = profile ? profile.id : userId;
    if (workerId) {
      const { data: aLog } = await supabase.from('attendance_logs')
        .select('*')
        .eq('worker_id', workerId)
        .eq('date', today)
        .maybeSingle();
      if (aLog) setAttendance(aLog);
    }

    // 5. 有給休暇・残高と申請履歴の取得 (自農園のワーカーのみ厳格に取得)
    try {
      const { data: wList } = await supabase
        .from('workers')
        .select('id, name, paid_leave_carryover, paid_leave_balance')
        .eq('user_id', targetUserId)
        .order('name');

      if (wList) {
        setAllWorkers(wList);
        
        // ログイン中のワーカーを探す
        let targetWorker = null;
        if (profile && profile.id) {
          targetWorker = wList.find(w => w.id === profile.id);
        } else if (wList.length > 0) {
          targetWorker = wList[0]; // 管理者でワーカー紐付けがない場合は自農園の最初のスタッフを参考表示
        }

        if (targetWorker) {
          const c = Number(targetWorker.paid_leave_carryover) || 0;
          const b = Number(targetWorker.paid_leave_balance) || 0;
          setLeaveBalance({ carryover: c, balance: b, total: c + b });
          setLeaveForm(prev => ({ ...prev, worker_id: targetWorker.id }));
        }
      }

      // 直近の休暇申請履歴
      let reqQuery = supabase
        .from('leave_requests')
        .select('*, workers!inner(name, user_id)')
        .eq('workers.user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (profile && profile.id) {
        reqQuery = reqQuery.eq('worker_id', profile.id);
      }

      const { data: reqData } = await reqQuery;
      if (reqData) setLeaveRequests(reqData);
    } catch (err) {
      console.error('Error loading leave data:', err);
    }
  };

  // 有給休暇の申請送信
  const handleSubmitLeaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveForm.worker_id) {
      alert('従業員を選択してください');
      return;
    }
    setIsSubmittingLeave(true);
    try {
      const isAutoApprove = role === 'admin';
      const { error } = await supabase.from('leave_requests').insert([{
        worker_id: leaveForm.worker_id,
        type: leaveForm.type,
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date,
        reason: leaveForm.reason || '私用のため',
        status: isAutoApprove ? '承認' : '申請中'
      }]);

      if (error) throw error;

      setShowLeaveModal(false);
      setLeaveToast(`有給休暇の申請（${leaveForm.start_date}）を送信しました！`);
      setTimeout(() => setLeaveToast(null), 4000);

      // データ再取得
      const { data: { session } } = await supabase.auth.getSession();
      const ownerId = session ? session.user.id : (localStorage.getItem('agri_owner_id') || '');
      await fetchPortalData(ownerId, role, workerProfile);
    } catch (err: any) {
      console.error(err);
      alert('有給申請に失敗しました: ' + err.message);
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  // マニュアル・動画モーダル制御
  const loadVideoManuals = async () => {
    setIsLoadingManuals(true);
    try {
      const { data, error } = await supabase
        .from('video_manuals')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setVideoManuals(data);
      }
    } catch (err) {
      console.error('Error loading video manuals:', err);
    } finally {
      setIsLoadingManuals(false);
    }
  };

  const handleOpenManualModal = async (initialTab: 'video' | 'guide' = 'video') => {
    setManualTab(initialTab);
    setShowManualModal(true);
    await loadVideoManuals();
  };

  const resolveVideoUrl = async (videoPath: string): Promise<string> => {
    if (!videoPath) return '';
    if (videoPath.startsWith('http://') || videoPath.startsWith('https://')) {
      return videoPath;
    }
    try {
      // 1. work_videos バケットの署名付きURL取得を試みる (24時間有効)
      const { data: signData1, error: signErr1 } = await supabase.storage
        .from('work_videos')
        .createSignedUrl(videoPath, 86400);
      
      if (!signErr1 && signData1?.signedUrl) {
        return signData1.signedUrl;
      }

      // 2. videos バケットの署名付きURL取得を試みる
      const { data: signData2, error: signErr2 } = await supabase.storage
        .from('videos')
        .createSignedUrl(videoPath, 86400);

      if (!signErr2 && signData2?.signedUrl) {
        return signData2.signedUrl;
      }

      // 3. パブリックURLを試みる
      const { data: pubData1 } = supabase.storage.from('work_videos').getPublicUrl(videoPath);
      if (pubData1?.publicUrl) return pubData1.publicUrl;

      const { data: pubData2 } = supabase.storage.from('videos').getPublicUrl(videoPath);
      return pubData2?.publicUrl || videoPath;
    } catch (e) {
      console.error('Error resolving video url:', e);
      return videoPath;
    }
  };

  // 動画再生（多言語字幕・トリミング付き）
  const handlePlayManualVideo = async (manual: any) => {
    if (!manual) return;
    const url = await resolveVideoUrl(manual.video_url);
    setPlayingVideoUrl(url);
    setPlayingTrimStart(Number(manual.trim_start) || 0);
    setPlayingTrimEnd(manual.trim_end ? Number(manual.trim_end) : undefined);

    // テロップ一覧を取得
    try {
      const { data, error } = await supabase
        .from('video_narrations')
        .select('*')
        .eq('video_id', manual.id)
        .order('start_time', { ascending: true });
      
      if (!error && data) {
        setPlayingNarrations(data);
      } else {
        setPlayingNarrations([]);
      }
    } catch (e) {
      console.error('Error loading narrations for player:', e);
      setPlayingNarrations([]);
    }

    // プレイヤー位置へスムーズスクロール
    setTimeout(() => {
      const playerEl = document.getElementById('manual-video-player-container');
      if (playerEl) {
        playerEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  // 🎬 動画編集スタジオ（エディタ）を開く
  const handleOpenStudio = async (manual: any) => {
    setEditingManual(manual);
    setTrimStartInput(manual.trim_start ? String(manual.trim_start) : '0');
    setTrimEndInput(manual.trim_end ? String(manual.trim_end) : '');
    setTelopStartSec('0');
    setTelopEndSec('3');
    setTelopJa('');
    setTelopTranslations({});
    setIsLoadingNarrations(true);

    const url = await resolveVideoUrl(manual.video_url);
    setEditingVideoUrl(url);

    try {
      const { data, error } = await supabase
        .from('video_narrations')
        .select('*')
        .eq('video_id', manual.id)
        .order('start_time', { ascending: true });
      
      if (!error && data) {
        setEditingNarrations(data);
      } else {
        setEditingNarrations([]);
      }
    } catch (e) {
      console.error('Error loading narrations for studio:', e);
      setEditingNarrations([]);
    } finally {
      setIsLoadingNarrations(false);
    }
  };

  // テロップのAI多言語一括自動翻訳
  const handleTranslateTelop = async () => {
    if (!telopJa.trim()) {
      alert('日本語のテロップを入力してください。');
      return;
    }

    setIsTranslatingTelop(true);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: telopJa,
          targetLanguages: ['en', 'vi', 'id', 'zh', 'si', 'km']
        })
      });
      const data = await res.json();
      if (data && data.translations) {
        setTelopTranslations(data.translations);
      } else {
        // フォールバック
        setTelopTranslations({
          en: telopJa,
          vi: telopJa,
          id: telopJa,
          zh: telopJa
        });
      }
    } catch (e) {
      console.error('Telop translation error:', e);
      alert('AI翻訳中にエラーが発生しました。');
    } finally {
      setIsTranslatingTelop(false);
    }
  };

  // タイムラインにテロップを追加
  const handleAddNarrationToStudio = () => {
    const s = parseFloat(telopStartSec);
    const e = parseFloat(telopEndSec);

    if (isNaN(s) || isNaN(e) || s < 0 || e <= s) {
      alert('開始秒数と終了秒数を正しく設定してください（終了秒数は開始秒数より大きくする必要があります）。');
      return;
    }
    if (!telopJa.trim()) {
      alert('テロップ内容を入力してください。');
      return;
    }

    const newNarration: Narration = {
      start_time: s,
      end_time: e,
      script_ja: telopJa.trim(),
      script_en: telopTranslations['en'] || '',
      script_vi: telopTranslations['vi'] || '',
      script_id: telopTranslations['id'] || '',
      script_zh: telopTranslations['zh'] || '',
      script_si: telopTranslations['si'] || '',
      script_km: telopTranslations['km'] || '',
      translations: { ...telopTranslations, ja: telopJa.trim() }
    };

    // タイムラインに追加して開始時間順にソート
    setEditingNarrations(prev => [...prev, newNarration].sort((a, b) => a.start_time - b.start_time));

    // フォームをリセットし、次の開始秒を今回の終了秒にセット
    setTelopStartSec(e.toFixed(1));
    setTelopEndSec((e + 3).toFixed(1));
    setTelopJa('');
    setTelopTranslations({});
  };

  // タイムラインからテロップを削除
  const handleDeleteNarrationFromStudio = (index: number) => {
    setEditingNarrations(prev => prev.filter((_, idx) => idx !== index));
  };

  // スタジオでの編集内容（トリミング＋テロップ）を一括保存
  const handleSaveStudio = async () => {
    if (!editingManual) return;
    setIsSavingStudio(true);

    try {
      const trimStart = parseFloat(trimStartInput) || 0;
      const trimEnd = trimEndInput ? parseFloat(trimEndInput) : null;

      // 1. video_manuals のトリミング秒数を更新
      const { error: manualError } = await supabase
        .from('video_manuals')
        .update({
          trim_start: trimStart,
          trim_end: trimEnd
        })
        .eq('id', editingManual.id);

      if (manualError) throw manualError;

      // 2. 既存の video_narrations を一旦削除
      await supabase.from('video_narrations').delete().eq('video_id', editingManual.id);

      // 3. 新しいテロップ一覧を挿入
      if (editingNarrations.length > 0) {
        const insertPayloads = editingNarrations.map(n => ({
          video_id: editingManual.id,
          start_time: n.start_time,
          end_time: n.end_time,
          script_ja: n.script_ja,
          script_en: n.script_en || n.translations?.['en'] || null,
          script_vi: n.script_vi || n.translations?.['vi'] || null,
          script_id: n.script_id || n.translations?.['id'] || null,
          script_zh: n.script_zh || n.translations?.['zh'] || null,
          script_si: n.script_si || n.translations?.['si'] || null,
          script_km: n.script_km || n.translations?.['km'] || null,
          translations: n.translations || {}
        }));

        const { error: narrError } = await supabase
          .from('video_narrations')
          .insert(insertPayloads);

        if (narrError) throw narrError;
      }

      setStudioToast('動画のトリミングとテロップを保存しました！');
      setTimeout(() => setStudioToast(null), 3500);

      // スタジオを閉じて一覧を再取得
      setEditingManual(null);
      await loadVideoManuals();

    } catch (err: any) {
      console.error(err);
      alert('保存に失敗しました: ' + err.message);
    } finally {
      setIsSavingStudio(false);
    }
  };

  const handleAddVideoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVideoTitle.trim() || !newVideoFile) {
      setVideoModalMessage({ text: 'タイトルと動画ファイルを選択してください。', type: 'error' });
      return;
    }

    setIsSubmittingVideo(true);
    setVideoModalMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const ownerId = session ? session.user.id : (localStorage.getItem('agri_owner_id') || '');
      
      const fileExt = newVideoFile.name.split('.').pop();
      const fileName = `${ownerId || 'manuals'}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // 1. Storageにアップロード (明示的なcontentType指定)
      let uploadError = null;
      const uploadOptions = { 
        cacheControl: '31536000', 
        upsert: false,
        contentType: newVideoFile.type || 'video/mp4'
      };

      const { error: err1 } = await supabase.storage
        .from('work_videos')
        .upload(fileName, newVideoFile, uploadOptions);

      if (err1) {
        const { error: err2 } = await supabase.storage
          .from('videos')
          .upload(fileName, newVideoFile, uploadOptions);
        if (err2) {
          uploadError = err2;
        }
      }

      if (uploadError) throw new Error('動画のアップロードに失敗しました: ' + uploadError.message);

      // 2. video_manuals にレコード登録
      const payload: any = {
        title: newVideoTitle,
        description: newVideoDescription,
        video_url: fileName
      };
      if (ownerId) payload.user_id = ownerId;

      const { error: dbError } = await supabase.from('video_manuals').insert([payload]);
      if (dbError) throw dbError;

      setVideoModalMessage({ text: '動画マニュアルを登録しました！', type: 'success' });
      
      // 一覧再取得
      await loadVideoManuals();

      setTimeout(() => {
        setShowAddVideoModal(false);
        setNewVideoTitle('');
        setNewVideoDescription('');
        setNewVideoFile(null);
        setVideoModalMessage(null);
      }, 1200);

    } catch (err: any) {
      console.error(err);
      setVideoModalMessage({ text: err.message || '登録に失敗しました', type: 'error' });
    } finally {
      setIsSubmittingVideo(false);
    }
  };

  const handleDeleteVideoManual = async (manualId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('本当にこの動画マニュアルを削除しますか？')) return;
    try {
      const { error } = await supabase.from('video_manuals').delete().eq('id', manualId);
      if (error) throw error;
      setVideoManuals(prev => prev.filter(m => m.id !== manualId));
      if (playingVideoUrl) setPlayingVideoUrl(null);
    } catch (err: any) {
      console.error(err);
      alert('動画の削除に失敗しました: ' + err.message);
    }
  };

  // 掲示板モーダル制御
  const loadFullBoardPosts = async () => {
    try {
      const { data } = await supabase.from('board_posts')
        .select('*, workers(name), board_comments(*, workers(name))')
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) setAllBoardPosts(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenBoardModal = async () => {
    setShowBoardModal(true);
    await loadFullBoardPosts();
  };

  const handlePostBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim()) return;
    setIsPostingBoard(true);
    try {
      let translations = {};
      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            text: newPostContent, 
            targetLanguages: ['en', 'vi', 'id', 'zh', 'si', 'km'] 
          })
        });
        const tData = await res.json();
        translations = tData.translations || {};
      } catch (tErr) {
        console.error('Translation error:', tErr);
      }

      const postPayload: any = {
        category: newPostCategory,
        content: newPostContent,
        translations: translations,
        worker_id: (workerProfile && workerProfile.id) ? workerProfile.id : null
      };

      const { data, error } = await supabase.from('board_posts').insert([postPayload]).select('*, workers(name)').single();
      if (error) throw error;
      
      if (data) {
        data.board_comments = [];
        setBoardPosts(prev => [data, ...prev.slice(0, 2)]);
        setAllBoardPosts(prev => [data, ...prev]);
      }
      setNewPostContent('');
    } catch (err) {
      console.error(err);
      alert('投稿に失敗しました');
    } finally {
      setIsPostingBoard(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('この投稿を削除しますか？')) return;
    try {
      const { error } = await supabase.from('board_posts').delete().eq('id', postId);
      if (error) throw error;
      setBoardPosts(prev => prev.filter(p => p.id !== postId));
      setAllBoardPosts(prev => prev.filter(p => p.id !== postId));
    } catch (err) {
      console.error(err);
      alert('削除に失敗しました');
    }
  };

  // 返信（コメント）の投稿
  const handlePostComment = async (postId: string, e: React.FormEvent) => {
    e.preventDefault();
    const commentText = replyInputs[postId];
    if (!commentText || !commentText.trim()) return;

    setIsSubmittingReply(prev => ({ ...prev, [postId]: true }));
    try {
      let translations = {};
      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            text: commentText, 
            targetLanguages: ['en', 'vi', 'id', 'zh', 'si', 'km'] 
          })
        });
        const tData = await res.json();
        translations = tData.translations || {};
      } catch (tErr) {
        console.error('Comment translation error:', tErr);
      }

      const commentPayload = {
        post_id: postId,
        worker_id: (workerProfile && workerProfile.id) ? workerProfile.id : null,
        content: commentText,
        translations: translations
      };

      const { data, error } = await supabase.from('board_comments').insert([commentPayload]).select('*, workers(name)').single();
      if (error) throw error;

      if (data) {
        setAllBoardPosts(prev => prev.map(p => {
          if (p.id === postId) {
            const updatedComments = p.board_comments ? [...p.board_comments, data] : [data];
            return { ...p, board_comments: updatedComments };
          }
          return p;
        }));
        setReplyInputs(prev => ({ ...prev, [postId]: '' }));
      }
    } catch (err) {
      console.error(err);
      alert('返信の投稿に失敗しました');
    } finally {
      setIsSubmittingReply(prev => ({ ...prev, [postId]: false }));
    }
  };

  const handleDeleteComment = async (commentId: string, postId: string) => {
    if (!confirm('この返信を削除しますか？')) return;
    try {
      const { error } = await supabase.from('board_comments').delete().eq('id', commentId);
      if (error) throw error;
      setAllBoardPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            board_comments: (p.board_comments || []).filter((c: any) => c.id !== commentId)
          };
        }
        return p;
      }));
    } catch (err) {
      console.error(err);
      alert('返信の削除に失敗しました');
    }
  };

  // 出退勤アクション
  const handleClockAction = async (type: 'in' | 'out') => {
    if (!currentUser) return;
    const today = getJSTDate();
    const time = getJSTTime();
    
    // workerProfile.id (UUID of workers table) が必要
    if (!workerProfile || !workerProfile.id) {
      alert('打刻エラー: あなたのアカウントは現場スタッフとして「スタッフマスタ」に登録されていません。\n管理画面からご自身をスタッフ登録してください。');
      return;
    }
    const workerId = workerProfile.id;

    try {
      if (type === 'in') {
        const { data, error } = await supabase.from('attendance_logs').insert([{
          worker_id: workerId,
          date: today,
          clock_in: time,
          status: 'working'
        }]).select().single();
        if (error) throw error;
        setAttendance(data);
      } else {
        if (!attendance) return;
        const { data, error } = await supabase.from('attendance_logs').update({
          clock_out: time,
          status: 'left'
        }).eq('id', attendance.id).select().single();
        if (error) throw error;
        setAttendance(data);
      }
    } catch (err) {
      console.error('打刻エラー:', err);
      alert('打刻に失敗しました。');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('agri_current_worker');
    setCurrentUser(null);
    setWorkerProfile(null);
    setRole('worker');
    setShowWorkerGate(true);
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-10 h-10 text-blue-500 animate-spin" /></div>;
  }

  if (showWorkerGate) {
    return (
      <WorkerGate 
        onLogin={(user) => {
          setShowWorkerGate(false);
          window.location.reload();
        }} 
      />
    );
  }

  const calendarEvents = tasks.map(t => {
    let wObj = t.workers;
    let wName = '';
    if (!wObj && t.worker_id && allWorkers && allWorkers.length > 0) {
      wObj = allWorkers.find((w: any) => w.id === t.worker_id);
    }
    if (wObj) {
      wName = getTranslatedName(wObj, language);
    } else {
      wName = language === 'vi' ? 'Toàn bộ' : language === 'en' ? 'All' : '全体';
    }

    const fieldName = t.fields ? getTranslatedName(t.fields, language) : '';
    const cropName = t.crops ? getTranslatedName(t.crops, language) : '';
    
    const rawTitle = t.task_title || t.work_type || '作業';
    const langKey = `task_title_${language}`;
    const dbTranslatedTitle = t[langKey] || (language !== 'en' && language !== 'ja' ? t.task_title_en : null);
    const translatedTitle = (language === 'ja' ? rawTitle : (dbTranslatedTitle || dynamicTranslations[rawTitle] || getTranslatedWorkType(rawTitle, language)));

    return {
      id: t.id,
      title: translatedTitle,
      date: t.work_date,
      workerId: t.worker_id || (t.workers?.id || ''),
      workerName: wName,
      fieldName: fieldName,
      cropName: cropName,
      color: '#10B981'
    };
  });

  const hasClockedIn = attendance && attendance.clock_in;
  const hasClockedOut = attendance && attendance.clock_out;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans">
      
      {/* ヘッダー */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 min-h-14 sm:h-16 py-2 sm:py-0 flex items-center justify-between gap-2">
          
          {/* 左側：ロゴ・会社名・モード */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="bg-blue-600 p-2 rounded-xl shrink-0 shadow-xs">
              <LayoutDashboard className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0 flex items-center gap-2">
              <h1 className="text-sm sm:text-lg font-black text-slate-800 tracking-tight truncate">
                {companyName} <span className="text-slate-500 font-bold text-xs sm:text-sm">{t("portalName", language)}</span>
              </h1>
              <span className="hidden md:inline-flex px-2 py-0.5 bg-slate-100 text-slate-600 text-[11px] font-bold rounded-lg border border-slate-200 shrink-0">
                {role === 'admin' ? t('adminMode', language) : t('workerMode', language)}
              </span>
            </div>
          </div>

          {/* 右側：ナビゲーション・ユーザー情報・言語切替・ログアウト */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* 現場日報入力へのリンク */}
            <button
              onClick={() => router.push('/work')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl font-black text-xs transition-colors shadow-2xs"
            >
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">⏱️ 現場日報入力</span>
              <span className="sm:hidden">日報</span>
            </button>

            {currentUser && (
              <div className="flex items-center gap-1 sm:gap-2">
                {/* PC用 ログイン中バッジ */}
                <div className="hidden sm:flex items-center gap-1.5 text-xs font-black text-slate-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl shadow-2xs">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-[10px] text-emerald-700 font-bold">{t('portal_loggedIn', language)}</span>
                  <span className="text-slate-900 font-black truncate max-w-[120px]">{getTranslatedName(currentUser, language)}</span>
                </div>

                {/* スタッフ切り替えボタン（管理者のみ） */}
                {role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => setShowWorkerGate(true)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-2 sm:px-2.5 sm:py-1.5 rounded-xl border border-blue-200 transition-colors flex items-center gap-1 shrink-0"
                    title="別の現場スタッフとしてログインし直す"
                  >
                    <UserCheck className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                    <span className="hidden lg:inline">{t('switchWorker', language)}</span>
                  </button>
                )}
              </div>
            )}

            {/* 言語切り替え */}
            <div className="flex items-center bg-slate-50 px-2 py-1.5 rounded-xl border border-slate-200 shrink-0">
              <Globe2 className="w-3.5 h-3.5 text-slate-500 mr-1" />
              <select 
                value={language}
                onChange={(e: any) => setLanguage(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                {LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.flag} {l.code.toUpperCase()}</option>
                ))}
              </select>
            </div>

            {/* ログアウト */}
            <button 
              onClick={handleLogout} 
              className="flex items-center gap-1 p-2 sm:px-2.5 sm:py-1.5 text-xs sm:text-sm font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
              title={t('portal_logout', language)}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{t('portal_logout', language)}</span>
            </button>
          </div>
        </div>

        {/* 🌟 4大統合タブナビゲーションバー（管理者モード時のみ表示） */}
        {role === 'admin' && (
          <div className="bg-slate-50/90 border-t border-slate-200 backdrop-blur-xs">
            <div className="max-w-7xl mx-auto px-3 sm:px-4 flex items-center gap-2 overflow-x-auto py-1.5">
              <button
                type="button"
                onClick={() => {
                  setActivePortalTab('home');
                  router.push('/portal?tab=home');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${
                  activePortalTab === 'home'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>🏠 現場ホーム</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActivePortalTab('cultivations');
                  router.push('/portal?tab=cultivations');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${
                  activePortalTab === 'cultivations'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                <Sprout className="w-4 h-4" />
                <span>🌾 栽培・防除司令塔</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActivePortalTab('hr');
                  router.push('/portal?tab=hr');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${
                  activePortalTab === 'hr'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>⏱ 勤怠・労務管理</span>
                {pendingApprovals.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] rounded-full">
                    {pendingApprovals.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setActivePortalTab('sales');
                  router.push('/portal?tab=sales');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${
                  activePortalTab === 'sales'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>📊 経営・販売・マスタ</span>
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        
        {/* 1. 🌾 栽培・防除司令塔タブ */}
        {role === 'admin' && activePortalTab === 'cultivations' && (
          <CultivationsHub initialSubTab="cultivations" />
        )}

        {/* 2. ⏱ 勤怠・労務管理タブ */}
        {role === 'admin' && activePortalTab === 'hr' && (
          <HrManagementHub />
        )}

        {/* 3. 📊 経営・販売・マスタタブ */}
        {role === 'admin' && activePortalTab === 'sales' && (
          <div className="space-y-6 animate-in fade-in-50 duration-200">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div>
                <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-amber-600" /> 経営管理・販売・マスタ統合メニュー
                </h2>
                <p className="text-xs font-bold text-slate-400 mt-1">
                  作付予実、B2B受注・請求書、各種マスタの設定を素早く切り替え
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                {/* 栽培・予実管理表 */}
                <Link
                  href="/admin/cultivation-schedule"
                  className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 hover:border-emerald-400 transition-all shadow-2xs group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2.5 bg-emerald-600 text-white rounded-xl">
                      <Sprout className="w-5 h-5" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-emerald-500 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <h3 className="text-sm font-black text-slate-800">栽培・予実管理表</h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">作付計画ごとの売上・資材費・労働時間の収支分析</p>
                </Link>

                {/* 育苗スケジュール */}
                <Link
                  href="/admin/nursery-schedule"
                  className="p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 hover:border-blue-400 transition-all shadow-2xs group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2.5 bg-blue-600 text-white rounded-xl">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-blue-500 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <h3 className="text-sm font-black text-slate-800">育苗スケジュール（ロス率計算）</h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">定植必要数とロス率に応じた播種数の自動計算</p>
                </Link>

                {/* B2B請求書・受注管理 */}
                <Link
                  href="/sales-management/invoices"
                  className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 hover:border-indigo-400 transition-all shadow-2xs group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2.5 bg-indigo-600 text-white rounded-xl">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-indigo-500 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <h3 className="text-sm font-black text-slate-800">B2B請求書・販売管理</h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">飲食店・スーパー等の取引先管理とインボイス発行</p>
                </Link>

                {/* 出荷・売上履歴 */}
                <Link
                  href="/admin/sales-history"
                  className="p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 hover:border-amber-400 transition-all shadow-2xs group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2.5 bg-amber-600 text-white rounded-xl">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-amber-500 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <h3 className="text-sm font-black text-slate-800">出荷・売上履歴</h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">日々の出荷実績と販路別売上集計</p>
                </Link>

                {/* マスタ一括管理 */}
                <Link
                  href="/admin/masters"
                  className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 hover:border-slate-400 transition-all shadow-2xs group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2.5 bg-slate-700 text-white rounded-xl">
                      <Database className="w-5 h-5" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <h3 className="text-sm font-black text-slate-800">マスタ管理センター</h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">作目、圃場、作業者、資材、販路等のマスタ設定</p>
                </Link>

                {/* 作付地図・気象 */}
                <Link
                  href="/admin/map"
                  className="p-5 rounded-2xl bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 hover:border-teal-400 transition-all shadow-2xs group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2.5 bg-teal-600 text-white rounded-xl">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-teal-500 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <h3 className="text-sm font-black text-slate-800">作付地図 ＆ 積算気象</h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">航空写真地図上での圃場可視化と積算温度</p>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* 4. 🏠 現場ホーム（一般スタッフモード時、または管理者でhome選択時） */}
        {(role === 'worker' || activePortalTab === 'home') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* 左側カラム */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* 出退勤 */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <Clock className="w-24 h-24" />
              </div>

              {/* ログインユーザー ウェルカムバナー */}
              {currentUser && (
                <div className="mb-4 bg-emerald-50/80 border border-emerald-200/80 p-3 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black text-xs shadow-xs">
                      {currentUser.name ? currentUser.name.charAt(0) : 'ユ'}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-emerald-700">{t('currentWorkerLabel', language)}</p>
                      <p className="text-sm font-black text-slate-800">{getTranslatedName(currentUser, language)}{t('workerHonorific', language)}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-lg">
                    {role === 'admin' ? t('adminMode', language) : t('workerMode', language)}
                  </span>
                </div>
              )}

              <h2 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" /> {t('attendancePortal', language)}
              </h2>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button 
                  onClick={() => handleClockAction('in')}
                  disabled={hasClockedIn}
                  className={`py-4 rounded-2xl font-black transition-colors border flex flex-col items-center gap-1 ${
                    hasClockedIn 
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-100 shadow-sm'
                  }`}
                >
                  <span className="text-2xl">🏃‍♂️</span>
                  <span>{t('portal_clockIn', language)}</span>
                  {hasClockedIn && <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded mt-1">{attendance.clock_in}</span>}
                </button>
                <button 
                  onClick={() => handleClockAction('out')}
                  disabled={!hasClockedIn || hasClockedOut}
                  className={`py-4 rounded-2xl font-black transition-colors border flex flex-col items-center gap-1 ${
                    (!hasClockedIn || hasClockedOut)
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-100 shadow-sm'
                  }`}
                >
                  <span className="text-2xl">🏠</span>
                  <span>{t('portal_clockOut', language)}</span>
                  {hasClockedOut && <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded mt-1">{attendance.clock_out}</span>}
                </button>
              </div>

              {/* 現場ポータル遷移ボタン */}
              <button 
                onClick={() => router.push('/work')}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm mb-4"
              >
                {t('goToWorkPortal', language)} <ArrowRight className="w-4 h-4" />
              </button>

              {/* 🏖️ 有給休暇・残日数 ＆ 申請セクション */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-700">
                    <Coffee className="w-4 h-4 text-amber-500" />
                    <span>{t('leave_title', language)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLeaveModal(true)}
                    className="text-[11px] font-black bg-amber-500 hover:bg-amber-600 active:scale-95 text-white px-3 py-1 rounded-lg flex items-center gap-1 shadow-xs transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('leave_applyBtn', language)}</span>
                  </button>
                </div>

                {leaveBalance ? (
                  <div className="bg-amber-50/60 border border-amber-200/70 p-3.5 rounded-2xl">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11px] font-bold text-amber-800">{t('leave_availableDays', language)}</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-amber-600">{leaveBalance.total}</span>
                        <span className="text-xs font-bold text-amber-800">{t('daysUnit', language)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-amber-700 font-medium mt-1 pt-1.5 border-t border-amber-200/50">
                      <span>{t('leave_carriedOver', language)}<strong>{leaveBalance.carryover}{t('daysUnit', language)}</strong></span>
                      <span>{t('leave_grantedThisYear', language)}<strong>{leaveBalance.balance}{t('daysUnit', language)}</strong></span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-3 rounded-xl text-center text-xs font-bold text-slate-400">
                    有給データ取得中...
                  </div>
                )}

                {/* 直近の休暇申請状況 */}
                {leaveRequests.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-black text-slate-400 block">最近の申請ステータス:</span>
                    {leaveRequests.slice(0, 2).map((req, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-700">{req.start_date}</span>
                          <span className="text-[10px] text-slate-500">({req.type})</span>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                          req.status === '承認' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : req.status === '却下'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {req.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* マニュアル動画 */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <PlayCircle className="w-5 h-5 text-rose-500" /> {t('manualVideo', language)}
                </h2>
                <span className="text-[10px] font-black px-2 py-0.5 bg-rose-50 text-rose-600 rounded-lg border border-rose-100">
                  動画 & ガイド
                </span>
              </div>
              <div className="space-y-2">
                <button 
                  onClick={() => handleOpenManualModal('video')}
                  className="w-full py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-all border border-rose-100 active:scale-95 shadow-xs"
                >
                  <Play className="w-4 h-4 text-rose-600" />
                  <span>{t('watchVideo', language)}</span>
                  <ArrowRight className="w-4 h-4 text-rose-400" />
                </button>
                <button 
                  onClick={() => handleOpenManualModal('guide')}
                  className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all border border-slate-200"
                >
                  <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                  <span>ご利用スタートガイドを見る</span>
                </button>
              </div>
            </div>

            {/* 承認待ち */}
            {role === 'admin' && (
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
                    <Inbox className="w-5 h-5 text-amber-500" /> {t('approvalInbox', language)}
                  </h2>
                  <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded-lg">
                    {pendingApprovals.length}件
                  </span>
                </div>
                
                <div className="space-y-3 mb-4">
                  {pendingApprovals.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">承認待ちの項目はありません</p>
                  ) : (
                    pendingApprovals.slice(0,3).map(app => (
                      <div key={app.id} className="text-sm p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                        <span className="font-bold text-slate-700 truncate">{app.task_title || '作業記録'}</span>
                        <span className="text-xs text-slate-500 whitespace-nowrap ml-2">{app.workers?.name}</span>
                      </div>
                    ))
                  )}
                </div>
                
                <button 
                  onClick={() => router.push('/admin/approvals')}
                  className="w-full py-2.5 text-sm font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
                >
                  {t('seeAll', language)}
                </button>
              </div>
            )}

            {/* 社内掲示板 */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-purple-500" /> {t('noticeBoard', language)}
                </h2>
                <button
                  onClick={handleOpenBoardModal}
                  className="text-xs font-bold text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> {t('board_newPost', language)}
                </button>
              </div>
              <div className="space-y-3 mb-4">
                {boardPosts.length === 0 ? (
                   <p className="text-xs text-slate-400 text-center py-4">新着のお知らせはありません</p>
                ) : (
                  boardPosts.map(post => (
                    <div 
                      key={post.id} 
                      className="text-sm p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:border-purple-200 transition-colors" 
                      onClick={handleOpenBoardModal}
                    >
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span>{new Date(post.created_at).toLocaleDateString()}</span>
                        {post.workers?.name && <span className="font-bold text-slate-600">{post.workers.name}</span>}
                      </div>
                      <p className="font-medium text-slate-700 line-clamp-2">{(language !== 'ja' && post.translations && post.translations[language]) ? post.translations[language] : post.content}</p>
                    </div>
                  ))
                )}
              </div>
              <button 
                onClick={handleOpenBoardModal}
                className="w-full py-2.5 text-sm font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors border border-purple-100 flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                {t('board_openModal', language)}
              </button>
            </div>
            
          </div>

          {/* 右側カラム カレンダー */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 h-full min-h-[600px]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <CalendarIcon className="w-6 h-6 text-emerald-500" /> {t('scheduleTasks', language)}
                </h2>
                {role === 'admin' && (
                  <button 
                    onClick={() => router.push('/admin/tasks')}
                    className="text-sm font-bold bg-slate-800 text-white px-4 py-2 rounded-xl hover:bg-slate-700 transition-colors"
                  >
                    {t('createTask', language)}
                  </button>
                )}
              </div>
              
              <CalendarWrapper 
                events={calendarEvents} 
                t={t} 
                language={language}
                currentWorkerId={workerProfile?.id}
                currentWorkerName={currentUser?.name}
                allWorkers={allWorkers}
              />
              
            </div>
          </div>
        </div>
        )}
      </main>

      {/* フルスクリーン社内掲示板モーダル */}
      {showBoardModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex flex-col animate-in fade-in duration-200">
          
          {/* フルスクリーン上部ナビゲーションバー */}
          <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 shadow-sm flex-shrink-0">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowBoardModal(false)}
                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1.5 font-bold text-sm"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">{t('board_backToPortal', language)}</span>
              </button>
              <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 text-purple-600 rounded-xl">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="font-black text-slate-800 text-base sm:text-lg leading-none">
                    {t('board_modalTitle', language)}
                  </h1>
                  <span className="text-[11px] sm:text-xs font-bold text-slate-400">
                    {t('board_modalSub', language)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* 言語切り替えセレクター */}
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
                className="bg-slate-50 text-slate-700 font-black text-xs border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-purple-400 shadow-sm"
              >
                {LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.flag} {l.code.toUpperCase()}</option>
                ))}
              </select>

              <button
                onClick={loadFullBoardPosts}
                className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-colors"
                title="最新情報に更新"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setShowBoardModal(false)}
                className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </header>

          {/* フルスクリーンメインエリア */}
          <div className="flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-8">
            <div className="max-w-4xl mx-auto space-y-6">
              
              {/* 新規投稿カード */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                <form onSubmit={handlePostBoard} className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-sm font-black text-slate-700 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-500" />
                      {t('board_newPostTitle', language)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">{t('board_categoryLabel', language)}</span>
                      <select
                        value={newPostCategory}
                        onChange={e => setNewPostCategory(e.target.value as any)}
                        className="bg-slate-50 text-xs font-bold text-slate-700 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-purple-400 shadow-sm"
                      >
                        <option value="life">{t('board_catLife', language)}</option>
                        <option value="work">{t('board_catWork', language)}</option>
                        <option value="general">{t('board_catGeneral', language)}</option>
                      </select>
                    </div>
                  </div>

                  <textarea
                    value={newPostContent}
                    onChange={e => setNewPostContent(e.target.value)}
                    placeholder={t('board_placeholder', language)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white transition-all resize-none shadow-inner"
                    rows={3}
                    required
                  />

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-bold text-slate-400">
                      {t('board_author', language)} <span className="text-purple-600 font-black">{workerProfile ? workerProfile.name : '管理者'}</span>
                    </span>
                    <button
                      type="submit"
                      disabled={isPostingBoard || !newPostContent.trim()}
                      className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-200 text-white font-black text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                    >
                      {isPostingBoard ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      <span>{t('board_postBtn', language)}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* カテゴリフィルタータブ */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2 overflow-x-auto pb-1 max-w-full">
                  {[
                    { id: 'all', label: t('board_filterAll', language) },
                    { id: 'life', label: t('board_catLife', language) },
                    { id: 'work', label: t('board_catWork', language) },
                    { id: 'general', label: t('board_catGeneral', language) }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setBoardFilter(tab.id as any)}
                      className={`px-4 py-2 rounded-2xl text-xs font-black transition-all whitespace-nowrap ${
                        boardFilter === tab.id 
                          ? 'bg-purple-600 text-white shadow-md' 
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <span className="text-xs font-bold text-slate-400 hidden sm:inline">
                  {allBoardPosts.length} posts
                </span>
              </div>

              {/* 投稿＆スレッド返信リスト */}
              <div className="space-y-4">
                {allBoardPosts.filter(p => boardFilter === 'all' || p.category === boardFilter).length === 0 ? (
                  <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 border-dashed">
                    <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-400 font-bold">{t('board_noPosts', language)}</p>
                  </div>
                ) : (
                  allBoardPosts
                    .filter(p => boardFilter === 'all' || p.category === boardFilter)
                    .map(post => {
                      const comments = post.board_comments || [];

                      return (
                        <div key={post.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4 transition-all hover:border-purple-200">
                          
                          {/* 投稿ヘッダー */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className={`px-3 py-1 rounded-xl font-black text-xs ${
                                post.category === 'work' ? 'bg-blue-100 text-blue-700' :
                                post.category === 'life' ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {post.category === 'work' ? t('board_catWork', language) : post.category === 'life' ? t('board_catLife', language) : t('board_catGeneral', language)}
                              </span>
                              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                                <span className="font-black text-slate-800">👤 {post.workers?.name || '管理者'}</span>
                                <span>•</span>
                                <span>{new Date(post.created_at).toLocaleString()}</span>
                              </div>
                            </div>

                            {(role === 'admin' || (workerProfile && workerProfile.id === post.worker_id)) && (
                              <button
                                onClick={() => handleDeletePost(post.id)}
                                className="text-slate-300 hover:text-rose-500 transition-colors p-1 rounded-lg hover:bg-rose-50"
                                title="この投稿を削除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          {/* 投稿本文 */}
                          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                            <p className="text-base font-bold text-slate-800 leading-relaxed whitespace-pre-wrap">
                              {(language !== 'ja' && post.translations && post.translations[language]) ? post.translations[language] : post.content}
                            </p>
                          </div>

                          {/* スレッド返信セクション */}
                          <div className="pt-2 border-t border-slate-100 space-y-3">
                            
                            {/* 返信一覧 */}
                            {comments.length > 0 && (
                              <div className="space-y-2.5 pl-4 border-l-2 border-purple-100">
                                {comments.map((comment: any) => (
                                  <div key={comment.id} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1 relative group">
                                    <div className="flex items-center justify-between text-xs">
                                      <div className="flex items-center gap-1.5 text-slate-500 font-bold">
                                        <CornerDownRight className="w-3.5 h-3.5 text-purple-400" />
                                        <span className="font-black text-slate-700">{comment.workers?.name || '管理者'}</span>
                                        <span>•</span>
                                        <span className="text-[10px] text-slate-400">{new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                      </div>
                                      {(role === 'admin' || (workerProfile && workerProfile.id === comment.worker_id)) && (
                                        <button
                                          onClick={() => handleDeleteComment(comment.id, post.id)}
                                          className="text-slate-300 hover:text-rose-500 transition-colors p-0.5"
                                          title="返信を削除"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                    <p className="text-sm font-bold text-slate-800 pl-5">
                                      {(language !== 'ja' && comment.translations && comment.translations[language]) ? comment.translations[language] : comment.content}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* 返信入力バー */}
                            <form onSubmit={(e) => handlePostComment(post.id, e)} className="flex items-center gap-2 pt-1">
                              <div className="relative flex-1">
                                <input
                                  type="text"
                                  value={replyInputs[post.id] || ''}
                                  onChange={e => setReplyInputs({ ...replyInputs, [post.id]: e.target.value })}
                                  placeholder={t('board_replyPlaceholder', language)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-4 pr-10 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-400 focus:bg-white transition-all"
                                />
                                {replyInputs[post.id] && (
                                  <button
                                    type="button"
                                    onClick={() => setReplyInputs({ ...replyInputs, [post.id]: '' })}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                              <button
                                type="submit"
                                disabled={isSubmittingReply[post.id] || !(replyInputs[post.id] || '').trim()}
                                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-200 text-white font-black text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 flex-shrink-0"
                              >
                                {isSubmittingReply[post.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                <span>{t('board_replyBtn', language)}</span>
                              </button>
                            </form>

                          </div>

                        </div>
                      );
                    })
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 🏖️ 有給申請モーダル */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95">
            
            {/* ヘッダー */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                  <Coffee className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">有給・休暇の申請</h3>
                  <p className="text-[10px] text-slate-400 font-bold">希望日と理由を入力して送信してください</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 有給残日数サマリー */}
            {leaveBalance && (
              <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-2xl flex items-center justify-between text-xs">
                <span className="font-bold text-amber-800">現在の利用可能残日数:</span>
                <span className="font-black text-amber-700 text-sm">残り {leaveBalance.total}日</span>
              </div>
            )}

            {/* 申請フォーム */}
            <form onSubmit={handleSubmitLeaveRequest} className="space-y-4">
              {/* 従業員選択（管理者の場合、またはスタッフ名表示） */}
              {role === 'admin' ? (
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    申請する従業員 <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={leaveForm.worker_id}
                    onChange={e => setLeaveForm({ ...leaveForm, worker_id: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white"
                  >
                    <option value="">従業員を選択してください</option>
                    {allWorkers.map(w => (
                      <option key={w.id} value={w.id}>{w.name}（残: {Number(w.paid_leave_carryover || 0) + Number(w.paid_leave_balance || 0)}日）</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 flex items-center justify-between">
                  <span>申請者:</span>
                  <span className="font-black text-slate-800">{currentUser ? getTranslatedName(currentUser, language) : '現場スタッフ'}</span>
                </div>
              )}

              {/* 休暇種別 */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  休暇の種類 <span className="text-rose-500">*</span>
                </label>
                <select
                  value={leaveForm.type}
                  onChange={e => setLeaveForm({ ...leaveForm, type: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white"
                >
                  <option value="有給休暇">有給休暇（全休・1日）</option>
                  <option value="午前半休">午前半休（0.5日）</option>
                  <option value="午後半休">午後半休（0.5日）</option>
                  <option value="特別休暇">特別休暇（慶弔・リフレッシュ等）</option>
                  <option value="欠勤">欠勤</option>
                </select>
              </div>

              {/* 取得希望日 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    開始日 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={leaveForm.start_date}
                    onChange={e => setLeaveForm({ ...leaveForm, start_date: e.target.value, end_date: e.target.value > leaveForm.end_date ? e.target.value : leaveForm.end_date })}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    終了日 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={leaveForm.end_date}
                    min={leaveForm.start_date}
                    onChange={e => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* 申請理由 */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  申請理由・備考 <span className="text-slate-400 font-normal">(任意)</span>
                </label>
                <textarea
                  rows={2}
                  value={leaveForm.reason}
                  onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  placeholder="例: 私用のため、通院のため、家庭の事情など"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>

              {/* 操作ボタン */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingLeave}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 disabled:bg-slate-200 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  {isSubmittingLeave ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>{role === 'admin' ? '有給を登録する' : '申請を送信する'}</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* トースト通知 */}
      {leaveToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-700 text-white px-5 py-3 rounded-2xl shadow-xl font-black text-xs flex items-center gap-2 animate-in slide-in-from-bottom">
          <CheckCircle className="w-4 h-4 text-emerald-300" />
          <span>{leaveToast}</span>
        </div>
      )}

      {/* 🎬📖 フルスクリーン統合マニュアル・動画モーダル */}
      {showManualModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex flex-col animate-in fade-in duration-200">
          
          {/* 上部ヘッダーバー */}
          <header className="min-h-16 py-2.5 px-3 sm:px-8 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 shadow-sm flex-shrink-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <button 
                onClick={() => setShowManualModal(false)}
                className="p-1.5 sm:p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1 font-bold text-xs sm:text-sm"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">{t('manual_backToPortal', language)}</span>
              </button>
              <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 sm:p-2 bg-rose-100 text-rose-600 rounded-xl">
                  {manualTab === 'video' ? <Video className="w-4 h-4 sm:w-5 sm:h-5" /> : <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />}
                </div>
                <div>
                  <h1 className="font-black text-slate-800 text-sm sm:text-lg leading-none">
                    {t('manual_modalTitle', language)}
                  </h1>
                  <span className="text-[10px] sm:text-xs font-bold text-slate-400 hidden xs:inline block">
                    {t('manual_modalSub', language)}
                  </span>
                </div>
              </div>
            </div>

            {/* タブ切り替えボタン & 操作ボタン */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setManualTab('video')}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl font-bold text-xs transition-all ${
                    manualTab === 'video'
                      ? 'bg-white text-rose-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span>{t('manual_tabVideo', language)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setManualTab('guide')}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl font-bold text-xs transition-all ${
                    manualTab === 'guide'
                      ? 'bg-white text-emerald-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span>{t('manual_tabGuide', language)}</span>
                </button>
              </div>

              {manualTab === 'video' && (
                <button
                  onClick={loadVideoManuals}
                  className="p-1.5 sm:p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                  title="動画一覧を更新"
                >
                  <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${isLoadingManuals ? 'animate-spin text-rose-600' : ''}`} />
                </button>
              )}
              <button 
                onClick={() => setShowManualModal(false)}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                title="閉じる"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
          </header>

          {/* メインスクロールエリア */}
          <div className="flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-8">
            <div className="max-w-6xl mx-auto space-y-6">

              {/* ======================================================== */}
              {/* TAB 1: 🎬 動画マニュアル集                                */}
              {/* ======================================================== */}
              {manualTab === 'video' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  
                  {/* 動画プレイヤー表示（再生中の場合） */}
                  {playingVideoUrl && (
                    <div id="manual-video-player-container" className="bg-slate-900 rounded-3xl p-4 sm:p-6 shadow-xl border border-slate-800 animate-in slide-in-from-top-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 text-white">
                        <div className="flex items-center gap-2">
                          <Play className="w-4 h-4 text-rose-400" />
                          <span className="font-bold text-sm">{t('manual_playingNow', language)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* 字幕言語セレクター */}
                          <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1 rounded-xl border border-slate-700">
                            <Languages className="w-3.5 h-3.5 text-rose-400" />
                            <span className="text-[11px] font-bold text-slate-300">{t('manual_subtitleLang', language)}</span>
                            <select
                              value={language}
                              onChange={(e) => setLanguage(e.target.value as LanguageCode)}
                              className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
                            >
                              {LANGUAGES.map(l => (
                                <option key={l.code} value={l.code} className="bg-slate-900 text-white">
                                  {l.flag} {l.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            onClick={() => setPlayingVideoUrl(null)}
                            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                          >
                            <X className="w-4 h-4" /> {t('manual_closePlayer', language)}
                          </button>
                        </div>
                      </div>
                      <VideoPlayerWithSubtitles
                        videoUrl={playingVideoUrl}
                        narrations={playingNarrations}
                        language={language}
                        trimStart={playingTrimStart}
                        trimEnd={playingTrimEnd}
                        autoPlay={true}
                      />
                    </div>
                  )}

                  {/* 動画一覧ヘッダー */}
                  <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-rose-100 text-rose-700 text-xs font-black px-2.5 py-0.5 rounded-full">
                          {t('manual_movieTutorialsTag', language)}
                        </span>
                        <span className="text-xs font-bold text-slate-400">
                          {language === 'ja' ? `全 ${videoManuals.length} 本` : `Total ${videoManuals.length}`}
                        </span>
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black text-slate-800">
                        {t('manual_videoHeading', language)}
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                        {t('manual_videoDesc', language)}
                      </p>
                    </div>

                    {role === 'admin' && (
                      <button
                        onClick={() => setShowAddVideoModal(true)}
                        className="flex-shrink-0 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{t('manual_addNewVideo', language)}</span>
                      </button>
                    )}
                  </div>

                  {/* 動画グリッド */}
                  {isLoadingManuals ? (
                    <div className="bg-white rounded-3xl p-16 text-center border border-slate-200">
                      <Loader2 className="w-10 h-10 text-rose-500 animate-spin mx-auto mb-3" />
                      <p className="text-sm font-bold text-slate-500">動画マニュアルを読み込み中...</p>
                    </div>
                  ) : videoManuals.length === 0 ? (
                    <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-4">
                      <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto text-rose-400">
                        <Video className="w-8 h-8" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-800 mb-1">{t('manual_noVideosTitle', language)}</h3>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                          {t('manual_noVideosDesc', language)}
                        </p>
                      </div>
                      <div className="flex justify-center gap-3">
                        <button
                          onClick={() => setManualTab('guide')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors shadow-sm inline-flex items-center gap-2"
                        >
                          <BookOpen className="w-4 h-4" />
                          <span>{t('manual_viewStartGuide', language)}</span>
                        </button>
                        {role === 'admin' && (
                          <button
                            onClick={() => setShowAddVideoModal(true)}
                            className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors shadow-sm inline-flex items-center gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            <span>{t('manual_addFirstVideo', language)}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {videoManuals.map((manual) => (
                        <div
                          key={manual.id}
                          onClick={() => handlePlayManualVideo(manual)}
                          className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg hover:border-rose-300 transition-all group cursor-pointer flex flex-col relative"
                        >
                          <div className="aspect-video bg-slate-900 relative flex items-center justify-center group-hover:bg-slate-800 transition-colors">
                            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform backdrop-blur-xs">
                              <Play className="w-7 h-7 text-white ml-0.5" />
                            </div>
                            <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-xs">
                              {t('manual_playBadge', language)}
                            </span>
                            {role === 'admin' && (
                              <button
                                onClick={(e) => handleDeleteVideoManual(manual.id, e)}
                                title="動画を削除"
                                className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-rose-600 text-white rounded-xl transition-colors opacity-0 group-hover:opacity-100 backdrop-blur-xs"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <div className="p-5 flex flex-col flex-1">
                            <h3 className="font-black text-slate-800 text-base mb-1.5 group-hover:text-rose-600 transition-colors line-clamp-1">
                              {manual.title}
                            </h3>
                            {manual.description ? (
                              <p className="text-xs text-slate-500 font-medium line-clamp-2 leading-relaxed flex-1">
                                {manual.description}
                              </p>
                            ) : (
                              <p className="text-xs text-slate-400 italic flex-1">{t('manual_noDescription', language)}</p>
                            )}
                            <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-bold">
                              <span>{manual.created_at ? new Date(manual.created_at).toLocaleDateString() : ''}</span>
                              <div className="flex items-center gap-2">
                                {role === 'admin' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenStudio(manual);
                                    }}
                                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-xs"
                                    title="動画のトリミングとテロップを編集"
                                  >
                                    <Scissors className="w-3 h-3 text-rose-500" />
                                    <span>{t('manual_editTelopBtn', language)}</span>
                                  </button>
                                )}
                                <span className="text-rose-600 font-black flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                                  {t('manual_watchVideoBtn', language)} <ArrowRight className="w-3.5 h-3.5" />
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              )}

              {/* 📤 新規動画マニュアル登録モーダル (子モーダル) */}
              {showAddVideoModal && (
                <div 
                  className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in"
                  onClick={() => !isSubmittingVideo && setShowAddVideoModal(false)}
                >
                  <div 
                    className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-rose-100 text-rose-600 rounded-xl">
                          <Video className="w-5 h-5" />
                        </div>
                        <h2 className="text-base font-black text-slate-800">{t('manual_addModalTitle', language)}</h2>
                      </div>
                      <button 
                        onClick={() => setShowAddVideoModal(false)} 
                        disabled={isSubmittingVideo}
                        className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    
                    <form onSubmit={handleAddVideoSubmit} className="p-6 space-y-4">
                      {videoModalMessage && (
                        <div className={`p-3.5 rounded-xl flex items-center gap-2.5 font-bold text-xs ${
                          videoModalMessage.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>{videoModalMessage.text}</span>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-black text-slate-700 mb-1">
                          {t('manual_videoTitleLabel', language)} <span className="text-rose-500">*</span>
                        </label>
                        <input 
                          type="text" 
                          value={newVideoTitle} 
                          onChange={e => setNewVideoTitle(e.target.value)} 
                          required 
                          placeholder="例: トラクターの基本操作と安全点検"
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-rose-500 focus:bg-white" 
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black text-slate-700 mb-1">
                          {t('manual_videoDescLabel', language)} <span className="text-slate-400 font-normal">(任意)</span>
                        </label>
                        <textarea 
                          value={newVideoDescription} 
                          onChange={e => setNewVideoDescription(e.target.value)} 
                          placeholder="例: エンジン始動前の点検項目と作業後の清掃手順を説明しています。"
                          className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-rose-500 focus:bg-white min-h-[80px]" 
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black text-slate-700 mb-1">
                          {t('manual_videoFileLabel', language)} <span className="text-rose-500">*</span>
                        </label>
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 border-dashed space-y-2">
                          <input 
                            type="file" 
                            accept="video/mp4,video/quicktime,video/webm,video/*" 
                            required
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file && file.size > 50 * 1024 * 1024) {
                                alert('動画の容量が大きすぎます（50MB以下にしてください）。現場のスマホでスムーズに再生できるよう、1〜2分程度の短い動画または720p前後の画質を推奨します。');
                                e.target.value = '';
                                setNewVideoFile(null);
                              } else {
                                setNewVideoFile(file || null);
                              }
                            }}
                            className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-rose-100 file:text-rose-700 hover:file:bg-rose-200 cursor-pointer"
                          />
                          <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                            💡 <strong>スマホ最適化の目安:</strong> MP4形式 / 720p〜1080p / 1〜2分程度（30MB以下推奨）。長時間の動画はチャプターごとに分けて登録すると、現場でサクサク快適に再生できます。
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                        <button 
                          type="button" 
                          onClick={() => setShowAddVideoModal(false)} 
                          disabled={isSubmittingVideo} 
                          className="px-4 py-2 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-100 transition-colors"
                        >
                          {t('cancel', language)}
                        </button>
                        <button 
                          type="submit" 
                          disabled={isSubmittingVideo || !newVideoTitle.trim() || !newVideoFile} 
                          className="px-5 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                        >
                          {isSubmittingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                          <span>{isSubmittingVideo ? t('manual_uploadingBtn', language) : t('manual_submitRegisterBtn', language)}</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* TAB 2: 📖 スタートガイド（操作マニュアル）                */}
              {/* ======================================================== */}
              {manualTab === 'guide' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  
                  {/* ガイドヘッダー */}
                  <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-emerald-100 text-emerald-700 text-xs font-black px-2.5 py-0.5 rounded-full">
                        START GUIDE
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-800">
                      農業経営システム ご利用スタートガイド
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                      「どの畑で・どの作物を育てると・いくら儲かるのか」を正確に把握するためのステップです。<br className="hidden sm:block" />
                      この順序通りに進めるだけで、誰でも簡単にシステムを活用できます。
                    </p>

                    {/* ステップナビゲーション */}
                    <div className="flex overflow-x-auto pb-2 mt-6 gap-2 hide-scrollbar">
                      {[
                        { id: 1, title: '1. 作付地図で圃場登録', icon: MapPin },
                        { id: 2, title: '2. 基本マスタ登録', icon: UserCheck },
                        { id: 3, title: '3. 栽培計画作成', icon: Sprout },
                        { id: 4, title: '4. 現場スマホ入力', icon: Smartphone },
                        { id: 5, title: '5. 月末請求・経費', icon: Receipt },
                        { id: 6, title: '6. 利益の確認・分析', icon: TrendingUp },
                        { id: 0, title: '補足: 画面の見方', icon: LayoutDashboard },
                      ].map((step) => {
                        const Icon = step.icon;
                        const isActive = activeGuideStep === step.id;
                        return (
                          <button
                            key={step.id}
                            onClick={() => setActiveGuideStep(step.id)}
                            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs transition-all border-2 ${
                              isActive
                                ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-white hover:border-slate-300'
                            }`}
                          >
                            <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                            <span className="whitespace-nowrap">{step.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ステップ詳細カード */}
                  <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 sm:p-10 space-y-6">
                    
                    {/* STEP 1: 作付地図で圃場登録 */}
                    {activeGuideStep === 1 && (
                      <div className="space-y-6 animate-in fade-in">
                        <div className="border-b border-slate-100 pb-4">
                          <h3 className="text-xl font-black text-slate-800 mb-1">
                            【ステップ1】 作付地図で圃場（畑・ハウス）を登録しよう
                          </h3>
                          <p className="text-sm text-slate-600 leading-relaxed">
                            Googleマップの航空写真を使って、持っている畑やビニールハウスを直感的に登録します。
                            自分の畑を地図上で囲むだけで、面積（アール: a）が自動計算されます！
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-emerald-50/70 p-5 rounded-2xl border border-emerald-100 space-y-2">
                            <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                              <MapPin className="w-4 h-4 text-emerald-600" /> 1. 地図を開いて畑を追加
                            </div>
                            <p className="text-xs text-emerald-800 leading-relaxed">
                              左メニューの「作付地図」を開き、画面上の「＋ 地図に畑を追加」ボタンを押します。
                            </p>
                          </div>

                          <div className="bg-emerald-50/70 p-5 rounded-2xl border border-emerald-100 space-y-2">
                            <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                              <Pointer className="w-4 h-4 text-emerald-600" /> 2. 地図上をクリックして畑を囲む
                            </div>
                            <p className="text-xs text-emerald-800 leading-relaxed">
                              畑の角をポチポチとクリックして囲むと、右上に「現在の面積: 〇〇 a」と自動表示され、正確な面積が計算されます。
                            </p>
                          </div>
                        </div>

                        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
                          <strong className="flex items-center gap-1 font-bold"><CheckCircle2 className="w-4 h-4 text-amber-600" /> ここがポイント！</strong>
                          <p>ここで登録した畑の面積をもとに、あとで全体の電気代や資材費が自動的に公平に按分（割り振り）されます。</p>
                        </div>

                        <div className="flex justify-end pt-2">
                          <button onClick={() => setActiveGuideStep(2)} className="bg-slate-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-slate-700 transition-colors flex items-center gap-1">
                            次のステップ（マスタ登録）へ <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* STEP 2: 基本マスタ登録 */}
                    {activeGuideStep === 2 && (
                      <div className="space-y-6 animate-in fade-in">
                        <div className="border-b border-slate-100 pb-4">
                          <h3 className="text-xl font-black text-slate-800 mb-1">
                            【ステップ2】 その他の初期設定（基本データの登録）
                          </h3>
                          <p className="text-sm text-slate-600 leading-relaxed">
                            圃場の登録が終わったら、育てる作物・働くスタッフ・使う資材などを登録します。
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                            <strong className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                              <Sprout className="w-4 h-4 text-emerald-600" /> 1. 作目（作物）の登録
                            </strong>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              キャベツやトマトなど育てる作物を登録します。10aあたりの概算経費を設定しておくと予算管理が自動化されます。
                            </p>
                          </div>

                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                            <strong className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                              <UserCheck className="w-4 h-4 text-emerald-600" /> 2. 作業者（スタッフ）の登録
                            </strong>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              一緒に働く従業員やご自身を登録します。時給と現場用4桁PINコードを設定します。
                            </p>
                          </div>

                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                            <strong className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                              <PackageOpen className="w-4 h-4 text-emerald-600" /> 3. 資材・農薬の登録
                            </strong>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              肥料や農薬、段ボール等の購入単価を登録しておくと、現場で「1袋使った」と選ぶだけで原価計算されます。
                            </p>
                          </div>

                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                            <strong className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                              <Banknote className="w-4 h-4 text-emerald-600" /> 4. 出荷先・販売単価
                            </strong>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              JAや直売所、スーパーごとの単価を設定しておくと、出荷記録をつけるだけで売上が即時集計されます。
                            </p>
                          </div>
                        </div>

                        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                          <Globe2 className="w-5 h-5 text-emerald-600 shrink-0" />
                          <span><strong>多言語AI自動翻訳:</strong> 作目や資材を日本語で登録するだけで、英語・ベトナム語・インドネシア語・中国語へ自動翻訳されます。</span>
                        </div>

                        <div className="flex justify-between pt-2">
                          <button onClick={() => setActiveGuideStep(1)} className="text-slate-500 font-bold text-xs px-4 py-2 hover:bg-slate-100 rounded-lg">前へ</button>
                          <button onClick={() => setActiveGuideStep(3)} className="bg-slate-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-slate-700 transition-colors flex items-center gap-1">
                            次のステップ（栽培計画）へ <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* STEP 3: 栽培計画作成 */}
                    {activeGuideStep === 3 && (
                      <div className="space-y-6 animate-in fade-in">
                        <div className="border-b border-slate-100 pb-4">
                          <h3 className="text-xl font-black text-slate-800 mb-1">
                            【ステップ3】 栽培計画を立てよう
                          </h3>
                          <p className="text-sm text-slate-600 leading-relaxed">
                            基本データの登録が終わったら、カレンダー表で今年の栽培スケジュールを計画します。
                          </p>
                        </div>

                        <div className="p-5 bg-emerald-50/70 rounded-2xl border border-emerald-100 space-y-3">
                          <strong className="text-sm font-bold text-emerald-900 block">栽培計画の作成手順:</strong>
                          <ol className="list-decimal ml-5 space-y-2 text-xs text-emerald-800 leading-relaxed font-medium">
                            <li>「栽培・予実管理表」を開き、計画を立てたい <strong>「畑（圃場）」</strong> と <strong>「開始月」</strong> のマス目をクリックします。</li>
                            <li><strong>「育てる作物（作目）」</strong> と <strong>「終了月」</strong> を選んで「保存する」を押します。</li>
                            <li>圃場の面積と作物の基準値から <strong>「必要苗数」「資材予算」「売上目標」</strong> が自動計算され、カレンダー上に計画バーが表示されます。</li>
                          </ol>
                        </div>

                        <div className="flex justify-between pt-2">
                          <button onClick={() => setActiveGuideStep(2)} className="text-slate-500 font-bold text-xs px-4 py-2 hover:bg-slate-100 rounded-lg">前へ</button>
                          <button onClick={() => setActiveGuideStep(4)} className="bg-slate-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-slate-700 transition-colors flex items-center gap-1">
                            次のステップ（現場スマホ入力）へ <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* STEP 4: 現場スマホ入力 */}
                    {activeGuideStep === 4 && (
                      <div className="space-y-6 animate-in fade-in">
                        <div className="border-b border-slate-100 pb-4">
                          <h3 className="text-xl font-black text-slate-800 mb-1">
                            【ステップ4】 日常の記録（現場からスマホで簡単入力！）
                          </h3>
                          <p className="text-sm text-slate-600 leading-relaxed">
                            毎日の作業や収穫記録を、農場（現場）からスマートフォンでワンタップで入力できます。
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                            <strong className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                              <Smartphone className="w-4 h-4 text-blue-600" /> スマホでPINログイン
                            </strong>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              名前を選んで4桁暗証番号を入れるだけ。多言語切り替え（日・英・越・尼・中）に対応しています。
                            </p>
                          </div>

                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                            <strong className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                              <Clock className="w-4 h-4 text-emerald-600" /> タイマー / 手入力モード
                            </strong>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              「作業開始」ボタンで自動計測するタイマーモードと、後からまとめて入力できる手入力モードを選べます。
                            </p>
                          </div>

                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                            <strong className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                              <Camera className="w-4 h-4 text-purple-600" /> 写真・動画を添付
                            </strong>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              病害虫の様子や野菜の生育状態をカメラで撮影して日報に添付できます。画像は自動で高速圧縮されます。
                            </p>
                          </div>

                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                            <strong className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                              <Truck className="w-4 h-4 text-amber-600" /> 出荷・売上の記録
                            </strong>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              出荷した数量を入力すると、登録単価から売上金額が自動計算され、畑ごとの採算に直結します。
                            </p>
                          </div>
                        </div>

                        <div className="flex justify-between pt-2">
                          <button onClick={() => setActiveGuideStep(3)} className="text-slate-500 font-bold text-xs px-4 py-2 hover:bg-slate-100 rounded-lg">前へ</button>
                          <button onClick={() => setActiveGuideStep(5)} className="bg-slate-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-slate-700 transition-colors flex items-center gap-1">
                            次のステップ（月末請求・経費）へ <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* STEP 5: 月末請求・経費 */}
                    {activeGuideStep === 5 && (
                      <div className="space-y-6 animate-in fade-in">
                        <div className="border-b border-slate-100 pb-4">
                          <h3 className="text-xl font-black text-slate-800 mb-1">
                            【ステップ5】 月末・決算の経理作業
                          </h3>
                          <p className="text-sm text-slate-600 leading-relaxed">
                            月末の請求書発行や、月に1回の経費入力、そして決算時の会計データ出力を行います。
                          </p>
                        </div>

                        <div className="space-y-3">
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                            <strong className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                              <FileText className="w-4 h-4 text-blue-600" /> 1. 請求書の一括発行（月末）
                            </strong>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              日々の出荷記録を自動集計し、取引先ごとのインボイス対応請求書をPDFダウンロードまたはメール送信できます。
                            </p>
                          </div>

                          <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-100 space-y-1">
                            <strong className="text-sm font-bold text-emerald-900 flex items-center gap-1.5">
                              <Calculator className="w-4 h-4 text-emerald-600" /> 2. 月次全体経費の入力（自動按分）
                            </strong>
                            <p className="text-xs text-emerald-800 leading-relaxed">
                              電気代や燃料代など「農場全体にかかったお金」を入力すると、システムが畑の面積に合わせて自動按分して各作物の原価に反映します。
                            </p>
                          </div>
                        </div>

                        <div className="flex justify-between pt-2">
                          <button onClick={() => setActiveGuideStep(4)} className="text-slate-500 font-bold text-xs px-4 py-2 hover:bg-slate-100 rounded-lg">前へ</button>
                          <button onClick={() => setActiveGuideStep(6)} className="bg-slate-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-slate-700 transition-colors flex items-center gap-1">
                            次のステップ（利益分析）へ <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* STEP 6: 利益の確認・分析 */}
                    {activeGuideStep === 6 && (
                      <div className="space-y-6 animate-in fade-in">
                        <div className="border-b border-slate-100 pb-4">
                          <h3 className="text-xl font-black text-slate-800 mb-1">
                            【ステップ6】 利益の確認・分析（経営の見える化）
                          </h3>
                          <p className="text-sm text-slate-600 leading-relaxed">
                            日々の作業時間・資材使用・出荷売上・按分経費が合算され、畑ごと・作目ごとの真の収支が判明します。
                          </p>
                        </div>

                        <div className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 space-y-3">
                          <strong className="text-sm font-bold text-emerald-900 flex items-center gap-1.5">
                            <TrendingUp className="w-5 h-5 text-emerald-600" /> 「どの畑が一番儲かっているか？」が一目で分かる！
                          </strong>
                          <ul className="space-y-1.5 list-disc ml-5 text-xs text-emerald-800 leading-relaxed font-medium">
                            <li><strong>作目別 採算分析:</strong> 作物ごとの売上・直接原価・按分経費・人件費・粗利率をグラフで比較。</li>
                            <li><strong>圃場別 レポート:</strong> 畑ごとの実質時給（売上−経費 ÷ 総労働時間）を算出。</li>
                            <li><strong>来期の作付戦略へ:</strong> 儲かる作物に面積を集中させ、無駄なコストを削減するデータ経営が実現します。</li>
                          </ul>
                        </div>

                        <div className="flex justify-between pt-2">
                          <button onClick={() => setActiveGuideStep(5)} className="text-slate-500 font-bold text-xs px-4 py-2 hover:bg-slate-100 rounded-lg">前へ</button>
                          <button onClick={() => setManualTab('video')} className="bg-rose-600 text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-rose-700 transition-colors flex items-center gap-1">
                            動画マニュアルを見る <Video className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* STEP 0: 補足 */}
                    {activeGuideStep === 0 && (
                      <div className="space-y-6 animate-in fade-in">
                        <div className="border-b border-slate-100 pb-4">
                          <h3 className="text-xl font-black text-slate-800 mb-1">
                            【補足】 画面の見方とおすすめの運用ルーティン
                          </h3>
                          <p className="text-sm text-slate-600 leading-relaxed">
                            日々の農業経営を効率よく回すための基本ルーティンです。
                          </p>
                        </div>

                        <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                            <strong className="text-slate-900 block font-bold mb-1">☀️ 朝のルーティン:</strong>
                            ポータル画面で今日のタスク予定と社内掲示板を確認し、「出勤」を打刻します。
                          </div>
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                            <strong className="text-slate-900 block font-bold mb-1">🌾 日中のルーティン:</strong>
                            畑で作業を行いながらスマホで作業時間や資材使用を記録します。
                          </div>
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                            <strong className="text-slate-900 block font-bold mb-1">🌙 夕方のルーティン:</strong>
                            収穫・出荷の数量を記録し、「退勤」を打刻。管理者は承認インボックスを確認してワンクリック承認します。
                          </div>
                        </div>

                        <div className="flex justify-start pt-2">
                          <button onClick={() => setActiveGuideStep(1)} className="text-slate-500 font-bold text-xs px-4 py-2 hover:bg-slate-100 rounded-lg">ステップ1へ戻る</button>
                        </div>
                      </div>
                    )}

                  </div>

                </div>
              )}

            </div>
          </div>

        </div>
      )}

      {/* 🎬✂️ フルスクリーン動画編集・テロップスタジオモーダル */}
      {editingManual && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-[130] flex flex-col animate-in fade-in duration-200 text-slate-100">
          
          {/* スタジオヘッダー */}
          <header className="min-h-16 py-2.5 px-3 sm:px-8 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5 flex-shrink-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setEditingManual(null)}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-1 font-bold text-xs"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">スタジオを閉じる</span>
              </button>
              <div className="h-6 w-px bg-slate-800 hidden sm:block"></div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 sm:p-2 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
                  <Scissors className="w-4 h-4" />
                </div>
                <div>
                  <h1 className="font-black text-white text-xs sm:text-base leading-none flex items-center gap-1.5">
                    <span>動画・テロップ編集スタジオ</span>
                    <span className="text-[10px] bg-rose-600 text-white font-bold px-1.5 py-0.5 rounded truncate max-w-[120px] sm:max-w-none">
                      {editingManual.title}
                    </span>
                  </h1>
                  <span className="text-[10px] text-slate-400 hidden xs:inline block">
                    不要な部分をカットし、秒数を指定してAI多言語テロップを追加できます
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* 言語プレビュー切り替え */}
              <div className="flex items-center gap-1 bg-slate-800 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl border border-slate-700">
                <Languages className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-400 hidden sm:inline">プレビュー言語:</span>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as LanguageCode)}
                  className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
                >
                  {LANGUAGES.map(l => (
                    <option key={l.code} value={l.code} className="bg-slate-900 text-white">{l.flag} {l.name}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleSaveStudio}
                disabled={isSavingStudio}
                className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs px-3.5 sm:px-5 py-1.5 sm:py-2.5 rounded-xl transition-all shadow-lg flex items-center gap-1 sm:gap-1.5 disabled:opacity-50"
              >
                {isSavingStudio ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{isSavingStudio ? '保存中...' : 'スタジオで保存する'}</span>
              </button>
            </div>
          </header>

          {/* スタジオメインエリア (2カラム) */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* 左側: 動画プレビュー & トリミング設定 */}
            <div className="lg:col-span-7 space-y-5">
              
              {/* プレビュープレイヤー */}
              <div className="bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-800 shadow-xl space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <div className="flex items-center gap-2">
                    <Play className="w-4 h-4 text-rose-400" />
                    <span>リアルタイム プレビュー</span>
                  </div>
                  <div className="bg-slate-800 px-3 py-1 rounded-lg border border-slate-700 font-mono text-emerald-400 font-black">
                    再生位置: {studioPlaybackTime.toFixed(1)} 秒
                  </div>
                </div>

                {editingVideoUrl ? (
                  <VideoPlayerWithSubtitles
                    videoUrl={editingVideoUrl}
                    narrations={editingNarrations}
                    language={language}
                    trimStart={parseFloat(trimStartInput) || 0}
                    trimEnd={trimEndInput ? parseFloat(trimEndInput) : undefined}
                    onTimeUpdate={(t) => setStudioPlaybackTime(t)}
                  />
                ) : (
                  <div className="aspect-video bg-black rounded-2xl flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
                  </div>
                )}

                {/* タイムスタンプワンタップボタンバー */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                  <span className="text-slate-400">現在秒数をテロップ開始に指定:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTelopStartSec(studioPlaybackTime.toFixed(1));
                      setTelopEndSec((studioPlaybackTime + 3).toFixed(1));
                    }}
                    className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl font-black transition-all flex items-center gap-1"
                  >
                    <span>📌 {studioPlaybackTime.toFixed(1)}秒を開始にセット</span>
                  </button>
                </div>
              </div>

              {/* ✂️ カット・トリミング設定パネル */}
              <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-black text-white flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-amber-400" />
                    動画のカット・トリミング設定
                  </h2>
                  <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    余分な前後をスキップ再生
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* 先頭カット */}
                  <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60 space-y-2">
                    <label className="block text-xs font-bold text-slate-300">
                      再生開始秒数（先頭カット）
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={trimStartInput}
                        onChange={e => setTrimStartInput(e.target.value)}
                        className="w-24 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-black text-white focus:outline-none focus:border-amber-400 font-mono"
                      />
                      <span className="text-xs text-slate-400">秒</span>
                      <button
                        type="button"
                        onClick={() => setTrimStartInput(studioPlaybackTime.toFixed(1))}
                        className="ml-auto px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] font-bold rounded-lg transition-colors"
                      >
                        現在秒をセット
                      </button>
                    </div>
                  </div>

                  {/* 末尾カット */}
                  <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60 space-y-2">
                    <label className="block text-xs font-bold text-slate-300">
                      再生終了秒数（末尾カット）
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="最後まで"
                        value={trimEndInput}
                        onChange={e => setTrimEndInput(e.target.value)}
                        className="w-24 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-black text-white focus:outline-none focus:border-amber-400 font-mono"
                      />
                      <span className="text-xs text-slate-400">秒</span>
                      <button
                        type="button"
                        onClick={() => setTrimEndInput(studioPlaybackTime.toFixed(1))}
                        className="ml-auto px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] font-bold rounded-lg transition-colors"
                      >
                        現在秒をセット
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* 右側: テロップ作成 & タイムライン一覧 */}
            <div className="lg:col-span-5 space-y-5 flex flex-col">
              
              {/* テロップ作成カード */}
              <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-black text-white flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-purple-400" />
                    テロップ（字幕）を追加
                  </h2>
                  <span className="text-[10px] font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-md border border-purple-500/30">
                    Gemini AI翻訳対応
                  </span>
                </div>

                {/* 表示時間（何秒から何秒まで出す） */}
                <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span>⏱️ 表示時間（秒）を指定:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const s = parseFloat(telopStartSec) || 0;
                          setTelopEndSec((s + 3).toFixed(1));
                        }}
                        className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-[10px] text-slate-200"
                      >
                        +3秒
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const s = parseFloat(telopStartSec) || 0;
                          setTelopEndSec((s + 5).toFixed(1));
                        }}
                        className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-[10px] text-slate-200"
                      >
                        +5秒
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={telopStartSec}
                      onChange={e => setTelopStartSec(e.target.value)}
                      className="w-20 px-2.5 py-1.5 bg-slate-900 border border-slate-600 rounded-xl text-xs font-mono font-black text-emerald-400 text-center"
                    />
                    <span className="text-xs text-slate-400 font-bold">秒 〜</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={telopEndSec}
                      onChange={e => setTelopEndSec(e.target.value)}
                      className="w-20 px-2.5 py-1.5 bg-slate-900 border border-slate-600 rounded-xl text-xs font-mono font-black text-rose-400 text-center"
                    />
                    <span className="text-xs text-slate-400 font-bold">秒</span>
                    <span className="text-[10px] text-slate-400 ml-auto font-mono">
                      (表示: {((parseFloat(telopEndSec) || 0) - (parseFloat(telopStartSec) || 0)).toFixed(1)}秒間)
                    </span>
                  </div>
                </div>

                {/* 日本語テロップ入力 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black text-slate-300">
                      日本語テロップ <span className="text-rose-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleTranslateTelop}
                      disabled={isTranslatingTelop || !telopJa.trim()}
                      className="px-3 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all shadow-md flex items-center gap-1 active:scale-95"
                    >
                      {isTranslatingTelop ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                      <span>{isTranslatingTelop ? 'AI翻訳中...' : '✨ AI多言語一括翻訳'}</span>
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={telopJa}
                    onChange={e => setTelopJa(e.target.value)}
                    placeholder="例: トラクターのエンジンをかける前に、周囲の安全を確認してください。"
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-2xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
                  />
                </div>

                {/* AI翻訳プレビュー */}
                {Object.keys(telopTranslations).length > 0 && (
                  <div className="bg-slate-800/60 p-3 rounded-2xl border border-purple-500/30 space-y-2 text-[11px]">
                    <div className="flex items-center gap-1.5 text-purple-300 font-bold">
                      <Check className="w-3.5 h-3.5 text-purple-400" />
                      <span>AI翻訳結果（自動生成）:</span>
                    </div>
                    <div className="space-y-1 text-slate-300">
                      {telopTranslations.en && <p><span className="text-slate-400">🇺🇸 EN:</span> {telopTranslations.en}</p>}
                      {telopTranslations.vi && <p><span className="text-slate-400">🇻🇳 VI:</span> {telopTranslations.vi}</p>}
                      {telopTranslations.id && <p><span className="text-slate-400">🇮🇩 ID:</span> {telopTranslations.id}</p>}
                      {telopTranslations.zh && <p><span className="text-slate-400">🇨🇳 ZH:</span> {telopTranslations.zh}</p>}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleAddNarrationToStudio}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-black text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>タイムラインにテロップを追加</span>
                </button>
              </div>

              {/* タイムライン一覧 */}
              <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 shadow-xl flex-1 flex flex-col min-h-[300px]">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-black text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-emerald-400" />
                    タイムラインテロップ一覧
                  </h2>
                  <span className="text-xs font-bold text-slate-400">
                    全 {editingNarrations.length} 件
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[350px] pr-1">
                  {isLoadingNarrations ? (
                    <div className="py-12 text-center text-slate-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-rose-500" />
                      <span>テロップデータを読み込み中...</span>
                    </div>
                  ) : editingNarrations.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      まだテロップが登録されていません。<br/>
                      上のフォームから秒数を指定して追加してください。
                    </div>
                  ) : (
                    editingNarrations.map((n, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-2xl border transition-all ${
                          studioPlaybackTime >= n.start_time && studioPlaybackTime <= n.end_time
                            ? 'bg-rose-500/20 border-rose-500/50 shadow-md'
                            : 'bg-slate-800/80 border-slate-700/80 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-black font-mono px-2 py-0.5 bg-slate-900 text-emerald-400 rounded-md border border-slate-700">
                            ⏱️ {n.start_time.toFixed(1)}s 〜 {n.end_time.toFixed(1)}s
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteNarrationFromStudio(idx)}
                            className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                            title="テロップを削除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-xs font-bold text-white mb-1">
                          {n.script_ja}
                        </p>
                        {(n.script_vi || n.translations?.vi || n.script_en || n.translations?.en) && (
                          <div className="text-[10px] text-slate-400 space-y-0.5 border-t border-slate-700/50 pt-1 mt-1">
                            {(n.script_vi || n.translations?.vi) && (
                              <p className="truncate">🇻🇳 {n.script_vi || n.translations?.vi}</p>
                            )}
                            {(n.script_en || n.translations?.en) && (
                              <p className="truncate">🇺🇸 {n.script_en || n.translations?.en}</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* スタジオトースト通知 */}
      {studioToast && (
        <div className="fixed bottom-6 right-6 z-[140] bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl font-black text-xs flex items-center gap-2 animate-in slide-in-from-bottom">
          <Check className="w-4 h-4 text-emerald-200" />
          <span>{studioToast}</span>
        </div>
      )}

    </div>
  );
}
