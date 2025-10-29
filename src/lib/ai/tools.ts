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
  }
];

export function getAITools(): AITool[] {
  return AI_TOOLS;
}
