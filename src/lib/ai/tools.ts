export interface AITool {
  type: "function";
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required: string[];
    additionalProperties?: boolean;
  };
  strict: boolean;
}

export const AI_TOOLS: AITool[] = [
  {
    type: "function",
    name: "update_session_title",
    description: "Update the current session's title to better reflect the conversation",
    parameters: {
      type: "object",
      properties: {
        title: { 
          type: "string", 
          description: "New session title (max 100 chars)" 
        }
      },
      required: ["title"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "update_session_summary",
    description: "Update the session summary with key topics discussed",
    parameters: {
      type: "object",
      properties: {
        summary: { 
          type: "string", 
          description: "Session summary (max 500 chars)" 
        }
      },
      required: ["summary"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "add_memory",
    description: "Store important information to remember for future sessions",
    parameters: {
      type: "object",
      properties: {
        memory_key: { 
          type: "string",
          description: "Short key to identify this memory"
        },
        memory_value: { 
          type: "string",
          description: "The information to remember"
        },
        category: { 
          type: "string", 
          enum: ["personal_info", "preferences", "progress", "insights"],
          description: "Category of memory"
        }
      },
      required: ["memory_key", "memory_value", "category"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "add_goal",
    description: "Add a new wellness goal for the user",
    parameters: {
      type: "object",
      properties: {
        goal_text: { 
          type: "string",
          description: "The wellness goal text"
        }
      },
      required: ["goal_text"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "update_goal_status",
    description: "Update the status of an existing goal",
    parameters: {
      type: "object",
      properties: {
        goal_id: { 
          type: "string",
          description: "ID of the goal to update"
        },
        status: { 
          type: "string", 
          enum: ["active", "achieved", "paused"],
          description: "New status for the goal"
        }
      },
      required: ["goal_id", "status"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "end_and_lock_session",
    description: "End and lock the current session. Used for completing introduction sessions or when safety hazards are detected",
    parameters: {
      type: "object",
      properties: {
        reason: { 
          type: "string",
          enum: ["introduction_complete", "safety_concern", "user_request"],
          description: "Reason for locking the session"
        },
        lock_message: { 
          type: "string",
          description: "Message to display to user explaining why session is locked (max 200 chars)"
        }
      },
      required: ["reason", "lock_message"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "flag_for_review",
    description: "Flag this session for admin review due to concerning content or behavior",
    parameters: {
      type: "object",
      properties: {
        reason: { 
          type: "string",
          description: "Reason for flagging session for review (max 200 chars)"
        }
      },
      required: ["reason"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "provide_emergency_resources",
    description: "Provide emergency mental health resources and crisis hotlines to the user",
    parameters: {
      type: "object",
      properties: {
        urgency_level: { 
          type: "string",
          enum: ["high", "medium", "low"],
          description: "Level of urgency for the emergency resources"
        },
        custom_message: { 
          type: "string",
          description: "Custom message to accompany the resources (max 100 chars)"
        }
      },
      required: ["urgency_level"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "suggest_session_break",
    description: "Suggest the user take a break from the session if it's becoming too intense",
    parameters: {
      type: "object",
      properties: {
        break_duration: { 
          type: "string",
          enum: ["5_minutes", "15_minutes", "30_minutes", "end_session"],
          description: "Suggested duration for the break"
        },
        reason: { 
          type: "string",
          description: "Reason for suggesting the break (max 100 chars)"
        }
      },
      required: ["break_duration", "reason"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "update_user_preference",
    description: "Store user communication preferences, triggers, or topics to avoid",
    parameters: {
      type: "object",
      properties: {
        preference_key: { 
          type: "string",
          description: "Key identifying the preference (e.g., 'communication_style', 'trigger_topic')"
        },
        preference_value: { 
          type: "string",
          description: "Value of the preference"
        },
        category: { 
          type: "string",
          enum: ["communication", "triggers", "topics_to_avoid", "general"],
          description: "Category of the preference"
        }
      },
      required: ["preference_key", "preference_value", "category"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "add_session_note",
    description: "Add a private note about this session for AI continuity (not visible to user)",
    parameters: {
      type: "object",
      properties: {
        note_text: { 
          type: "string",
          description: "Private note about the session (max 500 chars)"
        }
      },
      required: ["note_text"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "schedule_check_in",
    description: "Flag user for follow-up check-in after discussing difficult topics",
    parameters: {
      type: "object",
      properties: {
        check_in_type: { 
          type: "string",
          enum: ["24_hours", "3_days", "1_week", "2_weeks"],
          description: "When to check in with the user"
        },
        reason: { 
          type: "string",
          description: "Reason for scheduling check-in (max 100 chars)"
        }
      },
      required: ["check_in_type", "reason"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "escalate_to_human",
    description: "Flag that user might benefit from human therapist referral",
    parameters: {
      type: "object",
      properties: {
        reason: { 
          type: "string",
          description: "Reason for escalation to human therapist (max 200 chars)"
        },
        urgency: { 
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Urgency level for the escalation"
        }
      },
      required: ["reason", "urgency"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "add_memory_tag",
    description: "Add emotion and importance tags to existing memories for better recall",
    parameters: {
      type: "object",
      properties: {
        memory_key: { 
          type: "string",
          description: "Key of the memory to tag"
        },
        emotion_tag: { 
          type: "string",
          description: "Emotion associated with this memory (e.g., 'positive', 'negative', 'neutral', 'anxious')"
        },
        importance_level: { 
          type: "integer",
          minimum: 1,
          maximum: 5,
          description: "Importance level from 1 (low) to 5 (critical)"
        }
      },
      required: ["memory_key", "emotion_tag", "importance_level"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "generate_session_insight",
    description: "Store a concise insight or reflection about the current session",
    parameters: {
      type: "object",
      properties: {
        insight_text: {
          type: "string",
          description: "Short insight (max 300 characters) capturing a meaningful reflection from the session"
        },
        insight_type: {
          type: "string",
          description: "Optional insight type label (e.g., 'progress', 'emotion', 'strategy')"
        }
      },
      required: ["insight_text"],
      additionalProperties: false
    },
    strict: true
  }
];

export function getAITools(): AITool[] {
  return AI_TOOLS;
}
