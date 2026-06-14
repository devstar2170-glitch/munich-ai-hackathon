'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';

export default function FeedbackPage() {
    const params = useParams();
    const token = params.token as string;

    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [response, setResponse] = useState<'accepted' | 'declined' | null>(null);
    const [comment, setComment] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        async function fetchFeedback() {
            try {
                const res = await fetch(`/api/feedback/${token}`);
                const result = await res.json();
                if (result.status === 'success') {
                    setData(result.data);
                    if (result.data.alreadySubmitted) {
                        setSubmitted(true);
                    }
                } else {
                    setError(result.error || 'Feedback link not found');
                }
            } catch {
                setError('Failed to load feedback page');
            } finally {
                setIsLoading(false);
            }
        }
        fetchFeedback();
    }, [token]);

    const handleSubmit = async () => {
        if (!response) return;
        setIsSubmitting(true);

        const formData = new FormData();
        formData.append('response', response);
        if (comment) formData.append('comment', comment);
        if (file) formData.append('file', file);

        try {
            const res = await fetch(`/api/feedback/${token}`, {
                method: 'POST',
                body: formData,
            });
            const result = await res.json();
            if (result.status === 'success') {
                setSubmitted(true);
            } else {
                setError(result.error || 'Failed to submit feedback');
            }
        } catch {
            setError('Failed to submit feedback');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
                <p className="text-zinc-400">Loading...</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
                <p className="text-red-500">{error || 'Feedback link not found'}</p>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
                <div className="max-w-md mx-auto text-center px-6">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8">
                        <div className="text-4xl mb-4">{data.feedbackResponse === 'declined' ? '👋' : '🎉'}</div>
                        <h1 className="text-2xl font-bold mb-2">Thank you!</h1>
                        <p className="text-zinc-500">
                            Your feedback for <span className="font-semibold text-zinc-700 dark:text-zinc-300">{data.projectName}</span> has been recorded.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
            <main className="max-w-2xl mx-auto px-6 py-12">
                <h1 className="text-3xl font-bold mb-1">Project Assignment Feedback</h1>
                <p className="text-zinc-500 mb-8">
                    You&apos;ve been selected for a new project. Please review and respond below.
                </p>

                {/* Project details card */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 mb-6">
                    <h2 className="text-lg font-bold mb-4">Assignment Details</h2>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-zinc-500">Project</span>
                            <span className="text-sm font-semibold">{data.projectName}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-zinc-500">Your Role</span>
                            <span className="text-sm font-semibold">{data.candidateRole}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-zinc-500">Match Score</span>
                            <span className="text-sm font-bold text-blue-600">{data.matchScore}%</span>
                        </div>
                    </div>
                </section>

                {/* Response selection */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 mb-6">
                    <h2 className="text-lg font-bold mb-4">Your Response</h2>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setResponse('accepted')}
                            className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm border-2 transition-all ${response === 'accepted'
                                    ? 'border-green-500 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300'
                                    : 'border-zinc-200 dark:border-zinc-700 hover:border-green-300 dark:hover:border-green-800'
                                }`}
                        >
                            ✓ Accept
                        </button>
                        <button
                            onClick={() => setResponse('declined')}
                            className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm border-2 transition-all ${response === 'declined'
                                    ? 'border-red-500 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300'
                                    : 'border-zinc-200 dark:border-zinc-700 hover:border-red-300 dark:hover:border-red-800'
                                }`}
                        >
                            ✗ Decline
                        </button>
                    </div>
                </section>

                {/* Comment */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 mb-6">
                    <h2 className="text-lg font-bold mb-2">Comments</h2>
                    <p className="text-sm text-zinc-500 mb-3">Optional — share any thoughts, concerns, or availability notes.</p>
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={4}
                        placeholder="e.g. I'm available starting next month..."
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </section>

                {/* File upload */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 mb-8">
                    <h2 className="text-lg font-bold mb-2">Attachment</h2>
                    <p className="text-sm text-zinc-500 mb-3">Optional — upload a relevant document (CV, availability schedule, etc.)</p>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-xl text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                    >
                        {file ? file.name : '+ Choose File'}
                    </button>
                    {file && (
                        <button
                            onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                            className="ml-2 text-sm text-red-500 hover:text-red-700"
                        >
                            Remove
                        </button>
                    )}
                </section>

                {/* Submit */}
                <button
                    onClick={handleSubmit}
                    disabled={!response || isSubmitting}
                    className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
                </button>
            </main>
        </div>
    );
}
