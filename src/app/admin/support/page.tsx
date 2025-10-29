'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Users, 
  Crown, 
  Search, 
  Mail, 
  Calendar, 
  Shield, 
  CheckCircle, 
  XCircle,
  Eye,
  UserPlus,
  UserMinus,
  MessageCircle,
  Clock,
  Activity,
  TrendingUp,
  BarChart3,
  Database,
  Lock,
  Unlock,
  Flag,
  AlertTriangle,
  FileText,
  Settings
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { User, WellnessSession, SessionFlag, UserPreference, AISessionNote } from '@/types';

interface UserStats {
  totalSessions: number;
  totalMessages: number;
  lastActivity: string | null;
  avgSessionLength: number;
  groupSessions: number;
  individualSessions: number;
}

export default function AdminSupportPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [userStats, setUserStats] = useState<Record<string, UserStats>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [updating, setUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'sessions'>('users');
  const [sessions, setSessions] = useState<WellnessSession[]>([]);
  const [sessionFlags, setSessionFlags] = useState<SessionFlag[]>([]);
  const [userPreferences, setUserPreferences] = useState<Record<string, UserPreference[]>>({});
  const [aiNotes, setAiNotes] = useState<Record<string, AISessionNote[]>>({});
  const [suspending, setSuspending] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [selectedUserForSuspension, setSelectedUserForSuspension] = useState<User | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendNotes, setSuspendNotes] = useState('');
  const supabase = createClient();

  useEffect(() => {
    fetchUsers();
    if (activeTab === 'sessions') {
      fetchSessions();
      fetchSessionFlags();
    }
  }, [activeTab]);

  useEffect(() => {
    filterUsers();
  }, [searchTerm, users]);

  const fetchUsers = async () => {
    try {
      // Check admin status first
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error('Authentication error in fetchUsers:', authError);
        return;
      }
      
      if (!user || !user.id) {
        console.error('User not authenticated or no user ID found');
        return;
      }

      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('is_admin')
        .eq('user_id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching admin status:', profileError);
        return;
      }

      if (!userProfile?.is_admin) {
        console.error('Admin privileges required to fetch users');
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching users:', error);
      } else {
        setUsers(data || []);
        // Fetch user statistics for each user
        if (data) {
          await fetchUserStats(data);
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserStats = async (userList: User[]) => {
    const stats: Record<string, UserStats> = {};
    
    for (const user of userList) {
      try {
        // Skip users with invalid IDs
        if (!user.user_id || user.user_id === 'undefined') {
          console.warn('Skipping user with invalid ID:', user);
          continue;
        }

        // Get session count and types
        const { data: sessions } = await supabase
          .from('therapy_sessions')
          .select('session_id, is_group, last_message_at')
          .eq('user_id', user.user_id);

        // Get message count
        const { data: messages } = await supabase
          .from('session_messages')
          .select('message_id, timestamp')
          .in('session_id', sessions?.map(s => s.session_id) || []);

        // Calculate statistics
        const totalSessions = sessions?.length || 0;
        const totalMessages = messages?.length || 0;
        const groupSessions = sessions?.filter(s => s.is_group).length || 0;
        const individualSessions = totalSessions - groupSessions;
        
        // Calculate average session length (simplified)
        const avgSessionLength = totalSessions > 0 ? Math.round(totalMessages / totalSessions) : 0;
        
        // Get last activity
        const lastActivity = sessions && sessions.length > 0 
          ? Math.max(...sessions.map(s => new Date(s.last_message_at).getTime()))
          : null;

        stats[user.user_id] = {
          totalSessions,
          totalMessages,
          lastActivity: lastActivity ? new Date(lastActivity).toISOString() : null,
          avgSessionLength,
          groupSessions,
          individualSessions
        };
      } catch (error) {
        console.error(`Error fetching stats for user ${user.user_id}:`, error);
        stats[user.user_id] = {
          totalSessions: 0,
          totalMessages: 0,
          lastActivity: null,
          avgSessionLength: 0,
          groupSessions: 0,
          individualSessions: 0
        };
      }
    }
    
    setUserStats(stats);
  };

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('therapy_sessions')
        .select(`
          *,
          users!therapy_sessions_user_id_fkey(email)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching sessions:', error);
      } else {
        setSessions(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchSessionFlags = async () => {
    try {
      const { data, error } = await supabase
        .from('session_flags')
        .select(`
          *,
          therapy_sessions!session_flags_session_id_fkey(title, session_type),
          users!session_flags_user_id_fkey(email)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching session flags:', error);
      } else {
        setSessionFlags(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchUserPreferences = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user preferences:', error);
      } else {
        setUserPreferences(prev => ({
          ...prev,
          [userId]: data || []
        }));
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchAISessionNotes = async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from('ai_session_notes')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching AI session notes:', error);
      } else {
        setAiNotes(prev => ({
          ...prev,
          [sessionId]: data || []
        }));
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const unlockSession = async (sessionId: string) => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('therapy_sessions')
        .update({
          is_locked: false,
          locked_at: null,
          locked_by: null,
          lock_reason: null,
          can_unlock: true
        })
        .eq('session_id', sessionId);

      if (error) {
        console.error('Error unlocking session:', error);
        alert('Failed to unlock session');
      } else {
        alert('Session unlocked successfully');
        fetchSessions();
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to unlock session');
    } finally {
      setUpdating(false);
    }
  };

  const resolveFlag = async (flagId: string) => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('session_flags')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', flagId);

      if (error) {
        console.error('Error resolving flag:', error);
        alert('Failed to resolve flag');
      } else {
        alert('Flag resolved successfully');
        fetchSessionFlags();
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to resolve flag');
    } finally {
      setUpdating(false);
    }
  };

  const suspendUser = async (userId: string, reason: string, notes: string) => {
    setSuspending(true);
    try {
      const response = await fetch('/api/admin/suspend-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          action: 'suspend',
          reason,
          notes
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to suspend user');
      }

      alert('User suspended successfully');
      fetchUsers();
      setShowSuspendModal(false);
      setSelectedUserForSuspension(null);
      setSuspendReason('');
      setSuspendNotes('');
    } catch (error) {
      console.error('Error suspending user:', error);
      alert(`Failed to suspend user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSuspending(false);
    }
  };

  const unsuspendUser = async (userId: string) => {
    setSuspending(true);
    try {
      const response = await fetch('/api/admin/suspend-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          action: 'unsuspend'
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to unsuspend user');
      }

      alert('User unsuspended successfully');
      fetchUsers();
    } catch (error) {
      console.error('Error unsuspending user:', error);
      alert(`Failed to unsuspend user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSuspending(false);
    }
  };

  const handleSuspendClick = (user: User) => {
    setSelectedUserForSuspension(user);
    setShowSuspendModal(true);
  };

  const filterUsers = () => {
    if (!searchTerm) {
      setFilteredUsers(users);
      return;
    }

    const filtered = users.filter(user =>
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.user_id.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredUsers(filtered);
  };

  const updateUserTier = async (userId: string, newTier: 'free' | 'pro') => {
    setUpdating(true);
    try {
      // Check admin status first
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error('Authentication error in updateUserTier:', authError);
        alert('Authentication error. Please log in again.');
        return;
      }
      
      if (!user || !user.id) {
        console.error('No user or user ID found in updateUserTier');
        alert('You must be logged in to update user tiers');
        return;
      }

      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('is_admin')
        .eq('user_id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching admin status:', profileError);
        alert('Failed to verify admin privileges');
        return;
      }

      if (!userProfile?.is_admin) {
        alert('Admin privileges required to update user tiers');
        return;
      }

      if (!userId || userId === 'undefined') {
        console.error('Invalid userId provided:', userId);
        alert('Invalid user ID provided');
        return;
      }

      const { error } = await supabase
        .from('users')
        .update({ subscription_tier: newTier })
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating user tier:', error);
        alert('Failed to update user tier');
      } else {
        alert(`User tier updated to ${newTier}`);
        fetchUsers();
        setSelectedUser(null);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to update user tier');
    } finally {
      setUpdating(false);
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

  const getStats = () => {
    const totalUsers = users.length;
    const proUsers = users.filter(u => u.subscription_tier === 'pro').length;
    const freeUsers = totalUsers - proUsers;
    const suspendedUsers = users.filter(u => u.is_suspended).length;
    const recentUsers = users.filter(u => {
      const userDate = new Date(u.created_at);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return userDate > weekAgo;
    }).length;

    return { totalUsers, proUsers, freeUsers, suspendedUsers, recentUsers };
  };

  const stats = getStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Support Panel</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage users, sessions, and handle support requests
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'users'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Users className="h-4 w-4 inline mr-2" />
          Users
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'sessions'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <MessageCircle className="h-4 w-4 inline mr-2" />
          Sessions
        </button>
      </div>

      {activeTab === 'users' && (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Crown className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pro Users</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.proUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Free Users</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.freeUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <UserPlus className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">New This Week</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.recentUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Suspended Users</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.suspendedUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            Search and manage user accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by email or user ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Users List */}
          <div className="space-y-4">
            {filteredUsers.map((user) => (
              <Card key={user.user_id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-semibold">
                          {user.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{user.email}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">ID: {user.user_id}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Joined: {formatDate(user.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="flex space-x-2">
                        <Badge variant={user.subscription_tier === 'pro' ? 'default' : 'secondary'}>
                          {user.subscription_tier === 'pro' ? 'Pro' : 'Free'}
                        </Badge>
                        {user.is_suspended && (
                          <Badge variant="destructive">
                            Suspended
                          </Badge>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedUser(user)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        {!user.is_admin && (
                          user.is_suspended ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => unsuspendUser(user.user_id)}
                              disabled={suspending}
                            >
                              <Shield className="h-4 w-4 mr-1" />
                              Unsuspend
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleSuspendClick(user)}
                              disabled={suspending}
                            >
                              <Shield className="h-4 w-4 mr-1" />
                              Suspend
                            </Button>
                          )
                        )}
                        {user.subscription_tier === 'free' ? (
                          <Button
                            size="sm"
                            onClick={() => updateUserTier(user.user_id, 'pro')}
                            disabled={updating}
                          >
                            <Crown className="h-4 w-4 mr-1" />
                            Grant Pro
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => updateUserTier(user.user_id, 'free')}
                            disabled={updating}
                          >
                            <UserMinus className="h-4 w-4 mr-1" />
                            Remove Pro
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No users found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>User Details</CardTitle>
                <Button variant="ghost" onClick={() => setSelectedUser(null)}>
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold text-xl">
                    {selectedUser.email.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold dark:text-white">{selectedUser.email}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">User ID: {selectedUser.user_id}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Subscription Tier</label>
                  <div className="mt-1">
                    <Badge variant={selectedUser.subscription_tier === 'pro' ? 'default' : 'secondary'}>
                      {selectedUser.subscription_tier === 'pro' ? 'Pro' : 'Free'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Member Since</label>
                  <p className="text-sm text-gray-900 dark:text-white mt-1">
                    {formatDate(selectedUser.created_at)}
                  </p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-4">Quick Actions</h4>
                <div className="flex space-x-4">
                  {selectedUser.subscription_tier === 'free' ? (
                    <Button
                      onClick={() => updateUserTier(selectedUser.user_id, 'pro')}
                      disabled={updating}
                      className="flex items-center"
                    >
                      <Crown className="h-4 w-4 mr-2" />
                      Grant Pro Access
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      onClick={() => updateUserTier(selectedUser.user_id, 'free')}
                      disabled={updating}
                      className="flex items-center"
                    >
                      <UserMinus className="h-4 w-4 mr-2" />
                      Remove Pro Access
                    </Button>
                  )}
                  <Button variant="outline">
                    <Mail className="h-4 w-4 mr-2" />
                    Send Email
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Suspension Modal */}
      {showSuspendModal && selectedUserForSuspension && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Suspend User</CardTitle>
              <CardDescription>
                Suspend user: {selectedUserForSuspension.email}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Reason for Suspension *
                </label>
                <textarea
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="Enter reason for suspension..."
                  className="w-full mt-1 p-2 border border-gray-300 rounded-md dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  rows={3}
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {suspendReason.length}/500 characters
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={suspendNotes}
                  onChange={(e) => setSuspendNotes(e.target.value)}
                  placeholder="Additional notes for internal use..."
                  className="w-full mt-1 p-2 border border-gray-300 rounded-md dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  rows={2}
                  maxLength={1000}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {suspendNotes.length}/1000 characters
                </p>
              </div>
              <div className="flex space-x-2 pt-4">
                <Button
                  onClick={() => {
                    setShowSuspendModal(false);
                    setSelectedUserForSuspension(null);
                    setSuspendReason('');
                    setSuspendNotes('');
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => suspendUser(selectedUserForSuspension.user_id, suspendReason, suspendNotes)}
                  disabled={suspending || !suspendReason.trim()}
                  variant="destructive"
                  className="flex-1"
                >
                  {suspending ? 'Suspending...' : 'Suspend User'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
        </>
      )}

      {activeTab === 'sessions' && (
        <>
          {/* Session Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <MessageCircle className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Sessions</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{sessions.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Lock className="h-8 w-8 text-red-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Locked Sessions</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {sessions.filter(s => s.is_locked).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Flag className="h-8 w-8 text-yellow-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Flags</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {sessionFlags.filter(f => !f.resolved).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <AlertTriangle className="h-8 w-8 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Escalations</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {sessionFlags.filter(f => f.flag_type === 'escalate' && !f.resolved).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Locked Sessions */}
          <Card>
            <CardHeader>
              <CardTitle>Locked Sessions</CardTitle>
              <CardDescription>
                Sessions that have been locked by AI or admin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sessions.filter(s => s.is_locked).map((session) => (
                  <Card key={session.session_id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                            <Lock className="h-5 w-5 text-red-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{session.title}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              User: {(session as any).users?.email || 'Unknown'}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Locked: {formatDate(session.locked_at || session.created_at)} | 
                              Reason: {session.lock_reason} | 
                              Type: {session.session_type}
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          {session.can_unlock && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => unlockSession(session.session_id)}
                              disabled={updating}
                            >
                              <Unlock className="h-4 w-4 mr-1" />
                              Unlock
                            </Button>
                          )}
                          {!session.can_unlock && (
                            <Badge variant="secondary">
                              Cannot Unlock
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {sessions.filter(s => s.is_locked).length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Lock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>No locked sessions</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Session Flags */}
          <Card>
            <CardHeader>
              <CardTitle>Session Flags</CardTitle>
              <CardDescription>
                Sessions flagged for review, escalation, or check-ins
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sessionFlags.map((flag) => (
                  <Card key={flag.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            flag.flag_type === 'escalate' ? 'bg-red-100' :
                            flag.flag_type === 'review' ? 'bg-yellow-100' :
                            flag.flag_type === 'check_in' ? 'bg-blue-100' :
                            'bg-green-100'
                          }`}>
                            {flag.flag_type === 'escalate' ? <AlertTriangle className="h-5 w-5 text-red-600" /> :
                             flag.flag_type === 'review' ? <Flag className="h-5 w-5 text-yellow-600" /> :
                             flag.flag_type === 'check_in' ? <Clock className="h-5 w-5 text-blue-600" /> :
                             <CheckCircle className="h-5 w-5 text-green-600" />}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {(flag as any).therapy_sessions?.title || 'Unknown Session'}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              User: {(flag as any).users?.email || 'Unknown'}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Type: {flag.flag_type} | 
                              Created: {formatDate(flag.created_at)}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {flag.flag_reason}
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          {!flag.resolved && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resolveFlag(flag.id)}
                              disabled={updating}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Resolve
                            </Button>
                          )}
                          {flag.resolved && (
                            <Badge variant="secondary">
                              Resolved
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {sessionFlags.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Flag className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>No session flags</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
