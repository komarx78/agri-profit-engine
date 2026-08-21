"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Clock, Users, Calendar as CalendarIcon, Coffee, Sun, CloudRain, ShieldCheck, ArrowRight, Save, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function HrDashboardPage() {
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [workLogs, setWorkLogs] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
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
        const today = new Date();
        today.setHours(today.getHours() + 9);
        const dateStr = today.toISOString().split('T')[0];

        // 従業員マスタ取得 (仮に authentication の users テーブルか、company_users 等とするが、ここでは attendance_logs の uuid から推測するか、別途テーブルがないので直接取得)
        // とりあえず attendance_logs と work_logs を JOIN して取得
        const { data: attData } = await supabase
          .from('attendance_logs')
          .select('*')
          .eq('date', dateStr)
          .order('clock_in', { ascending: false });

        const { data: workData } = await supabase
          .from('work_logs')
          .select('*, crops(name), fields(name)')
          .eq('work_date', dateStr);

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
        .update({ total_break_minutes: editBreakMinutes })
        .eq('id', id);
      if (error) throw error;
      
      setAttendanceLogs(prev => prev.map(log => log.id === id ? { ...log, total_break_minutes: editBreakMinutes } : log));
      setEditingLogId(null);
    } catch(err) {
      alert('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkSaveBreak = async () => {
    if (attendanceLogs.length === 0) return;
    if (!confirm(`本日の出勤者全員の休憩時間を一括で ${bulkBreakMinutes} 分に変更します。よろしいですか？`)) return;

    setIsBulkSaving(true);
    try {
      const ids = attendanceLogs.map(l => l.id);
      
      const { error } = await supabase
        .from('attendance_logs')
        .update({ total_break_minutes: bulkBreakMinutes })
        .in('id', ids);

      if (error) throw error;
      
      setAttendanceLogs(prev => prev.map(log => ({ ...log, total_break_minutes: bulkBreakMinutes })));
      alert('全員の休憩時間を一括変更しました。');
    } catch(err) {
      console.error(err);
      alert('一括保存に失敗しました');
    } finally {
      setIsBulkSaving(false);
    }
  };

  const calculateTotalMinutes = (start?: string, end?: string) => {
    if (!start || !end) return 0;
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return Math.floor(diff / 1000 / 60);
  };

  if (isLoading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-700">
              <ArrowRight className="w-5 h-5 rotate-180" />
            </Link>
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-xl text-slate-800">勤怠・有給管理</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-bold text-slate-500">本日: {new Date().toLocaleDateString('ja-JP')}</div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-blue-500" /> 本日の出退勤状況
          </h1>

          <div className="flex items-center gap-3 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm self-start md:self-auto">
            <span className="text-sm font-bold text-slate-600 flex items-center gap-1">
              <Users className="w-4 h-4 text-blue-500" /> 全員一括
            </span>
            <div className="flex items-center gap-1">
              <input 
                type="number"
                value={bulkBreakMinutes}
                onChange={e => setBulkBreakMinutes(Number(e.target.value))}
                className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-right font-bold text-slate-700 focus:border-blue-500 focus:outline-none"
              />
              <span className="text-sm font-bold text-slate-500">分</span>
            </div>
            <button
              onClick={handleBulkSaveBreak}
              disabled={isBulkSaving || attendanceLogs.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors disabled:opacity-50 ml-2"
            >
              {isBulkSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              適用
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-500">
                  <th className="p-4">従業員ID (仮)</th>
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
                    // 総労働時間の計算（出勤〜退勤 - 休憩）
                    const totalMins = calculateTotalMinutes(log.clock_in, log.clock_out);
                    const netWorkMins = Math.max(0, totalMins - (log.total_break_minutes || 0));

                    // 作業記録の合計時間の計算
                    const myWorkLogs = workLogs.filter(w => w.worker_id === log.worker_id);
                    const totalWorkLogMins = myWorkLogs.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);
                    
                    // 差分（入力漏れの可能性）
                    const diffMins = netWorkMins - totalWorkLogMins;

                    return (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="p-4">
                          <div className="font-bold text-slate-700 text-sm truncate w-24" title={log.worker_id}>
                            {log.worker_id.substring(0, 8)}...
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-slate-800">
                            {log.clock_in ? new Date(log.clock_in).toLocaleTimeString('ja-JP', {hour: '2-digit', minute:'2-digit'}) : '--:--'}
                            <span className="text-slate-400 font-normal mx-2">〜</span>
                            {log.clock_out ? new Date(log.clock_out).toLocaleTimeString('ja-JP', {hour: '2-digit', minute:'2-digit'}) : '勤務中'}
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
                                className="w-20 px-2 py-1 border border-blue-500 rounded text-right font-bold"
                              />
                              <span className="text-sm font-bold text-slate-500">分</span>
                              <button onClick={() => handleSaveBreak(log.id)} disabled={isSaving} className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600"><Save className="w-4 h-4" /></button>
                            </div>
                          ) : (
                            <div 
                              className="font-bold text-blue-600 cursor-pointer hover:bg-blue-50 inline-flex items-center gap-1 px-2 py-1 rounded"
                              onClick={() => { setEditingLogId(log.id); setEditBreakMinutes(log.total_break_minutes || 0); }}
                              title="クリックして一括変更"
                            >
                              <Coffee className="w-4 h-4" /> {log.total_break_minutes || 0} 分
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
  );
}
