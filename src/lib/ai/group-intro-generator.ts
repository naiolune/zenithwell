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

    // Get all participant introductions (without join to avoid RLS issues)
    let { data: introductions, error } = await supabase
      .from('participant_introductions')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    console.log('[INTRO GENERATOR] Query result:', { 
      introductionsCount: introductions?.length || 0, 
      error: error?.message,
      sessionId 
    });

    if (error) {
      console.error('[INTRO GENERATOR] Error fetching introductions:', error);
      return null;
    }

    if (!introductions || introductions.length === 0) {
      console.log('[INTRO GENERATOR] No introductions found for group session, using default');
      return null; // No introductions yet, use default message
    }

    // Fetch user names separately for each introduction
    const userIds = introductions.map(i => i.user_id).filter(Boolean);
    const userMap = new Map<string, { email?: string; full_name?: string }>();
    
    if (userIds.length > 0) {
      console.log(`[INTRO GENERATOR] Fetching user data for ${userIds.length} users...`);
      // Fetch user names from auth.users via admin API
      for (const userId of userIds) {
        try {
          const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
          if (!authError && authUser?.user) {
            const metadata = authUser.user.user_metadata || {};
            userMap.set(userId, {
              email: authUser.user.email || '',
              full_name: metadata.first_name && metadata.last_name 
                ? `${metadata.first_name} ${metadata.last_name}`
                : metadata.full_name || metadata.name || metadata.display_name || authUser.user.email?.split('@')[0] || 'Participant'
            });
          }
        } catch (e) {
          console.error(`[INTRO GENERATOR] Error fetching user ${userId}:`, e);
          // Set a default name if fetch fails
          userMap.set(userId, { email: '', full_name: 'Participant' });
        }
      }
    }

    // Map introductions with user data (introductions is guaranteed to be non-null here)
    const introductionsWithUsers = introductions.map(intro => ({
      ...intro,
      users: userMap.get(intro.user_id) || { email: '', full_name: 'Participant' }
    }));

    console.log(`[INTRO GENERATOR] Found ${introductionsWithUsers.length} introductions with user data, generating custom intro...`);

    // Format introductions for AI context
    const introSummaries = introductionsWithUsers.map(intro => {
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
    const participantNames = introductionsWithUsers.map(intro => {
      const user = Array.isArray(intro.users) ? intro.users[0] : intro.users;
      return user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Participant';
    }).filter(Boolean);

    const prompt = `You are a warm, empathetic wellness coach facilitating a ${session.group_category} group wellness session.

You are addressing a GROUP of ${introductionsWithUsers.length} participants: ${participantNames.join(', ')}. Use "all of you", "the group", "everyone" when addressing them collectively.

Based on the following participant introductions, create a personalized, welcoming opening message that:
1. Addresses the GROUP as a whole ("Welcome, everyone" or "Hello, all of you")
2. **MUST mention ALL participants by their first names** - acknowledge each person: ${participantNames.join(', ')}
3. Acknowledges each participant's individual goals/challenges briefly
4. Highlights common themes or shared objectives you notice across the group
5. Sets a positive, collaborative tone for group discussion
6. Invites the group to begin their wellness journey together
7. Makes each participant feel seen and valued
8. Is warm, encouraging, and inclusive (3-5 sentences)

CRITICAL REQUIREMENTS:
- You MUST mention ALL ${introductionsWithUsers.length} participants by name: ${participantNames.join(', ')}
- Do not skip anyone - each participant must be acknowledged
- Address the group collectively but personalize for each person
- Reference their specific goals or challenges mentioned in their introductions
- Draw connections between participants' shared goals and unique perspectives

Participant Introductions:
${introSummaries}

Create a welcoming message that addresses the group collectively while acknowledging EACH person's unique goals and challenges. Make sure to mention all participants by name.`;

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
