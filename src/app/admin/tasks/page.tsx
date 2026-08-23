"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Calendar, CheckCircle2, Clock, MapPin, Sprout, Loader2, Plus, Trash2, Edit2, Users, Briefcase, X } from 'lucide-react';
import { HelpTooltip } from '@/components/HelpTooltip';

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [crops, setCrops] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string>('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<any>({
    work_date: new Date().toISOString().split('T')[0],
    task_title: '',
    crop_id: '',
    field_id: '',
    worker_id: '',
    department_id: ''
  });

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const userTenantId = session.user.id;
      setTenantId(userTenantId);

      const [taskRes, cRes, fRes, wRes, dRes] = await Promise.all([
        supabase.from('work_logs').select(`
          id, work_date, task_title, status, approval_status, duration_minutes,
          crops(name), fields(name), workers(name), departments(name)
        `).eq('user_id', userTenantId).eq('status', 'planned').order('work_date', { ascending: true }),
        supabase.from('crops').select('*').order('name'),
        supabase.from('fields').select('*').order('name'),
        supabase.from('workers').select('*').order('name'),
        supabase.from('departments').select('*').order('name'),
      ]);

      setTasks(taskRes.data || []);
      setCrops(cRes.data || []);
      setFields(fRes.data || []);
      setWorkers(wRes.data || []);
      setDepartments(dRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    if (!formData.task_title) {
      alert("タスク名を入力してください");
      return;
    }
    try {
      setIsSaving(true);
      const insertData = {
        user_id: tenantId,
        work_date: formData.work_date,
        task_title: formData.task_title,
        work_type: formData.task_title,
        crop_id: formData.crop_id || null,
        field_id: formData.field_id || null,
        worker_id: formData.worker_id || null,
        department_id: formData.department_id || null,
        status: 'planned',
        duration_minutes: 0,
        approval_status: 'pending' // 着手前はpending扱い、またはnull
      };
      
      const { error } = await supabase.from('work_logs').insert(insertData);
      if (error) throw error;

      setIsModalOpen(false);
      setFormData({
        work_date: new Date().toISOString().split('T')[0],
        task_title: '',
        crop_id: '',
        field_id: '',
        worker_id: '',
        department_id: ''
      });
      fetchData();
    } catch (err: any) {
      alert(`エラー: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('このタスクを削除しますか？')) return;
    try {
      const { error } = await supabase.from('work_logs').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      alert(`削除エラー: ${err.message}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Calendar className="w-7 h-7 text-emerald-600" />
            タスク・スケジュール管理
          </h1>
          <p className="text-slate-500 font-medium mt-1">現場に指示する作業タスク（予定）を作成し、担当者や部署に割り当てます。</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          新しいタスクを追加
        </button>
      </header>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-800">登録済みのタスク（予定）</h2>
        </div>
        <div className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12 text-slate-400">現在予定されているタスクはありません</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 font-bold">
                  <tr>
                    <th className="px-6 py-4">予定日</th>
                    <th className="px-6 py-4">タスク内容</th>
                    <th className="px-6 py-4">割り当て</th>
                    <th className="px-6 py-4">圃場 / 作目</th>
                    <th className="px-6 py-4">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {tasks.map(t => (
                    <tr key={t.id} className="hover:bg-emerald-50/30 transition-colors">
                      <td className="px-6 py-4">{t.work_date}</td>
                      <td className="px-6 py-4 font-bold text-slate-900">{t.task_title || '-'}</td>
                      <td className="px-6 py-4 flex items-center gap-2">
                        {t.departments ? (
                          <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-1 rounded-md text-xs">
                            <Briefcase className="w-3 h-3" /> {t.departments.name}
                          </span>
                        ) : null}
                        {t.workers ? (
                          <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md text-xs">
                            <Users className="w-3 h-3" /> {t.workers.name}
                          </span>
                        ) : null}
                        {!t.departments && !t.workers && <span className="text-slate-400">全体</span>}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {t.fields ? <span className="mr-2">📍{t.fields.name}</span> : null}
                        {t.crops ? <span>🌱{t.crops.name}</span> : null}
                      </td>
                      <td className="px-6 py-4">
                        <button onClick={() => handleDelete(t.id)} className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-emerald-50/50">
              <h3 className="text-lg font-black text-emerald-800 flex items-center gap-2">
                <Plus className="w-5 h-5" />
                新規タスクの作成
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">予定日 <span className="text-rose-500">*</span></label>
                <input 
                  type="date" 
                  value={formData.work_date} 
                  onChange={e => setFormData({...formData, work_date: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">タスク内容 <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  value={formData.task_title} 
                  onChange={e => setFormData({...formData, task_title: e.target.value})}
                  placeholder="例: キャベツの収穫、A棟の追肥"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">対象の作目</label>
                  <select value={formData.crop_id} onChange={e => setFormData({...formData, crop_id: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold">
                    <option value="">(指定なし)</option>
                    {crops.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">対象の圃場</label>
                  <select value={formData.field_id} onChange={e => setFormData({...formData, field_id: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold">
                    <option value="">(指定なし)</option>
                    {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">担当部署</label>
                  <select value={formData.department_id} onChange={e => setFormData({...formData, department_id: e.target.value})} className="w-full p-2 bg-white border border-slate-200 rounded-lg font-bold">
                    <option value="">(全員)</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">担当者（個人指名）</label>
                  <select value={formData.worker_id} onChange={e => setFormData({...formData, worker_id: e.target.value})} className="w-full p-2 bg-white border border-slate-200 rounded-lg font-bold">
                    <option value="">(指名なし)</option>
                    {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 flex gap-3">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 font-bold bg-white border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50">
                キャンセル
              </button>
              <button onClick={handleSave} disabled={isSaving} className="flex-1 py-3 font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 flex items-center justify-center gap-2">
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'タスクを保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
