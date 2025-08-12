
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ProtectedRoute, useAuth } from '@/contexts/auth-context';
import type { ConversationEntry, AnalysisResult, PreInterviewDetails, InterviewMode, Submission } from '@/types';
import type { AnalyzeSJTResponseInput, AnalyzeSJTResponseOutput } from '@/ai/flows/analyze-sjt-response';
import type { EvaluateAnswerQualityInput, EvaluateAnswerQualityOutput } from '@/ai/flows/evaluate-answer-quality';
import Flashcard from '@/components/flashcard';
import ConversationSummary from '@/components/conversation-summary';
import { Loader2, PartyPopper } from 'lucide-react';
import Header from '@/components/header';
import { useToast } from '@/hooks/use-toast';
import { SJTInstructions } from '@/components/sjt/sjt-instructions';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { configurationService } from '@/lib/config-service';
// 🔒 MINIMAL IMPACT IMPORTS - Progressive upload support for SJT
import { ProgressiveProvider, useProgressive } from '@/contexts/progressive-context';
import { featureFlags } from '@/lib/feature-flags';
import type { ProgressInfo, SaveResult } from '@/types/partial-submission';


interface Scenario {
  id: number;
  situation: string;
  question: string;
  bestResponseRationale: string;
  worstResponseRationale: string;
  assessedCompetency: string;
}

// Fallback scenarios if nothing is configured in the admin dashboard
const fallbackSjtScenarios: Scenario[] = [
  {
    id: 1,
    situation: "A key customer is very unhappy with a recent product delivery that was delayed, and they are threatening to take their business to a competitor. This customer accounts for a significant portion of your quarterly revenue.",
    question: "What is your immediate plan of action to handle this situation?",
    bestResponseRationale: "Acknowledge the customer's frustration with empathy, take full ownership of the problem without making excuses, and immediately propose a concrete solution such as expediting the next shipment for free. The focus should be on solving the customer's problem first and rebuilding trust.",
    worstResponseRationale: "Become defensive, blame the logistics team or external factors, or make promises that cannot be kept. A poor response would fail to acknowledge the customer's importance and the severity of the issue.",
    assessedCompetency: "Customer Focus, Problem Solving, Communication",
  },
  {
    id: 2,
    situation: "You notice that a junior member of your team has been struggling to keep up with their workload and their quality of work has been declining. They seem disengaged during team meetings.",
    question: "How would you approach this situation with your team member?",
    bestResponseRationale: "Schedule a private, one-on-one meeting to express concern and create a safe space for them to share any challenges. The ideal approach is to listen actively, ask open-ended questions to understand the root cause (be it workload, personal issues, or skill gaps), and collaboratively develop a support plan.",
    worstResponseRationale: "Criticize the team member publicly, immediately put them on a performance improvement plan without discussion, or simply ignore the problem hoping it will resolve itself. A bad response lacks empathy and fails to investigate the underlying issues.",
    assessedCompetency: "Coaching & Mentoring, Leadership, Emotional Intelligence",
  },
];


function SJTInterviewPage() {
  const { user, saveSubmission, canUserTakeTest, getSubmissions } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  // 🔒 MINIMAL IMPACT PROGRESSIVE HOOKS - Only used if feature enabled for SJT
  const progressive = useProgressive();

  const [status, setStatus] = useState<'PRE_INTERVIEW' | 'INTERVIEW' | 'RESULTS' | 'UPLOADING' | 'COMPLETED'>('PRE_INTERVIEW');
  const [interviewMode, setInterviewMode] = useState<InterviewMode>('video');
  const [preInterviewDetails, setPreInterviewDetails] = useState<PreInterviewDetails | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ConversationEntry[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSavingAnswer, setIsSavingAnswer] = useState(false);
  const [sjtScenarios, setSjtScenarios] = useState<Scenario[]>(fallbackSjtScenarios);
  const [timeLimit, setTimeLimit] = useState(0); // in minutes
  const [showReport, setShowReport] = useState(true);
  const [questionTimes, setQuestionTimes] = useState<number[]>([]); // Track time per question
  const [canTakeTest, setCanTakeTest] = useState(true);
  const [checkingAttempts, setCheckingAttempts] = useState(true);
  const [followUpMap, setFollowUpMap] = useState<{[key: number]: number}>({}); // Track follow-up count per question
  const [maxFollowUps, setMaxFollowUps] = useState(2); // Default max follow-ups per scenario
  
  const MAX_ATTEMPTS = 1;

  // Check if user can take the test
  useEffect(() => {
    const checkAttempts = async () => {
      try {
        const canTake = await canUserTakeTest('SJT', MAX_ATTEMPTS);
        setCanTakeTest(canTake);
        if (!canTake) {
          toast({
            variant: 'destructive',
            title: 'Maximum Attempts Reached',
            description: `You have already completed the maximum number of attempts (${MAX_ATTEMPTS}) for this test.`,
          });
        }
      } catch (error) {
        console.error('Error checking attempts:', error);
        setCanTakeTest(true); // Allow test if check fails
      } finally {
        setCheckingAttempts(false);
      }
    };

    checkAttempts();
  }, [canUserTakeTest, toast]);

  const startInterview = useCallback(async (details: PreInterviewDetails) => {
    setStatus('INTERVIEW');
    setPreInterviewDetails(details);
    setIsProcessing(true);
    
    // 🔒 MINIMAL IMPACT - Initialize progressive session
    if (progressive.isProgressiveUploadEnabled) {
      console.log('🚀 Initializing progressive session for SJT...');
      const sessionId = progressive.startNewSession('SJT');
      console.log('✅ Progressive session started with ID:', sessionId);
    }

    let scenariosToUse = fallbackSjtScenarios;

    try {
      // Get global settings from database
      const globalSettings = await configurationService.getGlobalSettings();
      if (globalSettings) {
        if (globalSettings.replyMode) setInterviewMode(globalSettings.replyMode);
        if (globalSettings.showReport !== undefined) setShowReport(globalSettings.showReport);
      }
      
      // Get SJT configuration from database
      const savedConfig = await configurationService.getSJTConfig();
      if (savedConfig) {
        const { scenarios, settings } = savedConfig;
        if (scenarios && scenarios.length > 0) {
          let allScenarios = scenarios;
          const numQuestionsToUse = settings?.numberOfQuestions > 0 ? settings.numberOfQuestions : allScenarios.length;
          
          if (numQuestionsToUse < allScenarios.length) {
            allScenarios.sort(() => 0.5 - Math.random());
          }
          scenariosToUse = allScenarios.slice(0, numQuestionsToUse);
          
          // Check if AI follow-up questions are enabled
          const numAiQuestions = settings?.aiGeneratedQuestions || 0;
          if (numAiQuestions > 0) {
            console.log(`🤖 Setting max follow-up questions per scenario to ${numAiQuestions}`);
            
            // Instead of generating all follow-up questions upfront,
            // we'll just set the maximum number of follow-ups allowed per scenario
            setMaxFollowUps(numAiQuestions);
            
            // Initialize the follow-up map to track follow-ups per question
            const initialFollowUpMap: {[key: number]: number} = {};
            scenariosToUse.forEach((_, index) => {
              initialFollowUpMap[index + 1] = 0; // No follow-ups generated initially
            });
            setFollowUpMap(initialFollowUpMap);
            
            toast({ 
              title: `Adaptive Follow-up Questions Enabled`,
              description: `Up to ${numAiQuestions} follow-up questions will be generated based on your answers.`
            });
          } else {
            // No AI follow-up questions enabled
            setMaxFollowUps(0);
          }
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
        description: 'Failed to load configuration from database. Using fallback scenarios.',
      });
    }
    
    // Translate scenarios if language is not English
    if (details.language && details.language.toLowerCase() !== 'english') {
        toast({ title: `Translating scenarios to ${details.language}...` });
        const translatedScenarios = await Promise.all(scenariosToUse.map(async (s) => {
            const [translatedSituation, translatedQuestion] = await Promise.all([
                fetch('/api/ai/translate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ textToTranslate: s.situation, targetLanguage: details.language })
                }).then(res => res.json()),
                fetch('/api/ai/translate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ textToTranslate: s.question, targetLanguage: details.language })
                }).then(res => res.json())
            ]);
            return {
                ...s,
                situation: translatedSituation.translatedText,
                question: translatedQuestion.translatedText,
            };
        }));
        scenariosToUse = translatedScenarios;
    }

    setSjtScenarios(scenariosToUse);

    // Create history with all the scenario data needed for AI analysis
    const history = scenariosToUse.map(s => ({ 
      question: `Situation: ${s.situation}\n\nQuestion: ${s.question}`,
      answer: null, 
      videoDataUri: undefined,
      // Add admin-defined criteria fields for AI analysis
      situation: s.situation,
      bestResponseRationale: s.bestResponseRationale,
      worstResponseRationale: s.worstResponseRationale,
      assessedCompetency: s.assessedCompetency
    }));
    setConversationHistory(history);
    
    // Initialize question times array
    setQuestionTimes(new Array(scenariosToUse.length).fill(0));
    
    setIsProcessing(false);
  }, [toast]);

  const handleFinishInterview = useCallback(async () => {
      console.log('🏁 Finish button clicked');
      
      const answeredHistory = conversationHistory.filter(e => e.answer);
      if (answeredHistory.length === 0) {
          toast({
              variant: 'destructive',
              title: 'No Answers Recorded',
              description: 'Please answer at least one question before finishing.',
          });
          return;
      }
      
      console.log(`📊 Processing ${answeredHistory.length} answers`);
      setStatus('UPLOADING'); // Set status to uploading first if progressive upload is enabled
      setIsProcessing(true);
      
      // 🔒 MINIMAL IMPACT - Mark progressive session complete if enabled
      if (progressive.isProgressiveUploadEnabled && progressive.currentSessionId) {
        console.log('🏁 Marking progressive session complete...');
        try {
          await progressive.markSessionComplete();
          console.log('✅ Progressive session marked complete');
        } catch (error) {
          console.error('❌ Error marking progressive session complete:', error);
          // Continue with submission anyway
        }
      }
      
      // Set completed status after uploads are done
      setStatus('COMPLETED');
      
      try {
        // First, save the submission to database immediately
        console.log('💾 Saving submission to database...');
        
        // Extract competencies from scenarios
        const assessedCompetencies = sjtScenarios
          .filter((_, index) => conversationHistory[index]?.answer) // Only include answered scenarios
          .map(scenario => scenario.assessedCompetency)
          .filter(Boolean);
        
        // Count unique competencies
        const uniqueCompetencies = [...new Set(assessedCompetencies)];
        
        // Generate competency scores (initially all the same placeholder value)
        const competencyScores = uniqueCompetencies.map(competency => ({
          name: competency,
          score: 5 // Placeholder middle score - will be replaced by AI analysis
        }));
        
        // Create a basic result structure with proper competencies
        const basicResult: AnalysisResult = {
            strengths: `Candidate completed ${answeredHistory.length} out of ${sjtScenarios.length} scenarios. Responses demonstrate engagement with the situational judgement test.`,
            weaknesses: "Detailed analysis pending. Please review individual responses for comprehensive feedback.",
            summary: `SJT Assessment completed on ${new Date().toLocaleDateString()}. ${answeredHistory.length} scenarios answered out of ${sjtScenarios.length} total scenarios. Analysis will evaluate ${uniqueCompetencies.length} competency areas.`,
            competencyAnalysis: competencyScores.length > 0 ? [{
                name: "Situational Competencies",
                competencies: competencyScores
            }] : [{
                name: "Assessment Completion",
                competencies: [{
                    name: "Overall Participation",
                    score: Math.round((answeredHistory.length / sjtScenarios.length) * 10)
                }]
            }]
        };

        // Save submission immediately with basic analysis
        const submission = await saveSubmission({
            candidateName: preInterviewDetails!.name,
            testType: 'SJT',
            report: basicResult,
            history: conversationHistory,
        });

        console.log('✅ Submission saved successfully');

        // Note: We remove background analysis triggering here since it will happen from admin side

        toast({
          title: 'Thank you for your submission!',
          description: 'The hiring team will get back to you with the next steps.',
        });
        
      } catch (error) {
        console.error("❌ Error in finish interview:", error);
        toast({
          variant: 'destructive',
          title: 'Submission Failed',
          description: 'There was an error saving your responses. Please try again.',
        });
        setStatus('INTERVIEW');
      } finally {
        setIsProcessing(false);
      }
  }, [conversationHistory, preInterviewDetails, saveSubmission, sjtScenarios, toast, showReport]);


  // Import evaluate-answer-quality at the top of the file
  const handleAnswerSubmit = async (answer: string, videoDataUri?: string) => {
    setIsSavingAnswer(true);
    // Show saving toast with improved styling
    toast({
      title: "Saving Answer",
      description: "Processing your response...",
      duration: 3000,
      className: "bg-gray-50 border border-gray-200 text-gray-800",
    });
    
    const updatedHistory = [...conversationHistory];
    updatedHistory[currentQuestionIndex] = {
      ...updatedHistory[currentQuestionIndex],
      answer,
      videoDataUri,
    };
    setConversationHistory(updatedHistory);
    
    // 🔒 MINIMAL IMPACT - Progressive upload if enabled
    if (progressive.isProgressiveUploadEnabled && progressive.currentSessionId) {
      console.log('🔄 Progressive upload enabled, saving answer with upload...');
      try {
        const result = await progressive.saveQuestionWithUpload(
          currentQuestionIndex,
          updatedHistory[currentQuestionIndex],
          'SJT',
          updatedHistory.length,
          (progress, type) => {
            // Show upload progress toast if it's taking time
            if (progress === 25 || progress === 50 || progress === 75) {
              toast({
                title: `Uploading ${type} (${progress}%)`,
                description: "Please wait while your response is being securely saved...",
                duration: 2000,
                className: "bg-blue-50 border border-blue-200 text-blue-800",
              });
            }
          }
        );
        
        if (!result.success) {
          console.warn('⚠️ Progressive save failed, continuing with regular flow:', result.error);
          // No need to show error to user - we'll continue with regular flow
        }
      } catch (error) {
        console.error('❌ Error in progressive save:', error);
        // Continue with regular flow, don't block the UI
      }
    }
    // Identify if this is a base question or a follow-up
    const currentScenario = sjtScenarios.find(s => {
      const questionText = updatedHistory[currentQuestionIndex].question;
      return questionText.includes(s.situation) && questionText.includes(s.question);
    });
    
    if (!currentScenario) {
      console.error("Could not identify current scenario for answer evaluation");
      toast({
        title: "Answer Saved!",
        description: "You can move to the next question or review your answer.",
      });
      setIsSavingAnswer(false);
      
      // Move to next question automatically
      if (currentQuestionIndex < conversationHistory.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      }
      return;
    }
    
    // Determine if this is already a follow-up or a base question
    const isFollowUp = updatedHistory[currentQuestionIndex].question.match(/\d+\.[a-z]\)/);
    
    // Get or extract the base question number depending on whether this is a follow-up
    let baseQuestionNumber;
    
    if (isFollowUp) {
      // Extract base question number from the follow-up question format (e.g., "1.a)" -> 1)
      const match = updatedHistory[currentQuestionIndex].question.match(/(\d+)\.[a-z]\)/);
      if (match && match[1]) {
        baseQuestionNumber = parseInt(match[1]);
      } else {
        console.error("Could not extract base question number from follow-up");
        baseQuestionNumber = currentScenario.id;
      }
      
      console.log(`This is follow-up question for base question ${baseQuestionNumber}`);
    } else {
      // For base questions, get the question number from the scenario ID
      baseQuestionNumber = sjtScenarios.findIndex(s => s.id === currentScenario.id) + 1;
    }
    
    try {
      // Get current follow-up count for this base question
      const currentFollowUpCount = followUpMap[baseQuestionNumber] || 0;
      
      // If we already have max follow-ups or max configured is 0, skip evaluation
      if (currentFollowUpCount >= maxFollowUps || maxFollowUps === 0) {
        console.log(`Skipping follow-up evaluation: current=${currentFollowUpCount}, max=${maxFollowUps}`);
        toast({
          title: "Answer Saved!",
          description: "Moving to the next question.",
          duration: 3000,
        });
        setIsSavingAnswer(false);
        
        // Move to next question automatically
        if (currentQuestionIndex < conversationHistory.length - 1) {
          setCurrentQuestionIndex(currentQuestionIndex + 1);
        }
        return;
      }
      
      // For follow-up questions, we need to increment the follow-up count for the base question
      // but use the same base question number for tracking
      
      toast({
        title: "Evaluating your answer...",
        description: "Please wait while we analyze your response.",
        duration: 5000, // 5 seconds duration
        className: "bg-blue-50 border border-blue-200 text-blue-800",
      });
      
      // Prepare input for evaluation
      const evaluationInput = {
        situation: currentScenario.situation,
        question: currentScenario.question,
        bestResponseRationale: currentScenario.bestResponseRationale,
        assessedCompetency: currentScenario.assessedCompetency,
        candidateAnswer: answer,
        questionNumber: baseQuestionNumber,
        followUpCount: currentFollowUpCount,
        maxFollowUps: maxFollowUps
      };
      
      console.log("🔍 Evaluating answer quality:", evaluationInput);
      
      // Use the API route to evaluate the answer quality
      const response = await fetch('/api/ai/evaluate-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evaluationInput)
      });
      
      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }
      
      const evaluation = await response.json();
      console.log("✅ Answer evaluation result:", evaluation);
      
      // Check if answer is complete or if we need a follow-up question
      if (!evaluation.isComplete && evaluation.followUpQuestion) {
        // Create a new follow-up question
        const newFollowUpScenario: Scenario = {
          id: currentScenario.id + 1000 + currentFollowUpCount, // Unique ID for follow-up
          situation: currentScenario.situation,
          question: evaluation.followUpQuestion,
          bestResponseRationale: currentScenario.bestResponseRationale,
          worstResponseRationale: currentScenario.worstResponseRationale,
          assessedCompetency: currentScenario.assessedCompetency
        };
        
        // Add the new scenario to our list
        const updatedScenarios = [...sjtScenarios];
        updatedScenarios.splice(currentQuestionIndex + 1, 0, newFollowUpScenario);
        setSjtScenarios(updatedScenarios);
        
        // Create conversation entry for the new follow-up with improved formatting
        const newConversationEntry = {
          // Format the question with proper spacing and highlighting for follow-up
          question: `Situation: ${newFollowUpScenario.situation}\n\nFollow-up Question: ${newFollowUpScenario.question}`,
          answer: null,
          videoDataUri: undefined,
          preferredAnswer: undefined, // 🔒 EXPLICIT undefined for SJT follow-ups
          competency: undefined, // 🔒 EXPLICIT undefined for SJT follow-ups
          situation: newFollowUpScenario.situation,
          bestResponseRationale: newFollowUpScenario.bestResponseRationale,
          worstResponseRationale: newFollowUpScenario.worstResponseRationale,
          assessedCompetency: newFollowUpScenario.assessedCompetency
        };
        
        // Update conversation history with new follow-up
        const newHistory = [...updatedHistory];
        newHistory.splice(currentQuestionIndex + 1, 0, newConversationEntry);
        
        // Mark the current question as having generated a follow-up for penalty calculation
        newHistory[currentQuestionIndex].followUpGenerated = true;
        
        setConversationHistory(newHistory);
        
        // Update follow-up count for this base question
        setFollowUpMap({
          ...followUpMap,
          [baseQuestionNumber]: currentFollowUpCount + 1
        });
        
        // Update question times array to match new structure
        const newQuestionTimes = [...questionTimes];
        newQuestionTimes.splice(currentQuestionIndex + 1, 0, 0);
        setQuestionTimes(newQuestionTimes);
        
        // Log AI rationale to console for debugging (not shown to user)
        console.log("Follow-up Question Generated - AI Rationale:", evaluation.rationale);
        
        toast({
          title: "Follow-up Question Generated",
          description: "Based on your response, we have a follow-up question to explore further.",
          duration: 5000, // 5 seconds duration
          className: "bg-green-50 border border-green-200 text-green-800", 
        });
        
        // Move specifically to the follow-up question we just inserted
        setIsSavingAnswer(false);
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        return; // Exit early to avoid the automatic navigation in finally block
      } else {
        // Log AI rationale to console for debugging (not shown to user)
        console.log("Answer Complete - AI Rationale:", evaluation.rationale);
        
        toast({
          title: "Answer Complete",
          description: "Your response has been recorded. Moving to the next question.",
          duration: 5000, // 5 seconds duration
          className: "bg-green-50 border border-green-200 text-green-800",
        });
      }
    } catch (error) {
      console.error("Error evaluating answer quality:", error);
    } finally {
      setIsSavingAnswer(false);
      
      // Move to next question automatically only if we didn't generate a follow-up
      if (currentQuestionIndex < conversationHistory.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      }
    }
  };
  
  useEffect(() => {
    if (user && !preInterviewDetails) {
        setPreInterviewDetails({ name: user.candidateName, roleCategory: "Situational Judgement Test", language: 'English' });
    }
  }, [user, preInterviewDetails]);

  const handleReattempt = () => {
    router.push('/');
  };

  const currentEntry = conversationHistory[currentQuestionIndex];
  const answeredQuestionsCount = conversationHistory.filter(entry => entry.answer !== null).length;

  // 🔒 MINIMAL IMPACT - Check for any active uploads
  const hasActiveUpload = useCallback(() => {
    if (!progressive.isProgressiveUploadEnabled || !progressive.uploadProgress) {
      return false;
    }
    
    return progressive.uploadProgress.size > 0;
  }, [progressive.isProgressiveUploadEnabled, progressive.uploadProgress]);
  
  const renderContent = () => {
    switch (status) {
      case 'PRE_INTERVIEW':
        return <SJTInstructions onProceed={startInterview} />;
      case 'INTERVIEW':
        if (isProcessing || !currentEntry) {
           return (
              <div className="flex flex-col items-center justify-center text-center p-8 bg-card/60 backdrop-blur-xl rounded-lg shadow-lg">
                <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
                <h2 className="text-2xl font-headline text-primary">Loading Scenarios...</h2>
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
              questionTimes={questionTimes}
              setQuestionTimes={setQuestionTimes}
            />
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
       case 'UPLOADING':
        return (
            <Card className="w-full max-w-lg text-center animate-fadeIn shadow-lg">
                <CardContent className="p-8">
                    <div className="h-16 w-16 text-blue-500 mx-auto mb-4 animate-pulse">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-headline text-primary mb-2">Finalizing your submission...</h2>
                    <p className="text-muted-foreground mb-6">
                        Please wait while we process your answers.
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6">
                        <div className="bg-blue-600 h-2.5 rounded-full animate-pulse" style={{ width: '80%' }}></div>
                    </div>
                </CardContent>
            </Card>
        );
      case 'COMPLETED':
        return (
            <Card className="w-full max-w-lg text-center animate-fadeIn shadow-lg">
                <CardContent className="p-8">
                    <div className="h-16 w-16 text-green-500 mx-auto mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-headline text-primary mb-2">Thank you for your submission!</h2>
                    <p className="text-muted-foreground mb-6">
                        The hiring team will get back to you with the next steps.
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
        {checkingAttempts ? (
          <div className="flex flex-col items-center justify-center text-center p-8">
            <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
            <h2 className="text-2xl font-headline text-primary">Checking access...</h2>
          </div>
        ) : (
          <div className={!canTakeTest ? "relative" : ""}>
            {/* Greyed out overlay when attempts exceeded */}
            {!canTakeTest && (
              <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
                <Card className="w-full max-w-lg text-center shadow-lg border-red-200 bg-white">
                  <CardContent className="p-8">
                    <div className="h-16 w-16 text-red-500 mx-auto mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-headline text-red-600 mb-2">Access Restricted</h2>
                    <p className="text-muted-foreground mb-6">
                      You have reached the maximum number of attempts ({MAX_ATTEMPTS}) for this test. 
                      Please contact your administrator if you need additional attempts.
                    </p>
                    <Button onClick={() => router.push('/')} variant="outline">
                      Back to Dashboard
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
            {/* Main content - always rendered but disabled when attempts exceeded */}
            <div className={!canTakeTest ? "opacity-30 pointer-events-none" : ""}>
              {renderContent()}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ProtectedSJTInterviewPage() {
    return (
        <ProtectedRoute>
            <ProgressiveProvider>
                <SJTInterviewPage />
            </ProgressiveProvider>
        </ProtectedRoute>
    )
}

    