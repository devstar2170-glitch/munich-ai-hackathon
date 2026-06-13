import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

export interface ProjectState {
  id: string;
  name: string;
  status: 'INGESTION' | 'ANALYSIS' | 'PLANNING' | 'OUTREACH';
  rfqContent?: string;
  requirements: string[];
  clarificationQuestion?: string;
  humanAnswer?: string;
  matchCandidates: any[];
  selectedPM?: { id: string; name: string; email: string; role: string };
  thoughtLog: string[];
  createdAt: string;
  updatedAt: string;
}

async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

const EMPLOYEES_FILE = path.join(DATA_DIR, 'employees.json');

export interface Employee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  location: string;
  role: string;
  level: string;
  yearsOfExperience: number;
  pastIndustryExperience: string[];
  futureIndustryWish: string[];
  skills: string[];
  certifications: string[];
  availabilityStatus: string;
  projectStart: string;
  projectEnd: string;
  cv: string;
  linkedin: string;
  dismissedGapFields?: string[];
  profileToken?: string;
  pendingUpdates?: Record<string, { value: any; confidence: number; reasoning: string; source: string }>;
}

export async function getEmployeeByToken(token: string): Promise<Employee | undefined> {
  const employees = await getAllEmployees();
  return employees.find(e => e.profileToken === token);
}

export async function getAllEmployees(): Promise<Employee[]> {
  await ensureDataDir();
  try {
    const data = await fs.readFile(EMPLOYEES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function saveEmployee(employee: Employee) {
  const employees = await getAllEmployees();
  const index = employees.findIndex(e => e.id === employee.id);
  
  if (index !== -1) {
    employees[index] = employee;
  } else {
    employees.push(employee);
  }
  
  await fs.writeFile(EMPLOYEES_FILE, JSON.stringify(employees, null, 2));
}

export async function getAllProjects(): Promise<ProjectState[]> {
  await ensureDataDir();
  try {
    const data = await fs.readFile(PROJECTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function getProjectById(id: string): Promise<ProjectState | undefined> {
  const projects = await getAllProjects();
  return projects.find(p => p.id === id);
}

export async function saveProject(project: ProjectState) {
  const projects = await getAllProjects();
  const index = projects.findIndex(p => p.id === project.id);
  
  if (index !== -1) {
    projects[index] = { ...project, updatedAt: new Date().toISOString() };
  } else {
    projects.push({ ...project, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  
  await fs.writeFile(PROJECTS_FILE, JSON.stringify(projects, null, 2));
}
