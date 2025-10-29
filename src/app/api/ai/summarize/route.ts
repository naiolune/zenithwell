import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ServerAIService } from '@/lib/ai/server-ai-service';
import { withAPISecurity, SecurityConfigs, SecurityContext } from '@/middleware/api-security';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handleSummarizeRequest(request: NextRequest, context: SecurityContext): Promise<NextResponse> {
  try {
    const { sessionId } = await request.json();

    if (!context.user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Verify user owns this session
    const { data: session, error: sessionError } = await supabase
      .from('therapy_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', context.user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found or access denied' }, { status: 404 });
    }

    // Generate summary using AI
    const summaryResponse = await ServerAIService.summarizeSession(sessionId);

    if (!summaryResponse.success) {
      return NextResponse.json({ 
        error: summaryResponse.error || 'Failed to generate summary' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      summary: summaryResponse.content
    });

  } catch (error: any) {
    console.error('Summarize API error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

// Export the secured handler
export const POST = withAPISecurity(handleSummarizeRequest, SecurityConfigs.GENERAL_API);
