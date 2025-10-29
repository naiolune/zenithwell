'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GROUP_SESSION_CONFIG, GroupCategory } from '@/lib/group-session-config';

interface IntroductionFormProps {
  groupCategory: GroupCategory;
  sessionId: string;
  onSubmit: (data: IntroductionFormData) => Promise<void>;
  isLoading?: boolean;
}

export interface IntroductionFormData {
  // Relationship fields
  relationshipRole?: string;
  whyWellness?: string;
  goals?: string;
  challenges?: string;
  
  // Family fields
  familyRole?: string;
  familyGoals?: string;
  whatToAchieve?: string;
  
  // General fields
  participantRole?: string;
  wellnessReason?: string;
  personalGoals?: string;
  expectations?: string;
}

const RELATIONSHIP_ROLES = [
  'Partner/Spouse',
  'Boyfriend/Girlfriend',
  'Fiancé/Fiancée',
  'Ex-partner',
  'Other'
];

const FAMILY_ROLES = [
  'Parent',
  'Child',
  'Sibling',
  'Grandparent',
  'Aunt/Uncle',
  'Cousin',
  'In-law',
  'Step-family member',
  'Other'
];

export function IntroductionForm({ groupCategory, sessionId, onSubmit, isLoading = false }: IntroductionFormProps) {
  const [formData, setFormData] = useState<IntroductionFormData>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: keyof IntroductionFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (groupCategory === GROUP_SESSION_CONFIG.GROUP_CATEGORIES.RELATIONSHIP) {
      if (!formData.relationshipRole?.trim()) {
        newErrors.relationshipRole = 'Please select your role in the relationship';
      }
      if (!formData.whyWellness?.trim()) {
        newErrors.whyWellness = 'Please explain why you want this wellness session';
      }
      if (!formData.goals?.trim()) {
        newErrors.goals = 'Please share your goals for this session';
      }
    } else if (groupCategory === GROUP_SESSION_CONFIG.GROUP_CATEGORIES.FAMILY) {
      if (!formData.familyRole?.trim()) {
        newErrors.familyRole = 'Please select your role in the family';
      }
      if (!formData.whyWellness?.trim()) {
        newErrors.whyWellness = 'Please explain why you want this wellness session';
      }
      if (!formData.familyGoals?.trim()) {
        newErrors.familyGoals = 'Please share your family goals';
      }
      if (!formData.whatToAchieve?.trim()) {
        newErrors.whatToAchieve = 'Please explain what you want to achieve';
      }
    } else if (groupCategory === GROUP_SESSION_CONFIG.GROUP_CATEGORIES.GENERAL) {
      if (!formData.participantRole?.trim()) {
        newErrors.participantRole = 'Please describe your role in this session';
      }
      if (!formData.wellnessReason?.trim()) {
        newErrors.wellnessReason = 'Please explain why you want this wellness session';
      }
      if (!formData.personalGoals?.trim()) {
        newErrors.personalGoals = 'Please share your personal goals';
      }
      if (!formData.expectations?.trim()) {
        newErrors.expectations = 'Please share your expectations for this session';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Error submitting introduction:', error);
    }
  };

  const getTitle = () => {
    switch (groupCategory) {
      case GROUP_SESSION_CONFIG.GROUP_CATEGORIES.RELATIONSHIP:
        return 'Relationship Wellness Introduction';
      case GROUP_SESSION_CONFIG.GROUP_CATEGORIES.FAMILY:
        return 'Family Wellness Introduction';
      case GROUP_SESSION_CONFIG.GROUP_CATEGORIES.GENERAL:
        return 'General Wellness Introduction';
      default:
        return 'Wellness Introduction';
    }
  };

  const getDescription = () => {
    switch (groupCategory) {
      case GROUP_SESSION_CONFIG.GROUP_CATEGORIES.RELATIONSHIP:
        return 'Help us understand your relationship dynamics and wellness goals.';
      case GROUP_SESSION_CONFIG.GROUP_CATEGORIES.FAMILY:
        return 'Share your family role and what you hope to achieve together.';
      case GROUP_SESSION_CONFIG.GROUP_CATEGORIES.GENERAL:
        return 'Tell us about yourself and your wellness journey.';
      default:
        return 'Please share some information about yourself.';
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{getTitle()}</CardTitle>
        <CardDescription>{getDescription()}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {groupCategory === GROUP_SESSION_CONFIG.GROUP_CATEGORIES.RELATIONSHIP && (
            <>
              <div className="space-y-2">
                <Label htmlFor="relationshipRole">Your role in the relationship *</Label>
                <Select
                  value={formData.relationshipRole || ''}
                  onValueChange={(value) => handleInputChange('relationshipRole', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIP_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.relationshipRole && (
                  <p className="text-sm text-red-500">{errors.relationshipRole}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="whyWellness">Why do you want this wellness session? *</Label>
                <Textarea
                  id="whyWellness"
                  placeholder="Share what brought you to seek wellness support together..."
                  value={formData.whyWellness || ''}
                  onChange={(e) => handleInputChange('whyWellness', e.target.value)}
                  rows={3}
                />
                {errors.whyWellness && (
                  <p className="text-sm text-red-500">{errors.whyWellness}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="goals">What are your goals for this session? *</Label>
                <Textarea
                  id="goals"
                  placeholder="What do you hope to achieve or work on together?"
                  value={formData.goals || ''}
                  onChange={(e) => handleInputChange('goals', e.target.value)}
                  rows={3}
                />
                {errors.goals && (
                  <p className="text-sm text-red-500">{errors.goals}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="challenges">What challenges are you facing?</Label>
                <Textarea
                  id="challenges"
                  placeholder="Share any specific challenges or areas you'd like to work on..."
                  value={formData.challenges || ''}
                  onChange={(e) => handleInputChange('challenges', e.target.value)}
                  rows={3}
                />
              </div>
            </>
          )}

          {groupCategory === GROUP_SESSION_CONFIG.GROUP_CATEGORIES.FAMILY && (
            <>
              <div className="space-y-2">
                <Label htmlFor="familyRole">Your role in the family *</Label>
                <Select
                  value={formData.familyRole || ''}
                  onValueChange={(value) => handleInputChange('familyRole', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your family role" />
                  </SelectTrigger>
                  <SelectContent>
                    {FAMILY_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.familyRole && (
                  <p className="text-sm text-red-500">{errors.familyRole}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="whyWellness">Why do you want this family wellness session? *</Label>
                <Textarea
                  id="whyWellness"
                  placeholder="What brought your family together for this wellness session?"
                  value={formData.whyWellness || ''}
                  onChange={(e) => handleInputChange('whyWellness', e.target.value)}
                  rows={3}
                />
                {errors.whyWellness && (
                  <p className="text-sm text-red-500">{errors.whyWellness}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="familyGoals">What are your family goals? *</Label>
                <Textarea
                  id="familyGoals"
                  placeholder="What does your family hope to achieve together?"
                  value={formData.familyGoals || ''}
                  onChange={(e) => handleInputChange('familyGoals', e.target.value)}
                  rows={3}
                />
                {errors.familyGoals && (
                  <p className="text-sm text-red-500">{errors.familyGoals}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatToAchieve">What do you want to achieve? *</Label>
                <Textarea
                  id="whatToAchieve"
                  placeholder="What specific outcomes are you hoping for?"
                  value={formData.whatToAchieve || ''}
                  onChange={(e) => handleInputChange('whatToAchieve', e.target.value)}
                  rows={3}
                />
                {errors.whatToAchieve && (
                  <p className="text-sm text-red-500">{errors.whatToAchieve}</p>
                )}
              </div>
            </>
          )}

          {groupCategory === GROUP_SESSION_CONFIG.GROUP_CATEGORIES.GENERAL && (
            <>
              <div className="space-y-2">
                <Label htmlFor="participantRole">Your role in this session *</Label>
                <Input
                  id="participantRole"
                  placeholder="e.g., Someone seeking support, A wellness enthusiast, etc."
                  value={formData.participantRole || ''}
                  onChange={(e) => handleInputChange('participantRole', e.target.value)}
                />
                {errors.participantRole && (
                  <p className="text-sm text-red-500">{errors.participantRole}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="wellnessReason">Why do you want this wellness session? *</Label>
                <Textarea
                  id="wellnessReason"
                  placeholder="What brought you to seek wellness support?"
                  value={formData.wellnessReason || ''}
                  onChange={(e) => handleInputChange('wellnessReason', e.target.value)}
                  rows={3}
                />
                {errors.wellnessReason && (
                  <p className="text-sm text-red-500">{errors.wellnessReason}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="personalGoals">What are your personal goals? *</Label>
                <Textarea
                  id="personalGoals"
                  placeholder="What do you hope to achieve or work on?"
                  value={formData.personalGoals || ''}
                  onChange={(e) => handleInputChange('personalGoals', e.target.value)}
                  rows={3}
                />
                {errors.personalGoals && (
                  <p className="text-sm text-red-500">{errors.personalGoals}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="expectations">What are your expectations for this session? *</Label>
                <Textarea
                  id="expectations"
                  placeholder="What do you expect from this group wellness session?"
                  value={formData.expectations || ''}
                  onChange={(e) => handleInputChange('expectations', e.target.value)}
                  rows={3}
                />
                {errors.expectations && (
                  <p className="text-sm text-red-500">{errors.expectations}</p>
                )}
              </div>
            </>
          )}

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading}
          >
            {isLoading ? 'Submitting...' : 'Submit Introduction'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
