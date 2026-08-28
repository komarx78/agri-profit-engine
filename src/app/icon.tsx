import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #059669 0%, #064e3b 100%)',
          borderRadius: '115px',
          border: '8px solid rgba(110, 231, 183, 0.4)',
          position: 'relative',
        }}
      >
        {/* 背景の太陽 */}
        <div
          style={{
            position: 'absolute',
            top: '80px',
            right: '90px',
            width: '100px',
            height: '100px',
            borderRadius: '50px',
            background: 'linear-gradient(135deg, #fef08a 0%, #f59e0b 100%)',
            opacity: 0.9,
          }}
        />

        {/* 稲穂・若葉の絵文字/シンボル */}
        <div
          style={{
            fontSize: '220px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '20px',
            filter: 'drop-shadow(0 15px 25px rgba(0,0,0,0.4))',
          }}
        >
          🌱
        </div>

        {/* アプリ名文字 */}
        <div
          style={{
            fontSize: '44px',
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: '2px',
            marginTop: '-10px',
            textShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}
        >
          AGRI PROFIT
        </div>
      </div>
    ),
    { ...size }
  );
}
