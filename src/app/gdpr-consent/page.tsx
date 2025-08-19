"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GDPRConsent, type ConsentRecord } from '@/components/gdpr-consent';
import { useConsent } from '@/contexts/consent-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function GDPRConsentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { recordConsent, sessionId, generateSessionId } = useConsent();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testType, setTestType] = useState<'JDT' | 'SJT'>('JDT');
  const [currentSessionId, setCurrentSessionId] = useState('');
  
  // Get parameters from URL
  useEffect(() => {
    const urlTestType = searchParams.get('testType') as 'JDT' | 'SJT' | null;
    const urlSessionId = searchParams.get('sessionId');
    
    // Validate and set test type
    if (urlTestType && ['JDT', 'SJT'].includes(urlTestType)) {
      setTestType(urlTestType);
    }
    
    // Use session ID from URL or generate/use existing one
    if (urlSessionId) {
      setCurrentSessionId(urlSessionId);
    } else if (sessionId) {
      setCurrentSessionId(sessionId);
    } else {
      const newSessionId = generateSessionId();
      setCurrentSessionId(newSessionId);
    }
  }, [searchParams, sessionId, generateSessionId]);
  
  // Determine redirect path based on test type
  const getRedirectPath = (testType: 'JDT' | 'SJT') => {
    switch (testType) {
      case 'JDT':
        return '/interview';
      case 'SJT':
        return '/sjt';
      default:
        return '/';
    }
  };
  
  // Handle consent acceptance
  const handleConsentAccept = async (consentRecord: ConsentRecord) => {
    setIsSubmitting(true);
    
    try {
      console.log('📝 [GDPR Page] Processing consent acceptance for:', testType);
      
      // Record consent through the context
      const recordedConsent = await recordConsent({
        ...consentRecord,
        testType,
      });
      
      console.log('✅ [GDPR Page] Consent recorded successfully:', recordedConsent.consentId);
      
      // Show success message
      toast({
        title: 'Consent Recorded Successfully',
        description: `Thank you for providing consent. Proceeding to ${testType} assessment.`,
      });
      
      // Small delay to let the user see the success message
      setTimeout(() => {
        const redirectPath = getRedirectPath(testType);
        console.log('🔄 [GDPR Page] Redirecting to:', redirectPath);
        router.push(redirectPath);
      }, 1500);
      
    } catch (error) {
      console.error('❌ [GDPR Page] Error recording consent:', error);
      
      toast({
        variant: 'destructive',
        title: 'Consent Recording Failed',
        description: 'There was an error recording your consent. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle consent decline
  const handleConsentDecline = () => {
    console.log('🚫 [GDPR Page] User declined consent for:', testType);
    
    // Show confirmation and redirect to home
    toast({
      variant: 'destructive',
      title: 'Consent Declined',
      description: 'You cannot proceed with the assessment without providing consent.',
      duration: 5000,
    });
    
    // Redirect to home page after a short delay
    setTimeout(() => {
      router.push('/');
    }, 2000);
  };
  
  // Handle back navigation
  const handleGoBack = () => {
    router.back();
  };
  
  // Show loading state if session ID is not ready
  if (!currentSessionId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold mb-2">Initializing Session</h2>
            <p className="text-gray-600">Please wait while we set up your consent session...</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with back button */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center">
            <Button
              variant="ghost"
              onClick={handleGoBack}
              className="mr-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Data Processing Consent Required
              </h1>
              <p className="text-sm text-gray-600">
                {testType === 'JDT' ? 'Job Description Test' : 'Situational Judgement Test'} Assessment
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main content */}
      <div className="py-8">
        <GDPRConsent
          testType={testType}
          sessionId={currentSessionId}
          onAccept={handleConsentAccept}
          onDecline={handleConsentDecline}
          isSubmitting={isSubmitting}
        />
      </div>
      
      {/* Footer */}
      <div className="bg-white border-t py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-sm text-gray-500">
            <p>
              This consent is required under GDPR for data processing during your assessment.
            </p>
            <p className="mt-1">
              Session ID: {currentSessionId.slice(0, 8)}... | Test Type: {testType}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
