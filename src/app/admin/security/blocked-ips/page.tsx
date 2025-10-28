'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Plus, Trash2, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { IPSecurity } from '@/lib/security/ip-security';

interface BlockedIP {
  id: string;
  ip_address: string;
  reason: string;
  blocked_at: string;
  expires_at?: string;
  is_permanent: boolean;
  created_by?: string;
  users?: {
    email: string;
  };
}

interface BlockedIPsResult {
  blockedIPs: BlockedIP[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export default function BlockedIPsPage() {
  const [blockedIPs, setBlockedIPs] = useState<BlockedIPsResult>({
    blockedIPs: [],
    totalCount: 0,
    totalPages: 0,
    currentPage: 1,
  });
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newIP, setNewIP] = useState({
    ipAddress: '',
    reason: '',
    duration: '24',
    isPermanent: false,
  });
  const [adding, setAdding] = useState(false);
  const [filters, setFilters] = useState({
    isPermanent: undefined as boolean | undefined,
    reason: '',
  });

  useEffect(() => {
    loadBlockedIPs();
  }, [blockedIPs.currentPage, filters]);

  const loadBlockedIPs = async () => {
    try {
      setLoading(true);
      const result = await IPSecurity.getBlockedIPs(blockedIPs.currentPage, 50, filters);
      setBlockedIPs(result);
    } catch (error) {
      console.error('Failed to load blocked IPs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddIP = async () => {
    if (!newIP.ipAddress || !newIP.reason) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setAdding(true);
      const durationHours = newIP.isPermanent ? undefined : parseInt(newIP.duration);
      
      await IPSecurity.blockIP(
        newIP.ipAddress,
        newIP.reason,
        durationHours,
        newIP.isPermanent
      );

      // Reset form and reload
      setNewIP({
        ipAddress: '',
        reason: '',
        duration: '24',
        isPermanent: false,
      });
      setShowAddForm(false);
      loadBlockedIPs();
    } catch (error) {
      console.error('Failed to block IP:', error);
      alert('Failed to block IP address');
    } finally {
      setAdding(false);
    }
  };

  const handleUnblockIP = async (ipAddress: string) => {
    if (!confirm(`Are you sure you want to unblock ${ipAddress}?`)) {
      return;
    }

    try {
      await IPSecurity.unblockIP(ipAddress);
      loadBlockedIPs();
    } catch (error) {
      console.error('Failed to unblock IP:', error);
      alert('Failed to unblock IP address');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const getTimeRemaining = (expiresAt?: string) => {
    if (!expiresAt) return 'Permanent';
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Blocked IPs</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage blocked IP addresses and security restrictions
          </p>
        </div>
        <Button onClick={() => setShowAddForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Block IP
        </Button>
      </div>

      {/* Add IP Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Block New IP Address</CardTitle>
            <CardDescription>
              Add an IP address to the blocklist
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  IP Address *
                </label>
                <Input
                  placeholder="192.168.1.1"
                  value={newIP.ipAddress}
                  onChange={(e) => setNewIP(prev => ({ ...prev, ipAddress: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Duration
                </label>
                <Select
                  value={newIP.isPermanent ? 'permanent' : newIP.duration}
                  onValueChange={(value) => {
                    if (value === 'permanent') {
                      setNewIP(prev => ({ ...prev, isPermanent: true }));
                    } else {
                      setNewIP(prev => ({ ...prev, isPermanent: false, duration: value }));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 hour</SelectItem>
                    <SelectItem value="24">24 hours</SelectItem>
                    <SelectItem value="168">7 days</SelectItem>
                    <SelectItem value="720">30 days</SelectItem>
                    <SelectItem value="permanent">Permanent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Reason *
              </label>
              <Textarea
                placeholder="Reason for blocking this IP address"
                value={newIP.reason}
                onChange={(e) => setNewIP(prev => ({ ...prev, reason: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddIP} disabled={adding}>
                {adding ? 'Blocking...' : 'Block IP'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Block Type
              </label>
              <Select 
                value={filters.isPermanent === undefined ? '' : filters.isPermanent.toString()} 
                onValueChange={(value) => setFilters(prev => ({ 
                  ...prev, 
                  isPermanent: value === '' ? undefined : value === 'true' 
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All types</SelectItem>
                  <SelectItem value="false">Temporary</SelectItem>
                  <SelectItem value="true">Permanent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Reason
              </label>
              <Input
                placeholder="Filter by reason"
                value={filters.reason}
                onChange={(e) => setFilters(prev => ({ ...prev, reason: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Blocked IPs List */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Blocked IP Addresses</CardTitle>
              <CardDescription>
                {blockedIPs.totalCount.toLocaleString()} blocked IPs
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadBlockedIPs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {blockedIPs.blockedIPs.length === 0 ? (
              <div className="text-center py-8">
                <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">No blocked IPs found</p>
              </div>
            ) : (
              blockedIPs.blockedIPs.map((blockedIP) => (
                <div key={blockedIP.id} className="border dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Badge variant={blockedIP.is_permanent ? 'destructive' : 'default'}>
                        {blockedIP.is_permanent ? 'Permanent' : 'Temporary'}
                      </Badge>
                      <span className="font-mono text-lg font-medium text-gray-900 dark:text-white">
                        {blockedIP.ip_address}
                      </span>
                      {isExpired(blockedIP.expires_at) && (
                        <Badge variant="secondary">Expired</Badge>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnblockIP(blockedIP.ip_address)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Unblock
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Reason:</span>
                      <div className="text-gray-900 dark:text-white">
                        {blockedIP.reason}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Blocked:</span>
                      <div className="text-gray-900 dark:text-white">
                        {formatDate(blockedIP.blocked_at)}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Expires:</span>
                      <div className="text-gray-900 dark:text-white flex items-center">
                        {blockedIP.is_permanent ? (
                          <span className="flex items-center">
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            Never
                          </span>
                        ) : (
                          <span className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            {blockedIP.expires_at ? formatDate(blockedIP.expires_at) : 'Unknown'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {!blockedIP.is_permanent && blockedIP.expires_at && !isExpired(blockedIP.expires_at) && (
                    <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      Time remaining: {getTimeRemaining(blockedIP.expires_at)}
                    </div>
                  )}
                  {blockedIP.users && (
                    <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      Blocked by: {blockedIP.users.email}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {blockedIPs.totalPages > 1 && (
            <div className="flex justify-between items-center mt-6">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Page {blockedIPs.currentPage} of {blockedIPs.totalPages} ({blockedIPs.totalCount.toLocaleString()} total)
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBlockedIPs(prev => ({ ...prev, currentPage: Math.max(1, prev.currentPage - 1) }))}
                  disabled={blockedIPs.currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBlockedIPs(prev => ({ ...prev, currentPage: Math.min(blockedIPs.totalPages, prev.currentPage + 1) }))}
                  disabled={blockedIPs.currentPage === blockedIPs.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
