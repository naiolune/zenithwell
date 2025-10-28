import { createClient } from '@supabase/supabase-js';
import { APILogger } from './api-logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

export type EndpointType = 'ai_call' | 'general_api';

export class RateLimiter {
  /**
   * Check if user can make a request based on rate limits
   */
  static async checkRateLimit(
    userId: string,
    endpointType: EndpointType,
    ipAddress: string
  ): Promise<RateLimitResult> {
    try {
      const now = new Date();
      const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
      
      // Get user subscription tier
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('subscription_tier, is_admin')
        .eq('user_id', userId)
        .single();

      if (userError || !user) {
        throw new Error('User not found');
      }

      // Admins have unlimited access
      if (user.is_admin) {
        return {
          allowed: true,
          remaining: 999999,
          resetTime: new Date(windowStart.getTime() + 60 * 60 * 1000), // 1 hour from now
        };
      }

      // Get current rate limit info
      const { data: rateLimitData, error: rateLimitError } = await supabase
        .rpc('get_user_rate_limit', {
          p_user_id: userId,
          p_endpoint_type: endpointType,
          p_window_start: windowStart.toISOString(),
        });

      if (rateLimitError) {
        console.error('Rate limit check error:', rateLimitError);
        // Allow request on error to avoid blocking legitimate users
        return {
          allowed: true,
          remaining: 100,
          resetTime: new Date(windowStart.getTime() + 60 * 60 * 1000),
        };
      }

      const rateLimitInfo = rateLimitData?.[0];
      if (!rateLimitInfo) {
        throw new Error('Rate limit data not found');
      }

      const { current_count, limit_reached, reset_time } = rateLimitInfo;
      const remaining = Math.max(0, (endpointType === 'ai_call' ? 100 : 500) - current_count);

      if (limit_reached) {
        // Log the violation
        await APILogger.logRateLimitViolation(
          userId,
          endpointType,
          ipAddress,
          endpointType === 'ai_call' ? 'ai_call_limit' : 'general_api_limit'
        );

        const retryAfter = Math.ceil((new Date(reset_time).getTime() - now.getTime()) / 1000);
        
        return {
          allowed: false,
          remaining: 0,
          resetTime: new Date(reset_time),
          retryAfter,
        };
      }

      return {
        allowed: true,
        remaining,
        resetTime: new Date(reset_time),
      };
    } catch (error) {
      console.error('Rate limit check failed:', error);
      // Allow request on error to avoid blocking legitimate users
      return {
        allowed: true,
        remaining: 100,
        resetTime: new Date(Date.now() + 60 * 60 * 1000),
      };
    }
  }

  /**
   * Increment the rate limit counter for a user
   */
  static async incrementRateLimit(
    userId: string,
    endpointType: EndpointType
  ): Promise<void> {
    try {
      const now = new Date();
      const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
      
      await supabase.rpc('increment_user_rate_limit', {
        p_user_id: userId,
        p_endpoint_type: endpointType,
        p_window_start: windowStart.toISOString(),
      });
    } catch (error) {
      console.error('Failed to increment rate limit:', error);
      // Don't throw - this shouldn't break the API
    }
  }

  /**
   * Get rate limit status for a user (for admin dashboard)
   */
  static async getUserRateLimitStatus(userId: string) {
    try {
      const now = new Date();
      const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
      
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('subscription_tier, is_admin')
        .eq('user_id', userId)
        .single();

      if (userError || !user) {
        throw new Error('User not found');
      }

      const aiCallLimit = user.is_admin ? 999999 : (user.subscription_tier === 'pro' ? 999999 : 100);
      const generalApiLimit = user.is_admin ? 999999 : (user.subscription_tier === 'pro' ? 1000 : 500);

      const [aiCallData, generalApiData] = await Promise.all([
        supabase.rpc('get_user_rate_limit', {
          p_user_id: userId,
          p_endpoint_type: 'ai_call',
          p_window_start: windowStart.toISOString(),
        }),
        supabase.rpc('get_user_rate_limit', {
          p_user_id: userId,
          p_endpoint_type: 'general_api',
          p_window_start: windowStart.toISOString(),
        }),
      ]);

      return {
        aiCalls: {
          current: aiCallData.data?.[0]?.current_count || 0,
          limit: aiCallLimit,
          remaining: Math.max(0, aiCallLimit - (aiCallData.data?.[0]?.current_count || 0)),
          resetTime: aiCallData.data?.[0]?.reset_time || new Date(windowStart.getTime() + 60 * 60 * 1000),
        },
        generalApi: {
          current: generalApiData.data?.[0]?.current_count || 0,
          limit: generalApiLimit,
          remaining: Math.max(0, generalApiLimit - (generalApiData.data?.[0]?.current_count || 0)),
          resetTime: generalApiData.data?.[0]?.reset_time || new Date(windowStart.getTime() + 60 * 60 * 1000),
        },
        tier: user.subscription_tier,
        isAdmin: user.is_admin,
      };
    } catch (error) {
      console.error('Failed to get user rate limit status:', error);
      throw error;
    }
  }

  /**
   * Clean up old rate limit records (called by cron job)
   */
  static async cleanupOldRecords(): Promise<void> {
    try {
      await supabase.rpc('cleanup_old_rate_limits');
    } catch (error) {
      console.error('Failed to cleanup old rate limit records:', error);
    }
  }

  /**
   * Get rate limit statistics for admin dashboard
   */
  static async getRateLimitStats() {
    try {
      const now = new Date();
      const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
      
      const { data: violations, error: violationsError } = await supabase
        .from('rate_limit_violations')
        .select('violation_type, created_at')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

      if (violationsError) {
        throw violationsError;
      }

      const stats = {
        totalViolations24h: violations?.length || 0,
        aiCallViolations: violations?.filter(v => v.violation_type === 'ai_call_limit').length || 0,
        generalApiViolations: violations?.filter(v => v.violation_type === 'general_api_limit').length || 0,
        burstViolations: violations?.filter(v => v.violation_type === 'burst_limit').length || 0,
      };

      return stats;
    } catch (error) {
      console.error('Failed to get rate limit stats:', error);
      throw error;
    }
  }
}
