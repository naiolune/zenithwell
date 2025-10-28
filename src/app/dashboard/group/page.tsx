'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, Users, Crown, Clock, Heart, Home, Users2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getUserSubscription, canAccessProFeature } from '@/lib/subscription';
import { TherapySession } from '@/types';

export default function GroupSessionsPage() {
  const [sessions, setSessions] = useState<TherapySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedSessionType, setSelectedSessionType] = useState<'relationship' | 'family' | 'general'>('general');
  const supabase = createClient();

  useEffect(() => {
    loadUserData();
    fetchGroupSessions();
  }, []);

  const loadUserData = async () => {
    const { isPro } = await getUserSubscription();
    setIsPro(isPro);
  };

  const fetchGroupSessions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('therapy_sessions')
        .select('*')
        .eq('is_group', true)
        .order('last_message_at', { ascending: false });

      if (error) {
        console.error('Error fetching group sessions:', error);
      } else {
        setSessions(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const createGroupSession = async () => {
    if (!canAccessProFeature(isPro, 'group_sessions')) {
      alert('Group sessions are only available with a Pro subscription. Please upgrade to continue.');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const sessionTypeLabels = {
        relationship: 'Relationship Session',
        family: 'Family Session', 
        general: 'General Group Session'
      };

      const { data, error } = await supabase
        .from('therapy_sessions')
        .insert({
          user_id: user.id,
          title: sessionTypeLabels[selectedSessionType],
          is_group: true,
          session_type: selectedSessionType,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating group session:', error);
        alert('Failed to create group session. Please try again.');
      } else {
        // Add the creator as the owner
        await supabase
          .from('session_participants')
          .insert({
            session_id: data.session_id,
            user_id: user.id,
            role: 'owner',
          });

        setShowCreateDialog(false);
        window.location.href = `/dashboard/group/${data.session_id}`;
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to create group session. Please try again.');
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Group Wellness</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Create and join group wellness sessions with family and friends
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button 
              className="flex items-center space-x-2"
              disabled={!isPro}
            >
              <Plus className="h-4 w-4" />
              <span>New Group Session</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Group Session</DialogTitle>
              <DialogDescription>
                Choose the type of group session you'd like to create
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-3">
                <Label className="text-base font-medium">Session Type</Label>
                <RadioGroup 
                  value={selectedSessionType} 
                  onValueChange={(value: 'relationship' | 'family' | 'general') => setSelectedSessionType(value)}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="relationship" id="relationship" />
                    <Label htmlFor="relationship" className="flex items-center space-x-2 cursor-pointer">
                      <Heart className="h-4 w-4 text-pink-500" />
                      <div>
                        <div className="font-medium">Relationship</div>
                        <div className="text-sm text-gray-500">Couples working on communication and connection</div>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="family" id="family" />
                    <Label htmlFor="family" className="flex items-center space-x-2 cursor-pointer">
                      <Home className="h-4 w-4 text-blue-500" />
                      <div>
                        <div className="font-medium">Family</div>
                        <div className="text-sm text-gray-500">Family members working through challenges together</div>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="general" id="general" />
                    <Label htmlFor="general" className="flex items-center space-x-2 cursor-pointer">
                      <Users2 className="h-4 w-4 text-green-500" />
                      <div>
                        <div className="font-medium">General Group</div>
                        <div className="text-sm text-gray-500">Friends or peers supporting each other</div>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={createGroupSession}>
                  Create Session
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!isPro && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Crown className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">Pro Feature</p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Group wellness sessions are only available with a Pro subscription. 
                  <Link href="/dashboard/settings" className="underline ml-1">
                    Upgrade now
                  </Link>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {sessions.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No group sessions yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Create your first group session to start collaborative wellness
            </p>
            <Button 
              onClick={() => setShowCreateDialog(true)}
              disabled={!isPro}
            >
              Create Group Session
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
                  <Users className="h-4 w-4 text-blue-600" />
                </div>
                <CardDescription>
                  Group Session
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="h-4 w-4 mr-2" />
                    {formatDate(session.last_message_at)}
                  </div>
                  {session.session_summary && (
                    <p className="text-sm text-gray-700 line-clamp-3">
                      {session.session_summary}
                    </p>
                  )}
                </div>
                <div className="mt-4">
                  <Link href={`/dashboard/group/${session.session_id}`}>
                    <Button variant="outline" className="w-full">
                      Join Session
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
