import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ServerAIService } from '@/lib/ai/server-ai-service';
import { withAPISecurity, SecurityConfigs, SecurityContext } from '@/middleware/api-security';
import { InputSanitizer } from '@/lib/security/input-sanitizer';
import { SecureErrorHandler } from '@/lib/security/error-handler';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
      .select('user_id')
      .eq('session_id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
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
      .select('created_at, last_message_at')
      .eq('session_id', sessionId)
      .single();

    if (sessionDataError || !sessionData) {
      return NextResponse.json({ error: 'Session data not found' }, { status: 404 });
    }

    // Server-side session time validation for free users
    if (userData.subscription_tier === 'free') {
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
    }

    // Server-side session count validation for free users
    if (userData.subscription_tier === 'free') {
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

    // Save user message to database
    const { data: userMessage, error: messageError } = await supabase
      .from('session_messages')
      .insert({
        session_id: sessionId,
        sender_type: 'user',
        content: sanitizedMessage
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error saving user message:', messageError);
      return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
    }

    // Get recent messages for context
    const { data: recentMessages, error: messagesError } = await supabase
      .from('session_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: false })
      .limit(10);

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }

    // Convert to AI format (reverse order for proper context)
    const aiMessages = recentMessages
      .reverse()
      .map(msg => ({
        role: (msg.sender_type === 'user' ? 'user' : 'assistant') as 'user' | 'assistant' | 'system',
        content: msg.content
      }));

    // Generate AI response with enhanced context
    const aiResponse = await ServerAIService.generateResponse(aiMessages, sessionId, context.user.id);

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

    return NextResponse.json({ 
      success: true, 
      message: aiResponse.content,
      messageId: aiMessage.id
    });

  } catch (error: any) {
    return SecureErrorHandler.handleAPIError(error, 'Chat API');
  }
}

// Export the secured handler
export const POST = withAPISecurity(handleChatRequest, SecurityConfigs.AI_CHAT);
