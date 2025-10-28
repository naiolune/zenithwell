-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table (extends auth.users)
CREATE TABLE public.users (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create AI configuration table
CREATE TABLE public.ai_config (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'perplexity')),
  api_key TEXT NOT NULL,
  model TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create therapy sessions table
CREATE TABLE public.therapy_sessions (
  session_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  is_group BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_summary TEXT
);

-- Create session messages table
CREATE TABLE public.session_messages (
  message_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID REFERENCES public.therapy_sessions(session_id) ON DELETE CASCADE NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'ai')),
  content TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create session participants table (for group sessions)
CREATE TABLE public.session_participants (
  session_id UUID REFERENCES public.therapy_sessions(session_id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  role TEXT NOT NULL CHECK (role IN ('owner', 'participant')),
  PRIMARY KEY (session_id, user_id)
);

-- Create conversation memory table
CREATE TABLE public.conversation_memory (
  memory_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.therapy_sessions(session_id) ON DELETE CASCADE NOT NULL,
  summary TEXT NOT NULL,
  topics TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create subscriptions table
CREATE TABLE public.subscriptions (
  subscription_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid')),
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_therapy_sessions_user_id ON public.therapy_sessions(user_id);
CREATE INDEX idx_therapy_sessions_created_at ON public.therapy_sessions(created_at DESC);
CREATE INDEX idx_session_messages_session_id ON public.session_messages(session_id);
CREATE INDEX idx_session_messages_timestamp ON public.session_messages(timestamp);
CREATE INDEX idx_session_participants_session_id ON public.session_participants(session_id);
CREATE INDEX idx_conversation_memory_user_id ON public.conversation_memory(user_id);
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);

-- Row Level Security (RLS) policies

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapy_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admin policies for users table
CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can update user profiles" ON public.users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- AI config policies (admin only)
CREATE POLICY "Admins can manage AI config" ON public.ai_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Service role can manage AI config" ON public.ai_config
  FOR ALL USING (auth.role() = 'service_role');

-- Therapy sessions policies
CREATE POLICY "Users can view own sessions" ON public.therapy_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions" ON public.therapy_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON public.therapy_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON public.therapy_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Session messages policies
CREATE POLICY "Users can view messages from their sessions" ON public.session_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.therapy_sessions 
      WHERE session_id = public.session_messages.session_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages to their sessions" ON public.session_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.therapy_sessions 
      WHERE session_id = public.session_messages.session_id 
      AND user_id = auth.uid()
    )
  );

-- Session participants policies
CREATE POLICY "Users can view participants of their sessions" ON public.session_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.therapy_sessions 
      WHERE session_id = public.session_participants.session_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add participants to their sessions" ON public.session_participants
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.therapy_sessions 
      WHERE session_id = public.session_participants.session_id 
      AND user_id = auth.uid()
    )
  );

-- Conversation memory policies
CREATE POLICY "Users can view own memories" ON public.conversation_memory
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own memories" ON public.conversation_memory
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Subscriptions policies
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscriptions" ON public.subscriptions
  FOR ALL USING (auth.role() = 'service_role');

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (user_id, email, subscription_tier)
  VALUES (NEW.id, NEW.email, 'free');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
