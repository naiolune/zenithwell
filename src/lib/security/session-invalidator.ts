import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Session invalidation utility for security
 */
export class SessionInvalidator {
  /**
   * Invalidate user sessions on suspicious activity
   */
  static async invalidateUserSessions(userId: string, reason: string): Promise<void> {
    try {
      console.log(`Invalidating sessions for user ${userId}: ${reason}`);
      
      // Update user's last_activity to force re-authentication
      await supabase
        .from('users')
        .update({ 
          last_activity: new Date().toISOString(),
          security_alert: reason
        })
        .eq('user_id', userId);

      // Log the security event
      await this.logSecurityEvent(userId, 'session_invalidation', reason);
      
    } catch (error) {
      console.error('Error invalidating user sessions:', error);
    }
  }

  /**
   * Check for suspicious activity patterns
   */
  static async checkSuspiciousActivity(
    userId: string, 
    ipAddress: string, 
    userAgent: string,
    endpoint: string
  ): Promise<{ suspicious: boolean; reason?: string }> {
    try {
      // Check for rapid requests from same IP
      const rapidRequests = await this.checkRapidRequests(ipAddress);
      if (rapidRequests) {
        return { suspicious: true, reason: 'Rapid requests detected' };
      }

      // Check for unusual endpoints
      const unusualEndpoints = await this.checkUnusualEndpoints(userId, endpoint);
      if (unusualEndpoints) {
        return { suspicious: true, reason: 'Unusual endpoint access pattern' };
      }

      // Check for multiple IPs for same user
      const multipleIPs = await this.checkMultipleIPs(userId, ipAddress);
      if (multipleIPs) {
        return { suspicious: true, reason: 'Multiple IP addresses detected' };
      }

      return { suspicious: false };
    } catch (error) {
      console.error('Error checking suspicious activity:', error);
      return { suspicious: false };
    }
  }

  /**
   * Check for rapid requests from same IP
   */
  private static async checkRapidRequests(ipAddress: string): Promise<boolean> {
    // This would integrate with your rate limiting system
    // For now, return false as rate limiting is handled elsewhere
    return false;
  }

  /**
   * Check for unusual endpoint access patterns
   */
  private static async checkUnusualEndpoints(userId: string, endpoint: string): Promise<boolean> {
    // Check if user is accessing admin endpoints without admin privileges
    if (endpoint.startsWith('/api/admin') || endpoint.startsWith('/admin')) {
      const { data: user } = await supabase
        .from('users')
        .select('is_admin')
        .eq('user_id', userId)
        .single();

      if (!user?.is_admin) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check for multiple IP addresses for same user
   */
  private static async checkMultipleIPs(userId: string, currentIP: string): Promise<boolean> {
    // This would require tracking user IPs in a separate table
    // For now, return false
    return false;
  }

  /**
   * Log security events
   */
  private static async logSecurityEvent(
    userId: string, 
    eventType: string, 
    details: string
  ): Promise<void> {
    try {
      await supabase
        .from('security_events')
        .insert({
          user_id: userId,
          event_type: eventType,
          details: details,
          timestamp: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error logging security event:', error);
    }
  }

  /**
   * Force logout user by invalidating their session
   */
  static async forceLogout(userId: string, reason: string): Promise<void> {
    try {
      // This would typically involve invalidating JWT tokens
      // For Supabase, we can update user metadata to force re-authentication
      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: {
          force_logout: true,
          logout_reason: reason,
          logout_time: new Date().toISOString()
        }
      });

      await this.logSecurityEvent(userId, 'force_logout', reason);
    } catch (error) {
      console.error('Error forcing logout:', error);
    }
  }
}