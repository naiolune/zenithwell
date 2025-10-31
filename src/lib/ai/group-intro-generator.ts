import { createClient } from '@supabase/supabase-js';
import { ServerAIService } from './server-ai-service';
import { GROUP_SESSION_CONFIG } from '@/lib/group-session-config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function generateGroupSessionIntro(sessionId: string): Promise<string | null> {
  try {
    // Get session details
    const { data: session } = await supabase
      .from('therapy_sessions')
      .select('session_id, group_category, title')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (!session || !session.group_category) {
      return null; // Not a group session
    }

    // Get all participant introductions
    const { data: introductions, error } = await supabase
      .from('participant_introductions')
      .select(`
        id,
        user_id,
        group_category,
        relationship_role,
        why_wellness,
        goals,
        challenges,
        family_role,
        family_goals,
        what_to_achieve,
        participant_role,
        wellness_reason,
        personal_goals,
        expectations,
        users!inner(
          id,
          email,
          full_name
        )
      `)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error || !introductions || introductions.length === 0) {
      console.log('No introductions found for group session, using default');
      return null; // No introductions yet, use default message
    }

    // Format introductions for AI context
    const introSummaries = introductions.map(intro => {
      const user = Array.isArray(intro.users) ? intro.users[0] : intro.users;
      const userName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'A participant';
      
      let summary = `${userName}`;
      
      if (intro.group_category === GROUP_SESSION_CONFIG.GROUP_CATEGORIES.RELATIONSHIP) {
        if (intro.relationship_role) summary += ` (${intro.relationship_role})`;
        if (intro.goals) summary += ` wants to work on: ${intro.goals}`;
        if (intro.challenges) summary += `. Challenges: ${intro.challenges}`;
        if (intro.why_wellness) summary += `. Why wellness: ${intro.why_wellness}`;
      } else if (intro.group_category === GROUP_SESSION_CONFIG.GROUP_CATEGORIES.FAMILY) {
        if (intro.family_role) summary += ` (${intro.family_role})`;
        if (intro.family_goals) summary += ` wants to achieve: ${intro.family_goals}`;
        if (intro.what_to_achieve) summary += `. Specifically: ${intro.what_to_achieve}`;
        if (intro.why_wellness) summary += `. Why wellness: ${intro.why_wellness}`;
      } else {
        if (intro.participant_role) summary += ` (${intro.participant_role})`;
        if (intro.personal_goals) summary += ` has goals: ${intro.personal_goals}`;
        if (intro.expectations) summary += `. Expectations: ${intro.expectations}`;
        if (intro.wellness_reason) summary += `. Reason: ${intro.wellness_reason}`;
      }
      
      return summary;
    }).join('\n');

    // Create a prompt for generating the custom intro
    const prompt = `You are a warm, empathetic wellness coach facilitating a ${session.group_category} group wellness session.

You are addressing a GROUP of participants, not individuals. Use "all of you", "the group", "everyone" when addressing them collectively.

Based on the following participant introductions, create a personalized, welcoming opening message that:
1. Addresses the GROUP as a whole ("Welcome, everyone" or "Hello, all of you")
2. Acknowledges each participant's presence and their individual goals/challenges
3. Highlights common themes or shared objectives you notice across the group
4. Sets a positive, collaborative tone for group discussion
5. Invites the group to begin their wellness journey together
6. Makes each participant feel seen and valued
7. Is warm, encouraging, and inclusive (2-4 sentences)

IMPORTANT: 
- You are talking to a GROUP, not individuals
- Reference specific participants by their first names when relevant
- Draw connections between their goals and challenges
- Make it feel personal and meaningful to each person

Participant Introductions:
${introSummaries}

Create a welcoming message that addresses the group collectively while acknowledging each person's unique goals and challenges. Make it feel like you truly understand what each participant is bringing to this session.`;

    // Generate the custom intro using AI
    const response = await ServerAIService.generateResponse([
      {
        role: 'user',
        content: prompt
      }
    ], sessionId);

    if (response.success && response.content) {
      return response.content.trim();
    }

    console.error('Failed to generate custom intro:', response.error);
    return null;
  } catch (error) {
    console.error('Error generating group session intro:', error);
    return null;
  }
}
