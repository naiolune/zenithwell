'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, Users, Crown, Clock, Shield } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getUserSubscription, canAccessProFeature } from '@/lib/subscription';
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
    const { isPro } = await getUserSubscription();
    setIsPro(isPro);
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
      setInviteData(data);
    } catch (error) {
      console.error('Error validating invite:', error);
      setInviteData(null);
    } finally {
      setLoading(false);
    }
  };

  const joinSession = async () => {
    if (!canAccessProFeature(isPro, 'group_sessions')) {
      // Store invite code for redirect after login/upgrade
      localStorage.setItem('pendingInviteCode', inviteCode);
      alert('Group sessions are only available with a Pro subscription. Please upgrade to continue.');
      router.push('/dashboard/settings');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // Store invite code for redirect after login
      localStorage.setItem('pendingInviteCode', inviteCode);
      router.push(`/login?return=join`);
      return;
    }

    // Check if user is already a participant
    const { data: existingParticipant } = await supabase
      .from('session_participants')
      .select('*')
      .eq('session_id', inviteData!.session_id)
      .eq('user_id', user.id)
      .single();

    if (existingParticipant) {
      // User is already a participant, redirect to session
      router.push(`/dashboard/group/${inviteData!.session_id}`);
      return;
    }

    // Check if user has already submitted introduction
    const { data: existingIntroduction } = await supabase
      .from('participant_introductions')
      .select('*')
      .eq('session_id', inviteData!.session_id)
      .eq('user_id', user.id)
      .single();

    if (existingIntroduction) {
      // User has already submitted introduction, add to session
      await addToSession();
    } else {
      // Show introduction form
      setShowIntroductionForm(true);
    }
  };

  const addToSession = async () => {
    setJoining(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Add user as participant
      const { error } = await supabase
        .from('session_participants')
        .insert({
          session_id: inviteData!.session_id,
          user_id: user.id,
          role: 'participant',
          is_ready: false
        });

      if (error) {
        console.error('Error joining session:', error);
        alert('Failed to join session. Please try again.');
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

      // Submit introduction
      const { error: introError } = await supabase
        .from('participant_introductions')
        .insert({
          session_id: inviteData!.session_id,
          user_id: user.id,
          group_category: inviteData!.group_category,
          ...introductionData
        });

      if (introError) {
        console.error('Error saving introduction:', introError);
        alert('Failed to save introduction. Please try again.');
        return;
      }

      // Add user to session
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
      return `${hours}h ${minutes}m remaining`;
    } else {
      return `${minutes}m remaining`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!inviteData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Brain className="h-12 w-12 text-red-600" />
            </div>
            <CardTitle className="text-2xl">Invalid Invite</CardTitle>
            <CardDescription>
              This invite link is invalid, expired, or has been revoked.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => router.push('/')}>
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showIntroductionForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <IntroductionForm
            groupCategory={inviteData.group_category}
            sessionId={inviteData.session_id}
            onSubmit={handleIntroductionSubmit}
            isLoading={isSubmittingIntroduction}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Users className="h-12 w-12 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Join Group Session</CardTitle>
          <CardDescription>
            You've been invited to join a group wellness session
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <h3 className="font-semibold text-lg">{inviteData.title}</h3>
            <p className="text-sm text-gray-600 mt-1 capitalize">
              {inviteData.group_category} Wellness Session
            </p>
          </div>

          {/* Session Info */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Participants:</span>
              <span className="font-medium">
                {inviteData.current_participants}/{inviteData.max_participants}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Status:</span>
              <span className="font-medium capitalize">{inviteData.session_status}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Expires:</span>
              <span className="font-medium">{formatExpiration(inviteData.expires_at)}</span>
            </div>
          </div>

          {/* Status Messages */}
          {inviteData.is_full && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-red-600" />
                <div>
                  <p className="font-medium text-red-800">Session Full</p>
                  <p className="text-sm text-red-700">
                    This session has reached its maximum capacity.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!inviteData.can_join && !inviteData.is_full && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-800">Session Not Ready</p>
                  <p className="text-sm text-yellow-700">
                    This session is not yet ready for new participants.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!isPro && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Crown className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-800">Pro Feature Required</p>
                  <p className="text-sm text-amber-700">
                    Group sessions are only available with a Pro subscription.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Button
              onClick={joinSession}
              disabled={joining || !isPro || !inviteData.can_join || inviteData.is_full}
              className="w-full"
            >
              {joining ? 'Joining...' : 'Join Session'}
            </Button>
            
            {!isPro && (
              <Button
                variant="outline"
                onClick={() => router.push('/dashboard/settings')}
                className="w-full"
              >
                Upgrade to Pro
              </Button>
            )}
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Button
                variant="link"
                onClick={() => router.push('/signup')}
                className="p-0 h-auto"
              >
                Sign up
              </Button>
            </p>
          </div>

          <div className="flex items-center justify-center space-x-2 text-xs text-gray-500">
            <Shield className="h-3 w-3" />
            <span>Secure invite link</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
