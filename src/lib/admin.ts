import { createClient } from '@/lib/supabase/client';

export async function isAdmin(): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return false;
    }

    // Check if user is admin from database
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('is_admin')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return false;
    }

    return userProfile?.is_admin || false;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

export async function requireAdmin(): Promise<boolean> {
  const admin = await isAdmin();
  if (!admin) {
    // Redirect to dashboard if not admin
    if (typeof window !== 'undefined') {
      window.location.href = '/dashboard';
    }
    return false;
  }
  return true;
}
