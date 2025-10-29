import { createClient } from '@/lib/supabase/client';
import { User } from '@/types';

export async function getUserSubscription(): Promise<{ user: User | null; isPro: boolean; isAdmin: boolean }> {
  const supabase = createClient();
  
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('Authentication error in getUserSubscription:', authError);
      return { user: null, isPro: false, isAdmin: false };
    }
    
    if (!user || !user.id) {
      console.error('No user or user ID found in getUserSubscription');
      return { user: null, isPro: false, isAdmin: false };
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (userError) {
      console.error('Error fetching user data:', userError);
      return { user: null, isPro: false, isAdmin: false };
    }

    return {
      user: userData,
      isPro: userData?.subscription_tier === 'pro',
      isAdmin: userData?.is_admin || false
    };
  } catch (error) {
    console.error('Error in getUserSubscription:', error);
    return { user: null, isPro: false, isAdmin: false };
  }
}

export function canAccessProFeature(isPro: boolean, feature: string): boolean {
  const proFeatures = [
    'group_sessions',
    'unlimited_sessions',
    'session_export',
    'advanced_analytics',
    'priority_support'
  ];

  if (proFeatures.includes(feature)) {
    return isPro;
  }

  return true; // Free features are always accessible
}
