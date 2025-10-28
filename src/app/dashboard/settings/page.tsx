'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Crown, CheckCircle } from 'lucide-react';
import { getUserSubscription, canAccessProFeature } from '@/lib/subscription';
import { User } from '@/types';

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    const { user, isPro } = await getUserSubscription();
    setUser(user);
    setIsPro(isPro);
    setLoading(false);
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
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage your account and subscription
        </p>
      </div>

      {/* Subscription Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Crown className="h-5 w-5" />
                <span>Subscription</span>
              </CardTitle>
              <CardDescription>
                Your current plan and billing information
              </CardDescription>
            </div>
            <Badge variant={isPro ? 'default' : 'secondary'}>
              {isPro ? 'Pro' : 'Free'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isPro ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>You have Pro access</span>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                You have access to all premium features including group wellness sessions, 
                unlimited wellness sessions, and advanced analytics.
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                You're currently on the free plan. Pro access is granted by administrators.
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Need Pro access?</strong> Contact support to request Pro features.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feature Access */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Access</CardTitle>
          <CardDescription>
            See what features you have access to with your current plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { feature: 'unlimited_sessions', name: 'Unlimited Therapy Sessions', description: 'No monthly limits on AI therapy sessions' },
              { feature: 'group_sessions', name: 'Group Therapy Sessions', description: 'Invite family and friends for group sessions' },
              { feature: 'session_export', name: 'Session Export', description: 'Download session transcripts as PDF' },
              { feature: 'advanced_analytics', name: 'Advanced Analytics', description: 'Detailed insights into your therapy progress' },
              { feature: 'priority_support', name: 'Priority Support', description: 'Faster response times for support requests' },
            ].map((item) => {
              const hasAccess = canAccessProFeature(isPro, item.feature);
              return (
                <div key={item.feature} className="flex items-center justify-between p-3 border dark:border-gray-700 rounded-lg">
                  <div>
                    <div className="font-medium dark:text-white">{item.name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{item.description}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {hasAccess ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                    )}
                    {!hasAccess && (
                      <Badge variant="outline">Pro Only</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>
            Your account details and preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <div className="text-sm text-gray-900 dark:text-white">{user?.email}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Member Since
              </label>
              <div className="text-sm text-gray-900 dark:text-white">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
