import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAPISecurity, SecurityConfigs, SecurityContext } from '@/middleware/api-security';
import { InputSanitizer } from '@/lib/security/input-sanitizer';
import { SecureErrorHandler } from '@/lib/security/error-handler';
import { SessionInvalidator } from '@/lib/security/session-invalidator';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handleDeleteAllData(request: NextRequest, context: SecurityContext): Promise<NextResponse> {
  try {
    if (!context.user) {
      return SecureErrorHandler.handleAuthError('User not authenticated');
    }

    const { password, confirmation } = await request.json();

    // Validate required fields
    if (!password || !confirmation) {
      return SecureErrorHandler.handleValidationError('Password and confirmation are required');
    }

    if (confirmation !== 'DELETE ALL MY DATA') {
      return SecureErrorHandler.handleValidationError('Invalid confirmation text');
    }

    // Verify user password
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: context.user.email,
      password: password
    });

    if (authError || !authData.user) {
      return SecureErrorHandler.handleAuthError('Invalid password');
    }

    const userId = context.user.id;

    // Start transaction-like deletion process
    console.log(`Starting complete data deletion for user: ${userId}`);

    // 1. Delete all session messages
    const { error: messagesError } = await supabase
      .from('session_messages')
      .delete()
      .in('session_id', 
        await supabase
          .from('therapy_sessions')
          .select('session_id')
          .eq('user_id', userId)
          .then(res => res.data?.map(s => s.session_id) || [])
      );

    if (messagesError) {
      console.error('Error deleting session messages:', messagesError);
      return SecureErrorHandler.handleAPIError(messagesError, 'Session messages deletion');
    }

    // 2. Delete all therapy sessions
    const { error: sessionsError } = await supabase
      .from('therapy_sessions')
      .delete()
      .eq('user_id', userId);

    if (sessionsError) {
      console.error('Error deleting therapy sessions:', sessionsError);
      return SecureErrorHandler.handleAPIError(sessionsError, 'Therapy sessions deletion');
    }

    // 3. Delete all conversation memory
    const { error: memoryError } = await supabase
      .from('conversation_memory')
      .delete()
      .eq('user_id', userId);

    if (memoryError) {
      console.error('Error deleting conversation memory:', memoryError);
      return SecureErrorHandler.handleAPIError(memoryError, 'Conversation memory deletion');
    }

    // 4. Delete all session participants (for group sessions)
    const { error: participantsError } = await supabase
      .from('session_participants')
      .delete()
      .eq('user_id', userId);

    if (participantsError) {
      console.error('Error deleting session participants:', participantsError);
      return SecureErrorHandler.handleAPIError(participantsError, 'Session participants deletion');
    }

    // 5. Delete all subscriptions
    const { error: subscriptionsError } = await supabase
      .from('subscriptions')
      .delete()
      .eq('user_id', userId);

    if (subscriptionsError) {
      console.error('Error deleting subscriptions:', subscriptionsError);
      return SecureErrorHandler.handleAPIError(subscriptionsError, 'Subscriptions deletion');
    }

    // 6. Reset user data (keep account but clear personal data)
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({
        subscription_tier: 'free',
        is_admin: false,
        last_activity: new Date().toISOString(),
        data_deleted_at: new Date().toISOString(),
        security_alert: 'User requested complete data deletion'
      })
      .eq('user_id', userId);

    if (userUpdateError) {
      console.error('Error updating user data:', userUpdateError);
      return SecureErrorHandler.handleAPIError(userUpdateError, 'User data reset');
    }

    // 7. Log security event
    await SessionInvalidator.forceLogout(userId, 'User requested complete data deletion');

    // 8. Sign out user
    await supabase.auth.signOut();

    console.log(`Complete data deletion successful for user: ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'All your data has been successfully deleted. You have been signed out.',
      deletedAt: new Date().toISOString()
    });

  } catch (error: any) {
    return SecureErrorHandler.handleAPIError(error, 'Complete data deletion');
  }
}

// Export the secured handler
export const POST = withAPISecurity(handleDeleteAllData, SecurityConfigs.GENERAL_API);