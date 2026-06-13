import { NextResponse } from 'next/server';
import { getAllEmployees } from '@/lib/storage';

export async function GET() {
  try {
    const employees = await getAllEmployees();
    return NextResponse.json({ status: 'success', data: employees });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}
