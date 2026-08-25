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
import { 
  Activity, Clock, Sprout, TrendingUp, Banknote, UserCheck, 
  CalendarDays, MapPin, Calculator, Settings2, Loader2, ArrowRight
} from 'lucide-react';
import Link from 'next/link';

// --- 直感的なグラフ用の色設定 ---
const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e'];

export default function ManagementDashboardHub() {
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
  }, [dataViewMode, estimateRate]);

  const CustomProfitTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-700 text-white p-3 rounded-xl shadow-xl text-xs font-bold space-y-1">
          <p className="font-black border-b border-slate-700 pb-1">{data.name}</p>
          <p className="text-emerald-400">時給換算: ¥{data.時給換算?.toLocaleString()}/h</p>
          <p className="text-slate-300">売上: ¥{data.売上?.toLocaleString()}</p>
          <p className="text-rose-300">総コスト: ¥{data.コスト?.toLocaleString()}</p>
          <p className="text-amber-300">営業利益: ¥{data.利益?.toLocaleString()} ({data.利益率}%)</p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-xs font-bold text-slate-400">経営ダッシュボードを集計中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-200">
      
      {/* 上部コントロールバー */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-sm">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-800">📊 経営・採算ダッシュボード</h1>
            <p className="text-xs font-bold text-slate-400">農園全体の売上・人件費・資材費・限界利益をリアルタイム集計</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          {/* 実績/予実 切り替え */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
            <button
              onClick={() => setDataViewMode('actualOnly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                dataViewMode === 'actualOnly' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              実績のみ
            </button>
            <button
              onClick={() => setDataViewMode('includePlanned')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                dataViewMode === 'includePlanned' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              予定を含める
            </button>
          </div>

          <Link
            href="/admin/cultivation-schedule"
            className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-black transition-colors flex items-center gap-1 shadow-2xs"
          >
            <span>栽培・予実管理表へ</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 4大KPIサマリーカード */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 総売上 */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-slate-400">総売上実績</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800">
            ¥{summary.sales.toLocaleString()}
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-1">出荷・B2B販売の総計</p>
        </div>

        {/* 労働人件費 */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-slate-400">労働人件費</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800">
            ¥{Math.round(summary.laborCost).toLocaleString()}
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-1">作業時間 × 時給換算</p>
        </div>

        {/* 概算資材費 */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-slate-400">資材費・経費 (概算{estimateRate}%)</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Calculator className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800">
            ¥{Math.round(summary.materialCost).toLocaleString()}
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-1">肥料・農薬・種苗・包装等</p>
        </div>

        {/* 営業利益 ＆ 利益率 */}
        <div className={`p-5 rounded-3xl border shadow-sm relative overflow-hidden ${
          summary.profit >= 0 ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-emerald-400' : 'bg-rose-500 text-white border-rose-400'
        }`}>
          <div className="flex items-center justify-between mb-2 opacity-80">
            <span className="text-xs font-black">営業利益（限界利益）</span>
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black">
            ¥{Math.round(summary.profit).toLocaleString()}
          </div>
          <div className="flex items-center justify-between text-[11px] font-bold mt-1 opacity-90">
            <span>利益率</span>
            <span className="text-sm font-black">{summary.margin.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* グラフエリア */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 作目別 採算性ランキング (8カラム) */}
        <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Sprout className="w-4 h-4 text-emerald-600" /> 作目別 採算性（時給換算利益）
              </h2>
              <p className="text-xs text-slate-400 font-bold mt-0.5">作目ごとに1時間あたりいくら儲かっているかを可視化</p>
            </div>
          </div>

          {profitabilityData.length > 0 ? (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={profitabilityData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 700 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomProfitTooltip />} />
                  <Bar dataKey="時給換算" fill="#10b981" radius={[8, 8, 0, 0]}>
                    {profitabilityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-slate-400 text-xs font-bold">
              データがありません。日報または売上を記録してください。
            </div>
          )}
        </div>

        {/* 作目別 労働時間シェア (4カラム) */}
        <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" /> 作業時間配分
            </h2>
            <p className="text-xs text-slate-400 font-bold mt-0.5">どの作目に労働時間が投下されているか</p>
          </div>

          {cropData.length > 0 ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={cropData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {cropData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => [`${Math.round(Number(value) / 60)} 時間`, '作業時間']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-slate-400 text-xs font-bold">
              作業データがありません。
            </div>
          )}
        </div>

        {/* 圃場別 採算性 (6カラム) */}
        <div className="lg:col-span-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-teal-600" /> 圃場別 採算性（売上 vs コスト）
            </h2>
            <p className="text-xs text-slate-400 font-bold mt-0.5">圃場ごとの利益とコスト構造</p>
          </div>

          {fieldData.length > 0 ? (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fieldData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="売上" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="コスト" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-slate-400 text-xs font-bold">
              圃場データがありません。
            </div>
          )}
        </div>

        {/* 月次 売上・利益推移 (6カラム) */}
        <div className="lg:col-span-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-600" /> 月次 売上・累計利益推移
            </h2>
            <p className="text-xs text-slate-400 font-bold mt-0.5">年間を通じた収支のトレンド</p>
          </div>

          {monthlyTrendData.length > 0 ? (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 700 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="売上" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="累計利益" stroke="#10b981" strokeWidth={3} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-slate-400 text-xs font-bold">
              推移データがありません。
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
