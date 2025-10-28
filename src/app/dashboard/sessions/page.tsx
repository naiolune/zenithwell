'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, MessageCircle, Clock, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { TherapySession } from '@/types';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<TherapySession[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchSessions();
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
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNewSession = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('therapy_sessions')
        .insert({
          user_id: user.id,
          title: 'New Individual Session',
          is_group: false,
          session_type: 'individual',
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating session:', error);
      } else {
        window.location.href = `/dashboard/chat/${data.session_id}`;
      }
    } catch (error) {
      console.error('Error:', error);
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
          <span>New Session</span>
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
                      Continue Session
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
