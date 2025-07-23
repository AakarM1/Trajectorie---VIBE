
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Send, Type, CheckCircle, RefreshCcw, Info, ArrowLeft, ArrowRight, Video, Mic, Square, X } from 'lucide-react';
import MediaCapture from './audio-recorder';
import { transcribeAudio, type TranscribeAudioInput } from '@/ai/flows/transcribe-audio';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { InterviewMode } from '@/types';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ConversationEntry } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface FlashcardProps {
  question: string;
  questionNumber: number;
  totalQuestions: number;
  onAnswerSubmit: (answer: string, videoDataUri?: string) => void;
  isProcessing: boolean;
  isVisible: boolean;
  mode: InterviewMode;
  isAnswered: boolean;
  onFinishInterview: () => void;
  answeredQuestionsCount: number;
  timeLimitInMinutes: number;
  onTimeUp: () => void;
  currentQuestionIndex: number;
  setCurrentQuestionIndex: (index: number) => void;
  conversationHistory: ConversationEntry[];
  questionTimes: number[]; // Array to track time spent per question
  setQuestionTimes: (times: number[]) => void;
}


const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const Flashcard: React.FC<FlashcardProps> = ({
  question,
  questionNumber,
  totalQuestions,
  onAnswerSubmit,
  isProcessing,
  isVisible,
  mode,
  isAnswered,
  onFinishInterview,
  timeLimitInMinutes,
  onTimeUp,
  currentQuestionIndex,
  setCurrentQuestionIndex,
  conversationHistory,
  questionTimes,
  setQuestionTimes
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaData, setMediaData] = useState<{ blob: Blob; dataUri: string } | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [editableTranscription, setEditableTranscription] = useState('');
  const [textAnswer, setTextAnswer] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const { toast } = useToast();
  
  const [testTimeElapsed, setTestTimeElapsed] = useState(0); // Track elapsed time in seconds
  const [currentQuestionTime, setCurrentQuestionTime] = useState(0); // Current question timer

  const questionTimerRef = useRef<NodeJS.Timeout>();
  const testTimerRef = useRef<NodeJS.Timeout>();
  const questionTimesRef = useRef<number[]>(questionTimes); // Use ref to avoid state update conflicts


  // Keep ref in sync with props
  useEffect(() => {
    questionTimesRef.current = questionTimes;
  }, [questionTimes]);

  // Start test timer (stopwatch) when component mounts - ONLY ONCE
  useEffect(() => {
    // Start stopwatch - counts UP from 0, only if not already started
    if (testTimerRef.current) return; // Don't restart if already running
    
    testTimerRef.current = setInterval(() => {
      setTestTimeElapsed(prevTime => prevTime + 1);
    }, 1000);
    
    // Setup countdown timer for time limit if specified
    let countdownTimer: NodeJS.Timeout | null = null;
    if (timeLimitInMinutes > 0) {
      let timeLeft = timeLimitInMinutes * 60;
      countdownTimer = setInterval(() => {
        timeLeft -= 1;
        if (timeLeft <= 0) {
          clearInterval(countdownTimer!);
          onTimeUp();
        }
      }, 1000);
    }
    
    return () => {
      if (testTimerRef.current) {
        clearInterval(testTimerRef.current);
        testTimerRef.current = undefined;
      }
      if (countdownTimer) {
        clearInterval(countdownTimer);
      }
    };
  }, []); // Empty dependency array - only run once



  useEffect(() => {
    // Handle question timer when changing questions
    if (isAnswered) {
      // If question is already answered, show the frozen time and stop timer
      setCurrentQuestionTime(questionTimes[currentQuestionIndex] || 0);
      if (questionTimerRef.current) {
        clearInterval(questionTimerRef.current);
        questionTimerRef.current = undefined;
      }
    } else {
      // For unanswered questions, start from saved time or 0
      const savedTime = questionTimes[currentQuestionIndex] || 0;
      setCurrentQuestionTime(savedTime);
      
      // Clear existing timer
      if (questionTimerRef.current) {
        clearInterval(questionTimerRef.current);
      }
      
      // Start new timer
      questionTimerRef.current = setInterval(() => {
        setCurrentQuestionTime(prev => prev + 1);
      }, 1000);
    }

    // Reset media state when question changes
    setMediaData(null);
    setEditableTranscription('');
    setIsRecording(false);
    setIsTranscribing(false);

    return () => {
      if (questionTimerRef.current) {
        clearInterval(questionTimerRef.current);
      }
    };
  }, [currentQuestionIndex, isAnswered]); // Removed questionTimes from deps to avoid loops

  // Update question times in parent periodically using a debounced approach
  useEffect(() => {
    if (!isAnswered) {
      const updateInterval = setInterval(() => {
        const currentTimes = [...questionTimesRef.current];
        currentTimes[currentQuestionIndex] = currentQuestionTime;
        setQuestionTimes(currentTimes);
      }, 2000); // Update every 2 seconds to reduce conflicts
      
      return () => clearInterval(updateInterval);
    }
  }, [currentQuestionTime, currentQuestionIndex, isAnswered, setQuestionTimes]);

  // Separate effect to handle text answer loading - only when question or answer status changes
  useEffect(() => {
    if (isAnswered && conversationHistory[currentQuestionIndex]?.answer) {
      setTextAnswer(conversationHistory[currentQuestionIndex].answer);
    } else if (!isAnswered) {
      setTextAnswer('');
    }
  }, [currentQuestionIndex, isAnswered, conversationHistory]);


  const handleRecordingComplete = (blob: Blob, dataUri: string) => {
    setMediaData({ blob, dataUri });
    handleTranscribe(dataUri);
  };

  const handleTranscribe = async (dataUri: string) => {
    if (!dataUri) {
      toast({
        variant: "destructive",
        title: "No media recorded",
        description: "Please record your answer before transcribing.",
      });
      return;
    }
    setIsTranscribing(true);
    try {
      const input: TranscribeAudioInput = { audioDataUri: dataUri };
      const result = await transcribeAudio(input);
      setEditableTranscription(result.transcription);
    } catch (error) {
      console.error("Transcription error:", error);
      toast({
        variant: "destructive",
        title: "Transcription Failed",
        description: "Could not transcribe from the recording. Please try again.",
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSubmit = () => {
    if (mode === 'text') {
      if (textAnswer.trim()) {
        // Stop the question timer when submitting and save the time
        if (questionTimerRef.current) {
          clearInterval(questionTimerRef.current);
          questionTimerRef.current = undefined;
        }
        // Immediately update question times for this question
        const currentTimes = [...questionTimesRef.current];
        currentTimes[currentQuestionIndex] = currentQuestionTime;
        setQuestionTimes(currentTimes);
        onAnswerSubmit(textAnswer);
      } else {
        toast({
            variant: "destructive",
            title: "No answer provided",
            description: "Please type your answer before submitting.",
        });
      }
    } else {
      if (editableTranscription.trim() && mediaData) {
        // Stop the question timer when submitting and save the time
        if (questionTimerRef.current) {
          clearInterval(questionTimerRef.current);
          questionTimerRef.current = undefined;
        }
        // Immediately update question times for this question
        const currentTimes = [...questionTimesRef.current];
        currentTimes[currentQuestionIndex] = currentQuestionTime;
        setQuestionTimes(currentTimes);
        onAnswerSubmit(editableTranscription, mediaData.dataUri);
      } else {
        toast({
          variant: "destructive",
          title: "Submission Error",
          description: "A transcribed answer is required. Please record, transcribe, and review first.",
        });
      }
    }
  };
  
  const handleRerecord = () => {
    setMediaData(null);
    setEditableTranscription('');
    setIsRecording(false);
    setIsTranscribing(false);
    toast({
        title: "Ready to Record",
        description: "You can now record your answer again.",
    });
  }

  const isSubmitDisabled = () => {
    if (isProcessing || isAnswered) return true;
    if (mode === 'text') {
      return !textAnswer.trim();
    }
    return !editableTranscription.trim() || isTranscribing || isRecording;
  }
  
  const captureMode = mode;

  return (
    <div className={cn(
      "w-full max-w-6xl shadow-lg transition-all duration-500 flex flex-col border border-gray-300 bg-white",
      isVisible ? 'animate-fadeIn' : 'opacity-0 pointer-events-none'
    )}>
      {isProcessing ? (
        <div className="flex flex-col items-center justify-center h-96">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg font-semibold text-primary mt-4">Saving Answer...</p>
        </div>
      ) : (
        <>
          <div className="bg-gray-100 border-b border-gray-300 p-2 flex items-center justify-between">
            <div className='flex items-center gap-2'>
              <Button size="icon" variant="ghost" onClick={() => setCurrentQuestionIndex(currentQuestionIndex - 1)} disabled={currentQuestionIndex === 0}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              {Array.from({ length: totalQuestions }).map((_, i) => (
                <Button 
                  key={i} 
                  size="icon" 
                  variant={currentQuestionIndex === i ? 'default' : (conversationHistory[i].answer ? 'outline' : 'ghost')}
                  className={cn(
                    "h-8 w-8 rounded-sm",
                     currentQuestionIndex === i && 'bg-green-600 hover:bg-green-700',
                     conversationHistory[i].answer && 'border-green-600 text-green-600'
                  )}
                  onClick={() => setCurrentQuestionIndex(i)}
                >
                  {(i + 1).toString().padStart(2, '0')}
                </Button>
              ))}
              <Button size="icon" variant="ghost" onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)} disabled={currentQuestionIndex === totalQuestions - 1}>
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <div className='h-6 w-6 rounded-full bg-red-500 flex items-center justify-center'>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-timer"><line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="12" y1="6" y2="2"/><circle cx="12" cy="14" r="8"/></svg>
                </div>
                TEST TIME | {formatTime(testTimeElapsed)}
              </div>
              <Button 
                onClick={() => {
                  console.log('🔴 Finish button clicked in Flashcard');
                  onFinishInterview();
                }} 
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md font-medium"
              >
                Finish Test
              </Button>
            </div>
          </div>
           <div className="bg-gray-100 border-b border-gray-300 p-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold ml-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    Question Time | {formatTime(currentQuestionTime)}
                </div>
                <Button variant="outline" className="bg-orange-400 hover:bg-orange-500 text-white rounded-full border-orange-500 px-4 py-1 h-auto" onClick={() => setShowInstructions(true)}>
                    Instruction <Info className="ml-2 h-4 w-4" />
                </Button>
           </div>
          
          <div className="p-6 space-y-6 flex-grow">
            <p className="text-base font-medium">
                <span className="mr-2">{questionNumber}.</span>{question}
            </p>

            {isAnswered && (
                 <div className="flex items-center justify-center text-green-600 p-3 rounded-md bg-green-50 border border-green-200">
                    <CheckCircle className="mr-2 h-5 w-5" />
                    <p className="font-medium">Answer submitted for this question.</p>
                </div>
            )}
            {mode === 'text' ? (
                <div className="space-y-2 flex-grow flex flex-col">
                    <div className="flex items-center text-gray-500 mb-2">
                        <Type className="h-5 w-5 mr-2" />
                        <span>{isAnswered ? 'Your submitted answer:' : 'Type your answer below:'}</span>
                    </div>
                    <Textarea 
                        value={isAnswered ? conversationHistory[currentQuestionIndex]?.answer || '' : textAnswer}
                        onChange={(e) => setTextAnswer(e.target.value)}
                        placeholder={isAnswered ? "Your submitted answer" : "Your answer..."}
                        rows={8}
                        className={`flex-grow ${isAnswered ? 'bg-gray-100 border-gray-300' : 'bg-gray-50'}`}
                        disabled={isAnswered}
                        readOnly={isAnswered}
                    />
                </div>
            ) : (
                 <div className="grid md:grid-cols-2 gap-6 items-start">
                    <div className='w-full'>
                        <MediaCapture
                            onRecordingComplete={handleRecordingComplete}
                            isRecordingExternally={isRecording}
                            onStartRecording={() => setIsRecording(true)}
                            onStopRecording={() => setIsRecording(false)}
                            disabled={isTranscribing || !!mediaData || isAnswered}
                            captureMode={captureMode}
                        />
                    </div>
                    <div className="space-y-4 h-full flex flex-col w-full">
                        {isTranscribing ? (
                           <div className="flex-grow flex items-center justify-center text-gray-500 p-4 h-full">
                                <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
                                Transcribing...
                            </div>
                        ) : (
                            <>
                                <Label htmlFor="transcription" className="flex items-center gap-2 text-gray-600 font-medium">
                                    Review and edit your transcribed answer:
                                </Label>
                                <Textarea
                                    id="transcription"
                                    placeholder={!mediaData ? "Your transcribed answer will appear here after recording." : "Transcription in progress..."}
                                    value={editableTranscription}
                                    onChange={(e) => setEditableTranscription(e.target.value)}
                                    rows={8}
                                    className="bg-gray-50 flex-grow"
                                    disabled={!mediaData || isAnswered}
                                />
                                {mediaData && !isAnswered && (
                                    <div className="flex gap-4">
                                        <Button onClick={handleRerecord} variant="outline" size="sm">
                                            <RefreshCcw className="mr-2 h-4 w-4" />
                                            Re-record
                                        </Button>
                                    </div>
                                )}
                           </>
                        )}
                    </div>
                </div>
            )}
            
          </div>
          <div className="bg-gray-100 border-t border-gray-300 p-4 flex justify-center">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitDisabled()}
              className="bg-green-600 hover:bg-green-700 text-white rounded-full px-8 py-2 h-auto text-base"
            >
             {isAnswered ? <><CheckCircle className="mr-2 h-5 w-5" /> Submitted</> : <><Send className="mr-2 h-5 w-5" /> Submit Answer</>}
            </Button>
          </div>
        </>
      )}

      {/* Instructions Modal */}
      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-primary flex items-center gap-2">
              <Info className="h-6 w-6" />
              Test Instructions
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-800 mb-2">Test Guidelines:</h3>
              <ul className="space-y-2 text-sm text-blue-700">
                <li>• Answer all questions in one attempt, so start when you are really ready.</li>
                <li>• "Submit" every response and "Finish Test" when you have responded to all.</li>
                <li>• If no option matches your real life response to a question, choose one that is closest.</li>
                <li>• Keep it real life, stay spontaneous. Do not overthink a response.</li>
              </ul>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-800 mb-2">Navigation:</h3>
              <ul className="space-y-2 text-sm text-green-700">
                <li>• Use the numbered buttons to navigate between questions</li>
                <li>• Green numbers indicate answered questions</li>
                <li>• You can review and change your answers before finishing</li>
                <li>• {timeLimitInMinutes > 0 ? `This test has a ${timeLimitInMinutes} minute time limit (you'll be automatically finished when time runs out)` : 'This test has no time limit'}</li>
                <li>• The timer shows how long you've been taking the test</li>
              </ul>
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="font-semibold text-amber-800 mb-2">Important Reminders:</h3>
              <ul className="space-y-2 text-sm text-amber-700">
                <li>• Try not to refresh the page, you will lose the answers you've worked hard to complete.</li>
                <li>• Don't shut the browser, and avoid power-outs if you can.</li>
                <li>• Choose what you would really do, not what you should ideally do.</li>
                <li>• Submit every answer and Click "Finish" test when you've answered all!</li>
              </ul>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setShowInstructions(false)} className="bg-primary hover:bg-primary/90">
              Got it!
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Flashcard;
