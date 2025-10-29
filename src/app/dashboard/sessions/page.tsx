'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, MessageCircle, Clock, Users, Crown, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { WellnessSession } from '@/types';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<WellnessSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [userSubscription, setUserSubscription] = useState<'free' | 'pro'>('free');
  const [sessionCount, setSessionCount] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    fetchSessions();
    fetchUserSubscription();
  }, []);

  const fetchSessions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('therapy_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('last_message_at', { ascending: false });

      if (error) {
        console.error('Error fetching sessions:', error);
      } else {
        setSessions(data || []);
        setSessionCount(data?.length || 0);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('users')
        .select('subscription_tier')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setUserSubscription(data.subscription_tier as 'free' | 'pro');
      }
    } catch (error) {
      console.error('Error fetching user subscription:', error);
    }
  };

  const createNewSession = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get session token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No session token available');
        return;
      }

      // Call server-side session creation API
      const response = await fetch('/api/sessions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: 'New Individual Session',
          isGroup: false,
          sessionType: 'individual'
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.sessionLimitExceeded) {
          alert(result.message);
        } else {
          console.error('Error creating session:', result.error);
          alert('Failed to create session. Please try again.');
        }
        return;
      }

      if (result.success) {
        window.location.href = `/dashboard/chat/${result.session.session_id}`;
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to create session. Please try again.');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Wellness Sessions</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage your AI wellness sessions and track your progress
          </p>
        </div>
        <Button onClick={createNewSession} className="flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>{userSubscription === 'free' && sessionCount >= 3 ? 'Session Limit Reached' : 'New Session'}</span>
        </Button>
      </div>

      {sessions.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No sessions yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Start your first wellness session to begin your wellness journey
            </p>
            <Button onClick={createNewSession}>
              Create Your First Session
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <Card key={session.session_id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{session.title}</CardTitle>
                  {session.is_group && (
                    <Users className="h-4 w-4 text-blue-600" />
                  )}
                </div>
                <CardDescription>
                  {session.is_group ? 'Group Session' : 'Individual Session'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Clock className="h-4 w-4 mr-2" />
                    {formatDate(session.last_message_at)}
                  </div>
                  {session.session_summary && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                      {session.session_summary}
                    </p>
                  )}
                </div>
                <div className="mt-4">
                  <Link href={`/dashboard/chat/${session.session_id}`}>
                    <Button variant="outline" className="w-full">
                      {userSubscription === 'pro' ? 'Continue Session' : 'Resume (Pro Only)'}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
