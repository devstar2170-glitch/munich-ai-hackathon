import { NextResponse } from 'next/server';
import { matchEmployees } from '@/lib/gemini';
import { getProjectById, getAllEmployees, saveProject, Employee } from '@/lib/storage';

function selectProjectManager(employees: Employee[]): Employee | undefined {
  // First: find an available employee whose role contains "Project Manager"
  const pmCandidates = employees.filter(
    e => e.role.toLowerCase().includes('project manager') && e.availabilityStatus === 'Available'
  );
  if (pmCandidates.length > 0) {
    // Pick the one with the most experience
    return pmCandidates.sort((a, b) => b.yearsOfExperience - a.yearsOfExperience)[0];
  }

  // Fallback: highest seniority available employee
  const levelOrder: Record<string, number> = { 'Principal': 3, 'Senior': 2, 'Mid': 1 };
  const available = employees.filter(e => e.availabilityStatus === 'Available');
  return available.sort((a, b) => (levelOrder[b.level] ?? 0) - (levelOrder[a.level] ?? 0))[0];
}

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

    // Auto-select a Project Manager
    const pm = selectProjectManager(employees);
    const selectedPM = pm
      ? { id: pm.id, name: `${pm.firstName} ${pm.lastName}`, email: pm.email, role: pm.role }
      : undefined;

    // Update project state
    const updatedProject = {
      ...project,
      status: 'PLANNING' as const,
      humanAnswer,
      matchCandidates: matches,
      selectedPM,
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
