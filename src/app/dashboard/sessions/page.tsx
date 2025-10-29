'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, MessageCircle, Clock, Users, Crown, Lock, Edit2, Trash2, MoreVertical } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { WellnessSession } from '@/types';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<WellnessSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [userSubscription, setUserSubscription] = useState<'free' | 'pro'>('free');
  const [sessionCount, setSessionCount] = useState(0);
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [deletingSession, setDeletingSession] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchSessions();
    fetchUserSubscription();
  }, []);

  const fetchSessions = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error('Authentication error:', authError);
        setLoading(false);
        return;
      }
      
      if (!user || !user.id) {
        console.error('No user or user ID found');
        setLoading(false);
        return;
      }

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
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error('Authentication error in fetchUserSubscription:', authError);
        return;
      }
      
      if (!user || !user.id) {
        console.error('No user or user ID found in fetchUserSubscription');
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('subscription_tier')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user subscription:', error);
      } else if (data) {
        setUserSubscription(data.subscription_tier as 'free' | 'pro');
      }
    } catch (error) {
      console.error('Error fetching user subscription:', error);
    }
  };

  const createNewSession = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error('Authentication error in createNewSession:', authError);
        return;
      }
      
      if (!user || !user.id) {
        console.error('No user or user ID found in createNewSession');
        return;
      }

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
        } else if (result.requiresIntroduction) {
          // Redirect to introduction session
          window.location.href = `/dashboard/chat/${result.introductionSessionId}`;
        } else {
          console.error('Error creating session:', result.error);
          alert('Failed to create session. Please try again.');
        }
        return;
      }

      if (result.success) {
        if (result.isIntroductionSession) {
          // Show special message for introduction session
          alert('Welcome! Please complete your introduction session first. This will help us understand your goals and create a personalized experience for you.');
        }
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

  const startEditing = (session: WellnessSession) => {
    setEditingSession(session.session_id);
    setEditTitle(session.title);
    setEditSummary(session.session_summary || '');
  };

  const cancelEditing = () => {
    setEditingSession(null);
    setEditTitle('');
    setEditSummary('');
  };

  const saveSession = async (sessionId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Not authenticated');
        return;
      }

      const response = await fetch('/api/sessions/update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          sessionId,
          title: editTitle,
          summary: editSummary,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Error updating session:', result.error);
        alert('Failed to update session. Please try again.');
        return;
      }

      if (result.success) {
        // Update the session in the local state
        setSessions(prev => prev.map(s => 
          s.session_id === sessionId 
            ? { ...s, title: editTitle, session_summary: editSummary }
            : s
        ));
        cancelEditing();
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to update session. Please try again.');
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingSession(sessionId);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Not authenticated');
        return;
      }

      const response = await fetch('/api/sessions/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ sessionId }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Error deleting session:', result.error);
        alert('Failed to delete session. Please try again.');
        return;
      }

      if (result.success) {
        // Remove the session from the local state
        setSessions(prev => prev.filter(s => s.session_id !== sessionId));
        setSessionCount(prev => prev - 1);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to delete session. Please try again.');
    } finally {
      setDeletingSession(null);
    }
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
                  {editingSession === session.session_id ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="text-lg font-semibold bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none focus:border-blue-500 dark:text-white"
                      placeholder="Session title"
                    />
                  ) : (
                    <CardTitle className="text-lg">{session.title}</CardTitle>
                  )}
                  <div className="flex items-center space-x-2">
                    {session.is_group && (
                      <Users className="h-4 w-4 text-blue-600" />
                    )}
                    {editingSession !== session.session_id && (
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditing(session)}
                          className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteSession(session.session_id)}
                          disabled={deletingSession === session.session_id}
                          className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400"
                        >
                          {deletingSession === session.session_id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <CardDescription>
                  {session.session_type === 'introduction' 
                    ? 'Introduction Session' 
                    : session.is_group 
                      ? 'Group Session' 
                      : 'Individual Session'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Clock className="h-4 w-4 mr-2" />
                    {formatDate(session.last_message_at)}
                  </div>
                  {editingSession === session.session_id ? (
                    <textarea
                      value={editSummary}
                      onChange={(e) => setEditSummary(e.target.value)}
                      className="w-full text-sm text-gray-700 dark:text-gray-300 bg-transparent border border-gray-300 dark:border-gray-600 rounded p-2 focus:outline-none focus:border-blue-500 resize-none"
                      placeholder="Session summary/description"
                      rows={3}
                    />
                  ) : (
                    session.session_summary && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                        {session.session_summary}
                      </p>
                    )
                  )}
                </div>
                <div className="mt-4 space-y-2">
                  {editingSession === session.session_id ? (
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => saveSession(session.session_id)}
                        size="sm"
                        className="flex-1"
                      >
                        Save
                      </Button>
                      <Button
                        onClick={cancelEditing}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Link href={`/dashboard/chat/${session.session_id}`}>
                      <Button variant="outline" className="w-full">
                        {session.session_type === 'introduction' 
                          ? 'Complete Introduction' 
                          : userSubscription === 'pro' 
                            ? 'Continue Session' 
                            : 'Resume (Pro Only)'
                        }
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
