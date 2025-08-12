
'use client';

import React, { useState, useEffect } from 'react';
import { ProtectedRoute, useAuth } from '@/contexts/auth-context';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileSearch, ArrowLeft, Eye, Trash2, AlertTriangle, Download, Video, Mic, Type, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/header';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import app from '@/lib/firebase';
import type { Submission } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { detectFolderStructure } from '@/lib/folder-utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { extractAudioFromVideo } from '@/lib/audio-extractor';

// Initialize Firebase Storage
const storage = getStorage(app);

/**
 * Download blob from Firebase Storage URL with comprehensive CORS handling
 */
async function downloadFromFirebaseStorage(storageUrl: string): Promise<Blob> {
  console.log(`🚀 [DEBUG] Starting download for URL: ${storageUrl}`);
  console.log(`🚀 [DEBUG] URL length: ${storageUrl.length}`);
  console.log(`🚀 [DEBUG] URL type: ${typeof storageUrl}`);
  
  try {
    // Validate URL format first
    if (!storageUrl || typeof storageUrl !== 'string' || storageUrl.length < 10) {
      console.error(`❌ [DEBUG] Invalid URL format:`, { storageUrl, type: typeof storageUrl, length: storageUrl?.length });
      throw new Error(`Invalid URL format: ${storageUrl}`);
    }
    
    // Strategy 1: Use Firebase Storage SDK for authenticated downloads
    if (storageUrl.includes('firebasestorage.googleapis.com')) {
      console.log(`🔗 [DEBUG] Attempting Firebase Storage SDK download`);
      
      try {
        // Extract the file path from the Firebase Storage URL
        const urlParts = storageUrl.split('/o/')[1];
        console.log(`🔍 [DEBUG] URL parts after /o/:`, urlParts);
        
        if (urlParts) {
          const filePath = decodeURIComponent(urlParts.split('?')[0]);
          console.log(`📁 [DEBUG] Extracted file path: ${filePath}`);
          
<<<<<<< HEAD
          // 🔒 DETECT FOLDER STRUCTURE - Log structure type for debugging
          const structureType = detectFolderStructure(filePath);
          console.log(`🏗️ [DEBUG] Detected ${structureType} folder structure`);
=======
          // 🔒 CONSISTENT STRUCTURE - Now using submission ID-based folder structure
          console.log(`🏗️ [DEBUG] Using consistent submission ID-based folder structure`);
>>>>>>> 7113655f149d97853b811e869fec0dc3fa156ca7
          
          // Use Firebase Storage SDK to get a fresh download URL
          const storageRef = ref(storage, filePath);
          console.log(`📄 [DEBUG] Created storage ref for path: ${filePath}`);
          
          const freshDownloadUrl = await getDownloadURL(storageRef);
          console.log(`🔄 [DEBUG] Got fresh download URL from Firebase SDK: ${freshDownloadUrl.substring(0, 100)}...`);
          
          // Download using the fresh URL
          const response = await fetch(freshDownloadUrl, {
            method: 'GET',
            headers: {
              'Accept': '*/*',
              'Cache-Control': 'no-cache'
            }
          });
          
          console.log(`📊 [DEBUG] Firebase SDK fetch response: ${response.status} ${response.statusText}`);
          
          if (response.ok) {
            const blob = await response.blob();
            console.log(`✅ [DEBUG] Firebase SDK download successful (${blob.size} bytes)`);
            return blob;
          } else {
            console.warn(`⚠️ [DEBUG] Firebase SDK fetch failed: ${response.status} ${response.statusText}`);
          }
        } else {
          console.warn(`⚠️ [DEBUG] Could not extract file path from URL: ${storageUrl}`);
        }
      } catch (sdkError) {
        console.error(`❌ [DEBUG] Firebase SDK method failed:`, sdkError);
        console.error(`❌ [DEBUG] SDK Error details:`, {
          name: sdkError instanceof Error ? sdkError.name : 'Unknown',
          message: sdkError instanceof Error ? sdkError.message : String(sdkError),
          code: (sdkError as any)?.code || 'N/A'
        });
      }
      
      // Strategy 2: Direct download with authentication headers
      console.log(`🔗 [DEBUG] Attempting direct authenticated download`);
      try {
        const authResponse = await fetch(storageUrl, {
          method: 'GET',
          headers: {
            'Accept': '*/*',
            'Cache-Control': 'no-cache',
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'Accept'
          },
          credentials: 'include',
          mode: 'cors'
        });
        
        console.log(`📊 [DEBUG] Auth fetch response: ${authResponse.status} ${authResponse.statusText}`);
        
        if (authResponse.ok) {
          const blob = await authResponse.blob();
          console.log(`✅ [DEBUG] Authenticated download successful (${blob.size} bytes)`);
          return blob;
        } else {
          console.warn(`⚠️ [DEBUG] Auth fetch failed: ${authResponse.status} ${authResponse.statusText}`);
        }
      } catch (authError) {
        console.error(`❌ [DEBUG] Authenticated download failed:`, authError);
      }
      
      // Strategy 3: Simple fetch without credentials
      console.log(`� Attempting simple download without credentials`);
      try {
        const simpleResponse = await fetch(storageUrl, {
          method: 'GET',
          headers: {
            'Accept': '*/*'
          },
          mode: 'cors'
        });
        
        if (simpleResponse.ok) {
          const blob = await simpleResponse.blob();
          console.log(`✅ Simple download successful (${blob.size} bytes)`);
          return blob;
        }
      } catch (simpleError) {
        console.log(`⚠️ Simple download failed:`, simpleError);
      }
      
      // Strategy 4: Proxy through our own API endpoint (CORS bypass)
      console.log(`🔗 Attempting download through proxy API`);
      try {
        const proxyResponse = await fetch('/api/proxy-download', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ url: storageUrl })
        });
        
        if (proxyResponse.ok) {
          const blob = await proxyResponse.blob();
          console.log(`✅ Proxy download successful (${blob.size} bytes)`);
          return blob;
        }
      } catch (proxyError) {
        console.log(`⚠️ Proxy download failed:`, proxyError);
      }
      
      // Strategy 5: Last resort - invisible iframe download
      console.log(`🔗 Attempting iframe download method`);
      try {
        const iframeBlob = await downloadViaIframe(storageUrl);
        if (iframeBlob) {
          console.log(`✅ Iframe download successful (${iframeBlob.size} bytes)`);
          return iframeBlob;
        }
      } catch (iframeError) {
        console.log(`⚠️ Iframe download failed:`, iframeError);
      }
    }
    
    // If it's a Firebase Storage path, get a fresh download URL
    if (storageUrl.startsWith('submissions/')) {
      console.log(`🔗 Getting fresh download URL for path: ${storageUrl}`);
      const storageRef = ref(storage, storageUrl);
      const downloadUrl = await getDownloadURL(storageRef);
      
      // Recursively call this function with the download URL
      return await downloadFromFirebaseStorage(downloadUrl);
    }
    
    throw new Error('All download strategies failed');
  } catch (error) {
    console.error('❌ Firebase Storage download error:', error);
    throw error;
  }
}

/**
 * Download via invisible iframe (bypasses CORS for some scenarios)
 */
function downloadViaIframe(url: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      // Create invisible iframe
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = url;
      
      let resolved = false;
      const cleanup = () => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      };
      
      // Timeout after 10 seconds
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(null);
        }
      }, 10000);
      
      iframe.onload = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          cleanup();
          
          // Try to fetch from the iframe's document
          try {
            fetch(url).then(response => response.blob()).then(resolve).catch(() => resolve(null));
          } catch {
            resolve(null);
          }
        }
      };
      
      iframe.onerror = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          cleanup();
          resolve(null);
        }
      };
      
      document.body.appendChild(iframe);
    } catch {
      resolve(null);
    }
  });
}
import JSZip from 'jszip';


const SubmissionsPage = () => {
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const { getSubmissions, deleteSubmission, clearAllSubmissions, onSubmissionsChange } = useAuth();
    const { toast } = useToast();
    const [selectedSubmissions, setSelectedSubmissions] = useState<Record<string, boolean>>({});
    const [downloadTypes, setDownloadTypes] = useState({ video: false, audio: false, text: false });
    const [isDownloading, setIsDownloading] = useState(false);
    const [isLoadingInitial, setIsLoadingInitial] = useState(true);
    const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({});

    const fetchSubmissions = async () => {
        try {
            const data = await getSubmissions();
            setSubmissions(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            setIsLoadingInitial(false);
        } catch (error) {
            console.error('Error fetching submissions:', error);
            toast({
                variant: 'destructive',
                title: 'Error loading submissions',
                description: 'Failed to load submissions from the database.'
            });
            setIsLoadingInitial(false);
        }
    };

    useEffect(() => {
        console.log('🔄 Setting up real-time submissions listener');
        
        // Set up real-time listener
        const unsubscribe = onSubmissionsChange((realtimeSubmissions) => {
            console.log(`🔄 Real-time update received: ${realtimeSubmissions.length} submissions`);
            setSubmissions(realtimeSubmissions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            setIsLoadingInitial(false);
        });

        // Cleanup listener on unmount
        return () => {
            console.log('🔄 Cleaning up real-time submissions listener');
            unsubscribe();
        };
    }, [onSubmissionsChange]);

    const handleDelete = async (id: string) => {
        try {
            setIsDeleting(prev => ({ ...prev, [id]: true }));
            
            // Use the new cascading deletion API that removes both Firestore document and Storage files
            const response = await fetch(`/api/submissions/${id}/delete`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Deletion failed' }));
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('✅ Cascading deletion completed:', result);
            
            // Enhanced success message to indicate file cleanup
            const fileInfo = result.filesDeleted > 0 ? ` and ${result.filesDeleted} associated files` : '';
            
            // No need to call fetchSubmissions - real-time listener will update
            toast({
                title: 'Submission Deleted',
                description: `The selected interview report${fileInfo} have been removed.`,
            });
        } catch (error) {
            console.error('Error deleting submission:', error);
            toast({
                variant: 'destructive',
                title: 'Error deleting submission',
                description: error instanceof Error ? error.message : 'Failed to delete the submission.'
            });
        } finally {
            setIsDeleting(prev => ({ ...prev, [id]: false }));
        }
    }

    const handleClearAll = async () => {
        try {
            await clearAllSubmissions();
            // No need to call fetchSubmissions - real-time listener will update
            toast({
                title: 'All Submissions Cleared',
                description: 'The submissions list is now empty.',
            });
        } catch (error) {
            console.error('Error clearing submissions:', error);
            toast({
                variant: 'destructive',
                title: 'Error clearing submissions',
                description: 'Failed to clear all submissions.'
            });
        }
    }

    const handleDownloadSelected = async () => {
        setIsDownloading(true);
        const zip = new JSZip();
        const selectedIds = Object.keys(selectedSubmissions).filter(id => selectedSubmissions[id]);

        if (selectedIds.length === 0) {
            toast({ variant: 'destructive', title: 'No submissions selected' });
            setIsDownloading(false);
            return;
        }

        if (!downloadTypes.video && !downloadTypes.audio && !downloadTypes.text) {
            toast({ variant: 'destructive', title: 'No download type selected' });
            setIsDownloading(false);
            return;
        }

        const subsToDownload = submissions.filter(s => selectedIds.includes(s.id));

        for (const sub of subsToDownload) {
            const candidateFolder = zip.folder(`${sub.candidateName.replace(/ /g, '_')}_${sub.id.slice(-6)}`);
            if (!candidateFolder) continue;
            
            if (downloadTypes.text) {
                let textContent = `Report for ${sub.candidateName} (${sub.testType})\nDate: ${new Date(sub.date).toLocaleString()}\n\n`;
                textContent += `--- ANALYSIS ---\n`;
                textContent += `Strengths: ${sub.report.strengths}\n`;
                textContent += `Weaknesses: ${sub.report.weaknesses}\n`;
                textContent += `Summary: ${sub.report.summary}\n\n`;
                textContent += `--- TRANSCRIPT ---\n`;
                sub.history.forEach((h, i) => {
                    textContent += `Q${i + 1}: ${h.question}\n`;
                    textContent += `A${i + 1}: ${h.answer || 'No answer'}\n\n`;
                });
                candidateFolder.file('report.txt', textContent);
            }

            for (const [index, entry] of sub.history.entries()) {
                if (entry.videoDataUri) {
                    // Validate URL format
                    if (!entry.videoDataUri || entry.videoDataUri.length < 10) {
                        console.warn(`⚠️ Skipping Q${index + 1}: Invalid or empty videoDataUri`);
                        continue;
                    }
                    
                    // Type guard: ensure videoDataUri is defined for the rest of this block
                    const videoDataUri: string = entry.videoDataUri;
                    
                    // Check if it's a data URI or Firebase Storage URL
                    const isDataUri = videoDataUri.startsWith('data:');
                    const isVideo = isDataUri 
                      ? videoDataUri.startsWith('data:video')
                      : videoDataUri.includes('_video.');
                    
                    // Enhanced logic to handle audio extraction from videos
                    const shouldProcessVideo = isVideo && downloadTypes.video;
                    const shouldProcessAudio = downloadTypes.audio && (isVideo || !isVideo);
                    
                    if (shouldProcessVideo || shouldProcessAudio) {
                        console.log(`🔍 Processing Q${index + 1}: ${isVideo ? 'video' : 'audio'} file`);
                        console.log(`📝 URL type: ${isDataUri ? 'Data URI' : 'Storage URL'}`);
                        console.log(`🔗 URL preview: ${videoDataUri.substring(0, 100)}...`);
                        
                        try {
                            let videoBlob: Blob;
                            let extension = 'webm';
                            
                            // First, download the original file
                            if (isDataUri) {
                                // Handle data URI (original format)
                                try {
                                    const response = await fetch(videoDataUri);
                                    if (!response.ok) {
                                        throw new Error(`Data URI fetch failed: ${response.status}`);
                                    }
                                    videoBlob = await response.blob();
                                    console.log(`✅ Successfully processed data URI (${videoBlob.size} bytes)`);
                                } catch (dataUriError: unknown) {
                                    console.error(`❌ Data URI processing failed:`, dataUriError);
                                    const errorMessage = dataUriError instanceof Error ? dataUriError.message : String(dataUriError);
                                    throw new Error(`Data URI processing failed: ${errorMessage}`);
                                }
                            } else {
                                // Handle Firebase Storage URL with proper authentication
                                console.log(`📥 Downloading media from Firebase Storage: ${videoDataUri}`);
                                
                                try {
                                    videoBlob = await downloadFromFirebaseStorage(videoDataUri);
                                    console.log(`✅ Successfully downloaded from Firebase Storage (${videoBlob.size} bytes)`);
                                } catch (storageError: unknown) {
                                    const errorMessage = storageError instanceof Error ? storageError.message : String(storageError);
                                    console.error(`❌ Firebase Storage download failed:`, errorMessage);
                                    throw new Error(`Firebase Storage download failed: ${errorMessage}`);
                                }
                                
                                // Try to get extension from URL or blob type
                                const urlParts = videoDataUri.split('.');
                                if (urlParts.length > 1) {
                                    extension = urlParts[urlParts.length - 1].split('?')[0]; // Remove query params
                                }
                            }
                            
                            // Add original video file if video download is selected
                            if (shouldProcessVideo) {
                                candidateFolder.file(`Q${index + 1}_video.${extension}`, videoBlob);
                                console.log(`📁 Added video file: Q${index + 1}_video.${extension}`);
                            }
                            
                            // Add extracted audio if audio download is selected
                            if (shouldProcessAudio) {
                                if (isVideo) {
                                    // Extract audio from video
                                    try {
                                        console.log(`🎵 Extracting audio from video for Q${index + 1}`);
                                        const audioBlob = await extractAudioFromVideo(videoBlob);
                                        candidateFolder.file(`Q${index + 1}_audio.mp3`, audioBlob);
                                        console.log(`📁 Added extracted audio file: Q${index + 1}_audio.mp3`);
                                    } catch (audioError) {
                                        console.error(`❌ Audio extraction failed for Q${index + 1}:`, audioError);
                                        // Continue with other files even if audio extraction fails
                                    }
                                } else {
                                    // Original audio file - add as-is
                                    candidateFolder.file(`Q${index + 1}_audio.${extension}`, videoBlob);
                                    console.log(`📁 Added original audio file: Q${index + 1}_audio.${extension}`);
                                }
                            }
                        } catch (e) {
                            console.error(`Could not fetch media file for Q${index + 1}:`, e);
                            // Continue with other files even if one fails
                        }
                    }
                }
            }
        }

        try {
            const zipContent = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipContent);
            link.download = `VerbalInsights_Submissions_${new Date().toISOString().slice(0,10)}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            toast({ title: 'Download Started', description: 'Your ZIP file is being prepared.' });
        } catch(e) {
            console.error("Error generating ZIP file", e);
            toast({ variant: 'destructive', title: 'Download Failed', description: 'Could not generate the ZIP file.' });
        } finally {
            setIsDownloading(false);
        }
    };


    const toggleSelectAll = (checked: boolean) => {
        const newSelected: Record<string, boolean> = {};
        if (checked) {
            submissions.forEach(s => newSelected[s.id] = true);
        }
        setSelectedSubmissions(newSelected);
    }
    
    const allSelected = submissions.length > 0 && submissions.every(s => selectedSubmissions[s.id]);


    return (
        <>
            <Header />
            <div className="container mx-auto px-4 sm:px-8 py-8">
                <header className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-4xl font-headline text-primary flex items-center gap-4">
                            <FileSearch className="h-10 w-10" />
                            Interview Submissions
                        </h1>
                        <p className="text-muted-foreground">Review completed candidate assessments.</p>
                    </div>
                     <Link href="/admin" passHref>
                        <Button variant="outline">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Dashboard
                        </Button>
                    </Link>
                </header>
                <main>
                    <Card className="bg-card/60 backdrop-blur-xl mb-8">
                        <CardHeader>
                            <CardTitle>Download Center</CardTitle>
                            <CardDescription>Select submissions from the table below, choose what to download, and click the button.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col sm:flex-row items-center gap-6">
                            <div className="flex items-center space-x-4">
                               <div className="flex items-center space-x-2">
                                 <Checkbox id="download-video" checked={downloadTypes.video} onCheckedChange={(checked) => setDownloadTypes(d => ({...d, video: !!checked}))} />
                                 <Label htmlFor="download-video" className="flex items-center gap-2"><Video />Videos</Label>
                               </div>
                                <div className="flex items-center space-x-2">
                                 <Checkbox id="download-audio" checked={downloadTypes.audio} onCheckedChange={(checked) => setDownloadTypes(d => ({...d, audio: !!checked}))} />
                                 <Label htmlFor="download-audio" className="flex items-center gap-2"><Mic />Audio</Label>
                               </div>
                                <div className="flex items-center space-x-2">
                                 <Checkbox id="download-text" checked={downloadTypes.text} onCheckedChange={(checked) => setDownloadTypes(d => ({...d, text: !!checked}))} />
                                 <Label htmlFor="download-text" className="flex items-center gap-2"><Type />Text</Label>
                               </div>
                            </div>
                             <Button onClick={handleDownloadSelected} disabled={isDownloading}>
                                {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>}
                                {isDownloading ? 'Zipping...' : 'Download Selected'}
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="bg-card/60 backdrop-blur-xl">
                        <CardHeader className="flex flex-row items-start justify-between">
                           <div>
                            <CardTitle className="flex items-center gap-2">
                                All Submissions
                                <div className="flex items-center gap-1 text-xs text-green-600">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    Live
                                </div>
                            </CardTitle>
                                <CardDescription>
                                    Click on a row to view the detailed report for each submission. Updates automatically when new submissions are added.
                                </CardDescription>
                           </div>
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive">
                                        <Trash2 className="mr-2 h-4 w-4" /> Clear All
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete all submission data from your local storage.
                                        This is useful if you are running out of browser storage space.
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleClearAll}>
                                        Yes, delete all
                                    </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[50px]">
                                            <Checkbox
                                                checked={allSelected}
                                                onCheckedChange={(checked) => toggleSelectAll(!!checked)}
                                                aria-label="Select all"
                                            />
                                        </TableHead>
                                        <TableHead>Candidate Name</TableHead>
                                        <TableHead>Test Type</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoadingInitial ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8">
                                                <div className="flex items-center justify-center gap-2">
                                                    <Loader2 className="h-5 w-5 animate-spin" />
                                                    Loading submissions...
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : submissions.length > 0 ? (
                                        submissions.map((sub) => (
                                            <TableRow key={sub.id}>
                                                <TableCell>
                                                    <Checkbox
                                                        checked={selectedSubmissions[sub.id] || false}
                                                        onCheckedChange={(checked) => setSelectedSubmissions(prev => ({...prev, [sub.id]: !!checked}))}
                                                        aria-label={`Select submission from ${sub.candidateName}`}
                                                    />
                                                </TableCell>
                                                <TableCell className="font-medium">{sub.candidateName}</TableCell>
                                                <TableCell>{sub.testType}</TableCell>
                                                <TableCell>{new Date(sub.date).toLocaleDateString()}</TableCell>
                                                <TableCell className="text-right space-x-2">
                                                    <Link href={`/admin/report/${sub.id}`} passHref>
                                                        <Button variant="ghost" size="icon">
                                                            <Eye className="h-5 w-5" />
                                                            <span className="sr-only">View Report</span>
                                                        </Button>
                                                    </Link>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon"
                                                                disabled={isDeleting[sub.id]}
                                                            >
                                                                {isDeleting[sub.id] ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <Trash2 className="h-5 w-5 text-destructive" />
                                                                )}
                                                                <span className="sr-only">
                                                                    {isDeleting[sub.id] ? 'Deleting...' : 'Delete'}
                                                                </span>
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This action will permanently delete the submission for {sub.candidateName}.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDelete(sub.id)}>
                                                            Delete
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                                                No submissions found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </main>
            </div>
        </>
    );
};

const ProtectedSubmissionsPage = () => (
    <ProtectedRoute adminOnly>
        <SubmissionsPage />
    </ProtectedRoute>
);

export default ProtectedSubmissionsPage;
