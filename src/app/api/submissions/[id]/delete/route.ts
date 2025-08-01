import { NextRequest, NextResponse } from 'next/server';
import { submissionService } from '@/lib/database';
import { getStorage, ref, listAll, deleteObject } from 'firebase/storage';
import app from '@/lib/firebase';
import { getPossibleFolderPaths } from '@/lib/folder-utils';

const storage = getStorage(app);

/**
 * DELETE /api/submissions/[id]/delete
 * 
 * Cascading deletion endpoint that removes both:
 * 1. Firestore submission document 
 * 2. All associated Firebase Storage files
 * 
 * This ensures complete data cleanup and prevents orphaned files.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const submissionId = params.id;
    
    if (!submissionId || typeof submissionId !== 'string') {
      console.error('❌ Invalid submission ID provided:', submissionId);
      return NextResponse.json(
        { error: 'Valid submission ID is required' },
        { status: 400 }
      );
    }

    console.log(`🗑️ Starting cascading deletion for submission: ${submissionId}`);

    // Step 1: Verify submission exists before attempting deletion
    const submission = await submissionService.getById(submissionId);
    if (!submission) {
      console.warn(`⚠️ Submission not found: ${submissionId}`);
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    let filesDeleted = 0;
    let storageErrors: string[] = [];

    // Step 2: Delete all Firebase Storage files for this submission
    console.log(`🔥 Starting cascading deletion for submission: ${submissionId}`);
    
    // 🔒 DUAL STRUCTURE SUPPORT - Check both possible folder paths
    const possiblePaths = getPossibleFolderPaths(submissionId, submission.candidateName);
    console.log(`📁 Checking ${possiblePaths.length} possible folder paths:`, possiblePaths);
    
    for (const folderPath of possiblePaths) {
      try {
        // Remove trailing slash and get folder name for Firebase Storage ref
        const cleanFolderPath = folderPath.replace(/\/$/, '');
        const submissionFolderRef = ref(storage, cleanFolderPath);
        
        // List all files in this folder
        const listResult = await listAll(submissionFolderRef);
        
        console.log(`📁 Found ${listResult.items.length} files in ${cleanFolderPath}`);
        
        if (listResult.items.length > 0) {
          // Delete all files in parallel for better performance
          const deletePromises = listResult.items.map(async (fileRef) => {
            try {
              await deleteObject(fileRef);
              console.log(`✅ Successfully deleted file: ${fileRef.fullPath}`);
              return { success: true, path: fileRef.fullPath };
            } catch (fileError) {
              const errorMsg = `Failed to delete ${fileRef.fullPath}: ${fileError instanceof Error ? fileError.message : String(fileError)}`;
              console.error(`❌ ${errorMsg}`);
              return { success: false, path: fileRef.fullPath, error: errorMsg };
            }
          });
          
          const deleteResults = await Promise.all(deletePromises);
          
          // Count successful deletions and collect errors
          const successfulDeletes = deleteResults.filter(result => result.success).length;
          filesDeleted += successfulDeletes;
          
          const folderErrors = deleteResults
            .filter(result => !result.success)
            .map(result => result.error || 'Unknown error');
          storageErrors.push(...folderErrors);
          
          console.log(`✅ Deleted ${successfulDeletes} files from ${cleanFolderPath}`);
          
          if (folderErrors.length > 0) {
            console.warn(`⚠️ Some files failed to delete from ${cleanFolderPath}:`, folderErrors);
          }
        } else {
          console.log(`📝 No files found in ${cleanFolderPath}`);
        }
        
      } catch (storageListError) {
        console.log(`📝 Folder ${folderPath} not accessible (likely doesn't exist):`, 
          storageListError instanceof Error ? storageListError.message : String(storageListError));
        // This is expected for one of the two possible paths, so we continue
      }
    }

    console.log(`� Storage deletion complete: ${filesDeleted} total files deleted`);
    
    if (storageErrors.length > 0) {
      console.warn(`⚠️ ${storageErrors.length} storage errors encountered:`, storageErrors);
    }

    // Step 3: Delete the Firestore document
    console.log(`🗄️ Deleting Firestore document: ${submissionId}`);
    const firestoreDeleteSuccess = await submissionService.delete(submissionId);
    
    if (!firestoreDeleteSuccess) {
      console.error(`❌ Failed to delete Firestore document: ${submissionId}`);
      return NextResponse.json(
        { 
          error: 'Failed to delete submission from database',
          details: 'Firestore deletion failed',
          submissionId,
          filesDeleted,
          storageErrors
        },
        { status: 500 }
      );
    }

    console.log(`✅ Successfully completed cascading deletion for: ${submissionId}`);
    console.log(`📊 Deletion summary: ${filesDeleted} files deleted, ${storageErrors.length} storage errors`);

    return NextResponse.json({
      success: true,
      message: 'Submission and associated files deleted successfully',
      submissionId,
      filesDeleted,
      storageErrors: storageErrors.length > 0 ? storageErrors : undefined
    });

  } catch (error) {
    console.error('❌ Unexpected error during cascading deletion:', error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('❌ Error details:', { message: errorMessage, stack: errorStack });
    
    return NextResponse.json(
      { 
        error: 'Internal server error during deletion',
        details: errorMessage,
        submissionId: params.id
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS request for CORS preflight (following existing pattern)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
