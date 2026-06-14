import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const ORG_SETTINGS_FILE = path.join(DATA_DIR, 'org_settings.json');

export interface Qualification {
  fit_score: number;                  // 0-100
  recommendation: 'PURSUE' | 'REVIEW' | 'DECLINE';
  matched_competencies: string[];
  missing_capabilities: string[];
  disqualifiers: string[];
  rationale: string;
}

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
  qualification?: Qualification;
  thoughtLog: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Single-tenant organization profile. Drives two flows:
 *  - inbound: Gemini qualifies uploaded tenders against these aspects (go/no-go)
 *  - outbound: these aspects become search parameters for the tender crawl
 */
export interface OrgSettings {
  companyName: string;
  description: string;          // prose: what the company does — rich context for Gemini
  coreCompetencies: string[];   // services/skills we deliver
  industries: string[];         // sectors we serve
  geographies: string[];        // countries/regions we bid in
  certifications: string[];     // norms/certs we hold (ISO 9001, ...)
  languages: string[];
  minContractValue?: number;
  maxContractValue?: number;
  maxTeamSize?: number;
  keywords: string[];           // outbound search seeds
  cpvCodes: string[];           // EU public-tender (TED) classification codes
  exclusionCriteria: string[];  // hard no-bid rules
  updatedAt: string;
}

export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  companyName: '',
  description: '',
  coreCompetencies: [],
  industries: [],
  geographies: [],
  certifications: [],
  languages: [],
  minContractValue: undefined,
  maxContractValue: undefined,
  maxTeamSize: undefined,
  keywords: [],
  cpvCodes: [],
  exclusionCriteria: [],
  updatedAt: '',
};

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

export async function getOrgSettings(): Promise<OrgSettings> {
  await ensureDataDir();
  try {
    const data = await fs.readFile(ORG_SETTINGS_FILE, 'utf-8');
    // Merge over defaults so newly-added fields are always present.
    return { ...DEFAULT_ORG_SETTINGS, ...JSON.parse(data) };
  } catch {
    return { ...DEFAULT_ORG_SETTINGS };
  }
}

export async function saveOrgSettings(settings: OrgSettings): Promise<OrgSettings> {
  await ensureDataDir();
  const merged: OrgSettings = {
    ...DEFAULT_ORG_SETTINGS,
    ...settings,
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(ORG_SETTINGS_FILE, JSON.stringify(merged, null, 2));
  return merged;
}
