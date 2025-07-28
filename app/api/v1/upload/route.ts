import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

// Helper function to ensure directory exists
async function ensureDir(dirPath: string) {
    try {
        await fs.access(dirPath);
    } catch (e) {
        await fs.mkdir(dirPath, { recursive: true });
    }
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ message: 'No file provided.' }, { status: 400 });
        }

        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        await ensureDir(uploadDir);

        const buffer = Buffer.from(await file.arrayBuffer());
        const uniqueFilename = `${Date.now()}-${file.name}`;
        const filePath = path.join(uploadDir, uniqueFilename);

        await fs.writeFile(filePath, buffer);

        const relativePath = path.join('/uploads', uniqueFilename).replace(/\\/g, '/');

        return NextResponse.json({ message: 'File uploaded successfully', filePath: relativePath });

    } catch (error) {
        console.error('Error uploading file:', error);
        return NextResponse.json({ message: 'Error uploading file', error: (error as Error).message }, { status: 500 });
    }
}
