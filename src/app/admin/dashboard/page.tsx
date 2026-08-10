"use client";

import React, { useEffect, useState } from 'react';
import { 
  PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { Activity, Clock, Sprout } from 'lucide-react';

// --- 直感的なグラフ用の色設定 ---
const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6'];

export default function DashboardPage() {
  const [cropData, setCropData] = useState<any[]>([]);
  const [workerData, setWorkerData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        // Supabaseから作業ログ、作目、作業者をまとめて取得
        const { data: logs, error } = await supabase
          .from('work_logs')
          .select(`
            duration_minutes,
            crops(name),
            workers(name)
          `);

        if (error || !logs || logs.length === 0) {
          // データが無い場合やエラー時は、直感的にわかるモックデータを表示する
          setCropData([
            { name: '伏見唐辛子', value: 320 },
            { name: '米（キヌヒカリ）', value: 150 },
            { name: '九条ネギ', value: 90 },
          ]);
          setWorkerData([
            { name: '京都 太郎', 時間: 400 },
            { name: '農場 花子', 時間: 160 },
          ]);
          setIsLoading(false);
          return;
        }

        // 実際のデータから「作目別の合計時間」を集計
        const cropMap: Record<string, number> = {};
        const workerMap: Record<string, number> = {};

        logs.forEach((log: any) => {
          const cName = log.crops?.name || '不明';
          const wName = log.workers?.name || '不明';
          const dur = log.duration_minutes || 0;

          cropMap[cName] = (cropMap[cName] || 0) + dur;
          workerMap[wName] = (workerMap[wName] || 0) + dur;
        });

        // グラフ用に配列に変換
        const cData = Object.keys(cropMap).map(k => ({ name: k, value: cropMap[k] }));
        const wData = Object.keys(workerMap).map(k => ({ name: k, 時間: workerMap[k] }));

        setCropData(cData);
        setWorkerData(wData);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">採算性ダッシュボード</h1>
        <p className="text-slate-500 mt-2 font-medium">細かい数字を読まなくても、色と大きさで直感的に状況がわかります。</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* 1. 作目別 作業時間の割合（ドーナツチャート） */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-96">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
              <Sprout className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-700">どの作目に一番時間をかけているか？</h2>
              <p className="text-sm text-slate-400">面積が大きいほど、手がかかっている作目です</p>
            </div>
          </div>
          
          <div className="flex-1 w-full min-h-[250px]">
            {isLoading ? (
              <div className="w-full h-full flex items-center justify-center text-slate-400">読み込み中...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={cropData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {cropData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => [`${value} 分`, '作業時間']}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 2. 作業者別 稼働時間（棒グラフ） */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-96">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-700">誰が一番長く作業したか？</h2>
              <p className="text-sm text-slate-400">バーが長いほど、たくさん働いています</p>
            </div>
          </div>

          <div className="flex-1 w-full min-h-[250px]">
            {isLoading ? (
              <div className="w-full h-full flex items-center justify-center text-slate-400">読み込み中...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={workerData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} fontWeight="bold" width={80} />
                  <Tooltip 
                    formatter={(value: any) => [`${value} 分`, '作業時間']}
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="時間" fill="#3b82f6" radius={[0, 8, 8, 0]} barSize={40}>
                    {workerData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
