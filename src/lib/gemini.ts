const AGENT_API = process.env.NEXT_PUBLIC_AGENT_API_URL || 'http://localhost:8000';
// 20-minute timeout per request — Gemini analysis + merge can be slow on large docs
const timeout = () => AbortSignal.timeout(20 * 60 * 1000);

export async function analyzeRFQ(fileBuffer: Buffer, mimeType: string, fileName = 'rfp.pdf') {
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
  formData.append('file', blob, fileName);

  const res = await fetch(`${AGENT_API}/api/analyze`, {
    method: 'POST',
    body: formData,
    signal: timeout(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Agent API error: ${res.status}`);
  }

  return res.json();
}

export async function analyzeRFQMulti(files: { buffer: Buffer; mimeType: string; name: string }[]) {
  const formData = new FormData();
  for (const f of files) {
    formData.append('files', new Blob([new Uint8Array(f.buffer)], { type: f.mimeType }), f.name);
  }

  const res = await fetch(`${AGENT_API}/api/analyze-multi`, {
    method: 'POST',
    body: formData,
    signal: timeout(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Agent API error: ${res.status}`);
  }

  return res.json();
}

export async function extractCV(fileBuffer: Buffer, mimeType: string, fileName = 'cv.pdf') {
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: mimeType });
  formData.append('file', blob, fileName);

  const res = await fetch(`${AGENT_API}/api/extract-cv`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Agent API error: ${res.status}`);
  }

  const data = await res.json();
  return data.data;
}

export async function getProfileGaps(employee: object) {
  const res = await fetch(`${AGENT_API}/api/profile-gaps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(employee),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Agent API error: ${res.status}`);
  }

  const data = await res.json();
  return data.gaps;
}

export async function matchEmployees(requirements: string[], employees: object[], humanAnswer?: string) {
  const res = await fetch(`${AGENT_API}/api/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requirements, employees, human_answer: humanAnswer }),
    signal: timeout(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Agent API error: ${res.status}`);
  }

  const data = await res.json();
  return data.matches;
}
