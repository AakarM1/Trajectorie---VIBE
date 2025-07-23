



export interface Competency {
  name: string;
  score: number; // Score out of 10
}

export interface MetaCompetency {
  name: string;
  competencies: Competency[];
}

export interface ConversationEntry {
  question: string;
  answer: string | null;
  videoDataUri?: string; // Can be video/audio data URI or Firebase Storage URL
  translatedAnswer?: string; // For future translation feature
  preferredAnswer?: string;
  competency?: string;
  _isStorageUrl?: boolean; // Flag to indicate if videoDataUri is a Firebase Storage URL
}

export type AppStatus = 'INITIAL' | 'ASKING' | 'ANALYZING' | 'RESULTS' | 'ERROR';

export type InterviewMode = 'video' | 'audio' | 'text';

export interface PreInterviewDetails {
  name: string;
  roleCategory: string;
  language: string;
}

export interface AnalysisResult {
  strengths: string;
  weaknesses: string;
  summary: string;
  competencyAnalysis: MetaCompetency[];
}

export interface SJTQuestion {
  id: number;
  text: string;
  options: {
    id: string;
    text: string;
  }[];
}

export interface Submission {
    id: string;
    candidateName: string;
    testType: 'JDT' | 'SJT';
    date: string;
    report: AnalysisResult;
    history: ConversationEntry[];
    candidateId?: string; // Track which user made this submission
}

    