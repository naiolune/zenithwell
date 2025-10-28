/**
 * Memory Service for ZenithWell AI Wellness Coach
 * Server-side only - handles all memory and goal operations with Supabase
 */

import { createClient } from '@supabase/supabase-js';

// Use service role key for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface UserGoal {
  id: string;
  user_id: string;
  goal_text: string;
  status: 'active' | 'achieved' | 'paused';
  created_at: string;
  achieved_at?: string;
  updated_at: string;
}

export interface UserMemory {
  id: string;
  user_id: string;
  memory_key: string;
  memory_value: string;
  category: 'goals' | 'preferences' | 'background' | 'progress' | 'custom';
  created_at: string;
  is_active: boolean;
  updated_at: string;
}

export type MemoryCategory = 'goals' | 'preferences' | 'background' | 'progress' | 'custom';
export type GoalStatus = 'active' | 'achieved' | 'paused';

/**
 * Get user memory by category (optional filter)
 */
export async function getUserMemory(
  userId: string, 
  category?: MemoryCategory
): Promise<UserMemory[]> {
  try {
    let query = supabase
      .from('user_memory')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching user memory:', error);
      throw new Error(`Failed to fetch memory: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('getUserMemory error:', error);
    throw error;
  }
}

/**
 * Add new memory item
 */
export async function addMemory(
  userId: string,
  key: string,
  value: string,
  category: MemoryCategory
): Promise<UserMemory> {
  try {
    const { data, error } = await supabase
      .from('user_memory')
      .insert({
        user_id: userId,
        memory_key: key,
        memory_value: value,
        category: category
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding memory:', error);
      throw new Error(`Failed to add memory: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('addMemory error:', error);
    throw error;
  }
}

/**
 * Update memory item
 */
export async function updateMemory(
  memoryId: string,
  value: string
): Promise<UserMemory> {
  try {
    const { data, error } = await supabase
      .from('user_memory')
      .update({
        memory_value: value,
        updated_at: new Date().toISOString()
      })
      .eq('id', memoryId)
      .select()
      .single();

    if (error) {
      console.error('Error updating memory:', error);
      throw new Error(`Failed to update memory: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('updateMemory error:', error);
    throw error;
  }
}

/**
 * Delete memory item (soft delete by setting is_active = false)
 */
export async function deleteMemory(memoryId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_memory')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', memoryId);

    if (error) {
      console.error('Error deleting memory:', error);
      throw new Error(`Failed to delete memory: ${error.message}`);
    }
  } catch (error) {
    console.error('deleteMemory error:', error);
    throw error;
  }
}

/**
 * Search memory items
 */
export async function searchMemory(
  userId: string,
  query: string
): Promise<UserMemory[]> {
  try {
    const { data, error } = await supabase
      .from('user_memory')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .or(`memory_key.ilike.%${query}%,memory_value.ilike.%${query}%`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error searching memory:', error);
      throw new Error(`Failed to search memory: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('searchMemory error:', error);
    throw error;
  }
}

/**
 * Get user goals
 */
export async function getUserGoals(
  userId: string,
  status?: GoalStatus
): Promise<UserGoal[]> {
  try {
    let query = supabase
      .from('user_goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching user goals:', error);
      throw new Error(`Failed to fetch goals: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('getUserGoals error:', error);
    throw error;
  }
}

/**
 * Add new goal
 */
export async function addGoal(
  userId: string,
  goalText: string
): Promise<UserGoal> {
  try {
    const { data, error } = await supabase
      .from('user_goals')
      .insert({
        user_id: userId,
        goal_text: goalText,
        status: 'active'
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding goal:', error);
      throw new Error(`Failed to add goal: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('addGoal error:', error);
    throw error;
  }
}

/**
 * Update goal status
 */
export async function updateGoalStatus(
  goalId: string,
  status: GoalStatus,
  achievedAt?: string
): Promise<UserGoal> {
  try {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'achieved' && achievedAt) {
      updateData.achieved_at = achievedAt;
    }

    const { data, error } = await supabase
      .from('user_goals')
      .update(updateData)
      .eq('id', goalId)
      .select()
      .single();

    if (error) {
      console.error('Error updating goal status:', error);
      throw new Error(`Failed to update goal: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('updateGoalStatus error:', error);
    throw error;
  }
}

/**
 * Delete goal
 */
export async function deleteGoal(goalId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_goals')
      .delete()
      .eq('id', goalId);

    if (error) {
      console.error('Error deleting goal:', error);
      throw new Error(`Failed to delete goal: ${error.message}`);
    }
  } catch (error) {
    console.error('deleteGoal error:', error);
    throw error;
  }
}

/**
 * Format all user memory for AI context
 */
export async function formatMemoryContext(userId: string): Promise<string> {
  try {
    const memory = await getUserMemory(userId);
    
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
  } catch (error) {
    console.error('formatMemoryContext error:', error);
    return 'Error retrieving memory context';
  }
}

/**
 * Check if this is the user's first session
 */
export async function detectFirstSession(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('therapy_sessions')
      .select('session_id')
      .eq('user_id', userId)
      .lt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // 5 minutes ago
      .limit(1);

    if (error) {
      console.error('Error detecting first session:', error);
      return true; // Default to first session if error
    }

    return !data || data.length === 0;
  } catch (error) {
    console.error('detectFirstSession error:', error);
    return true; // Default to first session if error
  }
}

/**
 * Get user's active goals for quick reference
 */
export async function getActiveGoals(userId: string): Promise<string[]> {
  try {
    const goals = await getUserGoals(userId, 'active');
    return goals.map(goal => goal.goal_text);
  } catch (error) {
    console.error('getActiveGoals error:', error);
    return [];
  }
}

/**
 * Store multiple goals from first session
 */
export async function storeFirstSessionGoals(
  userId: string,
  goals: string[]
): Promise<UserGoal[]> {
  try {
    const goalPromises = goals.map(goalText => addGoal(userId, goalText));
    return await Promise.all(goalPromises);
  } catch (error) {
    console.error('storeFirstSessionGoals error:', error);
    throw error;
  }
}

/**
 * Clear all user memory (for privacy controls)
 */
export async function clearAllUserMemory(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_memory')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error clearing user memory:', error);
      throw new Error(`Failed to clear memory: ${error.message}`);
    }
  } catch (error) {
    console.error('clearAllUserMemory error:', error);
    throw error;
  }
}

/**
 * Clear all user goals
 */
export async function clearAllUserGoals(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_goals')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Error clearing user goals:', error);
      throw new Error(`Failed to clear goals: ${error.message}`);
    }
  } catch (error) {
    console.error('clearAllUserGoals error:', error);
    throw error;
  }
}

/**
 * Extract goals from AI response text
 * Looks for goal-like statements in the AI's response
 */
export function extractGoalsFromResponse(responseText: string): string[] {
  const goals: string[] = [];
  
  // Split response into sentences
  const sentences = responseText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
  
  // Look for goal indicators
  const goalPatterns = [
    /(?:goal|objective|target|aim|plan|focus|work on|achieve|accomplish|strive for|commit to)/i,
    /(?:want to|hope to|would like to|plan to|intend to|aspire to)/i,
    /(?:improve|develop|enhance|build|strengthen|grow|learn|practice)/i
  ];
  
  for (const sentence of sentences) {
    // Check if sentence contains goal indicators and is substantial enough
    if (sentence.length > 20 && goalPatterns.some(pattern => pattern.test(sentence))) {
      // Clean up the sentence
      let goal = sentence
        .replace(/^(?:my|our|the|a|an)\s+/i, '') // Remove common prefixes
        .replace(/\s+(?:is|are|was|were|will be|should be|can be)\s+/i, ' ') // Replace linking verbs
        .trim();
      
      // Capitalize first letter
      goal = goal.charAt(0).toUpperCase() + goal.slice(1);
      
      // Add period if not ending with punctuation
      if (!/[.!?]$/.test(goal)) {
        goal += '.';
      }
      
      goals.push(goal);
    }
  }
  
  // Limit to 3 goals maximum
  return goals.slice(0, 3);
}
