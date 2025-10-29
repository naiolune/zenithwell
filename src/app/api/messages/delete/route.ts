import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAPISecurity, SecurityConfigs, SecurityContext } from '@/middleware/api-security';
import { InputSanitizer } from '@/lib/security/input-sanitizer';
import { SecureErrorHandler } from '@/lib/security/error-handler';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handleDeleteMessage(request: NextRequest, context: SecurityContext) {
  try {
    const { messageId, sessionId } = await request.json();

    // Validate input
    if (!messageId || !sessionId) {
      return NextResponse.json({ error: 'Message ID and Session ID are required' }, { status: 400 });
    }

    // Validate and sanitize inputs
    if (!InputSanitizer.validateUUID(messageId) || !InputSanitizer.validateUUID(sessionId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }
    
    const sanitizedMessageId = InputSanitizer.sanitizeText(messageId);
    const sanitizedSessionId = InputSanitizer.sanitizeText(sessionId);

    // Verify user owns the message
    const { data: message, error: messageError } = await supabase
      .from('session_messages')
      .select('message_id, session_id, sender_type, content')
      .eq('message_id', sanitizedMessageId)
      .eq('session_id', sanitizedSessionId)
      .single();

    if (messageError || !message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Only allow users to delete their own messages
    if (message.sender_type !== 'user') {
      return NextResponse.json({ error: 'Can only delete your own messages' }, { status: 403 });
    }

    // Verify user has access to this session
    const { data: session, error: sessionError } = await supabase
      .from('therapy_sessions')
      .select('user_id, is_group')
      .eq('session_id', sanitizedSessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Ensure user is authenticated
    if (!context.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // For individual sessions, check if user owns the session
    if (!session.is_group && session.user_id !== context.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // For group sessions, check if user is a participant
    if (session.is_group) {
      const { data: participant, error: participantError } = await supabase
        .from('session_participants')
        .select('user_id')
        .eq('session_id', sanitizedSessionId)
        .eq('user_id', context.user.id)
        .single();

      if (participantError || !participant) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Delete the message
    const { error: deleteError } = await supabase
      .from('session_messages')
      .delete()
      .eq('message_id', sanitizedMessageId);

    if (deleteError) {
      console.error('Error deleting message:', deleteError);
      return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Message deleted successfully' 
    });

  } catch (error: any) {
    return SecureErrorHandler.handleAPIError(error, 'Delete Message API');
  }
}

// Export the secured handler
export const DELETE = withAPISecurity(handleDeleteMessage, SecurityConfigs.GENERAL_API);
