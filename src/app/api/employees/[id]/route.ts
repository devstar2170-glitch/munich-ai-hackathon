import { NextResponse } from 'next/server';
import { getAllEmployees, saveEmployee } from '@/lib/storage';

export async function POST(request: Request) {
  try {
    const updatedEmployee = await request.json();
    await saveEmployee(updatedEmployee);
    return NextResponse.json({ status: 'success', data: updatedEmployee });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 });
  }
}
