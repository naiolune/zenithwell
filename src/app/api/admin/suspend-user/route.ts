import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAPISecurity, SecurityConfigs, SecurityContext } from '@/middleware/api-security';
import { InputSanitizer } from '@/lib/security/input-sanitizer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handleSuspendUser(request: NextRequest, context: SecurityContext): Promise<NextResponse> {
  try {
    const { userId, action, reason, notes } = await request.json();

    if (!context.user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    if (!userId || !action) {
      return NextResponse.json({ error: 'userId and action are required' }, { status: 400 });
    }

    // Validate action
    if (!['suspend', 'unsuspend'].includes(action)) {
      return NextResponse.json({ error: 'action must be "suspend" or "unsuspend"' }, { status: 400 });
    }

    // Validate userId
    if (!InputSanitizer.validateSessionId(userId)) {
      return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
    }

    // Check if current user is admin
    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('user_id', context.user.id)
      .single();

    if (userError || !currentUser?.is_admin) {
      return NextResponse.json({ error: 'Admin privileges required' }, { status: 403 });
    }

    // Check if target user exists
    const { data: targetUser, error: targetError } = await supabase
      .from('users')
      .select('user_id, email, is_suspended')
      .eq('user_id', userId)
      .single();

    if (targetError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent suspending other admins
    if (action === 'suspend') {
      const { data: targetUserDetails } = await supabase
        .from('users')
        .select('is_admin')
        .eq('user_id', userId)
        .single();

      if (targetUserDetails?.is_admin) {
        return NextResponse.json({ error: 'Cannot suspend admin users' }, { status: 403 });
      }
    }

    // Validate reason for suspension
    if (action === 'suspend' && (!reason || reason.trim().length === 0)) {
      return NextResponse.json({ error: 'Suspension reason is required' }, { status: 400 });
    }

    if (reason && reason.length > 500) {
      return NextResponse.json({ error: 'Reason must be 500 characters or less' }, { status: 400 });
    }

    if (notes && notes.length > 1000) {
      return NextResponse.json({ error: 'Notes must be 1000 characters or less' }, { status: 400 });
    }

    // Update user suspension status
    const updateData: any = {
      is_suspended: action === 'suspend',
      suspended_at: action === 'suspend' ? new Date().toISOString() : null,
      suspended_by: action === 'suspend' ? context.user.id : null,
      suspension_reason: action === 'suspend' ? reason : null,
      suspension_notes: action === 'suspend' ? notes : null
    };

    const { error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating user suspension:', updateError);
      return NextResponse.json({ error: 'Failed to update user suspension status' }, { status: 500 });
    }

    // If suspending, also lock all active sessions for this user
    if (action === 'suspend') {
      const { error: lockError } = await supabase
        .from('therapy_sessions')
        .update({
          is_locked: true,
          locked_at: new Date().toISOString(),
          locked_by: 'admin',
          lock_reason: 'account_suspended',
          can_unlock: false
        })
        .eq('user_id', userId)
        .eq('is_locked', false);

      if (lockError) {
        console.error('Error locking user sessions:', lockError);
        // Don't fail the request, suspension was successful
      }
    }

    return NextResponse.json({
      success: true,
      message: `User ${action === 'suspend' ? 'suspended' : 'unsuspended'} successfully`,
      user: {
        user_id: targetUser.user_id,
        email: targetUser.email,
        is_suspended: action === 'suspend'
      }
    });

  } catch (error: any) {
    console.error('Suspend user error:', error);
    return NextResponse.json({ 
      error: 'Failed to update user suspension status' 
    }, { status: 500 });
  }
}

// Export the secured handler
export const POST = withAPISecurity(handleSuspendUser, SecurityConfigs.ADMIN_API);
