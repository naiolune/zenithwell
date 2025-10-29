'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, MessageCircle, Globe, AlertTriangle, Heart, Shield } from 'lucide-react';

export default function ResourcesPage() {
  const emergencyResources = [
    {
      title: 'National Suicide Prevention Lifeline',
      number: '988',
      description: '24/7 crisis support for anyone in emotional distress or suicidal crisis',
      icon: Phone,
      urgent: true,
      available: '24/7'
    },
    {
      title: 'Crisis Text Line',
      number: 'Text HOME to 741741',
      description: 'Free, 24/7 crisis support via text message',
      icon: MessageCircle,
      urgent: true,
      available: '24/7'
    },
    {
      title: 'SAMHSA National Helpline',
      number: '1-800-662-4357',
      description: 'Free, confidential treatment referral and information service',
      icon: Heart,
      urgent: false,
      available: '24/7'
    },
    {
      title: 'National Domestic Violence Hotline',
      number: '1-800-799-7233',
      description: 'Confidential support for anyone experiencing domestic violence',
      icon: Shield,
      urgent: false,
      available: '24/7'
    }
  ];

  const internationalResources = [
    {
      country: 'Canada',
      number: '1-833-456-4566',
      service: 'Crisis Services Canada'
    },
    {
      country: 'United Kingdom',
      number: '116 123',
      service: 'Samaritans'
    },
    {
      country: 'Australia',
      number: '13 11 14',
      service: 'Lifeline Australia'
    },
    {
      country: 'New Zealand',
      number: '0800 543 354',
      service: 'Lifeline New Zealand'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Crisis Resources
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            If you're experiencing a mental health emergency or crisis, please reach out to these resources immediately. 
            <strong className="text-red-600 dark:text-red-400"> ZenithWell is NOT a crisis service.</strong>
          </p>
        </div>

        {/* Emergency Resources */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-6 text-center">
            Emergency Resources (United States)
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {emergencyResources.map((resource, index) => (
              <Card 
                key={index} 
                className={`transition-all duration-200 hover:shadow-lg ${
                  resource.urgent 
                    ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20' 
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      resource.urgent 
                        ? 'bg-red-500 text-white' 
                        : 'bg-slate-500 text-white'
                    }`}>
                      <resource.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{resource.title}</CardTitle>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Available {resource.available}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                      {resource.number}
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">
                      {resource.description}
                    </p>
                    <Button 
                      className={`w-full ${
                        resource.urgent 
                          ? 'bg-red-500 hover:bg-red-600 text-white' 
                          : 'bg-slate-500 hover:bg-slate-600 text-white'
                      }`}
                      onClick={() => {
                        if (resource.number.includes('Text')) {
                          // For text line, copy to clipboard
                          navigator.clipboard.writeText('HOME');
                          alert('Copied "HOME" to clipboard. Send this text to 741741');
                        } else {
                          // For phone numbers, try to initiate call
                          window.open(`tel:${resource.number.replace(/[^\d]/g, '')}`);
                        }
                      }}
                    >
                      {resource.number.includes('Text') ? 'Copy Text Command' : 'Call Now'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* International Resources */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-6 text-center">
            International Resources
          </h2>
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-2">
                {internationalResources.map((resource, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {resource.country}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {resource.service}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-slate-900 dark:text-white">
                        {resource.number}
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => window.open(`tel:${resource.number.replace(/[^\d]/g, '')}`)}
                      >
                        Call
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* When to Seek Help */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-6 text-center">
            When to Seek Emergency Help
          </h2>
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-3">
                    Seek immediate help if you experience:
                  </h3>
                  <ul className="space-y-2 text-amber-700 dark:text-amber-300">
                    <li>• Thoughts of suicide or self-harm</li>
                    <li>• Thoughts of harming others</li>
                    <li>• Severe panic attacks</li>
                    <li>• Psychotic symptoms (hallucinations, delusions)</li>
                    <li>• Severe depression with inability to function</li>
                    <li>• Substance abuse crisis</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-3">
                    Go to the nearest emergency room if:
                  </h3>
                  <ul className="space-y-2 text-amber-700 dark:text-amber-300">
                    <li>• You have a plan to hurt yourself</li>
                    <li>• You have taken an overdose</li>
                    <li>• You are experiencing severe physical symptoms</li>
                    <li>• You feel unsafe or out of control</li>
                    <li>• You cannot keep yourself safe</li>
                    <li>• You need immediate medical attention</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Important Disclaimer */}
        <div className="text-center">
          <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center space-x-2 mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">
                  Important Disclaimer
                </h3>
              </div>
              <p className="text-red-700 dark:text-red-300 max-w-3xl mx-auto">
                <strong>ZenithWell is NOT a crisis intervention service.</strong> Our AI wellness coach 
                is designed for general wellness support and cannot provide emergency mental health care. 
                If you are experiencing a mental health emergency, please use the resources above or 
                call 911 immediately. Always consult with qualified healthcare professionals for 
                medical advice and treatment.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Back to App */}
        <div className="text-center mt-8">
          <Button 
            onClick={() => window.history.back()}
            variant="outline"
            className="px-8"
          >
            Back to ZenithWell
          </Button>
        </div>
      </div>
    </div>
  );
}
