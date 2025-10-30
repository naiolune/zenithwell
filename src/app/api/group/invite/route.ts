import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withAPISecurity } from '@/middleware/api-security';
import { GROUP_SESSION_CONFIG, getInviteExpirationDate } from '@/lib/group-session-config';

async function handleCreateInvite(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId, maxParticipants } = await request.json();
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Verify user is the session owner (first participant)
    const { data: sessionOwner } = await supabase
      .from('session_participants')
      .select('user_id, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (!sessionOwner || sessionOwner.user_id !== user.id) {
      return NextResponse.json({ error: 'Only session owner can create invites' }, { status: 403 });
    }

    // Check if there's already an active invite
    const { data: existingInvite } = await supabase
      .from('session_invites')
      .select('id, invite_code, expires_at')
      .eq('session_id', sessionId)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (existingInvite) {
      return NextResponse.json({
        invite_code: existingInvite.invite_code,
        expires_at: existingInvite.expires_at,
        message: 'Active invite already exists'
      });
    }

    // Generate invite code using database function
    const { data: inviteCodeData, error: codeError } = await supabase
      .rpc('generate_invite_code');

    if (codeError || !inviteCodeData) {
      console.error('Error generating invite code:', codeError);
      return NextResponse.json({ error: 'Failed to generate invite code' }, { status: 500 });
    }

    const inviteCode = inviteCodeData;
    const expiresAt = getInviteExpirationDate();

    // Create invite record
    const { data: invite, error } = await supabase
      .from('session_invites')
      .insert({
        session_id: sessionId,
        invite_code: inviteCode,
        created_by: user.id,
        expires_at: expiresAt.toISOString(),
        max_participants: maxParticipants || GROUP_SESSION_CONFIG.MAX_PARTICIPANTS_PER_SESSION,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating invite:', error);
      return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
    }

    return NextResponse.json({
      invite_code: invite.invite_code,
      expires_at: invite.expires_at,
      max_participants: invite.max_participants,
      invite_url: `${process.env.NEXT_PUBLIC_SITE_URL}/join/${invite.invite_code}`
    });
  } catch (error) {
    console.error('Create invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleValidateInvite(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const inviteCode = searchParams.get('code');
    
    if (!inviteCode) {
      return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });
    }

    // Get invite details
    const { data: invite, error } = await supabase
      .from('session_invites')
      .select(`
        id,
        session_id,
        expires_at,
        max_participants,
        is_active,
        therapy_sessions!inner(
          session_id,
          title,
          group_category,
          session_status
        )
      `)
      .eq('invite_code', inviteCode)
      .single();

    if (error || !invite) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
    }

    // Check if invite is expired
    const now = new Date();
    const expiresAt = new Date(invite.expires_at);
    if (now > expiresAt) {
      return NextResponse.json({ error: 'Invite has expired' }, { status: 410 });
    }

    // Check if invite is active
    if (!invite.is_active) {
      return NextResponse.json({ error: 'Invite has been revoked' }, { status: 410 });
    }

    // Get current participant count
    const { data: participants, error: participantError } = await supabase
      .from('session_participants')
      .select('user_id')
      .eq('session_id', invite.session_id);

    if (participantError) {
      console.error('Error fetching participants:', participantError);
      return NextResponse.json({ error: 'Failed to validate invite' }, { status: 500 });
    }

    const currentParticipants = participants?.length || 0;
    const isFull = currentParticipants >= invite.max_participants;

    const therapySession = Array.isArray(invite.therapy_sessions) ? invite.therapy_sessions[0] : invite.therapy_sessions;
    
    return NextResponse.json({
      session_id: invite.session_id,
      title: therapySession?.title,
      group_category: therapySession?.group_category,
      session_status: therapySession?.session_status,
      expires_at: invite.expires_at,
      max_participants: invite.max_participants,
      current_participants: currentParticipants,
      is_full: isFull,
      can_join: !isFull && therapySession?.session_status === 'waiting'
    });
  } catch (error) {
    console.error('Validate invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleRevokeInvite(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await request.json();
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Verify user is the session owner
    const { data: sessionOwner } = await supabase
      .from('session_participants')
      .select('user_id, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (!sessionOwner || sessionOwner.user_id !== user.id) {
      return NextResponse.json({ error: 'Only session owner can revoke invites' }, { status: 403 });
    }

    // Revoke all active invites for this session
    const { error } = await supabase
      .from('session_invites')
      .update({ is_active: false })
      .eq('session_id', sessionId)
      .eq('is_active', true);

    if (error) {
      console.error('Error revoking invite:', error);
      return NextResponse.json({ error: 'Failed to revoke invite' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Revoke invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withAPISecurity(handleCreateInvite, {
  requireAuth: true,
  rateLimitType: 'general_api',
  requireCSRF: false,
});

export const GET = withAPISecurity(handleValidateInvite, {
  requireAuth: false, // Allow unauthenticated users to validate invites
  rateLimitType: 'general_api',
  requireCSRF: false,
});

export const DELETE = withAPISecurity(handleRevokeInvite, {
  requireAuth: true,
  rateLimitType: 'general_api',
  requireCSRF: false,
});
