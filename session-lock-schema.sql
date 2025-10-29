-- AI Tools Enhancement Database Schema
-- This file contains all database changes for the enhanced AI tools system

-- 1. Add session locking fields to therapy_sessions table
ALTER TABLE public.therapy_sessions 
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS locked_by TEXT CHECK (locked_by IN ('ai', 'admin')),
ADD COLUMN IF NOT EXISTS lock_reason TEXT,
ADD COLUMN IF NOT EXISTS can_unlock BOOLEAN DEFAULT true;

-- 1.5. Add user suspension fields to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES public.users(user_id),
ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
ADD COLUMN IF NOT EXISTS suspension_notes TEXT;

-- 2. Create AI session notes table (private notes for AI continuity)
CREATE TABLE IF NOT EXISTS public.ai_session_notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID REFERENCES public.therapy_sessions(session_id) ON DELETE CASCADE NOT NULL,
  note_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create user preferences table (communication preferences, triggers)
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE NOT NULL,
  preference_key VARCHAR(255) NOT NULL,
  preference_value TEXT NOT NULL,
  category VARCHAR(50) CHECK (category IN ('communication', 'triggers', 'topics_to_avoid', 'general')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create session flags table (for review, escalation, check-ins)
CREATE TABLE IF NOT EXISTS public.session_flags (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID REFERENCES public.therapy_sessions(session_id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE NOT NULL,
  flag_type VARCHAR(50) CHECK (flag_type IN ('review', 'escalate', 'check_in', 'milestone')),
  flag_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES public.users(user_id)
);

-- 5. Add memory enhancements to existing user_memory table
ALTER TABLE public.user_memory
ADD COLUMN IF NOT EXISTS emotion_tag VARCHAR(50),
ADD COLUMN IF NOT EXISTS importance_level INTEGER CHECK (importance_level BETWEEN 1 AND 5) DEFAULT 3;

-- 6. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_therapy_sessions_locked ON public.therapy_sessions(is_locked);
CREATE INDEX IF NOT EXISTS idx_therapy_sessions_locked_at ON public.therapy_sessions(locked_at);
CREATE INDEX IF NOT EXISTS idx_users_suspended ON public.users(is_suspended);
CREATE INDEX IF NOT EXISTS idx_users_suspended_at ON public.users(suspended_at);
CREATE INDEX IF NOT EXISTS idx_ai_session_notes_session_id ON public.ai_session_notes(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_session_notes_created_at ON public.ai_session_notes(created_at);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_category ON public.user_preferences(category);
CREATE INDEX IF NOT EXISTS idx_session_flags_session_id ON public.session_flags(session_id);
CREATE INDEX IF NOT EXISTS idx_session_flags_user_id ON public.session_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_session_flags_type ON public.session_flags(flag_type);
CREATE INDEX IF NOT EXISTS idx_session_flags_resolved ON public.session_flags(resolved);
CREATE INDEX IF NOT EXISTS idx_user_memory_emotion_tag ON public.user_memory(emotion_tag);
CREATE INDEX IF NOT EXISTS idx_user_memory_importance ON public.user_memory(importance_level);

-- 7. Row Level Security (RLS) policies

-- AI session notes policies (admin and service role only)
CREATE POLICY "Service role can manage AI notes" ON public.ai_session_notes
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view AI notes" ON public.ai_session_notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- User preferences policies
CREATE POLICY "Users can view own preferences" ON public.user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own preferences" ON public.user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON public.user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own preferences" ON public.user_preferences
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all preferences" ON public.user_preferences
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Service role can manage preferences" ON public.user_preferences
  FOR ALL USING (auth.role() = 'service_role');

-- Session flags policies
CREATE POLICY "Users can view own session flags" ON public.session_flags
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all session flags" ON public.session_flags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can update session flags" ON public.session_flags
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Service role can manage session flags" ON public.session_flags
  FOR ALL USING (auth.role() = 'service_role');

-- 8. Update existing therapy_sessions policies to include locked sessions
-- (No changes needed - existing policies will work with new columns)

-- 9. Database functions for AI tools

-- Function to check if user has other sessions (for introduction deletion validation)
CREATE OR REPLACE FUNCTION has_other_sessions(p_user_id UUID, p_exclude_session_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM therapy_sessions 
    WHERE user_id = p_user_id 
    AND session_id != p_exclude_session_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user preferences by category
CREATE OR REPLACE FUNCTION get_user_preferences(p_user_id UUID, p_category VARCHAR DEFAULT NULL)
RETURNS TABLE (
  preference_key VARCHAR,
  preference_value TEXT,
  category VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  IF p_category IS NULL THEN
    RETURN QUERY
    SELECT up.preference_key, up.preference_value, up.category, up.created_at
    FROM user_preferences up
    WHERE up.user_id = p_user_id
    ORDER BY up.created_at DESC;
  ELSE
    RETURN QUERY
    SELECT up.preference_key, up.preference_value, up.category, up.created_at
    FROM user_preferences up
    WHERE up.user_id = p_user_id AND up.category = p_category
    ORDER BY up.created_at DESC;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get session flags by type
CREATE OR REPLACE FUNCTION get_session_flags(p_session_id UUID, p_flag_type VARCHAR DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  flag_type VARCHAR,
  flag_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  resolved BOOLEAN,
  resolved_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  IF p_flag_type IS NULL THEN
    RETURN QUERY
    SELECT sf.id, sf.flag_type, sf.flag_reason, sf.created_at, sf.resolved, sf.resolved_at
    FROM session_flags sf
    WHERE sf.session_id = p_session_id
    ORDER BY sf.created_at DESC;
  ELSE
    RETURN QUERY
    SELECT sf.id, sf.flag_type, sf.flag_reason, sf.created_at, sf.resolved, sf.resolved_at
    FROM session_flags sf
    WHERE sf.session_id = p_session_id AND sf.flag_type = p_flag_type
    ORDER BY sf.created_at DESC;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
