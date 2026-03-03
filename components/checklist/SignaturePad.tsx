
import React, { useRef, useEffect, useState } from 'react';
import Button from '../shared/Button';
import { RefreshCw } from 'lucide-react';

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Adjust for device pixel ratio for sharper lines
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(ratio, ratio);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        setContext(ctx);
      }
    }
  }, []);
  
  const getCoords = (event: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if (event instanceof MouseEvent) {
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }
    if (event.touches && event.touches[0]) {
      return { x: event.touches[0].clientX - rect.left, y: event.touches[0].clientY - rect.top };
    }
    return { x: 0, y: 0 };
  }

  const startDrawing = (event: React.MouseEvent | React.TouchEvent) => {
    if (!context) return;
    const { x, y } = getCoords(event.nativeEvent);
    context.beginPath();
    context.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (event: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !context) return;
    const { x, y } = getCoords(event.nativeEvent);
    context.lineTo(x, y);
    context.stroke();
  };

  const stopDrawing = () => {
    if (!context) return;
    context.closePath();
    setIsDrawing(false);
    const dataUrl = canvasRef.current?.toDataURL('image/png').split(',')[1]; // Return base64 string
    onChange(dataUrl || null);
  };
  
  const clearCanvas = () => {
    if (!context || !canvasRef.current) return;
    context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    onChange(null);
  }

  return (
    <div className="relative w-full">
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        className="w-full h-56 sm:h-40 bg-gray-100 rounded-md border-2 border-dashed border-gray-300 cursor-crosshair"
        style={{ touchAction: 'none' }}
      />
      <Button 
        type="button" 
        onClick={() => setIsFullscreen(true)} 
        variant="secondary"
        className="absolute top-2 left-2 !px-2 !py-1 text-xs"
      >
        Full Screen
      </Button>
      {isFullscreen && (
        <FullscreenSignature onClose={() => setIsFullscreen(false)} onDone={(dataUrl) => { onChange(dataUrl); setIsFullscreen(false); }} />
      )}
      <Button 
        type="button" 
        onClick={clearCanvas} 
        variant="secondary"
        className="absolute top-2 right-2 !px-2 !py-1 text-xs"
      >
        <RefreshCw size={14} className="mr-1"/>
        Clear
      </Button>
    </div>
  );
};

export default SignaturePad;

const FullscreenSignature: React.FC<{ onClose: () => void; onDone: (dataUrl: string | null) => void }> = ({ onClose, onDone }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      const c = canvas.getContext('2d');
      if (c) {
        c.scale(ratio, ratio);
        c.strokeStyle = '#111';
        c.lineWidth = 3;
        c.lineCap = 'round';
        setCtx(c);
      }
    }
  }, []);

  const coords = (event: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if (event instanceof MouseEvent) {
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }
    const t = (event as TouchEvent).touches[0] || (event as TouchEvent).changedTouches[0];
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    if (!ctx) return;
    const { x, y } = coords(e.nativeEvent);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDrawing(true);
  };
  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing || !ctx) return;
    const { x, y } = coords(e.nativeEvent);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const end = () => {
    if (!ctx) return;
    ctx.closePath();
    setDrawing(false);
  };
  const clear = () => {
    const canvas = canvasRef.current!;
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  };
  const save = () => {
    const dataUrl = canvasRef.current?.toDataURL('image/png').split(',')[1] || null;
    onDone(dataUrl);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex flex-col">
      <div className="p-3 flex gap-2 justify-end">
        <Button variant="secondary" onClick={onClose} className="!py-2 !px-3">Close</Button>
        <Button variant="secondary" onClick={clear} className="!py-2 !px-3">Clear</Button>
        <Button onClick={save} className="!py-2 !px-3">Use Signature</Button>
      </div>
      <div className="flex-1 p-3">
        <canvas
          ref={canvasRef}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
          className="w-full h-full bg-white rounded"
          style={{ touchAction: 'none' }}
        />
      </div>
    </div>
  );
};
