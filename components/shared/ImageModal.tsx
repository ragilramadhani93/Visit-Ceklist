import React from 'react';
import { X } from 'lucide-react';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  altText?: string;
}

const ImageModal: React.FC<ImageModalProps> = ({ isOpen, onClose, imageUrl, altText = 'Enlarged view' }) => {
  if (!isOpen || !imageUrl) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-80 z-50 flex justify-center items-center p-4 transition-opacity duration-300"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl max-h-[90vh] bg-white p-2 rounded-lg shadow-xl transform transition-transform duration-300 scale-95 animate-modal-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 bg-white text-gray-800 rounded-full p-2 z-10 shadow-lg hover:bg-gray-200 transition-colors"
          aria-label="Close image view"
        >
          <X size={24} />
        </button>
        <img src={imageUrl} alt={altText} className="max-w-full max-h-[85vh] object-contain rounded" />
      </div>
      <style>{`
        @keyframes modal-scale-in {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-modal-scale-in {
          animation: modal-scale-in 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default ImageModal;
