import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAPISecurity, SecurityConfigs, SecurityContext } from '@/middleware/api-security';
import { InputSanitizer } from '@/lib/security/input-sanitizer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handleIntroductionSessionCreation(request: NextRequest, context: SecurityContext): Promise<NextResponse> {
  try {
    if (!context.user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Check if user already has an introduction session
    const { data: existingIntro, error: introError } = await supabase
      .from('therapy_sessions')
      .select('session_id')
      .eq('user_id', context.user.id)
      .eq('session_type', 'introduction')
      .single();

    if (introError && introError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error checking for existing introduction session:', introError);
      return NextResponse.json({ error: 'Failed to check for existing introduction session' }, { status: 500 });
    }

    if (existingIntro) {
      return NextResponse.json({ 
        error: 'Introduction session already exists',
        sessionId: existingIntro.session_id 
      }, { status: 400 });
    }

    // Create the introduction session
    const { data: session, error: sessionError } = await supabase
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

    if (sessionError) {
      console.error('Error creating introduction session:', sessionError);
      return NextResponse.json({ error: 'Failed to create introduction session' }, { status: 500 });
    }

    // Create the initial AI message for introduction
    const { data: aiMessage, error: messageError } = await supabase
      .from('session_messages')
      .insert({
        session_id: session.session_id,
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
      return NextResponse.json({ error: 'Failed to create initial message' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      session: {
        ...session,
        initialMessage: {
          id: aiMessage.message_id,
          content: aiMessage.content,
          sender: 'ai',
          timestamp: new Date(aiMessage.timestamp)
        }
      }
    });

  } catch (error: any) {
    console.error('Introduction session creation error:', error);
    return NextResponse.json({ 
      error: 'Failed to create introduction session' 
    }, { status: 500 });
  }
}

// Export the secured handler
export const POST = withAPISecurity(handleIntroductionSessionCreation, SecurityConfigs.GENERAL_API);