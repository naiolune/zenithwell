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
    const prompt = `You are a warm, empathetic wellness coach starting a ${session.group_category} group wellness session. 

Based on the following participant introductions, create a personalized, welcoming opening message that:
1. Acknowledges everyone's presence and their individual goals
2. Highlights common themes or shared objectives
3. Sets a positive, collaborative tone
4. Invites the group to begin their wellness journey together
5. Is warm, encouraging, and inclusive

Participant Introductions:
${introSummaries}

Create a welcoming message (2-3 sentences) that addresses the group as a whole while acknowledging their individual goals. Make it feel personal and meaningful.`;

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
