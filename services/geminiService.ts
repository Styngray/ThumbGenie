import { GoogleGenAI } from "@google/genai";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY environment variable is not set.");
  }
  return new GoogleGenAI({ apiKey });
};

export interface EditResult {
  text: string;
  image?: string; // Base64
}

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 2000;

/**
 * Retries a function if it fails with a 503 Overloaded error.
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  retries = MAX_RETRIES,
  delay = INITIAL_DELAY_MS
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    // Check for 503 or overload messages in various formats the SDK might return
    const isOverloaded = 
      error?.status === 503 || 
      error?.code === 503 || 
      (error?.message && error.message.toLowerCase().includes("overloaded"));

    if (isOverloaded && retries > 0) {
      console.warn(`Model overloaded. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return retryWithBackoff(operation, retries - 1, delay * 2);
    }
    throw error;
  }
}

/**
 * Sends the current image and a text prompt to Gemini to generate a new version.
 * Using 'gemini-2.5-flash-image' (Nano Banana) as requested.
 */
export const editImageWithGemini = async (
  currentImageBase64: string,
  prompt: string
): Promise<EditResult> => {
  const ai = getAiClient();
  
  // Clean base64 if it has a prefix
  const base64Data = currentImageBase64.replace(/^data:image\/\w+;base64,/, "");

  return retryWithBackoff(async () => {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              text: `You are an expert YouTube thumbnail designer. Edit the provided image based strictly on the user's request: "${prompt}". 
              
              CRITICAL INSTRUCTIONS:
              1. Maintain a 16:9 aspect ratio.
              2. If the user asks to remove the background:
                 - You MUST output an image with a transparent background (alpha channel) if they requested "transparent".
                 - Or replace the background seamlessly if they described a new setting (e.g., "solid red", "office").
                 - Ensure the main subject is perfectly isolated with clean edges.
              3. Ensure the result is high-quality and click-worthy.`
            },
            {
              inlineData: {
                data: base64Data,
                mimeType: 'image/png', 
              },
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
            // imageSize is not supported in gemini-2.5-flash-image
          },
        },
      });

      let resultText = "";
      let resultImage = undefined;

      const candidate = response.candidates?.[0];
      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.text) {
            resultText += part.text;
          }
          if (part.inlineData && part.inlineData.data) {
            resultImage = `data:image/png;base64,${part.inlineData.data}`;
          }
        }
      }

      if (!resultImage && !resultText) {
          throw new Error("No content generated from the model.");
      }

      return {
        text: resultText || "Here is your updated thumbnail.",
        image: resultImage
      };

    } catch (error: any) {
      console.error("Gemini API Error:", error);
      throw error; // Re-throw to trigger retry logic
    }
  });
};

/**
 * Generates a new image from scratch using Gemini.
 * Using 'gemini-2.5-flash-image' (Nano Banana) as requested.
 */
export const generateImageWithGemini = async (
  prompt: string,
  // Size parameter is kept for interface compatibility but ignored by the model config
  size: '1K' | '2K' | '4K' = '1K' 
): Promise<EditResult> => {
  const ai = getAiClient();

  return retryWithBackoff(async () => {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              text: `Generate a high-quality YouTube thumbnail based on this description: "${prompt}". 
              Ensure it is click-worthy, has good composition, and is in 16:9 aspect ratio.`
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
            // imageSize is not supported in gemini-2.5-flash-image
          },
        },
      });

      let resultText = "";
      let resultImage = undefined;

      const candidate = response.candidates?.[0];
      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.text) {
            resultText += part.text;
          }
          if (part.inlineData && part.inlineData.data) {
            resultImage = `data:image/png;base64,${part.inlineData.data}`;
          }
        }
      }

      if (!resultImage) {
          if (resultText) {
               return { text: resultText, image: undefined };
          }
          throw new Error("No image generated.");
      }

      return {
        text: resultText || "Here is your generated thumbnail.",
        image: resultImage
      };

    } catch (error: any) {
      console.error("Gemini Generation Error:", error);
      throw error; // Re-throw to trigger retry logic
    }
  });
};

/**
 * Analyzes the provided image.
 */
export const analyzeImageWithGemini = async (imageBase64: string, prompt?: string): Promise<string> => {
  const ai = getAiClient();
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  
  const defaultCritiquePrompt = "You are a YouTube growth expert. Analyze this thumbnail image. Provide a concise critique listing 3 key strengths and 3 actionable suggestions to improve the Click-Through Rate (CTR). Keep it brief and encouraging.";
  const finalPrompt = prompt || defaultCritiquePrompt;

  // We wrap in retry logic, but catch the final error to return a user-friendly string 
  // instead of throwing, as the UI expects a string return type.
  try {
    return await retryWithBackoff(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            {
              text: finalPrompt
            },
            {
              inlineData: {
                data: base64Data,
                mimeType: 'image/png',
              },
            },
          ],
        },
      });

      return response.text || "I couldn't generate an analysis for this image.";
    });
  } catch (error: any) {
    console.error("Analysis Error:", error);
    if (error?.status === 503 || error?.message?.includes("overloaded")) {
       return "The AI service is currently experiencing high traffic. Please try analyzing the image again in a few moments.";
    }
    return "Failed to analyze image. Please check your network connection and try again.";
  }
};