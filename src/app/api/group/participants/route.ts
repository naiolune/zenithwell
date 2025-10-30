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

    // Get presence data if available (using participant_presence table)
    const { data: presenceData } = await serviceClient
      .from('participant_presence')
      .select('user_id, is_online, last_heartbeat')
      .eq('session_id', sessionId)
      .in('user_id', participants?.map(p => p.user_id) || []);

    // Format participants for the frontend
    const formattedParticipants = participants?.map(p => {
      const presence = presenceData?.find(pr => pr.user_id === p.user_id);
      const lastHeartbeat = presence?.last_heartbeat ? new Date(presence.last_heartbeat) : null;
      const now = new Date();
      const diffMs = lastHeartbeat ? now.getTime() - lastHeartbeat.getTime() : Infinity;
      const isOnline = presence?.is_online || false;
      const isAway = !isOnline && diffMs < 60000; // Away if offline but heartbeat was recent
      
      return {
        user_id: p.user_id,
        email: '', // Will be populated by frontend if needed
        full_name: p.user_id === user.id ? 'You' : 'Member',
        is_ready: p.is_ready || false,
        is_online: isOnline,
        is_away: isAway,
        last_heartbeat: presence?.last_heartbeat || '',
        presence_status: isOnline ? 'online' : isAway ? 'away' : 'offline'
      };
    }) || [];

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
