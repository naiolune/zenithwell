import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Test if session_type column exists
    const { data: sessions, error: sessionsError } = await supabase
      .from('therapy_sessions')
      .select('session_type')
      .limit(1);

    if (sessionsError) {
      return NextResponse.json({ 
        error: 'therapy_sessions table error',
        details: sessionsError.message,
        code: sessionsError.code
      }, { status: 500 });
    }

    // Test if user_goals table exists
    const { data: goals, error: goalsError } = await supabase
      .from('user_goals')
      .select('id')
      .limit(1);

    if (goalsError) {
      return NextResponse.json({ 
        error: 'user_goals table error',
        details: goalsError.message,
        code: goalsError.code
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      therapy_sessions: {
        has_session_type: 'session_type' in (sessions[0] || {}),
        sample: sessions[0] || null
      },
      user_goals: {
        exists: true,
        sample: goals[0] || null
      }
    });

  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Schema test failed',
      details: error.message 
    }, { status: 500 });
  }
}