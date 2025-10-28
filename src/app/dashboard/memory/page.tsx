'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Brain, Calendar, Tag, MessageCircle, Plus, Edit, Trash2, Search, Shield } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ConversationMemory } from '@/types';

interface UserMemory {
  id: string;
  memory_key: string;
  memory_value: string;
  category: 'goals' | 'preferences' | 'background' | 'progress' | 'custom';
  created_at: string;
}

interface UserGoal {
  id: string;
  goal_text: string;
  status: 'active' | 'achieved' | 'paused';
  created_at: string;
  achieved_at?: string;
}

export default function MemoryPage() {
  const [memories, setMemories] = useState<ConversationMemory[]>([]);
  const [userMemory, setUserMemory] = useState<UserMemory[]>([]);
  const [goals, setGoals] = useState<UserGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddMemory, setShowAddMemory] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [editingMemory, setEditingMemory] = useState<UserMemory | null>(null);
  const [newMemory, setNewMemory] = useState({ key: '', value: '', category: 'custom' as string });
  const [newGoal, setNewGoal] = useState('');
  const supabase = createClient();

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    await Promise.all([
      fetchMemories(),
      fetchUserMemory(),
      fetchGoals()
    ]);
  };

  const fetchMemories = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('conversation_memory')
        .select(`
          *,
          therapy_sessions:session_id (title, created_at)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching memories:', error);
      } else {
        setMemories(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchUserMemory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const response = await fetch('/api/memory');
      if (response.ok) {
        const result = await response.json();
        setUserMemory(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching user memory:', error);
    }
  };

  const fetchGoals = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const response = await fetch('/api/goals');
      if (response.ok) {
        const result = await response.json();
        setGoals(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Memory management functions
  const addMemory = async () => {
    if (!newMemory.key.trim() || !newMemory.value.trim()) return;

    try {
      const response = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMemory)
      });

      if (response.ok) {
        setNewMemory({ key: '', value: '', category: 'custom' });
        setShowAddMemory(false);
        fetchUserMemory();
      } else {
        alert('Failed to add memory item');
      }
    } catch (error) {
      console.error('Error adding memory:', error);
      alert('Failed to add memory item');
    }
  };

  const updateMemory = async (memoryId: string, value: string) => {
    try {
      const response = await fetch('/api/memory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memoryId, value })
      });

      if (response.ok) {
        fetchUserMemory();
        setEditingMemory(null);
      } else {
        alert('Failed to update memory item');
      }
    } catch (error) {
      console.error('Error updating memory:', error);
      alert('Failed to update memory item');
    }
  };

  const deleteMemory = async (memoryId: string) => {
    if (!confirm('Are you sure you want to delete this memory item?')) return;

    try {
      const response = await fetch('/api/memory', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memoryId })
      });

      if (response.ok) {
        fetchUserMemory();
      } else {
        alert('Failed to delete memory item');
      }
    } catch (error) {
      console.error('Error deleting memory:', error);
      alert('Failed to delete memory item');
    }
  };

  const addGoal = async () => {
    if (!newGoal.trim()) return;

    try {
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalText: newGoal })
      });

      if (response.ok) {
        setNewGoal('');
        setShowAddGoal(false);
        fetchGoals();
      } else {
        alert('Failed to add goal');
      }
    } catch (error) {
      console.error('Error adding goal:', error);
      alert('Failed to add goal');
    }
  };

  const updateGoalStatus = async (goalId: string, status: string) => {
    try {
      const response = await fetch('/api/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          goalId, 
          status,
          achievedAt: status === 'achieved' ? new Date().toISOString() : undefined
        })
      });

      if (response.ok) {
        fetchGoals();
      } else {
        alert('Failed to update goal');
      }
    } catch (error) {
      console.error('Error updating goal:', error);
      alert('Failed to update goal');
    }
  };

  const deleteGoal = async (goalId: string) => {
    if (!confirm('Are you sure you want to delete this goal?')) return;

    try {
      const response = await fetch('/api/goals', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId })
      });

      if (response.ok) {
        fetchGoals();
      } else {
        alert('Failed to delete goal');
      }
    } catch (error) {
      console.error('Error deleting goal:', error);
      alert('Failed to delete goal');
    }
  };

  const clearAllMemory = async () => {
    if (!confirm('Are you sure you want to clear ALL memory? This cannot be undone.')) return;

    try {
      const response = await fetch('/api/memory', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearAll: true })
      });

      if (response.ok) {
        fetchUserMemory();
        alert('All memory cleared');
      } else {
        alert('Failed to clear memory');
      }
    } catch (error) {
      console.error('Error clearing memory:', error);
      alert('Failed to clear memory');
    }
  };

  // Filter memory by category and search
  const filteredMemory = userMemory.filter(memory => {
    const matchesCategory = selectedCategory === 'all' || memory.category === selectedCategory;
    const matchesSearch = searchQuery === '' || 
      memory.memory_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      memory.memory_value.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categoryLabels = {
    goals: 'Goals',
    preferences: 'Preferences', 
    background: 'Background',
    progress: 'Progress',
    custom: 'Custom'
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Memory & Insights</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Track your wellness progress, goals, and what ZenithWell remembers about you
        </p>
      </div>

      {/* What ZenithWell Remembers Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>What ZenithWell Remembers About You</span>
              </CardTitle>
              <CardDescription>
                Only you can see this. ZenithWell uses this to personalize your sessions.
              </CardDescription>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddMemory(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Memory
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllMemory}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search and Filter */}
          <div className="flex space-x-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search memory..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Memory Items */}
          {filteredMemory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchQuery || selectedCategory !== 'all' 
                ? 'No memory items match your search' 
                : 'No memory items yet. Add some to help ZenithWell personalize your sessions.'
              }
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMemory.map((memory) => (
                <div key={memory.id} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant="secondary">{categoryLabels[memory.category]}</Badge>
                        <span className="font-medium text-sm">{memory.memory_key}</span>
                      </div>
                      {editingMemory?.id === memory.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editingMemory.memory_value}
                            onChange={(e) => setEditingMemory({...editingMemory, memory_value: e.target.value})}
                            className="min-h-[60px]"
                          />
                          <div className="flex space-x-2">
                            <Button size="sm" onClick={() => updateMemory(memory.id, editingMemory.memory_value)}>
                              Save
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingMemory(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-700 dark:text-gray-300 text-sm">
                          {memory.memory_value}
                        </p>
                      )}
                    </div>
                    {editingMemory?.id !== memory.id && (
                      <div className="flex space-x-1 ml-4">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingMemory(memory)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteMemory(memory.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Goals Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your Wellness Goals</CardTitle>
              <CardDescription>
                Track your progress and mark achievements
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddGoal(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Goal
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {goals.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No goals yet. Add some to track your wellness journey.
            </div>
          ) : (
            <div className="space-y-3">
              {goals.map((goal) => (
                <div key={goal.id} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className={`text-sm ${goal.status === 'achieved' ? 'line-through text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                        {goal.goal_text}
                      </p>
                      <div className="flex items-center space-x-2 mt-2">
                        <Badge variant={goal.status === 'achieved' ? 'default' : 'secondary'}>
                          {goal.status}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {formatDate(goal.created_at)}
                        </span>
                        {goal.achieved_at && (
                          <span className="text-xs text-green-600">
                            Achieved {formatDate(goal.achieved_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-1 ml-4">
                      {goal.status === 'active' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateGoalStatus(goal.id, 'achieved')}
                        >
                          Mark Achieved
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteGoal(goal.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {memories.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No memories yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Complete some therapy sessions to see your progress and insights here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {memories.map((memory) => (
            <Card key={memory.memory_id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {(memory as any).therapy_sessions?.title || 'Session Summary'}
                  </CardTitle>
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <Calendar className="h-4 w-4 mr-1" />
                    {formatDate(memory.created_at)}
                  </div>
                </div>
                <CardDescription>
                  Session from {(memory as any).therapy_sessions?.created_at ? 
                    new Date((memory as any).therapy_sessions.created_at).toLocaleDateString() : 
                    'Unknown date'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center">
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Summary
                    </h4>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {memory.summary}
                    </p>
                  </div>
                  
                  {memory.topics && memory.topics.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center">
                        <Tag className="h-4 w-4 mr-2" />
                        Key Topics
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {memory.topics.map((topic, index) => (
                          <Badge key={index} variant="secondary">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Memory Dialog */}
      <Dialog open={showAddMemory} onOpenChange={setShowAddMemory}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Memory Item</DialogTitle>
            <DialogDescription>
              Add something important for ZenithWell to remember about you
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="memory-key">Key</Label>
              <Input
                id="memory-key"
                placeholder="e.g., Work schedule, Favorite activities"
                value={newMemory.key}
                onChange={(e) => setNewMemory({...newMemory, key: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="memory-value">Value</Label>
              <Textarea
                id="memory-value"
                placeholder="e.g., I work night shifts, I love hiking on weekends"
                value={newMemory.value}
                onChange={(e) => setNewMemory({...newMemory, value: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="memory-category">Category</Label>
              <Select value={newMemory.category} onValueChange={(value) => setNewMemory({...newMemory, category: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowAddMemory(false)}>
                Cancel
              </Button>
              <Button onClick={addMemory} disabled={!newMemory.key.trim() || !newMemory.value.trim()}>
                Add Memory
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Goal Dialog */}
      <Dialog open={showAddGoal} onOpenChange={setShowAddGoal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Wellness Goal</DialogTitle>
            <DialogDescription>
              What would you like to work on in your wellness journey?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="goal-text">Goal</Label>
              <Textarea
                id="goal-text"
                placeholder="e.g., Improve sleep quality, Build better relationships, Reduce stress"
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowAddGoal(false)}>
                Cancel
              </Button>
              <Button onClick={addGoal} disabled={!newGoal.trim()}>
                Add Goal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
