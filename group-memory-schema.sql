-- Group Session Memory Schema
-- Separate memory system for group sessions to maintain privacy from individual sessions

-- Create group_session_memory table
CREATE TABLE IF NOT EXISTS public.group_session_memory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES public.therapy_sessions(session_id) ON DELETE CASCADE,
    memory_key VARCHAR(255) NOT NULL,
    memory_value TEXT NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('group_goals', 'shared_insights', 'group_progress', 'session_notes', 'collective_learnings')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_group_session_memory_session_id ON public.group_session_memory(session_id);
CREATE INDEX IF NOT EXISTS idx_group_session_memory_category ON public.group_session_memory(category);
CREATE INDEX IF NOT EXISTS idx_group_session_memory_created_at ON public.group_session_memory(created_at);

-- RLS Policies for group_session_memory
ALTER TABLE public.group_session_memory ENABLE ROW LEVEL SECURITY;

-- Users can view memories for sessions they participate in
CREATE POLICY "Users can view group memories for their sessions" ON public.group_session_memory
    FOR SELECT USING (
        session_id IN (
            SELECT session_id FROM public.session_participants 
            WHERE user_id = auth.uid()
        )
    );

-- Users can insert memories for sessions they participate in
CREATE POLICY "Users can insert group memories for their sessions" ON public.group_session_memory
    FOR INSERT WITH CHECK (
        session_id IN (
            SELECT session_id FROM public.session_participants 
            WHERE user_id = auth.uid()
        ) AND created_by = auth.uid()
    );

-- Users can update memories they created
CREATE POLICY "Users can update their own group memories" ON public.group_session_memory
    FOR UPDATE USING (created_by = auth.uid());

-- Users can delete memories they created
CREATE POLICY "Users can delete their own group memories" ON public.group_session_memory
    FOR DELETE USING (created_by = auth.uid());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_group_memory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_group_session_memory_updated_at
    BEFORE UPDATE ON public.group_session_memory
    FOR EACH ROW
    EXECUTE FUNCTION update_group_memory_updated_at();

-- Function to get group session memory context for AI
CREATE OR REPLACE FUNCTION get_group_memory_context(session_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    memory_context TEXT := '';
    memory_record RECORD;
    current_category TEXT := '';
BEGIN
    FOR memory_record IN 
        SELECT category, memory_key, memory_value
        FROM public.group_session_memory
        WHERE session_id = session_uuid
        ORDER BY category, created_at
    LOOP
        IF memory_record.category != current_category THEN
            IF current_category != '' THEN
                memory_context := memory_context || E'\n';
            END IF;
            memory_context := memory_context || 
                INITCAP(REPLACE(memory_record.category, '_', ' ')) || ':' || E'\n';
            current_category := memory_record.category;
        END IF;
        
        memory_context := memory_context || 
            '- ' || memory_record.memory_key || ': ' || memory_record.memory_value || E'\n';
    END LOOP;
    
    IF memory_context = '' THEN
        memory_context := 'No group session memory available';
    END IF;
    
    RETURN memory_context;
END;
$$ LANGUAGE plpgsql;
