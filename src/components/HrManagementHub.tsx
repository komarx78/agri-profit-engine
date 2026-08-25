"use client";

import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  UserCheck, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  FileSpreadsheet, 
  Users, 
  Settings, 
  ChevronRight, 
  Loader2, 
  Sparkles, 
  AlertCircle,
  Coffee,
  Check,
  Edit2,
  X
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '@/lib/tenant';
import Link from 'next/link';

// 日本時間のYYYY-MM-DDを取得
const getJSTDate = () => {
  const d = new Date();
  d.setHours(d.getHours() + 9);
  return d.toISOString().split('T')[0];
};

export default function HrManagementHub() {
  const [isLoading, setIsLoading] = useState(true);
  const [todayDate, setTodayDate] = useState(getJSTDate());
  const [workers, setWorkers] = useState<any[]>([]);
  const [todayAttendanceLogs, setTodayAttendanceLogs] = useState<any[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);
  const [allLeaves, setAllLeaves] = useState<any[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isProcessingLeave, setIsProcessingLeave] = useState<{ [id: string]: boolean }>({});

  // 打刻修正モーダル
  const [editingLog, setEditingLog] = useState<any | null>(null);
  const [editClockIn, setEditClockIn] = useState<string>('');
  const [editClockOut, setEditClockOut] = useState<string>('');
  const [editBreakMinutes, setEditBreakMinutes] = useState<string>('60');
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);

  const fetchHrData = async () => {
    setIsLoading(true);
    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) {
        setIsLoading(false);
        return;
      }

      const today = getJSTDate();
      setTodayDate(today);

      const [workersRes, logsRes, leavesRes] = await Promise.all([
        supabase.from('workers').select('*').eq('user_id', tenantId).order('name'),
        supabase.from('attendance_logs').select('*, workers(name, role)').eq('user_id', tenantId).eq('date', today).order('clock_in', { ascending: false }),
        supabase.from('leave_requests').select('*, workers(name, role)').eq('user_id', tenantId).order('created_at', { ascending: false })
      ]);

      const fetchedWorkers = workersRes.data || [];
      const fetchedLogs = logsRes.data || [];
      const fetchedLeaves = leavesRes.data || [];

      setWorkers(fetchedWorkers);
      setTodayAttendanceLogs(fetchedLogs);
      setAllLeaves(fetchedLeaves);
      setPendingLeaves(fetchedLeaves.filter(l => l.status === 'pending'));

    } catch (err) {
      console.error('Error fetching HR data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHrData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 有給・休暇申請の承認・却下
  const handleUpdateLeaveStatus = async (requestId: string, newStatus: 'approved' | 'rejected') => {
    setIsProcessingLeave(prev => ({ ...prev, [requestId]: true }));
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: newStatus,
          approved_at: newStatus === 'approved' ? new Date().toISOString() : null
        })
        .eq('id', requestId);

      if (error) throw error;

      showToast(newStatus === 'approved' ? '有給・休暇申請を承認しました！' : '休暇申請を却下しました');
      fetchHrData();
    } catch (err: any) {
      console.error(err);
      alert('ステータスの更新に失敗しました: ' + err.message);
    } finally {
      setIsProcessingLeave(prev => ({ ...prev, [requestId]: false }));
    }
  };

  // 打刻修正の保存
  const handleSaveAttendanceEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog) return;

    setIsSavingAttendance(true);
    try {
      const { error } = await supabase
        .from('attendance_logs')
        .update({
          clock_in: editClockIn || null,
          clock_out: editClockOut || null,
          break_minutes: parseInt(editBreakMinutes, 10) || 0
        })
        .eq('id', editingLog.id);

      if (error) throw error;

      setEditingLog(null);
      showToast('打刻時間を修正しました！');
      fetchHrData();
    } catch (err: any) {
      console.error(err);
      alert('打刻の修正に失敗しました: ' + err.message);
    } finally {
      setIsSavingAttendance(false);
    }
  };

  // 本日の出勤中メンバーの集計
  const activeWorkingWorkers = todayAttendanceLogs.filter(l => l.clock_in && !l.clock_out);
  const finishedWorkers = todayAttendanceLogs.filter(l => l.clock_in && l.clock_out);

  return (
    <div className="space-y-6">
      
      {/* 上部：勤怠クイック統計＆ナビゲーション */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400">現在出勤中</p>
            <p className="text-2xl font-black text-slate-800">{activeWorkingWorkers.length} <span className="text-xs font-bold text-slate-500">名</span></p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400">有給・休暇 未承認</p>
            <p className="text-2xl font-black text-amber-600">{pendingLeaves.length} <span className="text-xs font-bold text-slate-500">件</span></p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400">本日の打刻総数</p>
            <p className="text-2xl font-black text-slate-800">{todayAttendanceLogs.length} <span className="text-xs font-bold text-slate-500">件</span></p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-5 rounded-2xl text-white shadow-sm flex flex-col justify-between">
          <p className="text-xs font-bold text-indigo-100">給与・月次集計</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm font-black">タイムカード集計</span>
            <Link 
              href="/hr/monthly" 
              className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold backdrop-blur-xs flex items-center gap-1 transition-colors"
            >
              <span>集計へ</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-xs font-bold">勤怠・労務データを読み込んでいます...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* 左側：リアルタイム出勤ボード ＆ 本日の打刻ログ */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* 本日の出勤中ボード */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-600" /> 本日の出勤状況ボード ({todayDate})
                </h3>
                <span className="text-xs font-bold text-slate-400">登録スタッフ: {workers.length}名</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeWorkingWorkers.map(log => (
                  <div key={log.id} className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
                      <div>
                        <h4 className="text-sm font-black text-slate-800">{log.workers?.name || 'スタッフ'}</h4>
                        <p className="text-[11px] font-bold text-emerald-700">出勤中: {log.clock_in}〜</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-md">
                      稼働中
                    </span>
                  </div>
                ))}

                {activeWorkingWorkers.length === 0 && (
                  <div className="col-span-full p-6 text-center text-slate-400 text-xs font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    現在、稼働中のスタッフはいません
                  </div>
                )}
              </div>
            </div>

            {/* 本日の全打刻ログ一覧 */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" /> 本日の打刻ログ一覧
                </h3>
                <button
                  type="button"
                  onClick={fetchHrData}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  更新
                </button>
              </div>

              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {todayAttendanceLogs.map(log => (
                  <div key={log.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-black text-xs flex items-center justify-center">
                        {log.workers?.name ? log.workers.name.charAt(0) : 'ス'}
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-800">{log.workers?.name}</p>
                        <p className="text-[11px] font-bold text-slate-500">
                          出勤: {log.clock_in || '--:--'} / 退勤: {log.clock_out || '未退勤'} (休憩: {log.break_minutes || 0}分)
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingLog(log);
                        setEditClockIn(log.clock_in || '');
                        setEditClockOut(log.clock_out || '');
                        setEditBreakMinutes(String(log.break_minutes || 0));
                      }}
                      className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>修正</span>
                    </button>
                  </div>
                ))}

                {todayAttendanceLogs.length === 0 && (
                  <div className="p-8 text-center text-slate-400 text-xs font-bold">
                    本日の打刻データはまだありません
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 右側：有給・休暇申請の承認センター ＆ マスタショートカット */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* 有給申請の未承認リスト */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-600" /> 有給・休暇申請の承認
                </h3>
                {pendingLeaves.length > 0 && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black rounded-full animate-bounce">
                    {pendingLeaves.length} 件 未承認
                  </span>
                )}
              </div>

              <div className="space-y-3 max-h-[420px] overflow-y-auto">
                {pendingLeaves.map(leave => (
                  <div key={leave.id} className="p-4 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-black text-slate-800">{leave.workers?.name || 'スタッフ'}</h4>
                        <p className="text-xs font-bold text-amber-800 mt-0.5">
                          {leave.type || '有給休暇'}: {leave.start_date} {leave.end_date !== leave.start_date && `〜 ${leave.end_date}`}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 bg-amber-200 text-amber-900 text-[10px] font-black rounded">
                        申請中
                      </span>
                    </div>

                    {leave.reason && (
                      <p className="text-xs text-slate-600 bg-white/80 p-2 rounded-xl border border-amber-100">
                        理由: {leave.reason}
                      </p>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isProcessingLeave[leave.id]}
                        onClick={() => handleUpdateLeaveStatus(leave.id, 'rejected')}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-xl border border-slate-200 transition-colors"
                      >
                        却下
                      </button>
                      <button
                        type="button"
                        disabled={isProcessingLeave[leave.id]}
                        onClick={() => handleUpdateLeaveStatus(leave.id, 'approved')}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-colors shadow-2xs flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>承認する</span>
                      </button>
                    </div>
                  </div>
                ))}

                {pendingLeaves.length === 0 && (
                  <div className="p-8 text-center text-slate-400 text-xs font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    現在、未承認の休暇申請はありません ✨
                  </div>
                )}
              </div>
            </div>

            {/* HR管理 関連メニューリンク */}
            <div className="bg-slate-100 rounded-3xl p-5 border border-slate-200 space-y-2.5">
              <h4 className="text-xs font-black text-slate-600 mb-2 px-1">労務・給与管理メニュー</h4>
              
              <Link 
                href="/hr/monthly" 
                className="p-3 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between transition-colors shadow-2xs group"
              >
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-black text-slate-800">月次タイムカード集計・CSV出力</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link 
                href="/hr/employees" 
                className="p-3 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between transition-colors shadow-2xs group"
              >
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-black text-slate-800">従業員・時給マスタ設定</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link 
                href="/hr/overtime" 
                className="p-3 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between transition-colors shadow-2xs group"
              >
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-black text-slate-800">残業時間分析・36協定管理</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link 
                href="/hr/settings" 
                className="p-3 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between transition-colors shadow-2xs group"
              >
                <div className="flex items-center gap-2.5">
                  <Settings className="w-4 h-4 text-slate-600" />
                  <span className="text-xs font-black text-slate-800">締め日・就業規則設定</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 打刻修正モーダル */}
      {editingLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-black text-slate-800 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" /> 打刻修正 ({editingLog.workers?.name})
            </h3>
            <form onSubmit={handleSaveAttendanceEdit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">出勤時間</label>
                <input 
                  type="time" 
                  value={editClockIn} 
                  onChange={e => setEditClockIn(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">退勤時間</label>
                <input 
                  type="time" 
                  value={editClockOut} 
                  onChange={e => setEditClockOut(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">休憩時間 (分)</label>
                <input 
                  type="number" 
                  value={editBreakMinutes} 
                  onChange={e => setEditBreakMinutes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingLog(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSavingAttendance}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-colors"
                >
                  {isSavingAttendance ? '保存中...' : '修正を保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* トースト通知 */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-800 flex items-center gap-2.5 text-xs font-black animate-in slide-in-from-top-4 duration-200">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
