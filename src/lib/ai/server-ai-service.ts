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

        console.log('=== AI RESPONSE DEBUG ===');
        console.log('Provider: OpenAI');
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

        return { success: true, content };
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
        const completion = await aiProvider.chat.completions.create({
          model: model,
          messages: testMessages as any,
        });
        return { success: !!completion.choices[0]?.message?.content };
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
