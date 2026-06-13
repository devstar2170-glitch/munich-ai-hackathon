import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { extractCV } from '@/lib/gemini';
import { getAllEmployees } from '@/lib/storage';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const extracted = await extractCV(buffer, file.type, file.name);

    const cvDir = path.join(process.cwd(), 'public', 'cvs');
    await fs.mkdir(cvDir, { recursive: true });
    const ext = path.extname(file.name) || '.pdf';
    const cvFileName = `${uuidv4()}${ext}`;
    await fs.writeFile(path.join(cvDir, cvFileName), buffer);
    const cvUrl = `/cvs/${cvFileName}`;

    const employees = await getAllEmployees();
    const matches = employees.filter(e =>
      e.firstName.trim().toLowerCase() === (extracted.firstName || '').trim().toLowerCase() &&
      e.lastName.trim().toLowerCase() === (extracted.lastName || '').trim().toLowerCase()
    );

    return NextResponse.json({
      status: 'success',
      data: { extracted, cvUrl, matches }
    });
  } catch (error) {
    console.error('Error extracting CV:', error);
    return NextResponse.json({ error: 'Failed to extract CV' }, { status: 500 });
  }
}
