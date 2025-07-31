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
      
      // Create the basic submission object with required fields first
      const timestamp = new Date(); // Use the same timestamp for consistency
      
      // Validate essential data to avoid undefined/null values
      const validAnswer = data.questionData.answer || ''; // Prevent null answers
      const validQuestion = data.questionData.question || ''; 
      
      const partialSubmission: Omit<PartialSubmission, 'id'> = {
        sessionId: data.sessionId,
        userId: data.userId,
        candidateId: data.candidateId || data.userId, // Fallback to userId if candidateId is missing
        candidateName: data.candidateName || 'Anonymous', // Default name if missing
        interviewType: data.interviewType,
        questionIndex: data.questionIndex,
        totalQuestions: data.totalQuestions,
        
        // Question data - only include required fields with defaults for safety
        question: validQuestion,
        answer: validAnswer,
        
        // Metadata
        timestamp: timestamp, // Use JavaScript Date for client-side operations
        status: 'saved',
        retryCount: 0,
        isComplete: false,
        createdAt: serverTimestamp(), // Use Firestore serverTimestamp for server-side operations
        updatedAt: serverTimestamp()
      };
      
      // Add optional fields only if they have non-null, non-undefined values
      // This prevents "Function addDoc() called with invalid data. Unsupported field value: undefined" errors
      
      if (processedVideoDataUri && processedVideoDataUri !== 'undefined' && processedVideoDataUri !== 'null') {
        partialSubmission.videoDataUri = processedVideoDataUri;
      }
      
      if (videoUploadUrl && videoUploadUrl !== 'undefined' && videoUploadUrl !== 'null') {
        partialSubmission.videoUrl = videoUploadUrl;
      }
      
      if (data.questionData.preferredAnswer && 
          data.questionData.preferredAnswer !== 'undefined' && 
          data.questionData.preferredAnswer !== 'null') {
        partialSubmission.preferredAnswer = data.questionData.preferredAnswer;
      }
      
      if (data.questionData.competency && 
          data.questionData.competency !== 'undefined' && 
          data.questionData.competency !== 'null') {
        partialSubmission.competency = data.questionData.competency;
      }
      
      // SJT fields - only add if they exist and are valid
      if (data.questionData.situation && 
          data.questionData.situation !== 'undefined' && 
          data.questionData.situation !== 'null') {
        partialSubmission.situation = data.questionData.situation;
      }
      
      if (data.questionData.bestResponseRationale && 
          data.questionData.bestResponseRationale !== 'undefined' && 
          data.questionData.bestResponseRationale !== 'null') {
        partialSubmission.bestResponseRationale = data.questionData.bestResponseRationale;
      }
      
      if (data.questionData.worstResponseRationale && 
          data.questionData.worstResponseRationale !== 'undefined' && 
          data.questionData.worstResponseRationale !== 'null') {
        partialSubmission.worstResponseRationale = data.questionData.worstResponseRationale;
      }
      
      if (data.questionData.assessedCompetency && 
          data.questionData.assessedCompetency !== 'undefined' && 
          data.questionData.assessedCompetency !== 'null') {
        partialSubmission.assessedCompetency = data.questionData.assessedCompetency;
      }
      
      // Final validation to ensure we're not sending any undefined or null values to Firestore
      Object.keys(partialSubmission).forEach(key => {
        const value = (partialSubmission as any)[key];
        if (value === undefined || value === null) {
          delete (partialSubmission as any)[key];
        }
      });
      
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
      
      // 🔒 MINIMAL IMPACT FIX: Ultra-defensive handling of all possible timestamp formats
      const sortedDocs = querySnapshot.docs
        .map(doc => {
          try {
            const data = doc.data();
            
            // Default to current time for all timestamps
            let timestamp = new Date();
            let createdAt = new Date();
            let updatedAt = new Date();
            
            // Try/catch for each timestamp to prevent any possible runtime errors
            try {
              // Handle Firestore Timestamp objects (most common case)
              if (data.timestamp) {
                if (typeof (data.timestamp as any).toDate === 'function') {
                  // Firestore Timestamp object
                  timestamp = (data.timestamp as any).toDate();
                } else if (data.timestamp instanceof Date) {
                  // JavaScript Date
                  timestamp = data.timestamp;
                } else if (typeof data.timestamp === 'object' && 'seconds' in (data.timestamp as any)) {
                  // Raw { seconds, nanoseconds } object
                  timestamp = new Date((data.timestamp as any).seconds * 1000);
                } else if (typeof data.timestamp === 'number') {
                  // Unix timestamp (ms)
                  timestamp = new Date(data.timestamp);
                } else if (typeof data.timestamp === 'string') {
                  // ISO date string
                  timestamp = new Date(data.timestamp);
                }
              }
            } catch (err) {
              console.warn('⚠️ [PartialSubmission] Error parsing timestamp:', err);
              // Keep default timestamp
            }
            
            // Same pattern for createdAt with try/catch
            try {
              if (data.createdAt) {
                if (typeof (data.createdAt as any).toDate === 'function') {
                  createdAt = (data.createdAt as any).toDate();
                } else if (data.createdAt instanceof Date) {
                  createdAt = data.createdAt;
                } else if (typeof data.createdAt === 'object' && 'seconds' in (data.createdAt as any)) {
                  createdAt = new Date((data.createdAt as any).seconds * 1000);
                } else if (typeof data.createdAt === 'number') {
                  createdAt = new Date(data.createdAt);
                } else if (typeof data.createdAt === 'string') {
                  createdAt = new Date(data.createdAt);
                }
              }
            } catch (err) {
              console.warn('⚠️ [PartialSubmission] Error parsing createdAt:', err);
              // Keep default createdAt
            }
            
            // Same pattern for updatedAt with try/catch
            try {
              if (data.updatedAt) {
                if (typeof (data.updatedAt as any).toDate === 'function') {
                  updatedAt = (data.updatedAt as any).toDate();
                } else if (data.updatedAt instanceof Date) {
                  updatedAt = data.updatedAt;
                } else if (typeof data.updatedAt === 'object' && 'seconds' in (data.updatedAt as any)) {
                  updatedAt = new Date((data.updatedAt as any).seconds * 1000);
                } else if (typeof data.updatedAt === 'number') {
                  updatedAt = new Date(data.updatedAt);
                } else if (typeof data.updatedAt === 'string') {
                  updatedAt = new Date(data.updatedAt);
                }
              }
            } catch (err) {
              console.warn('⚠️ [PartialSubmission] Error parsing updatedAt:', err);
              // Keep default updatedAt
            }
            
            // Create a clean object with proper Date objects
            return {
              id: doc.id,
              ...data,
              timestamp: timestamp,
              createdAt: createdAt,
              updatedAt: updatedAt
            } as PartialSubmission;
          } catch (err) {
            // If anything goes wrong, create a minimal valid object with default values
            console.error('❌ [PartialSubmission] Critical error processing document:', err);
            return {
              id: doc.id,
              sessionId: '',
              userId: '',
              candidateId: '',
              candidateName: 'Error',
              interviewType: 'SJT',
              questionIndex: 0,
              totalQuestions: 0,
              question: '',
              answer: '',
              timestamp: new Date(),
              status: 'error',
              retryCount: 0,
              isComplete: true,
              createdAt: new Date(),
              updatedAt: new Date()
            } as PartialSubmission;
          }
        })
        .sort((a, b) => {
          try {
            // Handle every possible timestamp case individually to avoid any type errors
            let timeA = 0;
            let timeB = 0;
            
            // Extra defensive check for a.timestamp
            if (a && a.timestamp) {
              if (a.timestamp instanceof Date) {
                // Standard JavaScript Date object
                try { timeA = a.timestamp.getTime(); } catch { timeA = 0; }
              } else if (typeof (a.timestamp as any).toDate === 'function') {
                // Firestore Timestamp object
                try { 
                  const dateA = (a.timestamp as any).toDate();
                  timeA = dateA.getTime(); 
                } catch { timeA = 0; }
              } else if (typeof a.timestamp === 'object' && 'seconds' in (a.timestamp as any)) {
                // Raw Firestore timestamp object with seconds
                try { timeA = (a.timestamp as any).seconds * 1000; } catch { timeA = 0; }
              } else if (typeof a.timestamp === 'number') {
                // Numeric timestamp (milliseconds since epoch)
                timeA = a.timestamp;
              }
              // All other cases default to 0
            }
            
            // Same defensive check for b.timestamp
            if (b && b.timestamp) {
              if (b.timestamp instanceof Date) {
                // Standard JavaScript Date object
                try { timeB = b.timestamp.getTime(); } catch { timeB = 0; }
              } else if (typeof (b.timestamp as any).toDate === 'function') {
                // Firestore Timestamp object
                try { 
                  const dateB = (b.timestamp as any).toDate();
                  timeB = dateB.getTime(); 
                } catch { timeB = 0; }
              } else if (typeof b.timestamp === 'object' && 'seconds' in (b.timestamp as any)) {
                // Raw Firestore timestamp object with seconds
                try { timeB = (b.timestamp as any).seconds * 1000; } catch { timeB = 0; }
              } else if (typeof b.timestamp === 'number') {
                // Numeric timestamp (milliseconds since epoch)
                timeB = b.timestamp;
              }
              // All other cases default to 0
            }
            
            // If we couldn't extract timestamps, try comparing by question index as fallback
            if (timeA === 0 && timeB === 0) {
              return (a.questionIndex || 0) - (b.questionIndex || 0);
            }
            
            return timeB - timeA; // Sort descending
          } catch (err) {
            console.warn('⚠️ [PartialSubmission] Error in sort comparison:', err);
            return 0; // Return equal if comparison fails
          }
        });
      
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
        try {
          // Ultra-safe timestamp extraction with multiple fallbacks
          const validTimestamps = partials
            .map(p => {
              try {
                // First check if it's already a proper Date object
                if (p.timestamp instanceof Date) {
                  return p.timestamp.getTime();
                } 
                
                // Handle different timestamp formats with type assertions for safety
                const rawTimestamp = p.timestamp as any;
                
                // Check for Firestore Timestamp with toDate method
                if (rawTimestamp && typeof rawTimestamp.toDate === 'function') {
                  return rawTimestamp.toDate().getTime();
                }
                
                // Check for raw Firestore timestamp object { seconds, nanoseconds }
                if (rawTimestamp && typeof rawTimestamp === 'object' && 'seconds' in rawTimestamp) {
                  return rawTimestamp.seconds * 1000;
                }
                
                // Try createdAt as fallback
                if (p.createdAt instanceof Date) {
                  return p.createdAt.getTime();
                } else if (p.createdAt) {
                  const rawCreatedAt = p.createdAt as any;
                  if (typeof rawCreatedAt.toDate === 'function') {
                    return rawCreatedAt.toDate().getTime();
                  }
                }
                
                // Last resort - use current time
                return 0;
              } catch (err) {
                console.warn('⚠️ [PartialSubmission] Error extracting timestamp:', err);
                return 0;
              }
            })
            .filter(time => time > 0);
          
          // Use the most recent timestamp or current time if no valid timestamps
          const sessionTime = validTimestamps.length > 0 
            ? new Date(Math.max(...validTimestamps))
            : new Date();
            
          if (sessionTime > mostRecentTime) {
            mostRecentTime = sessionTime;
            mostRecentSession = { sessionId, partials };
          }
        } catch (err) {
          console.warn(`⚠️ [PartialSubmission] Error processing timestamps for session ${sessionId}:`, err);
          // Continue with next session
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
      
      // Safely extract valid question indices
      const questionIndices = partials.map(p => p.questionIndex);
      const lastQuestionIndex = questionIndices.length > 0 ? Math.max(...questionIndices) : 0;
      
      // Safely extract valid timestamps for start time calculation with extensive error handling
      const validTimestamps = partials
        .map(p => {
          try {
            // Multiple timestamp extraction strategies with individual try/catch blocks
            
            // Case 1: Standard JS Date
            if (p.timestamp instanceof Date) {
              try {
                return p.timestamp.getTime();
              } catch {
                // Fallback if getTime() fails
              }
            }
            
            // Case 2: Firestore Timestamp
            if (p.timestamp && typeof (p.timestamp as any).toDate === 'function') {
              try {
                const date = (p.timestamp as any).toDate();
                if (date instanceof Date) {
                  return date.getTime();
                }
              } catch {
                // Continue to next strategy
              }
            }
            
            // Case 3: Raw seconds/nanoseconds object
            if (p.timestamp && typeof p.timestamp === 'object' && 'seconds' in (p.timestamp as any)) {
              try {
                return (p.timestamp as any).seconds * 1000;
              } catch {
                // Continue to next strategy
              }
            }
            
            // Case 4: Fallback to created timestamp
            if (p.createdAt instanceof Date) {
              try {
                return p.createdAt.getTime();
              } catch {
                // Continue to last resort
              }
            }
            
            // Case 5: Check for Firestore timestamp in createdAt
            if (p.createdAt && typeof (p.createdAt as any).toDate === 'function') {
              try {
                const date = (p.createdAt as any).toDate();
                if (date instanceof Date) {
                  return date.getTime();
                }
              } catch {
                // Last resort is 0
              }
            }
            
            // Last resort: Return current time to avoid sorting issues
            return Date.now();
          } catch (err) {
            console.warn('⚠️ [PartialSubmission] Error extracting timestamp:', err);
            return Date.now(); // Use current time as fallback
          }
        })
        .filter(time => time > 0);
      
      const startedAt = validTimestamps.length > 0 
        ? new Date(Math.min(...validTimestamps)) 
        : new Date();
      
      // Create sorted array with defensive comparisons
      const sortedPartials = [...partials];
      try {
        sortedPartials.sort((a, b) => {
          // Default to 0 for missing indices
          const indexA = typeof a.questionIndex === 'number' ? a.questionIndex : 0;
          const indexB = typeof b.questionIndex === 'number' ? b.questionIndex : 0;
          return indexA - indexB;
        });
      } catch (err) {
        console.warn('⚠️ [PartialSubmission] Error sorting by question index:', err);
        // Keep original order if sorting fails
      }
      
      const recovery: SessionRecovery = {
        sessionId,
        candidateName: firstPartial.candidateName,
        interviewType: firstPartial.interviewType,
        totalQuestions: firstPartial.totalQuestions,
        completedQuestions: partials.length,
        lastQuestionIndex,
        canResume,
        partialSubmissions: sortedPartials,
        startedAt,
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
      console.log(`🔍 [PartialSubmission] Getting progress for session: ${sessionId}`);
      
      // 🔒 MINIMAL IMPACT FIX: Simple query without orderBy to avoid composite index requirement
      const q = query(
        collection(db, PARTIAL_SUBMISSIONS_COLLECTION),
        where('sessionId', '==', sessionId)
        // No orderBy - we'll sort on the client side
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      const partials = querySnapshot.docs.map(doc => {
        const data = doc.data();
        let timestamp = new Date();
        let createdAt = new Date();
        let updatedAt = new Date();
        
        // Handle Firestore Timestamp objects (most common case)
        if (data.timestamp && typeof data.timestamp.toDate === 'function') {
          timestamp = data.timestamp.toDate();
        } else if (data.timestamp instanceof Date) {
          timestamp = data.timestamp;
        } else if (data.timestamp && typeof data.timestamp === 'object' && 'seconds' in data.timestamp) {
          // Handle server timestamp that might be in { seconds: X, nanoseconds: Y } format
          timestamp = new Date(data.timestamp.seconds * 1000);
        }
        
        // Same pattern for createdAt
        if (data.createdAt && typeof data.createdAt.toDate === 'function') {
          createdAt = data.createdAt.toDate();
        } else if (data.createdAt instanceof Date) {
          createdAt = data.createdAt;
        } else if (data.createdAt && typeof data.createdAt === 'object' && 'seconds' in data.createdAt) {
          createdAt = new Date(data.createdAt.seconds * 1000);
        }
        
        // Same pattern for updatedAt
        if (data.updatedAt && typeof data.updatedAt.toDate === 'function') {
          updatedAt = data.updatedAt.toDate();
        } else if (data.updatedAt instanceof Date) {
          updatedAt = data.updatedAt;
        } else if (data.updatedAt && typeof data.updatedAt === 'object' && 'seconds' in data.updatedAt) {
          updatedAt = new Date(data.updatedAt.seconds * 1000);
        }
        
        return {
          id: doc.id,
          ...data,
          timestamp: timestamp,
          createdAt: createdAt,
          updatedAt: updatedAt
        } as PartialSubmission;
      });
      
      // Sort on client side instead of using orderBy in the query
      partials.sort((a, b) => a.questionIndex - b.questionIndex);
      
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
      
      // First, get all sessions and filter on client-side for safety
      const allSessionsQuery = query(
        collection(db, PARTIAL_SUBMISSIONS_COLLECTION)
      );
      
      const querySnapshot = await getDocs(allSessionsQuery);
      
      // Filter expired sessions manually to avoid timestamp conversion issues
      const expiredDocs = querySnapshot.docs.filter(doc => {
        try {
          const data = doc.data();
          let timestamp: Date | null = null;
          
          // Handle all possible timestamp formats with type assertions
          const rawTimestamp = data.timestamp as any;
          const rawCreatedAt = data.createdAt as any;
          
          // Try timestamp first in various formats
          if (rawTimestamp) {
            if (rawTimestamp instanceof Date) {
              timestamp = rawTimestamp;
            } else if (typeof rawTimestamp.toDate === 'function') {
              timestamp = rawTimestamp.toDate();
            } else if (typeof rawTimestamp === 'object' && 'seconds' in rawTimestamp) {
              timestamp = new Date(rawTimestamp.seconds * 1000);
            }
          }
          
          // Fall back to createdAt if timestamp is invalid
          if (!timestamp && rawCreatedAt) {
            if (rawCreatedAt instanceof Date) {
              timestamp = rawCreatedAt;
            } else if (typeof rawCreatedAt.toDate === 'function') {
              timestamp = rawCreatedAt.toDate();
            } else if (typeof rawCreatedAt === 'object' && 'seconds' in rawCreatedAt) {
              timestamp = new Date(rawCreatedAt.seconds * 1000);
            }
          }
          
          // Consider session expired if timestamp is valid and older than 7 days
          return timestamp && timestamp < sevenDaysAgo;
        } catch (err) {
          console.warn('⚠️ [PartialSubmission] Error checking expired session:', err);
          return false;
        }
      });
      
      // Delete expired sessions
      const deletePromises = expiredDocs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      console.log(`✅ [PartialSubmission] Cleaned up ${deletePromises.length} expired sessions`);
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
      
      // Upload to Firebase Storage using the same method as auth-context
      const downloadURL = await mediaStorage.uploadMediaToStorage(
        blob, 
        sessionId, // Use sessionId instead of temp submission ID
        questionIndex, 
        mediaType
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
