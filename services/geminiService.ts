
import { GoogleGenAI } from "@google/genai";
import { DriveSession, OvmsConfig } from "../types";

export const analyzeDriveEfficiency = async (drive: DriveSession): Promise<string> => {
  // 1. Try process.env first (if built with env var)
  // @ts-ignore
  let apiKey = process.env.API_KEY;
  
  // 2. Fallback to LocalStorage configuration (User Settings)
  if (!apiKey) {
    try {
      const savedConfig = localStorage.getItem('ovms_config');
      if (savedConfig) {
        const config: OvmsConfig = JSON.parse(savedConfig);
        if (config.geminiApiKey && config.geminiApiKey.trim() !== '') {
          apiKey = config.geminiApiKey;
        }
      }
    } catch (e) {
      console.warn("Failed to read config from localStorage", e);
    }
  }

  if (!apiKey) {
    console.warn("Gemini API Key missing (process.env.API_KEY or Settings)");
    return "API Key not configured. Please add your Gemini API Key in Settings > AI Configuration.";
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Analyze this EV drive session for efficiency improvements.
    
    Data:
    - Distance: ${drive.distance} km
    - Duration: ${drive.duration} min
    - Consumption: ${drive.consumption} kWh
    - Efficiency: ${drive.efficiency} Wh/km
    - Start SoC: ${drive.startSoc}%
    - End SoC: ${drive.endSoc}%
    - Avg Speed: ${Math.round(drive.distance / (drive.duration / 60))} km/h

    The car is a BMW i3 (approximate reference). 
    Provide 3 brief, bulleted tips on how to improve efficiency based on these numbers.
    Keep the tone helpful and technical.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "No analysis available.";
  } catch (error) {
    console.error("Gemini analysis failed", error);
    return "Failed to generate analysis. Please check your API Key and try again.";
  }
};