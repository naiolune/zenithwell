'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Crown, 
  Settings, 
  Brain, 
  TrendingUp, 
  Activity,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    proUsers: 0,
    freeUsers: 0,
    totalSessions: 0,
    activeAIConfigs: 0,
    recentUsers: 0
  });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Get user stats
      const { data: users } = await supabase
        .from('users')
        .select('*');

      // Get session stats
      const { data: sessions } = await supabase
        .from('therapy_sessions')
        .select('*');

      // Get AI config stats
      const { data: aiConfigs } = await supabase
        .from('ai_config')
        .select('*');

      if (users) {
        const proUsers = users.filter(u => u.subscription_tier === 'pro').length;
        const freeUsers = users.length - proUsers;
        
        // Recent users (last 7 days)
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const recentUsers = users.filter(u => new Date(u.created_at) > weekAgo).length;

        setStats({
          totalUsers: users.length,
          proUsers,
          freeUsers,
          totalSessions: sessions?.length || 0,
          activeAIConfigs: aiConfigs?.filter(c => c.is_active).length || 0,
          recentUsers
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Overview of ZenithWell platform metrics and management tools
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {stats.totalUsers > 0 ? Math.round((stats.proUsers / stats.totalUsers) * 100) : 0}% of total
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Sessions</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalSessions}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">New This Week</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.recentUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              User Management
            </CardTitle>
            <CardDescription>
              Manage user accounts and grant Pro access
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <p className="font-medium dark:text-white">User Support Panel</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">View and manage all users</p>
                </div>
                <Link href="/admin/support">
                  <Button>Manage Users</Button>
                </Link>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <p>• Grant/remove Pro access</p>
                <p>• View user details and activity</p>
                <p>• Search and filter users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Settings className="h-5 w-5 mr-2" />
              AI Configuration
            </CardTitle>
            <CardDescription>
              Manage AI providers and system settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <p className="font-medium dark:text-white">AI Provider Settings</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Configure AI providers and models</p>
                </div>
                <Link href="/admin/ai-config">
                  <Button>Configure AI</Button>
                </Link>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <p>• Add/remove AI providers</p>
                <p>• Test API connections</p>
                <p>• Set active provider</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Brain className="h-5 w-5 mr-2" />
            System Status
          </CardTitle>
          <CardDescription>
            Current system health and configuration status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                {stats.activeAIConfigs > 0 ? (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-red-600" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">AI Providers</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {stats.activeAIConfigs > 0 ? 'Active' : 'No active providers'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Database</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Connected</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Authentication</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Active</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest platform activity and events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium dark:text-white">System Status</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">All systems operational</p>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Just now</span>
            </div>
            
            <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="w-2 h-2 bg-green-600 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium dark:text-white">New Users</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{stats.recentUsers} new users this week</p>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">This week</span>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="w-2 h-2 bg-yellow-600 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium dark:text-white">Pro Subscriptions</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{stats.proUsers} active Pro users</p>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Current</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
