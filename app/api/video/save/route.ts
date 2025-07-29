import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

async function ensureDir(dirPath: string) {
    try {
        await fs.promises.access(dirPath);
    } catch (e) {
        await fs.promises.mkdir(dirPath, { recursive: true });
    }
}


export async function POST(request: NextRequest) {
    try {
        const { renderId, projectName } = await request.json();

        if (!renderId || !projectName) {
            return NextResponse.json({ message: 'Render ID and Project Name are required' }, { status: 400 });
        }

        const tempDir = path.join(process.cwd(), '.tmp');
        const rendersDir = path.join(process.cwd(), 'public', 'renders');
        await ensureDir(rendersDir);

        const tempFilePath = path.join(tempDir, `${renderId}.mp4`);

        // New naming logic: project_MMDD_v001.mp4
        const today = new Date();
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const day = today.getDate().toString().padStart(2, '0');
        const dateString = `${month}${day}`;
        
        const baseName = `${projectName}_${dateString}`;
        const ext = '.mp4';
        
        let finalName = '';
        let finalUrl = '';
        let counter = 1;
        
        while (true) {
            const version = `_v${counter.toString().padStart(3, '0')}`;
            const currentName = `${baseName}${version}${ext}`;
            const filePath = path.join(rendersDir, currentName);
            
            try {
                await fs.promises.access(filePath);
                counter++;
            } catch (e) {
                // File doesn't exist, this is our name
                finalName = currentName;
                finalUrl = `/renders/${finalName}`;
                break;
            }
        }
        
        const finalFilePath = path.join(rendersDir, finalName);

        await fs.promises.rename(tempFilePath, finalFilePath);

        return NextResponse.json({ message: 'File saved successfully', url: finalUrl, finalName: finalName });

    } catch (error) {
        console.error('Error saving file:', error);
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return NextResponse.json({ message: 'Rendered file not found. It might have expired or been deleted.' }, { status: 404 });
        }
        return NextResponse.json({ message: 'Error saving file', error: (error as Error).message }, { status: 500 });
    }
} 