"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BarTooltip } from 'recharts';
import { Sprout, Loader2, User, Clock, BarChart2, TrendingUp, HelpCircle } from 'lucide-react';
import { HelpTooltip } from '@/components/HelpTooltip';

const PIE_COLORS = ['#fb7185', '#f43f5e', '#e11d48', '#fda4af', '#be123c', '#9f1239', '#ffe4e6'];
const WORKER_COLORS = ['#3b82f6', '#60a5fa', '#2563eb', '#93c5fd', '#1d4ed8', '#bfdbfe', '#1e3a8a'];

export default function CropAnalysisPage() {
  const [crops, setCrops] = useState<any[]>([]);
  const [allWorkLogs, setAllWorkLogs] = useState<any[]>([]);
  const [allSalesLogs, setAllSalesLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCropId, setSelectedCropId] = useState<string>('all');
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchData();
  }, [year]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [cRes, wRes, sRes] = await Promise.all([
        supabase.from('crops').select('*').order('name'),
        supabase.from('work_logs').select('*, workers(name), materials(default_price)').gte('work_date', `${year}-01-01`).lte('work_date', `${year}-12-31`),
        supabase.from('sales_logs').select('*').gte('sales_date', `${year}-01-01`).lte('sales_date', `${year}-12-31`)
      ]);
      setCrops(cRes.data || []);
      setAllWorkLogs(wRes.data || []);
      setAllSalesLogs(sRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // 全作目サマリー（予実）の計算
  const cropStats = useMemo(() => {
    const stats: Record<string, any> = {};
    crops.forEach(c => {
      stats[c.id] = {
        id: c.id,
        name: c.name,
        plannedSales: 0,
        actualSales: 0,
        plannedWorkHours: 0,
        actualWorkHours: 0,
        plannedMaterialCost: 0,
        actualMaterialCost: 0,
      };
    });
    
    allSalesLogs.forEach(s => {
      if (s.crop_id && stats[s.crop_id]) {
        if (s.status === 'planned') stats[s.crop_id].plannedSales += (s.total_sales || 0);
        else if (s.status === 'completed') stats[s.crop_id].actualSales += (s.total_sales || 0);
      }
    });
    
    allWorkLogs.forEach(w => {
      if (w.crop_id && stats[w.crop_id]) {
        const hours = (w.duration_minutes || 0) / 60;
        const matCost = (w.material_quantity || 0) * (w.materials?.default_price || 0);
        
        if (w.status === 'planned') {
          stats[w.crop_id].plannedWorkHours += hours;
          stats[w.crop_id].plannedMaterialCost += matCost;
        } else if (w.status === 'completed') {
          stats[w.crop_id].actualWorkHours += hours;
          stats[w.crop_id].actualMaterialCost += matCost;
        }
      }
    });

    const baseHourlyWage = 1000;
    const estimateCostRate = 20;

    return Object.values(stats).map(stat => {
      const plannedMatCost = stat.plannedMaterialCost || Math.round(stat.plannedSales * (estimateCostRate / 100));
      const plannedLaborCost = stat.plannedWorkHours * baseHourlyWage;
      const plannedCost = plannedLaborCost + plannedMatCost;
      const plannedProfit = stat.plannedSales - plannedCost;

      const actualMatCost = stat.actualMaterialCost || Math.round(stat.actualSales * (estimateCostRate / 100));
      const actualLaborCost = stat.actualWorkHours * baseHourlyWage;
      const actualCost = actualLaborCost + actualMatCost;
      const actualProfit = stat.actualSales - actualCost;

      const progressRate = stat.plannedSales > 0 ? Math.round((stat.actualSales / stat.plannedSales) * 100) : 0;

      return {
        ...stat,
        plannedCost, plannedProfit, actualCost, actualProfit, progressRate
      };
    }).filter(s => s.plannedSales > 0 || s.actualSales > 0 || s.plannedWorkHours > 0 || s.actualWorkHours > 0)
      .sort((a, b) => b.actualProfit - a.actualProfit); // 利益順
  }, [crops, allSalesLogs, allWorkLogs]);

  // 選択された作目（または全作目）の円グラフ用データ集計
  const targetWorkLogs = useMemo(() => {
    return selectedCropId === 'all' 
      ? allWorkLogs.filter(w => w.status === 'completed')
      : allWorkLogs.filter(w => w.status === 'completed' && w.crop_id === selectedCropId);
  }, [allWorkLogs, selectedCropId]);

  const { workPieData, workerPieData } = useMemo(() => {
    const workTypeHours: Record<string, number> = {};
    const workerTypeHours: Record<string, number> = {};

    targetWorkLogs.forEach(log => {
      const hours = (Number(log.duration_minutes) || 0) / 60;
      
      const wType = log.work_type || 'その他';
      workTypeHours[wType] = (workTypeHours[wType] || 0) + hours;
      
      const wName = log.workers?.name || '不明';
      workerTypeHours[wName] = (workerTypeHours[wName] || 0) + hours;
    });

    const workPieData = Object.keys(workTypeHours).map(k => ({
      name: k,
      value: Number(workTypeHours[k].toFixed(1))
    })).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

    const workerPieData = Object.keys(workerTypeHours).map(k => ({
      name: k,
      value: Number(workerTypeHours[k].toFixed(1))
    })).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

    return { workPieData, workerPieData };
  }, [targetWorkLogs]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6 pb-16 pt-4 sm:pt-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b-2 border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight mb-2 flex items-center gap-3">
            <Sprout className="w-8 h-8 text-emerald-500" />
            作目別 分析
          </h1>
          <p className="text-sm md:text-base text-slate-500 font-medium">
            作物ごとの収益性（予実）や、作業・作業者ごとの稼働時間を分析します。
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <select 
            value={year} 
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-white border border-slate-200 rounded-lg px-4 py-2 font-bold text-slate-700 shadow-sm focus:ring-2 focus:ring-emerald-500"
          >
            {[...Array(5)].map((_, i) => {
              const y = new Date().getFullYear() - 2 + i;
              return <option key={y} value={y}>{y}年度</option>;
            })}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* 作目別 予実・利益一覧表 */}
          <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-6 h-6 text-emerald-500" />
              <h2 className="text-xl font-black text-slate-800">作目別 予実・利益一覧</h2>
              <HelpTooltip content="予定（予算）と実績を比較し、最も利益が出ている作目を把握できます。" />
            </div>
            
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 font-bold border-b border-slate-200">作目</th>
                    <th className="px-4 py-3 font-bold border-b border-slate-200 text-right">売上(予/実)</th>
                    <th className="px-4 py-3 font-bold border-b border-slate-200 text-right">コスト(予/実)</th>
                    <th className="px-4 py-3 font-bold border-b border-slate-200 text-right">利益(予/実)</th>
                    <th className="px-4 py-3 font-bold border-b border-slate-200 text-center">売上達成率</th>
                  </tr>
                </thead>
                <tbody>
                  {cropStats.length > 0 ? cropStats.map((stat) => (
                    <tr key={stat.id} className="bg-white border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-4 font-black text-slate-700 text-base">{stat.name}</td>
                      <td className="px-4 py-4 text-right">
                        <div className="text-slate-400 text-xs">¥{stat.plannedSales.toLocaleString()}</div>
                        <div className="font-bold text-slate-800 text-base">¥{stat.actualSales.toLocaleString()}</div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="text-slate-400 text-xs">¥{stat.plannedCost.toLocaleString()}</div>
                        <div className="font-bold text-rose-500 text-base">¥{stat.actualCost.toLocaleString()}</div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="text-slate-400 text-xs">¥{stat.plannedProfit.toLocaleString()}</div>
                        <div className="font-black text-emerald-600 text-base">¥{stat.actualProfit.toLocaleString()}</div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${stat.progressRate >= 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {stat.progressRate}%
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-slate-400 font-medium">データがありません</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* 作業時間の円グラフ分析 */}
          <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Clock className="w-6 h-6 text-blue-500" />
                <h2 className="text-xl font-black text-slate-800">作業時間 分析</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-600">対象作目:</span>
                <select 
                  value={selectedCropId} 
                  onChange={(e) => setSelectedCropId(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 font-bold text-slate-700 shadow-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">すべて（全作目）</option>
                  {crops.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 shadow-inner">
                <h3 className="text-center font-black text-slate-700 mb-6 flex items-center justify-center gap-2">
                  <BarChart2 className="w-5 h-5 text-rose-500" />
                  作業内容別の時間割合
                </h3>
                {workPieData.length > 0 ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={workPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={true}
                        >
                          {workPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value: number) => [`${value} 時間`, '稼働時間']} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-72 flex items-center justify-center text-slate-400 font-medium">作業記録がありません</div>
                )}
              </div>

              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 shadow-inner">
                <h3 className="text-center font-black text-slate-700 mb-6 flex items-center justify-center gap-2">
                  <User className="w-5 h-5 text-blue-500" />
                  作業者別の時間割合
                </h3>
                {workerPieData.length > 0 ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={workerPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={true}
                        >
                          {workerPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={WORKER_COLORS[index % WORKER_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value: number) => [`${value} 時間`, '稼働時間']} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-72 flex items-center justify-center text-slate-400 font-medium">作業記録がありません</div>
                )}
              </div>

            </div>
          </section>

        </div>
      )}
    </div>
  );
}
