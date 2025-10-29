'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, Shield } from 'lucide-react';

export default function LegalDocumentPage() {
  const params = useParams();
  const document = params.document as string;
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDocument = async () => {
      try {
        setLoading(true);
        setError(null);

        // Map document names to file paths
        const documentMap: Record<string, string> = {
          'terms-of-service': '/legal/terms-of-service.md',
          'privacy-policy': '/legal/privacy-policy.md',
          'terms': '/legal/terms-of-service.md',
          'privacy': '/legal/privacy-policy.md'
        };

        const filePath = documentMap[document];
        if (!filePath) {
          setError('Document not found');
          return;
        }

        const response = await fetch(filePath);
        if (!response.ok) {
          throw new Error('Failed to load document');
        }

        const text = await response.text();
        setContent(text);
      } catch (err) {
        setError('Failed to load document');
        console.error('Error loading document:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [document]);

  const getDocumentInfo = (doc: string) => {
    switch (doc) {
      case 'terms-of-service':
      case 'terms':
        return {
          title: 'Terms of Service',
          icon: FileText,
          description: 'Our terms and conditions for using ZenithWell'
        };
      case 'privacy-policy':
      case 'privacy':
        return {
          title: 'Privacy Policy',
          icon: Shield,
          description: 'How we collect, use, and protect your data'
        };
      default:
        return {
          title: 'Document',
          icon: FileText,
          description: 'Legal document'
        };
    }
  };

  const documentInfo = getDocumentInfo(document);

  const formatMarkdown = (text: string) => {
    return text
      .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold text-slate-900 dark:text-white mb-6">$1</h1>')
      .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-semibold text-slate-900 dark:text-white mb-4 mt-8">$1</h2>')
      .replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold text-slate-900 dark:text-white mb-3 mt-6">$1</h3>')
      .replace(/^#### (.*$)/gim, '<h4 class="text-lg font-semibold text-slate-900 dark:text-white mb-2 mt-4">$1</h4>')
      .replace(/^\*\*(.*?)\*\*/gim, '<strong class="font-semibold text-slate-900 dark:text-white">$1</strong>')
      .replace(/^\* (.*$)/gim, '<li class="ml-4 mb-1">$1</li>')
      .replace(/^- (.*$)/gim, '<li class="ml-4 mb-1">$1</li>')
      .replace(/\n\n/g, '</p><p class="mb-4 text-slate-700 dark:text-slate-300">')
      .replace(/^(?!<[h|l])/gm, '<p class="mb-4 text-slate-700 dark:text-slate-300">')
      .replace(/(<li.*<\/li>)/g, '<ul class="list-disc list-inside mb-4">$1</ul>')
      .replace(/<ul class="list-disc list-inside mb-4"><ul class="list-disc list-inside mb-4">/g, '<ul class="list-disc list-inside mb-4">')
      .replace(/<\/ul><\/ul>/g, '</ul>');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <documentInfo.icon className="w-8 h-8 text-white" />
          </div>
          <p className="text-slate-600 dark:text-slate-400">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <Card className="max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              Document Not Found
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              The requested document could not be loaded.
            </p>
            <Button onClick={() => window.history.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Button 
            onClick={() => window.history.back()}
            variant="ghost"
            className="mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
              <documentInfo.icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                {documentInfo.title}
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                {documentInfo.description}
              </p>
            </div>
          </div>
        </div>

        {/* Document Content */}
        <Card>
          <CardContent className="pt-8">
            <div 
              className="prose prose-slate dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ 
                __html: formatMarkdown(content) 
              }}
            />
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Questions about this document? Contact us at{' '}
            <a 
              href="mailto:legal@zenithwell.com" 
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              legal@zenithwell.com
            </a>
          </p>
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
