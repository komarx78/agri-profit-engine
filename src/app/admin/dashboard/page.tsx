"use client";

import React, { useEffect, useState } from 'react';
import { 
  PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, CartesianGrid,
  ComposedChart, Line, Area, AreaChart
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { HelpTooltip } from '@/components/HelpTooltip';
import { Activity, Clock, Sprout, TrendingUp, Banknote, UserCheck, CalendarDays, MapPin, Calculator, Settings2 } from 'lucide-react';

// --- 直感的なグラフ用の色設定 ---
const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e'];

export default function DashboardPage() {
  // 表示モード (実績のみ or 予定込み)
  const [dataViewMode, setDataViewMode] = useState<'actualOnly' | 'includePlanned'>('actualOnly');
  // 概算資材費の割合(%) - ダッシュボードでは全体のシミュレーションとして概算をベースとする
  const [estimateRate, setEstimateRate] = useState<number>(20);

  const [cropData, setCropData] = useState<any[]>([]);
  const [workerData, setWorkerData] = useState<any[]>([]);
  const [profitabilityData, setProfitabilityData] = useState<any[]>([]);
  const [fieldData, setFieldData] = useState<any[]>([]);
  const [workerProductivityData, setWorkerProductivityData] = useState<any[]>([]);
  const [monthlyTrendData, setMonthlyTrendData] = useState<any[]>([]);
  const [summary, setSummary] = useState({ sales: 0, laborCost: 0, materialCost: 0, profit: 0, margin: 0 });
  const [tenantId, setTenantId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        // Supabaseから作業ログと売上ログ、およびユーザー情報を取得
        const [workRes, salesRes, userRes] = await Promise.all([
          supabase.from('work_logs').select(`
            work_date,
            duration_minutes,
            material_quantity,
            status,
            crops(name),
            workers(name, hourly_wage),
            materials(name, default_price),
            fields(name)
          `),
          supabase.from('sales_logs').select(`
            sales_date,
            total_sales,
            status,
            crops(name),
            sales_channels(name)
          `),
          supabase.auth.getUser()
        ]);

        let currentOwnerId = userRes.data.user?.id || '';
        if (!currentOwnerId && typeof window !== 'undefined') {
          currentOwnerId = localStorage.getItem('agri_owner_id') || '';
          if (!currentOwnerId) {
            const savedWorker = localStorage.getItem('agri_current_worker');
            if (savedWorker) {
              try {
                const wObj = JSON.parse(savedWorker);
                currentOwnerId = wObj.user_id || '';
              } catch (e) {}
            }
          }
        }
        if (currentOwnerId) {
          setTenantId(currentOwnerId);
        }

        const rawWorkLogs = workRes.data || [];
        const rawSalesLogs = salesRes.data || [];

        // --- フィルタリング (予実分離) ---
        const workLogs = rawWorkLogs.filter((log: any) => 
          dataViewMode === 'includePlanned' ? true : log.status === 'completed'
        );
        const salesLogs = rawSalesLogs.filter((log: any) => 
          dataViewMode === 'includePlanned' ? true : log.status === 'completed'
        );

        // --- 集計用マップの準備 ---
        const cropHours: Record<string, number> = {}; 
        const workerHours: Record<string, number> = {}; 
        const fieldHours: Record<string, number> = {};
        
        const cropWageMap: Record<string, number> = {}; 
        const fieldWageMap: Record<string, number> = {};
        const cropDetailedMaterialMap: Record<string, number> = {}; 
        const fieldDetailedMaterialMap: Record<string, number> = {};
        
        const workerCropHours: Record<string, Record<string, number>> = {}; 
        const workerWages: Record<string, number> = {}; 
        const workerTotalCost: Record<string, number> = {}; 

        const monthlyMap: Record<string, { 売上: number, 人件費: number, 詳細資材費: number }> = {};
        const cropToFieldHours: Record<string, Record<string, number>> = {}; 

        // 1. 売上の基本集計
        const cropSalesMap: Record<string, number> = {};
        let totalSales = 0;

        salesLogs.forEach((log: any) => {
          const cName = log.crops?.name || '未設定';
          const sales = log.total_sales || 0;
          const dateStr = log.sales_date;

          totalSales += sales;
          cropSalesMap[cName] = (cropSalesMap[cName] || 0) + sales;

          if (dateStr) {
            const monthStr = dateStr.substring(0, 7); 
            if (!monthlyMap[monthStr]) monthlyMap[monthStr] = { 売上: 0, 人件費: 0, 詳細資材費: 0 };
            monthlyMap[monthStr].売上 += sales;
          }
        });

        // 2. 作業・コストの基本集計
        let totalLaborCost = 0;
        let totalDetailedMaterialCost = 0;

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
          totalDetailedMaterialCost += matCost;

          cropHours[cName] = (cropHours[cName] || 0) + dur;
          cropWageMap[cName] = (cropWageMap[cName] || 0) + laborCost;
          cropDetailedMaterialMap[cName] = (cropDetailedMaterialMap[cName] || 0) + matCost;

          fieldHours[fName] = (fieldHours[fName] || 0) + dur;
          fieldWageMap[fName] = (fieldWageMap[fName] || 0) + laborCost;
          fieldDetailedMaterialMap[fName] = (fieldDetailedMaterialMap[fName] || 0) + matCost;

          if (!cropToFieldHours[cName]) cropToFieldHours[cName] = {};
          cropToFieldHours[cName][fName] = (cropToFieldHours[cName][fName] || 0) + dur;

          workerHours[wName] = (workerHours[wName] || 0) + dur;
          if (!workerCropHours[wName]) workerCropHours[wName] = {};
          workerCropHours[wName][cName] = (workerCropHours[wName][cName] || 0) + dur;
          workerWages[wName] = wage;
          workerTotalCost[wName] = (workerTotalCost[wName] || 0) + laborCost;

          if (dateStr) {
            const monthStr = dateStr.substring(0, 7); 
            if (!monthlyMap[monthStr]) monthlyMap[monthStr] = { 売上: 0, 人件費: 0, 詳細資材費: 0 };
            monthlyMap[monthStr].人件費 += laborCost;
            monthlyMap[monthStr].詳細資材費 += matCost;
          }
        });

        // 3. 圃場への売上按分
        const fieldSalesMap: Record<string, number> = {};
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

        // 4. 資材費の計算適用（ダッシュボードでは全体の経費率として概算を適用）
        const calcMaterialCost = (salesAmt: number) => {
          return salesAmt * (estimateRate / 100);
        };

        const finalTotalMaterialCost = calcMaterialCost(totalSales);

        // サマリー設定
        const totalProfit = totalSales - (totalLaborCost + finalTotalMaterialCost);
        const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;
        setSummary({ 
          sales: totalSales, 
          laborCost: totalLaborCost, 
          materialCost: finalTotalMaterialCost, 
          profit: totalProfit, 
          margin: profitMargin 
        });

        // --- 作目別 採算性 ---
        const cropNetProfits: Record<string, number> = {}; 
        const pData = Object.keys(cropHours).map(k => {
          const hours = cropHours[k] / 60;
          const sales = cropSalesMap[k] || 0;
          const laborCost = cropWageMap[k] || 0;
          const matCost = calcMaterialCost(sales);
          const totalCost = laborCost + matCost;
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

        // --- 圃場別 採算性 ---
        const fData = Object.keys(fieldHours).map(k => {
          const sales = fieldSalesMap[k] || 0;
          const laborCost = fieldWageMap[k] || 0;
          const matCost = calcMaterialCost(sales);
          const totalCost = laborCost + matCost;
          const netProfit = sales - totalCost;
          return {
            name: k,
            売上: Math.round(sales),
            コスト: Math.round(totalCost),
            利益: Math.round(netProfit),
            利益率: sales > 0 ? Math.round((netProfit / sales) * 100) : 0
          };
        }).sort((a, b) => b.利益 - a.利益);

        // --- 個人別 生産性 ---
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

        // --- 月別推移データ ---
        let cumulativeProfit = 0;
        const mTrendData = Object.keys(monthlyMap).sort().map(monthStr => {
          const sales = monthlyMap[monthStr].売上;
          const labor = monthlyMap[monthStr].人件費;
          const mat = calcMaterialCost(sales);
          const cost = labor + mat;
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

        // 作業時間パイチャート用
        const cData = Object.keys(cropHours).map(k => ({ name: k, value: cropHours[k] }));
        
        setCropData(cData);
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
  }, [dataViewMode, estimateRate]); // 設定が変わったら再フェッチ・再計算

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8 pb-16 pt-4 sm:pt-8">
      
      {/* ページヘッダー＆直感的なコントロールパネル */}
      <div className="flex flex-col gap-6 border-b-2 border-slate-200 pb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div className="flex-1 w-full md:w-auto">
            <h1 className="text-2xl md:text-4xl font-black text-slate-800 tracking-tight mb-2">経営ダッシュボード</h1>
            <p className="text-sm md:text-base text-slate-500 font-medium">作業・売上データから農園の健康状態（P&L）をリアルタイムに可視化します。</p>

            {/* 現場用URL（従業員URL）の表示 */}
            {tenantId && (
              <div className="mt-4 bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm w-full md:max-w-2xl">
                <div>
                  <h3 className="font-black text-emerald-800 flex items-center gap-2 text-sm">
                    <UserCheck className="w-4 h-4" /> 現場タブレット（従業員）用 URL
                  </h3>
                  <p className="text-xs text-emerald-600 mt-1 font-medium">※現場の端末で開く際は、必ず管理者アカウントからログアウトしてください。</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                  <input 
                    type="text" 
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/farm/${tenantId}`}
                    className="flex-1 sm:w-64 px-3 py-2 bg-white border border-emerald-200 rounded-lg text-xs font-mono text-slate-600 focus:outline-none"
                    onClick={(e) => e.currentTarget.select()}
                  />
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/farm/${tenantId}`);
                      alert('URLをコピーしました！\n現場の端末で開く際は、必ずこのアカウントからログアウトするか、シークレットウィンドウをご利用ください。');
                    }}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors whitespace-nowrap shadow-sm"
                  >
                    コピー
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* シンプルな経費率設定 */}
          <div className="hidden md:flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200">
            <span className="text-sm font-bold text-slate-600">経費率(資材等)設定:</span>
            <div className="flex items-center gap-1">
              <span className="text-slate-400 text-sm">売上の</span>
              <input 
                type="number" 
                value={estimateRate}
                onChange={(e) => setEstimateRate(Number(e.target.value) || 0)}
                className="bg-slate-100 rounded-lg w-14 px-2 py-1 text-center font-black text-amber-600 outline-none focus:ring-2 focus:ring-amber-400 transition-shadow"
              />
              <span className="text-slate-400 text-sm">%</span>
            </div>
          </div>
        </div>
        
        {/* 大きく直感的な「予実切り替え」タブ */}
        <div className="flex justify-center w-full">
          <div className="bg-slate-100/80 p-1.5 rounded-2xl flex items-center shadow-inner border border-slate-200/60 max-w-md w-full">
            <button
              onClick={() => setDataViewMode('actualOnly')}
              className={`flex-1 py-3 px-4 rounded-xl font-black text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
                dataViewMode === 'actualOnly' 
                  ? 'bg-white text-emerald-600 shadow-[0_2px_10px_rgba(0,0,0,0.08)] scale-100' 
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 scale-95'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${dataViewMode === 'actualOnly' ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
              確定した【実績】のみ
            </button>
            
            <button
              onClick={() => setDataViewMode('includePlanned')}
              className={`flex-1 py-3 px-4 rounded-xl font-black text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
                dataViewMode === 'includePlanned' 
                  ? 'bg-white text-amber-600 shadow-[0_2px_10px_rgba(0,0,0,0.08)] scale-100' 
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 scale-95'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${dataViewMode === 'includePlanned' ? 'bg-amber-500' : 'bg-slate-300'}`}></div>
              予定＋実績【予想】
            </button>
          </div>
        </div>
        
        {/* モバイル用の経費率設定 (画面が小さい時だけ表示) */}
        <div className="md:hidden flex items-center justify-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200 w-fit mx-auto">
          <span className="text-sm font-bold text-slate-600">経費率:</span>
          <div className="flex items-center gap-1">
            <input 
              type="number" 
              value={estimateRate}
              onChange={(e) => setEstimateRate(Number(e.target.value) || 0)}
              className="bg-slate-100 rounded-lg w-14 px-2 py-1 text-center font-black text-amber-600 outline-none"
            />
            <span className="text-slate-400 text-sm">%</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-bold tracking-widest">集計中...</p>
          </div>
        </div>
      ) : (
        <>
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
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                  経営推移トレンド
                  <HelpTooltip content="月ごとの売上・コスト・利益の推移を確認できます。累計利益がゼロを超えたタイミングが黒字転換の目安です。" />
                </h2>
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
                  <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    作目別 採算性
                    <HelpTooltip content="作目ごとの『売上 - コスト』を計算し、どの作目が一番儲かっているか（または赤字か）を可視化します。" />
                  </h3>
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
                  <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    圃場別 採算性
                    <HelpTooltip content="圃場（畑）ごとの収益性を確認できます。環境や土壌の違いによる利益の差を分析するのに役立ちます。" />
                  </h3>
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
        </>
      )}
    </div>
  );
}
