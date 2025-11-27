


import React, { useRef, useState, useEffect } from 'react';
import { ChecklistItem as ChecklistItemType } from '../../types';
import { Camera, X } from 'lucide-react';
import { resizeImageToBase64 } from '../../utils/fileUtils';
import AIPhotoAnalysis from './AIPhotoAnalysis';

interface ChecklistItemProps {
  item: ChecklistItemType;
  onChange: (itemId: string, updates: Partial<ChecklistItemType>) => void;
}

const ChecklistItem: React.FC<ChecklistItemProps> = ({ item, onChange }) => {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const photoSources = item.photoEvidence || [];
    const objectUrls: string[] = [];
    
    const urls = photoSources.map(source => {
        if (source.startsWith('http') || source.startsWith('blob:')) {
            return source;
        }
        // This part is tricky as base64 can't be directly used as src without a data URI scheme.
        // The blob URL approach is better for performance.
        // For simplicity, we assume existing data are URLs.
        return '';
    }).filter(Boolean);

    setPreviews(urls);

    return () => {
      objectUrls.forEach(URL.revokeObjectURL);
    };
  }, [item.photoEvidence]);

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const base64String = await resizeImageToBase64(file);
        const newPhotoEvidence = [...(item.photoEvidence || []), base64String];
        const previewDataUrl = `data:image/jpeg;base64,${base64String}`;
        setPreviews(prev => [...prev, previewDataUrl]);
        
        let updates: Partial<ChecklistItemType> = { photoEvidence: newPhotoEvidence };
        if (item.type === 'photo') {
          updates.value = newPhotoEvidence; // Keep value in sync for photo type
          updates.aiAnalysisStatus = 'idle';
          updates.aiAnalysisResult = '';
        }
        onChange(item.id, updates);

      } catch (error) {
        console.error("Error converting file to base64", error);
      }
    }
  };
  
  const removePhoto = (indexToRemove: number) => {
      const newPhotoEvidence = (item.photoEvidence || []).filter((_, index) => index !== indexToRemove);
      const newPreviews = previews.filter((_, index) => index !== indexToRemove);

      setPreviews(newPreviews);
      
      let updates: Partial<ChecklistItemType> = { photoEvidence: newPhotoEvidence };
       if (item.type === 'photo') {
          updates.value = newPhotoEvidence;
       }
      onChange(item.id, updates);

      if (photoInputRef.current) {
        photoInputRef.current.value = '';
      }
  };
  
  const handleAIStatusChange = (itemId: string, status: 'idle' | 'analyzing' | 'complete' | 'error', result?: string) => {
    onChange(itemId, {
      aiAnalysisStatus: status,
      aiAnalysisResult: result,
    });
  };

  const renderYesNoFlagInput = () => {
    const options = [
      { label: 'Yes', value: 'yes', color: 'bg-green-500' },
      { label: 'No', value: 'no', color: 'bg-orange-400' },
      { label: 'Red Flag (problem is severe)', value: 'red-flag', color: 'bg-red-500' },
    ];
    return (
      <div className="space-y-3">
        {options.map(opt => (
          <div
            key={opt.value}
            onClick={() => onChange(item.id, { value: opt.value })}
            className={`flex items-center p-3.5 rounded-lg border-2 cursor-pointer transition-all ${item.value === opt.value ? 'border-primary bg-primary/10 shadow-md' : 'border-gray-200 bg-white'}`}
          >
            <span className={`w-1.5 h-8 rounded-full ${opt.color} mr-4`}></span>
            <span className={`font-semibold ${item.value === opt.value ? 'text-primary' : 'text-gray-700'}`}>{opt.label}</span>
          </div>
        ))}
      </div>
    );
  };
  
  const renderPhotoUploader = () => {
    const requiredPhotos = item.minPhotos || (item.type === 'photo' && item.required ? 1 : 0);
    const photoCount = item.photoEvidence?.length || 0;

    return (
      <div className="mt-6 text-center">
        <p className="text-sm font-semibold text-gray-600">Select media to add to your answer</p>
        {requiredPhotos > 0 && <p className="text-xs text-gray-500 mb-2">(Minimum: {requiredPhotos} photo{requiredPhotos > 1 ? 's' : ''}, Uploaded: {photoCount})</p>}
        
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={photoInputRef}
          onChange={handlePhotoChange}
          className="hidden"
        />

        <div className="mt-2 grid grid-cols-3 gap-2">
            {(item.photoEvidence || []).map((photo, index) => (
                 <div key={index} className="relative group w-full aspect-square">
                    <img src={previews[index] || `data:image/jpeg;base64,${photo}`} alt={`Preview ${index + 1}`} className="w-full h-full object-cover rounded-lg shadow-md" />
                    <button 
                        onClick={() => removePhoto(index)} 
                        className="absolute top-1 right-1 bg-black bg-opacity-60 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                        aria-label={`Remove photo ${index + 1}`}
                    >
                        <X size={16} />
                    </button>
                </div>
            ))}
            <button 
                onClick={() => photoInputRef.current?.click()} 
                className="w-full aspect-square bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors border-2 border-dashed border-gray-300"
            >
                <Camera size={32} />
                <span className="mt-2 text-xs font-semibold">Add photo</span>
            </button>
        </div>
      </div>
    );
  };
  
  const renderGenericInput = () => {
    switch (item.type) {
        case 'text':
            return <input type="text" value={item.value || ''} onChange={(e) => onChange(item.id, { value: e.target.value })} className="w-full p-3 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />;
        case 'number':
            return <input type="number" value={item.value || ''} onChange={(e) => onChange(item.id, { value: e.target.value })} className="w-full p-3 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />;
        case 'signature':
             return <input type="text" placeholder="Type your name to sign..." value={item.value || ''} onChange={(e) => onChange(item.id, { value: e.target.value })} className="w-full p-3 border border-gray-300 rounded-md font-serif italic focus:ring-primary focus:border-primary" />;
        default:
            return null;
    }
  }

  const showPhotoUploader = item.type === 'photo' || (item.minPhotos && item.minPhotos > 0);

  return (
    <div className="space-y-6">
      {item.type === 'yes-no' ? renderYesNoFlagInput() : renderGenericInput()}
      
      {showPhotoUploader && (
        <>
          {renderPhotoUploader()}
          {item.photoEvidence && item.photoEvidence[0] && (item.photoEvidence[0].length > 500) && ( // Heuristic to check if it's a base64 string
            <AIPhotoAnalysis
              base64Image={item.photoEvidence[0]}
              itemId={item.id}
              status={item.aiAnalysisStatus}
              result={item.aiAnalysisResult}
              onStatusChange={handleAIStatusChange}
            />
          )}
        </>
      )}
      
      {item.requireNote && (
          <textarea
              rows={4}
              placeholder="Comments"
              value={item.note || ''}
              onChange={(e) => onChange(item.id, { note: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-primary focus:border-primary shadow-sm"
          />
      )}
    </div>
  );
};

export default ChecklistItem;
