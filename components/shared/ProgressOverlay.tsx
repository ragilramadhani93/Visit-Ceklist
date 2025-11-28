
import React from 'react';
import { LoaderCircle } from 'lucide-react';

interface ProgressOverlayProps {
  message: string;
  progress: number;
}

const ProgressOverlay: React.FC<ProgressOverlayProps> = ({ message, progress }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
      <div className="bg-base-100 rounded-lg shadow-2xl w-full max-w-md p-6 text-center">
        <LoaderCircle className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
        <h2 className="text-lg font-bold text-neutral mb-2">{message}</h2>
        <p className="text-sm text-gray-500 mb-4">Please wait, this may take a moment...</p>
        <div className="w-full bg-base-300 rounded-full h-2.5">
          <div
            className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <p className="text-right text-xs font-semibold text-primary mt-1">{Math.round(progress)}%</p>
      </div>
    </div>
  );
};

export default ProgressOverlay;