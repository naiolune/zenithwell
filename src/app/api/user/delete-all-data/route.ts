import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handleDeleteAllData(request: NextRequest): Promise<NextResponse> {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify the token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const { password, confirmation } = await request.json();

    // Validate required fields
    if (!password || !confirmation) {
      return NextResponse.json(
        { error: 'Password and confirmation are required' },
        { status: 400 }
      );
    }

    if (confirmation !== 'DELETE ALL MY DATA') {
      return NextResponse.json(
        { error: 'Invalid confirmation text' },
        { status: 400 }
      );
    }

    // Verify user password
    const { data: authData, error: passwordError } = await supabase.auth.signInWithPassword({
      email: user.email || '',
      password: password
    });

    if (passwordError || !authData.user) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Start transaction-like deletion process
    console.log(`Starting complete data deletion for user: ${userId}`);

    // 1. Get all session IDs for the user first
    const { data: sessionsData, error: sessionsSelectError } = await supabase
      .from('therapy_sessions')
      .select('session_id')
      .eq('user_id', userId);

    if (sessionsSelectError) {
      console.error('Error fetching therapy sessions:', sessionsSelectError);
      return NextResponse.json(
        { error: 'Failed to fetch therapy sessions' },
        { status: 500 }
      );
    }

    const sessionIds = sessionsData?.map(s => s.session_id) || [];

    // 2. Delete all session messages
    const { error: messagesError } = await supabase
      .from('session_messages')
      .delete()
      .in('session_id', sessionIds);

    if (messagesError) {
      console.error('Error deleting session messages:', messagesError);
      return NextResponse.json(
        { error: 'Failed to delete session messages' },
        { status: 500 }
      );
    }

    // 3. Delete all therapy sessions
    const { error: sessionsError } = await supabase
      .from('therapy_sessions')
      .delete()
      .eq('user_id', userId);

    if (sessionsError) {
      console.error('Error deleting therapy sessions:', sessionsError);
      return NextResponse.json(
        { error: 'Failed to delete therapy sessions' },
        { status: 500 }
      );
    }

    // 4. Delete all conversation memory
    const { error: memoryError } = await supabase
      .from('conversation_memory')
      .delete()
      .eq('user_id', userId);

    if (memoryError) {
      console.error('Error deleting conversation memory:', memoryError);
      return NextResponse.json(
        { error: 'Failed to delete conversation memory' },
        { status: 500 }
      );
    }

    // 5. Delete all session participants (for group sessions)
    const { error: participantsError } = await supabase
      .from('session_participants')
      .delete()
      .eq('user_id', userId);

    if (participantsError) {
      console.error('Error deleting session participants:', participantsError);
      return NextResponse.json(
        { error: 'Failed to delete session participants' },
        { status: 500 }
      );
    }

    // 6. Get current user data to preserve Pro status and admin privileges
    const { data: currentUserData, error: userSelectError } = await supabase
      .from('users')
      .select('subscription_tier, is_admin')
      .eq('user_id', userId)
      .single();

    if (userSelectError) {
      console.error('Error fetching current user data:', userSelectError);
      return NextResponse.json(
        { error: 'Failed to fetch current user data' },
        { status: 500 }
      );
    }

    // 7. Delete all subscriptions (but preserve the user's current tier)
    const { error: subscriptionsError } = await supabase
      .from('subscriptions')
      .delete()
      .eq('user_id', userId);

    if (subscriptionsError) {
      console.error('Error deleting subscriptions:', subscriptionsError);
      return NextResponse.json(
        { error: 'Failed to delete subscriptions' },
        { status: 500 }
      );
    }

    // 8. Reset user data (keep account but clear personal data, preserve Pro status and admin privileges)
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({
        subscription_tier: currentUserData?.subscription_tier || 'free',
        is_admin: currentUserData?.is_admin || false
      })
      .eq('user_id', userId);

    if (userUpdateError) {
      console.error('Error updating user data:', userUpdateError);
      return NextResponse.json(
        { error: 'Failed to reset user data' },
        { status: 500 }
      );
    }

    // 9. Sign out user
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      console.error('Error signing out user:', signOutError);
      // Don't fail the entire operation for sign out errors
    }

    console.log(`Complete data deletion successful for user: ${userId}`);

    // Create conditional message based on user status
    const isPro = currentUserData?.subscription_tier === 'pro';
    const isAdmin = currentUserData?.is_admin || false;
    
    let message = 'All your data has been successfully deleted.';
    if (isPro && isAdmin) {
      message += ' Your Pro subscription status and admin privileges have been preserved.';
    } else if (isPro) {
      message += ' Your Pro subscription status has been preserved.';
    } else if (isAdmin) {
      message += ' Your admin privileges have been preserved.';
    }
    message += ' You have been signed out.';

    return NextResponse.json({
      success: true,
      message: message,
      deletedAt: new Date().toISOString(),
      preservedStatus: {
        subscriptionTier: currentUserData?.subscription_tier || 'free',
        isAdmin: currentUserData?.is_admin || false
      }
    });

  } catch (error: any) {
    console.error('Delete all data error:', error);
    return NextResponse.json(
      { error: 'Internal server error during data deletion' },
      { status: 500 }
    );
  }
}

// Export the handler directly
export const POST = handleDeleteAllData;