
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Calendar, CheckCircle2, Clock, MapPin, Sprout, Loader2, Plus, Trash2, Edit2, Users, Briefcase, X, List, LayoutGrid, ChevronLeft, ChevronRight } from 'lucide-react';

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
    worker_ids: [] as string[],
    department_id: ''
  });

  // UI State
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [groupMode, setGroupMode] = useState<'worker' | 'field'>('field');
  const [calendarDays, setCalendarDays] = useState<number>(7); // 2 = Today/Tomorrow, 7 = Week
  const [startDate, setStartDate] = useState(new Date());

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const ownerId = session.user.id;
        setTenantId(ownerId);

        const [tasksRes, cropsRes, fieldsRes, workersRes, deptsRes] = await Promise.all([
          supabase.from('work_tasks').select('*, crops(*), fields(*), workers(*), departments(*)').eq('tenant_id', ownerId).order('work_date', { ascending: true }),
          supabase.from('crops').select('*').eq('tenant_id', ownerId),
          supabase.from('fields').select('*').eq('tenant_id', ownerId),
          supabase.from('workers').select('*').eq('user_id', ownerId).order('name'),
          supabase.from('departments').select('*').eq('tenant_id', ownerId)
        ]);

        if (tasksRes.data) setTasks(tasksRes.data);
        if (cropsRes.data) setCrops(cropsRes.data);
        if (fieldsRes.data) setFields(fieldsRes.data);
        if (workersRes.data) setWorkers(workersRes.data);
        if (deptsRes.data) setDepartments(deptsRes.data);

      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleSave = async () => {
    if (!formData.work_date || !formData.task_title) return;
    setIsSaving(true);
    try {
      const dataToSave = {
        ...formData,
        tenant_id: tenantId,
        crop_id: formData.crop_id || null,
        field_id: formData.field_id || null,
        worker_id: formData.worker_id || null,
        department_id: formData.department_id || null
      };

      const { data, error } = await supabase.from('work_tasks').insert([dataToSave]).select('*, crops(*), fields(*), workers(*), departments(*)');
      if (error) throw error;
      if (data) setTasks([...tasks, data[0]].sort((a, b) => a.work_date.localeCompare(b.work_date)));
      setIsModalOpen(false);
      setFormData({ work_date: new Date().toISOString().split('T')[0], task_title: '', crop_id: '', field_id: '', worker_id: '', worker_ids: [], department_id: '' });
    } catch (err) {
      console.error(err);
      alert('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('本当に削除しますか？')) return;
    try {
      await supabase.from('work_tasks').delete().eq('id', id);
      setTasks(tasks.filter(t => t.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenModal = (dateStr?: string, workerId?: string, fieldId?: string) => {
    setFormData({
      work_date: dateStr || new Date().toISOString().split('T')[0],
      task_title: '',
      crop_id: '',
      field_id: fieldId || '',
      worker_id: workerId || '',
      worker_ids: workerId ? [workerId] : [],
      department_id: ''
    });
    setIsModalOpen(true);
  };

  // Calendar Logic
  const dates = useMemo(() => {
    const arr = [];
    for (let i = 0; i < calendarDays; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [startDate, calendarDays]);

  const handlePrev = () => {
    const d = new Date(startDate);
    d.setDate(d.getDate() - calendarDays);
    setStartDate(d);
  };
  
  const handleNext = () => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + calendarDays);
    setStartDate(d);
  };

  const handleToday = () => {
    setStartDate(new Date());
  };

  const getWeekDayStr = (d: Date) => ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];

  // グループ化されたデータ (Worker or Field)
  const groupedItems = useMemo(() => {
    if (groupMode === 'worker') {
      const items = [...workers];
      items.push({ id: 'unassigned', name: '(担当者未定 / 全員)' });
      return items;
    } else {
      const items = [...fields];
      items.push({ id: 'unassigned', name: '(圃場指定なし)' });
      return items;
    }
  }, [workers, fields, groupMode]);

  return (
    <div className="max-w-[95vw] mx-auto space-y-6 pb-12 relative">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2 md:gap-3">
            <Calendar className="w-6 h-6 md:w-8 md:h-8 text-emerald-600 flex-shrink-0" />
            タスク・スケジュール管理
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-2 font-medium">誰がどこで何の作業をするか、日々のスケジュールを管理します。</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 md:gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setViewMode('calendar')} 
              className={`px-3 py-1.5 text-sm font-bold rounded-lg flex items-center gap-2 transition-all ${viewMode === 'calendar' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
            >
              <LayoutGrid className="w-4 h-4" /> カレンダー
            </button>
            <button 
              onClick={() => setViewMode('list')} 
              className={`px-3 py-1.5 text-sm font-bold rounded-lg flex items-center gap-2 transition-all ${viewMode === 'list' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
            >
              <List className="w-4 h-4" /> リスト
            </button>
          </div>
          
          <button 
            onClick={() => handleOpenModal()}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition-colors shadow-sm text-sm"
          >
            <Plus className="w-4 h-4" />
            新規追加
          </button>
        </div>
      </header>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center p-20">
            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
          </div>
        ) : viewMode === 'list' ? (
          // リストビュー (既存)
          <div className="p-0">
            {tasks.length === 0 ? (
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
                          {t.departments && (
                            <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-1 rounded-md text-xs">
                              <Briefcase className="w-3 h-3" /> {t.departments.name}
                            </span>
                          )}
                          {t.workers && (
                            <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md text-xs">
                              <Users className="w-3 h-3" /> {t.workers.name}
                            </span>
                          )}
                          {!t.departments && !t.workers && <span className="text-slate-400">全体</span>}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {t.fields && <span className="mr-2">📍{t.fields.name}</span>}
                          {t.crops && <span>🌱{t.crops.name}</span>}
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
        ) : (
          // カレンダー（マトリックス）ビュー
          <div className="flex flex-col">
            <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <button onClick={handlePrev} className="p-2 hover:bg-slate-100 transition-colors"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
                <button onClick={handleToday} className="px-4 font-black text-slate-700 hover:bg-slate-50 text-sm">今日</button>
                <button onClick={handleNext} className="p-2 hover:bg-slate-100 transition-colors"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">表示単位:</span>
                  <select 
                    value={calendarDays} 
                    onChange={e => setCalendarDays(Number(e.target.value))}
                    className="text-sm font-bold bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none"
                  >
                    <option value={2}>今日・明日 (2日)</option>
                    <option value={7}>週間 (7日)</option>
                    <option value={14}>2週間 (14日)</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">グループ:</span>
                  <select 
                    value={groupMode} 
                    onChange={e => setGroupMode(e.target.value as 'worker'|'field')}
                    className="text-sm font-bold bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none"
                  >
                    <option value="worker">担当者別</option>
                    <option value="field">圃場別</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto relative">
              <table className="w-full text-sm text-left whitespace-nowrap min-w-[800px] border-collapse">
                <thead className="text-xs text-slate-700 bg-slate-50 sticky top-0 z-20">
                  <tr>
                    <th className="px-4 py-3 border-b border-r font-black w-48 sticky left-0 bg-slate-100 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      {groupMode === 'worker' ? '担当者' : '圃場'}
                    </th>
                    {dates.map((d, i) => {
                      const isToday = d.toDateString() === new Date().toDateString();
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      return (
                        <th key={i} className={`px-2 py-2 border-b border-r text-center min-w-[140px] ${isToday ? 'bg-emerald-50/80 border-emerald-200' : ''}`}>
                          <div className={`font-black text-lg ${isToday ? 'text-emerald-600' : 'text-slate-800'}`}>
                            {d.getMonth() + 1}/{d.getDate()}
                          </div>
                          <div className={`text-[10px] font-bold ${isWeekend ? 'text-rose-500' : 'text-slate-500'}`}>
                            ({getWeekDayStr(d)})
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {groupedItems.map(item => (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors group">
                      <td className="px-4 py-3 border-r sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] group-hover:bg-slate-50">
                        <div className="font-bold text-slate-700 truncate max-w-[160px] flex items-center gap-2">
                          {groupMode === 'worker' ? (
                            <><Users className="w-4 h-4 text-blue-500" /> {item.name}</>
                          ) : (
                            <><MapPin className="w-4 h-4 text-emerald-500" /> {item.name}</>
                          )}
                        </div>
                      </td>
                      {dates.map((d, i) => {
                        const dateStr = d.toISOString().split('T')[0];
                        // このマスに該当するタスクを抽出
                        const cellTasks = tasks.filter(t => {
                          if (t.work_date !== dateStr) return false;
                          if (groupMode === 'worker') {
                            if (item.id === 'unassigned') return !t.worker_id;
                            return t.worker_id === item.id;
                          } else {
                            if (item.id === 'unassigned') return !t.field_id;
                            return t.field_id === item.id;
                          }
                        });

                        const isToday = d.toDateString() === new Date().toDateString();

                        return (
                          <td key={i} className={`p-1.5 border-r border-slate-100 relative min-h-[60px] align-top ${isToday ? 'bg-emerald-50/10' : ''}`}>
                            <div className="min-h-[50px] relative group/cell">
                              {/* 追加ボタン（ホバー時） */}
                              <button 
                                onClick={() => handleOpenModal(dateStr, groupMode === 'worker' ? (item.id !== 'unassigned' ? item.id : '') : '', groupMode === 'field' ? (item.id !== 'unassigned' ? item.id : '') : '')}
                                className="absolute inset-0 w-full h-full flex items-center justify-center opacity-0 group-hover/cell:opacity-100 hover:bg-slate-100/50 transition-all rounded z-0"
                              >
                                <Plus className="w-5 h-5 text-emerald-500" />
                              </button>
                              
                              {/* タスクカード */}
                              <div className="relative z-10 flex flex-col gap-1.5 w-full">
                                {cellTasks.map(task => (
                                  <div key={task.id} className="bg-white border border-emerald-200 shadow-sm p-2 rounded-lg group/task hover:border-emerald-400 hover:shadow-md transition-all relative">
                                    <div className="font-bold text-emerald-800 text-xs truncate mb-1 pr-6" title={task.task_title}>
                                      {task.task_title}
                                    </div>
                                    <div className="text-[10px] text-slate-500 flex flex-col gap-0.5">
                                      {groupMode === 'worker' && task.fields && (
                                        <div className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3 text-emerald-500"/> {task.fields.name}</div>
                                      )}
                                      {groupMode === 'field' && task.workers && (
                                        <div className="flex items-center gap-1 truncate"><Users className="w-3 h-3 text-blue-500"/> {task.workers.name}</div>
                                      )}
                                      {task.crops && (
                                        <div className="flex items-center gap-1 truncate"><Sprout className="w-3 h-3 text-amber-500"/> {task.crops.name}</div>
                                      )}
                                    </div>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }}
                                      className="absolute top-1 right-1 opacity-0 group-hover/task:opacity-100 p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
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

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2">担当部署</label>
                  <select value={formData.department_id} onChange={e => setFormData({...formData, department_id: e.target.value})} className="w-full p-2 bg-white border border-slate-200 rounded-lg font-bold">
                    <option value="">(全社・指定なし)</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2">担当者（複数選択可）</label>
                  <div className="flex flex-wrap gap-2">
                    {workers.map(w => {
                      const isSelected = formData.worker_ids && formData.worker_ids.includes(w.id);
                      return (
                        <button
                          key={w.id}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            if (isSelected) {
                              setFormData({...formData, worker_ids: formData.worker_ids.filter((id) => id !== w.id)});
                            } else {
                              setFormData({...formData, worker_ids: [...(formData.worker_ids || []), w.id]});
                            }
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${isSelected ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                        >
                          {w.name}
                        </button>
                      );
                    })}
                    {(!workers || workers.length === 0) && (
                      <span className="text-xs text-slate-400">登録されている担当者がいません</span>
                    )}
                  </div>
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
