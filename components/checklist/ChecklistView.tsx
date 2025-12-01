import React, { useState, useMemo, useEffect } from 'react';
import { Checklist, ChecklistItem as ChecklistItemType, TaskPriority } from '../../types';
import ChecklistItem from './ChecklistItem';
import SignaturePad from './SignaturePad';
import SelfieCapture from './SelfieCapture';
import { resizeImage, blobToBase64 } from '../../utils/fileUtils';
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

  // FIX: Save the entire checklist state to sessionStorage whenever it changes.
  useEffect(() => {
    sessionStorage.setItem(`checklistState_${checklist.id}`, JSON.stringify(currentChecklist));
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
              // A finding should exist. Create it if it's new, or update the existing one.
              updatedItem.finding = {
                id: item.finding?.id || `task-${Date.now()}`,
                checklist_item_id: item.id,
                title: item.finding?.title || `Issue with: ${item.question}`,
                priority: updatedItem.value === 'red-flag' ? TaskPriority.High : TaskPriority.Medium,
                assigned_to: item.finding?.assigned_to || checklist.assigned_to,
                due_date: item.finding?.due_date || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                status: item.finding?.status || 'open',
                // FIX: The finding description now always syncs with the latest note text,
                // fixing a bug where only the first letter/word of the note was saved.
                description: updatedItem.note || '',
                photo: updatedItem.photoEvidence?.[0] || item.photoEvidence?.[0] || null, // Use the first photo as the primary finding photo
                // FIX: Add missing `proof_of_fix` and `checklist_id` properties to ensure
                // the created `finding` object conforms to the `Task` interface.
                proof_of_fix: item.finding?.proof_of_fix || null,
                checklist_id: item.finding?.checklist_id || checklist.id,
                // FIX: Add missing `created_at` property to conform to the Task interface.
                created_at: item.finding?.created_at || new Date().toISOString(),
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

  const isCurrentItemValid = useMemo(() => {
    if (!currentItem) return false;

    // 1. Mandatory Question: Check if a value is present.
    if (currentItem.required && (currentItem.value === null || currentItem.value === undefined || String(currentItem.value).trim() === '')) {
      return false;
    }

    // 2. Mandatory Note: Check if the note is not empty.
    if (currentItem.requireNote && (!currentItem.note || currentItem.note.trim() === '')) {
      return false;
    }

    // 3. Minimum Photos: Check if enough photos have been provided.
    if (currentItem.minPhotos && (!currentItem.photoEvidence || currentItem.photoEvidence.length < currentItem.minPhotos)) {
      return false;
    }
    
    // For type 'photo', ensure at least one photo is uploaded if it's a required question.
    if (currentItem.type === 'photo' && currentItem.required && (!currentItem.photoEvidence || currentItem.photoEvidence.length === 0)) {
        return false;
    }

    return true;
  }, [currentItem]);


  const goToNext = () => {
    if (currentItemIndex < totalItems - 1) {
      setCurrentItemIndex(prev => prev + 1);
    } else {
      setFlowState('checkout');
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
        <button onClick={onBack} className="hover:bg-primary-focus p-2 rounded-full transition-colors"><ArrowLeft size={24} /></button>
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
                        <Button onClick={() => setCameraOpen(true)} className="!py-2">Open Camera</Button>
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
            <span className="text-primary font-medium text-sm">(Reference)</span>
        </div>

        <ChecklistItem
          key={currentItem.id}
          item={currentItem}
          onChange={handleItemChange}
        />
      </main>

      <footer className="p-4 bg-gray-800 sticky bottom-0">
          <Button 
            onClick={goToNext} 
            className="w-full !py-3 !text-lg !font-bold transition-transform transform hover:scale-105"
            disabled={!isCurrentItemValid}
          >
            {currentItemIndex === totalItems - 1 ? 'PROCEED TO CHECKOUT' : 'NEXT QUESTION'}
          </Button>
      </footer>
    </div>
  );
};

// Camera overlay handler for selfie capture
const SelfieCaptureOverlay: React.FC<{ open: boolean; onClose: () => void; onBlob: (blob: Blob) => void }> = ({ open, onClose, onBlob }) => {
  if (!open) return null;
  return <SelfieCapture onCancel={onClose} onCapture={onBlob} />;
};

// Augment default export to include selfie handler within the same file scope
// This component is used internally by ChecklistView via state.

export default ChecklistView;
