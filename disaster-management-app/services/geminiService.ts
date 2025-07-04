
import { GoogleGenAI } from "@google/genai";

// Ensure API_KEY is available in the environment variables
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn("Gemini API key not found. AI features will be disabled.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

export const generateDashboardSummary = async (stats: { [key: string]: number }): Promise<string> => {
  if (!API_KEY) {
    return "AI feature is disabled. Please configure the API Key.";
  }
  
  const statsString = Object.entries(stats)
    .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`)
    .join(', ');

  const prompt = `You are a disaster response coordinator. Based on the following data, provide a concise, one-paragraph summary of the current situation for a status report. Highlight the most critical numbers. Data: ${statsString}.`;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-04-17",
      contents: prompt,
      config: {
        temperature: 0.5,
      }
    });
    return response.text;
  } catch (error) {
    console.error("Error generating summary with Gemini:", error);
    return "Could not generate AI summary at this time.";
  }
};
