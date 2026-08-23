"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Calendar as CalendarIcon, Clock, CheckCircle2, Inbox, 
  MapPin, LogOut, LayoutDashboard, Briefcase, FileText,
  AlertCircle, Loader2, ArrowRight, PlayCircle, Globe2
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { t, LANGUAGES, LanguageCode } from '@/lib/i18n';
import { WorkerGate } from '@/components/WorkerGate';

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
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [boardPosts, setBoardPosts] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any>(null);
  const [showWorkerGate, setShowWorkerGate] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        let currentRole = 'worker';
        let profile = null;
        let userIdForFetch = null;

        // 1. まずAdminセッションを確認
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          // --- 管理者(またはAuth登録されたユーザー)の場合 ---
          const { data: userData } = await supabase.from('users').select('*').eq('id', session.user.id).single();
          const { data: companyData } = await supabase.from('company_settings').select('company_name').limit(1).single();
          
          if (companyData && companyData.company_name) {
            setCompanyName(companyData.company_name);
          } else if (userData && userData.name) {
            setCompanyName(userData.name);
          } else {
            setCompanyName('Cocotte');
          }

          if (userData && userData.role === 'admin') {
            currentRole = 'admin';
            setRole('admin');
            setCurrentUser(userData);
            userIdForFetch = userData.id;
          } else {
            const { data: workerData } = await supabase.from('workers').select('*').eq('user_id', session.user.id).single();
            if (workerData) {
              currentRole = 'worker';
              setRole('worker');
              profile = workerData;
              setWorkerProfile(workerData);
              setCurrentUser(workerData);
              userIdForFetch = workerData.id;
            } else {
              // 権限なし
              router.push('/login');
              return;
            }
          }
        } else {
          // --- セッションがない場合はローカルストレージ（PINログイン履歴）を確認 ---
          const savedUser = localStorage.getItem('agri_current_worker');
          if (savedUser) {
            const workerData = JSON.parse(savedUser);
            currentRole = 'worker';
            setRole('worker');
            profile = workerData;
            setWorkerProfile(workerData);
            setCurrentUser(workerData);
            userIdForFetch = workerData.id;
            
            // 会社名は一旦デフォルト（WorkerGateには会社名取得がないため）
            // 必要に応じてDBから引くことも可能だが、今回は簡易的にハードコード
            setCompanyName('Cocotte');
          } else {
            // PINログインもしていなければ、WorkerGateを表示する
            setShowWorkerGate(true);
            setIsLoading(false);
            return;
          }
        }

        // --- データフェッチ ---
        // Tasks
        if (currentRole === 'admin') {
          const { data: tData } = await supabase.from('tasks').select('*').order('due_date', { ascending: true }).limit(5);
          if (tData) setTasks(tData);
        } else if (profile) {
          const { data: tData } = await supabase.from('tasks').select('*').or(`assignee_id.eq.${profile.id},assignee_id.is.null`).order('due_date', { ascending: true }).limit(5);
          if (tData) setTasks(tData);
        }

        // Approvals (Admin only)
        if (currentRole === 'admin') {
          const { data: aData } = await supabase.from('hr_requests').select('*, workers(name)').eq('status', 'pending').limit(3);
          if (aData) setPendingApprovals(aData);
        }

        // Board Posts
        const { data: bData } = await supabase.from('board_posts').select('*, workers(name)').order('created_at', { ascending: false }).limit(5);
        if (bData) setBoardPosts(bData);

        // Attendance (Worker only)
        if (currentRole === 'worker' && profile) {
          const today = getJSTDate();
          const { data: attData } = await supabase
            .from('attendance_logs')
            .select('*')
            .eq('worker_id', profile.id)
            .eq('date', today)
            .single();
          if (attData) setAttendance(attData);
        }

      } catch (error) {
        console.error('Error fetching portal data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [router, showWorkerGate]); // showWorkerGateも依存配列に入れておく

  const fetchPortalData = async (userId: string, currentRole: string, profile: any) => {
    const today = getJSTDate();

    // 1. タスク (カレンダー用)
    const targetUserId = profile ? profile.user_id : userId; // オーナーID
    const { data: taskData } = await supabase.from('work_logs')
      .select('id, task_title, work_date, status, crops(name), fields(name)')
      .eq('user_id', targetUserId)
      .eq('status', 'planned');
    if (taskData) setTasks(taskData);

    // 2. 承認待ち (管理者の場合はテナント全体)
    if (currentRole === 'admin') {
      const { data: appData } = await supabase.from('work_logs')
        .select('id, task_title, work_date, workers(name)')
        .eq('user_id', userId)
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
    const workerId = profile ? profile.id : userId; // 仮
    if (workerId) {
      const { data: aLog } = await supabase.from('attendance_logs')
        .select('*')
        .eq('worker_id', workerId)
        .eq('date', today)
        .maybeSingle();
      if (aLog) setAttendance(aLog);
    }
  };

  // 出退勤アクション
  const handleClockAction = async (type: 'in' | 'out') => {
    if (!currentUser) return;
    const today = getJSTDate();
    const time = getJSTTime();
    
    // workerProfile.id (UUID of workers table) が必須
    if (!workerProfile || !workerProfile.id) {
      alert('打刻エラー: あなたのアカウントは現場スタッフとして「スタッフマスタ」に登録されていません。\n管理者画面からご自身をスタッフ登録してください。');
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
    if (role === 'admin') {
      await supabase.auth.signOut();
      router.push('/login');
    } else {
      localStorage.removeItem('agri_current_worker');
      setCurrentUser(null);
      setShowWorkerGate(true);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-10 h-10 text-blue-500 animate-spin" /></div>;
  }

  const calendarEvents = tasks.map(t => ({
    id: t.id,
    title: t.task_title || '作業',
    date: t.work_date,
    color: '#10B981'
  }));

  
  
    
  const hasClockedIn = attendance && attendance.clock_in;
  const hasClockedOut = attendance && attendance.clock_out;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans">
      
      {/* 統合ヘッダー */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl">
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">{companyName} {t("portalName", language)}</h1>
            <span className="ml-4 px-2.5 py-1 bg-slate-100 text-slate-500 text-xs font-bold rounded-lg border border-slate-200">
              {role === 'admin' ? t('adminMode') : t('workerMode')}
            </span>
          </div>
          <div className="flex items-center gap-4">
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
          
          {/* 左側：アクション系＆インフォメーション */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* ウィジェット：打刻・出退勤 */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <Clock className="w-24 h-24" />
              </div>
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
                  <span className="text-2xl">🏃</span>
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

              <button 
                onClick={() => router.push('/work')}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                {t('goToWorkPortal', language)} <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* ウィジェット：{t('manualVideo', language)} */}
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

            {/* ウィジェット：{t('approvalInbox', language)} (管理者のみ) */}
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
                    <p className="text-xs text-slate-400 text-center py-4">承認待ちのデータはありません</p>
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

            {/* ウィジェット：{t('noticeBoard', language)} */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <h2 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-500" /> {t('noticeBoard', language)}
              </h2>
              <div className="space-y-3 mb-4">
                {boardPosts.length === 0 ? (
                   <p className="text-xs text-slate-400 text-center py-4">新着のお知らせはありません</p>
                ) : (
                  boardPosts.map(post => (
                    <div key={post.id} className="text-sm p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-xs text-slate-400 mb-1">{new Date(post.created_at).toLocaleDateString()}</div>
                      <p className="font-medium text-slate-700 line-clamp-2">{(language !== 'ja' && post.translations && post.translations[language]) ? post.translations[language] : post.content}</p>
                    </div>
                  ))
                )}
              </div>
              <button 
                onClick={() => router.push('/work')}
                className="w-full py-2.5 text-sm font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors border border-purple-100"
              >
                {t('seeBoard', language)}
              </button>
            </div>
            
          </div>

          {/* 右側：カレンダーメイン */}
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
              
              <CalendarWrapper events={calendarEvents} t={t} language={language} />
              
            </div>
          </div>
          
        </div>
      </main>
      
    </div>
  );
}
