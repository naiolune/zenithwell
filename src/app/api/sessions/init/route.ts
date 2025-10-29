import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAPISecurity, SecurityConfigs, SecurityContext } from '@/middleware/api-security';
import { detectFirstSession } from '@/lib/ai/memory-service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handleSessionInit(request: NextRequest, context: SecurityContext): Promise<NextResponse> {
  try {
    const { sessionId } = await request.json();

    if (!context.user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Verify user owns this session and get lock status
    const { data: session, error: sessionError } = await supabase
      .from('therapy_sessions')
      .select('session_id, title, created_at, user_id, is_locked, locked_at, locked_by, lock_reason, can_unlock')
      .eq('session_id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.user_id !== context.user.id) {
      return NextResponse.json({ error: 'Access denied to this session' }, { status: 403 });
    }

    // Get user subscription
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('user_id', context.user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User data not found' }, { status: 404 });
    }

    // Check if this is the user's first session (server-side)
    const isFirstSession = await detectFirstSession(context.user.id, sessionId);

    // Get existing messages
    const { data: messages, error: messagesError } = await supabase
      .from('session_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }

    // If no messages exist, we need to add the appropriate AI introduction
    let initialMessage = null;
    if (!messages || messages.length === 0) {
      if (isFirstSession) {
        initialMessage = {
          id: 'ai-intro',
          content: `Welcome! I'm your wellness coach. Let's start with your goals:

What are your main wellness goals? What would you like to work on?`,
          sender: 'ai',
          timestamp: new Date().toISOString(),
        };
      } else {
        initialMessage = {
          id: 'ai-greeting',
          content: `Welcome back! How are you feeling today? What would you like to work on?`,
          sender: 'ai',
          timestamp: new Date().toISOString(),
        };
      }

      // Save the initial message to database
      const { data: savedMessage, error: saveError } = await supabase
        .from('session_messages')
        .insert({
          session_id: sessionId,
          sender_type: 'ai',
          content: initialMessage.content
        })
        .select()
        .single();

      if (saveError) {
        console.error('Error saving initial message:', saveError);
        return NextResponse.json({ error: 'Failed to save initial message' }, { status: 500 });
      }

      initialMessage.id = savedMessage.message_id;
    }

    // Format messages for client
    const formattedMessages = (messages || []).map(msg => {
      const timestamp = new Date(msg.timestamp);
      if (isNaN(timestamp.getTime())) {
        console.error('Invalid timestamp:', msg.timestamp);
        return {
          id: msg.message_id,
          content: msg.content,
          sender: msg.sender_type as 'user' | 'ai',
          timestamp: new Date(), // fallback to current time
        };
      }
      return {
        id: msg.message_id,
        content: msg.content,
        sender: msg.sender_type as 'user' | 'ai',
        timestamp,
      };
    });

    // Add initial message if it was created
    if (initialMessage) {
      const initialTimestamp = new Date(initialMessage.timestamp);
      formattedMessages.push({
        id: initialMessage.id,
        content: initialMessage.content,
        sender: initialMessage.sender as 'user' | 'ai',
        timestamp: isNaN(initialTimestamp.getTime()) ? new Date() : initialTimestamp,
      });
    }

    return NextResponse.json({
      success: true,
      session: {
        id: session.session_id,
        title: session.title,
        created_at: session.created_at,
        is_locked: session.is_locked || false,
        locked_at: session.locked_at,
        locked_by: session.locked_by,
        lock_reason: session.lock_reason,
        can_unlock: session.can_unlock,
      },
      messages: formattedMessages,
      userSubscription: userData.subscription_tier,
      isFirstSession,
    });

  } catch (error: any) {
    console.error('Session init error:', error);
    return NextResponse.json({ 
      error: 'Failed to initialize session' 
    }, { status: 500 });
  }
}

// Export the secured handler
export const POST = withAPISecurity(handleSessionInit, SecurityConfigs.AI_CHAT);