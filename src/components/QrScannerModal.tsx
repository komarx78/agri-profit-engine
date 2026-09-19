"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, AlertCircle, RefreshCw, Upload } from 'lucide-react';
import jsQR from 'jsqr';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (result: string) => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraError, setCameraError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const animationFrameIdRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // カメラ停止処理
  const stopCamera = () => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // カメラ起動処理
  const startCamera = async () => {
    setCameraError('');
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('お使いの端末またはブラウザはカメラの直接起動に対応していません。');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // 背面カメラを優先
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // iOS対応
        await videoRef.current.play();
        requestScan();
      }
    } catch (err: any) {
      console.error('Camera open error:', err);
      let msg = 'カメラの起動に失敗しました。';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'カメラの使用が許可されていません。ブラウザの設定でカメラへのアクセスを許可してください。';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'カメラが見つかりませんでした。';
      } else if (err.message) {
        msg = err.message;
      }
      setCameraError(msg);
    }
  };

  // フレーム解析ループ
  const requestScan = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA && context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        // QRコード検出成功
        try {
          if (navigator.vibrate) navigator.vibrate(80);
        } catch (e) {}

        stopCamera();
        onScan(code.data);
        onClose();
        return;
      }
    }

    animationFrameIdRef.current = requestAnimationFrame(requestScan);
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // 画像ファイルからのフォールバック解析
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imgData.data, imgData.width, imgData.height);
          if (code && code.data) {
            try {
              if (navigator.vibrate) navigator.vibrate(80);
            } catch (v) {}
            onScan(code.data);
            onClose();
          } else {
            alert('画像からQRコードを読み取れませんでした。もう一度撮影するか、農園コードを手入力してください。');
          }
        }
        setIsProcessing(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col relative text-white">
        {/* ヘッダー */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white">QRコードをスキャン</h2>
              <p className="text-[10px] text-slate-400">ポスターのQRコードを枠に合わせてください</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* カメラ映像 / スキャン枠エリア */}
        <div className="relative aspect-square bg-black overflow-hidden flex items-center justify-center">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* スキャン枠ガイド */}
          {!cameraError && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-8">
              <div className="w-56 h-56 border-2 border-emerald-400 rounded-3xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] flex items-center justify-center">
                {/* 4角のアクセント */}
                <span className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-300 rounded-tl-xl" />
                <span className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-300 rounded-tr-xl" />
                <span className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-300 rounded-bl-xl" />
                <span className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-300 rounded-br-xl" />

                {/* スキャンレーザーアニメーション */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse" />
              </div>
            </div>
          )}

          {/* カメラエラー時表示 */}
          {cameraError && (
            <div className="p-6 text-center space-y-3 z-10 max-w-xs">
              <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
              <p className="text-xs text-slate-300 leading-relaxed font-bold">{cameraError}</p>
              <button
                type="button"
                onClick={startCamera}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>カメラを再起動</span>
              </button>
            </div>
          )}
        </div>

        {/* フッター操作 / フォールバック */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3">
          <p className="text-xs text-center text-slate-400 font-medium">
            現場休憩所に掲示された「A4ポスターのQRコード」をカメラに向けると自動で接続されます。
          </p>

          {/* 画像ファイル選択ボタン（カメラが動かない端末向けフォールバック） */}
          <div className="pt-1 text-center">
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-300 transition-colors cursor-pointer bg-slate-800/80 hover:bg-slate-800 px-4 py-2 rounded-xl border border-slate-700">
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>写真・ライブラリからQRを読み取る</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileUpload}
                disabled={isProcessing}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
