
import React, { useEffect, useRef, useState } from 'react';

interface SelfieCaptureProps {
  onCancel: () => void;
  onCapture: (blob: Blob) => void;
}

const SelfieCapture: React.FC<SelfieCaptureProps> = ({ onCancel, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (!mounted) return;
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (e) {
        onCancel();
      }
    };
    start();
    return () => {
      mounted = false;
      const s = streamRef.current;
      s?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [onCancel]);

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
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob((blob) => {
      if (blob) onCapture(blob);
    }, 'image/jpeg', 0.9);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <video ref={videoRef} className="max-w-full max-h-full" playsInline muted />
      </div>
      <div className="p-4 bg-black bg-opacity-60 flex gap-3">
        <button onClick={onCancel} className="flex-1 bg-gray-600 text-white py-3 rounded">Cancel</button>
        <button onClick={handleCapture} disabled={!ready} className="flex-1 bg-primary text-white py-3 rounded">Capture</button>
      </div>
    </div>
  );
};

export default SelfieCapture;
