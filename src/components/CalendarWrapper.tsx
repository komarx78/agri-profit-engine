"use client";

import React from 'react';
import { Clock, MapPin, Sprout } from 'lucide-react';

interface CalendarProps {
  t: (key: string, lang?: any) => string;
  language: string;
  events: any[];
}

export default function CalendarWrapper({ events, t, language }: CalendarProps) {
  const today = new Date();
  
  const getWeekDaysArray = (lang: string) => {
    switch(lang) {
      case 'en': return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      case 'vi': return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
      case 'id': return ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      case 'zh': return ['日', '一', '二', '三', '四', '五', '六'];
      case 'si': return ['ඉරි', 'සඳු', 'අඟ', 'බදා', 'බ්‍රහ', 'සිකු', 'සෙන'];
      case 'km': return ['អា', 'ច', 'អ', 'ពុ', 'ព្រ', 'សុ', 'ស'];
      default: return ['日', '月', '火', '水', '木', '金', '土'];
    }
  };

  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return {
      dateObj: d,
      dateStr: d.toISOString().split('T')[0],
      dayName: getWeekDaysArray(language)[d.getDay()],
      isToday: i === 0
    };
  });

  return (
    <div className="space-y-4">
      {/* 水平スクロール可能なカレンダーマトリックスUI */}
      <div className="overflow-x-auto pb-4">
        <div className="grid grid-cols-7 gap-2 min-w-[700px]">
          {weekDays.map(day => {
            const dayEvents = events.filter(e => e.date === day.dateStr);

            return (
              <div key={day.dateStr} className="flex flex-col gap-3">
                {/* 日付ヘッダー */}
                <div 
                  className={`p-3 rounded-2xl flex flex-col items-center justify-center transition-all shadow-sm ${day.isToday ? 'bg-blue-600 text-white shadow-md scale-105' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}
                >
                  <span className="text-xs font-bold mb-1">{day.dayName}</span>
                  <span className={`text-lg font-black ${day.isToday ? 'text-white' : 'text-slate-800'}`}>{day.dateObj.getDate()}</span>
                </div>

                {/* タスクブロックエリア */}
                <div className="flex flex-col gap-2 flex-1 bg-slate-50/50 rounded-xl p-1.5 min-h-[150px]">
                  {dayEvents.length > 0 ? (
                    dayEvents.map(event => (
                      <div 
                        key={event.id} 
                        className={`p-2.5 bg-white rounded-xl border shadow-sm flex flex-col gap-1 transition-colors ${day.isToday ? 'border-blue-200' : 'border-slate-200'}`}
                      >
                        <div className={`w-6 h-1 rounded-full mb-1 ${day.isToday ? 'bg-blue-500' : 'bg-emerald-500'}`}></div>
                        <h4 className="font-bold text-slate-800 text-xs leading-snug break-words line-clamp-3">
                          {event.title}
                        </h4>
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex items-center justify-center p-2 rounded-xl">
                      <span className="text-xs text-slate-300 font-bold">-</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
