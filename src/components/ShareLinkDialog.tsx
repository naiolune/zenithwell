'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, RefreshCw, QrCode, Users, Clock, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

interface ShareLinkDialogProps {
  sessionId: string;
  currentParticipants: number;
  maxParticipants: number;
  isOwner: boolean;
  onRefresh?: () => void;
}

interface InviteData {
  invite_code: string;
  expires_at: string;
  max_participants: number;
  invite_url: string;
}

export function ShareLinkDialog({ 
  sessionId, 
  currentParticipants, 
  maxParticipants, 
  isOwner,
  onRefresh 
}: ShareLinkDialogProps) {
  const [open, setOpen] = useState(false);
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const supabase = createClient();

  // Calculate time remaining
  useEffect(() => {
    if (!inviteData?.expires_at) return;

    const updateTimeLeft = () => {
      const now = new Date();
      const expires = new Date(inviteData.expires_at);
      const diff = expires.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft('Expired');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${seconds}s`);
      }
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [inviteData?.expires_at]);

  const createInvite = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/group/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          sessionId,
          maxParticipants
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create invite');
      }

      const data = await response.json();
      setInviteData(data);
    } catch (error) {
      console.error('Error creating invite:', error);
      toast.error('Failed to create invite link');
    } finally {
      setIsLoading(false);
    }
  };

  const revokeInvite = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/group/invite', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to revoke invite');
      }

      setInviteData(null);
      toast.success('Invite link revoked');
    } catch (error) {
      console.error('Error revoking invite:', error);
      toast.error('Failed to revoke invite link');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for non-HTTPS
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      toast.success('Copied to clipboard');
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen && !inviteData) {
      createInvite();
    }
  };

  const isExpired = inviteData && new Date(inviteData.expires_at) <= new Date();
  const isFull = currentParticipants >= maxParticipants;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Users className="w-4 h-4 mr-2" />
          Share Session
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Group Session</DialogTitle>
          <DialogDescription>
            Invite others to join your group wellness session
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Participant Count */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Participants</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{currentParticipants}</span>
                <span className="text-muted-foreground">/ {maxParticipants}</span>
              </div>
              {isFull && (
                <Badge variant="destructive" className="mt-2">
                  Session Full
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* Invite Link */}
          {inviteData && !isExpired ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-url">Invite Link</Label>
                <div className="flex space-x-2">
                  <Input
                    id="invite-url"
                    value={inviteData.invite_url}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={() => copyToClipboard(inviteData.invite_url)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Expiration Timer */}
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Expires in: {timeLeft}</span>
              </div>

              {/* Security Info */}
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Shield className="w-4 h-4" />
                <span>Link expires in 24 hours for security</span>
              </div>

              {/* Actions */}
              {isOwner && (
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={createInvite}
                    disabled={isLoading}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh Link
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={revokeInvite}
                    disabled={isLoading}
                  >
                    Revoke Link
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              {isExpired ? (
                <div className="space-y-2">
                  <p className="text-muted-foreground">Invite link has expired</p>
                  <Button onClick={createInvite} disabled={isLoading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Create New Link
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-muted-foreground">Creating invite link...</p>
                  <div className="flex justify-center">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* QR Code Placeholder */}
          {inviteData && !isExpired && (
            <div className="text-center">
              <Button variant="ghost" size="sm">
                <QrCode className="w-4 h-4 mr-2" />
                Show QR Code
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
