import React, { useRef, useState, useEffect } from 'react';
import { ChecklistItem as ChecklistItemType } from '../../types';
import { Camera, X, Video as VideoIcon } from 'lucide-react';
import { blobToBase64, resizeImage, base64ToBlob } from '../../utils/fileUtils';
import SelfieCapture from './SelfieCapture';
import VideoRecorder from './VideoRecorder';
import { Capacitor } from '@capacitor/core';
import { Camera as NativeCam, CameraResultType, CameraSource } from '@capacitor/camera';
import AIPhotoAnalysis from './AIPhotoAnalysis';
import { uploadPublic } from '../../services/supabaseClient';

interface ChecklistItemProps {
  item: ChecklistItemType;
  onChange: (itemId: string, updates: Partial<ChecklistItemType>) => void;
}

const ChecklistItem: React.FC<ChecklistItemProps> = ({ item, onChange }) => {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [videoRecorderOpen, setVideoRecorderOpen] = useState(false);

  useEffect(() => {
    const photoSources = item.photoEvidence || [];
    const newPreviews = photoSources.map(source => {
      if (source.startsWith('http')) {
        // It's an already uploaded URL that is safe to use.
        return source;
      }
      if (source.startsWith('data:')) {
        return source;
      }
      // It's a base64 string from a new photo/video or restored session.
      if (item.evidenceType === 'video') {
          return `data:video/webm;base64,${source}`;
      }
      return `data:image/jpeg;base64,${source}`;
    });
    setPreviews(newPreviews);
  }, [item.photoEvidence, item.evidenceType]);

  const handleVideoCapture = async (blob: Blob) => {
    try {
        const url = await uploadPublic('field-ops-photos', blob, `evidence/${item.id}_${Date.now()}.webm`);
        const newEvidence = [...(item.photoEvidence || []), url];
        let updates: Partial<ChecklistItemType> = { photoEvidence: newEvidence };
        
        if (item.type === 'photo') {
            updates.value = newEvidence;
            updates.aiAnalysisStatus = 'idle';
            updates.aiAnalysisResult = '';
        }
        onChange(item.id, updates);
    } catch (e) {
        console.error(e);
    } finally {
        setVideoRecorderOpen(false);
    }
  };

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        let base64String = '';
        
        if (item.evidenceType === 'video') {
            // Video handling: Skip resize, check size
            const maxSize = 50 * 1024 * 1024; // 50MB limit
            if (file.size > maxSize) {
                alert("Video is too large (max 50MB). Please record a shorter video.");
                if (photoInputRef.current) photoInputRef.current.value = '';
                return;
            }
            const url = await uploadPublic('field-ops-photos', file, `evidence/${item.id}_${Date.now()}.webm`);
            const newEvidence = [...(item.photoEvidence || []), url];
            let updates: Partial<ChecklistItemType> = { photoEvidence: newEvidence };
            if (item.type === 'photo') {
              updates.value = newEvidence;
              updates.aiAnalysisStatus = 'idle';
              updates.aiAnalysisResult = '';
            }
            onChange(item.id, updates);
        } else {
            // Photo handling: Resize image (optimized for APK memory)
            const resized = await resizeImage(file, 1024, 1024, 0.7);
            const url = await uploadPublic('field-ops-photos', resized, `evidence/${item.id}_${Date.now()}.jpg`);
            const newEvidence = [...(item.photoEvidence || []), url];
            let updates: Partial<ChecklistItemType> = { photoEvidence: newEvidence };
            if (item.type === 'photo') {
              updates.value = newEvidence; 
              updates.aiAnalysisStatus = 'idle';
              updates.aiAnalysisResult = '';
            }
            onChange(item.id, updates);
        }

      } catch (error) {
        console.error("Error converting file to base64", error);
      }
    }
  };
  
  const handleCameraCapture = async (blob: Blob) => {
    try {
      const resized = await resizeImage(blob, 1024, 1024, 0.7);
      const url = await uploadPublic('field-ops-photos', resized, `evidence/${item.id}_${Date.now()}.jpg`);
      const newPhotoEvidence = [...(item.photoEvidence || []), url];
      let updates: Partial<ChecklistItemType> = { photoEvidence: newPhotoEvidence };
      if (item.type === 'photo') {
        updates.value = newPhotoEvidence;
        updates.aiAnalysisStatus = 'idle';
        updates.aiAnalysisResult = '';
      }
      onChange(item.id, updates);
    } catch (e) {
      console.error(e);
    } finally {
      setCameraOpen(false);
    }
  };
  const handleNativeCamera = async () => {
    try {
      const photo = await NativeCam.getPhoto({
        source: CameraSource.Camera,
        resultType: CameraResultType.Uri,
        quality: 80,
        saveToGallery: false,
        correctOrientation: true 
      });
      
      const webPath = photo.webPath;

      if (!webPath) {
        alert("Error: Camera did not return a valid image path.");
        return;
      }

      // Show processing indicator (could be improved with a proper UI spinner)
      // For now, we rely on the async nature.
      
      try {
        const response = await fetch(webPath);
        const originalBlob = await response.blob();
        
        const resizedBlob = await resizeImage(originalBlob, 1024, 1024, 0.7);
        const url = await uploadPublic('field-ops-photos', resizedBlob, `evidence/${item.id}_${Date.now()}.jpg`);
        
        if (!url) {
             throw new Error("Upload failed (no URL returned)");
        }

        const newPhotoEvidence = [...(item.photoEvidence || []), url];
        let updates: Partial<ChecklistItemType> = { photoEvidence: newPhotoEvidence };
        
        if (item.type === 'photo') {
            updates.value = newPhotoEvidence;
            updates.aiAnalysisStatus = 'idle';
            updates.aiAnalysisResult = '';
        }
        
        onChange(item.id, updates);
      } catch (innerError: any) {
          alert(`Failed to process/upload photo: ${innerError.message || innerError}`);
          console.error("Inner camera process error:", innerError);
      }

    } catch (e: any) {
      // Ignore "User cancelled photos app" error
      if (!e.message?.includes('cancelled')) {
          alert(`Camera Error: ${e.message || e}`);
          console.error("Native camera error:", e);
      }
    }
  };
  
  const removePhoto = (indexToRemove: number) => {
      const newPhotoEvidence = (item.photoEvidence || []).filter((_, index) => index !== indexToRemove);

      
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
    const source = item.photoSource || 'live';
    const isVideo = item.evidenceType === 'video';

    return (
      <div className="mt-6">
        <p className="text-sm font-semibold text-gray-600 text-center">
          Select {isVideo ? 'video' : 'media'} to add to your answer
        </p>
        {requiredPhotos > 0 && (
          <p className="text-xs text-gray-500 mb-2 text-center">
            (Minimum: {requiredPhotos} {isVideo ? 'video' : 'photo'}{requiredPhotos > 1 ? 's' : ''}, Uploaded: {photoCount})
          </p>
        )}
        
        <input
          type="file"
          accept={isVideo ? "video/*" : "image/*"}
          capture="environment"
          ref={photoInputRef}
          onChange={handlePhotoChange}
          className="hidden"
        />

        {previews.length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-2">
                {previews.map((previewSrc, index) => (
                    <div key={index} className="relative group w-full aspect-square">
                        {isVideo ? (
                            <video 
                                src={previewSrc} 
                                className="w-full h-full object-cover rounded-lg shadow-md" 
                                controls 
                            />
                        ) : (
                            <img src={previewSrc} alt={`Preview ${index + 1}`} className="w-full h-full object-cover rounded-lg shadow-md" />
                        )}
                        <button 
                            onClick={() => removePhoto(index)} 
                            className="absolute top-1 right-1 bg-black bg-opacity-60 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                            aria-label={`Remove ${isVideo ? 'video' : 'photo'} ${index + 1}`}
                        >
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>
        )}

        <div className="mt-4 flex justify-center">
            {source === 'upload' ? (
              <button
                onClick={() => photoInputRef.current?.click()}
                className="w-32 h-32 bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors border-2 border-dashed border-gray-300 p-2"
              >
                {isVideo ? <VideoIcon size={32} /> : <Camera size={32} />}
                <span className="mt-2 text-sm font-semibold">Upload {isVideo ? 'Video' : 'Photo'}</span>
                {requiredPhotos > 0 && <span className="mt-1 text-xs text-gray-500">(Min: {requiredPhotos})</span>}
              </button>
            ) : (
              <button 
                onClick={() => {
                  if (isVideo) {
                    setVideoRecorderOpen(true);
                    return;
                  }
                  if (Capacitor.isNativePlatform()) {
                    handleNativeCamera();
                    return;
                  }
                  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    setCameraOpen(true);
                  } else {
                    alert('Camera not supported on this device');
                  }
                }} 
                className="w-32 h-32 bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors border-2 border-dashed border-gray-300 p-2"
              >
                {isVideo ? <VideoIcon size={32} /> : <Camera size={32} />}
                <span className="mt-2 text-sm font-semibold">{isVideo ? 'Record Video' : 'Take Photo'}</span>
                {requiredPhotos > 0 && <span className="mt-1 text-xs text-gray-500">(Min: {requiredPhotos})</span>}
              </button>
            )}
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

  const showPhotoUploader = item.type === 'photo' || item.type === 'yes-no' || (item.minPhotos && item.minPhotos > 0);

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
          {cameraOpen && (
            <SelfieCapture 
              onCancel={() => setCameraOpen(false)} 
              onCapture={handleCameraCapture} 
              initialFacingMode="environment"
            />
          )}
          {videoRecorderOpen && (
              <VideoRecorder onCancel={() => setVideoRecorderOpen(false)} onCapture={handleVideoCapture} />
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

      {item.finding && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
            <div className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-700">
              {item.finding?.due_date || 'N/A'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChecklistItem;
