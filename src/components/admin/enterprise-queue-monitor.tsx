'use client';

/**
 * Enterprise Transcription Queue Monitoring Dashboard
 * 
 * Provides comprehensive real-time monitoring for the enterprise queue system:
 * - Server status and coordination
 * - Circuit breaker state
 * - Queue statistics by priority and status
 * - Rate limiting information
 * - Performance metrics and analytics
 * - Manual queue management controls
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  Server, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Users, 
  Zap,
  TrendingUp,
  Shield,
  Database,
  RefreshCw,
  XCircle,
  Pause,
  Play
} from 'lucide-react';
import { getEnterpriseTranscriptionQueue } from '@/lib/enterprise-ai-queue';

interface EnterpriseQueueMonitorProps {
  className?: string;
}

interface QueueStats {
  servers: Array<{
    serverId: string;
    status: 'active' | 'shutting_down' | 'dead';
    lastHeartbeat: Date;
    activeRequests: number;
    totalProcessed: number;
    isLeader?: boolean;
    version: string;
    capabilities: string[];
  }>;
  circuitBreaker: {
    state: 'closed' | 'open' | 'half_open';
    failureCount: number;
    lastFailureAt?: Date;
    lastSuccessAt?: Date;
    openedAt?: Date;
  };
  queueStats: {
    byPriority: Record<string, number>;
    byStatus: Record<string, number>;
    totalInQueue: number;
  };
  rateLimits: {
    activeUsers: number;
    averageUsage: number;
  };
  performance: {
    averageProcessingTime: number;
    throughputPerMinute: number;
    errorRate: number;
    successRate: number;
  };
}

export function EnterpriseQueueMonitor({ className = '' }: EnterpriseQueueMonitorProps) {
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const enterpriseQueue = getEnterpriseTranscriptionQueue();

  // Helper function to convert Firestore Timestamp to Date
  const toDate = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    if (timestamp instanceof Date) {
      return timestamp;
    }
    return new Date(timestamp);
  };

  const fetchStats = async () => {
    try {
      setRefreshing(true);
      const rawStats = await enterpriseQueue.getEnterpriseStats();
      
      // Convert Firestore Timestamps to Dates
      const newStats: QueueStats = {
        servers: rawStats.servers.map(server => ({
          ...server,
          lastHeartbeat: toDate(server.lastHeartbeat)
        })),
        circuitBreaker: {
          ...rawStats.circuitBreaker,
          lastFailureAt: rawStats.circuitBreaker.lastFailureAt ? 
            toDate(rawStats.circuitBreaker.lastFailureAt) : undefined,
          lastSuccessAt: rawStats.circuitBreaker.lastSuccessAt ? 
            toDate(rawStats.circuitBreaker.lastSuccessAt) : undefined,
          openedAt: rawStats.circuitBreaker.openedAt ? 
            toDate(rawStats.circuitBreaker.openedAt) : undefined
        },
        queueStats: rawStats.queueStats,
        rateLimits: rawStats.rateLimits,
        performance: rawStats.performance
      };
      
      setStats(newStats);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch enterprise queue stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchStats, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'shutting_down': return 'bg-yellow-500';
      case 'dead': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getCircuitBreakerColor = (state: string) => {
    switch (state) {
      case 'closed': return 'text-green-600';
      case 'open': return 'text-red-600';
      case 'half_open': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'normal': return 'bg-blue-100 text-blue-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatTimestamp = (date: Date) => {
    const seconds = Math.floor((date.getTime() - Date.now()) / 1000);
    
    if (Math.abs(seconds) < 60) {
      return `${Math.abs(seconds)} seconds ago`;
    }
    
    const minutes = Math.floor(Math.abs(seconds) / 60);
    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    }
    
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  };

  if (loading && !stats) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Loading enterprise queue stats...</span>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className={`p-4 ${className}`}>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Stats</AlertTitle>
          <AlertDescription>
            {error}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchStats}
              className="mt-2"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Enterprise Queue Monitor</h2>
          <p className="text-muted-foreground">
            Real-time monitoring of the enterprise transcription queue system
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {autoRefresh ? 'Pause' : 'Resume'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStats}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Servers</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.servers.filter(s => s.status === 'active').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.servers.length || 0} total servers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Queue Size</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.queueStats.totalInQueue || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              requests waiting
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats ? Math.round(stats.performance.successRate * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              last hour
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Circuit Breaker</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getCircuitBreakerColor(stats?.circuitBreaker.state || 'closed')}`}>
              {stats?.circuitBreaker.state.toUpperCase() || 'CLOSED'}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.circuitBreaker.failureCount || 0} failures
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Monitoring */}
      <Tabs defaultValue="servers" className="w-full">
        <TabsList>
          <TabsTrigger value="servers">Servers</TabsTrigger>
          <TabsTrigger value="queue">Queue Status</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="circuit">Circuit Breaker</TabsTrigger>
        </TabsList>

        {/* Servers Tab */}
        <TabsContent value="servers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Server Status</CardTitle>
              <CardDescription>
                Active servers in the enterprise queue cluster
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.servers.map((server) => (
                  <div
                    key={server.serverId}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(server.status)}`} />
                      <div>
                        <div className="font-medium">
                          {server.serverId}
                          {server.isLeader && (
                            <Badge variant="secondary" className="ml-2">
                              Leader
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Version {server.version}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {server.activeRequests} active / {server.totalProcessed} total
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Last seen {formatTimestamp(server.lastHeartbeat)}
                      </div>
                    </div>
                  </div>
                )) || (
                  <div className="text-center text-muted-foreground py-8">
                    No servers currently active
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Queue Status Tab */}
        <TabsContent value="queue" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Queue by Priority</CardTitle>
                <CardDescription>
                  Requests grouped by priority level
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(stats?.queueStats.byPriority || {}).map(([priority, count]) => (
                    <div key={priority} className="flex items-center justify-between">
                      <Badge className={getPriorityColor(priority)}>
                        {priority}
                      </Badge>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Queue by Status</CardTitle>
                <CardDescription>
                  Requests grouped by processing status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(stats?.queueStats.byStatus || {}).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {status === 'completed' && <CheckCircle className="h-4 w-4 text-green-500" />}
                        {status === 'processing' && <Activity className="h-4 w-4 text-blue-500" />}
                        {status === 'failed' && <XCircle className="h-4 w-4 text-red-500" />}
                        {status === 'queued' && <Clock className="h-4 w-4 text-yellow-500" />}
                        <span className="capitalize">{status}</span>
                      </div>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Processing Metrics</CardTitle>
                <CardDescription>
                  Performance statistics for the last hour
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Average Processing Time</span>
                    <span>{formatDuration(stats?.performance.averageProcessingTime || 0)}</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Throughput</span>
                    <span>{stats?.performance.throughputPerMinute || 0} req/min</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Success Rate</span>
                    <span>{Math.round((stats?.performance.successRate || 0) * 100)}%</span>
                  </div>
                  <Progress value={(stats?.performance.successRate || 0) * 100} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Error Rate</span>
                    <span>{Math.round((stats?.performance.errorRate || 0) * 100)}%</span>
                  </div>
                  <Progress 
                    value={(stats?.performance.errorRate || 0) * 100} 
                    className="h-2"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rate Limiting</CardTitle>
                <CardDescription>
                  Current rate limiting status
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Active Users</span>
                  <span className="font-medium">{stats?.rateLimits.activeUsers || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Average Usage</span>
                  <span className="font-medium">{stats?.rateLimits.averageUsage || 0}%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Circuit Breaker Tab */}
        <TabsContent value="circuit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Circuit Breaker Status</CardTitle>
              <CardDescription>
                System protection and fault tolerance status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Shield className={`h-6 w-6 ${getCircuitBreakerColor(stats?.circuitBreaker.state || 'closed')}`} />
                    <div>
                      <div className="font-medium">
                        Circuit Breaker State
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Current protection status
                      </div>
                    </div>
                  </div>
                  <Badge 
                    variant={stats?.circuitBreaker.state === 'closed' ? 'secondary' : 'destructive'}
                    className="text-sm"
                  >
                    {stats?.circuitBreaker.state.toUpperCase() || 'CLOSED'}
                  </Badge>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Failure Count</div>
                    <div className="text-2xl font-bold">
                      {stats?.circuitBreaker.failureCount || 0}
                    </div>
                  </div>
                  
                  {stats?.circuitBreaker.lastFailureAt && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Last Failure</div>
                      <div className="text-sm text-muted-foreground">
                        {formatTimestamp(stats.circuitBreaker.lastFailureAt)}
                      </div>
                    </div>
                  )}
                  
                  {stats?.circuitBreaker.lastSuccessAt && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Last Success</div>
                      <div className="text-sm text-muted-foreground">
                        {formatTimestamp(stats.circuitBreaker.lastSuccessAt)}
                      </div>
                    </div>
                  )}
                  
                  {stats?.circuitBreaker.openedAt && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Opened At</div>
                      <div className="text-sm text-muted-foreground">
                        {formatTimestamp(stats.circuitBreaker.openedAt)}
                      </div>
                    </div>
                  )}
                </div>

                {stats?.circuitBreaker.state === 'open' && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Service Protection Active</AlertTitle>
                    <AlertDescription>
                      The circuit breaker is currently open due to high failure rates. 
                      The system will automatically attempt recovery shortly.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default EnterpriseQueueMonitor;
