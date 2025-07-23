
'use client';

import React, { useState, useEffect } from 'react';
import { ProtectedRoute, useAuth } from '@/contexts/auth-context';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileSearch, ArrowLeft, Eye, Trash2, AlertTriangle, Download, Video, Mic, Type, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/header';
import type { Submission } from '@/types';
import { useToast } from '@/hooks/use-toast';
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
import JSZip from 'jszip';


const SubmissionsPage = () => {
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const { getSubmissions, deleteSubmission, clearAllSubmissions, onSubmissionsChange } = useAuth();
    const { toast } = useToast();
    const [selectedSubmissions, setSelectedSubmissions] = useState<Record<string, boolean>>({});
    const [downloadTypes, setDownloadTypes] = useState({ video: false, audio: false, text: false });
    const [isDownloading, setIsDownloading] = useState(false);
    const [isLoadingInitial, setIsLoadingInitial] = useState(true);

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
            await deleteSubmission(id);
            // No need to call fetchSubmissions - real-time listener will update
            toast({
                title: 'Submission Deleted',
                description: 'The selected interview report has been removed.',
            });
        } catch (error) {
            console.error('Error deleting submission:', error);
            toast({
                variant: 'destructive',
                title: 'Error deleting submission',
                description: 'Failed to delete the submission.'
            });
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
                    // Check if it's a data URI or Firebase Storage URL
                    const isDataUri = entry.videoDataUri.startsWith('data:');
                    const isVideo = isDataUri 
                      ? entry.videoDataUri.startsWith('data:video')
                      : entry.videoDataUri.includes('video') || entry.videoDataUri.includes('Q') && entry.videoDataUri.includes('_video');
                    
                    if ((isVideo && downloadTypes.video) || (!isVideo && downloadTypes.audio)) {
                        try {
                            let blob: Blob;
                            let extension = 'webm';
                            
                            if (isDataUri) {
                                // Handle data URI (original format)
                                const response = await fetch(entry.videoDataUri);
                                blob = await response.blob();
                            } else {
                                // Handle Firebase Storage URL
                                console.log(`📥 Downloading media from Firebase Storage: ${entry.videoDataUri}`);
                                const response = await fetch(entry.videoDataUri);
                                if (!response.ok) {
                                    throw new Error(`Failed to fetch from storage: ${response.statusText}`);
                                }
                                blob = await response.blob();
                                
                                // Try to get extension from URL or blob type
                                const urlParts = entry.videoDataUri.split('.');
                                if (urlParts.length > 1) {
                                    extension = urlParts[urlParts.length - 1].split('?')[0]; // Remove query params
                                }
                            }
                            
                            candidateFolder.file(`Q${index + 1}_${isVideo ? 'video' : 'audio'}.${extension}`, blob);
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
                                                            <Button variant="ghost" size="icon">
                                                                <Trash2 className="h-5 w-5 text-destructive" />
                                                                <span className="sr-only">Delete</span>
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
