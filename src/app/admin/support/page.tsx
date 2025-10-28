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
  Database
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@/types';

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
  const supabase = createClient();

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [searchTerm, users]);

  const fetchUsers = async () => {
    try {
      // Check admin status first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('User not authenticated');
        return;
      }

      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('is_admin')
        .eq('user_id', user.id)
        .single();

      if (profileError || !userProfile?.is_admin) {
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
        // Get session count and types
        const { data: sessions } = await supabase
          .from('therapy_sessions')
          .select('session_id, is_group, last_message_at')
          .eq('user_id', user.id);

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

        stats[user.id] = {
          totalSessions,
          totalMessages,
          lastActivity: lastActivity ? new Date(lastActivity).toISOString() : null,
          avgSessionLength,
          groupSessions,
          individualSessions
        };
      } catch (error) {
        console.error(`Error fetching stats for user ${user.id}:`, error);
        stats[user.id] = {
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

  const filterUsers = () => {
    if (!searchTerm) {
      setFilteredUsers(users);
      return;
    }

    const filtered = users.filter(user =>
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredUsers(filtered);
  };

  const updateUserTier = async (userId: string, newTier: 'free' | 'pro') => {
    setUpdating(true);
    try {
      // Check admin status first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('You must be logged in to update user tiers');
        return;
      }

      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('is_admin')
        .eq('user_id', user.id)
        .single();

      if (profileError || !userProfile?.is_admin) {
        alert('Admin privileges required to update user tiers');
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
    const recentUsers = users.filter(u => {
      const userDate = new Date(u.created_at);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return userDate > weekAgo;
    }).length;

    return { totalUsers, proUsers, freeUsers, recentUsers };
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
          Manage users, grant Pro access, and handle support requests
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
              <Card key={user.id} className="hover:shadow-md transition-shadow">
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
                        <p className="text-sm text-gray-600 dark:text-gray-400">ID: {user.id}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Joined: {formatDate(user.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Badge variant={user.subscription_tier === 'pro' ? 'default' : 'secondary'}>
                        {user.subscription_tier === 'pro' ? 'Pro' : 'Free'}
                      </Badge>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedUser(user)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        {user.subscription_tier === 'free' ? (
                          <Button
                            size="sm"
                            onClick={() => updateUserTier(user.id, 'pro')}
                            disabled={updating}
                          >
                            <Crown className="h-4 w-4 mr-1" />
                            Grant Pro
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => updateUserTier(user.id, 'free')}
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
                  <p className="text-sm text-gray-600 dark:text-gray-400">User ID: {selectedUser.id}</p>
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
                      onClick={() => updateUserTier(selectedUser.id, 'pro')}
                      disabled={updating}
                      className="flex items-center"
                    >
                      <Crown className="h-4 w-4 mr-2" />
                      Grant Pro Access
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      onClick={() => updateUserTier(selectedUser.id, 'free')}
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
    </div>
  );
}
