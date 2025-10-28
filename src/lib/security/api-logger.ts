import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface APILogEntry {
  userId?: string;
  endpoint: string;
  method: string;
  statusCode: number;
  ipAddress: string;
  userAgent?: string;
  responseTimeMs: number;
}

export class APILogger {
  /**
   * Log an API request asynchronously (non-blocking)
   */
  static async logRequest(entry: APILogEntry): Promise<void> {
    try {
      // Don't await this - let it run in background
      supabase
        .from('api_logs')
        .insert({
          user_id: entry.userId || null,
          endpoint: entry.endpoint,
          method: entry.method,
          status_code: entry.statusCode,
          ip_address: entry.ipAddress,
          user_agent: entry.userAgent || null,
          response_time_ms: entry.responseTimeMs,
        })
        .then(({ error }) => {
          if (error) {
            console.error('Failed to log API request:', error);
          }
        });
    } catch (error) {
      // Silently fail - logging should never break the API
      console.error('API logging error:', error);
    }
  }

  /**
   * Log a rate limit violation
   */
  static async logRateLimitViolation(
    userId: string | undefined,
    endpoint: string,
    ipAddress: string,
    violationType: 'ai_call_limit' | 'general_api_limit' | 'burst_limit'
  ): Promise<void> {
    try {
      await supabase
        .from('rate_limit_violations')
        .insert({
          user_id: userId || null,
          endpoint,
          ip_address: ipAddress,
          violation_type: violationType,
        });
    } catch (error) {
      console.error('Failed to log rate limit violation:', error);
    }
  }

  /**
   * Log suspicious activity
   */
  static async logSuspiciousActivity(
    userId: string | undefined,
    ipAddress: string,
    activityType: 'rapid_requests' | 'failed_auth' | 'unusual_endpoints' | 'brute_force',
    details: Record<string, any>,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<void> {
    try {
      await supabase
        .from('suspicious_activity')
        .insert({
          user_id: userId || null,
          ip_address: ipAddress,
          activity_type: activityType,
          details,
          severity,
        });
    } catch (error) {
      console.error('Failed to log suspicious activity:', error);
    }
  }

  /**
   * Get API logs for admin dashboard (with pagination)
   */
  static async getLogs(
    page: number = 1,
    limit: number = 50,
    filters: {
      userId?: string;
      endpoint?: string;
      statusCode?: number;
      startDate?: string;
      endDate?: string;
    } = {}
  ) {
    try {
      let query = supabase
        .from('api_logs')
        .select(`
          *,
          users:user_id (email, subscription_tier)
        `)
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters.endpoint) {
        query = query.ilike('endpoint', `%${filters.endpoint}%`);
      }
      if (filters.statusCode) {
        query = query.eq('status_code', filters.statusCode);
      }
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      const { data, error, count } = await query;
      
      if (error) {
        throw error;
      }

      return {
        logs: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        currentPage: page,
      };
    } catch (error) {
      console.error('Failed to fetch API logs:', error);
      throw error;
    }
  }

  /**
   * Get rate limit violations
   */
  static async getRateLimitViolations(
    page: number = 1,
    limit: number = 50,
    filters: {
      userId?: string;
      violationType?: string;
      startDate?: string;
      endDate?: string;
    } = {}
  ) {
    try {
      let query = supabase
        .from('rate_limit_violations')
        .select(`
          *,
          users:user_id (email, subscription_tier)
        `)
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters.violationType) {
        query = query.eq('violation_type', filters.violationType);
      }
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      const { data, error, count } = await query;
      
      if (error) {
        throw error;
      }

      return {
        violations: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        currentPage: page,
      };
    } catch (error) {
      console.error('Failed to fetch rate limit violations:', error);
      throw error;
    }
  }

  /**
   * Get suspicious activity alerts
   */
  static async getSuspiciousActivity(
    page: number = 1,
    limit: number = 50,
    filters: {
      severity?: string;
      activityType?: string;
      isResolved?: boolean;
    } = {}
  ) {
    try {
      let query = supabase
        .from('suspicious_activity')
        .select(`
          *,
          users:user_id (email, subscription_tier)
        `)
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (filters.severity) {
        query = query.eq('severity', filters.severity);
      }
      if (filters.activityType) {
        query = query.eq('activity_type', filters.activityType);
      }
      if (filters.isResolved !== undefined) {
        query = query.eq('is_resolved', filters.isResolved);
      }

      const { data, error, count } = await query;
      
      if (error) {
        throw error;
      }

      return {
        activities: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        currentPage: page,
      };
    } catch (error) {
      console.error('Failed to fetch suspicious activity:', error);
      throw error;
    }
  }
}
