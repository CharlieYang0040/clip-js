import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function GET(request: NextRequest, { params }: { params: { filename: string } }) {
    const { filename } = params;
    if (!filename) {
        return new NextResponse('Filename is required', { status: 400 });
    }

    const tempDir = path.join(process.cwd(), '.tmp');
    const filePath = path.join(tempDir, filename);

    try {
        const stats = await fs.promises.stat(filePath);
        const stream = fs.createReadStream(filePath);
        
        return new NextResponse(stream as any, {
            status: 200,
            headers: {
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Type': 'video/mp4',
                'Content-Length': stats.size.toString(),
            },
        });
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return new NextResponse('File not found.', { status: 404 });
        } else {
            console.error('File system error:', error);
            return new NextResponse('Internal server error.', { status: 500 });
        }
    }
}
