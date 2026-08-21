"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Coffee, Download, Users, Loader2, AlertCircle } from 'lucide-react';

export default function PaidLeavePage() {
  const [workers, setWorkers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('workers').select('*');
      if (error) throw error;
      
      // 有給管理用にダミーの入社日・雇用形態を付与（本来はテーブルに追加する）
      const enhancedWorkers = (data || []).map(w => ({
        ...w,
        // ここは暫定的にダミーデータを入れる（後日DB拡張時に実際の値にする）
        join_date: w.join_date || '2024-04-01',
        type: w.type || (Math.random() > 0.5 ? '正社員' : 'パート'),
        weekly_days: w.weekly_days || 3,
        takenDates: [], // 取得済みの有給日
      }));
      
      setWorkers(enhancedWorkers);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // 有給付与基準の計算（販売用システムからの移植ロジック）
  const calculateLegalGrantDays = (joinDateStr: string, type: string, weeklyDays?: number) => {
    if (!joinDateStr) return 0;
    const joinYear = parseInt(joinDateStr.split('-')[0]);
    const currentYear = new Date().getFullYear();
    const yearsOfService = currentYear - joinYear;
    
    if (type === 'パート') {
      const wDays = weeklyDays || 3;
      // パートの比例付与
      if (yearsOfService <= 0) return wDays * 2;
      return (wDays * 2) + Math.min(yearsOfService, 4); 
    } else {
      // 正社員の法定付与テーブル
      if (yearsOfService <= 0) return 10;
      if (yearsOfService === 1) return 11;
      if (yearsOfService === 2) return 12;
      if (yearsOfService === 3) return 14;
      if (yearsOfService === 4) return 16;
      if (yearsOfService === 5) return 18;
      return 20; // 6年半以上
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
          <Coffee className="w-6 h-6 text-amber-500" />
          有給・休暇管理簿
        </h1>
        <button className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-700 transition-colors">
          <Download className="w-4 h-4" /> 法定管理簿 (CSV出力)
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl mb-6 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <strong>※ 現在はプレビュー版です。</strong><br />
          販売用システムからの有給付与ロジック（<code>calculateLegalGrantDays</code>）の移植は完了しています。<br/>
          今後、従業員マスタ（<code>workers</code>テーブル）に「入社日」や「雇用形態（パート/社員）」のカラムを追加することで、自動で正確な付与日数が計算されるようになります。
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-500">
                  <th className="p-4">従業員名</th>
                  <th className="p-4">雇用形態</th>
                  <th className="p-4">入社日</th>
                  <th className="p-4 text-center">今期付与日数</th>
                  <th className="p-4 text-center">取得済</th>
                  <th className="p-4 text-center">取得義務残日数</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workers.map((emp: any) => {
                  const grantedDays = calculateLegalGrantDays(emp.join_date, emp.type, emp.weekly_days);
                  const takenDays = emp.takenDates.length;
                  const hasObligation = grantedDays >= 10;
                  const remainingObligation = hasObligation ? Math.max(0, 5 - takenDays) : 0;
                  
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
                            <Users className="w-4 h-4" />
                          </div>
                          <span className="font-bold text-slate-700">{emp.name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-sm font-bold text-slate-600">
                        {emp.type === '正社員' ? (
                          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-xs">正社員</span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md text-xs">パート ({emp.weekly_days}日)</span>
                        )}
                      </td>
                      <td className="p-4 text-sm font-bold text-slate-600">{emp.join_date}</td>
                      <td className="p-4 text-center font-black text-slate-700">{grantedDays} 日</td>
                      <td className="p-4 text-center font-bold text-slate-500">{takenDays} 日</td>
                      <td className="p-4 text-center">
                        {hasObligation ? (
                          remainingObligation === 0 ? (
                            <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md text-xs font-bold border border-emerald-100">
                              義務達成 (0日)
                            </span>
                          ) : (
                            <span className="bg-rose-50 text-rose-600 px-2 py-1 rounded-md text-xs font-bold border border-rose-100">
                              残り {remainingObligation} 日
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400 text-xs font-bold">対象外</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
