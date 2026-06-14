import { NextResponse } from 'next/server';
import { getProjectById, getAllEmployees, saveProject } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';

function rfc2047Encode(str: string): string {
    return `=?UTF-8?B?${Buffer.from(str, 'utf-8').toString('base64')}?=`;
}

async function sendNtfy(topic: string, title: string, message: string, options?: { priority?: number; click?: string }) {
    const headers: Record<string, string> = {
        'Title': rfc2047Encode(title),
        'Priority': String(options?.priority ?? 3),
    };
    if (options?.click) {
        headers['Click'] = options.click;
        headers['Actions'] = `view, Open Feedback, ${options.click}`;
    }
    const res = await fetch(`https://ntfy.sh/${topic}`, {
        method: 'POST',
        headers,
        body: message,
    });
    return res.ok;
}

function emailToTopic(email: string): string {
    // alice.smith@hackathon-munich.de → hackathon-munich-alice-smith
    const prefix = email.split('@')[0].replace(/\./g, '-');
    return `hackathon-munich-${prefix}`;
}

export async function POST(request: Request) {
    try {
        const { projectId } = await request.json();

        const project = await getProjectById(projectId);
        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL || 'http://localhost:3000';
        const allEmployees = await getAllEmployees();
        const notifications: { id: string; name: string; role: string; status: 'sent' | 'failed' }[] = [];

        const pm = project.selectedPM;
        const projectName = project.name || 'Untitled Project';

        // Generate feedback tokens for all candidates that don't have one yet
        const updatedCandidates = project.matchCandidates.map(c => {
            if (!c.feedbackToken) {
                return { ...c, feedbackToken: uuidv4() };
            }
            return c;
        });
        const updatedProject = { ...project, matchCandidates: updatedCandidates };
        await saveProject(updatedProject);

        // Build PM summary message
        const requirementsSummary = (project.requirements || [])
            .slice(0, 10)
            .map((r, i) => `${i + 1}. ${r}`)
            .join('\n');

        const teamSummary = (updatedCandidates || [])
            .map((c: any) => `• ${c.name} (${c.role}) — ${c.match}% match — Skills: ${(c.skills || []).join(', ')}`)
            .join('\n');

        const pmMessage = [
            `Project: ${projectName}`,
            '',
            '--- Key Requirements ---',
            requirementsSummary,
            project.requirements.length > 10 ? `... and ${project.requirements.length - 10} more` : '',
            '',
            '--- Matched Team ---',
            teamSummary,
            '',
            `Total team members: ${updatedCandidates.length}`,
        ].join('\n');

        // Send PM notification
        if (pm) {
            const pmTopic = emailToTopic(pm.email);
            const ok = await sendNtfy(
                pmTopic,
                `📋 You are PM for: ${projectName}`,
                pmMessage,
                { priority: 4 }
            );
            notifications.push({
                id: pm.id,
                name: pm.name,
                role: 'Project Manager',
                status: ok ? 'sent' : 'failed',
            });
        }

        // Send employee notifications with feedback link
        for (const candidate of updatedCandidates) {
            // Skip if this candidate is the PM
            if (pm && candidate.id === pm.id) continue;

            const employee = allEmployees.find(e => e.id === candidate.id);
            if (!employee) {
                notifications.push({
                    id: candidate.id,
                    name: candidate.name,
                    role: candidate.role,
                    status: 'failed',
                });
                continue;
            }

            const feedbackUrl = `${baseUrl}/feedback/${candidate.feedbackToken}`;
            const topic = emailToTopic(employee.email);
            const message = [
                `You have been selected to work on "${projectName}".`,
                '',
                `Your role: ${candidate.role}`,
                `Match score: ${candidate.match}%`,
                pm ? `Project Manager: ${pm.name} (${pm.email})` : '',
                '',
                'Please confirm your availability:',
                feedbackUrl,
            ].join('\n');

            const ok = await sendNtfy(
                topic,
                `🚀 New Project Assignment: ${projectName}`,
                message,
                { click: feedbackUrl }
            );

            notifications.push({
                id: candidate.id,
                name: candidate.name,
                role: candidate.role,
                status: ok ? 'sent' : 'failed',
            });
        }

        return NextResponse.json({
            status: 'success',
            data: { notifications, pm, project: updatedProject },
        });
    } catch (error) {
        console.error('Error in outreach:', error);
        return NextResponse.json({ error: 'Failed to send notifications' }, { status: 500 });
    }
}
