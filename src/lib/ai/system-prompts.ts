/**
 * System Prompts Service for MindFlow AI Wellness Coach
 * Server-side only - generates dynamic system messages based on session type and context
 */

export type SessionType = 'individual' | 'relationship' | 'family' | 'general';

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

export interface SystemPromptConfig {
  sessionType: SessionType;
  isFirstSession: boolean;
  userMemory: UserMemory[];
  userName?: string;
  participantIntroductions?: ParticipantIntroduction[];
}

// Base ZenithWell prompt that applies to all sessions
const BASE_ZENITHWELL_PROMPT = `You are a ZenithWell AI wellness coach - a supportive, evidence-based mental wellness companion. ZenithWell is dedicated to making mental wellness support accessible, personalized, and effective.

IMPORTANT DISCLAIMERS:
- You are not a licensed therapist or medical professional
- You provide wellness support, not medical advice or diagnosis
- Always encourage users to seek professional help for serious concerns
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
This is {user_name}'s first session with ZenithWell. Begin with a warm welcome:

"Welcome to ZenithWell! I'm here to support your mental wellness journey. Before we begin, I'd like to understand what brings you here today:

1. What are your main goals for our sessions together?
2. What areas of your life would you most like to focus on?
3. Are there any specific challenges you're currently facing?
4. How would you know our sessions are helping?

Feel free to share as much or as little as you're comfortable with. Everything we discuss is private and will be remembered for future sessions."

AFTER THEIR RESPONSE:
- Acknowledge and validate their goals
- Ask clarifying questions to understand depth and context
- Store goals in memory using the goal storage system
- Explain how you'll help them work toward these goals
- Set expectations for the wellness journey`;

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

// Group introduction context template
const GROUP_INTRODUCTION_TEMPLATE = `
GROUP SESSION CONTEXT:
This is a group wellness session with the following participants and their introductions:

{introduction_context}

GROUP FACILITATION GUIDELINES:
- Address the group as a whole while acknowledging individual perspectives
- Draw connections between participants' experiences and goals
- Encourage respectful dialogue and active listening
- Ensure all participants feel heard and validated
- Use the introduction context to personalize your responses
- Reference shared goals and challenges when appropriate
- Maintain group cohesion while respecting individual boundaries`;

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
  const { sessionType, isFirstSession, userMemory, userName, participantIntroductions } = config;
  
  let prompt = BASE_ZENITHWELL_PROMPT;
  
  // Add session type specific guidance
  prompt += '\n\n' + SESSION_PROMPTS[sessionType];
  
  // Add group introduction context for group sessions
  if (participantIntroductions && participantIntroductions.length > 0) {
    prompt += '\n\n' + getGroupIntroductionContext(participantIntroductions);
  }
  
  // Add first session protocol if needed
  if (isFirstSession) {
    prompt += '\n\n' + getFirstSessionPrompt(userName);
  }
  
  // Add memory context if available
  if (userMemory && userMemory.length > 0) {
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
