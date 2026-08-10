"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Database, User, Sprout, MapPin } from 'lucide-react';

export default function MastersPage() {
  const [crops, setCrops] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchMasters() {
      try {
        setIsLoading(true);
        const [cRes, fRes, wRes] = await Promise.all([
          supabase.from('crops').select('*').order('name'),
          supabase.from('fields').select('*').order('name'),
          supabase.from('workers').select('*').order('name')
        ]);
        
        setCrops(cRes.data || []);
        setFields(fRes.data || []);
        setWorkers(wRes.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchMasters();
  }, []);

  const CardHeader = ({ icon: Icon, title, count }: { icon: any, title: string, count: number }) => (
    <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
      <div className="flex items-center gap-2 text-slate-800 font-bold text-lg">
        <Icon className="w-5 h-5 text-emerald-600" />
        {title}
      </div>
      <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-sm font-medium">
        {count} 件
      </span>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
          <Database className="w-8 h-8 text-emerald-600" />
          マスタ管理
        </h1>
        <p className="text-slate-500 mt-2 font-medium">現場の入力画面に表示される選択肢（作目・圃場・作業者）の一覧です。</p>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-slate-400 font-medium">データを読み込み中...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* 作目一覧 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <CardHeader icon={Sprout} title="作目（作物）" count={crops.length} />
            <div className="space-y-2">
              {crops.length === 0 ? <p className="text-slate-400 text-sm">データがありません</p> : null}
              {crops.map(c => (
                <div key={c.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                  <span className="font-bold text-slate-700">{c.name}</span>
                  <span className="text-xs text-slate-400">{c.category || '-'}</span>
                </div>
              ))}
            </div>
            <button className="mt-4 w-full py-2 bg-emerald-50 text-emerald-700 font-bold rounded-xl hover:bg-emerald-100 transition-colors text-sm">
              + 新しい作目を追加
            </button>
          </div>

          {/* 圃場一覧 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <CardHeader icon={MapPin} title="圃場（場所）" count={fields.length} />
            <div className="space-y-2">
              {fields.length === 0 ? <p className="text-slate-400 text-sm">データがありません</p> : null}
              {fields.map(f => (
                <div key={f.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                  <span className="font-bold text-slate-700">{f.name}</span>
                  <span className="text-xs text-slate-400">{f.area_sqm ? `${f.area_sqm}㎡` : '-'}</span>
                </div>
              ))}
            </div>
            <button className="mt-4 w-full py-2 bg-emerald-50 text-emerald-700 font-bold rounded-xl hover:bg-emerald-100 transition-colors text-sm">
              + 新しい圃場を追加
            </button>
          </div>

          {/* 作業者一覧 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <CardHeader icon={User} title="作業者・スタッフ" count={workers.length} />
            <div className="space-y-2">
              {workers.length === 0 ? <p className="text-slate-400 text-sm">データがありません</p> : null}
              {workers.map(w => (
                <div key={w.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-700">{w.name}</span>
                    <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md">{w.role || '未設定'}</span>
                  </div>
                  {w.hourly_wage > 0 && (
                    <span className="text-xs text-slate-400 mt-1">時給設定: {w.hourly_wage}円</span>
                  )}
                </div>
              ))}
            </div>
            <button className="mt-4 w-full py-2 bg-emerald-50 text-emerald-700 font-bold rounded-xl hover:bg-emerald-100 transition-colors text-sm">
              + 新しい作業者を追加
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
