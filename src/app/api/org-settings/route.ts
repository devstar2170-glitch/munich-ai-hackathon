import { NextResponse } from 'next/server';
import { getOrgSettings, saveOrgSettings, OrgSettings } from '@/lib/storage';

export async function GET() {
  try {
    const settings = await getOrgSettings();
    return NextResponse.json({ status: 'success', data: settings });
  } catch (error) {
    console.error('Error loading org settings:', error);
    return NextResponse.json({ error: 'Failed to load org settings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as OrgSettings;
    const saved = await saveOrgSettings(body);
    return NextResponse.json({ status: 'success', data: saved });
  } catch (error) {
    console.error('Error saving org settings:', error);
    return NextResponse.json({ error: 'Failed to save org settings' }, { status: 500 });
  }
}
