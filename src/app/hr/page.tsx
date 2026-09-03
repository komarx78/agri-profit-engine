"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId, getTenantWorkerIds } from '@/lib/tenant';
import { Clock, Users, Calendar as CalendarIcon, Coffee, Sun, CloudRain, ShieldCheck, ArrowRight, Save, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { AdminOnlyGuard } from '@/components/AdminOnlyGuard';
import { getJSTDate, formatDisplayTime } from '@/lib/dateUtils';

export default function HrDashboardPage() {
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [workLogs, setWorkLogs] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [attendanceRules, setAttendanceRules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editBreakMinutes, setEditBreakMinutes] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  // 一括編集用
  const [bulkBreakMinutes, setBulkBreakMinutes] = useState<number>(60);
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const tenantId = await getCurrentTenantId();
        if (!tenantId) {
          setIsLoading(false);
          return;
        }

        const dateStr = getJSTDate();

        // 1. 自社テナントの従業員一覧を取得
        const { data: wData } = await supabase
          .from('workers')
          .select('*')
          .eq('user_id', tenantId);

        const currentWorkers = wData || [];
        setWorkers(currentWorkers);
        const workerIds = currentWorkers.map(w => w.id);

        // 2. 勤怠ルール一覧を取得
        try {
          const { data: rData } = await supabase
            .from('attendance_rules')
            .select('*')
            .eq('user_id', tenantId);
          if (rData) setAttendanceRules(rData);
        } catch (e) {
          console.warn('attendance_rules fetch error:', e);
        }

        // 3. 自社従業員の勤怠ログのみを取得
        if (workerIds.length > 0) {
          const { data: attData } = await supabase
            .from('attendance_logs')
            .select('*')
            .in('worker_id', workerIds)
            .eq('date', dateStr)
            .order('clock_in', { ascending: false });

          if (attData) setAttendanceLogs(attData);

          // 4. 自社従業員の作業日報ログを取得
          const { data: workData } = await supabase
            .from('work_logs')
            .select('*, crops(name), fields(name)')
            .in('worker_id', workerIds)
            .eq('work_date', dateStr);

          if (workData) setWorkLogs(workData);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleSaveBreak = async (id: string) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('attendance_logs')
        .update({ 
          total_break_minutes: editBreakMinutes,
          actual_rest_minutes: editBreakMinutes 
        })
        .eq('id', id);
      if (error) {
        // actual_rest_minutesカラムが無い場合のフォールバック
        await supabase
          .from('attendance_logs')
          .update({ total_break_minutes: editBreakMinutes })
          .eq('id', id);
      }
      
      setAttendanceLogs(prev => prev.map(log => log.id === id ? { ...log, total_break_minutes: editBreakMinutes } : log));
      setEditingLogId(null);
    } catch(err) {
      alert('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkSaveBreak = async () => {
    if (!attendanceLogs.length) return;
    if (!confirm(`本日の打刻データ全員（${attendanceLogs.length}件）の休憩時間を一括で「${bulkBreakMinutes}分」に更新しますか？`)) {
      return;
    }

    setIsBulkSaving(true);
    try {
      const ids = attendanceLogs.map(l => l.id);
      const { error } = await supabase
        .from('attendance_logs')
        .update({ 
          total_break_minutes: bulkBreakMinutes,
          actual_rest_minutes: bulkBreakMinutes 
        })
        .in('id', ids);
      if (error) {
        await supabase
          .from('attendance_logs')
          .update({ total_break_minutes: bulkBreakMinutes })
          .in('id', ids);
      }

      setAttendanceLogs(prev => prev.map(log => ({ ...log, total_break_minutes: bulkBreakMinutes })));
      alert(`全員の休憩時間を ${bulkBreakMinutes} 分に更新しました！`);
    } catch (e: any) {
      alert('一括更新エラー: ' + (e.message || '通信エラー'));
    } finally {
      setIsBulkSaving(false);
    }
  };

  const calculateTotalMinutes = (start?: string, end?: string, date?: string) => {
    if (!start || !end) return 0;
    const startStr = start.includes('T') ? start : `${date || ''}T${start}`;
    const endStr = end.includes('T') ? end : `${date || ''}T${end}`;
    const diff = new Date(endStr).getTime() - new Date(startStr).getTime();
    if (isNaN(diff)) return 0;
    return Math.floor(diff / 1000 / 60);
  };

  if (isLoading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

  return (
    <AdminOnlyGuard>
      <div className="min-h-screen bg-slate-50">
        <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
          {/* サマリーカード */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400">本日の打刻出勤者</div>
                <div className="text-2xl font-black text-slate-800">{attendanceLogs.length} <span className="text-sm font-bold text-slate-500">名</span></div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-black">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400">日報提出者</div>
                <div className="text-2xl font-black text-slate-800">{new Set(workLogs.map(w => w.worker_id)).size} <span className="text-sm font-bold text-slate-500">名</span></div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center font-black">
                <Coffee className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400">休憩の一括反映</div>
                <div className="flex items-center gap-2 mt-1">
                  <select 
                    value={bulkBreakMinutes}
                    onChange={(e) => setBulkBreakMinutes(Number(e.target.value))}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700"
                  >
                    <option value={0}>0分</option>
                    <option value={30}>30分</option>
                    <option value={45}>45分</option>
                    <option value={60}>60分 (標準)</option>
                    <option value={75}>75分</option>
                    <option value={90}>90分</option>
                  </select>
                  <button 
                    onClick={handleBulkSaveBreak}
                    disabled={isBulkSaving}
                    className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-xs shadow-xs"
                  >
                    {isBulkSaving ? '処理中...' : '全員適用'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 勤怠突合テーブル */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-800">本日の勤怠・作業突合リスト</h2>
                <p className="text-xs text-slate-400 font-medium">打刻時間（出退勤）と日報時間のズレを自動検知します</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">スタッフ</th>
                    <th className="px-6 py-4">出勤 / 退勤</th>
                    <th className="px-6 py-4">打刻拘束</th>
                    <th className="px-6 py-4">休憩時間</th>
                    <th className="px-6 py-4">日報作業時間</th>
                    <th className="px-6 py-4">突合判定</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendanceLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-xs font-bold">
                        本日の出勤打刻データはありません
                      </td>
                    </tr>
                  ) : (
                    attendanceLogs.map((log) => {
                      const worker = workers.find(w => w.id === log.worker_id);
                      const wLogs = workLogs.filter(w => w.worker_id === log.worker_id);
                      const reportMinutes = wLogs.reduce((sum, w) => sum + (Number(w.duration_minutes) || 0), 0);

                      const clockTotalMinutes = calculateTotalMinutes(log.clock_in, log.clock_out, log.date);
                      const breakMins = log.total_break_minutes || 0;
                      const actualWorkMinutes = Math.max(0, clockTotalMinutes - breakMins);
                      const diff = Math.abs(actualWorkMinutes - reportMinutes);

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-800">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-black">
                                {worker?.name ? worker.name.charAt(0) : '員'}
                              </div>
                              <div>
                                <span>{worker?.name || '不明スタッフ'}</span>
                                {(() => {
                                  const matchedRule = attendanceRules.find(r => r.id === worker?.attendance_rule_id);
                                  return (
                                    <span className="block text-[10px] text-indigo-600 font-bold">
                                      {matchedRule?.name || (worker?.standard_start_time ? `${worker.standard_start_time.substring(0,5)}〜${worker.standard_end_time?.substring(0,5)}` : '標準定時')}
                                    </span>
                                  );
                                })()}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-600">
                            {log.clock_in ? formatDisplayTime(log.clock_in) : '--:--'} 〜 {log.clock_out ? formatDisplayTime(log.clock_out) : <span className="text-emerald-500">勤務中</span>}
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-600">
                            {clockTotalMinutes > 0 ? `${Math.floor(clockTotalMinutes / 60)}h ${clockTotalMinutes % 60}m` : '--'}
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-600">
                            {editingLogId === log.id ? (
                              <div className="flex items-center gap-1.5">
                                <input 
                                  type="number" 
                                  value={editBreakMinutes} 
                                  onChange={e => setEditBreakMinutes(Number(e.target.value))}
                                  className="w-16 px-2 py-1 bg-slate-50 border border-slate-300 rounded font-bold text-xs"
                                />
                                <button 
                                  onClick={() => handleSaveBreak(log.id)}
                                  disabled={isSaving}
                                  className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div 
                                onClick={() => {
                                  setEditingLogId(log.id);
                                  setEditBreakMinutes(breakMins);
                                }}
                                className="cursor-pointer hover:text-blue-600 underline decoration-dashed flex items-center gap-1"
                                title="クリックして休憩時間を手動修正"
                              >
                                <span>{breakMins} 分</span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-800">
                            {reportMinutes > 0 ? `${Math.floor(reportMinutes / 60)}h ${reportMinutes % 60}m` : <span className="text-slate-400">未提出</span>}
                          </td>
                          <td className="px-6 py-4">
                            {log.clock_out && reportMinutes > 0 ? (
                              diff > 30 ? (
                                <div className="inline-flex items-center gap-1 px-2 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-bold">
                                  <AlertCircle className="w-3 h-3" /> ズレ {diff}分
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-bold">
                                  <ShieldCheck className="w-3 h-3" /> 一致
                                </div>
                              )
                            ) : (
                              <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">記録中</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </main>
      </div>
    </AdminOnlyGuard>
  );
}
