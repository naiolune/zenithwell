'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Crown, CheckCircle, Download, Trash2, AlertTriangle } from 'lucide-react';
import { getUserSubscription, canAccessProFeature } from '@/lib/subscription';
import { User } from '@/types';

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    const { user, isPro } = await getUserSubscription();
    setUser(user);
    setIsPro(isPro);
    setLoading(false);
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/user/export-data', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `zenithwell-data-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Failed to export data. Please try again.');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAllData = async () => {
    if (confirmation !== 'DELETE ALL MY DATA') {
      alert('Please type the exact confirmation text: DELETE ALL MY DATA');
      return;
    }

    if (!password) {
      alert('Please enter your password');
      return;
    }

    setIsDeleting(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/user/delete-all-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ password, confirmation })
      });

      const result = await response.json();

      if (response.ok) {
        alert('All your data has been deleted. You will be redirected to the login page.');
        window.location.href = '/login';
      } else {
        alert(result.error || 'Failed to delete data. Please try again.');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete data. Please try again.');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setPassword('');
      setConfirmation('');
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
              { feature: 'unlimited_sessions', name: 'Unlimited Wellness Sessions', description: 'No monthly limits on AI wellness sessions' },
              { feature: 'group_sessions', name: 'Group Wellness Sessions', description: 'Invite family and friends for group sessions' },
              { feature: 'session_export', name: 'Session Export', description: 'Download session transcripts as PDF' },
              { feature: 'advanced_analytics', name: 'Advanced Analytics', description: 'Detailed insights into your wellness progress' },
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

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>
            Export or delete your personal data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border dark:border-gray-700 rounded-lg">
              <div className="flex items-center space-x-3">
                <Download className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="font-medium dark:text-white">Export Your Data</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Download all your wellness sessions, memories, and account data
                  </div>
                </div>
              </div>
              <Button 
                onClick={handleExportData}
                disabled={isExporting}
                variant="outline"
                size="sm"
              >
                {isExporting ? 'Exporting...' : 'Export Data'}
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20">
              <div className="flex items-center space-x-3">
                <Trash2 className="h-5 w-5 text-red-600" />
                <div>
                  <div className="font-medium text-red-900 dark:text-red-100">Delete All Data</div>
                  <div className="text-sm text-red-700 dark:text-red-300">
                    Permanently delete all your data and start fresh. This cannot be undone.
                  </div>
                </div>
              </div>
              <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    Delete All Data
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center space-x-2">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <span>Delete All Data</span>
                    </DialogTitle>
                    <DialogDescription>
                      This action will permanently delete all your wellness sessions, memories, 
                      goals, and account data. You will be signed out and need to create a new account.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800 dark:text-red-200">
                      <strong>Warning:</strong> This action cannot be undone. Please export your data first if you want to keep a backup.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                      />
                    </div>
                    <div>
                      <Label htmlFor="confirmation">Confirmation</Label>
                      <Input
                        id="confirmation"
                        type="text"
                        value={confirmation}
                        onChange={(e) => setConfirmation(e.target.value)}
                        placeholder="Type: DELETE ALL MY DATA"
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setDeleteDialogOpen(false)}
                      disabled={isDeleting}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDeleteAllData}
                      disabled={isDeleting || !password || confirmation !== 'DELETE ALL MY DATA'}
                    >
                      {isDeleting ? 'Deleting...' : 'Delete All Data'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
