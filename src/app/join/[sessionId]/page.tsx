'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, Users, Crown } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getUserSubscription, canAccessProFeature } from '@/lib/subscription';

export default function JoinSessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadUserData();
    fetchSession();
  }, [sessionId]);

  const loadUserData = async () => {
    const { isPro } = await getUserSubscription();
    setIsPro(isPro);
  };

  const fetchSession = async () => {
    try {
      const { data, error } = await supabase
        .from('therapy_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .eq('is_group', true)
        .single();

      if (error) {
        console.error('Error fetching session:', error);
        setSession(null);
      } else {
        setSession(data);
      }
    } catch (error) {
      console.error('Error:', error);
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  const joinSession = async () => {
    if (!canAccessProFeature(isPro, 'group_sessions')) {
      alert('Group sessions are only available with a Pro subscription. Please upgrade to continue.');
      router.push('/dashboard/settings');
      return;
    }

    setJoining(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Check if user is already a participant
      const { data: existingParticipant } = await supabase
        .from('session_participants')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .single();

      if (existingParticipant) {
        // User is already a participant, redirect to session
        router.push(`/dashboard/group/${sessionId}`);
        return;
      }

      // Add user as participant
      const { error } = await supabase
        .from('session_participants')
        .insert({
          session_id: sessionId,
          user_id: user.id,
          role: 'participant',
        });

      if (error) {
        console.error('Error joining session:', error);
        alert('Failed to join session. Please try again.');
      } else {
        router.push(`/dashboard/group/${sessionId}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to join session. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Brain className="h-12 w-12 text-red-600" />
            </div>
            <CardTitle className="text-2xl">Session Not Found</CardTitle>
            <CardDescription>
              The group session you're looking for doesn't exist or has been removed.
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
            <h3 className="font-semibold text-lg">{session.title}</h3>
            <p className="text-sm text-gray-600 mt-1">
              Group Wellness Session
            </p>
          </div>

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
              disabled={joining || !isPro}
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
        </CardContent>
      </Card>
    </div>
  );
}
