"use client";

import React, { useEffect, useState } from 'react';
import { 
  PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, CartesianGrid,
  ComposedChart, Line, Area, AreaChart
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { Activity, Clock, Sprout, TrendingUp, Banknote, UserCheck, CalendarDays, MapPin, Calculator } from 'lucide-react';

// --- 直感的なグラフ用の色設定 ---
const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e'];

export default function DashboardPage() {
  const [cropData, setCropData] = useState<any[]>([]);
  const [workerData, setWorkerData] = useState<any[]>([]);
  const [profitabilityData, setProfitabilityData] = useState<any[]>([]);
  const [fieldData, setFieldData] = useState<any[]>([]); // 圃場別データ
  const [workerProductivityData, setWorkerProductivityData] = useState<any[]>([]); // 個人別生産性
  const [monthlyTrendData, setMonthlyTrendData] = useState<any[]>([]); // 月別推移データ
  const [summary, setSummary] = useState({ sales: 0, laborCost: 0, materialCost: 0, profit: 0, margin: 0 }); // サマリーKPI
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        // Supabaseから作業ログと売上ログを取得
        const [workRes, salesRes] = await Promise.all([
          supabase.from('work_logs').select(`
            work_date,
            duration_minutes,
            material_quantity,
            crops(name),
            workers(name, hourly_wage),
            materials(name, default_price),
            fields(name)
          `),
          supabase.from('sales_logs').select(`
            sales_date,
            total_sales,
            crops(name),
            sales_channels(name)
          `)
        ]);

        const workLogs = workRes.data || [];
        const salesLogs = salesRes.data || [];

        // 1. 基本集計
        const cropHours: Record<string, number> = {}; 
        const workerHours: Record<string, number> = {}; 
        const fieldHours: Record<string, number> = {}; // 圃場別時間
        
        const cropWageMap: Record<string, number> = {}; 
        const cropMaterialCostMap: Record<string, number> = {}; 
        const fieldWageMap: Record<string, number> = {}; // 圃場別人件費
        const fieldMaterialCostMap: Record<string, number> = {}; // 圃場別資材費
        
        const workerCropHours: Record<string, Record<string, number>> = {}; 
        const workerWages: Record<string, number> = {}; 
        const workerTotalCost: Record<string, number> = {}; 

        const monthlyMap: Record<string, { 売上: number, コスト: number }> = {};
        
        // 圃場への売上按分用
        const cropToFieldHours: Record<string, Record<string, number>> = {}; // crop -> field -> hours

        let totalLaborCost = 0;
        let totalMaterialCost = 0;

        workLogs.forEach((log: any) => {
          const cName = log.crops?.name || '未設定';
          const wName = log.workers?.name || '不明';
          const fName = log.fields?.name || '未設定';
          const dur = log.duration_minutes || 0;
          const wage = log.workers?.hourly_wage || 1000;
          const matQty = log.material_quantity || 0;
          const matPrice = log.materials?.default_price || 0;
          const dateStr = log.work_date;

          const laborCost = (dur / 60) * wage;
          const matCost = matQty * matPrice;

          totalLaborCost += laborCost;
          totalMaterialCost += matCost;

          // 作目別
          cropHours[cName] = (cropHours[cName] || 0) + dur;
          cropWageMap[cName] = (cropWageMap[cName] || 0) + laborCost;
          cropMaterialCostMap[cName] = (cropMaterialCostMap[cName] || 0) + matCost;

          // 圃場別
          fieldHours[fName] = (fieldHours[fName] || 0) + dur;
          fieldWageMap[fName] = (fieldWageMap[fName] || 0) + laborCost;
          fieldMaterialCostMap[fName] = (fieldMaterialCostMap[fName] || 0) + matCost;

          // 作目->圃場の時間比率計算用
          if (!cropToFieldHours[cName]) cropToFieldHours[cName] = {};
          cropToFieldHours[cName][fName] = (cropToFieldHours[cName][fName] || 0) + dur;

          // 作業者別
          workerHours[wName] = (workerHours[wName] || 0) + dur;
          if (!workerCropHours[wName]) workerCropHours[wName] = {};
          workerCropHours[wName][cName] = (workerCropHours[wName][cName] || 0) + dur;
          workerWages[wName] = wage;
          workerTotalCost[wName] = (workerTotalCost[wName] || 0) + laborCost;

          // 月別コスト
          if (dateStr) {
            const monthStr = dateStr.substring(0, 7); 
            if (!monthlyMap[monthStr]) monthlyMap[monthStr] = { 売上: 0, コスト: 0 };
            monthlyMap[monthStr].コスト += (laborCost + matCost);
          }
        });

        // 2. 売上集計
        const cropSalesMap: Record<string, number> = {};
        const fieldSalesMap: Record<string, number> = {};
        let totalSales = 0;

        salesLogs.forEach((log: any) => {
          const cName = log.crops?.name || '未設定';
          const sales = log.total_sales || 0;
          const dateStr = log.sales_date;

          totalSales += sales;
          cropSalesMap[cName] = (cropSalesMap[cName] || 0) + sales;

          // 月別売上
          if (dateStr) {
            const monthStr = dateStr.substring(0, 7); 
            if (!monthlyMap[monthStr]) monthlyMap[monthStr] = { 売上: 0, コスト: 0 };
            monthlyMap[monthStr].売上 += sales;
          }
        });

        // 圃場への売上按分 (作目の売上を、その作目が植えられている圃場の作業時間比率で分配)
        Object.keys(cropSalesMap).forEach(cName => {
          const cSales = cropSalesMap[cName];
          const fHours = cropToFieldHours[cName];
          if (fHours) {
            const totalHours = Object.values(fHours).reduce((sum, h) => sum + h, 0);
            Object.keys(fHours).forEach(fName => {
              const ratio = totalHours > 0 ? fHours[fName] / totalHours : 0;
              fieldSalesMap[fName] = (fieldSalesMap[fName] || 0) + (cSales * ratio);
            });
          }
        });

        // サマリー設定
        const totalProfit = totalSales - (totalLaborCost + totalMaterialCost);
        const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;
        setSummary({ sales: totalSales, laborCost: totalLaborCost, materialCost: totalMaterialCost, profit: totalProfit, margin: profitMargin });

        // 3. グラフデータ生成
        const cData = Object.keys(cropHours).map(k => ({ name: k, value: cropHours[k] }));
        const wData = Object.keys(workerHours).map(k => ({ name: k, 時間: workerHours[k] }));
        
        // --- 4. 作目別 採算性 ---
        const cropNetProfits: Record<string, number> = {}; 
        
        const pData = Object.keys(cropHours).map(k => {
          const hours = cropHours[k] / 60;
          const sales = cropSalesMap[k] || 0;
          const totalCost = (cropWageMap[k] || 0) + (cropMaterialCostMap[k] || 0);
          const netProfit = sales - totalCost;
          cropNetProfits[k] = netProfit; 
          
          return {
            name: k,
            時給換算: hours > 0 ? Math.round(netProfit / hours) : 0,
            売上: sales,
            コスト: Math.round(totalCost),
            利益: Math.round(netProfit),
            利益率: sales > 0 ? Math.round((netProfit / sales) * 100) : 0
          };
        }).sort((a, b) => b.利益 - a.利益);

        // --- 5. 圃場別 採算性 ---
        const fData = Object.keys(fieldHours).map(k => {
          const sales = fieldSalesMap[k] || 0;
          const totalCost = (fieldWageMap[k] || 0) + (fieldMaterialCostMap[k] || 0);
          const netProfit = sales - totalCost;
          return {
            name: k,
            売上: Math.round(sales),
            コスト: Math.round(totalCost),
            利益: Math.round(netProfit),
            利益率: sales > 0 ? Math.round((netProfit / sales) * 100) : 0
          };
        }).sort((a, b) => b.利益 - a.利益);

        // --- 6. 個人別 生産性 ---
        const wpData = Object.keys(workerHours).map(wName => {
          let createdValue = 0;
          const wCrops = workerCropHours[wName];
          
          Object.keys(wCrops).forEach(cName => {
            const myHours = wCrops[cName];
            const totalHours = cropHours[cName];
            if (totalHours > 0) {
              const myContributionRatio = myHours / totalHours;
              createdValue += (cropNetProfits[cName] || 0) * myContributionRatio;
            }
          });
          
          const totalMyHours = workerHours[wName] / 60;
          const productivity = totalMyHours > 0 ? Math.round((createdValue - workerTotalCost[wName]) / totalMyHours) : 0;
          
          return {
            name: wName,
            生産性: productivity,
            時給: workerWages[wName] || 1000,
            貢献利益: Math.round(createdValue)
          };
        }).sort((a, b) => b.生産性 - a.生産性);

        // --- 7. 月別推移データ ---
        let cumulativeProfit = 0;
        const mTrendData = Object.keys(monthlyMap).sort().map(monthStr => {
          const sales = monthlyMap[monthStr].売上;
          const cost = monthlyMap[monthStr].コスト;
          const profit = sales - cost;
          cumulativeProfit += profit;
          return {
            month: monthStr, 
            売上: sales,
            コスト: Math.round(cost),
            単月利益: Math.round(profit),
            累計利益: Math.round(cumulativeProfit)
          };
        });

        setCropData(cData);
        setWorkerData(wData);
        setProfitabilityData(pData);
        setFieldData(fData);
        setWorkerProductivityData(wpData);
        setMonthlyTrendData(mTrendData);

      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const CustomProfitTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 backdrop-blur-md text-slate-100 p-4 rounded-xl shadow-2xl border border-slate-700 font-bold text-sm min-w-[200px]">
          <p className="text-base text-emerald-400 mb-2 border-b border-slate-700 pb-1">{label}</p>
          <div className="space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">売上:</span><span className="text-white">¥{data.売上?.toLocaleString() || 0}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">コスト:</span><span className="text-rose-400">¥{data.コスト?.toLocaleString() || 0}</span></div>
            <div className="border-t border-slate-700 my-1.5"></div>
            <div className="flex justify-between items-center"><span className="text-slate-400">純利益:</span><span className={`text-lg ${data.利益 >= 0 ? 'text-amber-400' : 'text-rose-500'}`}>¥{data.利益?.toLocaleString() || 0}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">利益率:</span><span className="text-blue-300">{data.利益率 || 0}%</span></div>
            {data.時給換算 !== undefined && (
              <div className="flex justify-between mt-2 pt-2 border-t border-slate-700/50"><span className="text-slate-400">時給換算:</span><span className="text-emerald-300">¥{data.時給換算.toLocaleString()}/h</span></div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-500 font-bold tracking-widest">集計中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      
      {/* ページヘッダー */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b-2 border-slate-200 pb-6">
        <div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-2">経営ダッシュボード</h1>
          <p className="text-slate-500 font-medium">作業・売上データから農園の健康状態（P&L）をリアルタイムに可視化します。</p>
        </div>
        <div className="bg-white/50 backdrop-blur border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold text-slate-600 shadow-sm flex items-center gap-2">
          <Calculator className="w-4 h-4 text-emerald-500" /> 全期間の集計データ
        </div>
      </div>

      {/* --- サマリー (P&L) カード群 --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
          <div className="text-blue-100 font-bold mb-1 flex items-center gap-2"><Banknote className="w-4 h-4" /> 総売上</div>
          <div className="text-3xl font-black tracking-tight">¥{summary.sales.toLocaleString()}</div>
        </div>
        
        <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
          <div className="text-rose-100 font-bold mb-1 flex items-center gap-2"><Activity className="w-4 h-4" /> 総コスト (人件費＋資材)</div>
          <div className="text-3xl font-black tracking-tight">¥{(summary.laborCost + summary.materialCost).toLocaleString()}</div>
        </div>
        
        <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group lg:col-span-2">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
          <div className="text-amber-100 font-bold mb-1 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> 営業利益 (純利益)</div>
          <div className="flex items-baseline gap-4">
            <div className="text-4xl font-black tracking-tight">¥{summary.profit.toLocaleString()}</div>
            <div className="text-lg font-bold bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
              利益率 {summary.margin.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* --- 月別推移トレンド --- */}
      <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-slate-100 rounded-xl text-slate-700">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800">経営推移トレンド</h2>
            <p className="text-sm text-slate-500 font-medium">単月の売上・コストと、累計利益の推移（黒字転換のタイミング）</p>
          </div>
        </div>
        
        <div className="w-full h-[400px]">
          {monthlyTrendData.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-slate-400">データがありません</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyTrendData} margin={{ top: 20, right: 20, bottom: 0, left: 20 }}>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{fill: '#64748b', fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(val) => `¥${(val/10000).toFixed(0)}万`} tick={{fill: '#64748b'}} axisLine={false} tickLine={false} />
                <Tooltip 
                  formatter={(val: any, name: any) => [`¥${val.toLocaleString()}`, String(name || '')]}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px', fontWeight: 'bold' }} />
                
                <Bar dataKey="売上" barSize={32} fill="#3b82f6" radius={[4, 4, 0, 0]} name="売上" />
                <Bar dataKey="コスト" barSize={32} fill="#ef4444" radius={[4, 4, 0, 0]} name="コスト" />
                <Line type="monotone" dataKey="単月利益" stroke="#f59e0b" strokeWidth={3} dot={{r: 4}} name="単月利益" />
                <Area type="monotone" dataKey="累計利益" fill="#10b981" stroke="#10b981" fillOpacity={0.1} strokeWidth={3} name="累計利益" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* --- 分析グラフ群 (作目・圃場・人) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 作目別採算性 */}
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col h-[450px]">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-700">
              <Sprout className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800">作目別 採算性</h3>
              <p className="text-sm text-slate-500">最も利益率が高い作目は？</p>
            </div>
          </div>
          <div className="flex-1 w-full">
            {profitabilityData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-slate-400">データがありません</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={profitabilityData} margin={{ top: 0, right: 0, left: -20, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} angle={-45} textAnchor="end" />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(val) => `¥${(val/10000).toFixed(0)}万`} />
                  <Tooltip content={<CustomProfitTooltip />} cursor={{fill: '#f8fafc'}} />
                  <Bar dataKey="利益" radius={[6, 6, 0, 0]} maxBarSize={50}>
                    {profitabilityData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.利益 >= 0 ? '#10b981' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* 圃場別採算性 */}
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col h-[450px]">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-teal-100 rounded-xl text-teal-700">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800">圃場別 採算性</h3>
              <p className="text-sm text-slate-500">収益性の高い畑を特定</p>
            </div>
          </div>
          <div className="flex-1 w-full">
            {fieldData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-slate-400">データがありません</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fieldData} margin={{ top: 0, right: 0, left: -20, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} angle={-45} textAnchor="end" />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(val) => `¥${(val/10000).toFixed(0)}万`} />
                  <Tooltip content={<CustomProfitTooltip />} cursor={{fill: '#f8fafc'}} />
                  <Bar dataKey="利益" radius={[6, 6, 0, 0]} maxBarSize={50}>
                    {fieldData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.利益 >= 0 ? '#14b8a6' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* 個人別生産性 */}
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col h-[450px] lg:col-span-2">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-purple-100 rounded-xl text-purple-700">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800">スタッフ別 生産性（利益貢献度）</h3>
              <p className="text-sm text-slate-500">1時間あたりに生み出している利益額（時給換算）</p>
            </div>
          </div>
          <div className="flex-1 w-full">
            {workerProductivityData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-slate-400">データがありません</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workerProductivityData} margin={{ top: 0, right: 0, left: -20, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} angle={-45} textAnchor="end" />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(val) => `¥${val.toLocaleString()}`} />
                  <Tooltip 
                    formatter={(val: any, name: any) => [`¥${val.toLocaleString()}/h`, String(name || '')]}
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="生産性" radius={[6, 6, 0, 0]} maxBarSize={60}>
                    {workerProductivityData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.生産性 >= 0 ? '#8b5cf6' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
