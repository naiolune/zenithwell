'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, Users, Activity, Clock, Eye } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { APILogger } from '@/lib/security/api-logger';
import { RateLimiter } from '@/lib/security/rate-limiter';
import { IPSecurity } from '@/lib/security/ip-security';

interface SecurityStats {
  totalRequests24h: number;
  blockedIPs24h: number;
  rateLimitViolations24h: number;
  suspiciousActivities24h: number;
  criticalAlerts: number;
}

export default function SecurityDashboard() {
  const [stats, setStats] = useState<SecurityStats>({
    totalRequests24h: 0,
    blockedIPs24h: 0,
    rateLimitViolations24h: 0,
    suspiciousActivities24h: 0,
    criticalAlerts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [recentViolations, setRecentViolations] = useState<any[]>([]);
  const [suspiciousActivity, setSuspiciousActivity] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    loadSecurityData();
  }, []);

  const loadSecurityData = async () => {
    try {
      setLoading(true);

      // Load API logs
      const logsResult = await APILogger.getLogs(1, 10);
      setRecentLogs(logsResult.logs);

      // Load rate limit violations
      const violationsResult = await APILogger.getRateLimitViolations(1, 10);
      setRecentViolations(violationsResult.violations);

      // Load suspicious activity
      const activityResult = await APILogger.getSuspiciousActivity(1, 10);
      setSuspiciousActivity(activityResult.activities);

      // Load security stats
      const [rateLimitStats, ipStats] = await Promise.all([
        RateLimiter.getRateLimitStats(),
        IPSecurity.getIPSecurityStats(),
      ]);

      setStats({
        totalRequests24h: logsResult.totalCount,
        blockedIPs24h: ipStats.blockedIPs24h,
        rateLimitViolations24h: rateLimitStats.totalViolations24h,
        suspiciousActivities24h: ipStats.suspiciousActivities24h,
        criticalAlerts: ipStats.criticalAlerts,
      });

    } catch (error) {
      console.error('Failed to load security data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const getStatusColor = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) return 'bg-green-100 text-green-800';
    if (statusCode >= 300 && statusCode < 400) return 'bg-blue-100 text-blue-800';
    if (statusCode >= 400 && statusCode < 500) return 'bg-yellow-100 text-yellow-800';
    if (statusCode >= 500) return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Security Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Monitor API security, rate limits, and suspicious activity
        </p>
      </div>

      {/* Security Stats */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Requests (24h)
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.totalRequests24h.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Blocked IPs (24h)
            </CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.blockedIPs24h}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Rate Limit Violations
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats.rateLimitViolations24h}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Critical Alerts
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.criticalAlerts}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent API Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Eye className="h-5 w-5 mr-2" />
              Recent API Logs
            </CardTitle>
            <CardDescription>
              Latest API requests and responses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentLogs.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No recent logs</p>
              ) : (
                recentLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-sm text-gray-900 dark:text-white">
                          {log.method}
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {log.endpoint}
                        </span>
                        <Badge className={getStatusColor(log.status_code)}>
                          {log.status_code}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {log.users?.email || 'Anonymous'} • {log.ip_address} • {log.response_time_ms}ms
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={() => window.location.href = '/admin/security/logs'}>
                View All Logs
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Rate Limit Violations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Rate Limit Violations
            </CardTitle>
            <CardDescription>
              Recent rate limit violations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentViolations.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No recent violations</p>
              ) : (
                recentViolations.map((violation) => (
                  <div key={violation.id} className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <Badge variant="destructive">
                          {violation.violation_type.replace('_', ' ').toUpperCase()}
                        </Badge>
                        <span className="text-sm text-gray-900 dark:text-white">
                          {violation.endpoint}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {violation.users?.email || 'Anonymous'} • {violation.ip_address}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(violation.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={() => window.location.href = '/admin/security/violations'}>
                View All Violations
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Suspicious Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            Suspicious Activity
          </CardTitle>
          <CardDescription>
            Recent security alerts and suspicious behavior
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {suspiciousActivity.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">No suspicious activity detected</p>
            ) : (
              suspiciousActivity.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <Badge variant={getSeverityColor(activity.severity) as any}>
                        {activity.severity.toUpperCase()}
                      </Badge>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {activity.activity_type.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {activity.users?.email || 'Anonymous'} • {activity.ip_address}
                      {activity.details && (
                        <span> • {JSON.stringify(activity.details)}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(activity.created_at).toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-4 flex space-x-2">
            <Button variant="outline" size="sm" onClick={() => window.location.href = '/admin/security/activity'}>
              View All Activity
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.location.href = '/admin/security/blocked-ips'}>
              Manage Blocked IPs
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common security management tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" onClick={() => window.location.href = '/admin/security/logs'}>
              <Eye className="h-4 w-4 mr-2" />
              View API Logs
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/admin/security/blocked-ips'}>
              <Shield className="h-4 w-4 mr-2" />
              Manage IPs
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/admin/security/violations'}>
              <AlertTriangle className="h-4 w-4 mr-2" />
              Rate Limits
            </Button>
            <Button variant="outline" onClick={loadSecurityData}>
              <Activity className="h-4 w-4 mr-2" />
              Refresh Data
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
