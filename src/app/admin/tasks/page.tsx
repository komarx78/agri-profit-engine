
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Calendar, CheckCircle2, Clock, MapPin, Sprout, Loader2, Plus, Trash2, Edit2, Users, Briefcase, X, List, LayoutGrid, ChevronLeft, ChevronRight } from 'lucide-react';
import { autoTranslateMasterData } from '@/app/actions/translate';

import { getCurrentTenantId } from '@/lib/tenant';

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [crops, setCrops] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string>('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<any>({
    work_date: new Date().toISOString().split('T')[0],
    task_title: '',
    crop_id: '',
    department_id: '',
    field_assignments: [
      { field_id: '', worker_ids: [] as string[] }
    ]
  });

  // UI State
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [groupMode, setGroupMode] = useState<'worker' | 'field' | 'crop'>('field');
  const [calendarDays, setCalendarDays] = useState<number>(7); // 2 = Today/Tomorrow, 7 = Week
  const [startDate, setStartDate] = useState(new Date());

  const fetchTasksData = async (ownerId: string) => {
    try {
      const { data, error } = await supabase
        .from('work_logs')
        .select('id, work_date, task_title, task_title_en, task_title_vi, task_title_id, task_title_zh, status, approval_status, duration_minutes, crop_id, field_id, worker_id, department_id, crops(name), fields(name), workers(name), departments(name)')
        .eq('user_id', ownerId)
        .eq('status', 'planned')
        .order('work_date', { ascending: true });
      if (!error && data) {
        setTasks(data);
      }
    } catch (e) {
      console.error('Failed to fetch tasks:', e);
    }
  };

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const ownerId = await getCurrentTenantId();
        if (!ownerId) {
          setIsLoading(false);
          return;
        }
        setTenantId(ownerId);

        const [tasksRes, cropsRes, fieldsRes, workersRes, deptsRes] = await Promise.all([
          supabase.from('work_logs').select('id, work_date, task_title, task_title_en, task_title_vi, task_title_id, task_title_zh, status, approval_status, duration_minutes, crop_id, field_id, worker_id, department_id, crops(name), fields(name), workers(name), departments(name)').eq('user_id', ownerId).eq('status', 'planned').order('work_date', { ascending: true }),
          supabase.from('crops').select('*').eq('user_id', ownerId).order('name'),
          supabase.from('fields').select('*').eq('user_id', ownerId).order('name'),
          supabase.from('workers').select('*').eq('user_id', ownerId).order('name'),
          supabase.from('departments').select('*').eq('tenant_id', ownerId).order('name')
        ]);

        if (tasksRes.data) setTasks(tasksRes.data);
        if (cropsRes.data) setCrops(cropsRes.data);
        if (fieldsRes.data) setFields(fieldsRes.data);
        if (workersRes.data) setWorkers(workersRes.data);
        if (deptsRes.data) setDepartments(deptsRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleSave = async () => {
    if (!formData.work_date || !formData.task_title) {
      alert('予定日とタスク内容は必須です');
      return;
    }
    setIsSaving(true);
    try {
      const activeTenantId = tenantId || await getCurrentTenantId();
      if (!activeTenantId) throw new Error('農園IDが特定できません');

      // タスクタイトルの多言語AI自動翻訳を生成
      let transPayload: any = {};
      try {
        const trans = await autoTranslateMasterData(formData.task_title);
        transPayload = {
          task_title_en: trans.name_en || formData.task_title,
          task_title_vi: trans.name_vi || formData.task_title,
          task_title_id: trans.name_id || formData.task_title,
          task_title_zh: trans.name_zh || formData.task_title,
          task_title_si: trans.name_si || formData.task_title,
          task_title_km: trans.name_km || formData.task_title,
        };
      } catch (tErr) {
        console.warn('Translation fallback:', tErr);
      }

      if (editingTaskId) {
        // 編集保存（単一タスク更新）
        const assignment = formData.field_assignments[0] || { field_id: '', worker_ids: [] };
        const updatePayload: any = {
          work_date: formData.work_date,
          task_title: formData.task_title,
          work_type: formData.task_title,
          crop_id: formData.crop_id || null,
          field_id: assignment.field_id || null,
          worker_id: (assignment.worker_ids && assignment.worker_ids.length > 0) ? assignment.worker_ids[0] : null,
          department_id: formData.department_id || null,
          ...transPayload
        };

        const { error } = await supabase
          .from('work_logs')
          .update(updatePayload)
          .eq('id', editingTaskId);

        if (error) throw error;
      } else {
        // 新規作成（複数圃場 × 複数担当者の組み合わせを一括展開）
        const insertData: any[] = [];
        const assignments = formData.field_assignments && formData.field_assignments.length > 0
          ? formData.field_assignments
          : [{ field_id: '', worker_ids: [] }];

        assignments.forEach((assignment: { field_id: string, worker_ids: string[] }) => {
          const fId = assignment.field_id || null;
          const wIds = assignment.worker_ids || [];

          if (wIds.length > 0) {
            wIds.forEach(wId => {
              insertData.push({
                user_id: activeTenantId,
                work_date: formData.work_date,
                task_title: formData.task_title,
                work_type: formData.task_title,
                crop_id: formData.crop_id || null,
                field_id: fId,
                worker_id: wId,
                department_id: formData.department_id || null,
                status: 'planned',
                duration_minutes: 0,
                approval_status: null,
                ...transPayload
              });
            });
          } else {
            insertData.push({
              user_id: activeTenantId,
              work_date: formData.work_date,
              task_title: formData.task_title,
              work_type: formData.task_title,
              crop_id: formData.crop_id || null,
              field_id: fId,
              worker_id: null,
              department_id: formData.department_id || null,
              status: 'planned',
              duration_minutes: 0,
              approval_status: null,
              ...transPayload
            });
          }
        });

        const { error } = await supabase
          .from('work_logs')
          .insert(insertData);
        
        if (error) throw error;
      }

      // 一覧を最新化
      await fetchTasksData(activeTenantId);

      setIsModalOpen(false);
      setEditingTaskId(null);
      setFormData({
        work_date: new Date().toISOString().split('T')[0],
        task_title: '',
        crop_id: '',
        department_id: '',
        field_assignments: [{ field_id: '', worker_ids: [] }]
      });
    } catch (err: any) {
      console.error('Task save error:', err);
      if (err.code === '42501' || err.status === 401 || err.message?.includes('permission') || err.message?.includes('policy')) {
        alert('【権限エラー】Supabaseのwork_logsテーブルに対するRLS権限がありません。SQLを実行して権限を開放してください。');
      } else {
        alert('保存に失敗しました: ' + (err.message || '通信エラー'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('本当に削除しますか？')) return;
    try {
      await supabase.from('work_logs').delete().eq('id', id);
      setTasks(tasks.filter(t => t.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenModal = (dateStr?: string, workerId?: string, fieldId?: string, cropId?: string) => {
    setEditingTaskId(null);
    setFormData({
      work_date: dateStr || new Date().toISOString().split('T')[0],
      task_title: '',
      crop_id: cropId || '',
      department_id: '',
      field_assignments: [
        {
          field_id: fieldId || '',
          worker_ids: workerId ? [workerId] : []
        }
      ]
    });
    setIsModalOpen(true);
  };

  const handleEditModal = (task: any) => {
    setEditingTaskId(task.id);
    setFormData({
      work_date: task.work_date,
      task_title: task.task_title || '',
      crop_id: task.crop_id || '',
      department_id: task.department_id || '',
      field_assignments: [
        {
          field_id: task.field_id || '',
          worker_ids: task.worker_id ? [task.worker_id] : []
        }
      ]
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
    } else if (groupMode === 'crop') {
      const items = [...crops];
      items.push({ id: 'unassigned', name: '(作物指定なし)' });
      return items;
    } else {
      const items = [...fields];
      items.push({ id: 'unassigned', name: '(圃場指定なし)' });
      return items;
    }
  }, [workers, fields, crops, groupMode]);

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
                    onChange={e => setGroupMode(e.target.value as 'worker'|'field'|'crop')}
                    className="text-sm font-bold bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none"
                  >
                    <option value="field">圃場別</option>
                    <option value="crop">作物別</option>
                    <option value="worker">担当者別</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto relative">
              <table className="w-full text-sm text-left whitespace-nowrap min-w-[800px] border-collapse">
                <thead className="text-xs text-slate-700 bg-slate-50 sticky top-0 z-20">
                  <tr>
                    <th className="w-44 px-4 py-3 text-left font-bold text-slate-600 border-r sticky left-0 bg-slate-50 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      {groupMode === 'worker' ? '担当者' : groupMode === 'crop' ? '作物' : '圃場'}
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
                          ) : groupMode === 'crop' ? (
                            <><Sprout className="w-4 h-4 text-amber-500" /> {item.name}</>
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
                          } else if (groupMode === 'crop') {
                            if (item.id === 'unassigned') return !t.crop_id;
                            return t.crop_id === item.id;
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
                                onClick={() => handleOpenModal(
                                  dateStr, 
                                  groupMode === 'worker' ? (item.id !== 'unassigned' ? item.id : '') : '', 
                                  groupMode === 'field' ? (item.id !== 'unassigned' ? item.id : '') : '', 
                                  groupMode === 'crop' ? (item.id !== 'unassigned' ? item.id : '') : ''
                                )}
                                className="absolute inset-0 w-full h-full flex items-center justify-center opacity-0 group-hover/cell:opacity-100 hover:bg-slate-100/50 transition-all rounded z-0"
                              >
                                <Plus className="w-5 h-5 text-emerald-500" />
                              </button>
                              
                              {/* タスクカード */}
                              <div className="relative z-10 flex flex-col gap-1.5 w-full">
                                {cellTasks.map(task => (
                                  <div key={task.id} onClick={() => handleEditModal(task)} className="bg-white border border-emerald-200 shadow-sm p-2 rounded-lg group/task hover:border-emerald-400 hover:shadow-md transition-all relative cursor-pointer">
                                    <div className="font-bold text-emerald-800 text-xs truncate mb-1 pr-6" title={task.task_title}>
                                      {task.task_title}
                                    </div>
                                    <div className="text-[10px] text-slate-500 flex flex-col gap-0.5">
                                      {groupMode === 'worker' && task.fields && (
                                        <div className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3 text-emerald-500"/> {task.fields.name}</div>
                                      )}
                                      {groupMode === 'worker' && task.crops && (
                                        <div className="flex items-center gap-1 truncate text-slate-500"><Sprout className="w-3 h-3 text-amber-500"/> {task.crops.name}</div>
                                      )}
                                      {groupMode === 'field' && task.workers && (
                                        <div className="flex items-center gap-1 truncate"><Users className="w-3 h-3 text-blue-500"/> {task.workers.name}</div>
                                      )}
                                      {groupMode === 'field' && task.crops && (
                                        <div className="flex items-center gap-1 truncate text-slate-500"><Sprout className="w-3 h-3 text-amber-500"/> {task.crops.name}</div>
                                      )}
                                      {groupMode === 'crop' && task.workers && (
                                        <div className="flex items-center gap-1 truncate"><Users className="w-3 h-3 text-blue-500"/> {task.workers.name}</div>
                                      )}
                                      {groupMode === 'crop' && task.fields && (
                                        <div className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3 text-emerald-500"/> {task.fields.name}</div>
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
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50">
              <h3 className="font-bold text-emerald-800 flex items-center gap-2">
                {editingTaskId ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                {editingTaskId ? 'タスクの編集' : '新規タスクの作成'}
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
                  <label className="block text-xs font-bold text-slate-500 mb-1">担当部署</label>
                  <select value={formData.department_id} onChange={e => setFormData({...formData, department_id: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold">
                    <option value="">(全社・指定なし)</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              {/* 圃場と担当者の割り当て（複数圃場スロット） */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    圃場と担当者の割り当て
                  </label>
                  {!editingTaskId && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          field_assignments: [
                            ...formData.field_assignments,
                            { field_id: '', worker_ids: [] }
                          ]
                        });
                      }}
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"
                    >
                      <Plus className="w-3.5 h-3.5" /> 圃場を追加
                    </button>
                  )}
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {formData.field_assignments?.map((assignment: any, idx: number) => (
                    <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 relative group">
                      
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1">
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">
                            圃場 {formData.field_assignments.length > 1 ? `#${idx + 1}` : ''}
                          </label>
                          <select
                            value={assignment.field_id}
                            onChange={(e) => {
                              const newAssignments = [...formData.field_assignments];
                              newAssignments[idx].field_id = e.target.value;
                              setFormData({ ...formData, field_assignments: newAssignments });
                            }}
                            className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                          >
                            <option value="">(圃場を選択 / 指定なし)</option>
                            {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                          </select>
                        </div>

                        {!editingTaskId && formData.field_assignments.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newAssignments = formData.field_assignments.filter((_: any, i: number) => i !== idx);
                              setFormData({ ...formData, field_assignments: newAssignments });
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors mt-4"
                            title="この圃場を削除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5">
                          この圃場の担当者（複数選択可）
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {workers.map(w => {
                            const isSelected = assignment.worker_ids?.includes(w.id);
                            return (
                              <button
                                key={w.id}
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  const newAssignments = [...formData.field_assignments];
                                  const currentWorkers = newAssignments[idx].worker_ids || [];
                                  if (isSelected) {
                                    newAssignments[idx].worker_ids = currentWorkers.filter((id: string) => id !== w.id);
                                  } else {
                                    newAssignments[idx].worker_ids = [...currentWorkers, w.id];
                                  }
                                  setFormData({ ...formData, field_assignments: newAssignments });
                                }}
                                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all border ${
                                  isSelected
                                    ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {w.name}
                              </button>
                            );
                          })}
                          {(!workers || workers.length === 0) && (
                            <span className="text-[11px] text-slate-400">担当者が登録されていません</span>
                          )}
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 font-bold text-xs bg-white border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50">
                キャンセル
              </button>
              <button onClick={handleSave} disabled={isSaving} className="flex-1 py-2.5 font-bold text-xs bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 flex items-center justify-center gap-2 shadow-xs">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'タスクを一括保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
