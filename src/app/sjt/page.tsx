
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ProtectedRoute, useAuth } from '@/contexts/auth-context';
import type { ConversationEntry, AnalysisResult, PreInterviewDetails, InterviewMode } from '@/types';
import type { AnalyzeSJTResponseInput, AnalyzeSJTResponseOutput } from '@/ai/flows/analyze-sjt-response';
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
    assessedCompetency: "Customer Focus",
  },
  {
    id: 2,
    situation: "You notice that a junior member of your team has been struggling to keep up with their workload and their quality of work has been declining. They seem disengaged during team meetings.",
    question: "How would you approach this situation with your team member?",
    bestResponseRationale: "Schedule a private, one-on-one meeting to express concern and create a safe space for them to share any challenges. The ideal approach is to listen actively, ask open-ended questions to understand the root cause (be it workload, personal issues, or skill gaps), and collaboratively develop a support plan.",
    worstResponseRationale: "Criticize the team member publicly, immediately put them on a performance improvement plan without discussion, or simply ignore the problem hoping it will resolve itself. A bad response lacks empathy and fails to investigate the underlying issues.",
    assessedCompetency: "Coaching & Mentoring",
  },
];


function SJTInterviewPage() {
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
  const [sjtScenarios, setSjtScenarios] = useState<Scenario[]>(fallbackSjtScenarios);
  const [timeLimit, setTimeLimit] = useState(0); // in minutes
  const [showReport, setShowReport] = useState(true);
  const [questionTimes, setQuestionTimes] = useState<number[]>([]); // Track time per question


  const startInterview = useCallback(async (details: PreInterviewDetails) => {
    setStatus('INTERVIEW');
    setPreInterviewDetails(details);
    setIsProcessing(true);

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

    const history = scenariosToUse.map(s => ({ 
      question: `Situation: ${s.situation}\n\nQuestion: ${s.question}`, 
      answer: null, 
      videoDataUri: undefined 
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
      setStatus('ANALYZING');
      setIsProcessing(true);
      
      try {
        // First, save the submission to database immediately
        console.log('💾 Saving submission to database...');
        
        // Create a basic result structure
        const basicResult: AnalysisResult = {
            strengths: `Candidate completed ${answeredHistory.length} out of ${sjtScenarios.length} scenarios. Responses demonstrate engagement with the situational judgement test.`,
            weaknesses: "Detailed analysis pending. Please review individual responses for comprehensive feedback.",
            summary: `SJT Assessment completed on ${new Date().toLocaleDateString()}. ${answeredHistory.length} scenarios answered out of ${sjtScenarios.length} total scenarios.`,
            competencyAnalysis: [{
                name: "SJT Completion",
                competencies: [{
                    name: "Participation",
                    score: Math.round((answeredHistory.length / sjtScenarios.length) * 10)
                }]
            }]
        };

        // Save submission immediately with basic analysis
        await saveSubmission({
            candidateName: preInterviewDetails!.name,
            testType: 'SJT',
            report: basicResult,
            history: conversationHistory,
        });

        console.log('✅ Submission saved successfully');

        // Try AI analysis in background (optional - won't crash if it fails)
        try {
          console.log('🤖 Attempting AI analysis...');
          const sjtAnalyses: (any & { competency: string })[] = [];

          // Analyze each response individually
          for (let i = 0; i < answeredHistory.length; i++) {
            const entry = answeredHistory[i];
            const scenarioIndex = conversationHistory.findIndex(h => h === entry);
            const scenario = sjtScenarios[scenarioIndex];
            
            if (scenario) {
              const analysisInput = {
                  situation: scenario.situation,
                  question: scenario.question,
                  bestResponseRationale: scenario.bestResponseRationale,
                  worstResponseRationale: scenario.worstResponseRationale,
                  assessedCompetency: scenario.assessedCompetency,
                  candidateAnswer: entry.answer,
              };
              
              try {
                const result = await fetch('/api/ai/analyze-sjt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(analysisInput),
                    signal: AbortSignal.timeout(10000) // 10 second timeout
                }).then(res => {
                  if (!res.ok) throw new Error(`API responded with ${res.status}`);
                  return res.json();
                });
                sjtAnalyses.push({ ...result, competency: scenario.assessedCompetency });
                console.log(`✅ Analysis complete for scenario ${i + 1}`);
              } catch (analysisError) {
                console.warn(`⚠️ Failed to analyze scenario ${i + 1}:`, analysisError);
                // Continue with next scenario instead of crashing
              }
            }
          }
          
          // If we got some AI analyses, update the result
          if (sjtAnalyses.length > 0) {
            const enhancedResult: AnalysisResult = {
                strengths: "The candidate's performance in situational judgement tests reveals several key strengths. " + sjtAnalyses.filter(a => a.score >= 7).map(a => a.rationale).join(' '),
                weaknesses: "Areas for improvement were also noted. " + sjtAnalyses.filter(a => a.score < 7).map(a => a.rationale).join(' '),
                summary: `The candidate completed ${sjtAnalyses.length} of ${sjtScenarios.length} scenarios with AI analysis. The average competency score was ${(sjtAnalyses.reduce((acc, a) => acc + a.score, 0) / (sjtAnalyses.length || 1)).toFixed(1)}/10.`,
                competencyAnalysis: [{
                    name: "Situational Competencies",
                    competencies: sjtAnalyses.map((a) => ({
                        name: a.competency,
                        score: a.score
                    })).sort((a,b) => a.name.localeCompare(b.name)),
                }]
            };
            setAnalysisResult(enhancedResult);
            console.log('✅ AI analysis completed successfully');
          } else {
            setAnalysisResult(basicResult);
            console.log('⚠️ No AI analysis available, using basic result');
          }
        } catch (aiError) {
          console.warn('⚠️ AI analysis failed, but submission was saved:', aiError);
          setAnalysisResult(basicResult);
        }

        setStatus(showReport ? 'RESULTS' : 'COMPLETED');
        toast({
          title: 'Test Completed!',
          description: 'Your responses have been saved successfully.',
        });
        
        // Redirect to home page after a short delay
        setTimeout(() => {
          console.log('🏠 Redirecting to home page');
          router.push('/');
        }, 2000);
        
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
        setPreInterviewDetails({ name: user.candidateName, roleCategory: "Situational Judgement Test", language: 'English' });
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
      case 'ANALYZING':
        return (
          <div className="flex flex-col items-center justify-center text-center p-8 bg-card/60 backdrop-blur-xl rounded-lg shadow-lg">
            <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
            <h2 className="text-2xl font-headline text-primary">Analyzing your responses...</h2>
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

export default function ProtectedSJTInterviewPage() {
    return (
        <ProtectedRoute>
            <SJTInterviewPage />
        </ProtectedRoute>
    )
}

    