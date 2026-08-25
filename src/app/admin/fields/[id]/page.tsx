"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '@/lib/tenant';
import { MapPin, ArrowLeft, Loader2, Calendar, Edit, History, Sprout, Leaf, FlaskConical, Plus, Trash2, Edit2, CheckCircle2, AlertTriangle, X, FileText, Activity, Layers } from 'lucide-react';
import Link from 'next/link';
import { GoogleMap, useJsApiLoader, Polygon } from '@react-google-maps/api';
import FieldWeatherCard from '@/components/FieldWeatherCard';

const containerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '0.75rem'
};

const libraries: ("geometry")[] = ["geometry"];

export default function FieldDetailPage() {
  const params = useParams();
  const router = useRouter();
  const fieldId = params.id as string;

  const [field, setField] = useState<any>(null);
  const [currentPlan, setCurrentPlan] = useState<any>(null);
  const [recentWorks, setRecentWorks] = useState<any[]>([]);
  const [soilDiagnoses, setSoilDiagnoses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 土壌診断モーダル用ステート
  const [isSoilModalOpen, setIsSoilModalOpen] = useState(false);
  const [editingSoilItem, setEditingSoilItem] = useState<any>(null);
  const [isSavingSoil, setIsSavingSoil] = useState(false);
  const [soilFormData, setSoilFormData] = useState({
    diagnosis_date: new Date().toISOString().split('T')[0],
    agency_name: '',
    soil_type: '壌土',
    ph: '6.2',
    ec: '0.35',
    cec: '18.0',
    humus_percent: '3.5',
    available_p_mg: '20.0',
    exchangeable_k_mg: '22.0',
    exchangeable_ca_mg: '280.0',
    exchangeable_mg_mg: '45.0',
    inorganic_n_mg: '2.5',
    diagnosis_summary: '',
    improvement_recommendations: '',
  });

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries
  });

  useEffect(() => {
    if (fieldId) {
      fetchFieldDetails();
    }
  }, [fieldId]);

  async function fetchFieldDetails() {
    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) {
        setIsLoading(false);
        return;
      }

      let query = supabase
        .from('fields')
        .select('*')
        .eq('id', fieldId);

      if (tenantId) {
        query = query.eq('user_id', tenantId);
      }

      const { data, error } = await query.single();
      
      if (error) throw error;

      let path = [];
      if (typeof data.polygon_coordinates === 'string') {
        try { path = JSON.parse(data.polygon_coordinates); } catch(e) {}
      } else if (Array.isArray(data.polygon_coordinates)) {
        path = data.polygon_coordinates;
      }

      setField({ ...data, path });

      // 自社テナントの最新の作付計画を取得
      let planQuery = supabase
        .from('cultivation_plans_v2')
        .select(`*, crops(name)`)
        .eq('field_id', fieldId);

      if (tenantId) {
        planQuery = planQuery.eq('user_id', tenantId);
      }

      const { data: plansData } = await planQuery
        .order('year', { ascending: false })
        .order('start_month', { ascending: false })
        .limit(1);

      let latestPlan = null;
      if (plansData && plansData.length > 0) {
        latestPlan = plansData[0];
        setCurrentPlan(latestPlan);
      }

      // 自社テナントの最近の作業履歴を取得
      let workQuery = supabase
        .from('work_logs')
        .select(`*, workers(name)`)
        .or(latestPlan ? `plan_id.eq.${latestPlan.id},field_id.eq.${fieldId}` : `field_id.eq.${fieldId}`);

      if (tenantId) {
        workQuery = workQuery.eq('user_id', tenantId);
      }

      const { data: worksData } = await workQuery
        .order('work_date', { ascending: false })
        .limit(5);
        
      if (worksData) {
        setRecentWorks(worksData);
      }

      // 自社テナントの土壌診断履歴を取得
      let soilQuery = supabase
        .from('soil_diagnoses')
        .select('*')
        .eq('field_id', fieldId);

      if (tenantId) {
        soilQuery = soilQuery.eq('user_id', tenantId);
      }

      const { data: soilData } = await soilQuery.order('diagnosis_date', { ascending: false });
      if (soilData) {
        setSoilDiagnoses(soilData);
      }

    } catch (err) {
      console.error(err);
      alert('圃場データの取得に失敗しました');
      router.push('/admin/map');
    } finally {
      setIsLoading(false);
    }
  }

  // 土壌診断の保存ハンドラー（自動比率計算付き）
  const handleSaveSoilDiagnosis = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSoil(true);
    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('テナント認証情報が見つかりません');

      const ph = parseFloat(soilFormData.ph) || 0;
      const ec = parseFloat(soilFormData.ec) || 0;
      const cec = parseFloat(soilFormData.cec) || 0;
      const humus = parseFloat(soilFormData.humus_percent) || 0;
      const p = parseFloat(soilFormData.available_p_mg) || 0;
      const k = parseFloat(soilFormData.exchangeable_k_mg) || 0;
      const ca = parseFloat(soilFormData.exchangeable_ca_mg) || 0;
      const mg = parseFloat(soilFormData.exchangeable_mg_mg) || 0;
      const n = parseFloat(soilFormData.inorganic_n_mg) || 0;

      // 塩基ミリ当量計算 (meq/100g)
      const caMeq = ca / 28; // CaO分子量56 / 2
      const mgMeq = mg / 20; // MgO分子量40 / 2
      const kMeq = k / 47;   // K2O分子量94 / 2

      let baseSaturation = 0;
      let caSaturation = 0;
      let mgSaturation = 0;
      let kSaturation = 0;

      if (cec > 0) {
        const totalBaseMeq = caMeq + mgMeq + kMeq;
        baseSaturation = Math.round((totalBaseMeq / cec) * 100 * 10) / 10;
        caSaturation = Math.round((caMeq / cec) * 100 * 10) / 10;
        mgSaturation = Math.round((mgMeq / cec) * 100 * 10) / 10;
        kSaturation = Math.round((kMeq / cec) * 100 * 10) / 10;
      }

      const caMgRatio = mgMeq > 0 ? Math.round((caMeq / mgMeq) * 10) / 10 : 0;
      const mgKRatio = kMeq > 0 ? Math.round((mgMeq / kMeq) * 10) / 10 : 0;

      const payload = {
        user_id: tenantId,
        field_id: fieldId,
        diagnosis_date: soilFormData.diagnosis_date,
        agency_name: soilFormData.agency_name || '自社測定 / JA検査',
        soil_type: soilFormData.soil_type,
        ph,
        ec,
        cec,
        humus_percent: humus,
        available_p_mg: p,
        exchangeable_k_mg: k,
        exchangeable_ca_mg: ca,
        exchangeable_mg_mg: mg,
        inorganic_n_mg: n,
        base_saturation_percent: baseSaturation,
        ca_saturation_percent: caSaturation,
        mg_saturation_percent: mgSaturation,
        k_saturation_percent: kSaturation,
        ca_mg_ratio: caMgRatio,
        mg_k_ratio: mgKRatio,
        diagnosis_summary: soilFormData.diagnosis_summary,
        improvement_recommendations: soilFormData.improvement_recommendations,
        updated_at: new Date().toISOString()
      };

      if (editingSoilItem && editingSoilItem.id) {
        const { error } = await supabase
          .from('soil_diagnoses')
          .update(payload)
          .eq('id', editingSoilItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('soil_diagnoses')
          .insert([payload]);
        if (error) throw error;
      }

      setIsSoilModalOpen(false);
      setEditingSoilItem(null);
      fetchFieldDetails();
    } catch (err: any) {
      alert(`土壌診断データの保存に失敗しました: ${err.message}`);
    } finally {
      setIsSavingSoil(false);
    }
  };

  // 削除ハンドラー
  const handleDeleteSoilDiagnosis = async (id: string) => {
    if (!confirm('この土壌診断記録を削除しますか？')) return;
    try {
      const { error } = await supabase.from('soil_diagnoses').delete().eq('id', id);
      if (error) throw error;
      fetchFieldDetails();
    } catch (e: any) {
      alert(`削除に失敗しました: ${e.message}`);
    }
  };

  // 編集モーダルを開く
  const handleOpenSoilEdit = (item: any) => {
    setEditingSoilItem(item);
    setSoilFormData({
      diagnosis_date: item.diagnosis_date,
      agency_name: item.agency_name || '',
      soil_type: item.soil_type || '壌土',
      ph: String(item.ph || '6.2'),
      ec: String(item.ec || '0.35'),
      cec: String(item.cec || '18.0'),
      humus_percent: String(item.humus_percent || '3.5'),
      available_p_mg: String(item.available_p_mg || '20.0'),
      exchangeable_k_mg: String(item.exchangeable_k_mg || '22.0'),
      exchangeable_ca_mg: String(item.exchangeable_ca_mg || '280.0'),
      exchangeable_mg_mg: String(item.exchangeable_mg_mg || '45.0'),
      inorganic_n_mg: String(item.inorganic_n_mg || '2.5'),
      diagnosis_summary: item.diagnosis_summary || '',
      improvement_recommendations: item.improvement_recommendations || '',
    });
    setIsSoilModalOpen(true);
  };

  // 地図の初期位置（ポリゴンの中心）
  const getCenter = () => {
    if (field?.path && field.path.length > 0) {
      const lats = field.path.map((p: any) => p.lat);
      const lngs = field.path.map((p: any) => p.lng);
      return {
        lat: (Math.min(...lats) + Math.max(...lats)) / 2,
        lng: (Math.min(...lngs) + Math.max(...lngs)) / 2
      };
    }
    return { lat: 36.2048, lng: 138.2529 };
  };

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!field) return null;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* 戻るボタンとヘッダー */}
      <div className="flex items-center gap-4 mb-8">
        <Link 
          href="/admin/map"
          className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
        >
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-slate-800">{field.name}</h1>
            <div 
              className="px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm"
              style={{ backgroundColor: field.color || '#10b981' }}
            >
              カルテ
            </div>
          </div>
          <p className="text-slate-500 font-medium mt-1 flex items-center gap-1">
            <MapPin className="w-4 h-4" /> 面積: <span className="font-bold text-slate-700">{field.area_size} a</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 左側: ミニマップ */}
        <div className="md:col-span-1 h-64 md:h-80 bg-white rounded-2xl shadow-sm border border-slate-200 p-2 relative">
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={containerStyle}
              center={getCenter()}
              zoom={17}
              options={{
                mapTypeId: 'hybrid',
                disableDefaultUI: true,
                zoomControl: true,
                draggable: false, // カルテ画面では簡易表示
              }}
            >
              {field.path && field.path.length > 0 && (
                <Polygon
                  paths={field.path}
                  options={{
                    fillColor: field.color || '#10b981',
                    fillOpacity: 0.4,
                    strokeColor: field.color || '#10b981',
                    strokeWeight: 2,
                  }}
                />
              )}
            </GoogleMap>
          ) : (
            <div className="w-full h-full bg-slate-100 rounded-xl flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          )}
        </div>

        {/* 右側: 現在の作付とアクション */}
        <div className="md:col-span-2 space-y-6">
          
          {/* 現在の作付（栽培計画へのリンク） */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500"></div>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Sprout className="w-5 h-5 text-emerald-600" /> 現在の作付
              </h2>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                {currentPlan ? '生育中' : '計画なし'}
              </span>
            </div>
            
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0">
                <Leaf className="w-8 h-8 text-emerald-500" />
              </div>
              <div>
                {currentPlan ? (
                  <>
                    <p className="text-sm text-slate-500 font-bold mb-1">{currentPlan.year}年</p>
                    <h3 className="text-xl md:text-2xl font-black text-slate-800">
                      {currentPlan.crops?.name || '不明な作物'} {currentPlan.variety ? `(${currentPlan.variety})` : ''}
                    </h3>
                  </>
                ) : (
                  <p className="text-slate-500 font-bold">現在この圃場に設定されている作付計画はありません。</p>
                )}
              </div>
            </div>

            <Link 
              href="/admin/cultivation-schedule"
              className="w-full py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Calendar className="w-5 h-5" /> 栽培・予実管理表でスケジュールを確認
            </Link>
          </div>

          {/* 最近の作業履歴 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-slate-500" /> 最新の作業履歴
            </h2>
            
            <div className="space-y-4">
              {recentWorks.length > 0 ? (
                recentWorks.map((work) => {
                  const date = new Date(work.work_date);
                  return (
                    <div key={work.id} className="flex gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors">
                      <div className="text-sm font-bold text-slate-400 pt-1 w-12 text-center shrink-0">
                        {date.getMonth() + 1}/{date.getDate()}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-700 flex items-center gap-2">
                          {work.work_type}
                          {work.workers?.name && (
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                              👤 {work.workers.name}
                            </span>
                          )}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1">{work.notes || 'メモなし'} ({work.duration_minutes}分)</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-500 p-4 text-center bg-slate-50 rounded-xl">作業履歴がまだありません。</p>
              )}
            </div>

            {recentWorks.length > 0 && (
              <Link 
                href={`/admin/history?field=${encodeURIComponent(field?.name || '')}`}
                className="w-full mt-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-xl text-sm transition-colors flex items-center justify-center"
              >
                すべての履歴を見る
              </Link>
            )}
          </div>

        </div>
      </div>

      {/* 🧪 圃場土壌診断カルテ（最新診断 & バランス分析） */}
      {(() => {
        const latestSoil = soilDiagnoses.length > 0 ? soilDiagnoses[0] : null;

        // pH 判定ヘルパー
        const getPhStatus = (val: number) => {
          if (val < 5.5) return { label: '強酸性', color: 'text-rose-600 bg-rose-50 border-rose-200' };
          if (val < 6.0) return { label: '弱酸性 (やや低)', color: 'text-amber-600 bg-amber-50 border-amber-200' };
          if (val <= 6.8) return { label: '適正 (良好)', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
          return { label: 'アルカリ性 (高)', color: 'text-blue-600 bg-blue-50 border-blue-200' };
        };

        // EC 判定ヘルパー
        const getEcStatus = (val: number) => {
          if (val < 0.1) return { label: '低 (養分少)', color: 'text-amber-600 bg-amber-50 border-amber-200' };
          if (val <= 0.6) return { label: '適正 (良好)', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
          return { label: '過剰 (塩類集積)', color: 'text-rose-600 bg-rose-50 border-rose-200' };
        };

        // CEC (保肥力) 判定ヘルパー
        const getCecStatus = (val: number) => {
          if (val < 15) return { label: '保肥力 低', color: 'text-amber-600 bg-amber-50 border-amber-200' };
          if (val <= 25) return { label: '保肥力 標準', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
          return { label: '高肥沃 (良好)', color: 'text-teal-700 bg-teal-50 border-teal-200' };
        };

        // 塩基飽和度 判定ヘルパー
        const getBaseSatStatus = (val: number) => {
          if (val < 60) return { label: '塩基不足', color: 'text-amber-600 bg-amber-50 border-amber-200' };
          if (val <= 80) return { label: '理想バランス', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
          return { label: '塩基過剰', color: 'text-rose-600 bg-rose-50 border-rose-200' };
        };

        return (
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
                  <FlaskConical className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    圃場土壌診断カルテ
                    {latestSoil && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                        最新: {latestSoil.diagnosis_date} ({latestSoil.agency_name || '検査機関'})
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    土壌酸度(pH)、保肥力(CEC)、塩基バランスを分析し、最適な土づくりを支援します
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingSoilItem(null);
                    setSoilFormData({
                      diagnosis_date: new Date().toISOString().split('T')[0],
                      agency_name: '',
                      soil_type: '壌土',
                      ph: '6.2',
                      ec: '0.35',
                      cec: '18.0',
                      humus_percent: '3.5',
                      available_p_mg: '20.0',
                      exchangeable_k_mg: '22.0',
                      exchangeable_ca_mg: '280.0',
                      exchangeable_mg_mg: '45.0',
                      inorganic_n_mg: '2.5',
                      diagnosis_summary: '',
                      improvement_recommendations: '',
                    });
                    setIsSoilModalOpen(true);
                  }}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  土壌診断結果を登録
                </button>
              </div>
            </div>

            {latestSoil ? (
              <div className="space-y-6">
                {/* 4大指標スコアカード */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  
                  {/* 1. pH */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-500">土壌酸度 (pH)</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${getPhStatus(Number(latestSoil.ph)).color}`}>
                        {getPhStatus(Number(latestSoil.ph)).label}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl lg:text-3xl font-black text-slate-800">{latestSoil.ph}</span>
                      <span className="text-xs text-slate-400 font-bold">pH (適正:6.0〜6.8)</span>
                    </div>
                  </div>

                  {/* 2. EC */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-500">電気伝導度 (EC)</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${getEcStatus(Number(latestSoil.ec)).color}`}>
                        {getEcStatus(Number(latestSoil.ec)).label}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl lg:text-3xl font-black text-slate-800">{latestSoil.ec}</span>
                      <span className="text-xs text-slate-400 font-bold">mS/cm (適正:0.2〜0.6)</span>
                    </div>
                  </div>

                  {/* 3. CEC (保肥力) */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-500">保肥力 (CEC)</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${getCecStatus(Number(latestSoil.cec)).color}`}>
                        {getCecStatus(Number(latestSoil.cec)).label}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl lg:text-3xl font-black text-slate-800">{latestSoil.cec}</span>
                      <span className="text-xs text-slate-400 font-bold">meq/100g (目安:15〜25)</span>
                    </div>
                  </div>

                  {/* 4. 塩基飽和度 */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-500">塩基飽和度</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${getBaseSatStatus(Number(latestSoil.base_saturation_percent)).color}`}>
                        {getBaseSatStatus(Number(latestSoil.base_saturation_percent)).label}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl lg:text-3xl font-black text-slate-800">{latestSoil.base_saturation_percent || '-'}</span>
                      <span className="text-xs text-slate-400 font-bold">% (理想:60〜80%)</span>
                    </div>
                  </div>

                </div>

                {/* 主要養分・塩基バランス詳細 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-amber-50/40 p-5 rounded-2xl border border-amber-200/60">
                  
                  {/* 左: 養分量 (P, K, Ca, Mg, 腐植) */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-amber-700" /> 主要養分バランス (mg/100g)
                    </h3>

                    {/* リン酸 */}
                    <div className="bg-white p-3 rounded-xl border border-amber-100 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-700">有効態リン酸 (P₂O₅)</span>
                        <p className="text-[10px] text-slate-400">適正目安: 10〜30 mg</p>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-black text-amber-900">{latestSoil.available_p_mg || 0} mg</span>
                        <span className={`block text-[10px] font-bold ${Number(latestSoil.available_p_mg) > 30 ? 'text-amber-600' : Number(latestSoil.available_p_mg) < 10 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {Number(latestSoil.available_p_mg) > 30 ? '過剰傾向' : Number(latestSoil.available_p_mg) < 10 ? '不足' : '適正'}
                        </span>
                      </div>
                    </div>

                    {/* 加里 */}
                    <div className="bg-white p-3 rounded-xl border border-amber-100 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-700">置換性加里 (K₂O)</span>
                        <p className="text-[10px] text-slate-400">適正目安: 15〜30 mg</p>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-black text-emerald-900">{latestSoil.exchangeable_k_mg || 0} mg</span>
                        <span className={`block text-[10px] font-bold ${Number(latestSoil.exchangeable_k_mg) > 30 ? 'text-amber-600' : Number(latestSoil.exchangeable_k_mg) < 15 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {Number(latestSoil.exchangeable_k_mg) > 30 ? '過剰傾向' : Number(latestSoil.exchangeable_k_mg) < 15 ? '不足' : '適正'}
                        </span>
                      </div>
                    </div>

                    {/* 石灰 */}
                    <div className="bg-white p-3 rounded-xl border border-amber-100 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-700">置換性石灰 (CaO)</span>
                        <p className="text-[10px] text-slate-400">適正目安: 200〜350 mg</p>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-black text-blue-900">{latestSoil.exchangeable_ca_mg || 0} mg</span>
                        <span className={`block text-[10px] font-bold ${Number(latestSoil.exchangeable_ca_mg) > 350 ? 'text-amber-600' : Number(latestSoil.exchangeable_ca_mg) < 200 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {Number(latestSoil.exchangeable_ca_mg) > 350 ? '高め' : Number(latestSoil.exchangeable_ca_mg) < 200 ? '不足' : '適正'}
                        </span>
                      </div>
                    </div>

                    {/* 苦土 */}
                    <div className="bg-white p-3 rounded-xl border border-amber-100 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-700">置換性苦土 (MgO)</span>
                        <p className="text-[10px] text-slate-400">適正目安: 25〜60 mg</p>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-black text-purple-900">{latestSoil.exchangeable_mg_mg || 0} mg</span>
                        <span className={`block text-[10px] font-bold ${Number(latestSoil.exchangeable_mg_mg) > 60 ? 'text-amber-600' : Number(latestSoil.exchangeable_mg_mg) < 25 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {Number(latestSoil.exchangeable_mg_mg) > 60 ? '高め' : Number(latestSoil.exchangeable_mg_mg) < 25 ? '不足' : '適正'}
                        </span>
                      </div>
                    </div>

                  </div>

                  {/* 右: 塩基比率 ＆ 診断所見・改善処方箋 */}
                  <div className="space-y-4 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-black text-amber-900 flex items-center gap-1.5 mb-3">
                        <Layers className="w-4 h-4 text-amber-700" /> 塩基比率 (拮抗作用バランス)
                      </h3>
                      
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-white p-3 rounded-xl border border-amber-100">
                          <span className="text-xs font-bold text-slate-700 block">石灰/苦土比 (Ca:Mg)</span>
                          <span className="text-lg font-black text-slate-800">{latestSoil.ca_mg_ratio || '-'}</span>
                          <span className="text-[10px] text-slate-400 block">理想比率: 4.0〜6.0</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-amber-100">
                          <span className="text-xs font-bold text-slate-700 block">苦土/加里比 (Mg:K)</span>
                          <span className="text-lg font-black text-slate-800">{latestSoil.mg_k_ratio || '-'}</span>
                          <span className="text-[10px] text-slate-400 block">理想比率: 2.0〜3.0</span>
                        </div>
                      </div>

                      {/* 総合診断所見 */}
                      <div className="bg-white p-4 rounded-xl border border-amber-100 space-y-2">
                        <div className="text-xs font-black text-amber-900 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 総合所見・診断メモ
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {latestSoil.diagnosis_summary || '特記事項なし'}
                        </p>

                        {latestSoil.improvement_recommendations && (
                          <div className="mt-2 pt-2 border-t border-slate-100">
                            <div className="text-xs font-black text-emerald-800 flex items-center gap-1">
                              🌱 施肥・土壌改良指針
                            </div>
                            <p className="text-xs text-emerald-900 leading-relaxed whitespace-pre-wrap mt-0.5">
                              {latestSoil.improvement_recommendations}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* アクション */}
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => handleOpenSoilEdit(latestSoil)}
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> 編集
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSoilDiagnosis(latestSoil.id)}
                        className="px-3 py-1.5 bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold rounded-xl transition-all flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> 削除
                      </button>
                    </div>
                  </div>

                </div>

                {/* 診断履歴一覧テーブル */}
                {soilDiagnoses.length > 1 && (
                  <div className="pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-black text-slate-700 mb-2">過去の診断履歴推移</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-400 font-bold">
                            <th className="py-2 px-2">診断日</th>
                            <th className="py-2 px-2">機関 / 土性</th>
                            <th className="py-2 px-2">pH</th>
                            <th className="py-2 px-2">EC</th>
                            <th className="py-2 px-2">CEC</th>
                            <th className="py-2 px-2">P (有効態)</th>
                            <th className="py-2 px-2">K (加里)</th>
                            <th className="py-2 px-2">Ca (石灰)</th>
                            <th className="py-2 px-2">Mg (苦土)</th>
                            <th className="py-2 px-2 text-right">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {soilDiagnoses.map((item) => (
                            <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="py-2.5 px-2 font-bold text-slate-800">{item.diagnosis_date}</td>
                              <td className="py-2.5 px-2 text-slate-600">{item.agency_name || '-'} ({item.soil_type || '壌土'})</td>
                              <td className="py-2.5 px-2 font-black text-slate-800">{item.ph}</td>
                              <td className="py-2.5 px-2 font-bold text-slate-700">{item.ec}</td>
                              <td className="py-2.5 px-2 font-bold text-slate-700">{item.cec}</td>
                              <td className="py-2.5 px-2 text-slate-700">{item.available_p_mg || 0}</td>
                              <td className="py-2.5 px-2 text-slate-700">{item.exchangeable_k_mg || 0}</td>
                              <td className="py-2.5 px-2 text-slate-700">{item.exchangeable_ca_mg || 0}</td>
                              <td className="py-2.5 px-2 text-slate-700">{item.exchangeable_mg_mg || 0}</td>
                              <td className="py-2.5 px-2 text-right">
                                <button
                                  onClick={() => handleOpenSoilEdit(item)}
                                  className="text-emerald-600 hover:text-emerald-800 font-bold mr-2"
                                >
                                  編集
                                </button>
                                <button
                                  onClick={() => handleDeleteSoilDiagnosis(item.id)}
                                  className="text-rose-500 hover:text-rose-700 font-bold"
                                >
                                  削除
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
                <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                  <FlaskConical className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-800">土壌診断データがまだ登録されていません</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    JAや土壌分析センターの検査結果表をお手元にご用意の上、「土壌診断結果を登録」ボタンから各数値を入力してください。
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingSoilItem(null);
                    setIsSoilModalOpen(true);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> 最初の診断データを登録する
                </button>
              </div>
            )}

          </div>
        );
      })()}

      {/* 土壌診断 登録・編集モーダル */}
      {isSoilModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
                  <FlaskConical className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editingSoilItem ? '土壌診断データの編集' : '新規土壌診断結果の登録'}
                  </h3>
                  <p className="text-[11px] text-slate-500">圃場: {field?.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsSoilModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSoilDiagnosis} className="flex-1 overflow-y-auto space-y-4 pr-1">
              
              {/* 基本情報 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">採取・診断年月日 *</label>
                  <input
                    type="date"
                    required
                    value={soilFormData.diagnosis_date}
                    onChange={(e) => setSoilFormData({...soilFormData, diagnosis_date: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">診断機関名</label>
                  <input
                    type="text"
                    placeholder="例: JA土壌分析センター"
                    value={soilFormData.agency_name}
                    onChange={(e) => setSoilFormData({...soilFormData, agency_name: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">土性</label>
                  <select
                    value={soilFormData.soil_type}
                    onChange={(e) => setSoilFormData({...soilFormData, soil_type: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="砂土">砂土 (保水低・透水高)</option>
                    <option value="砂壌土">砂壌土</option>
                    <option value="壌土">壌土 (標準的)</option>
                    <option value="植壌土">植壌土</option>
                    <option value="植土">植土 (粘土質・保肥高)</option>
                    <option value="黒ボク土">黒ボク土 (火山灰土・リン酸吸着大)</option>
                  </select>
                </div>
              </div>

              {/* 4大基本物性 */}
              <div className="bg-amber-50/50 p-3.5 rounded-2xl border border-amber-200/60 space-y-2.5">
                <span className="text-xs font-black text-amber-900 block">🌱 基本物性・酸度・保肥力</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">酸度 pH(H2O) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="6.2"
                      value={soilFormData.ph}
                      onChange={(e) => setSoilFormData({...soilFormData, ph: e.target.value})}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">EC (mS/cm)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.35"
                      value={soilFormData.ec}
                      onChange={(e) => setSoilFormData({...soilFormData, ec: e.target.value})}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">CEC (meq/100g)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="18.0"
                      value={soilFormData.cec}
                      onChange={(e) => setSoilFormData({...soilFormData, cec: e.target.value})}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">腐植含有率 (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="3.5"
                      value={soilFormData.humus_percent}
                      onChange={(e) => setSoilFormData({...soilFormData, humus_percent: e.target.value})}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* 養分・塩基類 */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
                <span className="text-xs font-black text-slate-800 block">🧪 養分・置換性塩基 (mg/100g)</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">有効態リン酸 (P)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="20.0"
                      value={soilFormData.available_p_mg}
                      onChange={(e) => setSoilFormData({...soilFormData, available_p_mg: e.target.value})}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">置換性加里 (K)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="22.0"
                      value={soilFormData.exchangeable_k_mg}
                      onChange={(e) => setSoilFormData({...soilFormData, exchangeable_k_mg: e.target.value})}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">置換性石灰 (Ca)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="280.0"
                      value={soilFormData.exchangeable_ca_mg}
                      onChange={(e) => setSoilFormData({...soilFormData, exchangeable_ca_mg: e.target.value})}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">置換性苦土 (Mg)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="45.0"
                      value={soilFormData.exchangeable_mg_mg}
                      onChange={(e) => setSoilFormData({...soilFormData, exchangeable_mg_mg: e.target.value})}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* 総合診断所見・処方箋 */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">総合所見・コメント</label>
                  <textarea
                    rows={2}
                    placeholder="例: 全体的に保肥力は標準。塩基バランス良好だがリン酸がやや蓄積傾向。"
                    value={soilFormData.diagnosis_summary}
                    onChange={(e) => setSoilFormData({...soilFormData, diagnosis_summary: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-emerald-800 mb-1">🌱 施肥・土壌改良処方箋</label>
                  <textarea
                    rows={2}
                    placeholder="例: 元肥のリン酸を2割減肥。堆肥1t/10a施用を推奨。"
                    value={soilFormData.improvement_recommendations}
                    onChange={(e) => setSoilFormData({...soilFormData, improvement_recommendations: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-emerald-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSoilModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSavingSoil}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingSoil ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {editingSoilItem ? '更新を保存' : '土壌診断結果を登録'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ☀️ 圃場ピンポイント積算気象 & 収穫予測カルテ */}
      {(() => {
        const center = getCenter();
        const cropName = currentPlan?.crops?.name || '一般作物';
        // 開始日の計算（計画の月または30日前）
        let startDateStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        if (currentPlan?.start_month && currentPlan?.year) {
          const m = String(currentPlan.start_month).padStart(2, '0');
          startDateStr = `${currentPlan.year}-${m}-01`;
        } else if (recentWorks.length > 0) {
          const sorted = [...recentWorks].sort((a, b) => new Date(a.work_date).getTime() - new Date(b.work_date).getTime());
          startDateStr = sorted[0].work_date;
        }

        return (
          <div className="mt-8">
            <FieldWeatherCard
              fieldId={field.id}
              fieldName={field.name}
              latitude={center.lat}
              longitude={center.lng}
              startDate={startDateStr}
              cropName={cropName}
            />
          </div>
        );
      })()}
    </div>
  );
}
