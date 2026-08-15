"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Polygon, InfoWindow } from '@react-google-maps/api';
import { supabase } from '@/lib/supabase';
import { MapPin, Plus, Loader2, Save, X, Info, Search, Check, Trash2, Edit2, Palette, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const containerStyle = {
  width: '100%',
  height: '100%'
};

// 初期表示位置 (デフォルト: 日本の中心付近)
const defaultCenter = {
  lat: 36.2048,
  lng: 138.2529
};

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

// Google Maps API で読み込むライブラリ（再レンダリング防止のため外出し）
const libraries: ("geometry")[] = ["geometry"];

export default function MapPage() {
  const [fields, setFields] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // 地図の位置とズーム
  const [center, setCenter] = useState(defaultCenter);
  const [zoom, setZoom] = useState(14);
  
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
  const [newFieldColor, setNewFieldColor] = useState('#10b981'); // デフォルトカラー
  const [selectedUnmappedFieldId, setSelectedUnmappedFieldId] = useState<string>(''); // 既存マスタ紐付け用
  const [isSaving, setIsSaving] = useState(false);

  // 既存ポリゴン編集用のステート
  const [editingFieldId, setEditingFieldId] = useState<number | null>(null);
  const polygonsRef = useRef<{ [key: number]: google.maps.Polygon }>({});

  // 選択された圃場の詳細（作付・履歴）用ステート
  const [selectedFieldDetails, setSelectedFieldDetails] = useState<{ plan: any, works: any[] } | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: libraries
  });

  // 住所検索用
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !map || !window.google) return;

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: searchQuery }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        map.panTo(results[0].geometry.location);
        map.setZoom(15);
      } else {
        alert(`住所が見つかりませんでした。\n（エラー詳細: ${status}）\n※REQUEST_DENIED と出る場合は、Google Cloud側で Geocoding API に制限がかかっている可能性があります。`);
      }
    });
  };

  useEffect(() => {
    // 保存されている前回の地図位置を復元
    const savedLat = localStorage.getItem('agri_map_lat');
    const savedLng = localStorage.getItem('agri_map_lng');
    const savedZoom = localStorage.getItem('agri_map_zoom');
    
    if (savedLat && savedLng) {
      setCenter({ lat: parseFloat(savedLat), lng: parseFloat(savedLng) });
    }
    if (savedZoom) {
      setZoom(parseInt(savedZoom, 10));
    }

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
          polygon_coordinates,
          color
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
          // 色が保存されていればそれを、無ければIDで適当に割り当て
          statusColor: f.color || (f.id % 2 === 0 ? '#10b981' : '#f59e0b'),
          statusText: f.id % 2 === 0 ? '生育中（キャベツ）' : '収穫待ち'
        };
      });

      setFields(mappedFields);

      // 取得したポリゴンがあり、かつ「前回の保存位置」がない場合のみ自動ズーム
      if (mappedFields.length > 0 && map) {
        const hasSavedPos = localStorage.getItem('agri_map_lat');
        if (!hasSavedPos) {
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

  // 地図の移動やズームが終わったタイミングで位置を保存
  const handleMapIdle = useCallback(() => {
    if (map) {
      const newCenter = map.getCenter();
      const newZoom = map.getZoom();
      
      if (newCenter) {
        localStorage.setItem('agri_map_lat', newCenter.lat().toString());
        localStorage.setItem('agri_map_lng', newCenter.lng().toString());
      }
      if (newZoom) {
        localStorage.setItem('agri_map_zoom', newZoom.toString());
      }
    }
  }, [map]);

  // 地図がクリックされたとき（描画モード用）
  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (!isDrawingMode || !e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    
    setNewPolygonPath(prev => {
      const nextPath = [...(prev || []), { lat, lng }];
      
      // リアルタイム面積計算 (3点以上ある場合)
      if (nextPath.length >= 3 && window.google?.maps?.geometry?.spherical) {
        const latLngPath = nextPath.map(p => new window.google.maps.LatLng(p.lat, p.lng));
        const areaSqMeters = window.google.maps.geometry.spherical.computeArea(latLngPath);
        setNewArea(Number((areaSqMeters / 100).toFixed(1)));
      }
      
      return nextPath;
    });
  };

  // 描画を完了して面積計算・保存モーダルへ
  const handleDrawingComplete = () => {
    if (!newPolygonPath || newPolygonPath.length < 3) {
      alert("畑を作るには最低3か所の頂点をクリックしてください。");
      return;
    }

    if (!window.google?.maps?.geometry?.spherical) {
      alert("Geometry library not loaded");
      return;
    }

    // パスを LatLng オブジェクトの配列に変換
    const latLngPath = newPolygonPath.map(p => new window.google.maps.LatLng(p.lat, p.lng));
    
    // 面積計算 (平方メートル)
    const areaSqMeters = window.google.maps.geometry.spherical.computeArea(latLngPath);
    // a(アール)に変換: 1a = 100㎡
    const areaAres = areaSqMeters / 100;

    setNewArea(Number(areaAres.toFixed(1)));
    
    // 描画モードを終了してモーダルを開く
    setIsDrawingMode(false);
    setIsSaveModalOpen(true);
  };

  const handleCancelDrawing = () => {
    setIsDrawingMode(false);
    setNewPolygonPath(null);
  };

  const handleSavePolygon = async () => {
    if (!newPolygonPath) return;
    
    // 新規登録なら名前必須、既存紐付けならID必須
    if (!selectedUnmappedFieldId && !newFieldName) return;
    
    try {
      setIsSaving(true);
      
      let error;
      
      if (selectedUnmappedFieldId) {
        // 既存マスタへの紐付け（Update）
        const res = await supabase
          .from('fields')
          .update({ 
            area_size: newArea,
            polygon_coordinates: newPolygonPath,
            color: newFieldColor
          })
          .eq('id', selectedUnmappedFieldId);
        error = res.error;
      } else {
        // 新規作成（Insert）
        const res = await supabase
          .from('fields')
          .insert([
            { 
              name: newFieldName, 
              area_size: newArea,
              polygon_coordinates: newPolygonPath,
              color: newFieldColor
            }
          ]);
        error = res.error;
      }
        
      if (error) throw error;
      
      setIsSaveModalOpen(false);
      setNewFieldName('');
      setSelectedUnmappedFieldId('');
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

  // 既存の畑を削除する
  const handleDeletePolygon = async (fieldId: number, fieldName: string) => {
    if (!confirm(`本当に「${fieldName}」を削除してもよろしいですか？\nこの操作は取り消せません。`)) return;
    
    try {
      const { error } = await supabase
        .from('fields')
        .delete()
        .eq('id', fieldId);
        
      if (error) throw error;
      
      alert('削除しました。');
      setSelectedField(null);
      setInfoWindowPos(null);
      fetchFieldsData();
    } catch (err) {
      console.error(err);
      alert('削除に失敗しました。');
    }
  };

  // 既存の畑の形を保存する
  const handleUpdatePolygon = async () => {
    if (!editingFieldId) return;
    const polygon = polygonsRef.current[editingFieldId];
    if (!polygon) {
      alert("エラー: 地図データの取得に失敗しました。");
      return;
    }
    
    try {
      const pathArray = polygon.getPath().getArray();
      const newPath = pathArray.map(p => ({ lat: p.lat(), lng: p.lng() }));
      
      // 面積再計算
      let newAreaSize = 0;
      if (window.google?.maps?.geometry?.spherical) {
        const areaSqMeters = window.google.maps.geometry.spherical.computeArea(polygon.getPath());
        newAreaSize = Number((areaSqMeters / 100).toFixed(1));
      }

      const { error } = await supabase
        .from('fields')
        .update({ 
          polygon_coordinates: newPath,
          area_size: newAreaSize || undefined // 計算失敗時は更新しない
        })
        .eq('id', editingFieldId);

      if (error) throw error;

      alert('形を修正しました！面積も自動再計算されています。');
      setEditingFieldId(null);
      setSelectedField(null);
      fetchFieldsData();
      
    } catch (err) {
      console.error(err);
      alert('形の修正に失敗しました。');
    }
  };

  // 色を変更する
  const handleChangeColor = async (fieldId: number, color: string) => {
    try {
      const { error } = await supabase
        .from('fields')
        .update({ color })
        .eq('id', fieldId);
      if (error) throw error;
      
      // 再取得
      fetchFieldsData();
      setSelectedField(prev => prev ? { ...prev, statusColor: color } : null);
    } catch (err) {
      console.error(err);
      alert('色の変更に失敗しました');
    }
  };

  const handlePolygonClick = async (field: any, e: google.maps.MapMouseEvent) => {
    // 描画モードや編集中はポップアップを出さない
    if (isDrawingMode || editingFieldId) return;
    
    setSelectedField(field);
    setSelectedFieldDetails(null); // 以前の詳細をクリア
    if (e.latLng) {
      setInfoWindowPos({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    }

    // 実際のデータを取得（今年度の作付計画と作業履歴）
    try {
      const currentYear = new Date().getFullYear();
      const { data: plansData } = await supabase
        .from('cultivation_plans_v2')
        .select(`*, crops(name)`)
        .eq('field_id', field.id)
        .eq('year', currentYear)
        .order('start_month', { ascending: false })
        .limit(1);

      let latestPlan = null;
      let works: any[] = [];
      
      if (plansData && plansData.length > 0) {
        latestPlan = plansData[0];
        const { data: worksData } = await supabase
          .from('work_logs')
          .select(`*`)
          .eq('plan_id', latestPlan.id)
          .order('work_date', { ascending: false })
          .limit(2); // ポップアップ用なので2件だけ
          
        if (worksData) works = worksData;
      }
      
      setSelectedFieldDetails({ plan: latestPlan, works });
    } catch (err) {
      console.error("詳細データの取得に失敗しました", err);
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
        <div className="absolute top-16 md:top-4 left-4 z-10 flex gap-2 flex-col sm:flex-row mt-2 md:mt-12">
          {!isDrawingMode && !editingFieldId ? (
            <button
              onClick={() => {
                setIsDrawingMode(true);
                setNewPolygonPath([]);
                setNewArea(0);
              }}
              className="px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-colors shrink-0 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200"
            >
              <Plus className="w-5 h-5 text-emerald-500" /> 地図に畑を追加
            </button>
          ) : isDrawingMode ? (
            <div className="flex gap-2">
              <button
                onClick={handleDrawingComplete}
                className="px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-colors shrink-0 bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                <Check className="w-5 h-5" /> 描画完了
              </button>
              {newPolygonPath && newPolygonPath.length > 0 && (
                <button
                  onClick={() => {
                    setNewPolygonPath([]);
                    setNewArea(0);
                  }}
                  className="px-3 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-colors shrink-0 bg-amber-500 hover:bg-amber-600 text-white"
                >
                  <Trash2 className="w-4 h-4" /> やり直す
                </button>
              )}
              <button
                onClick={handleCancelDrawing}
                className="px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-colors shrink-0 bg-rose-500 hover:bg-rose-600 text-white"
              >
                <X className="w-5 h-5" /> キャンセル
              </button>
            </div>
          ) : editingFieldId ? (
            <div className="flex gap-2">
              <div className="bg-slate-800/90 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 animate-pulse">
                <Edit2 className="w-4 h-4 text-amber-400" /> 白い丸をドラッグして形を修正
              </div>
              <button
                onClick={handleUpdatePolygon}
                className="px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-colors shrink-0 bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                <Save className="w-5 h-5" /> 修正を保存
              </button>
              <button
                onClick={() => setEditingFieldId(null)}
                className="px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-colors shrink-0 bg-slate-500 hover:bg-slate-600 text-white"
              >
                キャンセル
              </button>
            </div>
          ) : null}
          
          {/* 操作案内バナー */}
          {isDrawingMode && (
            <div className="bg-slate-800/90 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-lg flex items-center gap-3">
              <span>地図をクリックして畑を囲んでください。</span>
              {newArea > 0 && (
                <span className="bg-emerald-500 px-3 py-1 rounded-lg text-xs shadow-inner">
                  現在の面積: {newArea} a
                </span>
              )}
            </div>
          )}
          
          {/* 住所・地名検索窓 */}
          {!isDrawingMode && (
            <form 
              onSubmit={handleSearch}
              className="relative shadow-lg rounded-xl overflow-hidden bg-white border border-slate-200 flex items-center"
            >
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="住所や地名で検索..."
                className="px-4 py-2 w-48 md:w-64 outline-none font-bold text-slate-700"
              />
              <button 
                type="submit"
                className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border-l border-slate-200 text-slate-500 hover:text-emerald-600 transition-colors"
              >
                <Search className="w-5 h-5" />
              </button>
            </form>
          )}
        </div>

        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={zoom}
          onLoad={onLoad}
          onUnmount={onUnmount}
          onIdle={handleMapIdle}
          onClick={handleMapClick}
          options={{
            mapTypeId: 'hybrid', // デフォルトを航空写真+ラベルに固定
            disableDefaultUI: false,
            mapTypeControl: true,
            streetViewControl: false,
            fullscreenControl: true,
            draggableCursor: isDrawingMode ? 'crosshair' : null,
          }}
        >
          {/* 現在描画中のポリゴン */}
          {isDrawingMode && newPolygonPath && newPolygonPath.length > 0 && (
            <Polygon
              paths={newPolygonPath}
              options={{
                fillColor: '#3b82f6',
                fillOpacity: 0.4,
                strokeColor: '#2563eb',
                strokeWeight: 2,
                clickable: false,
                editable: false,
                zIndex: 2,
              }}
            />
          )}

          {/* 登録済みポリゴン */}
          {!isDrawingMode && fields.map(f => (
            f.path && f.path.length > 0 && (
              <Polygon
                key={f.id}
                paths={f.path}
                onLoad={(polygon) => {
                  polygonsRef.current[f.id] = polygon;
                }}
                onUnmount={() => {
                  delete polygonsRef.current[f.id];
                }}
                options={{
                  ...polygonOptions,
                  fillColor: f.statusColor,
                  strokeColor: f.statusColor,
                  editable: editingFieldId === f.id, // 編集モードの場合は動かせるように
                  draggable: editingFieldId === f.id,
                }}
                onClick={(e) => handlePolygonClick(f, e)}
              />
            )
          ))}

          {/* クリック時のInfoWindow */}
          {selectedField && infoWindowPos && !editingFieldId && (
            <InfoWindow
              position={infoWindowPos}
              onCloseClick={() => {
                setSelectedField(null);
                setInfoWindowPos(null);
              }}
            >
              <div className="p-2 min-w-[240px]">
                <h3 className="font-black text-xl text-slate-800 mb-1">{selectedField.name}</h3>
                <div className="text-sm text-slate-500 mb-3 border-b border-slate-100 pb-2">
                  面積: <span className="font-bold text-slate-700">{selectedField.area_size} a</span>
                </div>
                
                {/* 色の変更 */}
                <div className="mb-3 flex items-center gap-2 bg-slate-50 p-2 rounded-lg">
                  <Palette className="w-4 h-4 text-slate-400" />
                  <div className="flex gap-1.5 flex-wrap">
                    {['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'].map(color => (
                      <button
                        key={color}
                        onClick={() => handleChangeColor(selectedField.id, color)}
                        className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${selectedField.statusColor === color ? 'border-slate-800 scale-110 shadow-sm' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                        title="色を変更"
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="mt-3 bg-slate-50 p-2 rounded-lg text-xs">
                    <div className="text-slate-400 font-bold mb-1 flex justify-between">
                      <span>最近の作業</span>
                      {selectedFieldDetails && selectedFieldDetails.plan && (
                        <span className="text-emerald-500 bg-emerald-100 px-1.5 py-0.5 rounded-sm">
                          {selectedFieldDetails.plan.crops?.name}
                        </span>
                      )}
                    </div>
                    {selectedFieldDetails ? (
                      selectedFieldDetails.works.length > 0 ? (
                        <ul className="space-y-1 text-slate-600">
                          {selectedFieldDetails.works.map(work => {
                            const date = new Date(work.work_date);
                            return (
                              <li key={work.id}>• {date.getMonth() + 1}/{date.getDate()} {work.work_type} ({work.duration_minutes}分)</li>
                            );
                          })}
                        </ul>
                      ) : (
                        <div className="text-slate-400 py-1">作業記録はありません</div>
                      )
                    ) : (
                      <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-slate-300" /></div>
                    )}
                  </div>
                </div>
                
                <div className="mt-4 flex gap-2">
                  <button 
                    onClick={() => {
                      setEditingFieldId(selectedField.id);
                      setSelectedField(null);
                      setInfoWindowPos(null);
                    }}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" /> 形を修正
                  </button>
                  <Link 
                    href={`/admin/fields/${selectedField.id}`}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-colors shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1"
                  >
                    詳細カルテ <ArrowRight className="w-3 h-3" />
                  </Link>
                  <button 
                    onClick={() => handleDeletePolygon(selectedField.id, selectedField.name)}
                    className="w-10 py-2 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-lg transition-colors flex items-center justify-center shrink-0"
                    title="この畑を削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>

      {/* 新規ポリゴン保存モーダル */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]">
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

              {/* マスタ未設定の圃場がある場合、タブで切り替えられるようにする */}
              {fields.filter(f => !f.polygon_coordinates || (Array.isArray(f.polygon_coordinates) && f.polygon_coordinates.length === 0)).length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-bold text-slate-600 mb-2">登録方法の選択</label>
                  <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button
                      onClick={() => setSelectedUnmappedFieldId('')}
                      className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${!selectedUnmappedFieldId ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      新規に名前をつける
                    </button>
                    <button
                      onClick={() => {
                        const unmapped = fields.filter(f => !f.polygon_coordinates || (Array.isArray(f.polygon_coordinates) && f.polygon_coordinates.length === 0));
                        if (unmapped.length > 0) {
                          setSelectedUnmappedFieldId(unmapped[0].id.toString());
                        }
                      }}
                      className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${selectedUnmappedFieldId ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      既存の畑に紐づける
                    </button>
                  </div>
                </div>
              )}

              {selectedUnmappedFieldId ? (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="block text-sm font-bold text-slate-600 mb-2">紐づける畑を選択</label>
                  <select
                    value={selectedUnmappedFieldId}
                    onChange={(e) => setSelectedUnmappedFieldId(e.target.value)}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-slate-700"
                  >
                    {fields.filter(f => !f.polygon_coordinates || (Array.isArray(f.polygon_coordinates) && f.polygon_coordinates.length === 0)).map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-2">※マスター登録済みで、まだ地図の枠線が設定されていない畑の一覧です。</p>
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="block text-sm font-bold text-slate-600 mb-2">新しい圃場・畑の名前</label>
                  <input
                    type="text"
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    placeholder="例: 第1圃場 (北側)"
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                    autoFocus
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-600 mb-2">表示色（任意）</label>
                <div className="flex gap-2">
                  {['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'].map(color => (
                    <button
                      key={color}
                      onClick={() => setNewFieldColor(color)}
                      className={`w-10 h-10 rounded-full border-4 transition-all hover:scale-110 ${newFieldColor === color ? 'border-slate-800 scale-110 shadow-md' : 'border-transparent'}`}
                      style={{ backgroundColor: color }}
                      title="色を選択"
                    />
                  ))}
                </div>
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
                  disabled={(!selectedUnmappedFieldId && !newFieldName) || isSaving}
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
