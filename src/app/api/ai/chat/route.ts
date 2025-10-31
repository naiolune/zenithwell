import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ServerAIService } from '@/lib/ai/server-ai-service';
import { withAPISecurity, SecurityConfigs, SecurityContext } from '@/middleware/api-security';
import { InputSanitizer } from '@/lib/security/input-sanitizer';
import { SecureErrorHandler } from '@/lib/security/error-handler';
import { generateGroupSessionIntro } from '@/lib/ai/group-intro-generator';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Generate session name and summary based on conversation content
 */
async function generateSessionMetadata(sessionId: string, messages: any[], aiResponse: string) {
  try {
    // Only generate metadata after a few messages to have enough context
    if (messages.length < 3) {
      return;
    }

    // Check if session already has a custom title (not the default)
    const { data: session } = await supabase
      .from('therapy_sessions')
      .select('title, session_summary')
      .eq('session_id', sessionId)
      .single();

    if (!session) return;

    // Skip if session already has a custom title or summary
    if (session.title !== 'New Individual Session' && session.title !== 'New Group Session' && session.session_summary) {
      return;
    }

    // Create a summary of the conversation for AI analysis
    const conversationSummary = messages
      .slice(-10) // Last 10 messages for context
      .map(msg => `${msg.sender_type}: ${msg.content}`)
      .join('\n');

    // Generate session name and summary using AI
    const { data: aiConfig } = await supabase
      .from('ai_config')
      .select('*')
      .eq('is_active', true)
      .single();

    if (!aiConfig) return;

    const prompt = `Based on this wellness conversation, generate a concise session title (max 50 chars) and a brief summary (max 200 chars) that captures the main topics and themes discussed.

Conversation:
${conversationSummary}

AI Response: ${aiResponse}

Please respond in this exact format:
TITLE: [Session Title Here]
SUMMARY: [Brief summary of the session topics and themes]

The title should be engaging and descriptive. The summary should highlight the main wellness topics, goals, or challenges discussed.`;

    let aiResponse_text = '';
    
    if (aiConfig.provider === 'openai') {
      const OpenAI = require('openai').default;
      const openai = new OpenAI({ apiKey: aiConfig.api_key });
      
      // Use correct token parameter for newer models with higher limits
      const isNewModel = ['gpt-5', 'gpt-4.1', 'o3', 'gpt-4o', 'gpt-4o-realtime-preview'].some(newModel => aiConfig.model.includes(newModel));
      const tokenLimit = isNewModel ? 500 : 200; // Higher limit for newer models
      const tokenParam = isNewModel ? { max_completion_tokens: tokenLimit } : { max_tokens: tokenLimit };
      
      const response = await openai.chat.completions.create({
        model: aiConfig.model,
        messages: [{ role: 'user', content: prompt }],
        ...tokenParam,
        temperature: 0.7,
      });
      
      aiResponse_text = response.choices[0]?.message?.content || '';
    } else if (aiConfig.provider === 'anthropic') {
      const Anthropic = require('@anthropic-ai/sdk').default;
      const anthropic = new Anthropic({ apiKey: aiConfig.api_key });
      
      const response = await anthropic.messages.create({
        model: aiConfig.model,
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      });
      
      aiResponse_text = response.content[0]?.text || '';
    }

    if (!aiResponse_text) return;

    // Parse the AI response
    const titleMatch = aiResponse_text.match(/TITLE:\s*(.+)/);
    const summaryMatch = aiResponse_text.match(/SUMMARY:\s*(.+)/);

    if (titleMatch && summaryMatch) {
      const newTitle = titleMatch[1].trim();
      const newSummary = summaryMatch[1].trim();

      // Update the session with the generated metadata
      await supabase
        .from('therapy_sessions')
        .update({
          title: newTitle,
          session_summary: newSummary
        })
        .eq('session_id', sessionId);
    }
  } catch (error) {
    console.error('Error generating session metadata:', error);
    // Don't throw error as this is not critical functionality
  }
}

async function handleChatRequest(request: NextRequest, context: SecurityContext): Promise<NextResponse> {
  try {
    const { message, sessionId } = await request.json();

    if (!context.user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Validate and sanitize inputs
    if (!InputSanitizer.validateSessionId(sessionId)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (message.length > 10000) {
      return NextResponse.json({ error: 'Message too long' }, { status: 400 });
    }

    const sanitizedMessage = InputSanitizer.sanitizeMessage(message);

    // Verify user owns or can access this session
    const { data: session, error: sessionError } = await supabase
      .from('therapy_sessions')
      .select('user_id, is_locked, lock_reason')
      .eq('session_id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Check if session is locked
    if (session.is_locked) {
      return NextResponse.json({ 
        error: 'This session has been locked for your safety. Please contact support if you need assistance.',
        sessionLocked: true,
        lockReason: session.lock_reason
      }, { status: 423 }); // 423 Locked
    }

    // Check if user owns the session or is a participant
    const isOwner = session.user_id === context.user.id;
    if (!isOwner) {
      // Check if user is a participant in group session
      const { data: participation } = await supabase
        .from('session_participants')
        .select('user_id')
        .eq('session_id', sessionId)
        .eq('user_id', context.user.id)
        .single();

      if (!participation) {
        return NextResponse.json({ error: 'Access denied to this session' }, { status: 403 });
      }
    }

    // For group sessions, check if all participants are online
    const { data: sessionDetails } = await supabase
      .from('therapy_sessions')
      .select('session_type, group_category, session_status')
      .eq('session_id', sessionId)
      .single();

    if (sessionDetails?.session_type === 'group') {
      // Check if all participants are online using the database function
      const { data: allOnline, error: presenceError } = await supabase
        .rpc('check_all_participants_online', { session_uuid: sessionId });

      if (presenceError) {
        console.error('Error checking participant presence:', presenceError);
        return NextResponse.json({ error: 'Failed to check participant presence' }, { status: 500 });
      }

      if (!allOnline) {
        return NextResponse.json({ 
          error: 'All participants must be online to continue the session',
          waitingForParticipants: true,
          message: 'Please wait for all participants to join before continuing the conversation.'
        }, { status: 423 }); // 423 Locked
      }

      // Check if session is in waiting status
      if (sessionDetails.session_status === 'waiting') {
        return NextResponse.json({ 
          error: 'Session is still in waiting room',
          sessionWaiting: true,
          message: 'The session has not started yet. Please wait for all participants to be ready.'
        }, { status: 423 }); // 423 Locked
      }
    }

    // Get user subscription and session details for validation
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('user_id', context.user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User data not found' }, { status: 404 });
    }

    const { data: sessionData, error: sessionDataError } = await supabase
      .from('therapy_sessions')
      .select('created_at, last_message_at, user_id')
      .eq('session_id', sessionId)
      .single();

    if (sessionDataError || !sessionData) {
      return NextResponse.json({ error: 'Session data not found' }, { status: 404 });
    }

    // Only apply session time and count restrictions to session owners, not participants
    // Participants who joined via invite don't need Pro subscription or time limits
    if (isOwner && userData.subscription_tier === 'free') {
      // Server-side session time validation for free users (owners only)
      const sessionStartTime = new Date(sessionData.created_at);
      const now = new Date();
      const sessionDuration = now.getTime() - sessionStartTime.getTime();
      const maxSessionDuration = 15 * 60 * 1000; // 15 minutes in milliseconds

      if (sessionDuration > maxSessionDuration) {
        return NextResponse.json({ 
          error: 'Session time expired',
          sessionExpired: true,
          message: 'Free users are limited to 15 minutes per session. Upgrade to Pro for unlimited time.'
        }, { status: 403 });
      }

      // Server-side session count validation for free users (owners only)
      const { data: userSessions, error: sessionsError } = await supabase
        .from('therapy_sessions')
        .select('session_id')
        .eq('user_id', context.user.id);

      if (sessionsError) {
        return NextResponse.json({ error: 'Failed to validate session count' }, { status: 500 });
      }

      if (userSessions && userSessions.length > 3) {
        return NextResponse.json({ 
          error: 'Session limit exceeded',
          sessionLimitExceeded: true,
          message: 'Free users are limited to 3 sessions. Upgrade to Pro for unlimited sessions.'
        }, { status: 403 });
      }
    }

    // Check last 3 messages to enforce rate limiting (max 3 consecutive messages per participant)
    // Only check if this is a group session
    const { data: sessionCheck } = await supabase
      .from('therapy_sessions')
      .select('session_type, is_group')
      .eq('session_id', sessionId)
      .single();

    const isGroupSession = sessionCheck?.session_type === 'group' || sessionCheck?.is_group;

    if (isGroupSession) {
      // Get last 3 messages to check for rate limiting
      const { data: recentMessages, error: recentMessagesError } = await supabase
        .from('session_messages')
        .select('sender_type, user_id')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: false })
        .limit(3);

      if (recentMessagesError) {
        console.error('Error checking recent messages:', recentMessagesError);
        return NextResponse.json({ error: 'Failed to validate message sequence' }, { status: 500 });
      }

      // Count consecutive messages from the same user
      if (recentMessages && recentMessages.length > 0) {
        let consecutiveCount = 0;
        for (const msg of recentMessages) {
          if (msg.sender_type === 'user' && msg.user_id === context.user.id) {
            consecutiveCount++;
          } else {
            // Stop counting when we hit an AI message or message from another participant
            break;
          }
        }

        // Allow maximum 3 consecutive messages per participant
        if (consecutiveCount >= 3) {
          return NextResponse.json({ 
            error: 'You have reached the limit of 3 consecutive messages. Please wait for a response or let another participant speak.',
            code: 'RATE_LIMIT_EXCEEDED',
            consecutiveCount
          }, { status: 400 });
        }
      }
    }

    // Save user message to database (only if validation passed)
    // Try inserting with user_id first, fallback to without if column doesn't exist yet
    let insertData: any = {
      session_id: sessionId,
      sender_type: 'user',
      content: sanitizedMessage,
    };
    
    // Include user_id if the column exists (migration may not have been run yet)
    insertData.user_id = context.user.id;

    let userMessage: any;
    const { data: insertedMessage, error: messageError } = await supabase
      .from('session_messages')
      .insert(insertData)
      .select()
      .single();

    if (messageError) {
      // If error is about missing user_id column, try without it
      if (messageError.code === 'PGRST204' && messageError.message?.includes('user_id')) {
        console.warn('user_id column not found, inserting without it. Please run migration: add-user-id-to-session-messages.sql');
        const { data: retryMessage, error: retryError } = await supabase
          .from('session_messages')
          .insert({
            session_id: sessionId,
            sender_type: 'user',
            content: sanitizedMessage,
          })
          .select()
          .single();
        
        if (retryError) {
          console.error('Error saving user message (retry):', retryError);
          return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
        }
        
        userMessage = retryMessage;
      } else {
        console.error('Error saving user message:', messageError);
        return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
      }
    } else {
      userMessage = insertedMessage;
    }

    console.log('=== CHAT API DEBUG ===');
    console.log('User message saved successfully');

    // Verify intro message exists
    let { data: introMsg } = await supabase
      .from('session_messages')
      .select('*')
      .eq('session_id', sessionId)
      .eq('sender_type', 'ai')
      .order('timestamp', { ascending: true })
      .limit(1)
      .maybeSingle();

    // If no intro message exists, check if this is a group session and create one
    if (!introMsg) {
      const { data: session } = await supabase
        .from('therapy_sessions')
        .select('is_group, session_type, group_category')
        .eq('session_id', sessionId)
        .maybeSingle();

      const isGroupSession = session?.is_group || session?.session_type === 'group';
      
      if (isGroupSession) {
        try {
          const customIntro = await generateGroupSessionIntro(sessionId);
          if (customIntro) {
            // Save the custom intro message
            const { data: savedIntro, error: introError } = await supabase
              .from('session_messages')
              .insert({
                session_id: sessionId,
                sender_type: 'ai',
                content: customIntro
              })
              .select()
              .single();

            if (!introError && savedIntro) {
              introMsg = savedIntro;
              console.log('Created custom group intro message');
            }
          }
        } catch (error) {
          console.error('Error creating custom group intro:', error);
        }
      }
    }

    console.log('First AI message check:', introMsg ? `Found: ${introMsg.content.substring(0, 50)}...` : 'NOT FOUND');

    // Get recent messages for context
    const { data: recentMessages, error: messagesError } = await supabase
      .from('session_messages')
      .select('*, user_id')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: false })
      .limit(10);

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }

    console.log('Raw messages from database:', recentMessages.length);
    recentMessages.forEach((msg, i) => {
      console.log(`  DB[${i}] ${msg.sender_type}: ${msg.content.substring(0, 50)}... (user_id: ${msg.user_id || 'none'})`);
    });

    // Check if this is a group session to include user context in messages
    const isGroupSession = sessionDetails?.session_type === 'group';
    
    // Get participant names for group sessions
    let participantNames: Map<string, string> = new Map();
    if (isGroupSession) {
      // First, add the session owner to the participant names map
      // The owner might not be in session_participants table
      try {
        const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(session.user_id);
        if (!authError && authUser?.user) {
          const meta = authUser.user.user_metadata || {};
          
          // Prefer first_name + last_name, fallback to full_name, then name, then display_name, then email username
          let participantName = 'Participant';
          if (meta.first_name || meta.last_name) {
            participantName = `${meta.first_name || ''} ${meta.last_name || ''}`.trim();
          } else {
            participantName = meta.full_name || meta.name || meta.display_name || null;
          }
          
          // Fallback to email username if no name found
          if (!participantName && authUser.user.email) {
            participantName = authUser.user.email.split('@')[0];
          }
          
          // Extract first name if full name exists (for consistency with participants API)
          if (participantName && participantName.trim()) {
            const firstName = participantName.trim().split(' ')[0];
            participantNames.set(session.user_id, firstName || participantName.trim());
          } else {
            participantNames.set(session.user_id, 'Participant');
          }
        }
      } catch (error) {
        console.error(`Error fetching session owner name for ${session.user_id}:`, error);
      }
      
      // Then fetch all participants from session_participants table
      const { data: participants } = await supabase
        .from('session_participants')
        .select('user_id')
        .eq('session_id', sessionId);
      
      if (participants) {
        // Fetch participant names from auth.users.user_metadata (same approach as participants API)
        for (const p of participants) {
          // Skip if already added (owner)
          if (participantNames.has(p.user_id)) {
            continue;
          }
          
          try {
            const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(p.user_id);
            if (!authError && authUser?.user) {
              const meta = authUser.user.user_metadata || {};
              
              // Prefer first_name + last_name, fallback to full_name, then name, then display_name, then email username
              let participantName = 'Participant';
              if (meta.first_name || meta.last_name) {
                participantName = `${meta.first_name || ''} ${meta.last_name || ''}`.trim();
              } else {
                participantName = meta.full_name || meta.name || meta.display_name || null;
              }
              
              // Fallback to email username if no name found
              if (!participantName && authUser.user.email) {
                participantName = authUser.user.email.split('@')[0];
              }
              
              // Extract first name if full name exists (for consistency with participants API)
              if (participantName && participantName.trim()) {
                const firstName = participantName.trim().split(' ')[0];
                participantNames.set(p.user_id, firstName || participantName.trim());
              } else {
                participantNames.set(p.user_id, 'Participant');
              }
            } else {
              // Fallback if we can't get auth user
              participantNames.set(p.user_id, 'Participant');
            }
          } catch (error) {
            console.error(`Error fetching participant name for ${p.user_id}:`, error);
            participantNames.set(p.user_id, 'Participant');
          }
        }
      }
      
      console.log('Participant names map (including owner):', Array.from(participantNames.entries()));
    }

    // Convert to AI format (reverse order for proper context)
    // For group sessions, include user name in user messages
    const aiMessages = recentMessages
      .reverse()
      .map(msg => {
        let content = msg.content;
        
        // For group sessions, prefix user messages with participant name
        if (isGroupSession && msg.sender_type === 'user' && msg.user_id) {
          const participantName = participantNames.get(msg.user_id) || 'Someone';
          content = `[${participantName}]: ${msg.content}`;
        }
        
        return {
          role: (msg.sender_type === 'user' ? 'user' : 'assistant') as 'user' | 'assistant' | 'system',
          content: content
        };
      });

    console.log('Converted to AI format:', aiMessages.length);
    aiMessages.forEach((msg, i) => {
      console.log(`  AI[${i}] ${msg.role}: ${msg.content.substring(0, 50)}...`);
    });

    // Validate and fix message sequence to ensure proper alternation
    const validatedMessages = [];
    let lastRole = null;
    let userMessageCount = 0;
    let assistantMessageCount = 0;
    
    // Process messages in chronological order (oldest first)
    for (const msg of aiMessages) {
      // Skip if this would create consecutive messages of same type
      if (lastRole === msg.role) {
        console.warn(`Skipping consecutive ${msg.role} message:`, msg.content.substring(0, 50));
        continue;
      }
      
      // For user messages, ensure we don't have too many without assistant responses
      if (msg.role === 'user') {
        userMessageCount++;
        // If we have more user messages than assistant messages, skip this one
        if (userMessageCount > assistantMessageCount + 1) {
          console.warn(`Skipping user message ${userMessageCount} - waiting for assistant response`);
          continue;
        }
      } else if (msg.role === 'assistant') {
        assistantMessageCount++;
      }
      
      validatedMessages.push(msg);
      lastRole = msg.role;
    }

    // Ensure we have at least one user message and proper alternation
    if (!validatedMessages.some(msg => msg.role === 'user')) {
      return NextResponse.json({ error: 'No user message found' }, { status: 400 });
    }

    // Ensure the last message is from user (so AI can respond)
    const lastMessage = validatedMessages[validatedMessages.length - 1];
    if (lastMessage.role !== 'user') {
      return NextResponse.json({ error: 'Last message must be from user' }, { status: 400 });
    }

    console.log(`Validated ${validatedMessages.length} messages: ${validatedMessages.map(m => m.role).join(' -> ')}`);

    console.log('After validation:', validatedMessages.length);
    validatedMessages.forEach((msg, i) => {
      console.log(`  VAL[${i}] ${msg.role}: ${msg.content.substring(0, 50)}...`);
    });
    console.log('=== END CHAT API DEBUG ===');

    // Generate AI response with enhanced context
    const aiResponse = await ServerAIService.generateResponse(validatedMessages, sessionId, context.user.id);

    if (!aiResponse.success) {
      return NextResponse.json({ 
        error: aiResponse.error || 'Failed to generate AI response' 
      }, { status: 500 });
    }

    // Save AI response to database
    const { data: aiMessage, error: aiMessageError } = await supabase
      .from('session_messages')
      .insert({
        session_id: sessionId,
        sender_type: 'ai',
        content: aiResponse.content!
      })
      .select()
      .single();

    if (aiMessageError) {
      console.error('Error saving AI message:', aiMessageError);
      return NextResponse.json({ error: 'Failed to save AI response' }, { status: 500 });
    }

    // Update session last message time
    await supabase
      .from('therapy_sessions')
      .update({ last_message_at: new Date().toISOString() })
      .eq('session_id', sessionId);

    // Generate session name and summary if this is a good time to do so
    await generateSessionMetadata(sessionId, recentMessages, aiResponse.content!);

    return NextResponse.json({ 
      success: true, 
      message: aiResponse.content,
      messageId: aiMessage.id
    });

  } catch (error: any) {
    console.error('=== AI ERROR IN API ROUTE ===');
    console.error('Full error:', error);
    console.error('Error stack:', error.stack);
    console.error('=== END API ROUTE ERROR ===');
    return SecureErrorHandler.handleAPIError(error, 'Chat API');
  }
}

// Export the secured handler
export const POST = withAPISecurity(handleChatRequest, SecurityConfigs.AI_CHAT);
