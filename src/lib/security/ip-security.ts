import { createClient } from '@supabase/supabase-js';
import { APILogger } from './api-logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface IPBlockResult {
  isBlocked: boolean;
  reason?: string;
  expiresAt?: Date;
}

export interface SuspiciousActivity {
  type: 'rapid_requests' | 'failed_auth' | 'unusual_endpoints' | 'brute_force';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
}

export class IPSecurity {
  /**
   * Check if an IP address is blocked
   */
  static async isIPBlocked(ipAddress: string): Promise<IPBlockResult> {
    try {
      const { data, error } = await supabase
        .from('blocked_ips')
        .select('reason, expires_at, is_permanent')
        .eq('ip_address', ipAddress)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Error checking IP block status:', error);
        return { isBlocked: false };
      }

      if (!data) {
        return { isBlocked: false };
      }

      // Check if block has expired
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        return { isBlocked: false };
      }

      return {
        isBlocked: true,
        reason: data.reason,
        expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
      };
    } catch (error) {
      console.error('IP block check failed:', error);
      return { isBlocked: false };
    }
  }

  /**
   * Block an IP address
   */
  static async blockIP(
    ipAddress: string,
    reason: string,
    durationHours?: number,
    isPermanent: boolean = false,
    createdBy?: string
  ): Promise<void> {
    try {
      const expiresAt = isPermanent || !durationHours 
        ? null 
        : new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

      await supabase
        .from('blocked_ips')
        .upsert({
          ip_address: ipAddress,
          reason,
          expires_at: expiresAt,
          is_permanent: isPermanent,
          created_by: createdBy || null,
        });
    } catch (error) {
      console.error('Failed to block IP:', error);
      throw error;
    }
  }

  /**
   * Unblock an IP address
   */
  static async unblockIP(ipAddress: string): Promise<void> {
    try {
      await supabase
        .from('blocked_ips')
        .delete()
        .eq('ip_address', ipAddress);
    } catch (error) {
      console.error('Failed to unblock IP:', error);
      throw error;
    }
  }

  /**
   * Track failed authentication attempts
   */
  static async trackFailedAuth(ipAddress: string, userId?: string): Promise<void> {
    try {
      // Check recent failed attempts for this IP
      const { data: recentAttempts, error: attemptsError } = await supabase
        .from('api_logs')
        .select('created_at')
        .eq('ip_address', ipAddress)
        .eq('status_code', 401)
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
        .order('created_at', { ascending: false });

      if (attemptsError) {
        console.error('Error checking recent failed attempts:', attemptsError);
        return;
      }

      const failedAttempts = recentAttempts?.length || 0;

      // Log suspicious activity if too many failed attempts
      if (failedAttempts >= 5) {
        await APILogger.logSuspiciousActivity(
          userId,
          ipAddress,
          'brute_force',
          {
            failed_attempts: failedAttempts,
            time_window: '1 hour',
          },
          'high'
        );

        // Auto-block IP after 10 failed attempts
        if (failedAttempts >= 10) {
          await this.blockIP(
            ipAddress,
            `Brute force attack detected - ${failedAttempts} failed auth attempts in 1 hour`,
            24, // 24 hour block
            false,
            'system'
          );
        }
      }
    } catch (error) {
      console.error('Failed to track failed auth:', error);
    }
  }

  /**
   * Track rapid requests from an IP
   */
  static async trackRapidRequests(ipAddress: string, userId?: string): Promise<void> {
    try {
      // Check requests in the last minute
      const { data: recentRequests, error: requestsError } = await supabase
        .from('api_logs')
        .select('created_at, endpoint')
        .eq('ip_address', ipAddress)
        .gte('created_at', new Date(Date.now() - 60 * 1000).toISOString()) // Last minute
        .order('created_at', { ascending: false });

      if (requestsError) {
        console.error('Error checking recent requests:', requestsError);
        return;
      }

      const requestCount = recentRequests?.length || 0;

      // Log suspicious activity if too many requests
      if (requestCount >= 30) { // 30 requests per minute
        await APILogger.logSuspiciousActivity(
          userId,
          ipAddress,
          'rapid_requests',
          {
            request_count: requestCount,
            time_window: '1 minute',
            endpoints: [...new Set(recentRequests?.map(r => r.endpoint) || [])],
          },
          requestCount >= 60 ? 'critical' : 'high'
        );

        // Auto-block IP after 100 requests per minute
        if (requestCount >= 100) {
          await this.blockIP(
            ipAddress,
            `Rapid requests detected - ${requestCount} requests in 1 minute`,
            1, // 1 hour block
            false,
            'system'
          );
        }
      }
    } catch (error) {
      console.error('Failed to track rapid requests:', error);
    }
  }

  /**
   * Track unusual endpoint access patterns
   */
  static async trackUnusualEndpoints(
    ipAddress: string, 
    endpoint: string, 
    userId?: string
  ): Promise<void> {
    try {
      // Check if this IP has accessed this endpoint before
      const { data: previousAccess, error: accessError } = await supabase
        .from('api_logs')
        .select('created_at')
        .eq('ip_address', ipAddress)
        .eq('endpoint', endpoint)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
        .limit(1);

      if (accessError) {
        console.error('Error checking previous access:', accessError);
        return;
      }

      // If this is a new endpoint for this IP, log it
      if (!previousAccess || previousAccess.length === 0) {
        await APILogger.logSuspiciousActivity(
          userId,
          ipAddress,
          'unusual_endpoints',
          {
            endpoint,
            first_access: true,
            time_window: '7 days',
          },
          'low'
        );
      }
    } catch (error) {
      console.error('Failed to track unusual endpoints:', error);
    }
  }

  /**
   * Get blocked IPs for admin dashboard
   */
  static async getBlockedIPs(
    page: number = 1,
    limit: number = 50,
    filters: {
      isPermanent?: boolean;
      reason?: string;
    } = {}
  ) {
    try {
      let query = supabase
        .from('blocked_ips')
        .select(`
          *,
          users:created_by (email)
        `)
        .order('blocked_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (filters.isPermanent !== undefined) {
        query = query.eq('is_permanent', filters.isPermanent);
      }
      if (filters.reason) {
        query = query.ilike('reason', `%${filters.reason}%`);
      }

      const { data, error, count } = await query;
      
      if (error) {
        throw error;
      }

      return {
        blockedIPs: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        currentPage: page,
      };
    } catch (error) {
      console.error('Failed to fetch blocked IPs:', error);
      throw error;
    }
  }

  /**
   * Clean up expired IP blocks
   */
  static async cleanupExpiredBlocks(): Promise<void> {
    try {
      await supabase
        .from('blocked_ips')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .eq('is_permanent', false);
    } catch (error) {
      console.error('Failed to cleanup expired IP blocks:', error);
    }
  }

  /**
   * Get IP security statistics
   */
  static async getIPSecurityStats() {
    try {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [
        { data: blockedIPs, error: blockedError },
        { data: suspiciousActivity, error: suspiciousError },
        { data: violations, error: violationsError }
      ] = await Promise.all([
        supabase
          .from('blocked_ips')
          .select('is_permanent, blocked_at')
          .gte('blocked_at', last24h.toISOString()),
        supabase
          .from('suspicious_activity')
          .select('severity, activity_type, created_at')
          .gte('created_at', last24h.toISOString()),
        supabase
          .from('rate_limit_violations')
          .select('ip_address, created_at')
          .gte('created_at', last24h.toISOString())
      ]);

      if (blockedError || suspiciousError || violationsError) {
        throw new Error('Failed to fetch security stats');
      }

      return {
        blockedIPs24h: blockedIPs?.length || 0,
        permanentBlocks: blockedIPs?.filter(b => b.is_permanent).length || 0,
        suspiciousActivities24h: suspiciousActivity?.length || 0,
        criticalAlerts: suspiciousActivity?.filter(s => s.severity === 'critical').length || 0,
        uniqueViolatingIPs: new Set(violations?.map(v => v.ip_address) || []).size,
      };
    } catch (error) {
      console.error('Failed to get IP security stats:', error);
      throw error;
    }
  }
}
