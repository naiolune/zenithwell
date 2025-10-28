import { createClient } from '@/lib/supabase/client';
import { User } from '@/types';

export async function getUserSubscription(): Promise<{ user: User | null; isPro: boolean }> {
  const supabase = createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { user: null, isPro: false };
  }

  const { data: userData } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return {
    user: userData,
    isPro: userData?.subscription_tier === 'pro'
  };
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
