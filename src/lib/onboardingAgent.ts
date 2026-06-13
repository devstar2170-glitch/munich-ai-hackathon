const ONBOARDING_AGENT_API = process.env.NEXT_PUBLIC_ONBOARDING_AGENT_API_URL || 'http://localhost:8001';

export async function sendMagicLink(email: string, name: string, link: string) {
  const res = await fetch(`${ONBOARDING_AGENT_API}/send-magic-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name, link }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Onboarding agent error: ${res.status}`);
  }

  return res.json();
}

export async function processSupplement(employeeId: string, fileBuffer: Buffer, mimeType: string, fileName: string) {
  const formData = new FormData();
  formData.append('employee_id', employeeId);
  const blob = new Blob([fileBuffer], { type: mimeType });
  formData.append('file', blob, fileName);

  const res = await fetch(`${ONBOARDING_AGENT_API}/process-supplement`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Onboarding agent error: ${res.status}`);
  }

  return res.json();
}
