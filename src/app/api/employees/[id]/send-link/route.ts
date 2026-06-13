import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getAllEmployees, saveEmployee } from '@/lib/storage';
import { sendMagicLink } from '@/lib/onboardingAgent';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const employees = await getAllEmployees();
    const employee = employees.find(e => e.id === id);

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    if (!employee.email) {
      return NextResponse.json({ error: 'Employee has no email address on file' }, { status: 400 });
    }

    if (!employee.profileToken) {
      employee.profileToken = uuidv4();
      await saveEmployee(employee);
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL || new URL(request.url).origin;
    const link = `${baseUrl}/profile/${employee.profileToken}`;

    // Email delivery is best-effort: the link is always generated and returned so
    // HR can copy/share it manually even when no mail provider is configured.
    let emailSent = false;
    let emailError: string | undefined;
    try {
      await sendMagicLink(employee.email, employee.firstName, link);
      emailSent = true;
    } catch (err) {
      emailError = err instanceof Error ? err.message : 'Email delivery failed';
      console.warn('Magic-link email not sent (link still available):', emailError);
    }

    return NextResponse.json({ status: 'success', data: { link, emailSent, emailError } });
  } catch (error) {
    console.error('Error sending profile link:', error);
    return NextResponse.json({ error: 'Failed to send profile link' }, { status: 500 });
  }
}
