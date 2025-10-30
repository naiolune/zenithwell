import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { withAPISecurity, SecurityContext } from '@/middleware/api-security';
import { GROUP_SESSION_CONFIG, getInviteExpirationDate } from '@/lib/group-session-config';

async function handleCreateInvite(request: NextRequest, context: SecurityContext) {
  try {
    console.log('[INVITE] Starting invite creation handler');
    
    // Use authenticated user from security context (already validated by middleware)
    if (!context.user) {
      console.error('[INVITE] No user in context');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('[INVITE] User authenticated:', { userId: context.user.id, email: context.user.email });
    
    const supabase = await createClient();
    
    // Verify Supabase client is authenticated (required for RLS policies)
    const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !supabaseUser || supabaseUser.id !== context.user.id) {
      console.error('[INVITE] Supabase auth mismatch:', { 
        authError: authError?.message, 
        supabaseUserId: supabaseUser?.id, 
        contextUserId: context.user.id 
      });
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }
    
    console.log('[INVITE] Supabase client authenticated successfully');
    
    const { sessionId, maxParticipants } = await request.json();
    console.log('[INVITE] Request body:', { sessionId, maxParticipants });
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Verify user is the session owner (first participant)
    console.log('[INVITE] Checking session ownership for session:', sessionId);
    const { data: sessionOwner, error: ownerError } = await supabase
      .from('session_participants')
      .select('user_id, joined_at')
      .eq('session_id', sessionId)
      .order('joined_at', { ascending: true })
      .limit(1)
      .single();

    if (ownerError) {
      console.error('[INVITE] Error checking session ownership:', {
        error: ownerError.message,
        code: ownerError.code,
        details: ownerError.details,
        hint: ownerError.hint,
        sessionId
      });
      return NextResponse.json({ error: 'Failed to verify session ownership' }, { status: 500 });
    }

    console.log('[INVITE] Session owner check result:', {
      found: !!sessionOwner,
      ownerUserId: sessionOwner?.user_id,
      contextUserId: context.user.id,
      match: sessionOwner?.user_id === context.user.id
    });

    if (!sessionOwner || sessionOwner.user_id !== context.user.id) {
      console.error('[INVITE] User is not session owner', {
        sessionId,
        contextUserId: context.user.id,
        ownerUserId: sessionOwner?.user_id
      });
      return NextResponse.json({ error: 'Only session owner can create invites' }, { status: 403 });
    }
    
    console.log('[INVITE] User is confirmed as session owner');

    // Check if there's already an active invite
    const { data: existingInvite } = await supabase
      .from('session_invites')
      .select('id, invite_code, expires_at, max_participants')
      .eq('session_id', sessionId)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (existingInvite) {
      // Hardcoded site URL
      const inviteUrl = `https://zenithwell.online/join/${existingInvite.invite_code}`;
      
      return NextResponse.json({
        invite_code: existingInvite.invite_code,
        expires_at: existingInvite.expires_at,
        max_participants: existingInvite.max_participants,
        invite_url: inviteUrl,
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
        created_by: context.user.id,
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

    // Hardcoded site URL
    const inviteUrl = `https://zenithwell.online/join/${invite.invite_code}`;
    
    return NextResponse.json({
      invite_code: invite.invite_code,
      expires_at: invite.expires_at,
      max_participants: invite.max_participants,
      invite_url: inviteUrl
    });
  } catch (error) {
    console.error('[INVITE] Create invite error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleValidateInvite(request: NextRequest, context: SecurityContext) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const inviteCode = searchParams.get('code');
    
    if (!inviteCode) {
      return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });
    }

    // Get invite details - use left join in case therapy_sessions data isn't available
    // First get the invite
    const { data: invite, error: inviteError } = await supabase
      .from('session_invites')
      .select(`
        id,
        session_id,
        invite_code,
        expires_at,
        max_participants,
        is_active
      `)
      .eq('invite_code', inviteCode.toUpperCase())
      .eq('is_active', true)
      .single();

    if (inviteError || !invite) {
      console.error('[INVITE] Validate invite error:', {
        error: inviteError?.message,
        code: inviteError?.code,
        details: inviteError?.details,
        inviteCode: inviteCode
      });
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
    }

    // Then get the therapy session details separately
    // Use service role client to bypass RLS for unauthenticated invite validation
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: therapySession, error: sessionError } = await serviceClient
      .from('therapy_sessions')
      .select('session_id, title, group_category, session_status')
      .eq('session_id', invite.session_id)
      .single();

    if (sessionError) {
      console.error('[INVITE] Error fetching therapy session:', {
        error: sessionError.message,
        code: sessionError.code,
        sessionId: invite.session_id
      });
    }

    if (!therapySession) {
      console.warn('[INVITE] Therapy session not found for session_id:', invite.session_id);
    } else {
      console.log('[INVITE] Therapy session found:', {
        session_id: therapySession.session_id,
        title: therapySession.title,
        group_category: therapySession.group_category,
        session_status: therapySession.session_status
      });
    }

    // Check if invite is expired
    const now = new Date();
    const expiresAt = new Date(invite.expires_at);
    if (now > expiresAt) {
      return NextResponse.json({ error: 'Invite has expired' }, { status: 410 });
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
    
    // Use the actual group_category from the session, or default to 'general' only if session doesn't exist
    const groupCategory = therapySession?.group_category || 'general';
    
    console.log('[INVITE] Returning invite data:', {
      session_id: invite.session_id,
      group_category: groupCategory,
      hasTherapySession: !!therapySession
    });
    
    return NextResponse.json({
      session_id: invite.session_id,
      title: therapySession?.title || 'Group Wellness Session',
      group_category: groupCategory,
      session_status: therapySession?.session_status || 'waiting',
      expires_at: invite.expires_at,
      max_participants: invite.max_participants,
      current_participants: currentParticipants,
      is_full: isFull,
      can_join: !isFull && (therapySession?.session_status === 'waiting' || !therapySession)
    });
  } catch (error) {
    console.error('Validate invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleRevokeInvite(request: NextRequest, context: SecurityContext) {
  try {
    // Use authenticated user from security context (already validated by middleware)
    if (!context.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const supabase = await createClient();
    
    // Verify Supabase client is authenticated (required for RLS policies)
    const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !supabaseUser || supabaseUser.id !== context.user.id) {
      console.error('Supabase auth mismatch:', { authError, supabaseUserId: supabaseUser?.id, contextUserId: context.user.id });
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }
    
    const { sessionId } = await request.json();
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Verify user is the session owner
    const { data: sessionOwner, error: ownerError } = await supabase
      .from('session_participants')
      .select('user_id, joined_at')
      .eq('session_id', sessionId)
      .order('joined_at', { ascending: true })
      .limit(1)
      .single();

    if (ownerError) {
      console.error('Error checking session ownership:', ownerError);
      return NextResponse.json({ error: 'Failed to verify session ownership' }, { status: 500 });
    }

    if (!sessionOwner || sessionOwner.user_id !== context.user.id) {
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
