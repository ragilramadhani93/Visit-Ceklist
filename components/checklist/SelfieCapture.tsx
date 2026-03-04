
import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Zap, ZapOff, ZoomIn, ZoomOut, Upload } from 'lucide-react';

interface SelfieCaptureProps {
  onCancel: () => void;
  onCapture: (blob: Blob) => void;
  initialFacingMode?: 'user' | 'environment';
}

const SelfieCapture: React.FC<SelfieCaptureProps> = ({ onCancel, onCapture, initialFacingMode = 'user' }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(initialFacingMode);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);

  // Camera capabilities state
  const [supportsFlash, setSupportsFlash] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [supportsZoom, setSupportsZoom] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 1 });

  const checkCapabilities = (mediaStream: MediaStream) => {
    const track = mediaStream.getVideoTracks()[0];
    if (!track) return;
    
    const capabilities = (track as any).getCapabilities ? (track as any).getCapabilities() : {};
    
    if ('torch' in capabilities) {
      setSupportsFlash(true);
    } else {
      setSupportsFlash(false);
    }

    if ('zoom' in capabilities) {
      setSupportsZoom(true);
      setZoomRange({ 
        min: capabilities.zoom.min || 1, 
        max: capabilities.zoom.max || 10 
      });
      setZoomLevel(capabilities.zoom.min || 1);
    } else {
      setSupportsZoom(false);
    }
  };

  const toggleFlash = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      await track.applyConstraints({
        advanced: [{ torch: !flashOn } as any]
      });
      setFlashOn(!flashOn);
    } catch (err) {
      console.error("Flash toggle failed", err);
    }
  };

  const handleZoom = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newZoom = parseFloat(e.target.value);
    setZoomLevel(newZoom);
    
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      await track.applyConstraints({
        advanced: [{ zoom: newZoom } as any]
      });
    } catch (err) {
      console.error("Zoom failed", err);
    }
  };

  useEffect(() => {
    let mounted = true;
    const start = async () => {
      // Stop any existing tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: { ideal: facingMode },
            zoom: true
          } as any, 
          audio: false 
        });
        
        if (!mounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;
        checkCapabilities(stream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (e: any) {
        console.error("Error accessing camera:", e);
        setErrorType(e.name || '');
        if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
          setError('Kamera tidak ditemukan. Pastikan perangkat memiliki kamera dan izin telah diberikan, atau gunakan tombol "Upload dari Galeri" di bawah.');
        } else if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
          setError('Akses kamera ditolak. Silakan izinkan akses kamera di pengaturan browser.');
        } else if (e.name === 'NotReadableError') {
          setError('Kamera sedang digunakan oleh aplikasi lain. Tutup aplikasi lain dan coba lagi.');
        } else {
          setError(e.message || 'Tidak dapat mengakses kamera.');
        }
      }
    };
    start();
    return () => {
      mounted = false;
      const s = streamRef.current;
      if (s) {
        s.getTracks().forEach(t => t.stop());
      }
      streamRef.current = null;
    };
  }, [facingMode, onCancel]);

  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Mirror the image if using front camera
    if (facingMode === 'user') {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob((blob) => {
      if (blob) onCapture(blob);
    }, 'image/jpeg', 0.9);
  };

  const toggleCamera = () => {
    setReady(false);
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-black">
        {error ? (
          <div className="text-white text-center p-6 max-w-sm">
            <p className="text-red-500 mb-4 text-xl font-bold">Camera Error</p>
            <p className="mb-6 text-sm leading-relaxed">{error}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = () => {
                    fetch(reader.result as string)
                      .then(r => r.blob())
                      .then(blob => onCapture(blob));
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
            <div className="flex flex-col gap-3">
              {(errorType === 'NotFoundError' || errorType === 'DevicesNotFoundError' || errorType === 'NotAllowedError' || errorType === 'PermissionDeniedError') && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-primary text-white rounded-full flex items-center justify-center gap-2"
                >
                  <Upload size={16} /> Upload dari Galeri
                </button>
              )}
              <button onClick={onCancel} className="px-4 py-2 bg-white text-black rounded-full">Tutup</button>
            </div>
          </div>
        ) : (
          <>
            <video 
              ref={videoRef} 
              className="max-w-full max-h-full object-contain"
              style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
              playsInline 
              muted 
            />
            
            <div className="absolute top-4 right-4 flex flex-col gap-4 items-center z-10">
              <button 
                onClick={toggleCamera}
                className="bg-gray-800 bg-opacity-50 p-3 rounded-full text-white hover:bg-opacity-70 transition-all"
              >
                <RefreshCw size={24} />
              </button>

              {supportsFlash && (
                <button onClick={toggleFlash} className="bg-gray-800 bg-opacity-50 p-3 rounded-full text-white hover:bg-opacity-70 transition-all">
                  {flashOn ? <Zap size={24} className="fill-yellow-400 text-yellow-400" /> : <ZapOff size={24} />}
                </button>
              )}
              
              {supportsZoom && (
                 <div className="bg-gray-800 bg-opacity-50 p-2 rounded-full text-white backdrop-blur-sm flex flex-col items-center gap-2">
                   <ZoomIn size={20} />
                   <div className="h-32 flex items-center justify-center">
                     <input 
                       type="range" 
                       min={zoomRange.min} 
                       max={zoomRange.max} 
                       step="0.1" 
                       value={zoomLevel} 
                       onChange={handleZoom}
                       className="w-32 h-2 bg-gray-400 rounded-lg appearance-none cursor-pointer origin-center -rotate-90"
                     />
                   </div>
                   <ZoomOut size={20} />
                 </div>
              )}
            </div>
          </>
        )}
      </div>
      <div className="p-4 bg-black bg-opacity-60 flex gap-3">
        <button 
          onClick={onCancel}
          className="flex-1 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-500 transition-colors"
        >
          Cancel
        </button>
        {!error && (
          <button 
            onClick={handleCapture}
            className="flex-1 py-3 bg-white text-black rounded-lg font-semibold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
          >
            <Camera size={20} />
            Capture
          </button>
        )}
      </div>
    </div>
  );
};

export default SelfieCapture;
