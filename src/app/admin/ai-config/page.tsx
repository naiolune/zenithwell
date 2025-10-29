'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// AI provider factory removed - all AI calls now server-side only
import { createClient } from '@/lib/supabase/client';
import { AIConfig } from '@/types';

export default function AIConfigPage() {
  const [configs, setConfigs] = useState<AIConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_config')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching configs:', error);
      } else {
        setConfigs(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (config: AIConfig) => {
    setTesting(config.id);
    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('You must be logged in to test connections');
        return;
      }

      // Call the server-side API route
      const response = await fetch('/api/ai/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          provider: config.provider,
          apiKey: config.api_key,
          model: config.model
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        alert('Connection successful!');
      } else {
        alert(`Connection failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Test connection error:', error);
      alert('Connection failed. Please check your API key and configuration.');
    } finally {
      setTesting(null);
    }
  };

  const setActiveConfig = async (configId: string) => {
    try {
      // Check admin status first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('You must be logged in to manage configurations');
        return;
      }

      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('is_admin')
        .eq('user_id', user.id)
        .single();

      if (profileError || !userProfile?.is_admin) {
        alert('Admin privileges required to manage AI configurations');
        return;
      }

      // Deactivate all configs
      const { error: deactivateError } = await supabase
        .from('ai_config')
        .update({ is_active: false })
        .neq('id', configId);

      if (deactivateError) {
        console.error('Error deactivating configs:', deactivateError);
        alert(`Failed to deactivate configurations: ${deactivateError.message}`);
        return;
      }

      // Activate selected config
      const { error } = await supabase
        .from('ai_config')
        .update({ is_active: true })
        .eq('id', configId);

      if (error) {
        console.error('Error setting active config:', error);
        alert(`Failed to set active configuration: ${error.message}`);
      } else {
        alert('Configuration activated successfully');
        fetchConfigs();
      }
    } catch (error) {
      console.error('Error:', error);
      alert(`Failed to set active configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const deleteConfig = async (configId: string) => {
    if (!confirm('Are you sure you want to delete this configuration?')) {
      return;
    }

    try {
      // Check admin status first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('You must be logged in to delete configurations');
        return;
      }

      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('is_admin')
        .eq('user_id', user.id)
        .single();

      if (profileError || !userProfile?.is_admin) {
        alert('Admin privileges required to delete AI configurations');
        return;
      }

      const { error } = await supabase
        .from('ai_config')
        .delete()
        .eq('id', configId);

      if (error) {
        console.error('Error deleting config:', error);
        alert(`Failed to delete configuration: ${error.message}`);
      } else {
        alert('Configuration deleted successfully');
        fetchConfigs();
      }
    } catch (error) {
      console.error('Error:', error);
      alert(`Failed to delete configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">AI Configuration</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage AI provider settings and API keys
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {configs.map((config) => (
          <Card key={config.id} className={config.is_active ? 'border-green-500' : ''}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg capitalize">{config.provider}</CardTitle>
                {config.is_active && (
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                    Active
                  </span>
                )}
              </div>
              <CardDescription>
                Model: {config.model}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                API Key: {config.api_key.substring(0, 8)}...
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Created: {new Date(config.created_at).toLocaleDateString()}
              </div>
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => testConnection(config)}
                  disabled={testing === config.id}
                >
                  {testing === config.id ? 'Testing...' : 'Test'}
                </Button>
                {!config.is_active && (
                  <Button
                    size="sm"
                    onClick={() => setActiveConfig(config.id)}
                  >
                    Activate
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteConfig(config.id)}
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {configs.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No AI configurations found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Add an AI provider configuration to get started
            </p>
            <Button onClick={() => window.location.href = '/admin/ai-config/new'}>
              Add Configuration
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
