import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { withAPISecurity } from '@/middleware/api-security';

async function handleGetParticipants(request: NextRequest) {
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

    // Check if user is a participant in this session
    const { data: participant } = await supabase
      .from('session_participants')
      .select('user_id')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .maybeSingle();

    // Check if user is session owner
    const { data: session } = await supabase
      .from('therapy_sessions')
      .select('user_id')
      .eq('session_id', sessionId)
      .maybeSingle();

    // If not a participant and not owner, check for valid invite
    if (!participant && session?.user_id !== user.id) {
      const { data: invite } = await supabase
        .from('session_invites')
        .select('id, expires_at, is_active')
        .eq('session_id', sessionId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (!invite) {
        return NextResponse.json({ error: 'Not authorized to view participants' }, { status: 403 });
      }
    }

    // Use service role client to bypass RLS and fetch participants
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: participants, error } = await serviceClient
      .from('session_participants')
      .select('user_id, is_ready, role')
      .eq('session_id', sessionId);

    if (error) {
      console.error('Error fetching participants:', error);
      return NextResponse.json({ error: 'Failed to fetch participants' }, { status: 500 });
    }

    if (!participants || participants.length === 0) {
      return NextResponse.json({ participants: [] });
    }

    // Get user data for all participants
    const userIds = participants.map(p => p.user_id);
    
    // Get basic user info from public.users table
    const { data: userData, error: userError } = await serviceClient
      .from('users')
      .select('user_id, email')
      .in('user_id', userIds);

    if (userError) {
      console.error('Error fetching user data:', userError);
    }

    // Get user metadata (including full_name) from auth.users via admin API
    // We'll use the service role client to access auth admin functions
    const userMap = new Map();
    
    // First, add basic info from public.users
    userData?.forEach(u => {
      userMap.set(u.user_id, { email: u.email, full_name: null });
    });

    // Try to get full_name from auth.users metadata for each user
    // Note: We'll use the admin API to get user metadata
    for (const userId of userIds) {
      try {
        const { data: authUser, error: authError } = await serviceClient.auth.admin.getUserById(userId);
        if (!authError && authUser?.user) {
          const existingUserData = userMap.get(userId) || { email: authUser.user.email || '' };
          const meta = authUser.user.user_metadata || {};
          
          // Prefer first_name + last_name, fallback to full_name, then name, then display_name
          let fullName = null;
          if (meta.first_name || meta.last_name) {
            fullName = `${meta.first_name || ''} ${meta.last_name || ''}`.trim();
          } else {
            fullName = meta.full_name || meta.name || meta.display_name || null;
          }
          
          userMap.set(userId, {
            ...existingUserData,
            email: existingUserData.email || authUser.user.email || '',
            full_name: fullName
          });
        }
      } catch (error) {
        // If we can't get auth user, just use what we have from public.users
        console.log(`Could not fetch auth user data for ${userId}:`, error);
      }
    }

    // Get presence data if available (using participant_presence table)
    const { data: presenceData } = await serviceClient
      .from('participant_presence')
      .select('user_id, is_online, last_heartbeat')
      .eq('session_id', sessionId)
      .in('user_id', userIds);

    // Format participants for the frontend
    const formattedParticipants = participants.map(p => {
      const userInfo = userMap.get(p.user_id);
      const presence = presenceData?.find(pr => pr.user_id === p.user_id);
      const lastHeartbeat = presence?.last_heartbeat ? new Date(presence.last_heartbeat) : null;
      const now = new Date();
      const diffMs = lastHeartbeat ? now.getTime() - lastHeartbeat.getTime() : Infinity;
      const isOnline = presence?.is_online || false;
      const isAway = !isOnline && diffMs < 60000; // Away if offline but heartbeat was recent
      
      // Extract first name from full_name if available, otherwise use email or fallback
      let displayName = 'Member';
      if (p.user_id === user.id) {
        displayName = 'You';
      } else if (userInfo) {
        if (userInfo.full_name && userInfo.full_name.trim()) {
          // Extract first name (part before space) or use full name if no space
          const firstName = userInfo.full_name.trim().split(' ')[0];
          displayName = firstName || userInfo.full_name.trim();
        } else if (userInfo.email) {
          // Use email username (part before @) as fallback
          displayName = userInfo.email.split('@')[0];
        }
      }
      
      // Log for debugging
      if (!userInfo || (!userInfo.full_name && !userInfo.email)) {
        console.log(`Missing user info for participant ${p.user_id}`);
      }
      
      return {
        user_id: p.user_id,
        email: userInfo?.email || '',
        full_name: displayName,
        is_ready: p.is_ready || false,
        is_online: isOnline,
        is_away: isAway,
        last_heartbeat: presence?.last_heartbeat || '',
        presence_status: isOnline ? 'online' : isAway ? 'away' : 'offline'
      };
    });

    return NextResponse.json({ participants: formattedParticipants });
  } catch (error) {
    console.error('Get participants error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAPISecurity(handleGetParticipants, {
  requireAuth: true,
  rateLimitType: 'general_api',
  requireCSRF: false,
});
