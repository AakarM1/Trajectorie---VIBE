
'use client';

import React, { useState, useEffect } from 'react';
import { ProtectedRoute, useAuth } from '@/contexts/auth-context';
import { useParams, useRouter } from 'next/navigation';
import type { Submission } from '@/types';
import ConversationSummary from '@/components/conversation-summary';
import { Loader2, ArrowLeft } from 'lucide-react';
import Header from '@/components/header';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const ReportDetailPage = () => {
    const { getSubmissionById } = useAuth();
    const router = useRouter();
    const params = useParams();
    const id = Array.isArray(params.id) ? params.id[0] : params.id as string;

    const [submission, setSubmission] = useState<Submission | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            const data = getSubmissionById(id);
            if (data) {
                setSubmission(data);
            }
            setLoading(false);
        }
    }, [id, getSubmissionById]);

    const handleBack = () => {
        router.push('/admin/submissions');
    };

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
        );
    }

    if (!submission) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center">
                <p className="text-xl text-destructive mb-4">Report not found.</p>
                <Button onClick={handleBack}>
                     <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Submissions
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-grow flex flex-col items-center p-4 sm:p-6 lg:p-8">
                <div className="w-full max-w-4xl mb-4">
                     <Link href="/admin/submissions" passHref>
                        <Button variant="outline">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to All Submissions
                        </Button>
                    </Link>
                </div>
                <ConversationSummary
                    analysisResult={submission.report}
                    history={submission.history}
                    onReattempt={handleBack}
                    reattemptText="Back to Submissions"
                />
            </main>
        </div>
    );
};


const ProtectedReportDetailPage = () => (
    <ProtectedRoute adminOnly>
        <ReportDetailPage />
    </ProtectedRoute>
);

export default ProtectedReportDetailPage;
