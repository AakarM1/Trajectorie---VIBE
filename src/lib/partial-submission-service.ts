/**
 * 🔒 MINIMAL IMPACT SERVICE - Progressive saving without breaking existing flow
 * This service works alongside the existing auth-context without modifying it
 */

import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  Timestamp,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { 
  PartialSubmission, 
  SessionRecovery, 
  ProgressInfo, 
  SaveResult 
} from '@/types/partial-submission';
import type { ConversationEntry } from '@/types';

// 🔒 MINIMAL IMPACT UPLOAD IMPORTS - Only used when progressive upload enabled
let mediaStorageImport: any = null;
const getMediaStorage = async () => {
  if (!mediaStorageImport) {
    mediaStorageImport = await import('@/lib/media-storage');
  }
  return mediaStorageImport;
};

// Collection name for partial submissions
const PARTIAL_SUBMISSIONS_COLLECTION = 'partialSubmissions';

// 🔒 MINIMAL IMPACT UPLOAD CONFIGURATION
const UPLOAD_CONFIG = {
  enableProgressiveUpload: true, // Can be controlled by feature flags
  maxConcurrentUploads: 2, // Optimize bandwidth usage
  uploadTimeoutMs: 60000, // 60 second timeout per upload
  compressionEnabled: false // Future enhancement
};

/**
 * Service for managing progressive question saving
 * Works alongside existing database service without conflicts
 */
export class PartialSubmissionService {
  
  /**
   * 🔒 MINIMAL IMPACT - Enhanced save with optional immediate upload
   * Backwards compatible with existing saveQuestionAnswer calls
   */
  async saveQuestionAnswer(data: {
    sessionId: string;
    userId: string;
    candidateId: string;
    candidateName: string;
    interviewType: 'JDT' | 'SJT';
    questionIndex: number;
    totalQuestions: number;
    questionData: ConversationEntry;
    uploadImmediately?: boolean; // 🔒 NEW OPTIONAL PARAMETER
    onUploadProgress?: (progress: number, type: 'video' | 'audio') => void; // 🔒 NEW OPTIONAL CALLBACK
  }): Promise<SaveResult> {
    try {
      console.log('💾 [PartialSubmission] Saving question', data.questionIndex + 1, 'of', data.totalQuestions);
      
      // 🔒 MINIMAL IMPACT - Process video upload if needed
      let processedVideoDataUri = data.questionData.videoDataUri;
      let videoUploadUrl: string | undefined;
      
      if (data.uploadImmediately && data.questionData.videoDataUri && UPLOAD_CONFIG.enableProgressiveUpload) {
        try {
          const uploadResult = await this.uploadMediaIfNeeded(
            data.questionData.videoDataUri,
            data.sessionId,
            data.questionIndex,
            'video',
            data.candidateName, // 🔒 PASS CANDIDATE NAME for user-named folders
            data.onUploadProgress
          );
          
          if (uploadResult.uploaded) {
            videoUploadUrl = uploadResult.url;
            processedVideoDataUri = undefined; // Clear large data URI after upload
            console.log('✅ [PartialSubmission] Video uploaded to Storage:', uploadResult.url);
          }
        } catch (uploadError) {
          console.warn('⚠️ [PartialSubmission] Video upload failed, keeping data URI:', uploadError);
          // Continue with original data URI as fallback
        }
      }
      
      const partialSubmission: Omit<PartialSubmission, 'id'> = {
        sessionId: data.sessionId,
        userId: data.userId,
        candidateId: data.candidateId,
        candidateName: data.candidateName,
        interviewType: data.interviewType,
        questionIndex: data.questionIndex,
        totalQuestions: data.totalQuestions,
        
        // Question data
        question: data.questionData.question,
        answer: data.questionData.answer,
        videoDataUri: processedVideoDataUri, // 🔒 Either undefined (uploaded) or original data URI
        videoUrl: videoUploadUrl, // 🔒 NEW FIELD - Storage URL if uploaded
        preferredAnswer: data.questionData.preferredAnswer,
        competency: data.questionData.competency,
        
        // SJT fields
        situation: data.questionData.situation,
        bestResponseRationale: data.questionData.bestResponseRationale,
        worstResponseRationale: data.questionData.worstResponseRationale,
        assessedCompetency: data.questionData.assessedCompetency,
        
        // Metadata
        timestamp: new Date(),
        status: 'saved',
        retryCount: 0,
        isComplete: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, PARTIAL_SUBMISSIONS_COLLECTION), partialSubmission);
      
      console.log('✅ [PartialSubmission] Question saved with ID:', docRef.id);
      
      return {
        success: true,
        submissionId: docRef.id
      };
      
    } catch (error) {
      console.error('❌ [PartialSubmission] Error saving question:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        shouldRetry: true,
        retryAfterSeconds: 3
      };
    }
  }
  
  /**
   * Check for incomplete sessions for a user
   */
  async checkIncompleteSession(userId: string): Promise<SessionRecovery | null> {
    try {
      console.log('🔍 [PartialSubmission] Checking for incomplete sessions for user:', userId);
      
      // 🔒 MINIMAL IMPACT FIX: Remove orderBy to avoid composite index requirement
      const q = query(
        collection(db, PARTIAL_SUBMISSIONS_COLLECTION),
        where('userId', '==', userId),
        where('isComplete', '==', false)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.log('✅ [PartialSubmission] No incomplete sessions found');
        return null;
      }
      
      // Group by sessionId to find the most recent incomplete session
      const partialsBySession = new Map<string, PartialSubmission[]>();
      
      // 🔒 MINIMAL IMPACT FIX: Client-side sort to replicate orderBy('timestamp', 'desc')
      const sortedDocs = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as PartialSubmission))
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      sortedDocs.forEach(partial => {
        const sessionId = partial.sessionId;
        
        if (!partialsBySession.has(sessionId)) {
          partialsBySession.set(sessionId, []);
        }
        partialsBySession.get(sessionId)!.push(partial);
      });
      
      // Get the most recent session
      let mostRecentSession: { sessionId: string, partials: PartialSubmission[] } | null = null;
      let mostRecentTime = new Date(0);
      
      for (const [sessionId, partials] of partialsBySession) {
        const sessionTime = new Date(Math.max(...partials.map(p => p.timestamp.getTime())));
        if (sessionTime > mostRecentTime) {
          mostRecentTime = sessionTime;
          mostRecentSession = { sessionId, partials };
        }
      }
      
      if (!mostRecentSession) {
        return null;
      }
      
      const { sessionId, partials } = mostRecentSession;
      const firstPartial = partials[0];
      
      // Check if session is recent enough to resume (within 24 hours)
      const hoursSinceLastActivity = (Date.now() - mostRecentTime.getTime()) / (1000 * 60 * 60);
      const canResume = hoursSinceLastActivity < 24;
      
      const recovery: SessionRecovery = {
        sessionId,
        candidateName: firstPartial.candidateName,
        interviewType: firstPartial.interviewType,
        totalQuestions: firstPartial.totalQuestions,
        completedQuestions: partials.length,
        lastQuestionIndex: Math.max(...partials.map(p => p.questionIndex)),
        canResume,
        partialSubmissions: partials.sort((a, b) => a.questionIndex - b.questionIndex),
        startedAt: new Date(Math.min(...partials.map(p => p.timestamp.getTime()))),
        lastActivityAt: mostRecentTime
      };
      
      console.log('🔄 [PartialSubmission] Found incomplete session:', {
        sessionId,
        completedQuestions: recovery.completedQuestions,
        totalQuestions: recovery.totalQuestions,
        canResume
      });
      
      return recovery;
      
    } catch (error) {
      console.error('❌ [PartialSubmission] Error checking incomplete sessions:', error);
      return null;
    }
  }
  
  /**
   * Get progress information for a session
   */
  async getSessionProgress(sessionId: string): Promise<ProgressInfo | null> {
    try {
      const q = query(
        collection(db, PARTIAL_SUBMISSIONS_COLLECTION),
        where('sessionId', '==', sessionId),
        orderBy('questionIndex', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      const partials = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as PartialSubmission));
      
      const firstPartial = partials[0];
      const completedIndices = partials.map(p => p.questionIndex);
      const nextQuestionIndex = this.findNextQuestionIndex(completedIndices, firstPartial.totalQuestions);
      
      return {
        sessionId,
        currentQuestion: nextQuestionIndex,
        totalQuestions: firstPartial.totalQuestions,
        completedQuestions: partials,
        nextQuestionIndex,
        canContinue: nextQuestionIndex < firstPartial.totalQuestions
      };
      
    } catch (error) {
      console.error('❌ [PartialSubmission] Error getting session progress:', error);
      return null;
    }
  }
  
  /**
   * Mark a session as complete
   */
  async markSessionComplete(sessionId: string): Promise<void> {
    try {
      console.log('🏁 [PartialSubmission] Marking session complete:', sessionId);
      
      const q = query(
        collection(db, PARTIAL_SUBMISSIONS_COLLECTION),
        where('sessionId', '==', sessionId)
      );
      
      const querySnapshot = await getDocs(q);
      
      const updatePromises = querySnapshot.docs.map(doc =>
        updateDoc(doc.ref, {
          isComplete: true,
          updatedAt: serverTimestamp()
        })
      );
      
      await Promise.all(updatePromises);
      
      console.log('✅ [PartialSubmission] Session marked complete');
    } catch (error) {
      console.error('❌ [PartialSubmission] Error marking session complete:', error);
    }
  }
  
  /**
   * Clean up old partial submissions (background maintenance)
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      console.log('🧹 [PartialSubmission] Cleaning up expired sessions...');
      
      // Delete sessions older than 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const q = query(
        collection(db, PARTIAL_SUBMISSIONS_COLLECTION),
        where('timestamp', '<', Timestamp.fromDate(sevenDaysAgo))
      );
      
      const querySnapshot = await getDocs(q);
      
      const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      console.log(`✅ [PartialSubmission] Cleaned up ${querySnapshot.size} expired sessions`);
    } catch (error) {
      console.error('❌ [PartialSubmission] Error cleaning up expired sessions:', error);
    }
  }
  
  /**
   * Generate a unique session ID
   */
  generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
  
  /**
   * 🔒 MINIMAL IMPACT UPLOAD METHOD - Only used when progressive upload enabled
   * Upload media file if it's too large for Firestore storage
   */
  private async uploadMediaIfNeeded(
    dataUri: string,
    sessionId: string,
    questionIndex: number,
    mediaType: 'video' | 'audio',
    candidateName?: string, // 🔒 NEW PARAMETER for user-named folders
    onProgress?: (progress: number, type: 'video' | 'audio') => void
  ): Promise<{ uploaded: boolean; url?: string }> {
    try {
      const mediaStorage = await getMediaStorage();
      
      // Check if file is too large for Firestore (same logic as auth-context)
      if (!mediaStorage.isDataUriTooLarge(dataUri)) {
        return { uploaded: false }; // Keep as data URI for small files
      }
      
      console.log(`📎 [PartialSubmission] Media file for Q${questionIndex + 1} is large, uploading to Storage...`);
      
      // Convert data URI to blob
      const blob = await mediaStorage.dataUriToBlob(dataUri);
      
      // Report progress start
      onProgress?.(0, mediaType);
      
      // 🔒 ENHANCED UPLOAD - Pass candidate name for user-named folders
      const downloadURL = await mediaStorage.uploadMediaToStorage(
        blob, 
        sessionId, // Use sessionId instead of temp submission ID
        questionIndex, 
        mediaType,
        candidateName // 🔒 NEW PARAMETER - enables user-named folders when available
      );
      
      // Report progress complete
      onProgress?.(100, mediaType);
      
      return { uploaded: true, url: downloadURL };
      
    } catch (error) {
      console.error(`❌ [PartialSubmission] Failed to upload ${mediaType}:`, error);
      throw error;
    }
  }
  
  /**
   * Helper method to find the next question index
   */
  private findNextQuestionIndex(completedIndices: number[], totalQuestions: number): number {
    for (let i = 0; i < totalQuestions; i++) {
      if (!completedIndices.includes(i)) {
        return i;
      }
    }
    return totalQuestions; // All questions completed
  }
}

// Export a singleton instance
export const partialSubmissionService = new PartialSubmissionService();
