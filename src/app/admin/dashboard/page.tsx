"use client";

import React, { useEffect, useState } from 'react';
import { 
  PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, CartesianGrid
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { Activity, Clock, Sprout, TrendingUp, Banknote } from 'lucide-react';

// --- 直感的なグラフ用の色設定 ---
const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6'];

export default function DashboardPage() {
  const [cropData, setCropData] = useState<any[]>([]);
  const [workerData, setWorkerData] = useState<any[]>([]);
  
  // 新規追加する採算性データ
  const [profitabilityData, setProfitabilityData] = useState<any[]>([]);
  const [channelSalesData, setChannelSalesData] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        // Supabaseから作業ログと売上ログを取得
        const [workRes, salesRes] = await Promise.all([
          supabase.from('work_logs').select(`
            duration_minutes,
            crops(name),
            workers(name, hourly_wage)
          `),
          supabase.from('sales_logs').select(`
            total_sales,
            crops(name),
            sales_channels(name)
          `)
        ]);

        const workLogs = workRes.data || [];
        const salesLogs = salesRes.data || [];

        // --- 1. 既存の集計ロジック（作業時間） ---
        const cropMap: Record<string, number> = {};
        const workerMap: Record<string, number> = {};
        const cropWageMap: Record<string, number> = {}; // 作目ごとの推定人件費総額

        workLogs.forEach((log: any) => {
          const cName = log.crops?.name || '不明';
          const wName = log.workers?.name || '不明';
          const dur = log.duration_minutes || 0;
          const wage = log.workers?.hourly_wage || 1000; // デフォルト1000円

          cropMap[cName] = (cropMap[cName] || 0) + dur;
          workerMap[wName] = (workerMap[wName] || 0) + dur;
          
          // 推定人件費 = (作業時間(分) / 60) * 時給
          cropWageMap[cName] = (cropWageMap[cName] || 0) + ((dur / 60) * wage);
        });

        // --- 2. 新規の集計ロジック（売上・採算性） ---
        const cropSalesMap: Record<string, number> = {};
        const channelSalesMap: Record<string, number> = {};

        salesLogs.forEach((log: any) => {
          const cName = log.crops?.name || '不明';
          const chName = log.sales_channels?.name || '不明';
          const sales = log.total_sales || 0;

          cropSalesMap[cName] = (cropSalesMap[cName] || 0) + sales;
          channelSalesMap[chName] = (channelSalesMap[chName] || 0) + sales;
        });

        // --- データが空の場合のモックデータ（プロトタイプ用） ---
        if (workLogs.length === 0 && salesLogs.length === 0) {
          setCropData([
            { name: '伏見唐辛子', value: 320 },
            { name: '米（キヌヒカリ）', value: 150 },
            { name: '九条ネギ', value: 90 },
          ]);
          setWorkerData([
            { name: '京都 太郎', 時間: 400 },
            { name: '農場 花子', 時間: 160 },
          ]);
          setProfitabilityData([
            { name: '伏見唐辛子', 時給換算: 2500, 売上: 150000, 人件費: 40000 },
            { name: '米（キヌヒカリ）', 時給換算: -500, 売上: 30000, 人件費: 50000 },
            { name: '九条ネギ', 時給換算: 1200, 売上: 40000, 人件費: 15000 },
          ]);
          setChannelSalesData([
            { name: 'JA', 売上: 100000 },
            { name: '直売所', 売上: 70000 },
            { name: 'ECサイト', 売上: 50000 },
          ]);
          setIsLoading(false);
          return;
        }

        // --- 3. グラフ用配列の生成 ---
        const cData = Object.keys(cropMap).map(k => ({ name: k, value: cropMap[k] }));
        const wData = Object.keys(workerMap).map(k => ({ name: k, 時間: workerMap[k] }));
        
        // 採算性データ: (総売上 - 人件費(※資材費0)) / 総作業時間(時間)
        const pData = Object.keys(cropMap).map(k => {
          const hours = cropMap[k] / 60;
          const sales = cropSalesMap[k] || 0;
          const laborCost = cropWageMap[k] || 0;
          
          // 時給換算（0時間の場合は0）
          const hourlyProfit = hours > 0 ? Math.round((sales - laborCost) / hours) : 0;
          
          return {
            name: k,
            時給換算: hourlyProfit,
            売上: sales,
            人件費: Math.round(laborCost)
          };
        }).sort((a, b) => b.時給換算 - a.時給換算); // 採算性が高い順

        const chData = Object.keys(channelSalesMap).map(k => ({ 
          name: k, 
          売上: channelSalesMap[k] 
        })).sort((a, b) => b.売上 - a.売上);

        setCropData(cData);
        setWorkerData(wData);
        setProfitabilityData(pData);
        setChannelSalesData(chData);

      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-12">
      <div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">経営・採算性ダッシュボード</h1>
        <p className="text-slate-500 mt-2 font-medium">作業時間と売上データから、自動的に利益を計算して可視化します。</p>
      </div>

      {/* --- Section 1: 経営・採算性 (新規追加) --- */}
      <section>
        <h2 className="text-2xl font-bold text-slate-800 border-b-2 border-emerald-500 pb-2 mb-6 inline-block">
          💰 採算性分析（時給換算）
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ① 作目別 時間あたり採算性 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[420px]">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-700">作目別 時給換算チャート</h3>
                <p className="text-sm text-slate-400">1時間作業したらいくら儲かるか？（赤字は要注意）</p>
              </div>
            </div>
            
            <div className="flex-1 w-full mt-4">
              {isLoading ? (
                <div className="w-full h-full flex items-center justify-center text-slate-400">読み込み中...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={profitabilityData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} 
                      angle={-45}
                      textAnchor="end"
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12 }} 
                      tickFormatter={(value) => `¥${value.toLocaleString()}`}
                    />
                    <Tooltip 
                      formatter={(value: any) => [`¥${value.toLocaleString()}`, '時給換算']}
                      cursor={{fill: '#f1f5f9'}}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="時給換算" radius={[6, 6, 0, 0]} maxBarSize={60}>
                      {profitabilityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.時給換算 >= 0 ? '#10b981' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ② 販路別 売上比較 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[420px]">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                <Banknote className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-700">販路別 売上比較チャート</h3>
                <p className="text-sm text-slate-400">どの販路が一番売上を上げているか？</p>
              </div>
            </div>
            
            <div className="flex-1 w-full mt-4">
              {isLoading ? (
                <div className="w-full h-full flex items-center justify-center text-slate-400">読み込み中...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={channelSalesData}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} fontWeight="bold" width={80} />
                    <Tooltip 
                      formatter={(value: any) => [`¥${value.toLocaleString()}`, '総売上']}
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="売上" fill="#3b82f6" radius={[0, 6, 6, 0]} barSize={32}>
                      {channelSalesData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* --- Section 2: 作業時間 (既存) --- */}
      <section className="pt-8 border-t border-slate-200">
        <h2 className="text-xl font-bold text-slate-500 mb-6 inline-block">
          ⏱️ 作業時間の内訳
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 opacity-80 hover:opacity-100 transition-opacity">
          {/* 1. 作目別 作業時間の割合 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-80">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                <Sprout className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-700">一番手がかかっている作目は？</h3>
            </div>
            
            <div className="flex-1 w-full">
              {isLoading ? (
                <div className="w-full h-full flex items-center justify-center text-slate-400">読み込み中...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={cropData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
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
                      contentStyle={{ borderRadius: '12px', border: 'none' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* 2. 作業者別 稼働時間 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-80">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-700">誰が一番長く作業したか？</h3>
            </div>

            <div className="flex-1 w-full">
              {isLoading ? (
                <div className="w-full h-full flex items-center justify-center text-slate-400">読み込み中...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={workerData}
                    layout="vertical"
                    margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} fontWeight="bold" width={80} />
                    <Tooltip 
                      formatter={(value: any) => [`${value} 分`, '作業時間']}
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{ borderRadius: '12px', border: 'none' }}
                    />
                    <Bar dataKey="時間" fill="#94a3b8" radius={[0, 4, 4, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
