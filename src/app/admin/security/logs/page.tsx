'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, Search, Filter, Download, RefreshCw } from 'lucide-react';
import { APILogger } from '@/lib/security/api-logger';

interface LogEntry {
  id: string;
  user_id?: string;
  endpoint: string;
  method: string;
  status_code: number;
  ip_address: string;
  user_agent?: string;
  response_time_ms: number;
  created_at: string;
  users?: {
    email: string;
    subscription_tier: string;
  };
}

interface LogsResult {
  logs: LogEntry[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export default function APILogsPage() {
  const [logs, setLogs] = useState<LogsResult>({
    logs: [],
    totalCount: 0,
    totalPages: 0,
    currentPage: 1,
  });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    userId: '',
    endpoint: '',
    statusCode: undefined as number | undefined,
    startDate: '',
    endDate: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    loadLogs();
  }, [currentPage, pageSize, filters]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const result = await APILogger.getLogs(currentPage, pageSize, filters);
      setLogs(result);
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string | number | undefined) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      userId: '',
      endpoint: '',
      statusCode: undefined,
      startDate: '',
      endDate: '',
    });
    setCurrentPage(1);
  };

  const getStatusColor = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
    if (statusCode >= 300 && statusCode < 400) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
    if (statusCode >= 400 && statusCode < 500) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
    if (statusCode >= 500) return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'POST': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'PUT': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'DELETE': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatResponseTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">API Logs</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Monitor all API requests and responses
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                User Email
              </label>
              <Input
                placeholder="Filter by user email"
                value={filters.userId}
                onChange={(e) => handleFilterChange('userId', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Endpoint
              </label>
              <Input
                placeholder="Filter by endpoint"
                value={filters.endpoint}
                onChange={(e) => handleFilterChange('endpoint', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status Code
              </label>
              <Select 
                value={filters.statusCode === undefined ? '' : filters.statusCode.toString()} 
                onValueChange={(value) => handleFilterChange('statusCode', value === '' ? undefined : parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All status codes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All status codes</SelectItem>
                  <SelectItem value="200">200 - OK</SelectItem>
                  <SelectItem value="400">400 - Bad Request</SelectItem>
                  <SelectItem value="401">401 - Unauthorized</SelectItem>
                  <SelectItem value="403">403 - Forbidden</SelectItem>
                  <SelectItem value="404">404 - Not Found</SelectItem>
                  <SelectItem value="429">429 - Too Many Requests</SelectItem>
                  <SelectItem value="500">500 - Internal Server Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date
              </label>
              <Input
                type="datetime-local"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Date
              </label>
              <Input
                type="datetime-local"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-between items-center mt-4">
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Page size:</span>
              <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(parseInt(value))}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>API Requests</CardTitle>
              <CardDescription>
                {logs.totalCount.toLocaleString()} total requests
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadLogs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {logs.logs.length === 0 ? (
              <div className="text-center py-8">
                <Eye className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">No logs found</p>
              </div>
            ) : (
              logs.logs.map((log) => (
                <div key={log.id} className="border dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Badge className={getMethodColor(log.method)}>
                        {log.method}
                      </Badge>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {log.endpoint}
                      </span>
                      <Badge className={getStatusColor(log.status_code)}>
                        {log.status_code}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(log.created_at)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">User:</span>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {log.users?.email || 'Anonymous'}
                        {log.users?.subscription_tier && (
                          <Badge variant="outline" className="ml-2">
                            {log.users.subscription_tier}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">IP Address:</span>
                      <div className="font-mono text-gray-900 dark:text-white">
                        {log.ip_address}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Response Time:</span>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {formatResponseTime(log.response_time_ms)}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">User Agent:</span>
                      <div className="text-gray-900 dark:text-white truncate" title={log.user_agent || 'N/A'}>
                        {log.user_agent || 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {logs.totalPages > 1 && (
            <div className="flex justify-between items-center mt-6">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Page {logs.currentPage} of {logs.totalPages} ({logs.totalCount.toLocaleString()} total)
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(logs.totalPages, prev + 1))}
                  disabled={currentPage === logs.totalPages}
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
