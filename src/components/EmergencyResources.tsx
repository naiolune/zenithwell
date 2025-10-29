'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Phone, MessageSquare, Globe, Heart } from 'lucide-react';

interface EmergencyResourcesProps {
  urgencyLevel: 'high' | 'medium' | 'low';
  customMessage?: string;
}

export function EmergencyResources({ urgencyLevel, customMessage }: EmergencyResourcesProps) {
  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'high': return 'bg-red-100 border-red-300 text-red-800';
      case 'medium': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'low': return 'bg-blue-100 border-blue-300 text-blue-800';
      default: return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const getUrgencyIcon = (level: string) => {
    switch (level) {
      case 'high': return <AlertTriangle className="h-5 w-5" />;
      case 'medium': return <Heart className="h-5 w-5" />;
      case 'low': return <Globe className="h-5 w-5" />;
      default: return <Heart className="h-5 w-5" />;
    }
  };

  const resources = {
    high: [
      {
        name: 'National Suicide Prevention Lifeline',
        number: '988',
        description: 'Available 24/7, free, confidential',
        icon: <Phone className="h-4 w-4" />,
        urgent: true
      },
      {
        name: 'Crisis Text Line',
        number: 'Text HOME to 741741',
        description: 'Free, 24/7 crisis support via text',
        icon: <MessageSquare className="h-4 w-4" />,
        urgent: true
      },
      {
        name: 'Emergency Services',
        number: '911',
        description: 'For immediate danger to self or others',
        icon: <AlertTriangle className="h-4 w-4" />,
        urgent: true
      },
      {
        name: 'National Domestic Violence Hotline',
        number: '1-800-799-7233',
        description: '24/7 support for domestic violence',
        icon: <Phone className="h-4 w-4" />,
        urgent: false
      }
    ],
    medium: [
      {
        name: 'National Suicide Prevention Lifeline',
        number: '988',
        description: 'Available 24/7, free, confidential',
        icon: <Phone className="h-4 w-4" />,
        urgent: false
      },
      {
        name: 'Crisis Text Line',
        number: 'Text HOME to 741741',
        description: 'Free crisis support via text',
        icon: <MessageSquare className="h-4 w-4" />,
        urgent: false
      },
      {
        name: 'SAMHSA National Helpline',
        number: '1-800-662-4357',
        description: '24/7 treatment referral and information',
        icon: <Phone className="h-4 w-4" />,
        urgent: false
      },
      {
        name: 'National Alliance on Mental Illness (NAMI)',
        number: '1-800-950-6264',
        description: 'Information, referrals, and support',
        icon: <Phone className="h-4 w-4" />,
        urgent: false
      }
    ],
    low: [
      {
        name: 'National Suicide Prevention Lifeline',
        number: '988',
        description: 'Available 24/7 for any mental health crisis',
        icon: <Phone className="h-4 w-4" />,
        urgent: false
      },
      {
        name: 'Crisis Text Line',
        number: 'Text HOME to 741741',
        description: 'Free crisis support via text',
        icon: <MessageSquare className="h-4 w-4" />,
        urgent: false
      },
      {
        name: 'SAMHSA National Helpline',
        number: '1-800-662-4357',
        description: 'Treatment referral and information',
        icon: <Phone className="h-4 w-4" />,
        urgent: false
      },
      {
        name: 'Mental Health America',
        number: 'mhanational.org',
        description: 'Resources and screening tools',
        icon: <Globe className="h-4 w-4" />,
        urgent: false
      }
    ]
  };

  const currentResources = resources[urgencyLevel];

  return (
    <Card className={`border-2 ${getUrgencyColor(urgencyLevel)}`}>
      <CardHeader>
        <div className="flex items-center space-x-2">
          {getUrgencyIcon(urgencyLevel)}
          <CardTitle className="text-lg">
            {urgencyLevel === 'high' ? '🚨 Crisis Resources 🚨' : 
             urgencyLevel === 'medium' ? 'Mental Health Support Resources' : 
             'Wellness Resources'}
          </CardTitle>
        </div>
        <CardDescription>
          {urgencyLevel === 'high' ? 'You are not alone. Please reach out for help immediately.' :
           urgencyLevel === 'medium' ? 'Remember, seeking help is a sign of strength.' :
           'Take care of yourself. Support is available when you need it.'}
        </CardDescription>
        {customMessage && (
          <div className="mt-2 p-2 bg-white/50 rounded-md">
            <p className="text-sm font-medium">
              {urgencyLevel === 'high' ? 'Personal Message:' : 
               urgencyLevel === 'medium' ? 'Note:' : 'Gentle Reminder:'} {customMessage}
            </p>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {currentResources.map((resource, index) => (
          <div key={index} className="flex items-start space-x-3 p-3 bg-white/30 rounded-lg">
            <div className="flex-shrink-0 mt-0.5">
              {resource.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <h4 className="font-semibold text-sm">{resource.name}</h4>
                {resource.urgent && (
                  <Badge variant="destructive" className="text-xs">
                    URGENT
                  </Badge>
                )}
              </div>
              <p className="font-mono text-sm font-medium text-gray-700 mt-1">
                {resource.number}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {resource.description}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
