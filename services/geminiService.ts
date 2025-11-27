import { GoogleGenAI } from "@google/genai";

// FIX: Aligned with Gemini API guidelines to directly use process.env.API_KEY.
// The guidelines state to assume `process.env.API_KEY` is always available.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

export const analyzeImageWithGemini = async (base64Image: string, prompt: string): Promise<string> => {
  // FIX: Removed mock response logic as per Gemini API guidelines.
  // We now assume the API key is present and the service is always available.
  try {
    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Image,
      },
    };
    const textPart = { text: prompt };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
    });
    
    // FIX: Ensure a string is always returned, as response.text can be undefined.
    return response.text ?? "AI analysis did not return a result.";

  } catch (error) {
    console.error("Error analyzing image with Gemini:", error);
    if (error instanceof Error) {
        return `Error: ${error.message}`;
    }
    return "An unknown error occurred during analysis.";
  }
};
