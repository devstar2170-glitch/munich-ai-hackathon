import { NextResponse } from 'next/server';
import { getProjectByFeedbackToken, saveProject } from '@/lib/storage';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
    try {
        const { token } = await params;
        const result = await getProjectByFeedbackToken(token);

        if (!result) {
            return NextResponse.json({ status: 'error', error: 'Invalid feedback link' }, { status: 404 });
        }

        const { project, candidate } = result;

        return NextResponse.json({
            status: 'success',
            data: {
                projectName: project.name,
                candidateName: candidate.name,
                candidateRole: candidate.role,
                matchScore: candidate.match,
                alreadySubmitted: !!candidate.feedbackResponse,
                feedbackResponse: candidate.feedbackResponse || null,
                feedbackComment: candidate.feedbackComment || null,
            },
        });
    } catch (error) {
        console.error('Error fetching feedback:', error);
        return NextResponse.json({ status: 'error', error: 'Failed to load feedback' }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
    try {
        const { token } = await params;
        const result = await getProjectByFeedbackToken(token);

        if (!result) {
            return NextResponse.json({ status: 'error', error: 'Invalid feedback link' }, { status: 404 });
        }

        const { project, candidate } = result;

        if (candidate.feedbackResponse) {
            return NextResponse.json({ status: 'error', error: 'Feedback already submitted' }, { status: 400 });
        }

        const formData = await request.formData();
        const response = formData.get('response') as string;
        const comment = formData.get('comment') as string | null;
        const file = formData.get('file') as File | null;

        if (response !== 'accepted' && response !== 'declined') {
            return NextResponse.json({ status: 'error', error: 'Response must be "accepted" or "declined"' }, { status: 400 });
        }

        // Handle file upload
        let uploadedFileName: string | undefined;
        if (file && file.size > 0) {
            const uploadsDir = path.join(process.cwd(), 'public', 'feedback-uploads');
            await fs.mkdir(uploadsDir, { recursive: true });
            const ext = path.extname(file.name) || '';
            const safeName = `${token}-${Date.now()}${ext}`;
            const buffer = Buffer.from(await file.arrayBuffer());
            await fs.writeFile(path.join(uploadsDir, safeName), buffer);
            uploadedFileName = safeName;
        }

        // Update the candidate's feedback in the project
        const updatedCandidates = project.matchCandidates.map(c => {
            if (c.feedbackToken === token) {
                return {
                    ...c,
                    feedbackResponse: response as 'accepted' | 'declined',
                    feedbackComment: comment || undefined,
                    feedbackFileUploaded: uploadedFileName,
                };
            }
            return c;
        });

        const updatedProject = {
            ...project,
            matchCandidates: updatedCandidates,
        };

        await saveProject(updatedProject);

        return NextResponse.json({ status: 'success', data: { response, comment, fileUploaded: !!uploadedFileName } });
    } catch (error) {
        console.error('Error saving feedback:', error);
        return NextResponse.json({ status: 'error', error: 'Failed to save feedback' }, { status: 500 });
    }
}
