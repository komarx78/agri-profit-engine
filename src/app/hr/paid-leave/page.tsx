"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Coffee, Download, Users, Loader2, AlertCircle, CheckCircle, XCircle, Plus, Calendar } from 'lucide-react';

export default function PaidLeavePage() {
  const [workers, setWorkers] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'balance' | 'requests'>('balance');

  // モーダル用
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<any>(null);

  // 申請フォーム用
  const [requestForm, setRequestForm] = useState({
    worker_id: '',
    type: '有給休暇',
    start_date: '',
    end_date: '',
    reason: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 農業システム側は farms テーブルが拠点となっているため farm_id を取得するか、
      // ひとまず会社設定を基準とする。
      const { data: cData } = await supabase.from('company_settings').select('id').limit(1).single();
      const companyId = cData?.id;

      // ワーカー（有給残日数等）の取得
      const { data: wData } = await supabase.from('workers').select('*').order('name');
      if (wData) setWorkers(wData);

      // 休暇申請履歴の取得
      const { data: reqData } = await supabase
        .from('leave_requests')
        .select('*, workers(name)')
        .order('created_at', { ascending: false });
      if (reqData) setLeaveRequests(reqData);

    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // 承認・却下処理
  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
      
      // 再取得して画面更新（トリガーによる残日数減算も反映させるため）
      fetchData();
    } catch (err) {
      console.error(err);
      alert('ステータスの更新に失敗しました。');
    }
  };

  // 休暇申請（代理申請）の送信
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('leave_requests').insert([{
        worker_id: requestForm.worker_id,
        type: requestForm.type,
        start_date: requestForm.start_date,
        end_date: requestForm.end_date,
        reason: requestForm.reason,
        status: '承認' // 管理者による代理入力なので即承認とする
      }]);
      if (error) throw error;
      
      setIsRequestModalOpen(false);
      setRequestForm({ worker_id: '', type: '有給休暇', start_date: '', end_date: '', reason: '' });
      fetchData();
    } catch (err) {
      console.error(err);
      alert('申請に失敗しました。DBのカラム(leave_requests)が存在するか確認してください。');
    }
  };

  // 残日数の手動修正
  const handleSaveBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorker) return;
    try {
      const { error } = await supabase.from('workers').update({
        paid_leave_carryover: editingWorker.paid_leave_carryover,
        paid_leave_balance: editingWorker.paid_leave_balance,
        join_date: editingWorker.join_date,
        employment_type: editingWorker.employment_type
      }).eq('id', editingWorker.id);
      
      if (error) throw error;
      
      setIsEditModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('保存に失敗しました。DBのカラム(paid_leave_carryover等)が存在するか確認してください。');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Coffee className="w-6 h-6 text-amber-500" />
            有給・休暇管理
          </h1>
          <p className="text-sm font-bold text-slate-500 mt-1">
            従業員の有給残日数の管理と、休暇申請の承認を行います。
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-slate-200 p-1 rounded-xl flex items-center">
            <button 
              onClick={() => setActiveTab('balance')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'balance' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              残日数管理
            </button>
            <button 
              onClick={() => setActiveTab('requests')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'requests' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              休暇申請・承認
            </button>
          </div>
          {activeTab === 'requests' && (
            <button 
              onClick={() => setIsRequestModalOpen(true)}
              className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-amber-600 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> 代理申請
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
        {isLoading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
        ) : (
          <>
            {/* タブ1: 残日数管理 */}
            {activeTab === 'balance' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-amber-50 border-b border-amber-100 text-sm font-bold text-amber-800">
                      <th className="p-4">従業員名</th>
                      <th className="p-4">雇用形態</th>
                      <th className="p-4">入社日</th>
                      <th className="p-4 text-center">前年度繰越</th>
                      <th className="p-4 text-center">今年度付与</th>
                      <th className="p-4 text-center">現在残日数合計</th>
                      <th className="p-4 text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {workers.map((emp: any) => {
                      const carryover = emp.paid_leave_carryover || 0;
                      const balance = emp.paid_leave_balance || 0;
                      const total = Number(carryover) + Number(balance);
                      
                      return (
                        <tr key={emp.id} className="hover:bg-slate-50">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center">
                                <Users className="w-4 h-4" />
                              </div>
                              <span className="font-bold text-slate-700">{emp.name}</span>
                            </div>
                          </td>
                          <td className="p-4 text-sm font-bold text-slate-600">
                            {emp.employment_type || '未設定'}
                          </td>
                          <td className="p-4 text-sm font-bold text-slate-600">{emp.join_date || '未設定'}</td>
                          <td className="p-4 text-center font-bold text-slate-500">{carryover} 日</td>
                          <td className="p-4 text-center font-bold text-emerald-600">{balance} 日</td>
                          <td className="p-4 text-center font-black text-amber-600 text-lg">{total} 日</td>
                          <td className="p-4 text-center">
                            <button 
                              onClick={() => { setEditingWorker(emp); setIsEditModalOpen(true); }}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-lg transition-colors"
                            >
                              編集
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* タブ2: 休暇申請・承認 */}
            {activeTab === 'requests' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-500">
                      <th className="p-4">申請日</th>
                      <th className="p-4">従業員名</th>
                      <th className="p-4">種別</th>
                      <th className="p-4">期間 (日付)</th>
                      <th className="p-4">理由・備考</th>
                      <th className="p-4 text-center">ステータス</th>
                      <th className="p-4 text-center">アクション</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leaveRequests.length === 0 && (
                      <tr><td colSpan={7} className="p-8 text-center text-slate-400 font-bold">申請履歴はありません</td></tr>
                    )}
                    {leaveRequests.map((req: any) => (
                      <tr key={req.id} className="hover:bg-slate-50 group">
                        <td className="p-4 text-sm font-bold text-slate-500">
                          {new Date(req.created_at).toLocaleDateString('ja-JP')}
                        </td>
                        <td className="p-4 font-bold text-slate-800">{req.workers?.name || '不明'}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                            req.type === '有給休暇' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {req.type}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-blue-600 text-sm flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {req.start_date} {req.end_date !== req.start_date ? `〜 ${req.end_date}` : ''}
                        </td>
                        <td className="p-4 text-sm text-slate-600">{req.reason || '-'}</td>
                        <td className="p-4 text-center">
                          {req.status === '申請中' && <span className="text-amber-500 font-bold text-sm">申請中</span>}
                          {req.status === '承認' && <span className="text-emerald-500 font-bold text-sm">承認済</span>}
                          {req.status === '却下' && <span className="text-rose-500 font-bold text-sm">却下</span>}
                        </td>
                        <td className="p-4 text-center">
                          {req.status === '申請中' ? (
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => handleUpdateStatus(req.id, '承認')} className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg" title="承認"><CheckCircle className="w-5 h-5" /></button>
                              <button onClick={() => handleUpdateStatus(req.id, '却下')} className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg" title="却下"><XCircle className="w-5 h-5" /></button>
                            </div>
                          ) : (
                            <span className="text-slate-300 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* 代理申請モーダル */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-black text-slate-800">休暇の代理申請</h3>
              <button onClick={() => setIsRequestModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmitRequest} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">対象従業員</label>
                <select required value={requestForm.worker_id} onChange={e => setRequestForm({...requestForm, worker_id: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold">
                  <option value="">選択してください</option>
                  {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">休暇種別</label>
                <select value={requestForm.type} onChange={e => setRequestForm({...requestForm, type: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold">
                  <option value="有給休暇">有給休暇</option>
                  <option value="欠勤">欠勤</option>
                  <option value="特別休暇">特別休暇</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">開始日</label>
                  <input type="date" required value={requestForm.start_date} onChange={e => setRequestForm({...requestForm, start_date: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl font-bold" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">終了日</label>
                  <input type="date" required value={requestForm.end_date} onChange={e => setRequestForm({...requestForm, end_date: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl font-bold" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">理由・備考</label>
                <input type="text" value={requestForm.reason} onChange={e => setRequestForm({...requestForm, reason: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl font-bold" placeholder="私用のため等" />
              </div>
              <button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-colors mt-2">
                登録する（即時承認）
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 残日数編集モーダル */}
      {isEditModalOpen && editingWorker && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-black text-slate-800">{editingWorker.name} の設定・残日数</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveBalance} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">雇用形態</label>
                  <select value={editingWorker.employment_type || ''} onChange={e => setEditingWorker({...editingWorker, employment_type: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg font-bold">
                    <option value="正社員">正社員</option>
                    <option value="パート">パート</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">入社日</label>
                  <input type="date" value={editingWorker.join_date || ''} onChange={e => setEditingWorker({...editingWorker, join_date: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg font-bold" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">前年度繰越 (日)</label>
                  <input type="number" step="0.5" value={editingWorker.paid_leave_carryover || 0} onChange={e => setEditingWorker({...editingWorker, paid_leave_carryover: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-right font-bold" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">今年度付与 (日)</label>
                  <input type="number" step="0.5" value={editingWorker.paid_leave_balance || 0} onChange={e => setEditingWorker({...editingWorker, paid_leave_balance: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-right font-bold" />
                </div>
              </div>
              <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl transition-colors mt-4">
                保存する
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
