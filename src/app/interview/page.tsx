
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ProtectedRoute, useAuth } from '@/contexts/auth-context';
import type { ConversationEntry, AnalysisResult, PreInterviewDetails, InterviewMode } from '@/types';
import type { AnalyzeConversationInput } from '@/ai/flows/analyze-conversation';
import type { GenerateInterviewQuestionsInput } from '@/ai/flows/generate-follow-up-questions';
import Flashcard from '@/components/flashcard';
import ConversationSummary from '@/components/conversation-summary';
import { Loader2, PartyPopper } from 'lucide-react';
import Header from '@/components/header';
import { PreInterviewForm } from '@/components/interview/pre-interview-form';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { configurationService } from '@/lib/config-service';
const GLOBAL_SETTINGS_KEY = 'global-settings';


function VerbalInterviewPage() {
  const { user, saveSubmission } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [status, setStatus] = useState<'PRE_INTERVIEW' | 'INTERVIEW' | 'ANALYZING' | 'RESULTS' | 'COMPLETED'>('PRE_INTERVIEW');
  const [interviewMode, setInterviewMode] = useState<InterviewMode>('video');
  const [preInterviewDetails, setPreInterviewDetails] = useState<PreInterviewDetails | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ConversationEntry[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSavingAnswer, setIsSavingAnswer] = useState(false);
  const [jobDescription, setJobDescription] = useState('');
  const [timeLimit, setTimeLimit] = useState(0); // in minutes
  const [showReport, setShowReport] = useState(true);


  const startInterview = useCallback(async (details: PreInterviewDetails) => {
    setPreInterviewDetails(details);
    setStatus('INTERVIEW');
    setIsProcessing(true);
    try {
      let questionsToUse: ConversationEntry[] = [];
      let jd = 'A standard role description.';
      
      try {
        // Get global settings from database
        const globalSettings = await configurationService.getGlobalSettings();
        if (globalSettings) {
          if (globalSettings.replyMode) setInterviewMode(globalSettings.replyMode);
          if (globalSettings.showReport !== undefined) setShowReport(globalSettings.showReport);
        }

        // Get JDT configuration from database
        const savedConfig = await configurationService.getJDTConfig();
        if (savedConfig) {
          const { roles, settings } = savedConfig;
          const selectedRole = roles.find((r: any) => r.roleName === details.roleCategory);

          if (selectedRole) {
            jd = selectedRole.jobDescription;
            let manualQuestions = selectedRole.questions;
            const numManualQuestionsToUse = settings?.numberOfQuestions > 0 ? settings.numberOfQuestions : manualQuestions.length;

            if (numManualQuestionsToUse < manualQuestions.length) {
                manualQuestions.sort(() => 0.5 - Math.random()); // Shuffle questions
            }
            questionsToUse = manualQuestions.slice(0, numManualQuestionsToUse).map((q: any) => ({
                question: q.text,
                preferredAnswer: q.preferredAnswer,
                competency: q.competency,
                answer: null,
                videoDataUri: undefined,
            }));

            // Generate AI questions if configured
            const numAiQuestions = settings?.aiGeneratedQuestions || 0;
            if (numAiQuestions > 0) {
                toast({ title: `Generating ${numAiQuestions} AI interview questions...` });
                const aiQuestionsInput: GenerateInterviewQuestionsInput = {
                    roleCategory: details.roleCategory,
                    jobDescription: jd,
                    numberOfQuestions: numAiQuestions,
                    isFollowUp: true, // ensures no "hello" questions
                };
                const aiQuestionsResult = await fetch('/api/ai/generate-questions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(aiQuestionsInput)
                }).then(res => res.json());
                const aiGeneratedQuestions = aiQuestionsResult.questions.map((q: string) => ({
                    question: q,
                    preferredAnswer: "Evaluate for clarity, relevance, and depth.", // Generic guidance
                    competency: "AI-Assessed", // Generic competency
                    answer: null,
                    videoDataUri: undefined,
                }));
                questionsToUse = [...questionsToUse, ...aiGeneratedQuestions];
            }
          }

          // Translate all questions if language is not English
          if (details.language && details.language.toLowerCase() !== 'english' && questionsToUse.length > 0) {
              toast({ title: `Translating questions to ${details.language}...` });
              const translationPromises = questionsToUse.map(async (q) => {
                  const result = await fetch('/api/ai/translate', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ textToTranslate: q.question, targetLanguage: details.language })
                  }).then(res => res.json());
                  return result.translatedText;
              });
              const translatedResults = await Promise.all(translationPromises);
              questionsToUse = questionsToUse.map((q, index) => ({
                  ...q,
                  question: translatedResults[index],
              }));
          }

          if (settings?.timeLimit) {
            setTimeLimit(settings.timeLimit);
          }
        }
      } catch (error) {
        console.error('Error loading configuration from database:', error);
        toast({
          variant: 'destructive',
          title: 'Configuration Error',
          description: 'Failed to load configuration from database. Using default settings.',
        });
      }
      
      if (questionsToUse.length === 0) {
        toast({
            variant: 'destructive',
            title: 'No Questions Found',
            description: 'This role has no questions configured. Please contact an admin.',
        });
        setStatus('PRE_INTERVIEW');
        return;
      }
      setJobDescription(jd);
      setConversationHistory(questionsToUse);
    } catch (error) {
      console.error("Error starting interview:", error);
      toast({
        variant: 'destructive',
        title: 'Failed to Start Interview',
        description: 'Could not set up interview questions. Please try again.',
      });
      setStatus('PRE_INTERVIEW');
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  const handleFinishInterview = useCallback(async () => {
      const answeredHistory = conversationHistory.filter(e => e.answer);
      if (answeredHistory.length === 0) {
          toast({
              variant: 'destructive',
              title: 'No Answers Recorded',
              description: 'Please answer at least one question before finishing.',
          });
          return;
      }
      setStatus('ANALYZING');
      setIsProcessing(true);
      try {
        const analysisInput: AnalyzeConversationInput = {
          conversationHistory: answeredHistory.map(h => ({
              question: h.question,
              answer: h.answer!,
              preferredAnswer: h.preferredAnswer,
              competency: h.competency
          })),
          name: preInterviewDetails!.name,
          roleCategory: preInterviewDetails!.roleCategory,
          jobDescription: jobDescription,
        };
        const result = await fetch('/api/ai/analyze-conversation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(analysisInput)
        }).then(res => res.json());
        setAnalysisResult(result);
        
        saveSubmission({
            candidateName: preInterviewDetails!.name,
            testType: 'JDT',
            report: result,
            history: conversationHistory,
        });
        
        setStatus(showReport ? 'RESULTS' : 'COMPLETED');

      } catch (error) {
        console.error("Error analyzing conversation:", error);
        toast({
          variant: 'destructive',
          title: 'Analysis Failed',
          description: 'There was an error analyzing your responses. Please try again.',
        });
        setStatus('INTERVIEW');
      } finally {
        setIsProcessing(false);
      }
  }, [conversationHistory, preInterviewDetails, jobDescription, toast, saveSubmission, showReport]);


  const handleAnswerSubmit = async (answer: string, videoDataUri?: string) => {
    setIsSavingAnswer(true);
    const updatedHistory = [...conversationHistory];
    updatedHistory[currentQuestionIndex] = {
      ...updatedHistory[currentQuestionIndex],
      answer,
      videoDataUri,
    };
    setConversationHistory(updatedHistory);
    toast({
        title: "Answer Saved!",
        description: "You can move to the next question or review your answer.",
    });
    // Move to next question automatically
    if (currentQuestionIndex < conversationHistory.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
    setIsSavingAnswer(false);
  };
  
  useEffect(() => {
    if (user && !preInterviewDetails) {
        setPreInterviewDetails({ name: user.candidateName, roleCategory: user.role, language: 'English' });
    }
  }, [user, preInterviewDetails]);

  const handleReattempt = () => {
    router.push('/');
  };


  const currentEntry = conversationHistory[currentQuestionIndex];
  const answeredQuestionsCount = conversationHistory.filter(entry => entry.answer !== null).length;


  const renderContent = () => {
    switch (status) {
      case 'PRE_INTERVIEW':
        return <PreInterviewForm onFormSubmit={startInterview} defaultName={user?.candidateName} defaultRole={user?.role} />;
      case 'INTERVIEW':
        if (isProcessing || !currentEntry) {
           return (
              <div className="flex flex-col items-center justify-center text-center p-8 bg-card/60 backdrop-blur-xl rounded-lg shadow-lg">
                <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
                <h2 className="text-2xl font-headline text-primary">Preparing your interview...</h2>
                <p className="text-muted-foreground mt-2">This may take a moment.</p>
              </div>
           );
        }
        return (
          <div className="w-full max-w-6xl flex flex-col items-center">
            <Flashcard
              key={currentQuestionIndex}
              question={currentEntry.question}
              questionNumber={currentQuestionIndex + 1}
              totalQuestions={conversationHistory.length}
              onAnswerSubmit={handleAnswerSubmit}
              isProcessing={isSavingAnswer}
              isVisible={true}
              mode={interviewMode}
              isAnswered={currentEntry.answer !== null}
              onFinishInterview={handleFinishInterview}
              answeredQuestionsCount={answeredQuestionsCount}
              timeLimitInMinutes={timeLimit}
              onTimeUp={handleFinishInterview}
              currentQuestionIndex={currentQuestionIndex}
              setCurrentQuestionIndex={setCurrentQuestionIndex}
              conversationHistory={conversationHistory}
            />
          </div>
        );
      case 'ANALYZING':
        return (
          <div className="flex flex-col items-center justify-center text-center p-8 bg-card/60 backdrop-blur-xl rounded-lg shadow-lg">
            <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
            <h2 className="text-2xl font-headline text-primary">Analyzing your conversation...</h2>
            <p className="text-muted-foreground mt-2">This may take a moment.</p>
          </div>
        );
      case 'RESULTS':
        return analysisResult && (
          <ConversationSummary
            analysisResult={analysisResult}
            history={conversationHistory}
            onReattempt={handleReattempt}
            reattemptText="Back to Dashboard"
          />
        );
       case 'COMPLETED':
        return (
            <Card className="w-full max-w-lg text-center animate-fadeIn shadow-lg">
                <CardContent className="p-8">
                    <PartyPopper className="h-16 w-16 text-primary mx-auto mb-4" />
                    <h2 className="text-2xl font-headline text-primary mb-2">Assessment Complete!</h2>
                    <p className="text-muted-foreground mb-6">
                        Thank you for completing the assessment. Your responses have been submitted for review.
                    </p>
                    <Button onClick={() => router.push('/')}>
                        Back to Dashboard
                    </Button>
                </CardContent>
            </Card>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
        {renderContent()}
      </main>
    </div>
  );
}

export default function ProtectedVerbalInterviewPage() {
    return (
        <ProtectedRoute>
            <VerbalInterviewPage />
        </ProtectedRoute>
    )
}

    