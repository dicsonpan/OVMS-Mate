import { GoogleGenAI } from "@google/genai";
import { DriveSession } from "../types";

const initGenAI = () => {
  if (!process.env.API_KEY) {
    console.warn("Gemini API Key missing");
    return null;
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const analyzeDriveEfficiency = async (drive: DriveSession): Promise<string> => {
  const ai = initGenAI();
  if (!ai) return "API Key not configured. Unable to analyze.";

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
    return "Failed to generate analysis. Please try again later.";
  }
};
