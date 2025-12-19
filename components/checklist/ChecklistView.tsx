import React, { useState, useMemo, useEffect } from 'react';
import { Checklist, ChecklistItem as ChecklistItemType, TaskPriority } from '../../types';
import ChecklistItem from './ChecklistItem';
import SignaturePad from './SignaturePad';
import SelfieCapture from './SelfieCapture';
import { resizeImage, blobToBase64 } from '../../utils/fileUtils';
import { Capacitor } from '@capacitor/core';
import { Camera as NativeCam, CameraResultType, CameraSource } from '@capacitor/camera';
import { ArrowLeft, Clock, LogIn, LogOut, Signature } from 'lucide-react';
import Button from '../shared/Button';
import Card from '../shared/Card';

interface ChecklistViewProps {
  checklist: Checklist;
  onBack: () => void;
  onSubmit: (checklist: Checklist) => void;
  onLogout: () => void;
  isSubmitting: boolean;
}

const ChecklistView: React.FC<ChecklistViewProps> = ({ checklist, onBack, onSubmit, onLogout, isSubmitting }) => {
  // FIX: Initialize state from sessionStorage to restore progress after a page reload.
  // This is the core of the fix for the "return to dashboard" issue on mobile.
  const [currentChecklist, setCurrentChecklist] = useState<Checklist>(() => {
    try {
      const savedState = sessionStorage.getItem(`checklistState_${checklist.id}`);
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        // Ensure the saved state is for the correct checklist
        if (parsedState.id === checklist.id) {
          return parsedState;
        }
      }
    } catch (e) {
      console.error("Could not parse saved checklist state from sessionStorage", e);
    }
    return checklist;
  });

  const [currentItemIndex, setCurrentItemIndex] = useState<number>(() => {
    const savedIndex = sessionStorage.getItem(`checklistIndex_${checklist.id}`);
    const parsedIndex = savedIndex ? parseInt(savedIndex, 10) : 0;
    // Ensure the index is valid for the number of items
    return parsedIndex < (currentChecklist?.items?.length || 0) ? parsedIndex : 0;
  });

  const [flowState, setFlowState] = useState<'pre-checkin' | 'in-progress' | 'checkout'>(
    checklist.check_in_time || currentChecklist.check_in_time ? 'in-progress' : 'pre-checkin'
  );
  
  const [signature, setSignature] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const openSelfieCamera = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const photo = await NativeCam.getPhoto({
          source: CameraSource.Camera,
          resultType: CameraResultType.Base64,
          quality: 60, // Lower quality for selfie to reduce size
          width: 800, // Resize directly in native
          correctOrientation: true
        });
        const base64String = photo.base64String || '';
        if (!base64String) return;
        setSelfie(base64String);
      } else {
        setCameraOpen(true);
      }
    } catch (e) {
      console.error("Selfie camera error:", e);
    }
  };

  // FIX: Save the entire checklist state to sessionStorage whenever it changes.
  useEffect(() => {
    try {
      sessionStorage.setItem(`checklistState_${checklist.id}`, JSON.stringify(currentChecklist));
    } catch (e) {
      console.warn("Failed to save checklist state to sessionStorage (likely quota exceeded)", e);
      // Fallback: Try to save state without heavy evidence data if quota is exceeded
      try {
        const lightweightState = {
          ...currentChecklist,
          items: currentChecklist.items.map(item => ({
            ...item,
            photoEvidence: item.photoEvidence?.map(p => p.length > 1000 ? 'skipped_too_large' : p) // Placeholder for large data
          }))
        };
        sessionStorage.setItem(`checklistState_${checklist.id}`, JSON.stringify(lightweightState));
      } catch (retryError) {
        console.error("Even lightweight state save failed", retryError);
      }
    }
  }, [currentChecklist, checklist.id]);

  // FIX: Save the current question index to sessionStorage whenever it changes.
  useEffect(() => {
    sessionStorage.setItem(`checklistIndex_${checklist.id}`, currentItemIndex.toString());
  }, [currentItemIndex, checklist.id]);
  

  const handleItemChange = (itemId: string, updates: Partial<ChecklistItemType>) => {
    setCurrentChecklist(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id === itemId) {
          const updatedItem = { ...item, ...updates };

          if (updatedItem.type === 'yes-no') {
            const shouldHaveFinding = updatedItem.value === 'no' || updatedItem.value === 'red-flag';

            if (shouldHaveFinding) {
              const existingFinding = updatedItem.finding || item.finding || null;
              const defaultDays = updatedItem.value === 'red-flag' ? 3 : 7;
              const defaultDate = new Date(Date.now() + defaultDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
              const isValueChanged = Object.prototype.hasOwnProperty.call(updates, 'value') && updates.value !== item.value;
              const computedDue = isValueChanged ? defaultDate : (existingFinding?.due_date || defaultDate);
              updatedItem.finding = {
                id: existingFinding?.id || `task-${Date.now()}`,
                checklist_item_id: item.id,
                title: existingFinding?.title || `Issue with: ${item.question}`,
                priority: updatedItem.value === 'red-flag' ? TaskPriority.High : TaskPriority.Medium,
                assigned_to: existingFinding?.assigned_to || checklist.assigned_to,
                due_date: computedDue,
                status: existingFinding?.status || 'open',
                description: updatedItem.note || existingFinding?.description || '',
                photo: updatedItem.photoEvidence?.[0] || item.photoEvidence?.[0] || existingFinding?.photo || null,
                proof_of_fix: existingFinding?.proof_of_fix || null,
                checklist_id: existingFinding?.checklist_id || checklist.id,
                created_at: existingFinding?.created_at || new Date().toISOString(),
              };
            } else if (updatedItem.value === 'yes') {
              updatedItem.finding = null;
            }
          }
          return updatedItem;
        }
        return item;
      }),
    }));
  };

  const currentItem = currentChecklist.items[currentItemIndex];
  const totalItems = currentChecklist.items.length;
  const completionPercentage = Math.round(((currentItemIndex) / totalItems) * 100);

  const validateItem = (item: ChecklistItemType) => {
    // 1. Mandatory Question: Check if a value is present.
    if (item.required && (item.value === null || item.value === undefined || String(item.value).trim() === '')) {
      return false;
    }

    // 2. Mandatory Note: Check if the note is not empty.
    if (item.requireNote && (!item.note || item.note.trim() === '')) {
      return false;
    }

    // 3. Minimum Photos: Check if enough photos have been provided.
    if (item.minPhotos && (!item.photoEvidence || item.photoEvidence.length < item.minPhotos)) {
      return false;
    }
    
    // For type 'photo', ensure at least one photo is uploaded if it's a required question.
    if (item.type === 'photo' && item.required && (!item.photoEvidence || item.photoEvidence.length === 0)) {
        return false;
    }

    return true;
  };

  const isCurrentItemValid = useMemo(() => {
    if (!currentItem) return false;
    return validateItem(currentItem);
  }, [currentItem]);

  const goToNext = () => {
    if (currentItemIndex < totalItems - 1) {
      setCurrentItemIndex(prev => prev + 1);
    } else {
      // Check for any incomplete mandatory items before proceeding to checkout
      const firstInvalidIndex = currentChecklist.items.findIndex(item => !validateItem(item));
      
      if (firstInvalidIndex !== -1) {
        alert(`Please complete question ${firstInvalidIndex + 1} before checking out.`);
        setCurrentItemIndex(firstInvalidIndex);
        return;
      }

      setFlowState('checkout');
    }
  };
  
  const goToPrev = () => {
    if (currentItemIndex > 0) {
      setCurrentItemIndex(prev => prev - 1);
    }
  };
  
  const handleCheckIn = () => {
    setCurrentChecklist(prev => ({ ...prev, check_in_time: new Date().toISOString() }));
    setFlowState('in-progress');
  };

  const handleCheckout = () => {
    if (!signature) {
        alert("Please provide a signature.");
        return;
    }
    const finalChecklist = {
        ...currentChecklist,
        auditor_signature: signature,
        auditor_selfie: selfie || undefined,
        check_out_time: new Date().toISOString(),
        status: 'completed' as 'completed',
    };
    onSubmit(finalChecklist);
  }

  const renderHeader = (title: string) => (
      <header className="bg-primary text-white p-4 flex items-center justify-between sticky top-0 z-10 shadow-md">
        <div className="w-8"></div> {/* Spacer to replace back button */}
        <h1 className="text-xl font-bold uppercase">{title}</h1>
        <button onClick={onLogout} className="hover:bg-primary-focus p-2 rounded-full transition-colors" aria-label="Logout">
            <LogOut size={24} />
        </button>
      </header>
  );

  if (flowState === 'pre-checkin') {
    return (
       <div className="flex flex-col h-screen bg-white max-w-md mx-auto shadow-2xl">
         {renderHeader(checklist.location || 'Audit Location')}
         <main className="flex-1 flex flex-col justify-center items-center p-8 text-center">
            <LogIn size={64} className="text-primary mb-4" />
            <h2 className="text-2xl font-bold text-neutral mb-2">Start Audit</h2>
            <p className="text-gray-600 mb-1">Checklist: {checklist.title}</p>
            <p className="text-gray-500 text-sm mb-8">Location: {checklist.location}</p>
            <Button onClick={handleCheckIn} className="w-full !py-3 !text-lg !font-bold">
                <Clock size={20} className="mr-2"/> Check In
            </Button>
         </main>
       </div>
    );
  }

  if (flowState === 'checkout') {
      return (
         <div className="flex flex-col h-screen bg-base-200 max-w-md mx-auto shadow-2xl">
            {renderHeader("Checkout")}
            <main className="flex-1 overflow-y-auto p-5 space-y-5">
                <h2 className="text-xl font-bold text-center text-neutral">Final Verification</h2>
                <Card>
                    <h3 className="font-semibold text-neutral mb-3">Auditor Selfie (Optional)</h3>
                    {selfie ? (
                      <div className="relative w-full">
                        <img src={`data:image/jpeg;base64,${selfie}`} alt="Auditor Selfie" className="w-full rounded" />
                        <div className="mt-3 flex gap-3">
                          <Button onClick={() => setSelfie(null)} className="!py-2">Remove</Button>
                          <Button onClick={() => setCameraOpen(true)} className="!py-2">Retake</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <Button onClick={openSelfieCamera} className="!py-2">Open Camera</Button>
                      </div>
                    )}
                </Card>
                <Card>
                    <h3 className="font-semibold text-neutral mb-3 flex items-center"><Signature size={20} className="mr-2 text-primary"/>Auditor Signature</h3>
                    <SignaturePad onChange={setSignature} />
                </Card>
            </main>
            <footer className="p-4 bg-gray-800 sticky bottom-0">
                <Button 
                    onClick={handleCheckout} 
                    className="w-full !py-3 !text-lg !font-bold"
                    disabled={!signature || isSubmitting}
                    isLoading={isSubmitting}
                >
                    <LogOut size={20} className="mr-2" /> Complete & Submit
                </Button>
            </footer>
            {cameraOpen && (
              <SelfieCapture onCancel={() => setCameraOpen(false)} onCapture={async (blob) => {
                try {
                  const resized = await resizeImage(blob, 1600, 1600, 0.8);
                  const b64 = await blobToBase64(resized);
                  setSelfie(b64);
                } catch (e) {
                  console.error(e);
                } finally {
                  setCameraOpen(false);
                }
              }} />
            )}
         </div>
      );
  }

  return (
    <div className="flex flex-col h-screen bg-white max-w-md mx-auto shadow-2xl">
      {renderHeader(checklist.location || 'Audit Location')}
      <main className="flex-1 overflow-y-auto p-5">
        <div className="w-full text-center mb-5">
          <p className="text-sm text-gray-400 mb-1">{completionPercentage}%</p>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div className="bg-primary h-1.5 rounded-full transition-all duration-300" style={{ width: `${completionPercentage}%` }}></div>
          </div>
        </div>

        <div className="text-center mb-6">
            <p className="font-semibold text-gray-500 text-sm">Question {currentItemIndex + 1} of {totalItems}</p>
            <h2 className="text-xl font-semibold my-2 text-gray-800">{currentItem.question}</h2>
            <div className="flex justify-center gap-2 items-center">
              <span className="text-primary font-medium text-sm">(Reference)</span>
            </div>
        </div>

        <ChecklistItem
          key={currentItem.id}
          item={currentItem}
          onChange={handleItemChange}
        />
      </main>

      <footer className="p-4 bg-gray-800 sticky bottom-0">
          <div className="grid grid-cols-2 gap-3">
            <Button 
              onClick={goToPrev} 
              variant="secondary"
              className="w-full !py-3 !text-lg !font-bold"
              disabled={currentItemIndex === 0}
            >
              PREVIOUS
            </Button>
            <Button 
              onClick={goToNext} 
              className="w-full !py-3 !text-lg !font-bold transition-transform transform hover:scale-105"
            >
              {currentItemIndex === totalItems - 1 ? 'PROCEED TO CHECKOUT' : 'NEXT'}
            </Button>
          </div>
      </footer>
    </div>
  );
};

export default ChecklistView;
