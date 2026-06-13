import { NextResponse } from 'next/server';
import { matchEmployees } from '@/lib/gemini';
import { getProjectById, getAllEmployees, saveProject } from '@/lib/storage';

export async function POST(request: Request) {
  try {
    const { projectId, humanAnswer } = await request.json();

    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const employees = await getAllEmployees();

    // Use Gemini to match employees based on requirements and the human's clarification
    const requirementsWithClarification = [
      ...project.requirements,
      `User clarification: ${humanAnswer}`
    ];

    const matches = await matchEmployees(requirementsWithClarification, employees);

    // Update project state
    const updatedProject = {
      ...project,
      status: 'PLANNING' as const,
      humanAnswer,
      matchCandidates: matches,
      thoughtLog: [
        ...project.thoughtLog,
        '> Human input received.',
        '> Re-evaluating skills matrix with clarification...',
        '> Running AI-powered matchmaking...',
        '> Found optimal team configurations.'
      ],
      updatedAt: new Date().toISOString()
    };

    await saveProject(updatedProject);

    return NextResponse.json({
      status: 'success',
      data: updatedProject
    });
  } catch (error) {
    console.error('Error in matchmaking:', error);
    return NextResponse.json({ error: 'Failed to perform matchmaking' }, { status: 500 });
  }
}
