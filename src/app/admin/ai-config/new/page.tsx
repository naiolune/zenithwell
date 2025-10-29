'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// AI provider factory removed - all AI calls now server-side only
import { createClient } from '@/lib/supabase/client';

export default function NewAIConfigPage() {
  const [provider, setProvider] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const availableProviders = [
    { id: 'openai', name: 'OpenAI', models: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'] },
    { id: 'anthropic', name: 'Anthropic', models: ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229'] },
    { id: 'perplexity', name: 'Perplexity', models: ['sonar-pro', 'sonar-medium', 'sonar-small'] }
  ];

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    const providerInfo = availableProviders.find(p => p.id === newProvider);
    if (providerInfo && providerInfo.models.length > 0) {
      setModel(providerInfo.models[0]);
    }
  };

  const testConnection = async () => {
    if (!provider || !apiKey || !model) {
      alert('Please fill in all fields');
      return;
    }

    setTesting(true);
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
          provider,
          apiKey,
          model
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
      setTesting(false);
    }
  };

  const saveConfig = async () => {
    if (!provider || !apiKey || !model) {
      alert('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      // First check if user is admin
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('You must be logged in to save configuration');
        return;
      }

      // Check admin status
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('is_admin')
        .eq('user_id', user.id)
        .single();

      if (profileError || !userProfile?.is_admin) {
        alert('Admin privileges required to save AI configuration');
        return;
      }

      const { data, error } = await supabase
        .from('ai_config')
        .insert({
          provider,
          api_key: apiKey,
          model,
          is_active: false
        })
        .select();

      if (error) {
        console.error('Error saving config:', error);
        alert(`Failed to save configuration: ${error.message}`);
      } else {
        alert('Configuration saved successfully');
        router.push('/admin/ai-config');
      }
    } catch (error) {
      console.error('Error:', error);
      alert(`Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const selectedProvider = availableProviders.find(p => p.id === provider);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Add AI Configuration</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Configure a new AI provider for the wellness platform
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Provider Settings</CardTitle>
          <CardDescription>
            Choose an AI provider and configure its settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="provider" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              AI Provider
            </label>
            <select
              id="provider"
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-900 dark:text-white"
            >
              <option value="">Select a provider</option>
              {availableProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              API Key
            </label>
            <input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-900 dark:text-white"
              placeholder="Enter your API key"
            />
          </div>

          {selectedProvider && (
            <div>
              <label htmlFor="model" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Model
              </label>
              <select
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-900 dark:text-white"
              >
                {selectedProvider.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex space-x-4">
            <Button
              onClick={testConnection}
              disabled={!provider || !apiKey || !model || testing}
              variant="outline"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </Button>
            <Button
              onClick={saveConfig}
              disabled={!provider || !apiKey || !model || loading}
            >
              {loading ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
