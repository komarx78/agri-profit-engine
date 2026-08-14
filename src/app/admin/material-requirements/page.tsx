"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Package, Loader2, ChevronLeft, ChevronRight, Calculator, Info } from 'lucide-react';

export default function MaterialRequirementsPage() {
  const [materials, setMaterials] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [cropStandards, setCropStandards] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchData();
  }, [year]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [mRes, pRes, csRes] = await Promise.all([
        supabase.from('materials').select('*').order('name'),
        supabase.from('cultivation_plans_v2').select(`
          *,
          fields ( name ),
          crops ( name )
        `).eq('year', year),
        supabase.from('crop_standards').select('*')
      ]);
      
      setMaterials(mRes.data || []);
      setCropStandards(csRes.data || []);
      
      if (pRes.error && pRes.error.code !== '42P01') {
        console.error("Plans fetch error:", pRes.error);
      }
      setPlans(pRes.data || []);
      
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // 年度の切り替え
  const handlePrevYear = () => setYear(y => y - 1);
  const handleNextYear = () => setYear(y => y + 1);

  const calculateRequirements = () => {
    const requirements: Record<string, { material: any, totalAmount: number, details: any[] }> = {};
    
    // マスタがなければ何もしない
    if (materials.length === 0 || plans.length === 0) return [];

    plans.forEach(plan => {
      const area = plan.calculated_area || 0;
      if (area <= 0) return;

      // この作目の基準値を取得
      const standard = cropStandards.find(s => s.crop_id === plan.crop_id);
      if (!standard || !standard.materials_per_10a) return;

      const materialsPer10a = Array.isArray(standard.materials_per_10a) ? standard.materials_per_10a : [];

      materialsPer10a.forEach((m: any) => {
        const material = materials.find(mat => mat.id === m.material_id);
        if (!material) return;

        const amount = (area / 10) * m.amount;
        if (!requirements[material.id]) {
          requirements[material.id] = { material: material, totalAmount: 0, details: [] };
        }
        requirements[material.id].totalAmount += amount;
        requirements[material.id].details.push({
          plan,
          amount
        });
      });
    });

    return Object.values(requirements);
  };

  const reqs = calculateRequirements();

  return (
    <div className="max-w-[95vw] mx-auto px-4 sm:px-6 space-y-6 pb-12 pt-4 sm:pt-6 relative">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2 md:gap-3">
            <Calculator className="w-6 h-6 md:w-8 md:h-8 text-amber-600 flex-shrink-0" />
            必要資材 自動集計
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-2 font-medium">栽培計画（面積×基準値）に基づき、今年度必要な資材の総量を自動計算・集計します。</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 md:gap-4">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <button onClick={handlePrevYear} className="p-2 hover:bg-slate-100 transition-colors">
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div className="px-4 font-black text-slate-700">{year}年度</div>
            <button onClick={handleNextYear} className="p-2 hover:bg-slate-100 transition-colors">
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </button>
          </div>
          
          <button 
            onClick={fetchData}
            className="px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 font-bold transition-colors"
          >
            リロード
          </button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-amber-800 text-sm font-medium">
        <Info className="w-5 h-5 shrink-0 text-amber-600" />
        <p>
          「マスタ管理」で各作目ごとに設定した「10aあたりの必要資材」を基に、栽培計画で登録した面積から自動的に総量を算出します。
        </p>
      </div>

      {isLoading ? (
        <div className="p-12 flex justify-center text-amber-600">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {reqs.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center text-slate-400 font-bold">
              栽培計画がないか、資材マスタが登録されていないため計算できません。
            </div>
          ) : (
            reqs.map((req, idx) => (
              <div key={idx} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Package className="w-5 h-5 text-slate-400" />
                    <h3 className="text-xl font-black text-slate-800">{req.material.name}</h3>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-500 mb-0.5">今年度の必要総量</div>
                    <div className="text-2xl font-black text-amber-600">
                      {req.totalAmount.toLocaleString()} <span className="text-sm">{req.material.unit}</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-0">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 bg-white border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-3 font-bold">使用先 (圃場)</th>
                        <th className="px-6 py-3 font-bold">対象の作付計画</th>
                        <th className="px-6 py-3 font-bold text-right">算出量</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {req.details.map((detail, dIdx) => (
                        <tr key={dIdx} className="hover:bg-slate-50/50">
                          <td className="px-6 py-3 font-bold text-slate-700">
                            {detail.plan.fields?.name} <span className="text-xs text-slate-400 font-medium ml-1">({detail.plan.calculated_area}a)</span>
                          </td>
                          <td className="px-6 py-3 text-slate-600">
                            {detail.plan.crops?.name} {detail.plan.variety && <span className="text-xs ml-1">({detail.plan.variety})</span>}
                            <span className="text-xs text-slate-400 ml-2">[{detail.plan.start_month}月〜{detail.plan.end_month}月]</span>
                          </td>
                          <td className="px-6 py-3 text-right font-black text-slate-700">
                            {detail.amount.toLocaleString()} {req.material.unit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
