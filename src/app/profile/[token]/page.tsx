'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';

const ARRAY_FIELDS = ['skills', 'certifications', 'pastIndustryExperience', 'futureIndustryWish'];

export default function ProfilePage() {
  const params = useParams();
  const token = params.token as string;

  const [employee, setEmployee] = useState<any>(null);
  const [gaps, setGaps] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`/api/profile/${token}`);
      const result = await res.json();
      if (result.status === 'success') {
        setEmployee(result.data.employee);
        setGaps(result.data.gaps);
      } else {
        setError(result.error || 'Profile not found');
      }
    } catch (err) {
      setError('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [token]);

  const handleAnswerChange = (field: string, value: string) => {
    setAnswers(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    const updates: Record<string, any> = {};

    for (const gap of gaps) {
      const value = answers[gap.field];
      if (value === undefined || value === '') continue;

      if (ARRAY_FIELDS.includes(gap.field)) {
        updates[gap.field] = value.split(',').map((s: string) => s.trim()).filter(Boolean);
      } else if (gap.field === 'yearsOfExperience') {
        updates[gap.field] = Number(value);
      } else {
        updates[gap.field] = value;
      }
    }

    try {
      await fetch(`/api/profile/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      setSaved(true);
      setAnswers({});
      await fetchProfile();
    } catch (err) {
      setError('Failed to save your answers');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/profile/${token}/upload`, {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();
      if (result.status === 'success') {
        setUploadResult(result.data);
        await fetchProfile();
      } else {
        setError(result.error || 'Failed to process document');
      }
    } catch (err) {
      setError('Failed to upload document');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <p className="text-zinc-400">Loading your profile...</p>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <p className="text-red-500">{error || 'Profile not found'}</p>
      </div>
    );
  }

  const pendingUpdates = employee.pendingUpdates || {};
  const pendingFields = Object.keys(pendingUpdates);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-1">
          Hi {employee.firstName}, let&apos;s complete your profile
        </h1>
        <p className="text-zinc-500 mb-8">
          This helps us match you to the right projects.
        </p>

        {/* Upload supplement */}
        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-bold mb-2">Upload a document</h2>
          <p className="text-sm text-zinc-500 mb-4">
            Upload an updated CV, project deck (PPTX), or certificate (PDF) and we&apos;ll
            automatically pull in any new details.
          </p>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".pdf,.pptx,.docx"
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isUploading ? 'Processing...' : '+ Upload Document'}
          </button>

          {uploadResult && (
            <div className="mt-4 space-y-2">
              {uploadResult.applied?.length > 0 && (
                <p className="text-sm text-green-600">
                  Updated: {uploadResult.applied.map((a: any) => a.field).join(', ')}
                </p>
              )}
              {uploadResult.pending?.length > 0 && (
                <p className="text-sm text-amber-600">
                  Flagged for HR review: {uploadResult.pending.map((p: any) => p.field).join(', ')}
                </p>
              )}
              {!uploadResult.applied?.length && !uploadResult.pending?.length && (
                <p className="text-sm text-zinc-400">No new information found in this document.</p>
              )}
            </div>
          )}
        </section>

        {/* Pending updates awaiting HR review */}
        {pendingFields.length > 0 && (
          <section className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl p-6 mb-8">
            <h2 className="text-lg font-bold mb-3">Pending HR review</h2>
            <div className="space-y-3">
              {pendingFields.map((field) => {
                const p = pendingUpdates[field];
                const value = Array.isArray(p.value) ? p.value.join(', ') : p.value;
                return (
                  <div key={field} className="flex items-start gap-2">
                    <span className="text-[10px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded mt-0.5">NEW</span>
                    <div>
                      <p className="text-sm font-bold">{field}: <span className="font-normal">{value}</span></p>
                      <p className="text-xs text-zinc-500">From {p.source} · {p.reasoning}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Gap questions */}
        {gaps.length > 0 ? (
          <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4">A few quick questions</h2>
            <div className="space-y-5 mb-6">
              {gaps.map((gap: any) => (
                <div key={gap.field}>
                  <label className="text-sm font-bold mb-1 block">{gap.question}</label>
                  {gap.options && gap.options.length > 0 ? (
                    <select
                      value={answers[gap.field] || ''}
                      onChange={(e) => handleAnswerChange(gap.field, e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-sm"
                    >
                      <option value="">— Select —</option>
                      {gap.options.map((opt: string) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={answers[gap.field] || ''}
                      onChange={(e) => handleAnswerChange(gap.field, e.target.value)}
                      placeholder={ARRAY_FIELDS.includes(gap.field) ? 'Comma separated' : ''}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-sm"
                    />
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={handleSubmit}
              disabled={isSaving}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Answers'}
            </button>
            {saved && <p className="text-sm text-green-600 mt-3">Thanks, your profile has been updated!</p>}
          </section>
        ) : (
          <p className="text-sm text-zinc-400">Your profile looks complete. Thanks!</p>
        )}
      </main>
    </div>
  );
}
