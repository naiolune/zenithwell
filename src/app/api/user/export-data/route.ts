import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAPISecurity, SecurityConfigs, SecurityContext } from '@/middleware/api-security';
import { SecureErrorHandler } from '@/lib/security/error-handler';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handleExportData(request: NextRequest, context: SecurityContext): Promise<NextResponse> {
  try {
    if (!context.user) {
      return SecureErrorHandler.handleAuthError('User not authenticated');
    }

    const userId = context.user.id;

    // Export all user data
    const exportData = {
      exportDate: new Date().toISOString(),
      userId: userId,
      userEmail: context.user.email,
      data: {
        // User profile
        profile: await supabase
          .from('users')
          .select('*')
          .eq('user_id', userId)
          .single()
          .then(res => res.data),

        // Therapy sessions
        therapySessions: await supabase
          .from('therapy_sessions')
          .select('*')
          .eq('user_id', userId)
          .then(res => res.data || []),

        // Session messages
        sessionMessages: await supabase
          .from('session_messages')
          .select('*')
          .in('session_id', 
            await supabase
              .from('therapy_sessions')
              .select('session_id')
              .eq('user_id', userId)
              .then(res => res.data?.map(s => s.session_id) || [])
          )
          .then(res => res.data || []),

        // Conversation memory
        conversationMemory: await supabase
          .from('conversation_memory')
          .select('*')
          .eq('user_id', userId)
          .then(res => res.data || []),

        // Session participants
        sessionParticipants: await supabase
          .from('session_participants')
          .select('*')
          .eq('user_id', userId)
          .then(res => res.data || []),

        // Subscriptions
        subscriptions: await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', userId)
          .then(res => res.data || [])
      }
    };

    // Create downloadable JSON file
    const jsonData = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const buffer = await blob.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="zenithwell-data-export-${new Date().toISOString().split('T')[0]}.json"`,
        'Content-Length': buffer.byteLength.toString(),
      },
    });

  } catch (error: any) {
    return SecureErrorHandler.handleAPIError(error, 'Data export');
  }
}

// Export the secured handler
export const GET = withAPISecurity(handleExportData, SecurityConfigs.GENERAL_API);