import { NextResponse } from 'next/server';
import { getEmployeeByToken, saveEmployee } from '@/lib/storage';
import { getProfileGaps } from '@/lib/gemini';

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const employee = await getEmployeeByToken(token);

    if (!employee) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const gaps = await getProfileGaps(employee);
    const dismissed = employee.dismissedGapFields || [];
    const filteredGaps = gaps.filter((g: any) => !dismissed.includes(g.field));

    return NextResponse.json({ status: 'success', data: { employee, gaps: filteredGaps } });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const employee = await getEmployeeByToken(token);

    if (!employee) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const updates = await request.json();
    await saveEmployee({ ...employee, ...updates });

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
