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
      
      case 'end_and_lock_session':
        return await executeEndAndLockSession(parsedArgs, sessionId, toolCall.id);
      
      case 'flag_for_review':
        return await executeFlagForReview(parsedArgs, sessionId, userId, toolCall.id);
      
      case 'provide_emergency_resources':
        return await executeProvideEmergencyResources(parsedArgs, sessionId, toolCall.id);
      
      case 'suggest_session_break':
        return await executeSuggestSessionBreak(parsedArgs, sessionId, toolCall.id);
      
      case 'update_user_preference':
        return await executeUpdateUserPreference(parsedArgs, userId, toolCall.id);
      
      case 'add_session_note':
        return await executeAddSessionNote(parsedArgs, sessionId, toolCall.id);
      
      case 'schedule_check_in':
        return await executeScheduleCheckIn(parsedArgs, sessionId, userId, toolCall.id);
      
      case 'escalate_to_human':
        return await executeEscalateToHuman(parsedArgs, sessionId, userId, toolCall.id);
      
      case 'add_memory_tag':
        return await executeAddMemoryTag(parsedArgs, userId, toolCall.id);
      
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

async function executeEndAndLockSession(
  args: { reason: string; lock_message: string },
  sessionId: string,
  toolCallId: string
): Promise<ToolResult> {
  const { reason, lock_message } = args;
  
  if (!reason || !lock_message) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'end_and_lock_session',
      content: 'Error: reason and lock_message are required'
    };
  }

  if (lock_message.length > 200) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'end_and_lock_session',
      content: 'Error: lock_message must be 200 characters or less'
    };
  }

  const validReasons = ['introduction_complete', 'safety_concern', 'user_request'];
  if (!validReasons.includes(reason)) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'end_and_lock_session',
      content: `Error: reason must be one of: ${validReasons.join(', ')}`
    };
  }

  // Check if session is already locked
  const { data: session, error: sessionError } = await supabase
    .from('therapy_sessions')
    .select('is_locked, session_type')
    .eq('session_id', sessionId)
    .single();

  if (sessionError) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'end_and_lock_session',
      content: `Error: ${sessionError.message}`
    };
  }

  if (session.is_locked) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'end_and_lock_session',
      content: 'Error: Session is already locked'
    };
  }

  // Determine if session can be unlocked based on type and reason
  const canUnlock = !(session.session_type === 'introduction' && reason === 'introduction_complete');

  const { error } = await supabase
    .from('therapy_sessions')
    .update({
      is_locked: true,
      locked_at: new Date().toISOString(),
      locked_by: 'ai',
      lock_reason: reason,
      can_unlock: canUnlock
    })
    .eq('session_id', sessionId);

  if (error) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'end_and_lock_session',
      content: `Error locking session: ${error.message}`
    };
  }

  return {
    tool_call_id: toolCallId,
    role: 'tool',
    name: 'end_and_lock_session',
    content: `Session locked successfully. Reason: ${reason}. ${lock_message}`
  };
}

async function executeFlagForReview(
  args: { reason: string },
  sessionId: string,
  userId: string,
  toolCallId: string
): Promise<ToolResult> {
  const { reason } = args;
  
  if (!reason || reason.length > 200) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'flag_for_review',
      content: 'Error: reason is required and must be 200 characters or less'
    };
  }

  const { error } = await supabase
    .from('session_flags')
    .insert({
      session_id: sessionId,
      user_id: userId,
      flag_type: 'review',
      flag_reason: reason
    });

  if (error) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'flag_for_review',
      content: `Error flagging session: ${error.message}`
    };
  }

  return {
    tool_call_id: toolCallId,
    role: 'tool',
    name: 'flag_for_review',
    content: `Session flagged for admin review. Reason: ${reason}`
  };
}

async function executeProvideEmergencyResources(
  args: { urgency_level: string; custom_message?: string },
  sessionId: string,
  toolCallId: string
): Promise<ToolResult> {
  const { urgency_level, custom_message } = args;
  
  const validUrgencyLevels = ['high', 'medium', 'low'];
  if (!validUrgencyLevels.includes(urgency_level)) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'provide_emergency_resources',
      content: `Error: urgency_level must be one of: ${validUrgencyLevels.join(', ')}`
    };
  }

  if (custom_message && custom_message.length > 100) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'provide_emergency_resources',
      content: 'Error: custom_message must be 100 characters or less'
    };
  }

  const resources = {
    high: `🚨 **CRISIS RESOURCES** 🚨

**National Suicide Prevention Lifeline: 988**
- Available 24/7, free, confidential
- Text or call 988

**Crisis Text Line: Text HOME to 741741**
- Free, 24/7 crisis support via text

**Emergency: Call 911**
- For immediate danger to self or others

**National Domestic Violence Hotline: 1-800-799-7233**
- 24/7 support for domestic violence

${custom_message ? `\n**Personal Message:** ${custom_message}` : ''}

You are not alone. Please reach out for help immediately.`,

    medium: `**Mental Health Support Resources**

**National Suicide Prevention Lifeline: 988**
- Available 24/7, free, confidential

**Crisis Text Line: Text HOME to 741741**
- Free crisis support via text

**SAMHSA National Helpline: 1-800-662-4357**
- 24/7 treatment referral and information

**National Alliance on Mental Illness (NAMI): 1-800-950-6264**
- Information, referrals, and support

${custom_message ? `\n**Note:** ${custom_message}` : ''}

Remember, seeking help is a sign of strength.`,

    low: `**Wellness Resources**

**National Suicide Prevention Lifeline: 988**
- Available 24/7 for any mental health crisis

**Crisis Text Line: Text HOME to 741741**
- Free crisis support via text

**SAMHSA National Helpline: 1-800-662-4357**
- Treatment referral and information

**Mental Health America: mhanational.org**
- Resources and screening tools

${custom_message ? `\n**Gentle Reminder:** ${custom_message}` : ''}

Take care of yourself. Support is available when you need it.`
  };

  return {
    tool_call_id: toolCallId,
    role: 'tool',
    name: 'provide_emergency_resources',
    content: resources[urgency_level as keyof typeof resources]
  };
}

async function executeSuggestSessionBreak(
  args: { break_duration: string; reason: string },
  sessionId: string,
  toolCallId: string
): Promise<ToolResult> {
  const { break_duration, reason } = args;
  
  const validDurations = ['5_minutes', '15_minutes', '30_minutes', 'end_session'];
  if (!validDurations.includes(break_duration)) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'suggest_session_break',
      content: `Error: break_duration must be one of: ${validDurations.join(', ')}`
    };
  }

  if (!reason || reason.length > 100) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'suggest_session_break',
      content: 'Error: reason is required and must be 100 characters or less'
    };
  }

  const breakMessages = {
    '5_minutes': 'I suggest we take a brief 5-minute break to help you process what we\'ve discussed.',
    '15_minutes': 'I recommend a 15-minute break to give you time to reflect and recharge.',
    '30_minutes': 'A 30-minute break might be helpful to give you space to process our conversation.',
    'end_session': 'I think it would be best to end our session here and continue another time.'
  };

  const message = `${breakMessages[break_duration as keyof typeof breakMessages]}

**Reason:** ${reason}

${break_duration === 'end_session' 
  ? 'Please take care of yourself, and feel free to return when you\'re ready to continue our conversation.'
  : 'When you\'re ready, we can continue our session. Take your time - there\'s no rush.'}`;

  return {
    tool_call_id: toolCallId,
    role: 'tool',
    name: 'suggest_session_break',
    content: message
  };
}

async function executeUpdateUserPreference(
  args: { preference_key: string; preference_value: string; category: string },
  userId: string,
  toolCallId: string
): Promise<ToolResult> {
  const { preference_key, preference_value, category } = args;
  
  if (!preference_key || !preference_value || !category) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'update_user_preference',
      content: 'Error: preference_key, preference_value, and category are all required'
    };
  }

  const validCategories = ['communication', 'triggers', 'topics_to_avoid', 'general'];
  if (!validCategories.includes(category)) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'update_user_preference',
      content: `Error: category must be one of: ${validCategories.join(', ')}`
    };
  }

  // Check if preference already exists
  const { data: existing } = await supabase
    .from('user_preferences')
    .select('id')
    .eq('user_id', userId)
    .eq('preference_key', preference_key)
    .single();

  if (existing) {
    // Update existing preference
    const { error } = await supabase
      .from('user_preferences')
      .update({
        preference_value,
        category,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);

    if (error) {
      return {
        tool_call_id: toolCallId,
        role: 'tool',
        name: 'update_user_preference',
        content: `Error updating preference: ${error.message}`
      };
    }

    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'update_user_preference',
      content: `Updated preference: ${preference_key} = ${preference_value}`
    };
  } else {
    // Create new preference
    const { error } = await supabase
      .from('user_preferences')
      .insert({
        user_id: userId,
        preference_key,
        preference_value,
        category
      });

    if (error) {
      return {
        tool_call_id: toolCallId,
        role: 'tool',
        name: 'update_user_preference',
        content: `Error creating preference: ${error.message}`
      };
    }

    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'update_user_preference',
      content: `Created preference: ${preference_key} = ${preference_value}`
    };
  }
}

async function executeAddSessionNote(
  args: { note_text: string },
  sessionId: string,
  toolCallId: string
): Promise<ToolResult> {
  const { note_text } = args;
  
  if (!note_text || note_text.length > 500) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'add_session_note',
      content: 'Error: note_text is required and must be 500 characters or less'
    };
  }

  const { error } = await supabase
    .from('ai_session_notes')
    .insert({
      session_id: sessionId,
      note_text
    });

  if (error) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'add_session_note',
      content: `Error adding session note: ${error.message}`
    };
  }

  return {
    tool_call_id: toolCallId,
    role: 'tool',
    name: 'add_session_note',
    content: 'Session note added successfully (private)'
  };
}

async function executeScheduleCheckIn(
  args: { check_in_type: string; reason: string },
  sessionId: string,
  userId: string,
  toolCallId: string
): Promise<ToolResult> {
  const { check_in_type, reason } = args;
  
  const validTypes = ['24_hours', '3_days', '1_week', '2_weeks'];
  if (!validTypes.includes(check_in_type)) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'schedule_check_in',
      content: `Error: check_in_type must be one of: ${validTypes.join(', ')}`
    };
  }

  if (!reason || reason.length > 100) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'schedule_check_in',
      content: 'Error: reason is required and must be 100 characters or less'
    };
  }

  const { error } = await supabase
    .from('session_flags')
    .insert({
      session_id: sessionId,
      user_id: userId,
      flag_type: 'check_in',
      flag_reason: `${check_in_type}: ${reason}`
    });

  if (error) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'schedule_check_in',
      content: `Error scheduling check-in: ${error.message}`
    };
  }

  return {
    tool_call_id: toolCallId,
    role: 'tool',
    name: 'schedule_check_in',
    content: `Check-in scheduled for ${check_in_type.replace('_', ' ')}. Reason: ${reason}`
  };
}

async function executeEscalateToHuman(
  args: { reason: string; urgency: string },
  sessionId: string,
  userId: string,
  toolCallId: string
): Promise<ToolResult> {
  const { reason, urgency } = args;
  
  const validUrgencyLevels = ['low', 'medium', 'high'];
  if (!validUrgencyLevels.includes(urgency)) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'escalate_to_human',
      content: `Error: urgency must be one of: ${validUrgencyLevels.join(', ')}`
    };
  }

  if (!reason || reason.length > 200) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'escalate_to_human',
      content: 'Error: reason is required and must be 200 characters or less'
    };
  }

  const { error } = await supabase
    .from('session_flags')
    .insert({
      session_id: sessionId,
      user_id: userId,
      flag_type: 'escalate',
      flag_reason: `[${urgency.toUpperCase()}] ${reason}`
    });

  if (error) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'escalate_to_human',
      content: `Error escalating to human: ${error.message}`
    };
  }

  return {
    tool_call_id: toolCallId,
    role: 'tool',
    name: 'escalate_to_human',
    content: `Escalated to human therapist (${urgency} urgency). Reason: ${reason}`
  };
}

async function executeAddMemoryTag(
  args: { memory_key: string; emotion_tag: string; importance_level: number },
  userId: string,
  toolCallId: string
): Promise<ToolResult> {
  const { memory_key, emotion_tag, importance_level } = args;
  
  if (!memory_key || !emotion_tag || importance_level < 1 || importance_level > 5) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'add_memory_tag',
      content: 'Error: memory_key, emotion_tag, and importance_level (1-5) are required'
    };
  }

  // Check if memory exists
  const { data: memory, error: memoryError } = await supabase
    .from('user_memory')
    .select('id')
    .eq('user_id', userId)
    .eq('memory_key', memory_key)
    .single();

  if (memoryError || !memory) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'add_memory_tag',
      content: `Error: Memory with key '${memory_key}' not found`
    };
  }

  const { error } = await supabase
    .from('user_memory')
    .update({
      emotion_tag,
      importance_level,
      updated_at: new Date().toISOString()
    })
    .eq('id', memory.id);

  if (error) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: 'add_memory_tag',
      content: `Error updating memory tags: ${error.message}`
    };
  }

  return {
    tool_call_id: toolCallId,
    role: 'tool',
    name: 'add_memory_tag',
    content: `Memory '${memory_key}' tagged with emotion: ${emotion_tag}, importance: ${importance_level}/5`
  };
}
