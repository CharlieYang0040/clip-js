import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest, { params }: { params: { filename: string } }) {
    const { filename } = params;
    if (!filename) {
        return new NextResponse('Filename is required', { status: 400 });
    }

    const tempDir = path.join(process.cwd(), '.tmp');
    const filePath = path.join(tempDir, filename);

    try {
        const stats = await fs.promises.stat(filePath);
        const fileSize = stats.size;
        const range = request.headers.get('range');

        const headers = new Headers();
        headers.set('Content-Type', 'video/mp4');
        headers.set('Accept-Ranges', 'bytes');

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;

            if (start >= fileSize || end >= fileSize) {
                headers.set('Content-Range', `bytes */${fileSize}`);
                return new NextResponse(null, { status: 416, headers });
            }

            const stream = fs.createReadStream(filePath, { start, end });
            headers.set('Content-Range', `bytes ${start}-${end}/${fileSize}`);
            headers.set('Content-Length', chunksize.toString());

            return new NextResponse(stream as any, { status: 206, headers });
        } else {
            headers.set('Content-Length', fileSize.toString());
            const stream = fs.createReadStream(filePath);
            return new NextResponse(stream as any, { status: 200, headers });
        }

    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return new NextResponse('File not found.', { status: 404 });
        } else {
            console.error('File system error:', error);
            return new NextResponse('Internal server error.', { status: 500 });
        }
    }
}
