import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAPISecurity, SecurityConfigs, SecurityContext } from '@/middleware/api-security';
import { InputSanitizer } from '@/lib/security/input-sanitizer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handleIntroductionCompletion(request: NextRequest, context: SecurityContext): Promise<NextResponse> {
  try {
    const { sessionId } = await request.json();

    if (!context.user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Validate session ID
    if (!InputSanitizer.validateSessionId(sessionId)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    // Verify this is an introduction session owned by the user
    const { data: session, error: sessionError } = await supabase
      .from('therapy_sessions')
      .select('session_id, user_id, session_type')
      .eq('session_id', sessionId)
      .eq('user_id', context.user.id)
      .eq('session_type', 'introduction')
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Introduction session not found' }, { status: 404 });
    }

    // Get all messages from the introduction session
    const { data: messages, error: messagesError } = await supabase
      .from('session_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return NextResponse.json({ error: 'Failed to fetch session messages' }, { status: 500 });
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages found in introduction session' }, { status: 400 });
    }

    // Extract user responses (skip the first AI message)
    const userMessages = messages
      .filter(msg => msg.sender_type === 'user')
      .map(msg => msg.content)
      .join('\n\n');

    if (!userMessages.trim()) {
      return NextResponse.json({ error: 'No user responses found' }, { status: 400 });
    }

    // Use AI to extract and summarize goals
    const { data: aiConfig } = await supabase
      .from('ai_config')
      .select('*')
      .eq('is_active', true)
      .single();

    if (!aiConfig) {
      return NextResponse.json({ error: 'AI configuration not found' }, { status: 500 });
    }

    const goalExtractionPrompt = `Based on the user's responses to the introduction questions, extract and summarize their main goals and areas of focus. 

User's responses:
${userMessages}

Please provide:
1. A brief summary of their main wellness goals (2-3 sentences)
2. 3-5 specific, actionable goals extracted from their responses

Format your response as:
SUMMARY: [Brief summary of their main wellness goals and focus areas]

GOALS:
1. [First specific goal]
2. [Second specific goal]
3. [Third specific goal]
4. [Fourth specific goal]
5. [Fifth specific goal]

Make the goals specific, measurable, and relevant to their responses. Focus on wellness, personal growth, and mental health aspects.`;

    let aiResponse = '';
    
    if (aiConfig.provider === 'openai') {
      const OpenAI = require('openai').default;
      const openai = new OpenAI({ apiKey: aiConfig.api_key });
      
      const response = await openai.chat.completions.create({
        model: aiConfig.model,
        messages: [{ role: 'user', content: goalExtractionPrompt }],
        max_tokens: 500,
        temperature: 0.7,
      });
      
      aiResponse = response.choices[0]?.message?.content || '';
    } else if (aiConfig.provider === 'anthropic') {
      const Anthropic = require('@anthropic-ai/sdk').default;
      const anthropic = new Anthropic({ apiKey: aiConfig.api_key });
      
      const response = await anthropic.messages.create({
        model: aiConfig.model,
        max_tokens: 500,
        messages: [{ role: 'user', content: goalExtractionPrompt }],
      });
      
      aiResponse = response.content[0]?.text || '';
    }

    if (!aiResponse) {
      return NextResponse.json({ error: 'Failed to extract goals using AI' }, { status: 500 });
    }

    // Parse the AI response
    const summaryMatch = aiResponse.match(/SUMMARY:\s*(.+?)(?=\n\n|$)/);
    const goalsMatch = aiResponse.match(/GOALS:\s*([\s\S]+)/);

    if (!summaryMatch || !goalsMatch) {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    const summary = summaryMatch[1].trim();
    const goalsText = goalsMatch[1].trim();
    
    // Extract individual goals
    const goals = goalsText
      .split('\n')
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(goal => goal.length > 0);

    if (goals.length === 0) {
      return NextResponse.json({ error: 'No goals could be extracted' }, { status: 500 });
    }

    // Store goals in the database
    const goalsToInsert = goals.map(goal => ({
      user_id: context.user!.id,
      goal_text: goal,
      status: 'active'
    }));

    const { data: insertedGoals, error: goalsError } = await supabase
      .from('user_goals')
      .insert(goalsToInsert)
      .select();

    if (goalsError) {
      console.error('Error storing goals:', goalsError);
      return NextResponse.json({ error: 'Failed to store goals' }, { status: 500 });
    }

    // Update the session summary and lock the introduction session
    const { error: updateError } = await supabase
      .from('therapy_sessions')
      .update({
        session_summary: summary,
        title: 'Introduction Complete - Goals Set',
        is_locked: true,
        locked_at: new Date().toISOString(),
        locked_by: 'ai',
        lock_reason: 'introduction_complete',
        can_unlock: false
      })
      .eq('session_id', sessionId);

    if (updateError) {
      console.error('Error updating session:', updateError);
      // Don't fail the request, goals were already stored
    }

    // Add a completion message to the session
    const { error: completionMessageError } = await supabase
      .from('session_messages')
      .insert({
        session_id: sessionId,
        sender_type: 'ai',
        content: `Thank you for sharing your goals and aspirations with me! I've carefully reviewed your responses and created a personalized set of goals for our future sessions together.

**Your Wellness Goals:**
${goals.map((goal, index) => `${index + 1}. ${goal}`).join('\n')}

These goals will guide our conversations and help us track your progress. I'll remember them for all future sessions and check in on your progress regularly.

Your introduction session is now complete! You can start regular wellness sessions whenever you're ready. Each session will be tailored to help you work toward these specific goals.

Is there anything else you'd like to discuss before we wrap up this introduction?`
      });

    if (completionMessageError) {
      console.error('Error adding completion message:', completionMessageError);
      // Don't fail the request, goals were already stored
    }

    return NextResponse.json({
      success: true,
      summary,
      goals: insertedGoals,
      message: 'Introduction session completed successfully'
    });

  } catch (error: any) {
    console.error('Introduction completion error:', error);
    return NextResponse.json({ 
      error: 'Failed to complete introduction session' 
    }, { status: 500 });
  }
}

// Export the secured handler
export const POST = withAPISecurity(handleIntroductionCompletion, SecurityConfigs.GENERAL_API);