
import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw } from 'lucide-react';

interface SelfieCaptureProps {
  onCancel: () => void;
  onCapture: (blob: Blob) => void;
}

const SelfieCapture: React.FC<SelfieCaptureProps> = ({ onCancel, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

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
            facingMode: { ideal: facingMode } 
          }, 
          audio: false 
        });
        
        if (!mounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (e) {
        console.error("Error accessing camera:", e);
        // Handle error (e.g. permissions denied)
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
        <video 
          ref={videoRef} 
          className="max-w-full max-h-full object-contain"
          style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
          playsInline 
          muted 
        />
        
        <button 
          onClick={toggleCamera}
          className="absolute top-4 right-4 bg-gray-800 bg-opacity-50 p-3 rounded-full text-white hover:bg-opacity-70 transition-all z-10"
          title="Switch Camera"
        >
          <RefreshCw size={24} />
        </button>
      </div>
      <div className="p-4 bg-black bg-opacity-60 flex gap-3">
        <button onClick={onCancel} className="flex-1 bg-gray-600 text-white py-3 rounded font-medium">Cancel</button>
        <button 
          onClick={handleCapture} 
          disabled={!ready} 
          className="flex-1 bg-primary text-white py-3 rounded flex items-center justify-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Camera size={20} /> Capture
        </button>
      </div>
    </div>
  );
};

export default SelfieCapture;
