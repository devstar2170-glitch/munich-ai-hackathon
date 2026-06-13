import { NextResponse } from 'next/server';
import { getAllEmployees } from '@/lib/storage';
import { getProfileGaps } from '@/lib/gemini';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const employees = await getAllEmployees();
    const employee = employees.find(e => e.id === id);

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const gaps = await getProfileGaps(employee);
    const dismissed = employee.dismissedGapFields || [];
    const filtered = gaps.filter((g: any) => !dismissed.includes(g.field));

    return NextResponse.json({ status: 'success', data: filtered });
  } catch (error) {
    console.error('Error fetching profile gaps:', error);
    return NextResponse.json({ error: 'Failed to fetch profile gaps' }, { status: 500 });
  }
}
