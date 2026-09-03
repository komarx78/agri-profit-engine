"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '@/lib/tenant';
import { Clock, Users, Calendar as CalendarIcon, Coffee, Sun, CloudRain, ShieldCheck, ArrowRight, Save, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { getJSTDate, formatDisplayTime } from '@/lib/dateUtils';
import { AdminOnlyGuard } from '@/components/AdminOnlyGuard';

export default function HrDashboardPage() {
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [workLogs, setWorkLogs] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 休憩時間編集用
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editBreakMinutes, setEditBreakMinutes] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const tenantId = await getCurrentTenantId();
        const dateStr = getJSTDate();

        // 1. 自社テナントの従業員一覧を取得
        let wList: any[] = [];
        if (tenantId) {
          const { data: wData } = await supabase
            .from('workers')
            .select('*')
            .eq('user_id', tenantId);
          if (wData) wList = wData;
        }
        setWorkers(wList);
        const workerIds = wList.map(w => w.id);

        // 2. 勤怠ログの取得（テナント絞り込み対応）
        let attQuery = supabase
          .from('attendance_logs')
          .select('*')
          .eq('date', dateStr)
          .order('clock_in', { ascending: false });

        if (workerIds.length > 0) {
          attQuery = attQuery.in('worker_id', workerIds);
        } else if (tenantId) {
          attQuery = attQuery.eq('user_id', tenantId);
        }

        const { data: attData } = await attQuery;

        // 3. 作業日報ログの取得
        let workQuery = supabase
          .from('work_logs')
          .select('*, crops(name), fields(name)')
          .eq('work_date', dateStr);

        if (tenantId) {
          workQuery = workQuery.eq('user_id', tenantId);
        }

        const { data: workData } = await workQuery;

        if (attData) setAttendanceLogs(attData);
        if (workData) setWorkLogs(workData);
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
        .update({ total_break_minutes: editBreakMinutes, actual_rest_minutes: editBreakMinutes })
        .eq('id', id);
      if (error) throw error;
      
      setAttendanceLogs(prev => prev.map(log => log.id === id ? { ...log, total_break_minutes: editBreakMinutes, actual_rest_minutes: editBreakMinutes } : log));
      setEditingLogId(null);
    } catch(err) {
      alert('保存に失敗しました');
    } finally {
      setIsSaving(false);
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
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/portal" className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-700" title="ポータルへ戻る">
                <ArrowRight className="w-5 h-5 rotate-180" />
              </Link>
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <span className="font-black text-xl text-slate-800">勤怠・日報突合ダッシュボード</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm font-bold text-slate-500">本日: {getJSTDate()}</div>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-8">
          
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
              <CalendarIcon className="w-6 h-6 text-blue-500" /> 本日の出退勤状況
            </h1>
            <div className="text-xs font-bold text-slate-400">
              打刻時間と現場作業日報の自動突合
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-500">
                    <th className="p-4">スタッフ</th>
                    <th className="p-4">出勤 / 退勤</th>
                    <th className="p-4">天気・気温</th>
                    <th className="p-4">休憩時間</th>
                    <th className="p-4">総労働 / 登録作業</th>
                    <th className="p-4 text-center">作業差分</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendanceLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 font-bold">
                        本日の出勤記録はまだありません
                      </td>
                    </tr>
                  ) : (
                    attendanceLogs.map(log => {
                      const worker = workers.find(w => w.id === log.worker_id);
                      const workerName = worker?.name || (log.worker_id ? `${log.worker_id.substring(0, 8)}...` : '不明スタッフ');

                      // 総労働時間の計算（出勤〜退勤 - 休憩）
                      const totalMins = calculateTotalMinutes(log.clock_in, log.clock_out, log.date);
                      const breakMins = log.total_break_minutes || 0;
                      const netWorkMins = Math.max(0, totalMins - breakMins);

                      // 作業記録の合計時間の計算
                      const myWorkLogs = workLogs.filter(w => w.worker_id === log.worker_id);
                      const totalWorkLogMins = myWorkLogs.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);
                      
                      // 差分（入力漏れの可能性）
                      const diffMins = Math.abs(netWorkMins - totalWorkLogMins);

                      return (
                        <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-black">
                                {worker?.name ? worker.name.charAt(0) : '員'}
                              </div>
                              <div className="font-bold text-slate-700 text-sm">
                                {workerName}
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-slate-800 text-sm">
                              {log.clock_in ? formatDisplayTime(log.clock_in) : '--:--'}
                              <span className="text-slate-400 font-normal mx-2">〜</span>
                              {log.clock_out ? formatDisplayTime(log.clock_out) : <span className="text-emerald-500 font-bold">勤務中</span>}
                            </div>
                          </td>
                          <td className="p-4">
                            {log.weather ? (
                              <div className="flex items-center gap-1.5 text-sm font-bold text-slate-600">
                                {log.weather === '晴れ' ? <Sun className="w-4 h-4 text-amber-500" /> : <CloudRain className="w-4 h-4 text-blue-500" />}
                                {log.weather} ({log.temperature}℃)
                              </div>
                            ) : <span className="text-slate-300">-</span>}
                          </td>
                          <td className="p-4">
                            {editingLogId === log.id ? (
                              <div className="flex items-center gap-2">
                                <input 
                                  type="number" 
                                  value={editBreakMinutes}
                                  onChange={e => setEditBreakMinutes(Number(e.target.value))}
                                  className="w-20 px-2 py-1 border border-blue-500 rounded text-right font-bold text-sm"
                                />
                                <span className="text-sm font-bold text-slate-500">分</span>
                                <button onClick={() => handleSaveBreak(log.id)} disabled={isSaving} className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600"><Save className="w-4 h-4" /></button>
                              </div>
                            ) : (
                              <div 
                                className="font-bold text-blue-600 cursor-pointer hover:bg-blue-50 inline-flex items-center gap-1 px-2 py-1 rounded text-sm"
                                onClick={() => { setEditingLogId(log.id); setEditBreakMinutes(breakMins); }}
                                title="クリックして休憩時間を変更"
                              >
                                <Coffee className="w-4 h-4" /> {breakMins} 分
                              </div>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="text-sm">
                              <span className="font-black text-slate-700">{Math.floor(netWorkMins/60)}h {netWorkMins%60}m</span>
                              <span className="text-slate-400 mx-2">/</span>
                              <span className="font-bold text-emerald-600">{Math.floor(totalWorkLogMins/60)}h {totalWorkLogMins%60}m</span>
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            {log.clock_out && diffMins > 30 ? (
                              <div className="inline-flex items-center gap-1 bg-rose-50 text-rose-600 px-2 py-1 rounded-lg text-xs font-bold border border-rose-100" title="作業記録の入力漏れの可能性があります">
                                <AlertCircle className="w-3 h-3" />
                                {diffMins} 分の乖離
                              </div>
                            ) : log.clock_out ? (
                              <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg text-xs font-bold border border-emerald-100">
                                <ShieldCheck className="w-3 h-3" /> 一致
                              </div>
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
