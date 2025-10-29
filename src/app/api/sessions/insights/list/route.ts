import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withAPISecurity, SecurityConfigs, SecurityContext } from '@/middleware/api-security'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function handleListInsights(request: NextRequest, context: SecurityContext): Promise<NextResponse> {
  try {
    if (!context.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const sessionId = request.nextUrl.searchParams.get('sessionId')
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    const { data: session, error: sessionError } = await supabase
      .from('therapy_sessions')
      .select('session_id, user_id')
      .eq('session_id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.user_id !== context.user.id) {
      return NextResponse.json({ error: 'Access denied to this session' }, { status: 403 })
    }

    const { data: insights, error: insightsError } = await supabase
      .from('session_insights')
      .select('id, session_id, insight_text, insight_type, created_at, created_by')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })

    if (insightsError) {
      return NextResponse.json({ error: 'Failed to load insights' }, { status: 500 })
    }

    return NextResponse.json({ success: true, insights: insights || [] })
  } catch (error) {
    console.error('List insights error:', error)
    return NextResponse.json({ error: 'Failed to load insights' }, { status: 500 })
  }
}

export const GET = withAPISecurity(handleListInsights, SecurityConfigs.GENERAL_API)

