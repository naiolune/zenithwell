import { createClient } from '@supabase/supabase-js';
import { getSystemPrompt, SystemPromptConfig } from './system-prompts';
import { 
  getUserMemory, 
  formatMemoryContext, 
  detectFirstSession,
  storeFirstSessionGoals,
  extractGoalsFromResponse,
  UserMemory 
} from './memory-service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIResponse {
  success: boolean;
  content?: string;
  error?: string;
}

export class ServerAIService {
  private static async getActiveAIConfig() {
    const { data, error } = await supabase
      .from('ai_config')
      .select('*')
      .eq('is_active', true)
      .single();

    if (error || !data) {
      throw new Error('No active AI configuration found');
    }

    return data;
  }

  private static async createAIProvider(config: any) {
    const { provider, api_key, model } = config;

    if (provider === 'openai') {
      const OpenAI = require('openai').default;
      return new OpenAI({ apiKey: api_key });
    } else if (provider === 'anthropic') {
      const Anthropic = require('@anthropic-ai/sdk').default;
      return new Anthropic({ apiKey: api_key });
    } else if (provider === 'perplexity') {
      const Perplexity = require('@perplexity-ai/perplexity_ai').default;
      return new Perplexity({ apiKey: api_key });
    } else {
      throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }

  static async generateResponse(
    messages: AIMessage[],
    sessionId?: string,
    userId?: string
  ): Promise<AIResponse> {
    try {
      const config = await this.getActiveAIConfig();
      const provider = await this.createAIProvider(config);

      // Get session details and user context
      let sessionType: 'individual' | 'relationship' | 'family' | 'general' = 'individual';
      let isFirstSession = false;
      let userMemory: UserMemory[] = [];
      let userName = 'there';

      if (sessionId && userId) {
        try {
          // Get session type
          const { data: session } = await supabase
            .from('therapy_sessions')
            .select('session_type')
            .eq('session_id', sessionId)
            .single();
          
          if (session?.session_type) {
            sessionType = session.session_type;
          }

          // Get user info
          const { data: user } = await supabase
            .from('users')
            .select('email')
            .eq('id', userId)
            .single();
          
          if (user?.email) {
            userName = user.email.split('@')[0]; // Use email prefix as name
          }

          // Check if first session
          isFirstSession = await detectFirstSession(userId, sessionId);

          // Get user memory
          userMemory = await getUserMemory(userId);
        } catch (error) {
          console.error('Error fetching session context:', error);
          // Continue with defaults if context fetch fails
        }
      }

      // Build dynamic system prompt
      const systemPromptConfig: SystemPromptConfig = {
        sessionType,
        isFirstSession,
        userMemory,
        userName
      };

      const systemMessage = {
        role: 'system' as const,
        content: getSystemPrompt(systemPromptConfig)
      };

      const allMessages = [systemMessage, ...messages];

      if (config.provider === 'openai') {
        const response = await provider.chat.completions.create({
          model: config.model,
          messages: allMessages as any,
          stream: true,
        });

        let content = '';
        for await (const chunk of response) {
          if (chunk.choices[0]?.delta?.content) {
            content += chunk.choices[0].delta.content;
          }
        }

        // Extract goals from first session if needed
        if (isFirstSession && userId && content) {
          try {
            const goals = extractGoalsFromResponse(content);
            if (goals.length > 0) {
              await storeFirstSessionGoals(userId, goals);
            }
          } catch (error) {
            console.error('Error storing first session goals:', error);
          }
        }

        return { success: true, content };
      } else if (config.provider === 'anthropic') {
        const response = await provider.messages.create({
          model: config.model,
          max_tokens: 1000,
          messages: allMessages as any,
        });

        const content = response.content[0]?.text || 'No response generated';

        // Extract goals from first session if needed
        if (isFirstSession && userId && content) {
          try {
            const goals = extractGoalsFromResponse(content);
            if (goals.length > 0) {
              await storeFirstSessionGoals(userId, goals);
            }
          } catch (error) {
            console.error('Error storing first session goals:', error);
          }
        }

        return { 
          success: true, 
          content 
        };
      } else if (config.provider === 'perplexity') {
        const stream = await provider.chat.completions.create({
          model: config.model,
          messages: allMessages as any,
          stream: true,
        });

        let content = '';
        for await (const chunk of stream) {
          if (chunk.choices[0]?.delta?.content) {
            content += chunk.choices[0].delta.content;
          }
        }

        // Extract goals from first session if needed
        if (isFirstSession && userId && content) {
          try {
            const goals = extractGoalsFromResponse(content);
            if (goals.length > 0) {
              await storeFirstSessionGoals(userId, goals);
            }
          } catch (error) {
            console.error('Error storing first session goals:', error);
          }
        }

        return { success: true, content };
      } else {
        throw new Error(`Unsupported provider: ${config.provider}`);
      }
    } catch (error: any) {
      console.error('AI generation error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to generate AI response' 
      };
    }
  }

  static async testConnection(provider: string, apiKey: string, model: string): Promise<AIResponse> {
    try {
      const config = { provider, api_key: apiKey, model };
      const aiProvider = await this.createAIProvider(config);

      const testMessages: AIMessage[] = [
        { role: 'user', content: 'test' }
      ];

      if (provider === 'openai') {
        const response = await aiProvider.chat.completions.create({
          model: model,
          messages: testMessages as any,
          max_tokens: 1,
        });
        return { success: !!response.choices[0]?.message?.content };
      } else if (provider === 'anthropic') {
        const response = await aiProvider.messages.create({
          model: model,
          max_tokens: 1,
          messages: testMessages as any,
        });
        return { success: !!response.content[0]?.text };
      } else if (provider === 'perplexity') {
        const stream = await aiProvider.chat.completions.create({
          model: model,
          messages: testMessages as any,
          stream: true,
        });

        let hasContent = false;
        for await (const chunk of stream) {
          if (chunk.choices[0]?.delta?.content) {
            hasContent = true;
            break;
          }
        }
        return { success: hasContent };
      } else {
        throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error: any) {
      console.error('Test connection error:', error);
      return { 
        success: false, 
        error: error.message || 'Connection test failed' 
      };
    }
  }

  static async summarizeSession(sessionId: string): Promise<AIResponse> {
    try {
      // Get all messages from the session
      const { data: messages, error } = await supabase
        .from('session_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true });

      if (error || !messages || messages.length === 0) {
        throw new Error('No messages found for session');
      }

      // Format messages for AI
      const aiMessages: AIMessage[] = messages.map(msg => ({
        role: msg.sender_type === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

      // Add summarization prompt
      const summaryPrompt: AIMessage = {
        role: 'user',
        content: 'Please provide a brief summary of this wellness session, highlighting key topics discussed and any important insights or progress made. Keep it concise but meaningful.'
      };

      const summaryResponse = await this.generateResponse([...aiMessages, summaryPrompt]);
      
      if (summaryResponse.success && summaryResponse.content) {
        // Save summary to database
        const { error: saveError } = await supabase
          .from('session_memory')
          .insert({
            session_id: sessionId,
            summary: summaryResponse.content,
            key_topics: this.extractKeyTopics(summaryResponse.content)
          });

        if (saveError) {
          console.error('Error saving session summary:', saveError);
        }
      }

      return summaryResponse;
    } catch (error: any) {
      console.error('Session summarization error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to summarize session' 
      };
    }
  }

  private static extractKeyTopics(summary: string): string[] {
    // Simple keyword extraction - could be enhanced with NLP
    const keywords = [
      'anxiety', 'depression', 'stress', 'mindfulness', 'meditation',
      'wellness', 'counseling', 'mental health', 'self-care', 'personal growth',
      'relationships', 'work', 'family', 'goals', 'progress', 'coping',
      'emotions', 'feelings', 'thoughts', 'behavior', 'patterns'
    ];

    const foundTopics = keywords.filter(keyword => 
      summary.toLowerCase().includes(keyword)
    );

    return foundTopics.length > 0 ? foundTopics : ['general wellness'];
  }
}
