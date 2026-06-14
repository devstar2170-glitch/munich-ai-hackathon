import { NextResponse } from 'next/server';
import { analyzeRFQMulti } from '@/lib/gemini';
import { saveProject } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files.length) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }

    const fileData = await Promise.all(
      files.map(async (f) => ({
        buffer: Buffer.from(await f.arrayBuffer()),
        mimeType: f.type || 'application/pdf',
        name: f.name,
      }))
    );

    const analysis = await analyzeRFQMulti(fileData);

    const projectName = files.length === 1
      ? files[0].name
      : `${files[0].name} + ${files.length - 1} more`;

    const fileList = files.map(f => f.name).join(', ');

    const newProject = {
      id: uuidv4(),
      name: projectName,
      status: 'ANALYSIS' as const,
      rfqContent: '[Binary Document]',
      requirements: analysis.requirements,
      clarificationQuestion: analysis.ambiguity,
      matchCandidates: [],
      thoughtLog: [
        '> Ingestion complete.',
        `> Loaded ${files.length} document${files.length > 1 ? 's' : ''}: ${fileList}`,
        files.length > 1 ? '> Merging documents as single RFP...' : '> Analyzing document...',
        '> Analysis complete. Reviewing for ambiguities...',
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveProject(newProject);

    return NextResponse.json({ status: 'success', data: newProject });
  } catch (error) {
    console.error('Error processing RFQ:', error);
    return NextResponse.json({ error: 'Failed to process RFQ' }, { status: 500 });
  }
}
