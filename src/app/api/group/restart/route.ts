import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAPISecurity, SecurityConfigs, SecurityContext } from '@/middleware/api-security';
import { generateGroupSessionIntro } from '@/lib/ai/group-intro-generator';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handleRestartRequest(request: NextRequest, context: SecurityContext): Promise<NextResponse> {
  try {
    const { sessionId } = await request.json();

    if (!context.user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Verify user owns the session
    const { data: session, error: sessionError } = await supabase
      .from('therapy_sessions')
      .select('user_id, session_type')
      .eq('session_id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.user_id !== context.user.id) {
      return NextResponse.json({ error: 'Only session owner can restart the session' }, { status: 403 });
    }

    if (session.session_type !== 'group') {
      return NextResponse.json({ error: 'Can only restart group sessions' }, { status: 400 });
    }

    // Delete all messages for this session
    const { error: deleteError } = await supabase
      .from('session_messages')
      .delete()
      .eq('session_id', sessionId);

    if (deleteError) {
      console.error('Error deleting messages:', deleteError);
      return NextResponse.json({ error: 'Failed to delete messages' }, { status: 500 });
    }

    // Generate new intro message - wait for it to complete
    console.log('[RESTART] Generating custom group intro...');
    const customIntro = await generateGroupSessionIntro(sessionId);

    if (customIntro) {
      console.log('[RESTART] Custom intro generated successfully, length:', customIntro.length);
      // Save the new intro message
      const { data: savedIntro, error: introError } = await supabase
        .from('session_messages')
        .insert({
          session_id: sessionId,
          sender_type: 'ai',
          content: customIntro
        })
        .select()
        .single();

      if (introError) {
        console.error('[RESTART] Error saving custom intro:', introError);
        // Fallback to default if save fails
        const { error: defaultIntroError } = await supabase
          .from('session_messages')
          .insert({
            session_id: sessionId,
            sender_type: 'ai',
            content: 'Welcome back! How are you feeling today? What would you like to work on?'
          });

        if (defaultIntroError) {
          console.error('[RESTART] Error saving default intro:', defaultIntroError);
          return NextResponse.json({ error: 'Failed to save intro message' }, { status: 500 });
        }
      } else {
        console.log('[RESTART] Custom intro saved successfully:', savedIntro?.message_id);
      }
    } else {
      console.warn('[RESTART] Custom intro generation failed or returned null, using default');
      // Fallback to default intro if generation fails
      const { error: defaultIntroError } = await supabase
        .from('session_messages')
        .insert({
          session_id: sessionId,
          sender_type: 'ai',
          content: 'Welcome back! How are you feeling today? What would you like to work on?'
        });

      if (defaultIntroError) {
        console.error('[RESTART] Error saving default intro:', defaultIntroError);
        return NextResponse.json({ error: 'Failed to save intro message' }, { status: 500 });
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'Session restarted successfully'
    });

  } catch (error: any) {
    console.error('Error restarting session:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to restart session' 
    }, { status: 500 });
  }
}

export const POST = withAPISecurity(handleRestartRequest, SecurityConfigs.AI_CHAT);
