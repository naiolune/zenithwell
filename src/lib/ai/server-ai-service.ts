import { createClient } from '@supabase/supabase-js';
import { getSystemPrompt, SystemPromptConfig, ParticipantIntroduction, GroupMemory } from './system-prompts';
import { getGroupMemories } from './group-memory-service';
import { 
  getUserMemory, 
  formatMemoryContext, 
  detectFirstSession,
  storeFirstSessionGoals,
  extractGoalsFromResponse,
  UserMemory 
} from './memory-service';
import { getAITools } from './tools';
import { executeToolCall, ToolCall, ToolResult } from './tool-executor';

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
  private static isNewOpenAIModel(model: string): boolean {
    // Newer OpenAI models that use max_completion_tokens instead of max_tokens
    const newModels = ['gpt-5', 'gpt-4.1', 'o3', 'gpt-4o', 'gpt-4o-realtime-preview'];
    return newModels.some(newModel => model.includes(newModel));
  }

  private static getOpenAITokenParam(model: string, tokens: number) {
    if (this.isNewOpenAIModel(model)) {
      return { max_completion_tokens: tokens };
    } else {
      return { max_tokens: tokens };
    }
  }

  private static getOpenAITokenLimit(model: string): number {
    // Set appropriate token limits based on model capabilities
    if (model.includes('gpt-5')) {
      return 4000; // Higher limit for GPT-5
    } else if (model.includes('o3')) {
      return 4000; // Higher limit for o3
    } else if (model.includes('gpt-4o')) {
      return 4000; // Higher limit for GPT-4o
    } else if (model.includes('gpt-4.1')) {
      return 3000; // Medium limit for GPT-4.1
    } else {
      return 2000; // Default limit for other models
    }
  }

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
    let config: any;
    let allMessages: AIMessage[] = [];
    try {
      config = await this.getActiveAIConfig();
      const provider = await this.createAIProvider(config);

      // Get session details and user context
      let sessionType: 'individual' | 'relationship' | 'family' | 'general' = 'individual';
      let isFirstSession = false;
      let userMemory: UserMemory[] = [];
      let userName = 'there';
      let participantIntroductions: ParticipantIntroduction[] = [];
      let groupMemory: GroupMemory[] = [];

      if (sessionId && userId) {
        try {
          // Get session details
          const { data: session } = await supabase
            .from('therapy_sessions')
            .select('session_type, group_category')
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

          // Check if first session (only for individual sessions)
          if (sessionType === 'individual') {
            isFirstSession = await detectFirstSession(userId, sessionId);
          }

          // Get user memory (only for individual sessions)
          if (sessionType === 'individual') {
            userMemory = await getUserMemory(userId);
          }

          // Get participant introductions and group memory for group sessions
          if (session?.group_category) {
            // Get participant introductions
            const { data: introductions } = await supabase
              .from('participant_introductions')
              .select(`
                user_id,
                group_category,
                relationship_role,
                why_wellness,
                goals,
                challenges,
                family_role,
                family_goals,
                what_to_achieve,
                participant_role,
                wellness_reason,
                personal_goals,
                expectations,
                users!inner(
                  id,
                  email,
                  full_name
                )
              `)
              .eq('session_id', sessionId);

            if (introductions) {
              participantIntroductions = introductions.map(intro => {
                const user = Array.isArray(intro.users) ? intro.users[0] : intro.users;
                return {
                  user_id: intro.user_id,
                  user_name: user?.full_name || user?.email,
                  user_email: user?.email,
                group_category: intro.group_category,
                relationship_role: intro.relationship_role,
                why_wellness: intro.why_wellness,
                goals: intro.goals,
                challenges: intro.challenges,
                family_role: intro.family_role,
                family_goals: intro.family_goals,
                what_to_achieve: intro.what_to_achieve,
                participant_role: intro.participant_role,
                wellness_reason: intro.wellness_reason,
                personal_goals: intro.personal_goals,
                expectations: intro.expectations
                };
              });
            }

            // Get group memory
            groupMemory = await getGroupMemories(sessionId);
          }
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
        userName,
        participantIntroductions,
        groupMemory
      };

      const systemMessage = {
        role: 'system' as const,
        content: getSystemPrompt(systemPromptConfig)
      };

      allMessages = [systemMessage, ...messages];

      // Log full message sequence being sent to AI
      console.log('=== AI REQUEST DEBUG ===');
      console.log('Provider:', config.provider);
      console.log('Model:', config.model);
      console.log('Total messages:', allMessages.length);
      console.log('Message sequence:');
      allMessages.forEach((msg, index) => {
        console.log(`  [${index}] ${msg.role.toUpperCase()}:`, msg.content);
      });
      console.log('=== END AI REQUEST DEBUG ===');

      // Validate message alternation before sending to AI
      for (let i = 1; i < allMessages.length; i++) {
        if (allMessages[i].role === allMessages[i - 1].role) {
          console.error('Consecutive messages of same role detected:', {
            index: i,
            role: allMessages[i].role,
            prevRole: allMessages[i - 1].role
          });
          return {
            success: false,
            error: 'Invalid message sequence: consecutive messages of same role'
          };
        }
      }

      if (config.provider === 'openai') {
        const tokenLimit = this.getOpenAITokenLimit(config.model);
        const tokenParam = this.getOpenAITokenParam(config.model, tokenLimit);
        
        console.log(`Using token limit: ${tokenLimit} for model: ${config.model}`);
        
        // Get tools for function calling
        const tools = getAITools();
        
        const response = await provider.chat.completions.create({
          model: config.model,
          messages: allMessages as any,
          tools: tools,
          tool_choice: "auto",
          ...tokenParam,
        });

        const message = response.choices[0]?.message;
        if (!message) {
          return { success: false, error: 'No response from AI' };
        }

        console.log('=== AI RESPONSE DEBUG ===');
        console.log('Provider: OpenAI');
        console.log('Message content:', message.content?.substring(0, 200) + (message.content?.length > 200 ? '...' : ''));
        console.log('Tool calls:', message.tool_calls?.length || 0);
        console.log('=== END AI RESPONSE DEBUG ===');

        let finalContent = message.content || '';

        // Handle tool calls if present
        if (message.tool_calls && message.tool_calls.length > 0) {
          console.log('Processing tool calls:', message.tool_calls.length);
          
          // Execute all tool calls
          const toolResults: ToolResult[] = [];
          for (const toolCall of message.tool_calls) {
            if (toolCall.type === 'function') {
              const result = await executeToolCall(toolCall as ToolCall, sessionId || '', userId || '');
              toolResults.push(result);
            }
          }

          // Add tool results to messages and get final response
          const messagesWithTools = [
            ...allMessages,
            message,
            ...toolResults
          ];

          const finalResponse = await provider.chat.completions.create({
            model: config.model,
            messages: messagesWithTools as any,
            ...tokenParam,
          });

          finalContent = finalResponse.choices[0]?.message?.content || finalContent;
          
          console.log('Final response after tools:', finalContent.substring(0, 200) + (finalContent.length > 200 ? '...' : ''));
        }

        // Extract goals from first session if needed
        if (isFirstSession && userId && finalContent) {
          try {
            const goals = extractGoalsFromResponse(finalContent);
            if (goals.length > 0) {
              await storeFirstSessionGoals(userId, goals);
            }
          } catch (error) {
            console.error('Error storing first session goals:', error);
          }
        }

        return { success: true, content: finalContent };
      } else if (config.provider === 'anthropic') {
        const response = await provider.messages.create({
          model: config.model,
          max_tokens: 1000,
          messages: allMessages as any,
        });

        const content = response.content[0]?.text || 'No response generated';

        console.log('=== AI RESPONSE DEBUG ===');
        console.log('Provider: Anthropic');
        console.log('Response received:', content.substring(0, 200) + (content.length > 200 ? '...' : ''));
        console.log('=== END AI RESPONSE DEBUG ===');

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
        // Perplexity requires a single user message with concatenated content
        const concatenatedContent = allMessages
          .map(msg => {
            if (msg.role === 'system') {
              return `System: ${msg.content}`;
            } else if (msg.role === 'assistant') {
              return `Assistant: ${msg.content}`;
            } else {
              return `User: ${msg.content}`;
            }
          })
          .join('\n\n');

        const perplexityMessages = [{
          role: 'user',
          content: concatenatedContent
        }];

        console.log('=== PERPLEXITY FORMAT DEBUG ===');
        console.log('Original messages:', allMessages.length);
        console.log('Concatenated content:', concatenatedContent.substring(0, 200) + '...');
        console.log('Perplexity messages:', perplexityMessages);
        console.log('=== END PERPLEXITY FORMAT DEBUG ===');

        const completion = await provider.chat.completions.create({
          model: config.model,
          messages: perplexityMessages as any,
        });

        const content = completion.choices[0]?.message?.content || 'No response generated';
        
        console.log('=== AI RESPONSE DEBUG ===');
        console.log('Provider: Perplexity');
        console.log('Response received:', content.substring(0, 200) + (content.length > 200 ? '...' : ''));
        console.log('Full response object:', JSON.stringify(completion, null, 2));
        console.log('=== END AI RESPONSE DEBUG ===');

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
      console.error('=== AI ERROR DEBUG ===');
      console.error('Error message:', error.message);
      console.error('Error code:', error.code || error.status || 'N/A');
      console.error('Error type:', error.type || 'N/A');
      console.error('Full error object:', error);
      if (typeof config !== 'undefined') {
        console.error('Provider:', config.provider);
        console.error('Model:', config.model);
      }
      if (typeof allMessages !== 'undefined' && allMessages) {
        console.error('Message count:', allMessages.length);
        console.error('Last 3 messages:', allMessages.slice(-3).map(m => ({ 
          role: m.role, 
          content: m.content.substring(0, 100) + (m.content.length > 100 ? '...' : '')
        })));
        console.error('Full message sequence:');
        allMessages.forEach((msg, index) => {
          console.error(`  [${index}] ${msg.role.toUpperCase()}:`, msg.content);
        });
      }
      console.error('=== END AI ERROR DEBUG ===');
      return { 
        success: false, 
        error: error.message || 'Failed to generate AI response' 
      };
    }
  }

  static async testConnection(provider: string, apiKey: string, model: string): Promise<AIResponse> {
    try {
      // Validate inputs
      if (!provider || !apiKey || !model) {
        return {
          success: false,
          error: 'Provider, API key, and model are required'
        };
      }

      // Validate API key format (basic check)
      if (provider === 'openai' && !apiKey.startsWith('sk-')) {
        return {
          success: false,
          error: 'Invalid OpenAI API key format. OpenAI keys should start with "sk-"'
        };
      }

      const config = { provider, api_key: apiKey, model };
      const aiProvider = await this.createAIProvider(config);

      const testMessages: AIMessage[] = [
        { role: 'user', content: 'Hi' }
      ];

      if (provider === 'openai') {
        const tokenParam = this.getOpenAITokenParam(model, 500); // Use 500 tokens for test
        console.log(`Testing OpenAI connection with model: ${model}`);
        
        const response = await aiProvider.chat.completions.create({
          model: model,
          messages: testMessages as any,
          ...tokenParam,
          tool_choice: 'none', // Disable tool calls for test to ensure text response
        });
        
        // Log response structure for debugging
        console.log('OpenAI test response:', JSON.stringify({
          choices: response.choices?.length,
          firstChoice: response.choices?.[0] ? {
            message: {
              role: response.choices[0].message?.role,
              content: response.choices[0].message?.content,
              hasContent: !!response.choices[0].message?.content,
              toolCalls: response.choices[0].message?.tool_calls?.length
            }
          } : null
        }, null, 2));
        
        const message = response.choices[0]?.message;
        if (!message) {
          return {
            success: false,
            error: 'Received empty response from OpenAI API (no choices returned)'
          };
        }
        
        // Check for content in message
        if (!message.content && (!message.tool_calls || message.tool_calls.length === 0)) {
          return {
            success: false,
            error: 'Received empty response from OpenAI API (no content or tool calls)'
          };
        }
        
        return { success: true };
      } else if (provider === 'anthropic') {
        const response = await aiProvider.messages.create({
          model: model,
          max_tokens: 10,
          messages: testMessages as any,
        });
        
        if (!response.content[0]?.text) {
          return {
            success: false,
            error: 'Received empty response from Anthropic API'
          };
        }
        
        return { success: true };
      } else if (provider === 'perplexity') {
        const completion = await aiProvider.chat.completions.create({
          model: model,
          messages: testMessages as any,
        });
        
        if (!completion.choices[0]?.message?.content) {
          return {
            success: false,
            error: 'Received empty response from Perplexity API'
          };
        }
        
        return { success: true };
      } else {
        throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error: any) {
      console.error('Test connection error:', error);
      console.error('Error details:', {
        status: error?.status || error?.statusCode,
        message: error?.message,
        code: error?.code,
        type: error?.type,
        error: error?.error
      });
      
      // Extract detailed error information
      let errorMessage = 'Connection test failed';
      
      // OpenAI SDK v6 error structure
      const status = error?.status || error?.statusCode || error?.response?.status;
      const errorData = error?.error || error?.response?.data?.error;
      
      if (status === 401 || error?.code === 'invalid_api_key') {
        errorMessage = 'Invalid API key. Please check your API key and try again.';
      } else if (status === 404 || error?.code === 'model_not_found') {
        errorMessage = `Model "${model}" not found. Please verify the model name is correct.`;
      } else if (status === 429 || error?.code === 'rate_limit_exceeded') {
        errorMessage = 'Rate limit exceeded. Please try again later.';
      } else if (status === 500 || status === 502 || status === 503) {
        errorMessage = 'OpenAI API is temporarily unavailable. Please try again later.';
      } else if (errorData?.message) {
        errorMessage = errorData.message;
      } else if (error?.message) {
        errorMessage = error.message;
        
        // Provide more helpful messages for common errors
        if (error.message.includes('API key') || error.message.includes('api_key')) {
          errorMessage = 'Invalid API key. Please verify your API key is correct.';
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
          errorMessage = 'Network error: Unable to connect to OpenAI API. Please check your internet connection.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Connection timeout. Please try again.';
        } else if (error.message.includes('model')) {
          errorMessage = `Model error: ${error.message}`;
        }
      } else if (status) {
        errorMessage = `API error (${status}): ${error?.statusText || 'Unknown error'}`;
      }
      
      return { 
        success: false, 
        error: errorMessage
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
