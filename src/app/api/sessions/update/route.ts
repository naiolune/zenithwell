import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAPISecurity, SecurityConfigs, SecurityContext } from '@/middleware/api-security';
import { InputSanitizer } from '@/lib/security/input-sanitizer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handleSessionUpdate(request: NextRequest, context: SecurityContext): Promise<NextResponse> {
  try {
    const { sessionId, title, summary } = await request.json();

    if (!context.user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Validate and sanitize inputs
    if (title && !InputSanitizer.validateSessionTitle(title)) {
      return NextResponse.json({ error: 'Invalid session title' }, { status: 400 });
    }

    if (summary && !InputSanitizer.validateSessionSummary(summary)) {
      return NextResponse.json({ error: 'Invalid session summary' }, { status: 400 });
    }

    // Verify user owns this session
    const { data: session, error: sessionError } = await supabase
      .from('therapy_sessions')
      .select('session_id, user_id')
      .eq('session_id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.user_id !== context.user.id) {
      return NextResponse.json({ error: 'Access denied to this session' }, { status: 403 });
    }

    // Prepare update data
    const updateData: any = {};
    if (title !== undefined) {
      updateData.title = InputSanitizer.sanitizeSessionTitle(title);
    }
    if (summary !== undefined) {
      updateData.session_summary = InputSanitizer.sanitizeSessionSummary(summary);
    }

    // Update the session
    const { data: updatedSession, error: updateError } = await supabase
      .from('therapy_sessions')
      .update(updateData)
      .eq('session_id', sessionId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating session:', updateError);
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      session: updatedSession,
    });

  } catch (error: any) {
    console.error('Session update error:', error);
    return NextResponse.json({ 
      error: 'Failed to update session' 
    }, { status: 500 });
  }
}

// Export the secured handler
export const PATCH = withAPISecurity(handleSessionUpdate, SecurityConfigs.GENERAL_API);