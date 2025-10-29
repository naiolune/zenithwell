export interface User {
  user_id: string;
  email: string;
  subscription_tier: 'free' | 'pro';
  is_admin: boolean;
  created_at: string;
}

export interface AIConfig {
  id: string;
  provider: 'openai' | 'anthropic' | 'perplexity';
  api_key: string;
  model: string;
  is_active: boolean;
  created_at: string;
}

export interface WellnessSession {
  session_id: string;
  user_id: string;
  title: string;
  is_group: boolean;
  session_type: 'individual' | 'group' | 'introduction';
  created_at: string;
  last_message_at: string;
  session_summary?: string;
}

export interface SessionMessage {
  message_id: string;
  session_id: string;
  sender_type: 'user' | 'ai';
  content: string;
  timestamp: string;
}

export interface SessionParticipant {
  session_id: string;
  user_id: string;
  joined_at: string;
  role: 'owner' | 'participant';
}

export interface ConversationMemory {
  memory_id: string;
  user_id: string;
  session_id: string;
  summary: string;
  topics: string[];
  created_at: string;
}

export interface Subscription {
  subscription_id: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  status: 'active' | 'canceled' | 'past_due' | 'unpaid';
  current_period_end: string;
}

export interface UserGoal {
  id: string;
  user_id: string;
  goal_text: string;
  status: 'active' | 'achieved' | 'paused';
  created_at: string;
  achieved_at?: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  needsResend?: boolean;
  isResending?: boolean;
  resendCount?: number;
}

export interface AIProvider {
  name: string;
  id: 'openai' | 'anthropic' | 'perplexity';
  models: string[];
}
