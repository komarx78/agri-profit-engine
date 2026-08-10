"use client";

import React, { useEffect, useState } from 'react';
import { 
  PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, CartesianGrid,
  ComposedChart, Line
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { Activity, Clock, Sprout, TrendingUp, Banknote, UserCheck, CalendarDays } from 'lucide-react';

// --- 直感的なグラフ用の色設定 ---
const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6'];

export default function DashboardPage() {
  const [cropData, setCropData] = useState<any[]>([]);
  const [workerData, setWorkerData] = useState<any[]>([]);
  const [profitabilityData, setProfitabilityData] = useState<any[]>([]);
  const [channelSalesData, setChannelSalesData] = useState<any[]>([]);
  const [workerProductivityData, setWorkerProductivityData] = useState<any[]>([]); // 個人別生産性
  const [monthlyTrendData, setMonthlyTrendData] = useState<any[]>([]); // 月別推移データ
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
            materials(name, default_price)
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
        const cropHours: Record<string, number> = {}; // 作目別総時間(分)
        const workerHours: Record<string, number> = {}; // 作業者別総時間(分)
        const cropWageMap: Record<string, number> = {}; // 作目別総人件費
        const cropMaterialCostMap: Record<string, number> = {}; // 作目別総資材費
        
        // 個人別集計用
        const workerCropHours: Record<string, Record<string, number>> = {}; // worker -> crop -> minutes
        const workerWages: Record<string, number> = {}; // worker -> hourly_wage
        const workerTotalCost: Record<string, number> = {}; // worker -> 総人件費

        // 月別推移集計用
        const monthlyMap: Record<string, { 売上: number, コスト: number }> = {};

        workLogs.forEach((log: any) => {
          const cName = log.crops?.name || '不明';
          const wName = log.workers?.name || '不明';
          const dur = log.duration_minutes || 0;
          const wage = log.workers?.hourly_wage || 1000;
          const matQty = log.material_quantity || 0;
          const matPrice = log.materials?.default_price || 0;
          const dateStr = log.work_date;

          cropHours[cName] = (cropHours[cName] || 0) + dur;
          workerHours[wName] = (workerHours[wName] || 0) + dur;
          
          const laborCost = (dur / 60) * wage;
          const matCost = matQty * matPrice;
          
          cropWageMap[cName] = (cropWageMap[cName] || 0) + laborCost;
          cropMaterialCostMap[cName] = (cropMaterialCostMap[cName] || 0) + matCost;

          if (!workerCropHours[wName]) workerCropHours[wName] = {};
          workerCropHours[wName][cName] = (workerCropHours[wName][cName] || 0) + dur;
          workerWages[wName] = wage;
          workerTotalCost[wName] = (workerTotalCost[wName] || 0) + laborCost;

          // 月別コスト集計
          if (dateStr) {
            const monthStr = dateStr.substring(0, 7); // YYYY-MM
            if (!monthlyMap[monthStr]) monthlyMap[monthStr] = { 売上: 0, コスト: 0 };
            monthlyMap[monthStr].コスト += (laborCost + matCost);
          }
        });

        // 2. 売上集計
        const cropSalesMap: Record<string, number> = {};
        const channelSalesMap: Record<string, number> = {};

        salesLogs.forEach((log: any) => {
          const cName = log.crops?.name || '不明';
          const chName = log.sales_channels?.name || '不明';
          const sales = log.total_sales || 0;
          const dateStr = log.sales_date;

          cropSalesMap[cName] = (cropSalesMap[cName] || 0) + sales;
          channelSalesMap[chName] = (channelSalesMap[chName] || 0) + sales;

          // 月別売上集計
          if (dateStr) {
            const monthStr = dateStr.substring(0, 7); // YYYY-MM
            if (!monthlyMap[monthStr]) monthlyMap[monthStr] = { 売上: 0, コスト: 0 };
            monthlyMap[monthStr].売上 += sales;
          }
        });

        // モックフォールバック
        if (workLogs.length === 0 && salesLogs.length === 0) {
          setCropData([{ name: '伏見唐辛子', value: 320 }]);
          setWorkerData([{ name: '京都 太郎', 時間: 400 }]);
          setProfitabilityData([{ name: '伏見唐辛子', 時給換算: 2500, 売上: 150000, コスト: 50000, 利益: 100000, 利益率: 66 }]);
          setChannelSalesData([{ name: 'JA', 売上: 100000 }]);
          setWorkerProductivityData([{ name: '京都 太郎', 生産性: 1500, 設定時給: 1000 }]);
          setMonthlyTrendData([{ month: '2026-08', 売上: 150000, コスト: 50000, 利益: 100000 }]);
          setIsLoading(false);
          return;
        }

        // 3. グラフデータ生成
        const cData = Object.keys(cropHours).map(k => ({ name: k, value: cropHours[k] }));
        const wData = Object.keys(workerHours).map(k => ({ name: k, 時間: workerHours[k] }));
        
        // --- 4. 作目別 採算性（利益率を追加） ---
        const cropNetProfits: Record<string, number> = {}; // 作目別の純利益
        
        const pData = Object.keys(cropHours).map(k => {
          const hours = cropHours[k] / 60;
          const sales = cropSalesMap[k] || 0;
          const laborCost = cropWageMap[k] || 0;
          const materialCost = cropMaterialCostMap[k] || 0;
          const totalCost = laborCost + materialCost;
          
          const netProfit = sales - totalCost;
          cropNetProfits[k] = netProfit; // 保存
          
          const hourlyProfit = hours > 0 ? Math.round(netProfit / hours) : 0;
          const profitMargin = sales > 0 ? Math.round((netProfit / sales) * 100) : (netProfit < 0 ? -100 : 0);
          
          return {
            name: k,
            時給換算: hourlyProfit,
            売上: sales,
            コスト: Math.round(totalCost),
            利益: Math.round(netProfit),
            利益率: profitMargin
          };
        }).sort((a, b) => b.利益 - a.利益); // 利益額順に並び替え

        const chData = Object.keys(channelSalesMap).map(k => ({ 
          name: k, 
          売上: channelSalesMap[k] 
        })).sort((a, b) => b.売上 - a.売上);

        // --- 5. 個人別 生産性分析 ---
        const wpData = Object.keys(workerHours).map(wName => {
          let createdValue = 0;
          const wCrops = workerCropHours[wName];
          
          Object.keys(wCrops).forEach(cName => {
            const myHours = wCrops[cName];
            const totalHours = cropHours[cName];
            if (totalHours > 0) {
              const myContributionRatio = myHours / totalHours;
              const cropProfit = cropNetProfits[cName] || 0;
              createdValue += cropProfit * myContributionRatio;
            }
          });
          
          const totalMyHours = workerHours[wName] / 60;
          const productivity = totalMyHours > 0 ? Math.round((createdValue - workerTotalCost[wName]) / totalMyHours) : 0;
          
          return {
            name: wName,
            生産性: productivity,
            設定時給: workerWages[wName] || 1000
          };
        }).sort((a, b) => b.生産性 - a.生産性);

        // --- 6. 月別推移データ ---
        const mTrendData = Object.keys(monthlyMap).sort().map(monthStr => {
          const sales = monthlyMap[monthStr].売上;
          const cost = monthlyMap[monthStr].コスト;
          return {
            month: monthStr, // 'YYYY-MM'
            売上: sales,
            コスト: Math.round(cost),
            利益: Math.round(sales - cost)
          };
        });

        setCropData(cData);
        setWorkerData(wData);
        setProfitabilityData(pData);
        setChannelSalesData(chData);
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

  // Tooltipのカスタムレンダラー（作目別チャート用）
  const CustomProfitTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 backdrop-blur text-slate-100 p-4 rounded-xl shadow-xl border border-slate-700 font-bold text-sm">
          <p className="text-base text-emerald-400 mb-2 border-b border-slate-700 pb-1">{label}</p>
          <div className="space-y-1">
            <p className="text-white">売上: ¥{data.売上.toLocaleString()}</p>
            <p className="text-rose-400">コスト: ¥{data.コスト.toLocaleString()}</p>
            <div className="border-t border-slate-700 my-1 pt-1"></div>
            <p className="text-amber-400 text-lg">利益: ¥{data.利益.toLocaleString()}</p>
            <p className="text-blue-300">利益率: {data.利益率}%</p>
            <p className="text-emerald-300">時給換算: ¥{data.時給換算.toLocaleString()}/h</p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-12">
      <div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">経営・採算性ダッシュボード</h1>
        <p className="text-slate-500 mt-2 font-medium">作業時間、資材費、売上データから自動計算。真の利益を可視化します。</p>
      </div>

      {/* --- 新セクション: 時系列トレンド --- */}
      <section>
        <h2 className="text-2xl font-bold text-slate-800 border-b-2 border-amber-500 pb-2 mb-6 inline-block">
          📅 経営推移（月別トレンド）
        </h2>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[450px]">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-700">月別の売上・コスト・利益の推移</h3>
              <p className="text-sm text-slate-400">出荷記録と作業記録から自動集計</p>
            </div>
          </div>
          
          <div className="flex-1 w-full mt-4">
            {isLoading ? (
              <div className="w-full h-full flex items-center justify-center text-slate-400">読み込み中...</div>
            ) : monthlyTrendData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-slate-400">データがありません</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyTrendData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" tick={{fill: '#64748b', fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(val) => `¥${val.toLocaleString()}`} tick={{fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <Tooltip 
                    formatter={(val: any, name: any) => [`¥${val.toLocaleString()}`, String(name || '')]}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px', fontWeight: 'bold' }} />
                  <Bar dataKey="売上" barSize={40} fill="#3b82f6" radius={[4, 4, 0, 0]} name="売上 (円)" />
                  <Bar dataKey="コスト" barSize={40} fill="#ef4444" radius={[4, 4, 0, 0]} name="総コスト (円)" />
                  <Line type="monotone" dataKey="利益" stroke="#10b981" strokeWidth={4} dot={{r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 8}} name="純利益 (円)" />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-slate-800 border-b-2 border-emerald-500 pb-2 mb-6 inline-block">
          💰 採算性分析（作目・個人）
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ① 作目別 採算性（利益・利益率） */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[420px]">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-700">作目別 利益・利益率</h3>
                <p className="text-sm text-slate-400">一番儲かっている作目は？（グラフにマウスを合わせて詳細確認）</p>
              </div>
            </div>
            
            <div className="flex-1 w-full mt-4">
              {isLoading ? (
                <div className="w-full h-full flex items-center justify-center text-slate-400">読み込み中...</div>
              ) : profitabilityData.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-slate-400">データがありません</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={profitabilityData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} angle={-45} textAnchor="end" />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(val) => `¥${val.toLocaleString()}`} />
                    <Tooltip content={<CustomProfitTooltip />} cursor={{fill: '#f1f5f9'}} />
                    <Bar dataKey="利益" radius={[6, 6, 0, 0]} maxBarSize={60}>
                      {profitabilityData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.利益 >= 0 ? '#10b981' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ② 個人別 生産性分析 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[420px]">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-700">個人別 生産性（利益貢献度）</h3>
                <p className="text-sm text-slate-400">1時間あたりいくらの利益を生み出しているか？</p>
              </div>
            </div>
            
            <div className="flex-1 w-full mt-4">
              {isLoading ? (
                <div className="w-full h-full flex items-center justify-center text-slate-400">読み込み中...</div>
              ) : workerProductivityData.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-slate-400">データがありません</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workerProductivityData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} angle={-45} textAnchor="end" />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(val) => `¥${val.toLocaleString()}`} />
                    <Tooltip 
                      formatter={(val: any, name: any) => [`¥${val.toLocaleString()}/h`, String(name || '')]}
                      cursor={{fill: '#f1f5f9'}}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
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
          </div>
        </div>
      </section>

      {/* --- Section 3: 作業時間 --- */}
      <section className="pt-8 border-t border-slate-200">
        <h2 className="text-xl font-bold text-slate-500 mb-6 inline-block">⏱️ 作業時間の内訳</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 opacity-80 hover:opacity-100 transition-opacity">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-80">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><Sprout className="w-5 h-5" /></div>
              <h3 className="text-lg font-bold text-slate-700">一番手がかかっている作目は？</h3>
            </div>
            <div className="flex-1 w-full">
              {!isLoading && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={cropData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`} labelLine={false}>
                      {cropData.map((e, idx) => <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(val: any) => [`${val} 分`, '作業時間']} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-80">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-slate-100 rounded-lg text-slate-600"><Activity className="w-5 h-5" /></div>
              <h3 className="text-lg font-bold text-slate-700">誰が一番長く作業したか？</h3>
            </div>
            <div className="flex-1 w-full">
              {!isLoading && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workerData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} fontWeight="bold" width={80} />
                    <Tooltip formatter={(val: any) => [`${val} 分`, '作業時間']} cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '12px', border: 'none' }} />
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
