import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withAPISecurity } from '@/middleware/api-security';
import { GROUP_SESSION_CONFIG } from '@/lib/group-session-config';

async function handleHeartbeat(request: NextRequest) {
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

    // Verify user is a participant in this session
    const { data: participant } = await supabase
      .from('session_participants')
      .select('user_id')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (!participant) {
      return NextResponse.json({ error: 'Not a participant in this session' }, { status: 403 });
    }

    // Update or insert presence record
    const { error } = await supabase
      .from('participant_presence')
      .upsert({
        session_id: sessionId,
        user_id: user.id,
        last_heartbeat: new Date().toISOString(),
        is_online: true
      }, {
        onConflict: 'session_id,user_id'
      });

    if (error) {
      console.error('Error updating presence:', error);
      return NextResponse.json({ error: 'Failed to update presence' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Heartbeat error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleGetPresence(request: NextRequest) {
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

    // Verify user is a participant in this session
    const { data: participant } = await supabase
      .from('session_participants')
      .select('user_id')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (!participant) {
      return NextResponse.json({ error: 'Not a participant in this session' }, { status: 403 });
    }

    // Get all participants with their presence status
    const { data: participants, error } = await supabase
      .from('session_participants')
      .select(`
        user_id,
        is_ready,
        users!inner(
          id,
          email,
          full_name
        ),
        participant_presence!left(
          last_heartbeat,
          is_online
        )
      `)
      .eq('session_id', sessionId);

    if (error) {
      console.error('Error fetching participants:', error);
      return NextResponse.json({ error: 'Failed to fetch participants' }, { status: 500 });
    }

    // Process presence data
    const participantsWithPresence = participants?.map(p => {
      const lastHeartbeat = p.participant_presence?.[0]?.last_heartbeat 
        ? new Date(p.participant_presence[0].last_heartbeat)
        : new Date(0);
      
      const now = new Date();
      const diffMs = now.getTime() - lastHeartbeat.getTime();
      const isOnline = diffMs <= GROUP_SESSION_CONFIG.ONLINE_THRESHOLD_SECONDS * 1000;
      const isAway = diffMs > GROUP_SESSION_CONFIG.ONLINE_THRESHOLD_SECONDS * 1000 && 
                    diffMs <= GROUP_SESSION_CONFIG.AWAY_THRESHOLD_SECONDS * 1000;

      return {
        user_id: p.user_id,
        email: p.users.email,
        full_name: p.users.full_name,
        is_ready: p.is_ready,
        is_online: isOnline,
        is_away: isAway,
        last_heartbeat: lastHeartbeat.toISOString(),
        presence_status: isOnline ? 'online' : isAway ? 'away' : 'offline'
      };
    }) || [];

    // Check if all participants are online
    const allOnline = participantsWithPresence.every(p => p.is_online);
    const totalParticipants = participantsWithPresence.length;
    const onlineParticipants = participantsWithPresence.filter(p => p.is_online).length;

    return NextResponse.json({
      participants: participantsWithPresence,
      all_online: allOnline,
      total_participants: totalParticipants,
      online_participants: onlineParticipants
    });
  } catch (error) {
    console.error('Get presence error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withAPISecurity(handleHeartbeat, {
  requireAuth: true,
  rateLimitType: 'general_api'
});

export const GET = withAPISecurity(handleGetPresence, {
  requireAuth: true,
  rateLimitType: 'general_api'
});
