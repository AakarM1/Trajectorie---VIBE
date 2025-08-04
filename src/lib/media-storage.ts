import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import app from './firebase';
import { generateUserSubmissionPath, isUserNamedFoldersEnabled } from './folder-utils';

// Initialize Firebase Storage
const storage = getStorage(app);

/**
 * 🔒 ENHANCED WITH MINIMAL IMPACT - Upload media blob to Firebase Storage with user-named folder support
 * @param blob - The media blob (audio/video)
 * @param submissionId - The submission ID for organizing files
 * @param entryIndex - The question index
 * @param mediaType - 'audio' or 'video'
 * @param candidateName - Optional candidate name for user-named folders (NEW PARAMETER)
 * @returns Promise<string> - The download URL
 */
export async function uploadMediaToStorage(
  blob: Blob,
  submissionId: string,
  entryIndex: number,
  mediaType: 'audio' | 'video',
  candidateName?: string // 🔒 NEW OPTIONAL PARAMETER - maintains backward compatibility
): Promise<string> {
  try {
    // 🔒 MINIMAL IMPACT - Choose folder structure based on feature flag and available data
    let folderPath: string;
    
    if (candidateName && isUserNamedFoldersEnabled()) {
      // NEW: Use user-named folder structure
      folderPath = generateUserSubmissionPath(candidateName, submissionId);
      console.log(`📁 Using user-named folder: ${folderPath}`);
    } else {
      // LEGACY: Use original submission ID structure (100% backward compatible)
      folderPath = submissionId;
    }
    
    const fileName = `submissions/${folderPath}/Q${entryIndex + 1}_${mediaType}.webm`;
    const storageRef = ref(storage, fileName);
    
    const snapshot = await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    console.log(`✅ ${mediaType} uploaded to Firebase Storage:`, fileName);
    return downloadURL;
  } catch (error) {
    console.error(`❌ Error uploading ${mediaType} to Firebase Storage:`, error);
    throw error;
  }
}

/**
 * Check if a data URI is too large for Firestore (approaching 1MB limit)
 * We'll use 500KB as the threshold to be safe
 * @param dataUri - The data URI string
 * @returns boolean - True if the data URI is too large
 */
export function isDataUriTooLarge(dataUri: string): boolean {
  // Rough calculation: base64 encoding increases size by ~33%
  // Plus overhead from the data URI prefix
  const estimatedSize = (dataUri.length * 3) / 4; // Convert from base64 to bytes
  const maxSizeBytes = 500 * 1024; // 500KB threshold
  
  return estimatedSize > maxSizeBytes;
}

/**
 * Convert data URI to blob
 * @param dataUri - The data URI string
 * @returns Promise<Blob> - The blob
 */
export function dataUriToBlob(dataUri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const response = fetch(dataUri);
      response.then(res => res.blob()).then(resolve).catch(reject);
    } catch (error) {
      reject(error);
    }
  });
}
