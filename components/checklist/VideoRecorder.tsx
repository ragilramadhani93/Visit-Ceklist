import React, { useRef, useState, useEffect } from 'react';
import { X, Video, Square, Play, RotateCcw, Check, AlertCircle, RefreshCw } from 'lucide-react';

interface VideoRecorderProps {
  onCapture: (blob: Blob) => void;
  onCancel: () => void;
}

const VideoRecorder: React.FC<VideoRecorderProps> = ({ onCapture, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState(false);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (recordedBlob) {
      const url = URL.createObjectURL(recordedBlob);
      setVideoUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setVideoUrl(null);
    }
  }, [recordedBlob]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRecording) {
      stopRecording();
    }
    return () => clearInterval(interval);
  }, [isRecording, timeLeft]);

  const startCamera = async () => {
    setPermissionError(false);
    try {
      // 1. Try environment camera with audio
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: { ideal: 'environment' } }, 
          audio: true 
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.warn("Failed to get environment camera with audio, trying fallback...", err);
        // 2. Try any camera with audio
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        setStream(fallbackStream);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
        }
      }
    } catch (err) {
      console.warn("Failed to get camera with audio, trying video only...", err);
      try {
        // 3. Try video only (no audio)
        const videoOnlyStream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: false 
        });
        setStream(videoOnlyStream);
        if (videoRef.current) {
          videoRef.current.srcObject = videoOnlyStream;
        }
      } catch (finalErr) {
        console.error("Error accessing camera:", finalErr);
        setPermissionError(true);
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const startRecording = () => {
    if (!stream) return;
    
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setRecordedBlob(blob);
      setIsRecording(false);
      // Stop camera stream to save battery/resources while reviewing
      // stopCamera(); // Actually, keeping camera allows for quick retake without re-requesting permission? 
      // Better to keep camera active if we want to retake.
    };

    recorder.start();
    setIsRecording(true);
    setTimeLeft(15);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const handleRetake = () => {
    setRecordedBlob(null);
    setTimeLeft(15);
    if (!stream) startCamera();
  };

  const handleConfirm = () => {
    if (recordedBlob) {
      onCapture(recordedBlob);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 flex justify-between items-center bg-black/50 absolute top-0 w-full z-10">
        <div className="text-white font-semibold">
           {recordedBlob ? 'Review Video' : 'Record Video'}
        </div>
        <button onClick={onCancel} className="text-white p-2 rounded-full hover:bg-white/20">
          <X size={24} />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative flex items-center justify-center bg-black">
        {permissionError ? (
           <div className="text-white text-center p-6 max-w-sm">
             <AlertCircle size={48} className="mx-auto mb-4 text-red-500" />
             <h3 className="text-xl font-bold mb-2">Camera Access Error</h3>
             <p className="mb-6 text-gray-300">
               Could not access camera. Please ensure permissions are granted and a camera is available.
             </p>
             <button 
               onClick={startCamera}
               className="bg-white text-black px-6 py-2 rounded-full font-semibold flex items-center gap-2 mx-auto hover:bg-gray-200 transition-colors"
             >
               <RefreshCw size={20} />
               Retry
             </button>
           </div>
        ) : !recordedBlob ? (
          <>
             {/* Camera Preview */}
            <video 
              ref={videoRef} 
              autoPlay 
              muted 
              playsInline 
              className="w-full h-full object-contain"
            />
            {/* Timer Overlay */}
            {isRecording && (
              <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-1 rounded-full text-lg font-bold animate-pulse">
                00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
              </div>
            )}
          </>
        ) : (
          /* Video Review */
          <video 
            src={videoUrl || ''} 
            controls 
            className="w-full h-full object-contain" 
          />
        )}
      </div>

      {/* Controls */}
      {!permissionError && (
      <div className="p-6 bg-black/80 flex justify-center items-center gap-8">
        {!recordedBlob ? (
          !isRecording ? (
            <button 
              onClick={startRecording}
              className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-red-600 hover:bg-red-700 transition-all transform hover:scale-105"
            >
              <div className="w-8 h-8 rounded-full bg-white opacity-0" /> {/* Just for sizing/centering if needed, or maybe an icon */}
              <Video size={32} className="text-white" />
            </button>
          ) : (
            <button 
              onClick={stopRecording}
              className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-transparent hover:bg-white/10 transition-all"
            >
              <Square size={32} className="text-red-600 fill-current" />
            </button>
          )
        ) : (
          <>
            <button 
              onClick={handleRetake}
              className="flex flex-col items-center text-white gap-2 hover:text-gray-300"
            >
              <div className="p-3 rounded-full bg-gray-700">
                <RotateCcw size={24} />
              </div>
              <span className="text-xs">Retake</span>
            </button>
            
            <button 
              onClick={handleConfirm}
              className="flex flex-col items-center text-white gap-2 hover:text-green-300"
            >
              <div className="p-3 rounded-full bg-green-600">
                <Check size={24} />
              </div>
              <span className="text-xs">Use Video</span>
            </button>
          </>
        )}
      </div>
      )}
    </div>
  );
};

export default VideoRecorder;
