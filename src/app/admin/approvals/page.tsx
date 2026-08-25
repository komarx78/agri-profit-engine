"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Calendar, CheckCircle2, Clock, MapPin, Sprout, Loader2, Plus, Trash2, Edit2, Users, Briefcase, Inbox, XCircle, FileText } from 'lucide-react';
import { AdminOnlyGuard } from '@/components/AdminOnlyGuard';

export default function ApprovalsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string>('');

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const userTenantId = session ? session.user.id : (localStorage.getItem('agri_owner_id') || '');
      if (!userTenantId) {
        setIsLoading(false);
        return;
      }
      setTenantId(userTenantId);

      // 現場から上がってきた作業完了報告（status: completed かつ approval_status: pending）を取得
      const { data, error } = await supabase.from('work_logs').select(`
        id, work_date, task_title, duration_minutes, created_at, status, approval_status,
        crops(name), fields(name), workers(name), departments(name)
      `)
      .eq('user_id', userTenantId)
      .eq('status', 'completed')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase.from('work_logs').update({
        approval_status: newStatus
      }).eq('id', id);
      
      if (error) throw error;
      
      // リストから消す（再取得）
      fetchData();
    } catch (err: any) {
      alert(`エラー: ${err.message}`);
    }
  };

  return (
    <AdminOnlyGuard>
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
              <Inbox className="w-7 h-7 text-blue-600" />
              承認インボックス
            </h1>
            <p className="text-slate-500 font-medium mt-1">現場から上がってきた作業完了報告を確認し、承認・差し戻しを行います。</p>
          </div>
          <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 border border-blue-100">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            承認待ち: {logs.length}件
          </div>
        </header>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
        ) : logs.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-700">承認待ちの報告はありません</h3>
            <p className="text-slate-400 mt-1">すべての報告が処理されています。</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {logs.map(log => (
              <div key={log.id} className="p-6 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-6">
                
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded-md">承認待ち</span>
                    <span className="text-sm font-bold text-slate-500">{log.work_date}</span>
                    {log.departments && (
                      <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                        <Briefcase className="w-3 h-3" /> {log.departments.name}
                      </span>
                    )}
                    {log.workers && (
                      <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                        <Users className="w-3 h-3" /> {log.workers.name}
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-slate-400" />
                    {log.task_title || '一般作業報告'}
                  </h3>
                  
                  <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-slate-500">
                    {log.fields && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {log.fields.name}</span>}
                    {log.crops && <span className="flex items-center gap-1"><Sprout className="w-4 h-4" /> {log.crops.name}</span>}
                    <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {log.duration_minutes} 分</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button 
                    onClick={() => handleUpdateStatus(log.id, 'rejected')}
                    className="px-4 py-2.5 text-rose-600 font-bold bg-white border border-rose-200 hover:bg-rose-50 rounded-xl flex items-center gap-2 transition-colors"
                  >
                    <XCircle className="w-4 h-4" /> 差し戻し
                  </button>
                  <button 
                    onClick={() => handleUpdateStatus(log.id, 'approved')}
                    className="px-6 py-2.5 text-white font-bold bg-blue-600 hover:bg-blue-500 shadow-sm rounded-xl flex items-center gap-2 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" /> 承認する
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </AdminOnlyGuard>
  );
}
