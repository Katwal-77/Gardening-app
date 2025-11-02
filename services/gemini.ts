
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ImagePart } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const MODEL = 'gemini-2.5-flash';

export async function generateContent(prompt: string, image?: ImagePart): Promise<string> {
  try {
    const contents = image 
      ? { parts: [{ inlineData: { mimeType: image.mimeType, data: image.data } }, { text: prompt }] }
      : prompt;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: MODEL,
      contents,
    });
    
    return response.text;
  } catch (error) {
    console.error("Error generating content:", error);
    return "Sorry, I encountered an error. Please try again.";
  }
}
