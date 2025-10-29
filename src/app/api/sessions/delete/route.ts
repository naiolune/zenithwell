import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAPISecurity, SecurityConfigs, SecurityContext } from '@/middleware/api-security';
import { InputSanitizer } from '@/lib/security/input-sanitizer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handleSessionDelete(request: NextRequest, context: SecurityContext): Promise<NextResponse> {
  try {
    const { sessionId } = await request.json();

    if (!context.user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Validate session ID
    if (!InputSanitizer.validateSessionId(sessionId)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    // Verify user owns this session
    const { data: session, error: sessionError } = await supabase
      .from('therapy_sessions')
      .select('session_id, user_id, session_type')
      .eq('session_id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.user_id !== context.user.id) {
      return NextResponse.json({ error: 'Access denied to this session' }, { status: 403 });
    }

    // Special validation for introduction sessions
    if (session.session_type === 'introduction') {
      // Check if user has other sessions
      const { data: otherSessions, error: otherSessionsError } = await supabase
        .from('therapy_sessions')
        .select('session_id')
        .eq('user_id', context.user.id)
        .neq('session_id', sessionId);

      if (otherSessionsError) {
        return NextResponse.json({ error: 'Failed to validate session deletion' }, { status: 500 });
      }

      if (otherSessions && otherSessions.length > 0) {
        return NextResponse.json({ 
          error: 'Introduction sessions cannot be deleted if you have other sessions. Please delete your other sessions first.',
          code: 'INTRODUCTION_DELETE_RESTRICTED'
        }, { status: 400 });
      }
    }

    // Delete the session (cascade will handle related records)
    const { error: deleteError } = await supabase
      .from('therapy_sessions')
      .delete()
      .eq('session_id', sessionId);

    if (deleteError) {
      console.error('Error deleting session:', deleteError);
      return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Session deleted successfully',
    });

  } catch (error: any) {
    console.error('Session delete error:', error);
    return NextResponse.json({ 
      error: 'Failed to delete session' 
    }, { status: 500 });
  }
}

// Export the secured handler
export const DELETE = withAPISecurity(handleSessionDelete, SecurityConfigs.GENERAL_API);