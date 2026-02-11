import { GoogleGenAI } from "@google/genai";
import { DriveSession, OvmsConfig } from "../types";

export const analyzeDriveEfficiency = async (drive: DriveSession): Promise<string> => {
  // 1. Load configuration locally to determine provider
  let config: OvmsConfig = { supabaseUrl: '', supabaseKey: '', vehicleId: '' };
  try {
    const savedConfig = localStorage.getItem('ovms_config');
    if (savedConfig) {
      config = JSON.parse(savedConfig);
    }
  } catch (e) {
    console.warn("Failed to read config", e);
  }

  // Construct the prompt (shared for all providers)
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

  const provider = config.aiProvider || 'gemini';

  // --- OPTION A: OpenAI Compatible Provider (SiliconFlow, DeepSeek, etc.) ---
  if (provider === 'openai') {
    const apiKey = config.openaiApiKey;
    const baseUrl = config.openaiBaseUrl || 'https://api.openai.com/v1';
    const model = config.openaiModel || 'gpt-3.5-turbo';

    if (!apiKey) {
      return "OpenAI/Custom API Key missing. Please configure it in Settings.";
    }

    try {
      // Ensure no trailing slash for clean URL construction
      const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const url = `${cleanBaseUrl}/chat/completions`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
             { role: "system", content: "You are an automotive efficiency expert." },
             { role: "user", content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 500
        })
      });

      if (!response.ok) {
         const errData = await response.json().catch(() => ({}));
         throw new Error(errData.error?.message || `HTTP Error ${response.status}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "No analysis content returned.";

    } catch (error: any) {
      console.error("OpenAI/Custom AI request failed", error);
      return `AI Analysis Failed: ${error.message}. Check your Base URL and Key.`;
    }
  }

  // --- OPTION B: Google Gemini (Default) ---
  
  // 1. Try process.env first (if built with env var)
  // @ts-ignore
  let geminiKey = process.env.API_KEY;
  
  // 2. Fallback to LocalStorage
  if (!geminiKey && config.geminiApiKey) {
      geminiKey = config.geminiApiKey;
  }

  if (!geminiKey) {
    return "Gemini API Key missing. Please add your Key in Settings > AI Configuration.";
  }

  const ai = new GoogleGenAI({ apiKey: geminiKey });

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