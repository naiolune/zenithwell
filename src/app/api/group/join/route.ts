import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { withAPISecurity } from '@/middleware/api-security';

async function handleJoinSession(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { inviteCode, sessionId } = body;
    
    if (!inviteCode && !sessionId) {
      return NextResponse.json({ error: 'Invite code or session ID is required' }, { status: 400 });
    }

    // Use service role client to bypass RLS for all database operations
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // If invite code provided, validate it first
    let validatedSessionId = sessionId;
    if (inviteCode) {
      const { data: invite, error: inviteError } = await serviceClient
        .from('session_invites')
        .select('session_id, expires_at, max_participants, is_active')
        .eq('invite_code', inviteCode.toUpperCase())
        .eq('is_active', true)
        .single();

      if (inviteError || !invite) {
        return NextResponse.json({ error: 'Invalid or expired invite code' }, { status: 404 });
      }

      // Check if invite is expired
      const now = new Date();
      const expiresAt = new Date(invite.expires_at);
      if (now > expiresAt) {
        return NextResponse.json({ error: 'Invite has expired' }, { status: 410 });
      }

      validatedSessionId = invite.session_id;

      // Check if session is full
      const { data: participants, error: participantError } = await serviceClient
        .from('session_participants')
        .select('user_id')
        .eq('session_id', validatedSessionId);

      if (participantError) {
        console.error('Error fetching participants:', participantError);
        return NextResponse.json({ error: 'Failed to validate session' }, { status: 500 });
      }

      const currentParticipants = participants?.length || 0;
      if (currentParticipants >= invite.max_participants) {
        return NextResponse.json({ error: 'Session is full' }, { status: 403 });
      }
    }

    if (!validatedSessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Check if user is already a participant (using service client to bypass RLS)
    const { data: existingParticipant } = await serviceClient
      .from('session_participants')
      .select('user_id')
      .eq('session_id', validatedSessionId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingParticipant) {
      return NextResponse.json({ 
        success: true, 
        message: 'Already a participant',
        session_id: validatedSessionId
      });
    }

    // Validate invite exists (if sessionId was provided directly, check for any valid invite)
    if (!inviteCode) {
      const { data: invite } = await serviceClient
        .from('session_invites')
        .select('id, expires_at, is_active')
        .eq('session_id', validatedSessionId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      // Also check if user is session owner
      const { data: session } = await serviceClient
        .from('therapy_sessions')
        .select('user_id')
        .eq('session_id', validatedSessionId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!invite && !session) {
        return NextResponse.json({ 
          error: 'No valid invite found or you are not the session owner' 
        }, { status: 403 });
      }
    }

    // Add user as participant using service client (bypasses RLS)
    const { data: participant, error: joinError } = await serviceClient
      .from('session_participants')
      .insert({
        session_id: validatedSessionId,
        user_id: user.id,
        role: 'participant',
        is_ready: false
      })
      .select()
      .single();

    if (joinError) {
      console.error('Error joining session:', joinError);
      return NextResponse.json({ 
        error: 'Failed to join session. Please ensure you have a valid invite.',
        details: joinError.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      session_id: validatedSessionId,
      participant
    });
  } catch (error) {
    console.error('Join session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withAPISecurity(handleJoinSession, {
  requireAuth: true,
  rateLimitType: 'general_api',
  requireCSRF: false,
});
