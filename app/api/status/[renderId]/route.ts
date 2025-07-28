import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest, { params }: { params: { renderId: string } }) {
    const { renderId } = params;
    const tempDir = path.join(process.cwd(), '.tmp');
    const logPath = path.join(tempDir, `${renderId}.log`);
    const videoPath = path.join(tempDir, `${renderId}.mp4`);
    const errorPath = path.join(tempDir, `${renderId}.error`);

    try {
        const logData = await fs.readFile(logPath, 'utf-8');
        
        try {
            await fs.access(errorPath);
            return NextResponse.json({ status: 'failed', log: logData });
        } catch (e) {
            // No error file, check for video
        }

        try {
            await fs.access(videoPath);
            return NextResponse.json({ 
                status: 'complete', 
                log: logData, 
                url: `/api/download/${renderId}.mp4` 
            });
        } catch (e) {
            return NextResponse.json({ status: 'processing', log: logData });
        }

    } catch (error) {
        // Log file might not exist yet
        return NextResponse.json({ status: 'starting' });
    }
}
