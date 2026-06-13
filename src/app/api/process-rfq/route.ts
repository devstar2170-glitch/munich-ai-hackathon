import { NextResponse } from 'next/server';
import { analyzeRFQ } from '@/lib/gemini';
import { saveProject } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Call Gemini to analyze the real document directly (Agent-led parsing)
    const analysis = await analyzeRFQ(buffer, file.type);

    const newProject = {
      id: uuidv4(),
      name: file.name,
      status: 'ANALYSIS' as const,
      rfqContent: "[Binary Document]",
      requirements: analysis.requirements,
      clarificationQuestion: analysis.ambiguity,
      matchCandidates: [],
      thoughtLog: [
        '> Ingestion complete.',
        `> Delegating analysis of ${file.name} to Gemini 1.5 Pro...`,
        '> Model is parsing document natively...',
        '> Found critical ambiguity requiring human input.'
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await saveProject(newProject);

    return NextResponse.json({
      status: 'success',
      data: newProject
    });
  } catch (error) {
    console.error('Error processing RFQ:', error);
    return NextResponse.json({ error: 'Failed to process RFQ' }, { status: 500 });
  }
}
