/**
 * System Prompts Service for MindFlow AI Wellness Coach
 * Server-side only - generates dynamic system messages based on session type and context
 */

export type SessionType = 'individual' | 'group' | 'relationship' | 'family' | 'general';

export interface UserMemory {
  id: string;
  memory_key: string;
  memory_value: string;
  category: 'goals' | 'preferences' | 'background' | 'progress' | 'custom';
  created_at: string;
}

export interface ParticipantIntroduction {
  user_id: string;
  user_name: string;
  user_email: string;
  group_category: string;
  relationship_role?: string;
  why_wellness?: string;
  goals?: string;
  challenges?: string;
  family_role?: string;
  family_goals?: string;
  what_to_achieve?: string;
  participant_role?: string;
  wellness_reason?: string;
  personal_goals?: string;
  expectations?: string;
}

export interface GroupMemory {
  id: string;
  session_id: string;
  memory_key: string;
  memory_value: string;
  category: 'group_goals' | 'shared_insights' | 'group_progress' | 'session_notes' | 'collective_learnings';
  created_at: string;
  created_by: string;
}

export interface SystemPromptConfig {
  sessionType: SessionType;
  isFirstSession: boolean;
  userMemory: UserMemory[];
  userName?: string;
  participantIntroductions?: ParticipantIntroduction[];
  groupMemory?: GroupMemory[];
}

// Base ZenithWell prompt that applies to all sessions
const BASE_ZENITHWELL_PROMPT = `You are a ZenithWell wellness coach - a supportive, evidence-based mental wellness companion. ZenithWell is dedicated to making mental wellness support accessible, personalized, and effective.

IMPORTANT DISCLAIMERS:
- You are not a licensed therapist or medical professional
- You provide wellness support, not medical advice or diagnosis
- Always encourage users to seek professional help for serious concerns

RESPONSE GUIDELINES:
- Keep responses SHORT and CONCISE (2-4 sentences typical)
- Be warm, empathetic, and direct
- Focus on one key point per response
- Ask one focused question at a time
- Avoid lengthy explanations unless specifically requested
- When a meaningful reflection emerges, capture it using generate_session_insight (max 300 chars)

TOOL USAGE GUIDELINES:
You have access to several tools to help manage session data and user information:

1. **update_session_title**: Use when you understand the main topic/focus of the conversation. Create a concise, descriptive title (max 100 chars).

2. **update_session_summary**: Use to capture key insights, topics, and progress discussed. Write a brief summary (max 500 chars) highlighting main themes.

3. **add_memory**: Use to store important personal information, preferences, breakthroughs, or insights that should be remembered for future sessions. Choose appropriate category:
   - personal_info: Basic facts about the user
   - preferences: Communication style, interests, etc.
   - progress: Achievements, growth, improvements
   - insights: Important realizations or patterns

4. **add_goal**: Use when the user expresses a desire, intention, or aspiration for their wellness journey. Create clear, actionable goals.

5. **update_goal_status**: Use to mark goals as achieved when the user reports success, or pause them if they're no longer relevant.

Use these tools proactively to enhance the user experience and maintain continuity across sessions.
- In emergencies, direct users to crisis resources (988 Suicide & Crisis Lifeline)

YOUR APPROACH:
- Be warm, empathetic, and non-judgmental
- Ask thoughtful, open-ended questions
- Validate feelings while encouraging healthy perspectives
- Offer evidence-based coping strategies and wellness techniques
- Remember and reference past conversations (when memory available)
- Respect boundaries and maintain appropriate professional distance`;

// Session type specific prompts
const SESSION_PROMPTS: Record<SessionType, string> = {
  individual: `
INDIVIDUAL SESSION FOCUS:
- Personal growth and self-discovery
- Individual coping strategies and resilience building
- Self-reflection and emotional awareness
- Personal goal setting and accountability
- One-on-one support tailored to their unique journey`,

  group: ` 
GROUP SESSION FOCUS:
- You are facilitating a GROUP wellness session with multiple participants
- You are NOT talking to a single individual - you are addressing a GROUP
- Always address the group collectively ("all of you", "the group", "everyone")
- Reference specific participants by name when relevant: "{participant_name} mentioned..."
- Draw connections between participants' experiences and goals
- Facilitate dialogue between participants by acknowledging similarities and differences
- Create a safe, inclusive space where all voices are heard
- Encourage participants to learn from each other's perspectives
- When someone shares, acknowledge their contribution and invite others to respond
- Balance individual attention with group cohesion
- Use participant introductions to personalize your responses to each person
- Remember: You are facilitating a GROUP conversation, not having individual conversations`,

  relationship: `
RELATIONSHIP SESSION FOCUS:
- Communication skills and conflict resolution
- Understanding relationship dynamics and patterns
- Building intimacy and emotional connection
- Addressing specific relationship challenges
- Supporting both partners equally and fairly
- Encouraging mutual respect and healthy boundaries`,

  family: `
FAMILY SESSION FOCUS:
- Family dynamics and generational patterns
- Parent-child relationships and communication
- Sibling relationships and family roles
- Family conflict resolution and healing
- Supporting all family members' perspectives
- Building stronger family connections and understanding`,

  general: `
GENERAL GROUP SESSION FOCUS:
- Shared experiences and peer support
- Group cohesion and safe space creation
- Facilitating respectful dialogue between members
- Drawing connections between members' experiences
- Encouraging participation from all members
- Managing group dynamics and keeping discussions productive`
};

// First session protocol
const FIRST_SESSION_PROTOCOL = `
FIRST SESSION PROTOCOL:
This is {user_name}'s first session with ZenithWell. Keep it brief and focused on goals:

"Welcome! I'm your wellness coach. Let's start with your goals:

What are your main wellness goals? What would you like to work on?"

AFTER THEIR RESPONSE:
- Acknowledge their goals briefly
- Ask ONE clarifying question if needed
- Store goals using the goal storage system
- Keep responses short and focused
- After collecting goals, suggest they start their first regular session`;

// Memory integration template
const MEMORY_INTEGRATION_TEMPLATE = `
AVAILABLE MEMORY (if exists):
{memory_context}

USING MEMORY:
- Reference past conversations naturally ("Last time we discussed...")
- Track progress toward goals ("You mentioned wanting to...")
- Notice patterns and growth ("I've noticed you've been...")
- Avoid repeating questions you already know answers to
- Build continuity across sessions for deeper support

If no memory exists, treat as first session and collect foundational information.`;

// Group memory integration template
const GROUP_MEMORY_INTEGRATION_TEMPLATE = `
AVAILABLE GROUP MEMORY (if exists):
{group_memory_context}

USING GROUP MEMORY:
- Reference shared group insights and progress ("As a group, you've been working on...")
- Track collective goals and achievements ("The group has made progress on...")
- Build on previous group discussions ("Last time the group discussed...")
- Maintain group continuity and shared understanding
- Focus on group dynamics and collective growth

If no group memory exists, treat as first group session and collect foundational group information.`;

// Group introduction context template
const GROUP_INTRODUCTION_TEMPLATE = ` 
GROUP SESSION CONTEXT:
This is a group wellness session with the following participants and their introductions:

{introduction_context}

CRITICAL GROUP FACILITATION GUIDELINES:
- You are talking to a GROUP, not individuals - address "all of you", "the group", "everyone"
- When referencing specific participants, use their names: "{participant_name} mentioned..."
- Use the introduction context to understand each participant's goals, challenges, and roles
- Reference participant introductions naturally in your responses
- Draw connections between participants' shared goals and unique perspectives
- Facilitate group dialogue by acknowledging what each person brings to the session
- Encourage participants to learn from each other and build on shared experiences
- Balance individual attention with group cohesion - make everyone feel seen
- Create a collaborative, supportive environment where participants can share openly
- Use participant names and their specific goals/challenges to personalize your facilitation
- Remember each participant's role (relationship partner, family member, etc.) and address accordingly
- When someone shares, acknowledge their contribution and invite others to respond or relate
- Maintain group continuity by referencing what participants shared earlier in the session`;

/**
 * Format group memory into context for AI
 */
export function formatGroupMemoryContext(memories: GroupMemory[]): string {
  if (!memories || memories.length === 0) {
    return 'No group session memory available';
  }

  const memoryByCategory = memories.reduce((acc, memory) => {
    if (!acc[memory.category]) {
      acc[memory.category] = [];
    }
    acc[memory.category].push(memory);
    return acc;
  }, {} as Record<string, GroupMemory[]>);

  const formattedSections = Object.entries(memoryByCategory).map(([category, items]) => {
    const categoryName = category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const itemsList = items.map(item => `- ${item.memory_key}: ${item.memory_value}`).join('\n');
    return `${categoryName}:\n${itemsList}`;
  });

  return formattedSections.join('\n\n');
}

/**
 * Format participant introductions into context for AI
 */
export function formatGroupIntroductionContext(introductions: ParticipantIntroduction[]): string {
  if (!introductions || introductions.length === 0) {
    return 'No participant introductions available';
  }

  const formattedIntroductions = introductions.map(intro => {
    let context = `\n**${intro.user_name}** (${intro.user_email}):\n`;
    
    if (intro.group_category === 'relationship') {
      context += `- Role in relationship: ${intro.relationship_role || 'Not specified'}\n`;
      context += `- Why seeking wellness: ${intro.why_wellness || 'Not specified'}\n`;
      context += `- Goals: ${intro.goals || 'Not specified'}\n`;
      if (intro.challenges) {
        context += `- Challenges: ${intro.challenges}\n`;
      }
    } else if (intro.group_category === 'family') {
      context += `- Family role: ${intro.family_role || 'Not specified'}\n`;
      context += `- Why seeking wellness: ${intro.why_wellness || 'Not specified'}\n`;
      context += `- Family goals: ${intro.family_goals || 'Not specified'}\n`;
      context += `- What to achieve: ${intro.what_to_achieve || 'Not specified'}\n`;
    } else if (intro.group_category === 'general') {
      context += `- Role in session: ${intro.participant_role || 'Not specified'}\n`;
      context += `- Wellness reason: ${intro.wellness_reason || 'Not specified'}\n`;
      context += `- Personal goals: ${intro.personal_goals || 'Not specified'}\n`;
      context += `- Expectations: ${intro.expectations || 'Not specified'}\n`;
    }
    
    return context;
  }).join('\n');

  return `Group Category: ${introductions[0]?.group_category || 'Unknown'}\n${formattedIntroductions}`;
}

/**
 * Get group introduction context for system prompt
 */
export function getGroupIntroductionContext(introductions: ParticipantIntroduction[]): string {
  const context = formatGroupIntroductionContext(introductions);
  return GROUP_INTRODUCTION_TEMPLATE.replace('{introduction_context}', context);
}

/**
 * Format user memory into context for AI
 */
export function formatMemoryContext(memory: UserMemory[]): string {
  if (!memory || memory.length === 0) {
    return 'No previous memory available';
  }

  const memoryByCategory = memory.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, UserMemory[]>);

  const formattedSections = Object.entries(memoryByCategory).map(([category, items]) => {
    const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
    const itemsList = items.map(item => `- ${item.memory_key}: ${item.memory_value}`).join('\n');
    return `${categoryName}:\n${itemsList}`;
  });

  return formattedSections.join('\n\n');
}

/**
 * Get the first session prompt for goal collection
 */
export function getFirstSessionPrompt(userName: string = 'there'): string {
  return FIRST_SESSION_PROTOCOL.replace('{user_name}', userName);
}

/**
 * Build complete system prompt based on session configuration
 */
export function getSystemPrompt(config: SystemPromptConfig): string {
  const { sessionType, isFirstSession, userMemory, userName, participantIntroductions, groupMemory } = config;
  
  let prompt = BASE_ZENITHWELL_PROMPT;
  
  // Add session type specific guidance
  prompt += '\n\n' + SESSION_PROMPTS[sessionType];
  
  // Add group introduction context for group sessions
  if (participantIntroductions && participantIntroductions.length > 0) {
    prompt += '\n\n' + getGroupIntroductionContext(participantIntroductions);
  }
  
  // Add group memory context for group sessions
  if (sessionType === 'group' && groupMemory && groupMemory.length > 0) {
    const groupMemoryContext = formatGroupMemoryContext(groupMemory);
    prompt += '\n\n' + GROUP_MEMORY_INTEGRATION_TEMPLATE.replace('{group_memory_context}', groupMemoryContext);
  }
  
  // Add first session protocol if needed (only for individual sessions)
  if (isFirstSession && sessionType !== 'group') {
    prompt += '\n\n' + getFirstSessionPrompt(userName);
  }
  
  // Add individual memory context if available (only for individual sessions)
  if (sessionType !== 'group' && userMemory && userMemory.length > 0) {
    const memoryContext = formatMemoryContext(userMemory);
    prompt += '\n\n' + MEMORY_INTEGRATION_TEMPLATE.replace('{memory_context}', memoryContext);
  }
  
  return prompt;
}

/**
 * Get session type specific prompt only (for testing/debugging)
 */
export function getSessionTypePrompt(sessionType: SessionType): string {
  return SESSION_PROMPTS[sessionType];
}

/**
 * Extract goals from AI response (future enhancement)
 * This would parse AI responses to automatically store goals
 */
export function extractGoalsFromResponse(response: string): string[] {
  // This is a placeholder for future goal extraction logic
  // Could use regex patterns or more sophisticated NLP
  const goalPatterns = [
    /goal[s]?\s*(?:is|are|to)\s*:?\s*([^.]+)/gi,
    /want[s]?\s*to\s*([^.]+)/gi,
    /hoping\s*to\s*([^.]+)/gi
  ];
  
  const goals: string[] = [];
  
  goalPatterns.forEach(pattern => {
    const matches = response.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const goal = match.replace(pattern, '$1').trim();
        if (goal && goal.length > 10) { // Basic validation
          goals.push(goal);
        }
      });
    }
  });
  
  return goals;
}

/**
 * Extract memory items from AI response (future enhancement)
 * This would parse AI responses to automatically store important context
 */
export function extractMemoryFromResponse(response: string): Array<{key: string, value: string, category: string}> {
  // This is a placeholder for future memory extraction logic
  // Could identify important facts, preferences, or context mentioned
  return [];
}
