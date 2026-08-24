import { NextRequest, NextResponse } from 'next/server';
import { fetchFieldAccumulatedWeather } from '@/lib/weather';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const latStr = searchParams.get('lat') || '35.6895'; // デフォルト東京
    const lngStr = searchParams.get('lng') || '139.6917';
    const startDate = searchParams.get('startDate') || new Date().toISOString().split('T')[0];
    const cropName = searchParams.get('crop') || 'トマト';
    const targetTempStr = searchParams.get('targetTemp');

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    const customTargetTemp = targetTempStr ? parseFloat(targetTempStr) : undefined;

    const weatherData = await fetchFieldAccumulatedWeather(
      lat,
      lng,
      startDate,
      cropName,
      customTargetTemp
    );

    return NextResponse.json({
      success: true,
      data: weatherData
    });
  } catch (error: any) {
    console.error('Weather API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || '気象データの取得に失敗しました' },
      { status: 500 }
    );
  }
}
