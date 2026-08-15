"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, DrawingManager, Polygon, InfoWindow } from '@react-google-maps/api';
import { supabase } from '@/lib/supabase';
import { MapPin, Plus, Loader2, Save, X, Info } from 'lucide-react';

const containerStyle = {
  width: '100%',
  height: '100%'
};

// 初期表示位置 (デフォルト: 日本の中心付近)
const defaultCenter = {
  lat: 36.2048,
  lng: 138.2529
};

// 描画されるポリゴンのデフォルトスタイル
const polygonOptions = {
  fillColor: '#10b981',
  fillOpacity: 0.4,
  strokeColor: '#059669',
  strokeOpacity: 1,
  strokeWeight: 2,
  clickable: true,
  editable: false,
  zIndex: 1,
};

export default function MapPage() {
  const [fields, setFields] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // 地図インスタンス
  const [map, setMap] = useState<google.maps.Map | null>(null);

  // 選択中のポリゴン情報 (InfoWindow用)
  const [selectedField, setSelectedField] = useState<any | null>(null);
  const [infoWindowPos, setInfoWindowPos] = useState<{lat: number, lng: number} | null>(null);

  // 新規ポリゴン描画用のステート
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [newPolygonPath, setNewPolygonPath] = useState<{lat: number, lng: number}[] | null>(null);
  const [newArea, setNewArea] = useState<number>(0);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: ['drawing', 'geometry']
  });

  useEffect(() => {
    fetchFieldsData();
  }, []);

  async function fetchFieldsData() {
    try {
      setIsLoading(true);
      // 圃場データと、最新の作業記録などを取得して状況を可視化したい
      // 今回はまず基本のフィールドデータを取得する
      const { data: fieldsData, error } = await supabase
        .from('fields')
        .select(`
          id,
          name,
          area_size,
          polygon_coordinates
        `)
        .order('name');
        
      if (error) throw error;

      // TODO: work_logsなどを取得して、各圃場に紐づけて「現在の状況」を算出する
      // 今回はダミーのステータス（色）を付与
      const mappedFields = (fieldsData || []).map(f => {
        // polygon_coordinates は JSONB で保存されている想定 [{lat, lng}, ...]
        let path = [];
        if (typeof f.polygon_coordinates === 'string') {
          try { path = JSON.parse(f.polygon_coordinates); } catch(e) {}
        } else if (Array.isArray(f.polygon_coordinates)) {
          path = f.polygon_coordinates;
        }

        return {
          ...f,
          path,
          // ダミーステータス: 奇数IDは作付け中(緑)、偶数は空き(茶)など
          statusColor: f.id % 2 === 0 ? '#10b981' : '#f59e0b',
          statusText: f.id % 2 === 0 ? '生育中（キャベツ）' : '収穫待ち'
        };
      });

      setFields(mappedFields);

      // 取得したポリゴンがあれば、最初のポリゴンに合わせて地図をズームする
      if (mappedFields.length > 0 && map) {
        const bounds = new window.google.maps.LatLngBounds();
        let hasPoints = false;
        mappedFields.forEach(f => {
          if (f.path && f.path.length > 0) {
            f.path.forEach((p: any) => {
              bounds.extend(new window.google.maps.LatLng(p.lat, p.lng));
              hasPoints = true;
            });
          }
        });
        if (hasPoints) {
          map.fitBounds(bounds);
        }
      }

    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  const onLoad = useCallback(function callback(map: google.maps.Map) {
    setMap(map);
  }, []);

  const onUnmount = useCallback(function callback() {
    setMap(null);
  }, []);

  // 新しいポリゴンが描き終わったときの処理
  const onPolygonComplete = (polygon: google.maps.Polygon) => {
    if (!window.google?.maps?.geometry?.spherical) {
      alert("Geometry library not loaded");
      return;
    }

    const path = polygon.getPath().getArray();
    const coordinates = path.map(p => ({ lat: p.lat(), lng: p.lng() }));
    
    // 面積計算 (平方メートル)
    const areaSqMeters = window.google.maps.geometry.spherical.computeArea(polygon.getPath());
    // a(アール)に変換: 1a = 100㎡
    const areaAres = areaSqMeters / 100;

    setNewPolygonPath(coordinates);
    setNewArea(Number(areaAres.toFixed(1)));
    
    // 描画されたポリゴンは一旦消す（ステートで管理して表示し直すため）
    polygon.setMap(null);
    setIsDrawingMode(false);
    setIsSaveModalOpen(true);
  };

  const handleSavePolygon = async () => {
    if (!newFieldName || !newPolygonPath) return;
    
    try {
      setIsSaving(true);
      const { data, error } = await supabase
        .from('fields')
        .insert([
          { 
            name: newFieldName, 
            area_size: newArea,
            polygon_coordinates: newPolygonPath
          }
        ])
        .select()
        .single();
        
      if (error) throw error;
      
      setIsSaveModalOpen(false);
      setNewFieldName('');
      setNewPolygonPath(null);
      
      // データ再取得
      fetchFieldsData();
      
    } catch (err) {
      console.error(err);
      alert('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePolygonClick = (field: any, e: google.maps.MapMouseEvent) => {
    setSelectedField(field);
    if (e.latLng) {
      setInfoWindowPos({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-full md:h-[calc(100vh-64px)] bg-slate-50 overflow-hidden">
      
      {/* サイドバー: 圃場リスト */}
      <div className="w-full md:w-80 bg-white border-r border-slate-200 shadow-sm flex flex-col z-10 h-1/3 md:h-full shrink-0">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="font-black text-slate-800 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-600" />
            圃場・作付一覧
          </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : fields.length === 0 ? (
            <div className="text-sm text-slate-500 text-center py-8">
              圃場が登録されていません。<br/>「地図に畑を追加」から描画してください。
            </div>
          ) : (
            fields.map(f => (
              <div 
                key={f.id} 
                className={`p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md ${
                  selectedField?.id === f.id ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 bg-white'
                }`}
                onClick={() => {
                  setSelectedField(f);
                  // 最初のポイントに移動
                  if (f.path && f.path.length > 0 && map) {
                    map.panTo(f.path[0]);
                    setInfoWindowPos(f.path[0]);
                  }
                }}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-slate-800">{f.name}</h3>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{f.area_size} a</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: f.statusColor }}></div>
                  <span className="font-medium text-slate-600">{f.statusText}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* メイン: マップ領域 */}
      <div className="flex-1 relative h-2/3 md:h-full min-h-[400px]">
        {/* コントロールパネル */}
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          <button
            onClick={() => setIsDrawingMode(!isDrawingMode)}
            className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-colors ${
              isDrawingMode 
                ? 'bg-rose-500 hover:bg-rose-600 text-white' 
                : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200'
            }`}
          >
            {isDrawingMode ? (
              <>描画をキャンセル</>
            ) : (
              <><Plus className="w-5 h-5 text-emerald-500" /> 地図に畑を追加</>
            )}
          </button>
        </div>

        <GoogleMap
          mapContainerStyle={containerStyle}
          center={defaultCenter}
          zoom={14}
          onLoad={onLoad}
          onUnmount={onUnmount}
          mapTypeId="hybrid"
          options={{
            disableDefaultUI: false,
            mapTypeControl: true,
            streetViewControl: false,
            fullscreenControl: true,
          }}
        >
          {/* Drawing Manager */}
          {isDrawingMode && (
            <DrawingManager
              onPolygonComplete={onPolygonComplete}
              options={{
                drawingControl: true,
                drawingControlOptions: {
                  position: window.google.maps.ControlPosition.TOP_CENTER,
                  drawingModes: [window.google.maps.drawing.OverlayType.POLYGON],
                },
                polygonOptions: {
                  fillColor: '#3b82f6',
                  fillOpacity: 0.4,
                  strokeWeight: 2,
                  clickable: false,
                  editable: true,
                  zIndex: 2,
                },
              }}
            />
          )}

          {/* 登録済みポリゴン */}
          {!isDrawingMode && fields.map(f => (
            f.path && f.path.length > 0 && (
              <Polygon
                key={f.id}
                paths={f.path}
                options={{
                  ...polygonOptions,
                  fillColor: f.statusColor,
                  strokeColor: f.statusColor,
                }}
                onClick={(e) => handlePolygonClick(f, e)}
              />
            )
          ))}

          {/* クリック時のInfoWindow */}
          {selectedField && infoWindowPos && (
            <InfoWindow
              position={infoWindowPos}
              onCloseClick={() => {
                setSelectedField(null);
                setInfoWindowPos(null);
              }}
            >
              <div className="p-2 min-w-[200px]">
                <h3 className="font-black text-lg text-slate-800 mb-1">{selectedField.name}</h3>
                <div className="text-sm text-slate-500 mb-3 border-b border-slate-100 pb-2">
                  面積: <span className="font-bold text-slate-700">{selectedField.area_size} a</span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedField.statusColor }}></div>
                    <span className="font-bold text-slate-700 text-sm">{selectedField.statusText}</span>
                  </div>
                  
                  {/* アグリハブ課題解決: 個別畑の作業履歴などをここに表示可能 */}
                  <div className="mt-3 bg-slate-50 p-2 rounded-lg text-xs">
                    <div className="text-slate-400 font-bold mb-1">最近の作業</div>
                    <ul className="space-y-1 text-slate-600">
                      <li>• 8/12 肥料散布 (太郎)</li>
                      <li>• 8/10 トラクター耕起 (次郎)</li>
                    </ul>
                  </div>
                </div>
                
                <button className="w-full mt-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg text-xs transition-colors">
                  詳細・計画を見る
                </button>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>

      {/* 新規ポリゴン保存モーダル */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Save className="w-6 h-6 text-emerald-500" />
                新しい圃場を登録
              </h3>
              <button onClick={() => setIsSaveModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-3">
                <Info className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-emerald-800">面積が自動計算されました！</p>
                  <p className="text-2xl font-black text-emerald-600 mt-1">{newArea} <span className="text-base font-bold">a</span></p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-600 mb-2">圃場・畑の名前</label>
                <input
                  type="text"
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  placeholder="例: 第1圃場 (北側)"
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  autoFocus
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => setIsSaveModalOpen(false)}
                  className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSavePolygon}
                  disabled={!newFieldName || isSaving}
                  className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white font-bold rounded-xl transition-colors shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : '登録する'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
