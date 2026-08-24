"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Calendar as CalendarIcon, Clock, CheckCircle2, Inbox, 
  MapPin, LogOut, LayoutDashboard, Briefcase, FileText,
  AlertCircle, Loader2, ArrowRight, ArrowLeft, PlayCircle, Globe2,
  MessageSquare, Plus, Trash2, X, Send, Sparkles, CornerDownRight, RefreshCw,
  Coffee, CalendarPlus, CheckCircle, UserCheck
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { t, getTranslatedName, getTranslatedWorkType, LANGUAGES, LanguageCode } from '@/lib/i18n';
import { WorkerGate } from '@/components/WorkerGate';
import { getPortalTasks } from '@/app/actions/farm';
import { translateSingleText } from '@/app/actions/translate';

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
  const router = useRouter();
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
        
        let currentRole = 'worker';
        let profile = null;
        let ownerId = '';

        if (session) {
          // --- 管理者(またはAuth登録されたユーザー) ---
          ownerId = session.user.id;
          localStorage.setItem('agri_owner_id', ownerId);
          
          // オーナーの会社名を取得
          const { data: companyData } = await supabase.from('company_settings').select('company_name').eq('user_id', ownerId).maybeSingle();
          
          if (companyData && companyData.company_name) {
            setCompanyName(companyData.company_name);
          } else {
            setCompanyName('Cocotte');
          }

          currentRole = 'admin';
          setRole('admin');
          setCurrentUser({ name: '管理者', name_en: 'Admin', role: 'admin' });
          
        } else {
          // --- セッションなし（現場スタッフのPINログイン確認） ---
          const savedUser = localStorage.getItem('agri_current_worker');
          if (savedUser) {
            const workerData = JSON.parse(savedUser);
            const isWorkerAdmin = workerData.role === 'admin';
            currentRole = isWorkerAdmin ? 'admin' : 'worker';
            setRole(isWorkerAdmin ? 'admin' : 'worker');
            profile = workerData;
            setWorkerProfile(workerData);
            setCurrentUser(workerData);
            
            // ワーカーの所属農園ID（user_id）を最優先で確定
            ownerId = workerData.user_id || localStorage.getItem('agri_owner_id') || '';
            
            // 旧キャッシュ対策：もしownerIdが空なら、自身(workerData.id)からDBを参照して農園IDを自己修復
            if (!ownerId && workerData.id) {
              const { data: wRecord } = await supabase.from('workers').select('user_id').eq('id', workerData.id).maybeSingle();
              if (wRecord && wRecord.user_id) {
                ownerId = wRecord.user_id;
              }
            }

            if (ownerId) {
              localStorage.setItem('agri_owner_id', ownerId);
            }
            
            // ワーカー用に会社名を取得 (ownerIdから)
            const { data: companyData } = await supabase.from('company_settings').select('company_name').eq('user_id', ownerId).maybeSingle();
            if (companyData && companyData.company_name) {
              setCompanyName(companyData.company_name);
            } else {
              setCompanyName('Cocotte');
            }
          } else {
            // ローカルストレージにもなければ、WorkerGateを表示する
            setShowWorkerGate(true);
            setIsLoading(false);
            return;
          }
        }
        
        await fetchPortalData(ownerId, currentRole, profile);
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

    // 3. 掲示板最新3件
    const { data: boardData } = await supabase.from('board_posts')
      .select('*')
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
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl">
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">{companyName} {t("portalName", language)}</h1>
            <span className="ml-4 px-2.5 py-1 bg-slate-100 text-slate-500 text-xs font-bold rounded-lg border border-slate-200">
              {role === 'admin' ? t('adminMode', language) : t('workerMode', language)}
            </span>
          </div>
          <div className="flex items-center gap-3 md:gap-4">
            {currentUser && (
              <div className="flex items-center gap-2">
                <div className="text-xs md:text-sm font-black text-slate-800 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-2xl flex items-center gap-2 shadow-xs">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-[11px] text-emerald-700 font-bold">{t('portal_loggedIn', language)}</span>
                  <span className="text-slate-900 font-black">{getTranslatedName(currentUser, language)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWorkerGate(true)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-xl border border-blue-200 transition-colors flex items-center gap-1"
                  title="別の現場スタッフとしてログインし直す"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('switchWorker', language)}</span>
                </button>
              </div>
            )}
            <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
              <Globe2 className="w-4 h-4 text-slate-400" />
              <select 
                value={language}
                onChange={(e: any) => setLanguage(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-600 outline-none cursor-pointer"
              >
                {LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.flag} {l.code.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors">
              <LogOut className="w-4 h-4" /> {t('portal_logout', language)}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        
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
              <h2 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                <PlayCircle className="w-5 h-5 text-rose-500" /> {t('manualVideo', language)}
              </h2>
              <button 
                onClick={() => router.push('/admin/manuals')}
                className="w-full py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors border border-rose-100"
              >
                {t('watchVideo', language)} <ArrowRight className="w-4 h-4" />
              </button>
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

    </div>
  );
}
