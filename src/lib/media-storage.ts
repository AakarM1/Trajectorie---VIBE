import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import app from './firebase';

// Initialize Firebase Storage
const storage = getStorage(app);

/**
 * Upload media blob to Firebase Storage and return the download URL
 * @param blob - The media blob (audio/video)
 * @param submissionId - The submission ID for organizing files
 * @param entryIndex - The question index
 * @param mediaType - 'audio' or 'video'
 * @returns Promise<string> - The download URL
 */
export async function uploadMediaToStorage(
  blob: Blob,
  submissionId: string,
  entryIndex: number,
  mediaType: 'audio' | 'video'
): Promise<string> {
  try {
    const fileName = `submissions/${submissionId}/Q${entryIndex + 1}_${mediaType}.webm`;
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
