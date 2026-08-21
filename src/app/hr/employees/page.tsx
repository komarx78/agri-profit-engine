"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, Plus, Edit2, Trash2, X, Loader2, Save, Building, ShieldCheck, Clock } from 'lucide-react';

export default function HrEmployeesPage() {
  const [workers, setWorkers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // モーダル用ステート
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({
    name: '',
    pin_code: '0000',
    hourly_wage: 1000,
    type: 'パート',
    join_date: new Date().toISOString().split('T')[0],
    weekly_days: 3,
    standard_start_time: '09:00',
    standard_end_time: '18:00',
    standard_rest_minutes: 60
  });
  const [isSaving, setIsSaving] = useState(false);

  const [companySettings, setCompanySettings] = useState<any>(null);

  useEffect(() => {
    fetchWorkers();
    fetchCompanySettings();
  }, []);

  const fetchCompanySettings = async () => {
    try {
      const { data } = await supabase.from('company_settings').select('*').order('created_at', { ascending: false }).limit(1).single();
      if (data) setCompanySettings(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchWorkers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('workers').select('*').order('name');
      if (error) throw error;
      setWorkers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const openModal = (worker: any = null) => {
    if (worker) {
      setEditingId(worker.id);
      setFormData({
        name: worker.name || '',
        pin_code: worker.pin_code || '0000',
        hourly_wage: worker.hourly_wage || 0,
        type: worker.type || 'パート',
        join_date: worker.join_date || new Date().toISOString().split('T')[0],
        weekly_days: worker.weekly_days || 3,
        standard_start_time: worker.standard_start_time ? worker.standard_start_time.substring(0, 5) : '09:00',
        standard_end_time: worker.standard_end_time ? worker.standard_end_time.substring(0, 5) : '18:00',
        standard_rest_minutes: worker.standard_rest_minutes ?? 60
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        pin_code: '0000',
        hourly_wage: 1000,
        type: 'パート',
        join_date: new Date().toISOString().split('T')[0],
        weekly_days: 3,
        standard_start_time: companySettings?.default_start_time ? companySettings.default_start_time.substring(0, 5) : '08:00',
        standard_end_time: companySettings?.default_end_time ? companySettings.default_end_time.substring(0, 5) : '17:00',
        standard_rest_minutes: companySettings?.default_rest_minutes ?? 60
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      alert('名前は必須です');
      return;
    }
    setIsSaving(true);
    try {
      let query;
      // time 型にするために秒までつける
      const dataToSave = {
        ...formData,
        standard_start_time: formData.standard_start_time.length === 5 ? formData.standard_start_time + ':00' : formData.standard_start_time,
        standard_end_time: formData.standard_end_time.length === 5 ? formData.standard_end_time + ':00' : formData.standard_end_time,
      };

      if (editingId) {
        query = supabase.from('workers').update(dataToSave).eq('id', editingId);
      } else {
        query = supabase.from('workers').insert([dataToSave]);
      }
      const { error } = await query;
      if (error) throw error;

      await fetchWorkers();
      setIsModalOpen(false);
    } catch (err: any) {
      alert('保存に失敗しました: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('本当に削除しますか？\n関連する打刻データも消える可能性があります。')) return;
    try {
      const { error } = await supabase.from('workers').delete().eq('id', id);
      if (error) throw error;
      setWorkers(workers.filter(w => w.id !== id));
    } catch (err: any) {
      alert('削除に失敗しました: ' + err.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            従業員・人事設定
          </h1>
          <p className="text-sm font-bold text-slate-500 mt-1">
            給与計算・有給管理のための人事マスタデータを管理します。
          </p>
        </div>
        <button 
          onClick={() => openModal()}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> 従業員を新規登録
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
        ) : workers.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-bold">
            従業員が登録されていません
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-500">
                  <th className="p-4">氏名</th>
                  <th className="p-4">ログイン情報</th>
                  <th className="p-4">雇用形態</th>
                  <th className="p-4">入社日</th>
                  <th className="p-4">就業ルール(定時)</th>
                  <th className="p-4 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workers.map((w: any) => (
                  <tr key={w.id} className="hover:bg-slate-50 group transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-800 text-base">{w.name}</div>
                      <div className="text-xs text-slate-400 mt-1">時給: ¥{w.hourly_wage?.toLocaleString() || 0}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded w-fit">
                          PIN: {w.pin_code || '未設定'}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      {w.type === '正社員' ? (
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-xs font-bold">正社員</span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md text-xs font-bold">パート ({w.weekly_days}日/週)</span>
                      )}
                    </td>
                    <td className="p-4 text-sm font-bold text-slate-600">
                      {w.join_date || '-'}
                    </td>
                    <td className="p-4 text-sm font-bold text-slate-600">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {w.standard_start_time ? w.standard_start_time.substring(0, 5) : '09:00'} 
                        〜 
                        {w.standard_end_time ? w.standard_end_time.substring(0, 5) : '18:00'}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">休憩: {w.standard_rest_minutes ?? 60}分</div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openModal(w)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(w.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 編集モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-xl">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                {editingId ? <Edit2 className="w-5 h-5 text-blue-600" /> : <Plus className="w-5 h-5 text-blue-600" />}
                {editingId ? '従業員情報の編集' : '新規従業員の登録'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-200 rounded-lg transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
              {/* 基本情報 */}
              <section>
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <UserIcon /> 基本・ログイン情報
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-3">
                    <label className="block text-xs font-bold text-slate-500 mb-1">氏名 (必須)</label>
                    <input 
                      type="text" 
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-bold"
                      placeholder="例: 山田 太郎"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">現場ログインPIN (4桁)</label>
                    <input 
                      type="text" 
                      maxLength={4}
                      value={formData.pin_code}
                      onChange={e => setFormData({...formData, pin_code: e.target.value.replace(/[^0-9]/g, '')})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-bold tracking-widest text-center text-lg"
                      placeholder="0000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">基本時給 (円)</label>
                    <input 
                      type="number" 
                      value={formData.hourly_wage}
                      onChange={e => setFormData({...formData, hourly_wage: Number(e.target.value)})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-bold text-right"
                    />
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                {/* 労務・人事情報 */}
                <section>
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" /> 労務・有給設定
                  </h3>
                  <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">雇用形態</label>
                      <select
                        value={formData.type}
                        onChange={e => setFormData({...formData, type: e.target.value})}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-bold"
                      >
                        <option value="正社員">正社員 (フルタイム)</option>
                        <option value="パート">パート・アルバイト</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">入社日 (有給起算日)</label>
                      <input 
                        type="date"
                        value={formData.join_date}
                        onChange={e => setFormData({...formData, join_date: e.target.value})}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-bold text-slate-700"
                      />
                    </div>

                    {formData.type === 'パート' && (
                      <div className="bg-white p-4 rounded-lg border border-slate-200 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-700 text-sm">週の所定労働日数</div>
                          <div className="text-xs text-slate-500">※有給比例付与計算用</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            min={1} max={6}
                            value={formData.weekly_days}
                            onChange={e => setFormData({...formData, weekly_days: Number(e.target.value)})}
                            className="w-20 p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-bold text-center text-lg text-blue-600"
                          />
                          <span className="font-bold text-slate-500">日</span>
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                {/* 就業ルール設定 */}
                <section>
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> 就業ルール (定時設定)
                  </h3>
                  <div className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-100 space-y-4 h-full">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">出勤予定時刻</label>
                        <input 
                          type="time"
                          value={formData.standard_start_time}
                          onChange={e => setFormData({...formData, standard_start_time: e.target.value})}
                          className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-bold text-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">退勤予定時刻</label>
                        <input 
                          type="time"
                          value={formData.standard_end_time}
                          onChange={e => setFormData({...formData, standard_end_time: e.target.value})}
                          className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-bold text-slate-700"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">所定休憩時間</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number"
                          value={formData.standard_rest_minutes}
                          onChange={e => setFormData({...formData, standard_rest_minutes: Number(e.target.value)})}
                          className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-bold text-slate-700 text-right"
                        />
                        <span className="font-bold text-slate-500">分</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        ※この時間を超えて労働した場合に残業として計上されます。
                      </p>
                    </div>
                  </div>
                </section>
              </div>

            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3 mt-auto">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                キャンセル
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="px-8 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                保存する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 簡易アイコンコンポーネント
const UserIcon = () => <Users className="w-4 h-4" />;
