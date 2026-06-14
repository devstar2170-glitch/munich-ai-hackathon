import { NextResponse } from 'next/server';
import { saveProject } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';

const AGENT_API = process.env.NEXT_PUBLIC_AGENT_API_URL || 'http://localhost:8000';

export async function POST(request: Request) {
  try {
    const tender = await request.json();

    const res = await fetch(`${AGENT_API}/api/analyze-tender-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tender),
      signal: AbortSignal.timeout(20 * 60 * 1000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).detail || `Agent API error: ${res.status}`);
    }

    const analysis = await res.json();

    const displayName = tender.title_summary || tender.title || `TED Notice ${tender.notice_id}`;

    const newProject = {
      id: uuidv4(),
      name: displayName,
      status: 'ANALYSIS' as const,
      rfqContent: `[EU TED Notice ${tender.notice_id}]`,
      requirements: analysis.requirements || [],
      clarificationQuestion: analysis.ambiguity || null,
      matchCandidates: [],
      thoughtLog: [
        '> Ingestion complete.',
        `> Loaded EU TED tender notice: ${tender.notice_id}`,
        `> Client: ${tender.client_name || 'Unknown'} · Country: ${tender.country || 'Unknown'}`,
        '> Analyzing tender notice with RFP agent...',
        '> Analysis complete. Reviewing for ambiguities...',
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveProject(newProject);

    return NextResponse.json({ status: 'success', data: newProject });
  } catch (error) {
    console.error('Error processing tender:', error);
    return NextResponse.json({ error: 'Failed to process tender' }, { status: 500 });
  }
}
