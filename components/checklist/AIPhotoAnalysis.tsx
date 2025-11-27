import React, { useEffect, useCallback } from 'react';
import { analyzeImageWithGemini, isGeminiEnabled } from '../../services/geminiService';
import Button from '../shared/Button';
import { Sparkles, CheckCircle, AlertTriangle } from 'lucide-react';

interface AIPhotoAnalysisProps {
  base64Image: string;
  itemId: string;
  status?: 'idle' | 'analyzing' | 'complete' | 'error';
  result?: string;
  onStatusChange: (itemId: string, status: 'idle' | 'analyzing' | 'complete' | 'error', result?: string) => void;
}

const AIPhotoAnalysis: React.FC<AIPhotoAnalysisProps> = ({ base64Image, itemId, status, result, onStatusChange }) => {
  if (!isGeminiEnabled) return null;
  const handleAnalyze = useCallback(async () => {
    if (!base64Image) return;

    onStatusChange(itemId, 'analyzing');
    try {
      const prompt = "Based on this image from a store audit, analyze its cleanliness and organization. Is it tidy? Are products well-stocked? Mention any potential issues.";
      const analysisResult = await analyzeImageWithGemini(base64Image, prompt);
      onStatusChange(itemId, 'complete', analysisResult);
    } catch (error) {
      console.error("AI Analysis failed", error);
      onStatusChange(itemId, 'error', "Failed to analyze image.");
    }
  }, [base64Image, itemId, onStatusChange]);

  const renderContent = () => {
    switch (status) {
      case 'analyzing':
        return (
          <div className="flex items-center text-gray-600">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-primary" xmlns="http://www.w.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Analyzing... please wait.
          </div>
        );
      case 'complete':
        const isPositive = result?.toLowerCase().includes('clean') || result?.toLowerCase().includes('well-organized');
        return (
          <div className={`p-3 rounded-md ${isPositive ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
            <div className="flex items-center font-bold mb-1">
                {isPositive ? <CheckCircle size={18} className="mr-2" /> : <AlertTriangle size={18} className="mr-2" />}
                AI Analysis Complete
            </div>
            <p className="text-sm">{result}</p>
          </div>
        );
      case 'error':
        return <p className="text-error text-sm">{result}</p>;
      case 'idle':
      default:
        return (
          <Button onClick={handleAnalyze} variant="secondary" className="w-full bg-indigo-500 hover:bg-indigo-600">
            <Sparkles className="mr-2" size={18} />
            Analyze with AI
          </Button>
        );
    }
  };

  return (
    <div className="mt-4 p-3 bg-base-200 rounded-lg">
      {renderContent()}
    </div>
  );
};

export default AIPhotoAnalysis;
