import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResult {
  tool_call_id: string;
  role: 'tool';
  name: string;
  content: string;
}

export async function executeToolCall(
  toolCall: ToolCall,
  sessionId: string,
  userId: string
): Promise<ToolResult> {
  const { name, arguments: args } = toolCall.function;
  const parsedArgs = JSON.parse(args);

  try {
    switch (name) {
      case 'update_session_title':
        return await executeUpdateSessionTitle(parsedArgs, sessionId, toolCall.id);
      
      case 'update_session_summary':
        return await executeUpdateSessionSummary(parsedArgs, sessionId, toolCall.id);
      
      case 'add_memory':
        return await executeAddMemory(parsedArgs, userId, toolCall.id);
      
      case 'add_goal':
        return await executeAddGoal(parsedArgs, userId, toolCall.id);
      
      case 'update_goal_status':
        return await executeUpdateGoalStatus(parsedArgs, userId, toolCall.id);
      
      default:
        return {
          tool_call_id: toolCall.id,
          role: 'tool',
          name,
          content: `Error: Unknown function ${name}`
        };
    }
  } catch (error) {
    console.error(`Error executing tool ${name}:`, error);
    return {
      tool_call_id: toolCall.id,
      role: 'tool',
      name,
      content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

async function executeUpdateSessionTitle(
  args: { title: string },
  sessionId: string,
  toolCallId: string
): Promise<ToolResult> {
  const { title } = args;
  
  if (!title || title.length > 100) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'update_session_title',
      content: 'Error: Title is required and must be 100 characters or less'
    };
  }

  const { error } = await supabase
    .from('therapy_sessions')
    .update({ title })
    .eq('session_id', sessionId);

  if (error) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'update_session_title',
      content: `Error updating title: ${error.message}`
    };
  }

  return {
    tool_call_id: toolCallId,
    role: 'tool',
    name: 'update_session_title',
    content: `Successfully updated session title to: "${title}"`
  };
}

async function executeUpdateSessionSummary(
  args: { summary: string },
  sessionId: string,
  toolCallId: string
): Promise<ToolResult> {
  const { summary } = args;
  
  if (!summary || summary.length > 500) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'update_session_summary',
      content: 'Error: Summary is required and must be 500 characters or less'
    };
  }

  const { error } = await supabase
    .from('therapy_sessions')
    .update({ session_summary: summary })
    .eq('session_id', sessionId);

  if (error) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'update_session_summary',
      content: `Error updating summary: ${error.message}`
    };
  }

  return {
    tool_call_id: toolCallId,
    role: 'tool',
    name: 'update_session_summary',
    content: `Successfully updated session summary`
  };
}

async function executeAddMemory(
  args: { memory_key: string; memory_value: string; category: string },
  userId: string,
  toolCallId: string
): Promise<ToolResult> {
  const { memory_key, memory_value, category } = args;
  
  if (!memory_key || !memory_value || !category) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'add_memory',
      content: 'Error: memory_key, memory_value, and category are all required'
    };
  }

  const validCategories = ['personal_info', 'preferences', 'progress', 'insights'];
  if (!validCategories.includes(category)) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'add_memory',
      content: `Error: category must be one of: ${validCategories.join(', ')}`
    };
  }

  const { error } = await supabase
    .from('user_memory')
    .insert({
      user_id: userId,
      memory_key,
      memory_value,
      category
    });

  if (error) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'add_memory',
      content: `Error adding memory: ${error.message}`
    };
  }

  return {
    tool_call_id: toolCallId,
    role: 'tool',
    name: 'add_memory',
    content: `Successfully added memory: ${memory_key}`
  };
}

async function executeAddGoal(
  args: { goal_text: string },
  userId: string,
  toolCallId: string
): Promise<ToolResult> {
  const { goal_text } = args;
  
  if (!goal_text) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'add_goal',
      content: 'Error: goal_text is required'
    };
  }

  const { error } = await supabase
    .from('user_goals')
    .insert({
      user_id: userId,
      goal_text,
      status: 'active'
    });

  if (error) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'add_goal',
      content: `Error adding goal: ${error.message}`
    };
  }

  return {
    tool_call_id: toolCallId,
    role: 'tool',
    name: 'add_goal',
    content: `Successfully added goal: "${goal_text}"`
  };
}

async function executeUpdateGoalStatus(
  args: { goal_id: string; status: string },
  userId: string,
  toolCallId: string
): Promise<ToolResult> {
  const { goal_id, status } = args;
  
  if (!goal_id || !status) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'update_goal_status',
      content: 'Error: goal_id and status are required'
    };
  }

  const validStatuses = ['active', 'achieved', 'paused'];
  if (!validStatuses.includes(status)) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'update_goal_status',
      content: `Error: status must be one of: ${validStatuses.join(', ')}`
    };
  }

  const { error } = await supabase
    .from('user_goals')
    .update({ 
      status,
      updated_at: new Date().toISOString()
    })
    .eq('id', goal_id)
    .eq('user_id', userId);

  if (error) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'update_goal_status',
      content: `Error updating goal status: ${error.message}`
    };
  }

  return {
    tool_call_id: toolCallId,
    role: 'tool',
    name: 'update_goal_status',
    content: `Successfully updated goal ${goal_id} to status: ${status}`
  };
}
