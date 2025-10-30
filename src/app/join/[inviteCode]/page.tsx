'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Clock, 
  Shield, 
  XCircle, 
  Sparkles,
  ArrowRight,
  Calendar,
  Crown
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getUserSubscription } from '@/lib/subscription';
import { IntroductionForm, IntroductionFormData } from '@/components/IntroductionForm';
import { GROUP_SESSION_CONFIG, GroupCategory } from '@/lib/group-session-config';

interface InviteData {
  session_id: string;
  title: string;
  group_category: GroupCategory;
  session_status: string;
  expires_at: string;
  max_participants: number;
  current_participants: number;
  is_full: boolean;
  can_join: boolean;
}

export default function JoinSessionPage() {
  const params = useParams();
  const router = useRouter();
  const inviteCode = params.inviteCode as string;
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [showIntroductionForm, setShowIntroductionForm] = useState(false);
  const [isSubmittingIntroduction, setIsSubmittingIntroduction] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadUserData();
    validateInvite();
  }, [inviteCode]);

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { isPro } = await getUserSubscription();
        setIsPro(isPro);
      } else {
        setIsPro(false);
      }
    } catch (error) {
      setIsPro(false);
    }
  };

  const validateInvite = async () => {
    try {
      const response = await fetch(`/api/group/invite?code=${inviteCode}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setInviteData(null);
        } else {
          throw new Error('Failed to validate invite');
        }
        return;
      }

      const data = await response.json();
      console.log('Invite data received:', data);
      console.log('Group category from API:', data.group_category);
      setInviteData(data);
    } catch (error) {
      console.error('Error validating invite:', error);
      setInviteData(null);
    } finally {
      setLoading(false);
    }
  };

  const joinSession = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      localStorage.setItem('pendingInviteCode', inviteCode);
      router.push(`/login?return=join`);
      return;
    }

    const { data: existingParticipant, error: participantError } = await supabase
      .from('session_participants')
      .select('*')
      .eq('session_id', inviteData!.session_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (participantError && participantError.code !== 'PGRST116') {
      console.error('Error checking participant status:', participantError);
    }

    if (existingParticipant) {
      router.push(`/dashboard/group/${inviteData!.session_id}`);
      return;
    }

    const { data: existingIntroduction, error: introError } = await supabase
      .from('participant_introductions')
      .select('*')
      .eq('session_id', inviteData!.session_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (introError && introError.code !== 'PGRST116') {
      console.error('Error checking introduction status:', introError);
    }

    if (existingIntroduction) {
      await addToSession();
    } else {
      setShowIntroductionForm(true);
    }
  };

  const addToSession = async () => {
    setJoining(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const response = await fetch('/api/group/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inviteCode: inviteCode,
          sessionId: inviteData!.session_id
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Error joining session:', data);
        alert(data.error || 'Failed to join session. Please try again.');
      } else {
        router.push(`/dashboard/group/${inviteData!.session_id}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to join session. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const handleIntroductionSubmit = async (introductionData: IntroductionFormData) => {
    setIsSubmittingIntroduction(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const response = await fetch('/api/group/introduction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: inviteData!.session_id,
          groupCategory: inviteData!.group_category,
          relationshipRole: introductionData.relationshipRole,
          whyWellness: introductionData.whyWellness,
          goals: introductionData.goals,
          challenges: introductionData.challenges,
          familyRole: introductionData.familyRole,
          familyGoals: introductionData.familyGoals,
          whatToAchieve: introductionData.whatToAchieve,
          participantRole: introductionData.participantRole,
          wellnessReason: introductionData.wellnessReason,
          personalGoals: introductionData.personalGoals,
          expectations: introductionData.expectations
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Error saving introduction:', data);
        alert(data.error || 'Failed to save introduction. Please try again.');
        return;
      }

      await addToSession();
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to submit introduction. Please try again.');
    } finally {
      setIsSubmittingIntroduction(false);
    }
  };

  const formatExpiration = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();

    if (diff <= 0) return 'Expired';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const getCategoryDisplay = (category: GroupCategory | string | null | undefined): string => {
    if (!category) {
      console.warn('Category is null or undefined');
      return 'General';
    }
    
    // Normalize category to lowercase string for comparison
    const normalizedCategory = String(category).toLowerCase().trim();
    
    console.log('getCategoryDisplay - received category:', category, 'normalized:', normalizedCategory);
    
    if (normalizedCategory === 'relationship') {
      return 'Relationship';
    }
    if (normalizedCategory === 'family') {
      return 'Family';
    }
    if (normalizedCategory === 'general') {
      return 'General';
    }
    
    // Fallback - check what we actually received
    console.warn('Unknown category value:', category, 'normalized:', normalizedCategory);
    return 'General';
  };

  const getCategoryBadge = (category: GroupCategory) => {
    const badges = {
      [GROUP_SESSION_CONFIG.GROUP_CATEGORIES.RELATIONSHIP]: { 
        label: 'Relationship', 
        color: 'bg-pink-100 text-pink-800 border-pink-200' 
      },
      [GROUP_SESSION_CONFIG.GROUP_CATEGORIES.FAMILY]: { 
        label: 'Family', 
        color: 'bg-blue-100 text-blue-800 border-blue-200' 
      },
      [GROUP_SESSION_CONFIG.GROUP_CATEGORIES.GENERAL]: { 
        label: 'General', 
        color: 'bg-purple-100 text-purple-800 border-purple-200' 
      }
    };
    return badges[category] || badges[GROUP_SESSION_CONFIG.GROUP_CATEGORIES.GENERAL];
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-white border-t-transparent mx-auto"></div>
          <p className="text-white font-medium text-lg">Loading invite details...</p>
        </div>
      </div>
    );
  }

  if (!inviteData) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-2 border-red-300 shadow-2xl bg-white">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-red-100 p-4">
                <XCircle className="h-12 w-12 text-red-600" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold text-gray-900">Invalid Invite</CardTitle>
            <CardDescription className="text-base mt-2">
              This invite link is invalid, expired, or has been revoked.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={() => router.push('/')} 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12 text-base font-semibold"
            >
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showIntroductionForm) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold text-white mb-2">Welcome to the Session</h1>
            <p className="text-indigo-200">Please introduce yourself to help create a meaningful experience</p>
          </div>
          <Card className="bg-white shadow-2xl">
            <CardContent className="p-6">
              <IntroductionForm
                groupCategory={inviteData.group_category}
                sessionId={inviteData.session_id}
                onSubmit={handleIntroductionSubmit}
                isLoading={isSubmittingIntroduction}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const badge = getCategoryBadge(inviteData.group_category);
  const categoryDisplay = getCategoryDisplay(inviteData.group_category);
  const isExpired = new Date(inviteData.expires_at) < new Date();

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm mb-4">
            <Sparkles className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">You're Invited!</h1>
          <p className="text-lg text-indigo-200">Join a wellness session and start your journey</p>
        </div>

        {/* Main Card */}
        <Card className="border-2 border-white/20 shadow-2xl bg-white overflow-hidden">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
            <div className="flex items-start justify-between mb-4">
              <Badge className={`${badge.color} border`}>
                {badge.label}
              </Badge>
              {isPro && (
                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                  <Crown className="h-3 w-3 mr-1 inline" />
                  Pro
                </Badge>
              )}
            </div>
            <h2 className="text-2xl font-bold mb-2">{inviteData.title}</h2>
            <p className="text-indigo-100 text-sm">
              {categoryDisplay} Wellness Session
            </p>
          </div>

          <CardContent className="p-6 space-y-6">
            {/* Session Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0">
                  <Users className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Participants</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {inviteData.current_participants} / {inviteData.max_participants}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0">
                  <Clock className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Expires In</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatExpiration(inviteData.expires_at)}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0">
                  <Calendar className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <p className="text-lg font-semibold text-gray-900 capitalize">
                    {inviteData.session_status}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0">
                  <Shield className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Security</p>
                  <p className="text-lg font-semibold text-gray-900">Secure</p>
                </div>
              </div>
            </div>

            {/* Status Messages */}
            {inviteData.is_full && (
              <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-900">Session Full</p>
                    <p className="text-sm text-red-700 mt-1">
                      This session has reached its maximum capacity. Please contact the session organizer for more information.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!inviteData.can_join && !inviteData.is_full && (
              <div className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Clock className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-yellow-900">Session Not Ready</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      This session is not yet ready for new participants. Please check back later.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isExpired && (
              <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-900">Invite Expired</p>
                    <p className="text-sm text-red-700 mt-1">
                      This invite link has expired. Please request a new invite from the session organizer.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Button */}
            {inviteData.can_join && !inviteData.is_full && !isExpired && (
              <div className="space-y-4 pt-4">
                <Button
                  onClick={joinSession}
                  disabled={joining}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white h-14 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  {joining ? (
                    <span className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                      Joining Session...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center">
                      Join Session
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </span>
                  )}
                </Button>

                <div className="text-center">
                  <p className="text-sm text-gray-600">
                    Don't have an account?{' '}
                    <Button
                      variant="link"
                      onClick={() => router.push('/signup')}
                      className="p-0 h-auto text-indigo-600 hover:text-indigo-700 font-semibold"
                    >
                      Sign up here
                    </Button>
                  </p>
                </div>
              </div>
            )}

            {/* Footer Info */}
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center justify-center space-x-2 text-xs text-gray-500">
                <Shield className="h-4 w-4" />
                <span>Your data is encrypted and secure</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
