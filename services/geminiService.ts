import { GoogleGenAI } from "@google/genai";

export const analyzeImageWithGemini = async (base64Image: string, prompt: string): Promise<string> => {
  try {
    const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY as string | undefined;
    if (!apiKey) {
      return "AI analysis is not configured.";
    }
    const ai = new GoogleGenAI({ apiKey });

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
    return response.text ?? "AI analysis did not return a result.";

  } catch (error) {
    console.error("Error analyzing image with Gemini:", error);
    if (error instanceof Error) {
        return `Error: ${error.message}`;
    }
    return "An unknown error occurred during analysis.";
  }
};
