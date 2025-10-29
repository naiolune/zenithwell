import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAPISecurity, SecurityConfigs, SecurityContext } from '@/middleware/api-security';
import { InputSanitizer } from '@/lib/security/input-sanitizer';
import { detectFirstSession } from '@/lib/ai/memory-service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handleCreateSession(request: NextRequest, context: SecurityContext): Promise<NextResponse> {
  try {
    const { title, isGroup = false, sessionType = 'individual' } = await request.json();

    if (!context.user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Validate and sanitize inputs
    const sanitizedTitle = title ? InputSanitizer.sanitizeText(title) : 'New Individual Session';
    
    if (sanitizedTitle.length === 0) {
      return NextResponse.json({ error: 'Invalid session title' }, { status: 400 });
    }

    if (typeof isGroup !== 'boolean') {
      return NextResponse.json({ error: 'Invalid isGroup parameter' }, { status: 400 });
    }

    // Validate session type based on isGroup parameter
    const actualSessionType = isGroup ? 'group' : 'individual';
    
    // Ensure session_type is one of the allowed values
    const allowedSessionTypes = ['individual', 'group', 'introduction'];
    if (!allowedSessionTypes.includes(actualSessionType)) {
      return NextResponse.json({ 
        error: 'Invalid session type',
        details: `Session type must be one of: ${allowedSessionTypes.join(', ')}`
      }, { status: 400 });
    }

    // Get user subscription for validation
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('user_id', context.user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User data not found' }, { status: 404 });
    }

    // Check if this is a first-time user who needs an introduction session
    const isFirstTimeUser = await detectFirstSession(context.user.id);
    
    if (isFirstTimeUser) {
      // For first-time users, try to create an introduction session
      const { data: introSession, error: introCreateError } = await supabase
        .from('therapy_sessions')
        .insert({
          user_id: context.user.id,
          title: 'Introduction Session',
          is_group: false,
          session_type: 'introduction',
          session_summary: 'Initial introduction and goal-setting session'
        })
        .select()
        .single();

      if (introCreateError) {
        console.error('Error creating introduction session:', introCreateError);
        console.error('Error details:', JSON.stringify(introCreateError, null, 2));
        return NextResponse.json({ 
          error: 'Database schema needs to be updated. Please contact support or try again later.',
          details: introCreateError.message,
          requiresMigration: true
        }, { status: 500 });
      }

      // Create the initial AI message for introduction
      const { data: aiMessage, error: messageError } = await supabase
        .from('session_messages')
        .insert({
          session_id: introSession.session_id,
          sender_type: 'ai',
          content: `Welcome to ZenithWell! I'm your AI wellness coach, and I'm here to support your mental wellness journey.

Before we begin, I'd like to understand what brings you here today. Please take your time to answer these questions thoughtfully:

1. **What are your main goals for our sessions together?**
   What would you like to achieve through our conversations?

2. **What areas of your life would you most like to focus on?**
   This could be relationships, work, personal growth, mental health, or anything else.

3. **Are there any specific challenges you're currently facing?**
   What's on your mind that you'd like support with?

4. **How would you know our sessions are helping?**
   What would success look like for you?

Feel free to share as much or as little as you're comfortable with. Everything we discuss is private and will be remembered for future sessions. Take your time - there's no rush!`
        })
        .select()
        .single();

      if (messageError) {
        console.error('Error creating initial AI message:', messageError);
        console.error('Message error details:', JSON.stringify(messageError, null, 2));
        return NextResponse.json({ 
          error: 'Failed to create initial message',
          details: messageError.message 
        }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        session: {
          ...introSession,
          initialMessage: {
            id: aiMessage.message_id,
            content: aiMessage.content,
            sender: 'ai',
            timestamp: new Date(aiMessage.timestamp)
          }
        },
        isIntroductionSession: true,
        message: 'Welcome! Your first session is an introduction to help us understand your goals.'
      });
    }

    // Server-side session count validation for free users (only for regular sessions)
    if (userData.subscription_tier === 'free') {
      const { data: userSessions, error: sessionsError } = await supabase
        .from('therapy_sessions')
        .select('session_id')
        .eq('user_id', context.user.id)
        .eq('session_type', 'individual'); // Only count individual sessions, not introduction

      if (sessionsError) {
        return NextResponse.json({ error: 'Failed to validate session count' }, { status: 500 });
      }

      if (userSessions && userSessions.length >= 3) {
        return NextResponse.json({ 
          error: 'Session limit exceeded',
          sessionLimitExceeded: true,
          message: 'Free users are limited to 3 regular sessions. Upgrade to Pro for unlimited sessions.',
          currentSessions: userSessions.length,
          maxSessions: 3
        }, { status: 403 });
      }
    }

    // Create new regular session
    // Note: Not setting created_at and last_message_at explicitly - let database defaults handle them
    const { data: newSession, error: createError } = await supabase
      .from('therapy_sessions')
      .insert({
        user_id: context.user.id,
        title: sanitizedTitle,
        is_group: isGroup,
        session_type: actualSessionType
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating session:', createError);
      console.error('Error details:', JSON.stringify(createError, null, 2));
      console.error('Attempted session_type:', actualSessionType);
      console.error('Attempted is_group:', isGroup);
      
      // Check if it's a constraint violation
      if (createError.message?.includes('check constraint')) {
        console.error('Constraint violation detected.');
        
        return NextResponse.json({ 
          error: 'Failed to create session',
          details: createError.message,
          hint: 'A database constraint violation occurred. The session_type constraint should allow: individual, group, introduction',
          attemptedValues: {
            session_type: actualSessionType,
            is_group: isGroup,
            allowed_types: ['individual', 'group', 'introduction']
          },
          code: createError.code,
          fullError: createError
        }, { status: 500 });
      }
      
      return NextResponse.json({ 
        error: 'Failed to create session',
        details: createError.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      session: newSession,
      subscriptionTier: userData.subscription_tier
    });

  } catch (error) {
    console.error('Error in create session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withAPISecurity(handleCreateSession, SecurityConfigs.GENERAL_API);