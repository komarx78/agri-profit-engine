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
      {/* 簡易的な週間カレンダーUI */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map(day => (
          <div 
            key={day.dateStr} 
            className={`p-3 rounded-2xl flex flex-col items-center justify-center ${day.isToday ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}
          >
            <span className="text-xs font-bold mb-1">{day.dayName}</span>
            <span className={`text-lg font-black ${day.isToday ? 'text-white' : 'text-slate-800'}`}>{day.dateObj.getDate()}</span>
          </div>
        ))}
      </div>

      <div className="mt-8 space-y-6">
        <h3 className="text-lg font-black text-slate-800">{t('portal_recentTasks', language)}</h3>
        
        {events.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
            <p className="text-slate-400 font-bold">{t('noTasksRecent', language)}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map(event => {
              // イベントの日付をパース
              const eDate = new Date(event.date);
              const isToday = eDate.toDateString() === today.toDateString();
              
              return (
                <div key={event.id} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-start gap-4 group hover:border-blue-300 transition-colors">
                  <div className={`w-1.5 h-12 rounded-full ${isToday ? 'bg-blue-500' : 'bg-emerald-500'}`}></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${isToday ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                        {isToday ? t('portal_today', language) : event.date}
                      </span>
                    </div>
                    <h4 className="font-black text-slate-800 text-base">{event.title}</h4>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
