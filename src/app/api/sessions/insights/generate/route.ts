import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withAPISecurity, SecurityConfigs, SecurityContext } from '@/middleware/api-security'
import { ServerAIService, AIMessage } from '@/lib/ai/server-ai-service'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function handleGenerateInsight(request: NextRequest, context: SecurityContext): Promise<NextResponse> {
  try {
    if (!context.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { sessionId } = body

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

    const { data: existingInsights, error: insightsError } = await supabase
      .from('session_insights')
      .select('id, session_id, insight_text, insight_type, created_at, created_by')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })

    if (insightsError) {
      return NextResponse.json({ error: 'Failed to load existing insights' }, { status: 500 })
    }

    if (existingInsights && existingInsights.length > 0) {
      return NextResponse.json({ success: true, insight: existingInsights[0] })
    }

    const { data: messages, error: messageError } = await supabase
      .from('session_messages')
      .select('sender_type, content')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true })
      .limit(40)

    if (messageError || !messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages available to generate an insight' }, { status: 400 })
    }

    const aiMessages: AIMessage[] = messages.map(msg => ({
      role: msg.sender_type === 'ai' ? 'assistant' : 'user',
      content: msg.content,
    }))

    aiMessages.push({
      role: 'user',
      content:
        'Based on this conversation, craft a single, concise wellness insight (max 55 words). Focus on a supportive observation or practical takeaway. Respond with only the insight sentence.',
    })

    const response = await ServerAIService.generateResponse(aiMessages)
    if (!response.success || !response.content) {
      return NextResponse.json({ error: response.error || 'Failed to generate insight' }, { status: 500 })
    }

    const insightText = response.content.trim().slice(0, 300)

    const { data: insertedInsights, error: insertError } = await supabase
      .from('session_insights')
      .insert({
        session_id: sessionId,
        insight_text: insightText,
        insight_type: 'coach',
        created_by: 'ai',
      })
      .select('*')
      .single()

    if (insertError || !insertedInsights) {
      return NextResponse.json({ error: 'Failed to store generated insight' }, { status: 500 })
    }

    return NextResponse.json({ success: true, insight: insertedInsights })
  } catch (error) {
    console.error('Generate insight error:', error)
    return NextResponse.json({ error: 'Failed to generate insight' }, { status: 500 })
  }
}

export const POST = withAPISecurity(handleGenerateInsight, SecurityConfigs.GENERAL_API)

