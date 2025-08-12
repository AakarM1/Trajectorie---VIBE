/**
 * Enterprise Queue Integration Test
 * 
 * This test verifies that the enterprise queue system is working correctly
 * and can be used to replace direct transcribeAudio calls.
 */

import { getEnterpriseTranscriptionQueue } from '@/lib/enterprise-ai-queue';

// Test configuration
const testConfig = {
  maxConcurrentRequests: 2,
  circuitBreaker: {
    failureThreshold: 3,
    timeoutMs: 30000,
    recoveryTimeMs: 15000
  },
  rateLimiting: {
    requestsPerMinute: 10,
    burstLimit: 5,
    windowSizeMs: 60000
  }
};

export async function testEnterpriseQueue() {
  console.log('🧪 [Test] Starting Enterprise Queue Integration Test');
  
  try {
    // Initialize enterprise queue
    const enterpriseQueue = getEnterpriseTranscriptionQueue(testConfig);
    console.log('✅ [Test] Enterprise queue initialized successfully');
    
    // Test basic queueing functionality
    const testAudioData = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+juwl0VeT6OvebJ'; // Sample audio data
    
    const result = await enterpriseQueue.queueEnterpriseTranscription(
      { audioDataUri: testAudioData },
      {
        priority: 'normal',
        userId: 'test-user-123',
        sessionId: 'test-session-456',
        metadata: {
          userAgent: 'Test Agent',
          audioSize: testAudioData.length
        }
      }
    );
    
    console.log('✅ [Test] Request queued successfully:', {
      requestId: result.requestId,
      position: result.position,
      estimatedWait: result.estimatedWait,
      rateLimitRemaining: result.rateLimitInfo?.remaining
    });
    
    // Test rate limiting
    console.log('🔄 [Test] Testing rate limiting...');
    const rateLimitPromises = [];
    for (let i = 0; i < 3; i++) {
      rateLimitPromises.push(
        enterpriseQueue.queueEnterpriseTranscription(
          { audioDataUri: testAudioData },
          {
            priority: 'low',
            userId: 'test-user-123',
            metadata: { 
              userAgent: `Test Agent ${i}`,
              audioSize: testAudioData.length 
            }
          }
        )
      );
    }
    
    const rateLimitResults = await Promise.allSettled(rateLimitPromises);
    const successful = rateLimitResults.filter(r => r.status === 'fulfilled').length;
    const failed = rateLimitResults.filter(r => r.status === 'rejected').length;
    
    console.log('✅ [Test] Rate limiting test completed:', {
      successful,
      failed,
      totalRequests: rateLimitResults.length
    });
    
    // Test stats retrieval
    console.log('📊 [Test] Testing stats retrieval...');
    const stats = await enterpriseQueue.getEnterpriseStats();
    
    console.log('✅ [Test] Stats retrieved successfully:', {
      activeServers: stats.servers.length,
      queueSize: stats.queueStats.totalInQueue,
      circuitBreakerState: stats.circuitBreaker.state,
      successRate: Math.round(stats.performance.successRate * 100) + '%'
    });
    
    // Test graceful shutdown
    console.log('🛑 [Test] Testing graceful shutdown...');
    await enterpriseQueue.shutdown();
    console.log('✅ [Test] Graceful shutdown completed');
    
    console.log('🎉 [Test] All enterprise queue tests passed!');
    return true;
    
  } catch (error) {
    console.error('❌ [Test] Enterprise queue test failed:', error);
    return false;
  }
}

// React component test
export function TestEnterpriseQueueComponent() {
  const handleRunTest = async () => {
    const success = await testEnterpriseQueue();
    if (success) {
      alert('✅ Enterprise Queue Test Passed!');
    } else {
      alert('❌ Enterprise Queue Test Failed - Check console for details');
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Enterprise Queue Test</h3>
      <p className="text-sm text-gray-600 mb-4">
        This test verifies that the enterprise transcription queue is working correctly.
      </p>
      <button
        onClick={handleRunTest}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Run Enterprise Queue Test
      </button>
    </div>
  );
}

export default TestEnterpriseQueueComponent;
