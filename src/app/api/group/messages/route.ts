import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { withAPISecurity } from '@/middleware/api-security';
import { generateGroupSessionIntro } from '@/lib/ai/group-intro-generator';

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

    // Check if this is a group session FIRST (before fetching messages)
    const { data: sessionData } = await serviceClient
      .from('therapy_sessions')
      .select('is_group, session_type, group_category')
      .eq('session_id', sessionId)
      .maybeSingle();

    const isGroupSession = sessionData?.is_group || sessionData?.session_type === 'group';

    const { data: messages, error } = await serviceClient
      .from('session_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }

    // Check if the first AI message is generic and replace it for group sessions
    const firstAIMessage = messages?.find(msg => msg.sender_type === 'ai');
    
    // Normalize text for comparison (remove extra whitespace)
    const normalizeText = (text: string) => text.trim().replace(/\s+/g, ' ');

    if (isGroupSession && firstAIMessage) {
      const firstAIContent = normalizeText(firstAIMessage.content);
      
      // Check for generic intro patterns - be very flexible
      const isGenericIntro = 
        firstAIContent.includes('Welcome back! How are you feeling today') ||
        firstAIContent.includes('Welcome! I\'m your wellness coach') ||
        (firstAIContent.includes('Welcome back') && firstAIContent.includes('What would you like to work on')) ||
        firstAIContent === normalizeText('Welcome back! How are you feeling today? What would you like to work on?') ||
        firstAIContent === normalizeText('Welcome! I\'m your wellness coach. Let\'s start with your goals:\n\nWhat are your main wellness goals? What would you like to work on?');

      if (isGenericIntro) {
        try {
          console.log('[MESSAGES API] Detected generic intro for group session, generating custom intro...');
          console.log('[MESSAGES API] First AI message content:', firstAIContent.substring(0, 100));
          
          const customIntro = await generateGroupSessionIntro(sessionId);
          
          if (customIntro && customIntro.trim()) {
            const normalizedCustom = normalizeText(customIntro);
            const normalizedExisting = normalizeText(firstAIMessage.content);
            
            if (normalizedCustom !== normalizedExisting) {
              console.log('[MESSAGES API] Generated custom intro, updating message...');
              // Update the generic intro with the custom one
              const { error: updateError } = await serviceClient
                .from('session_messages')
                .update({ content: customIntro })
                .eq('message_id', firstAIMessage.message_id);

              if (!updateError) {
                console.log('[MESSAGES API] Successfully replaced generic intro with custom group intro');
                // Update the message in our local array so it's returned correctly
                firstAIMessage.content = customIntro;
                // Refetch messages to ensure we have the latest version
                const { data: updatedMessages } = await serviceClient
                  .from('session_messages')
                  .select('*')
                  .eq('session_id', sessionId)
                  .order('timestamp', { ascending: true });
                
                if (updatedMessages) {
                  // Replace the messages array with updated one
                  messages.length = 0;
                  messages.push(...updatedMessages);
                }
              } else {
                console.error('[MESSAGES API] Error updating intro message:', updateError);
              }
            } else {
              console.log('[MESSAGES API] Custom intro same as existing, skipping update');
            }
          } else {
            console.log('[MESSAGES API] Custom intro generation returned null or empty');
          }
        } catch (error) {
          console.error('[MESSAGES API] Error generating custom intro:', error);
          // Continue with existing messages if generation fails
        }
      } else {
        console.log('[MESSAGES API] First AI message is not generic, skipping replacement');
      }
    }

    // Format messages for the frontend
    const formattedMessages = messages?.map(msg => ({
      id: msg.message_id || msg.id,
      session_id: msg.session_id,
      sender: msg.sender_type === 'user' ? 'user' : 'ai',
      content: msg.content,
      timestamp: new Date(msg.timestamp),
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
