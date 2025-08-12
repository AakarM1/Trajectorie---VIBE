/**
 * Admin Dashboard Component for Transcription Queue Monitoring
 * 
 * Provides comprehensive monitoring and management of the transcription queue:
 * - Real-time queue statistics
 * - Performance analytics
 * - Request management
 * - System health monitoring
 */

"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Users, 
  BarChart3, 
  RefreshCw,
  Trash2,
  Download,
  Settings
} from 'lucide-react';
import { getPersistentTranscriptionQueue, type QueueAnalytics } from '@/lib/persistent-ai-queue';
import { useToast } from '@/hooks/use-toast';

interface QueueMonitorProps {
  isAdmin?: boolean;
}

export function TranscriptionQueueMonitor({ isAdmin = false }: QueueMonitorProps) {
  const [queueStats, setQueueStats] = useState({
    queueSize: 0,
    processing: 0,
    completed: 0,
    maxConcurrent: 3
  });
  const [analytics, setAnalytics] = useState<QueueAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'hour' | 'day' | 'week'>('day');
  const { toast } = useToast();

  const queueService = getPersistentTranscriptionQueue();

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [selectedTimeRange]);

  const loadData = async () => {
    try {
      // Get current queue stats
      const currentStats = queueService.getQueueStats();
      setQueueStats(currentStats);

      // Get analytics
      const analyticsData = await queueService.getQueueAnalytics(selectedTimeRange);
      setAnalytics(analyticsData);

      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load queue data:', error);
      toast({
        variant: "destructive",
        title: "Failed to load queue data",
        description: "Please try refreshing the page.",
      });
    }
  };

  const handleClearCompleted = async () => {
    try {
      await queueService.clearCompleted();
      toast({
        title: "Completed requests cleared",
        description: "All completed transcription requests have been removed.",
      });
      loadData();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to clear completed requests",
        description: "Please try again.",
      });
    }
  };

  const exportAnalytics = () => {
    if (!analytics) return;
    
    const data = {
      timestamp: new Date().toISOString(),
      timeRange: selectedTimeRange,
      analytics
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcription-analytics-${selectedTimeRange}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Loading queue data...
        </CardContent>
      </Card>
    );
  }

  const getHealthStatus = () => {
    if (!analytics) return { status: 'unknown', color: 'gray' };
    
    if (analytics.errorRate > 0.1) return { status: 'critical', color: 'red' };
    if (analytics.errorRate > 0.05) return { status: 'warning', color: 'yellow' };
    if (queueStats.queueSize > 50) return { status: 'warning', color: 'yellow' };
    return { status: 'healthy', color: 'green' };
  };

  const healthStatus = getHealthStatus();

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Transcription Queue Monitor</h2>
          <p className="text-muted-foreground">Real-time monitoring and analytics</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge 
            variant="secondary" 
            className={`bg-${healthStatus.color}-100 text-${healthStatus.color}-800`}
          >
            <Activity className="h-3 w-3 mr-1" />
            {healthStatus.status}
          </Badge>
          
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={loadData}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={exportAnalytics}>
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Queue Size</p>
                <p className="text-2xl font-bold">{queueStats.queueSize}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Processing</p>
                <p className="text-2xl font-bold">{queueStats.processing}</p>
              </div>
              <RefreshCw className="h-8 w-8 text-yellow-500" />
            </div>
            <div className="mt-2">
              <Progress 
                value={(queueStats.processing / queueStats.maxConcurrent) * 100} 
                className="h-2" 
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{analytics?.completedRequests || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Error Rate</p>
                <p className="text-2xl font-bold">
                  {analytics ? `${(analytics.errorRate * 100).toFixed(1)}%` : '0%'}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs value={selectedTimeRange} onValueChange={(value) => setSelectedTimeRange(value as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="hour">Last Hour</TabsTrigger>
          <TabsTrigger value="day">Last Day</TabsTrigger>
          <TabsTrigger value="week">Last Week</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTimeRange} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Average Processing Time</span>
                  <span className="font-medium">
                    {analytics?.averageProcessingTime.toFixed(1)}s
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm">Throughput per Hour</span>
                  <span className="font-medium">
                    {analytics?.throughputPerHour.toFixed(1)} requests
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm">Total Requests</span>
                  <span className="font-medium">{analytics?.totalRequests}</span>
                </div>
              </CardContent>
            </Card>

            {/* Priority Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Priority Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analytics?.priorityDistribution && 
                  Object.entries(analytics.priorityDistribution).map(([priority, count]) => (
                    <div key={priority} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          priority === 'urgent' ? 'destructive' :
                          priority === 'high' ? 'default' :
                          priority === 'normal' ? 'secondary' : 'outline'
                        }>
                          {priority}
                        </Badge>
                      </div>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))
                }
              </CardContent>
            </Card>
          </div>

          {/* Peak Hours */}
          {analytics?.peakHours && analytics.peakHours.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Peak Usage Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  {analytics.peakHours.map(({ hour, count }) => (
                    <div key={hour} className="text-center p-2 bg-muted rounded">
                      <div className="font-medium">{hour}:00</div>
                      <div className="text-sm text-muted-foreground">{count} requests</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Admin Actions */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Queue Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClearCompleted}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Completed
              </Button>
              
              <Button variant="outline" disabled>
                <AlertTriangle className="h-4 w-4 mr-2" />
                Pause Queue
              </Button>
              
              <Button variant="outline" disabled>
                <RefreshCw className="h-4 w-4 mr-2" />
                Restart Workers
              </Button>
            </div>
            
            <div className="text-sm text-muted-foreground">
              Additional queue management features will be available in future updates.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
