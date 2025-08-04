/**
 * 🔒 MINIMAL IMPACT UTILITY - Folder naming utilities for user-named submission folders
 * This utility provides helper functions for the gradual migration to user-named folders
 * while maintaining 100% backward compatibility with existing folder structures.
 */

/**
 * Generate a user-friendly folder name from candidate name and submission ID
 * Format: {sanitizedName}_sub_{shortId}
 * Example: "john_doe_sub_abc12345"
 * 
 * @param candidateName - The candidate's name
 * @param submissionId - The full submission ID
 * @returns Sanitized folder name safe for Firebase Storage
 */
export function generateUserSubmissionPath(candidateName: string, submissionId: string): string {
  // Sanitize candidate name for safe folder naming
  const sanitizedName = candidateName
    .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .toLowerCase()
    .trim()
    .substring(0, 20); // Limit to 20 characters for path safety
  
  // Use last 8 characters of submission ID for uniqueness
  const shortId = submissionId.slice(-8);
  
  return `${sanitizedName}_sub_${shortId}`;
}

/**
 * Detect folder structure type from a file path
 * 
 * @param filePath - The Firebase Storage file path
 * @returns Structure type: 'legacy' or 'user-named'
 */
export function detectFolderStructure(filePath: string): 'legacy' | 'user-named' {
  // Check if path contains the user-named pattern: *_sub_*
  if (filePath.includes('_sub_')) {
    return 'user-named';
  }
  
  // Default to legacy structure
  return 'legacy';
}

/**
 * Generate all possible folder paths for a submission (for deletion/migration)
 * This ensures we can find files regardless of which structure was used
 * 
 * @param submissionId - The submission ID
 * @param candidateName - The candidate name (optional for legacy support)
 * @returns Array of possible folder paths to check
 */
export function getPossibleFolderPaths(submissionId: string, candidateName?: string): string[] {
  const paths: string[] = [
    `submissions/${submissionId}/` // Legacy structure (always check)
  ];
  
  // Add user-named structure if candidate name is available
  if (candidateName) {
    const userPath = generateUserSubmissionPath(candidateName, submissionId);
    paths.push(`submissions/${userPath}/`);
  }
  
  return paths;
}

/**
 * Feature flag for user-named folders
 * Controls whether new uploads use user-named folder structure
 * 
 * @returns True if user-named folders should be used for new uploads
 */
export function isUserNamedFoldersEnabled(): boolean {
  // Default to false for gradual rollout
  return process.env.NEXT_PUBLIC_ENABLE_USER_NAMED_FOLDERS === 'true';
}

/**
 * 🔒 BACKWARD COMPATIBILITY HELPER
 * Extract submission ID from either folder structure type
 * 
 * @param folderPath - Either legacy or user-named folder path
 * @returns The submission ID
 */
export function extractSubmissionIdFromPath(folderPath: string): string | null {
  // Remove "submissions/" prefix and trailing "/"
  const cleanPath = folderPath.replace(/^submissions\//, '').replace(/\/$/, '');
  
  if (cleanPath.includes('_sub_')) {
    // User-named structure: extract from suffix
    const parts = cleanPath.split('_sub_');
    if (parts.length === 2) {
      // The short ID is the last part, but we need to reconstruct or find full ID
      return parts[1]; // This is the short ID, caller needs to handle lookup
    }
  }
  
  // Legacy structure: the folder name IS the submission ID
  return cleanPath;
}
