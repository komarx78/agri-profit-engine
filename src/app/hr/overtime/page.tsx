"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId, getTenantWorkerIds } from '@/lib/tenant';
import { Clock, CheckCircle2, XCircle, Search, Calendar, FileText } from 'lucide-react';
import { AdminOnlyGuard } from '@/components/AdminOnlyGuard';

export default function OvertimeApprovalPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) {
        setLoading(false);
        return;
      }
      const workerIds = await getTenantWorkerIds(tenantId);
      if (workerIds.length === 0) {
        setRequests([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('overtime_requests')
        .select(`
          *,
          workers ( name )
        `)
        .in('worker_id', workerIds)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      if (data) setRequests(data);
    } catch (err) {
      console.error(err);
      alert('データ取得エラー');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: 'approved' | 'rejected') => {
    if (!window.confirm(`この申請を${newStatus === 'approved' ? '承認' : '却下'}しますか？`)) return;
    setIsProcessing(id);
    try {
      const tenantId = await getCurrentTenantId();
      const workerIds = tenantId ? await getTenantWorkerIds(tenantId) : [];

      let query = supabase
        .from('overtime_requests')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (workerIds.length > 0) {
        query = query.in('worker_id', workerIds);
      }

      const { error } = await query;

      if (error) throw error;
      
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
    } catch (err) {
      console.error(err);
      alert('ステータスの更新に失敗しました');
    } finally {
      setIsProcessing(null);
    }
  };

  const filteredRequests = requests.filter(r => r.status === statusFilter);

  return (
    <AdminOnlyGuard>
      <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Clock className="w-6 h-6 text-amber-500" />
            残業申請の管理・承認
          </h1>
          <p className="text-sm font-bold text-slate-500 mt-1">
            従業員から上がってきた残業申請（終了予定時刻）を確認し、承認・却下を行います。
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* フィルタータブ */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setStatusFilter('pending')}
            className={`flex-1 py-4 font-bold text-sm transition-colors relative ${
              statusFilter === 'pending' ? 'text-amber-600 bg-amber-50/50' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            未対応（承認待ち）
            {requests.filter(r => r.status === 'pending').length > 0 && (
              <span className="ml-2 bg-rose-500 text-white text-xs px-2 py-0.5 rounded-full">
                {requests.filter(r => r.status === 'pending').length}
              </span>
            )}
            {statusFilter === 'pending' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-500" />}
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`flex-1 py-4 font-bold text-sm transition-colors relative ${
              statusFilter === 'approved' ? 'text-emerald-600 bg-emerald-50/50' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            承認済み
            {statusFilter === 'approved' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500" />}
          </button>
          <button
            onClick={() => setStatusFilter('rejected')}
            className={`flex-1 py-4 font-bold text-sm transition-colors relative ${
              statusFilter === 'rejected' ? 'text-rose-600 bg-rose-50/50' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            却下
            {statusFilter === 'rejected' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-rose-500" />}
          </button>
        </div>

        {/* 一覧 */}
        <div className="p-4 sm:p-6">
          {loading ? (
            <div className="text-center py-12 text-slate-400 font-bold">読み込み中...</div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-12 text-slate-400 font-bold flex flex-col items-center">
              <FileText className="w-12 h-12 text-slate-200 mb-3" />
              該当する申請はありません
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRequests.map(req => (
                <div key={req.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="bg-white border border-slate-200 text-slate-600 px-3 py-1 rounded-lg text-sm font-black flex items-center gap-1.5 shadow-sm">
                        <Calendar className="w-4 h-4 text-blue-500" />
                        {req.date}
                      </span>
                      <span className="text-lg font-black text-slate-800">
                        {req.workers?.name || '不明な従業員'}
                      </span>
                    </div>
                    
                    <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm mt-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-bold text-slate-600">残業予定（終了時刻）:</span>
                        <span className="text-base font-black text-amber-600">
                          {req.scheduled_end_time.substring(0, 5)}
                        </span>
                      </div>
                      <div className="text-sm text-slate-700 font-bold mt-2 pt-2 border-t border-slate-100">
                        <span className="text-slate-400 text-xs block mb-0.5">申請理由・作業内容</span>
                        {req.reason || '理由の記載なし'}
                      </div>
                    </div>
                  </div>

                  {statusFilter === 'pending' && (
                    <div className="flex sm:flex-col gap-2 pt-2 sm:pt-0 border-t border-slate-200 sm:border-t-0 sm:border-l sm:pl-5 w-full sm:w-auto">
                      <button
                        onClick={() => handleUpdateStatus(req.id, 'approved')}
                        disabled={isProcessing === req.id}
                        className="flex-1 sm:flex-none py-2.5 px-6 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-5 h-5" /> 承認
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(req.id, 'rejected')}
                        disabled={isProcessing === req.id}
                        className="flex-1 sm:flex-none py-2.5 px-6 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <XCircle className="w-5 h-5" /> 却下
                      </button>
                    </div>
                  )}

                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    </AdminOnlyGuard>
  );
}
