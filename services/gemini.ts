import { GoogleGenAI } from "@google/genai";

// Initialize Gemini client directly using process.env.API_KEY as per guidelines
// "Assume this variable is pre-configured, valid, and accessible"
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateTrackManifesto = async (trackName: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Generate a short, cryptic, cyberpunk-style 'system log' or 'code comment' description for a music track named "${trackName}". 
      Keep it under 30 words. Use technical jargon. 
      Format it like a log entry.`,
    });
    return (response.text || "").trim();
  } catch (error) {
    console.error("Gemini Error:", error);
    return "ERR_CONNECTION_REFUSED: Neural link unstable.";
  }
};