/**
 * Group Session Memory Service
 * Handles memory storage and retrieval for group sessions
 * Completely separate from individual user memories
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface GroupMemory {
  id: string;
  session_id: string;
  memory_key: string;
  memory_value: string;
  category: 'group_goals' | 'shared_insights' | 'group_progress' | 'session_notes' | 'collective_learnings';
  created_at: string;
  created_by: string;
}

/**
 * Store a memory for a group session
 */
export async function storeGroupMemory(
  sessionId: string,
  memoryKey: string,
  memoryValue: string,
  category: GroupMemory['category'],
  createdBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('group_session_memory')
      .insert({
        session_id: sessionId,
        memory_key: memoryKey,
        memory_value: memoryValue,
        category,
        created_by: createdBy
      });

    if (error) {
      console.error('Error storing group memory:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error storing group memory:', error);
    return { success: false, error: 'Failed to store group memory' };
  }
}

/**
 * Get all memories for a group session
 */
export async function getGroupMemories(sessionId: string): Promise<GroupMemory[]> {
  try {
    const { data, error } = await supabase
      .from('group_session_memory')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching group memories:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching group memories:', error);
    return [];
  }
}

/**
 * Update a group memory
 */
export async function updateGroupMemory(
  memoryId: string,
  memoryValue: string,
  updatedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('group_session_memory')
      .update({
        memory_value: memoryValue,
        updated_by: updatedBy,
        updated_at: new Date().toISOString()
      })
      .eq('id', memoryId);

    if (error) {
      console.error('Error updating group memory:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating group memory:', error);
    return { success: false, error: 'Failed to update group memory' };
  }
}

/**
 * Delete a group memory
 */
export async function deleteGroupMemory(memoryId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('group_session_memory')
      .delete()
      .eq('id', memoryId);

    if (error) {
      console.error('Error deleting group memory:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting group memory:', error);
    return { success: false, error: 'Failed to delete group memory' };
  }
}

/**
 * Format group memories for AI context
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
 * Extract group goals from AI response
 */
export function extractGroupGoalsFromResponse(responseText: string): string[] {
  const goals: string[] = [];
  
  const sentences = responseText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
  
  const goalPatterns = [
    /(?:group goal|collective goal|shared goal|we want to|we hope to|we plan to|together we)/i,
    /(?:as a group|our group|we should|we need to|we aim to)/i,
    /(?:let's work on|let's focus on|let's achieve|let's develop)/i
  ];
  
  for (const sentence of sentences) {
    if (sentence.length > 20 && goalPatterns.some(pattern => pattern.test(sentence))) {
      let goal = sentence
        .replace(/^(?:as a group|our group|we|let's)\s+/i, '')
        .replace(/\s+(?:is|are|was|were|will be|should be|can be)\s+/i, ' ')
        .trim();
      
      goal = goal.charAt(0).toUpperCase() + goal.slice(1);
      
      if (!/[.!?]$/.test(goal)) {
        goal += '.';
      }
      
      goals.push(goal);
    }
  }
  
  return goals.slice(0, 3);
}

/**
 * Check if this is the first message in a group session
 */
export async function isFirstGroupSessionMessage(sessionId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('session_messages')
      .select('message_id')
      .eq('session_id', sessionId)
      .eq('sender_type', 'user')
      .limit(1);

    if (error) {
      console.error('Error checking first group message:', error);
      return false;
    }

    return !data || data.length === 0;
  } catch (error) {
    console.error('Error checking first group message:', error);
    return false;
  }
}
