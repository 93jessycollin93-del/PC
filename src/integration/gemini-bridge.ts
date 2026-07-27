/**
 * Gemini Bridge - Specialized LLM integration for Google Gemini
 * Optimized for AI Studio applications with vision and multimodal support
 */

export interface GeminiConfig {
  apiKey: string;
  model?: string;
  streaming?: boolean;
  temperature?: number;
  vision?: boolean;
}

export interface ContentPart {
  text?: string;
  inlineData?: {
    mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    data: string;
  };
}

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: ContentPart[];
}

export interface GeminiResponse {
  text: string;
  model: string;
  timestamp: Date;
  inputTokens?: number;
  outputTokens?: number;
}

class GeminiBridge {
  private config: GeminiConfig;
  private conversationHistory: GeminiMessage[] = [];

  constructor(config: GeminiConfig) {
    this.config = {
      model: 'gemini-2.0-flash',
      streaming: false,
      temperature: 0.7,
      vision: false,
      ...config,
    };
  }

  async prompt(message: string, imageUrl?: string): Promise<GeminiResponse> {
    const parts: ContentPart[] = [];

    if (imageUrl && this.config.vision) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageUrl,
        },
      });
    }

    parts.push({ text: message });

    try {
      const response = await this.callGemini(parts);
      this.conversationHistory.push({ role: 'user', parts });
      this.conversationHistory.push({ role: 'model', parts: [{ text: response.text }] });
      return response;
    } catch (error) {
      throw new Error(`Gemini call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async chat(messages: GeminiMessage[]): Promise<GeminiResponse> {
    try {
      const lastMessage = messages[messages.length - 1];
      return await this.callGemini(lastMessage.parts);
    } catch (error) {
      throw new Error(`Gemini chat failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async analyzeImage(imageUrl: string, prompt: string): Promise<GeminiResponse> {
    if (!this.config.vision) {
      throw new Error('Vision capabilities not enabled. Set vision: true in config.');
    }

    const parts: ContentPart[] = [
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageUrl,
        },
      },
      { text: prompt },
    ];

    return this.callGemini(parts);
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }

  getHistory(): GeminiMessage[] {
    return [...this.conversationHistory];
  }

  private async callGemini(parts: ContentPart[]): Promise<GeminiResponse> {
    if (!this.config.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    try {
      // This is a placeholder - actual implementation would use the Gemini API
      // In production, this would make real API calls to Google's Gemini service
      return {
        text: 'Gemini response ready',
        model: this.config.model || 'gemini-2.0-flash',
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to call Gemini API: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default GeminiBridge;
