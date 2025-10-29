import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAPISecurity, SecurityConfigs, SecurityContext } from '@/middleware/api-security';
import { InputSanitizer } from '@/lib/security/input-sanitizer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handleCreateSession(request: NextRequest, context: SecurityContext): Promise<NextResponse> {
  try {
    const { title, isGroup = false, sessionType = 'individual' } = await request.json();

    if (!context.user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Validate and sanitize inputs
    const sanitizedTitle = title ? InputSanitizer.sanitizeText(title) : 'New Individual Session';
    
    if (sanitizedTitle.length === 0) {
      return NextResponse.json({ error: 'Invalid session title' }, { status: 400 });
    }

    if (typeof isGroup !== 'boolean') {
      return NextResponse.json({ error: 'Invalid isGroup parameter' }, { status: 400 });
    }

    if (!['individual', 'group'].includes(sessionType)) {
      return NextResponse.json({ error: 'Invalid session type' }, { status: 400 });
    }

    // Get user subscription for validation
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('user_id', context.user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User data not found' }, { status: 404 });
    }

    // Server-side session count validation for free users
    if (userData.subscription_tier === 'free') {
      const { data: userSessions, error: sessionsError } = await supabase
        .from('therapy_sessions')
        .select('session_id')
        .eq('user_id', context.user.id);

      if (sessionsError) {
        return NextResponse.json({ error: 'Failed to validate session count' }, { status: 500 });
      }

      if (userSessions && userSessions.length >= 3) {
        return NextResponse.json({ 
          error: 'Session limit exceeded',
          sessionLimitExceeded: true,
          message: 'Free users are limited to 3 sessions. Upgrade to Pro for unlimited sessions.',
          currentSessions: userSessions.length,
          maxSessions: 3
        }, { status: 403 });
      }
    }

    // Create new session
    const { data: newSession, error: createError } = await supabase
      .from('therapy_sessions')
      .insert({
        user_id: context.user.id,
        title: sanitizedTitle,
        is_group: isGroup,
        session_type: sessionType,
        created_at: new Date().toISOString(),
        last_message_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating session:', createError);
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      session: newSession,
      subscriptionTier: userData.subscription_tier
    });

  } catch (error) {
    console.error('Error in create session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withAPISecurity(handleCreateSession, SecurityConfigs.GENERAL_API);