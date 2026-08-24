"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '@/lib/tenant';
import { MapPin, ArrowLeft, Loader2, Calendar, Edit, History, Sprout, Leaf } from 'lucide-react';
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
  const [isLoading, setIsLoading] = useState(true);

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

    } catch (err) {
      console.error(err);
      alert('圃場データの取得に失敗しました');
      router.push('/admin/map');
    } finally {
      setIsLoading(false);
    }
  }

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
