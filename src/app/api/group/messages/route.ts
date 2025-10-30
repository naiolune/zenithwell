import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { withAPISecurity } from '@/middleware/api-security';

async function handleGetMessages(request: NextRequest) {
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
        return NextResponse.json({ error: 'Not authorized to view messages' }, { status: 403 });
      }
    }

    // Use service role client to bypass RLS and fetch messages
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: messages, error } = await serviceClient
      .from('session_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }

    // Format messages for the frontend
    const formattedMessages = messages?.map(msg => ({
      id: msg.id,
      session_id: msg.session_id,
      sender: msg.sender_type === 'user' ? 'user' : 'ai',
      content: msg.content,
      timestamp: new Date(msg.created_at),
      status: 'sent' as const
    })) || [];

    return NextResponse.json({ messages: formattedMessages });
  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAPISecurity(handleGetMessages, {
  requireAuth: true,
  rateLimitType: 'general_api',
  requireCSRF: false,
});
