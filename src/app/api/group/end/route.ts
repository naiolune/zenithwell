import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { withAPISecurity } from '@/middleware/api-security';

async function handleEndSession(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Use service role client to bypass RLS
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify session exists and user is the owner
    const { data: session, error: sessionError } = await serviceClient
      .from('therapy_sessions')
      .select('user_id, session_type, is_group, is_locked')
      .eq('session_id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Only owners can end sessions
    if (session.user_id !== user.id) {
      return NextResponse.json({ error: 'Only session owners can end sessions' }, { status: 403 });
    }

    // Only group sessions can be ended this way
    if (!session.is_group && session.session_type !== 'group') {
      return NextResponse.json({ error: 'This endpoint is only for group sessions' }, { status: 400 });
    }

    // Check if already locked
    if (session.is_locked) {
      return NextResponse.json({ error: 'Session is already locked' }, { status: 400 });
    }

    // Lock the session
    const { error: lockError } = await serviceClient
      .from('therapy_sessions')
      .update({
        is_locked: true,
        locked_at: new Date().toISOString(),
        locked_by: user.id,
        lock_reason: 'Session ended by owner'
      })
      .eq('session_id', sessionId);

    if (lockError) {
      console.error('Error locking session:', lockError);
      return NextResponse.json({ error: 'Failed to end session' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Session ended successfully' 
    });
  } catch (error) {
    console.error('End session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withAPISecurity(handleEndSession, {
  requireAuth: true,
  rateLimitType: 'general_api',
  requireCSRF: false,
});
