
import { GoogleGenAI, Type, Schema } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface GeminiAnalysisResult {
  title: string;
  description: string;
  tags: string[];
  catalogSearchTerm: string;
  productType: string;
}

export const analyzeListingWithGemini = async (rawText: string): Promise<GeminiAnalysisResult | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an expert Print-on-Demand automation assistant.
      
      YOUR GOAL: Analyze the product text and map it to a widely available "Industry Standard" blueprint to ensure upload success.
      
      CRITICAL RULES:
      1. IGNORE any specific brand names mentioned in the text (e.g. if text says "Comfort Colors" or "Next Level", IGNORE IT).
      2. STRICTLY determine the generic Product Type (T-Shirt, Hoodie, Sweatshirt, Mug, etc.).
      3. Map that type to the corresponding "Safe Bet" model number below for 'catalogSearchTerm'. These models have maximum provider availability:
         - T-Shirt / Tee -> "3001"
         - Hoodie / Hooded Sweatshirt -> "18500"
         - Sweatshirt / Crewneck -> "18000"
         - Mug / Coffee Cup -> "11oz Ceramic"
         - Long Sleeve -> "3501"
         - V-Neck -> "3005"
         - Tank Top -> "3480"
      
      Tasks:
      1. Extract a clean Title.
      2. Extract a Description.
      3. Extract Tags.
      4. Set 'productType' to the generic type (e.g. "Hoodie").
      5. Set 'catalogSearchTerm' to the "Safe Bet" model number defined above (e.g. "18500").

      Text to analyze:
      ${rawText.substring(0, 3000)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            catalogSearchTerm: { type: Type.STRING, description: "The Industry Standard Model Number (e.g. 3001, 18500)" },
            productType: { type: Type.STRING, description: "Generic type like 'T-Shirt' or 'Hoodie'" }
          },
          required: ["title", "description", "tags", "catalogSearchTerm", "productType"]
        } as Schema
      }
    });

    if (response.text) {
        return JSON.parse(response.text) as GeminiAnalysisResult;
    }
    return null;
  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    return null; 
  }
};
