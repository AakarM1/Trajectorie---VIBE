"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Download, AlertCircle, Check, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

export interface ConsentRecord {
  consentId: string;
  personId?: string;
  sessionId: string;
  consentTextVersion: string;
  checkboxAccepted: boolean;
  name: string;
  signature: string;
  date: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  localeAtConsent: string;
  hash: string;
  withdrawn: boolean;
  withdrawnAt?: string;
}

interface GDPRConsentProps {
  testType: 'JDT' | 'SJT';
  sessionId: string;
  onAccept: (consentRecord: ConsentRecord) => Promise<void>;
  onDecline: () => void;
  isSubmitting?: boolean;
}

// GDPR Consent Text - RENDERED VERBATIM as required
const GDPR_CONSENT_TEXT = `Disclaimer – AI-Based Personality Assessment for HR Use (GDPR-Compliant)
This personality assessment has been generated using an AI system that processes speech content (including translated text), vocal features and other acoustic signals, and facial expressions. The analysis is powered by third-party technologies, including Google language libraries and Gemini, and is intended to provide supplementary behavioural insights in a corporate Human Resources context.
The results of this assessment are generated through automated processing and machine learning models. They are not intended to replace human judgment or serve as the sole basis for recruitment, promotion, or other employment-related decisions. The insights offered should be interpreted in conjunction with other assessment tools.
Data Protection and GDPR Compliance
All personal data processed in the course of generating this assessment is handled in compliance with the General Data Protection Regulation (Regulation (EU) 2016/679). The processing is based on the lawful basis of explicit consent and is limited to the specific purpose of personality and communication style assessment for HR evaluation.
Data subjects have the right to access, rectify, or erase their personal data, restrict or object to processing, and to withdraw consent at any time without affecting the lawfulness of processing based on consent before its withdrawal. No personal data is shared with third parties without proper safeguards and agreements in place.
Trajectorie takes appropriate technical and organisational measures to ensure data security, integrity, and confidentiality. For any queries or to exercise your data protection rights, please contact our Data Protection Officer at [Insert contact email].

Consent Declaration
I, the undersigned, hereby give my explicit and informed consent for Trajectorie to collect, process, and analyse my speech, voice, and facial data for the sole purpose of generating an AI-based personality assessment in connection with HR-related evaluations. I understand that the assessment results may be reviewed by authorised personnel for recruitment, team-building, or training purposes, and that they will not be used as the sole basis for any employment decision.
I acknowledge that I have read and understood the above disclaimer, including my rights under the GDPR. I understand that I may withdraw my consent at any time by contacting Trajectorie (solutions@trajectorie.com), and that doing so will not affect any prior lawful processing.
Name: ____________________________
Signature: _________________________
Date: _____________________________`;

const CONSENT_TEXT_VERSION = "GDPR-HR-AI-Consent-v1.0-2025-08-18";

export function GDPRConsent({ testType, sessionId, onAccept, onDecline, isSubmitting = false }: GDPRConsentProps) {
  const { toast } = useToast();
  
  // Form state
  const [hasReadAndAgreed, setHasReadAndAgreed] = useState(false);
  const [name, setName] = useState('');
  const [signature, setSignature] = useState('');
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD format
  });
  
  // UI state
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Refs for accessibility
  const consentTextRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  
  // Auto-fill signature when name changes (typed name approach)
  useEffect(() => {
    if (name.trim()) {
      setSignature(name.trim());
    } else {
      setSignature('');
    }
  }, [name]);
  
  // Form validation
  const isFormValid = hasReadAndAgreed && name.trim().length > 0 && signature.trim().length > 0 && date;
  
  // Handle consent acceptance
  const handleAcceptConsent = async () => {
    if (!isFormValid) {
      toast({
        variant: 'destructive',
        title: 'Incomplete Form',
        description: 'Please complete all required fields and accept the consent terms.',
      });
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Generate consent ID
      const consentId = crypto.randomUUID();
      
      // Get current timestamp
      const timestamp = new Date().toISOString();
      
      // Get user agent
      const userAgent = navigator.userAgent;
      
      // Create canonicalized string for hash
      const canonicalString = `${CONSENT_TEXT_VERSION}|${name.trim()}|${date}|${timestamp}`;
      
      // Generate hash (simplified approach - in production, use proper crypto)
      const encoder = new TextEncoder();
      const data = encoder.encode(canonicalString);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Create consent record
      const consentRecord: ConsentRecord = {
        consentId,
        sessionId,
        consentTextVersion: CONSENT_TEXT_VERSION,
        checkboxAccepted: hasReadAndAgreed,
        name: name.trim(),
        signature: signature.trim(),
        date,
        timestamp,
        userAgent,
        localeAtConsent: navigator.language || 'en',
        hash,
        withdrawn: false,
      };
      
      // Call the onAccept handler
      await onAccept(consentRecord);
      
      toast({
        title: 'Consent Recorded',
        description: 'Thank you for providing your consent. Proceeding to assessment.',
      });
      
    } catch (error) {
      console.error('Error processing consent:', error);
      toast({
        variant: 'destructive',
        title: 'Consent Processing Failed',
        description: 'There was an error recording your consent. Please try again.',
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Handle consent decline
  const handleDeclineConsent = () => {
    setShowDeclineModal(false);
    onDecline();
    
    toast({
      variant: 'destructive',
      title: 'Consent Declined',
      description: 'You must accept the GDPR consent to continue with the assessment.',
    });
  };
  
  // Generate PDF (placeholder - would need server-side implementation)
  const handleDownloadPDF = () => {
    toast({
      title: 'PDF Download',
      description: 'PDF generation feature will be available soon.',
    });
  };
  
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl shadow-2xl">
        <CardHeader className="text-center border-b">
          <CardTitle className="text-3xl font-bold text-gray-900">
            GDPR Data Processing Consent
          </CardTitle>
          <p className="text-lg text-gray-600 mt-2">
            {testType === 'JDT' ? 'Job Description Test' : 'Situational Judgement Test'} Assessment
          </p>
          <Alert className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please read the complete disclaimer and consent declaration below carefully before proceeding.
            </AlertDescription>
          </Alert>
        </CardHeader>
        
        <CardContent className="p-6 space-y-6">
          {/* Consent Text Display */}
          <div>
            <Label className="text-lg font-semibold mb-3 block">
              Data Processing Disclaimer and Consent Declaration
            </Label>
            <ScrollArea className="h-80 border-2 border-gray-200 rounded-lg p-4 bg-white">
              <div 
                ref={consentTextRef}
                className="whitespace-pre-line text-sm leading-relaxed text-gray-800"
                role="document"
                aria-label="GDPR consent text"
              >
                {GDPR_CONSENT_TEXT}
              </div>
            </ScrollArea>
          </div>
          
          <Separator />
          
          {/* Consent Checkbox */}
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="consent-agreement"
                checked={hasReadAndAgreed}
                onCheckedChange={setHasReadAndAgreed}
                className="mt-1"
                aria-describedby="consent-description"
              />
              <div className="grid gap-1.5 leading-none">
                <Label
                  htmlFor="consent-agreement"
                  className="text-base font-medium leading-relaxed cursor-pointer"
                >
                  I have read and agree to the GDPR consent and processing terms.
                </Label>
                <p id="consent-description" className="text-sm text-gray-600">
                  By checking this box, you provide explicit consent for data processing as described above.
                </p>
              </div>
            </div>
          </div>
          
          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="consent-name" className="text-base font-medium">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="consent-name"
                ref={nameInputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                className="text-base"
                required
                aria-describedby="name-description"
              />
              <p id="name-description" className="text-sm text-gray-600">
                Enter your full legal name as it appears on official documents.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="consent-signature" className="text-base font-medium">
                Digital Signature <span className="text-red-500">*</span>
              </Label>
              <Input
                id="consent-signature"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Your typed name serves as digital signature"
                className="text-base italic"
                required
                aria-describedby="signature-description"
              />
              <p id="signature-description" className="text-sm text-gray-600">
                Your typed name automatically serves as your digital signature.
              </p>
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="consent-date" className="text-base font-medium">
                Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="consent-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="text-base w-full md:w-auto"
                required
                aria-describedby="date-description"
              />
              <p id="date-description" className="text-sm text-gray-600">
                Date of consent (automatically set to today's date, editable if needed).
              </p>
            </div>
          </div>
          
          <Separator />
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Dialog open={showDeclineModal} onOpenChange={setShowDeclineModal}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="flex-1 py-3 text-base"
                  disabled={isProcessing || isSubmitting}
                >
                  <X className="mr-2 h-4 w-4" />
                  Decline
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Decline Consent</DialogTitle>
                  <DialogDescription>
                    If you decline to provide consent, you cannot proceed with the assessment. 
                    Are you sure you want to decline?
                  </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end space-x-2 pt-4">
                  <Button variant="outline" onClick={() => setShowDeclineModal(false)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleDeclineConsent}>
                    Yes, Decline
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            
            <Button
              onClick={handleAcceptConsent}
              disabled={!isFormValid || isProcessing || isSubmitting}
              className="flex-1 py-3 text-base bg-green-600 hover:bg-green-700"
            >
              {isProcessing || isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Agree & Continue
                </>
              )}
            </Button>
          </div>
          
          {/* Optional PDF Download */}
          <div className="pt-4 border-t">
            <Button
              variant="ghost"
              onClick={handleDownloadPDF}
              className="w-full sm:w-auto text-blue-600 hover:text-blue-800"
              disabled={!isFormValid}
            >
              <Download className="mr-2 h-4 w-4" />
              Download a copy (PDF)
            </Button>
          </div>
          
          {/* Footer */}
          <div className="text-center pt-4">
            <p className="text-sm text-gray-500">
              For questions about data processing, contact:{' '}
              <a href="mailto:solutions@trajectorie.com" className="text-blue-600 hover:underline">
                solutions@trajectorie.com
              </a>
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Consent Version: {CONSENT_TEXT_VERSION} | Session ID: {sessionId.slice(0, 8)}...
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
