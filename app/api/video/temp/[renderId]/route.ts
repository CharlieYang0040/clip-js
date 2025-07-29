import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function DELETE(request: NextRequest, { params }: { params: { renderId: string } }) {
    const { renderId } = params;
    if (!renderId) {
        return new NextResponse('Render ID is required', { status: 400 });
    }

    const tempDir = path.join(process.cwd(), '.tmp');

    try {
        const manifestPath = path.join(tempDir, `${renderId}.json`);
        const manifestData = await fs.promises.readFile(manifestPath, 'utf-8');
        const { usedMediaUrls } = JSON.parse(manifestData);

        if (Array.isArray(usedMediaUrls)) {
            for (const url of usedMediaUrls) {
                const sourcePath = path.join(process.cwd(), 'public', url);
                await fs.promises.unlink(sourcePath).catch(err => console.error(`Failed to delete source file ${url}:`, err));
            }
        }
    } catch (err) {
        console.error('Could not read or process manifest file for temp cleanup:', err);
    }

    // Delete all temp files for this renderId
    const tempFiles = await fs.promises.readdir(tempDir);
    for (const file of tempFiles) {
        if (file.startsWith(renderId)) {
            await fs.promises.unlink(path.join(tempDir, file)).catch(() => {});
        }
    }

    return NextResponse.json({ message: 'Temporary files cleaned up' });
} 