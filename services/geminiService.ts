import { GoogleGenAI, GenerateContentResponse, Chat, Modality } from "@google/genai";

// We must re-instantiate this before calls that require the user-selected key
// to ensure we capture the latest key if the user just selected it.
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Chat & Analysis ---

export const createChatSession = (systemInstruction: string) => {
  const ai = getAI();
  return ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: {
      systemInstruction,
      thinkingConfig: { thinkingBudget: 32768 } // Max thinking for Pro
    },
  });
};

export const sendMessageToChat = async (
  chat: Chat, 
  message: string, 
  contextImages: string[] = []
): Promise<string> => {
  let content: any = message;
  
  if (contextImages.length > 0) {
    content = {
      parts: [
        { text: message },
        ...contextImages.map(img => ({
          inlineData: {
            mimeType: 'image/jpeg',
            data: img.split(',')[1] // Remove data:image/jpeg;base64, prefix
          }
        }))
      ]
    };
  }

  const response: GenerateContentResponse = await chat.sendMessage({
    message: content
  });

  return response.text || "I couldn't generate a response.";
};

// --- TTS ---

export const generateSpeech = async (text: string): Promise<ArrayBuffer | null> => {
    const ai = getAI();
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
            },
        });
        
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
            const binaryString = atob(base64Audio);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes.buffer;
        }
        return null;
    } catch (e) {
        console.error("TTS failed", e);
        return null;
    }
}

// --- Veo Video Generation ---

export const generateVeoVideo = async (
  prompt: string, 
  aspectRatio: '16:9' | '9:16' = '16:9',
  resolution: '720p' | '1080p' = '720p',
  inputImage?: string // Optional base64 image for Image-to-Video
): Promise<string | null> => {
  const ai = getAI();
  
  try {
    const config: any = {
        numberOfVideos: 1,
        resolution: resolution,
        aspectRatio: aspectRatio
    };

    let params: any = {
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt || undefined, // Prompt is optional if image is provided, but good to have
      config
    };

    if (inputImage) {
        // Parse base64
        const mimeType = inputImage.split(';')[0].split(':')[1];
        const data = inputImage.split(',')[1];
        params.image = {
            imageBytes: data,
            mimeType: mimeType
        };
    }

    let operation = await ai.models.generateVideos(params);

    // Poll for completion
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
      operation = await ai.operations.getVideosOperation({ operation: operation });
      console.log('Veo operation status:', operation.metadata);
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    
    if (videoUri) {
        // Fetch the actual video blob
        const fetchUrl = `${videoUri}&key=${process.env.API_KEY}`;
        const res = await fetch(fetchUrl);
        const blob = await res.blob();
        return URL.createObjectURL(blob);
    }
    return null;

  } catch (error) {
    console.error("Veo generation failed:", error);
    throw error;
  }
};

// --- Image Generation ---

export const generateImage = async (
  prompt: string,
  aspectRatio: '1:1' | '3:4' | '4:3' | '16:9' = '1:1',
  size: '1K' | '2K' | '4K' = '1K'
): Promise<string | null> => {
  const ai = getAI();
  // Using gemini-3-pro-image-preview for high quality
  const model = 'gemini-3-pro-image-preview';
  
  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: size
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Image generation failed:", error);
    throw error;
  }
};

// --- Image Editing (Nano Banana) ---

export const editImage = async (
  base64Image: string,
  prompt: string
): Promise<string | null> => {
  const ai = getAI();
  const model = 'gemini-2.5-flash-image'; // Use flash image for editing

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png', // Assuming png for simplicity, logic could be smarter
              data: base64Image.split(',')[1]
            }
          },
          { text: prompt }
        ]
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Image editing failed:", error);
    throw error;
  }
}