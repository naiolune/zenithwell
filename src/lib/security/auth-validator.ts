import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface AuthResult {
  isValid: boolean;
  user?: {
    id: string;
    email: string;
    subscriptionTier: 'free' | 'pro';
    isAdmin: boolean;
  };
  error?: string;
  errorCode?: string;
}

export interface FeatureAccess {
  hasAccess: boolean;
  reason?: string;
  upgradeRequired?: boolean;
}

export class AuthValidator {
  /**
   * Validate user authentication and return user info
   */
  static async validateAuth(authHeader: string | null): Promise<AuthResult> {
    try {
      if (!authHeader) {
        return {
          isValid: false,
          error: 'Authorization header required',
          errorCode: 'MISSING_AUTH_HEADER',
        };
      }

      const token = authHeader.replace('Bearer ', '');
      
      // Verify the token with Supabase
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        return {
          isValid: false,
          error: 'Invalid or expired token',
          errorCode: 'INVALID_TOKEN',
        };
      }

      // Get user profile from our users table
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('subscription_tier, is_admin')
        .eq('user_id', user.id)
        .single();

      if (profileError || !userProfile) {
        return {
          isValid: false,
          error: 'User profile not found',
          errorCode: 'USER_NOT_FOUND',
        };
      }

      return {
        isValid: true,
        user: {
          id: user.id,
          email: user.email || '',
          subscriptionTier: userProfile.subscription_tier as 'free' | 'pro',
          isAdmin: userProfile.is_admin || false,
        },
      };
    } catch (error) {
      console.error('Auth validation error:', error);
      return {
        isValid: false,
        error: 'Authentication validation failed',
        errorCode: 'AUTH_VALIDATION_ERROR',
      };
    }
  }

  /**
   * Check if user has access to a specific feature
   */
  static async checkFeatureAccess(
    userId: string,
    feature: 'ai_chat' | 'group_sessions' | 'unlimited_sessions' | 'admin_panel'
  ): Promise<FeatureAccess> {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('subscription_tier, is_admin')
        .eq('user_id', userId)
        .single();

      if (error || !user) {
        return {
          hasAccess: false,
          reason: 'User not found',
        };
      }

      switch (feature) {
        case 'ai_chat':
          // All users can access AI chat
          return { hasAccess: true };

        case 'group_sessions':
          // Only Pro users and admins can access group sessions
          if (user.is_admin || user.subscription_tier === 'pro') {
            return { hasAccess: true };
          }
          return {
            hasAccess: false,
            reason: 'Group sessions require Pro subscription',
            upgradeRequired: true,
          };

        case 'unlimited_sessions':
          // Only Pro users and admins have unlimited sessions
          if (user.is_admin || user.subscription_tier === 'pro') {
            return { hasAccess: true };
          }
          return {
            hasAccess: false,
            reason: 'Unlimited sessions require Pro subscription',
            upgradeRequired: true,
          };

        case 'admin_panel':
          // Only admins can access admin panel
          if (user.is_admin) {
            return { hasAccess: true };
          }
          return {
            hasAccess: false,
            reason: 'Admin privileges required',
          };

        default:
          return {
            hasAccess: false,
            reason: 'Unknown feature',
          };
      }
    } catch (error) {
      console.error('Feature access check error:', error);
      return {
        hasAccess: false,
        reason: 'Feature access check failed',
      };
    }
  }

  /**
   * Check if user is admin
   */
  static async isAdmin(userId: string): Promise<boolean> {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('user_id', userId)
        .single();

      if (error || !user) {
        return false;
      }

      return user.is_admin || false;
    } catch (error) {
      console.error('Admin check error:', error);
      return false;
    }
  }

  /**
   * Check if user owns a resource (session, etc.)
   */
  static async ownsResource(
    userId: string,
    resourceType: 'session',
    resourceId: string
  ): Promise<boolean> {
    try {
      switch (resourceType) {
        case 'session':
          const { data: session, error } = await supabase
            .from('sessions')
            .select('user_id')
            .eq('id', resourceId)
            .single();

          if (error || !session) {
            return false;
          }

          return session.user_id === userId;

        default:
          return false;
      }
    } catch (error) {
      console.error('Resource ownership check error:', error);
      return false;
    }
  }

  /**
   * Check if user can access a session (owner or participant)
   */
  static async canAccessSession(userId: string, sessionId: string): Promise<boolean> {
    try {
      // Check if user owns the session
      const ownsSession = await this.ownsResource(userId, 'session', sessionId);
      if (ownsSession) {
        return true;
      }

      // Check if user is a participant in group session
      const { data: participation, error } = await supabase
        .from('session_participants')
        .select('user_id')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .single();

      if (error || !participation) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Session access check error:', error);
      return false;
    }
  }

  /**
   * Get user's session limits based on subscription
   */
  static async getSessionLimits(userId: string): Promise<{
    maxSessions: number;
    currentSessions: number;
    remainingSessions: number;
  }> {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('subscription_tier, is_admin')
        .eq('user_id', userId)
        .single();

      if (error || !user) {
        throw new Error('User not found');
      }

      // Determine max sessions based on tier
      const maxSessions = user.is_admin 
        ? 999999 
        : (user.subscription_tier === 'pro' ? 999999 : 3);

      // Get current session count
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('id')
        .eq('user_id', userId);

      if (sessionsError) {
        throw new Error('Failed to get session count');
      }

      const currentSessions = sessions?.length || 0;
      const remainingSessions = Math.max(0, maxSessions - currentSessions);

      return {
        maxSessions,
        currentSessions,
        remainingSessions,
      };
    } catch (error) {
      console.error('Session limits check error:', error);
      throw error;
    }
  }

  /**
   * Validate API key format (for admin operations)
   */
  static validateAPIKey(provider: string, apiKey: string): boolean {
    switch (provider) {
      case 'openai':
        return apiKey.startsWith('sk-') && apiKey.length > 20;
      case 'anthropic':
        return apiKey.startsWith('sk-ant-') && apiKey.length > 20;
      case 'perplexity':
        return apiKey.startsWith('pplx-') && apiKey.length > 20;
      default:
        return false;
    }
  }

  /**
   * Get user statistics for admin dashboard
   */
  static async getUserStats(userId: string) {
    try {
      const results: any[] = await Promise.all([
        supabase
          .from('users')
          .select('subscription_tier, is_admin, created_at')
          .eq('user_id', userId)
          .single(),
        supabase
          .from('therapy_sessions')
          .select('session_id, created_at, last_message_at')
          .eq('user_id', userId),
        supabase
          .from('session_messages')
          .select('message_id, timestamp')
          .eq('user_id', userId),
        supabase
          .from('api_logs')
          .select('created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
      ]);

      const [
        { data: user, error: userError },
        { data: sessions, error: sessionsError },
        { data: messages, error: messagesError },
        { data: lastActivity, error: activityError }
      ] = results;

      if (userError) {
        throw new Error('User not found');
      }

      return {
        user: user,
        totalSessions: sessions?.length || 0,
        totalMessages: messages?.length || 0,
        lastActivity: lastActivity?.[0]?.created_at || null,
        avgSessionLength: sessions?.length ? 
          sessions.reduce((acc: number, s: any) => {
            const start = new Date(s.created_at);
            const end = s.last_message_at ? new Date(s.last_message_at) : new Date();
            return acc + (end.getTime() - start.getTime());
          }, 0) / sessions.length : 0,
      };
    } catch (error) {
      console.error('Failed to get user stats:', error);
      throw error;
    }
  }
}
