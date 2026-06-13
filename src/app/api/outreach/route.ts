import { NextResponse } from 'next/server';
import { getProjectById, getAllEmployees } from '@/lib/storage';

function rfc2047Encode(str: string): string {
    return `=?UTF-8?B?${Buffer.from(str, 'utf-8').toString('base64')}?=`;
}

async function sendNtfy(topic: string, title: string, message: string, priority?: number) {
    const res = await fetch(`https://ntfy.sh/${topic}`, {
        method: 'POST',
        headers: {
            'Title': rfc2047Encode(title),
            'Priority': String(priority ?? 3),
        },
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

        const allEmployees = await getAllEmployees();
        const notifications: { id: string; name: string; role: string; status: 'sent' | 'failed' }[] = [];

        const pm = project.selectedPM;
        const projectName = project.name || 'Untitled Project';

        // Build PM summary message
        const requirementsSummary = (project.requirements || [])
            .slice(0, 10)
            .map((r, i) => `${i + 1}. ${r}`)
            .join('\n');

        const teamSummary = (project.matchCandidates || [])
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
            `Total team members: ${(project.matchCandidates || []).length}`,
        ].join('\n');

        // Send PM notification
        if (pm) {
            const pmTopic = emailToTopic(pm.email);
            const ok = await sendNtfy(
                pmTopic,
                `📋 You are PM for: ${projectName}`,
                pmMessage,
                4
            );
            notifications.push({
                id: pm.id,
                name: pm.name,
                role: 'Project Manager',
                status: ok ? 'sent' : 'failed',
            });
        }

        // Send employee notifications
        for (const candidate of project.matchCandidates || []) {
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

            const topic = emailToTopic(employee.email);
            const message = [
                `You have been selected to work on "${projectName}".`,
                '',
                `Your role: ${candidate.role}`,
                `Match score: ${candidate.match}%`,
                pm ? `Project Manager: ${pm.name} (${pm.email})` : '',
                '',
                'Please reach out to your PM for onboarding details.',
            ].join('\n');

            const ok = await sendNtfy(
                topic,
                `🚀 New Project Assignment: ${projectName}`,
                message
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
            data: { notifications, pm },
        });
    } catch (error) {
        console.error('Error in outreach:', error);
        return NextResponse.json({ error: 'Failed to send notifications' }, { status: 500 });
    }
}
