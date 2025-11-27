
import React, { useState, useRef } from 'react';
import Modal from '../shared/Modal';
import Button from '../shared/Button';
import { Task } from '../../types';
import { resizeImageToBase64 } from '../../utils/fileUtils';
import { Upload, X } from 'lucide-react';

interface ResolveFindingModalProps {
  isOpen: boolean;
  onClose: () => void;
  finding: Task;
  onResolve: (taskId: string, resolutionData: { photo: string }) => Promise<void>;
}

const ResolveFindingModal: React.FC<ResolveFindingModalProps> = ({ isOpen, onClose, finding, onResolve }) => {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const objectUrl = URL.createObjectURL(file);
      setPhotoPreview(objectUrl);
    }
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!photoFile) {
      alert('Please upload a photo as proof of fix.');
      return;
    }

    setIsLoading(true);
    try {
      const base64Photo = await resizeImageToBase64(photoFile);
      await onResolve(finding.id, { photo: base64Photo });
      // The parent component will close the modal on success
    } catch (error) {
      console.error('Error resolving finding:', error);
      alert('Failed to resolve the finding. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Clean up state when modal is closed/reopened
  React.useEffect(() => {
    if (!isOpen) {
      setPhotoFile(null);
      setPhotoPreview(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Resolve Finding"
      footer={
        <div className="flex space-x-2">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={isLoading}
            disabled={!photoFile}
          >
            Mark as Resolved
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          You are resolving the finding: <strong className="text-neutral">{finding.title}</strong>
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload Proof of Fix (Required)
          </label>
          <input
            type="file"
            accept="image/*"
            ref={photoInputRef}
            onChange={handlePhotoChange}
            className="hidden"
          />
          {!photoPreview ? (
            <button
              onClick={() => photoInputRef.current?.click()}
              className="w-full h-40 bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors border-2 border-dashed border-gray-300"
            >
              <Upload size={40} />
              <span className="mt-2 text-sm font-semibold">Click to upload photo</span>
            </button>
          ) : (
            <div className="relative group w-full h-40">
              <img src={photoPreview} alt="Proof of fix preview" className="w-full h-full object-contain rounded-lg shadow-inner bg-gray-100" />
              <button
                onClick={clearPhoto}
                className="absolute top-2 right-2 bg-black bg-opacity-60 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                aria-label="Remove photo"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ResolveFindingModal;
