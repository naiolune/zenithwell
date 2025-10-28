-- Security Schema for API Logging, Rate Limiting, and IP Protection
-- This extends the main schema with security-focused tables

-- Create API logs table for tracking all API requests
CREATE TABLE public.api_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  ip_address INET NOT NULL,
  user_agent TEXT,
  response_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create rate limit violations table
CREATE TABLE public.rate_limit_violations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  ip_address INET NOT NULL,
  violation_type TEXT NOT NULL CHECK (violation_type IN ('ai_call_limit', 'general_api_limit', 'burst_limit')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create blocked IPs table
CREATE TABLE public.blocked_ips (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ip_address INET NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  blocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_permanent BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.users(user_id) ON DELETE SET NULL
);

-- Create user rate limits tracking table
CREATE TABLE public.user_rate_limits (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE NOT NULL,
  endpoint_type TEXT NOT NULL CHECK (endpoint_type IN ('ai_call', 'general_api')),
  count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  window_end TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, endpoint_type, window_start)
);

-- Create suspicious activity alerts table
CREATE TABLE public.suspicious_activity (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  ip_address INET NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('rapid_requests', 'failed_auth', 'unusual_endpoints', 'brute_force')),
  details JSONB,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  is_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_api_logs_user_id ON public.api_logs(user_id);
CREATE INDEX idx_api_logs_created_at ON public.api_logs(created_at DESC);
CREATE INDEX idx_api_logs_endpoint ON public.api_logs(endpoint);
CREATE INDEX idx_api_logs_ip_address ON public.api_logs(ip_address);
CREATE INDEX idx_api_logs_status_code ON public.api_logs(status_code);

CREATE INDEX idx_rate_limit_violations_user_id ON public.rate_limit_violations(user_id);
CREATE INDEX idx_rate_limit_violations_created_at ON public.rate_limit_violations(created_at DESC);
CREATE INDEX idx_rate_limit_violations_ip_address ON public.rate_limit_violations(ip_address);

CREATE INDEX idx_blocked_ips_ip_address ON public.blocked_ips(ip_address);
CREATE INDEX idx_blocked_ips_expires_at ON public.blocked_ips(expires_at);
CREATE INDEX idx_blocked_ips_is_permanent ON public.blocked_ips(is_permanent);

CREATE INDEX idx_user_rate_limits_user_id ON public.user_rate_limits(user_id);
CREATE INDEX idx_user_rate_limits_window ON public.user_rate_limits(window_start, window_end);
CREATE INDEX idx_user_rate_limits_endpoint_type ON public.user_rate_limits(endpoint_type);

CREATE INDEX idx_suspicious_activity_user_id ON public.suspicious_activity(user_id);
CREATE INDEX idx_suspicious_activity_ip_address ON public.suspicious_activity(ip_address);
CREATE INDEX idx_suspicious_activity_severity ON public.suspicious_activity(severity);
CREATE INDEX idx_suspicious_activity_created_at ON public.suspicious_activity(created_at DESC);

-- Enable RLS on all security tables
ALTER TABLE public.api_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suspicious_activity ENABLE ROW LEVEL SECURITY;

-- RLS Policies for security tables (admin-only access)

-- API logs - only admins can view
CREATE POLICY "Admins can view API logs" ON public.api_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Service role can insert API logs
CREATE POLICY "Service role can insert API logs" ON public.api_logs
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Rate limit violations - only admins can view
CREATE POLICY "Admins can view rate limit violations" ON public.rate_limit_violations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Service role can insert rate limit violations
CREATE POLICY "Service role can insert rate limit violations" ON public.rate_limit_violations
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Blocked IPs - only admins can manage
CREATE POLICY "Admins can manage blocked IPs" ON public.blocked_ips
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Service role can manage blocked IPs
CREATE POLICY "Service role can manage blocked IPs" ON public.blocked_ips
  FOR ALL USING (auth.role() = 'service_role');

-- User rate limits - users can view their own, service role can manage all
CREATE POLICY "Users can view own rate limits" ON public.user_rate_limits
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service role can manage rate limits" ON public.user_rate_limits
  FOR ALL USING (auth.role() = 'service_role');

-- Suspicious activity - only admins can view
CREATE POLICY "Admins can view suspicious activity" ON public.suspicious_activity
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Service role can insert suspicious activity
CREATE POLICY "Service role can insert suspicious activity" ON public.suspicious_activity
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Function to clean up old rate limit records (runs every hour)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM public.user_rate_limits 
  WHERE window_end < NOW() - INTERVAL '2 hours';
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old API logs (runs daily, keeps 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_api_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.api_logs 
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Function to check if IP is blocked
CREATE OR REPLACE FUNCTION is_ip_blocked(check_ip INET)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.blocked_ips 
    WHERE ip_address = check_ip 
    AND (expires_at IS NULL OR expires_at > NOW())
    AND is_permanent = true
  ) OR EXISTS (
    SELECT 1 FROM public.blocked_ips 
    WHERE ip_address = check_ip 
    AND expires_at > NOW()
    AND is_permanent = false
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get user rate limit info
CREATE OR REPLACE FUNCTION get_user_rate_limit(
  p_user_id UUID,
  p_endpoint_type TEXT,
  p_window_start TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE(
  current_count INTEGER,
  limit_reached BOOLEAN,
  reset_time TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  user_tier TEXT;
  rate_limit INTEGER;
  current_count INTEGER;
BEGIN
  -- Get user subscription tier
  SELECT subscription_tier INTO user_tier
  FROM public.users 
  WHERE user_id = p_user_id;
  
  -- Set rate limits based on tier
  IF user_tier = 'pro' THEN
    rate_limit := CASE 
      WHEN p_endpoint_type = 'ai_call' THEN 999999 -- Effectively unlimited
      WHEN p_endpoint_type = 'general_api' THEN 1000
      ELSE 100
    END;
  ELSE
    rate_limit := CASE 
      WHEN p_endpoint_type = 'ai_call' THEN 100
      WHEN p_endpoint_type = 'general_api' THEN 500
      ELSE 100
    END;
  END IF;
  
  -- Get current count for this window
  SELECT COALESCE(SUM(count), 0) INTO current_count
  FROM public.user_rate_limits
  WHERE user_id = p_user_id 
  AND endpoint_type = p_endpoint_type
  AND window_start = p_window_start;
  
  -- Return results
  RETURN QUERY SELECT 
    current_count,
    (current_count >= rate_limit),
    (p_window_start + INTERVAL '1 hour');
END;
$$ LANGUAGE plpgsql;

-- Function to increment user rate limit
CREATE OR REPLACE FUNCTION increment_user_rate_limit(
  p_user_id UUID,
  p_endpoint_type TEXT,
  p_window_start TIMESTAMP WITH TIME ZONE
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.user_rate_limits (user_id, endpoint_type, count, window_start, window_end)
  VALUES (p_user_id, p_endpoint_type, 1, p_window_start, p_window_start + INTERVAL '1 hour')
  ON CONFLICT (user_id, endpoint_type, window_start)
  DO UPDATE SET count = user_rate_limits.count + 1;
END;
$$ LANGUAGE plpgsql;
