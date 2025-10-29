-- Session insights schema

CREATE TABLE IF NOT EXISTS public.session_insights (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.therapy_sessions(session_id) ON DELETE CASCADE,
  insight_text TEXT NOT NULL,
  insight_type VARCHAR(50) DEFAULT 'coach',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT DEFAULT 'ai'
);

CREATE INDEX IF NOT EXISTS idx_session_insights_session_id ON public.session_insights(session_id);
CREATE INDEX IF NOT EXISTS idx_session_insights_created_at ON public.session_insights(created_at);

