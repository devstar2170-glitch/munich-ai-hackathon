import { NextResponse } from 'next/server';
import { getEmployeeByToken } from '@/lib/storage';
import { processSupplement } from '@/lib/onboardingAgent';

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const employee = await getEmployeeByToken(token);

    if (!employee) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await processSupplement(employee.id, buffer, file.type, file.name);

    return NextResponse.json({ status: 'success', data: result });
  } catch (error) {
    console.error('Error processing supplement upload:', error);
    return NextResponse.json({ error: 'Failed to process upload' }, { status: 500 });
  }
}
