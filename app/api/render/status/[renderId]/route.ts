import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const timeToSeconds = (timeStr: string): number => {
    const [hours, minutes, seconds] = timeStr.split(':').map(parseFloat);
    return hours * 3600 + minutes * 60 + seconds;
};

export async function GET(request: NextRequest, { params }: { params: { renderId: string } }) {
    const { renderId } = params;
    if (!renderId) {
        return new NextResponse('Render ID is required', { status: 400 });
    }

    const tempDir = path.join(process.cwd(), '.tmp');
    const doneFilePath = path.join(tempDir, `${renderId}.done`);
    const errorFilePath = path.join(tempDir, `${renderId}.error`);
    const logFilePath = path.join(tempDir, `${renderId}.log`);

    try {
        await fs.promises.access(doneFilePath);
        return NextResponse.json({ status: 'complete', url: `/api/download/${renderId}.mp4` });
    } catch (e) {
        // .done 파일이 없음
    }

    try {
        await fs.promises.access(errorFilePath);
        const errorMessage = await fs.promises.readFile(errorFilePath, 'utf-8');
        return NextResponse.json({ status: 'error', message: errorMessage });
    } catch (e) {
        // .error 파일이 없음
    }

    let logs = '';
    let progress = 0;
    try {
        logs = await fs.promises.readFile(logFilePath, 'utf-8');
        
        const durationMatch = logs.match(/Duration: (\d{2}:\d{2}:\d{2}\.\d{2})/);
        if (durationMatch) {
            const totalDuration = timeToSeconds(durationMatch[1]);
            const timeMatches = Array.from(logs.matchAll(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/g));

            if (timeMatches.length > 0) {
                const lastMatch = timeMatches[timeMatches.length - 1];
                const lastTime = lastMatch[1];
                const currentTime = timeToSeconds(lastTime);
                if (totalDuration > 0) {
                    progress = Math.min(100, Math.floor((currentTime / totalDuration) * 100));
                }
            }
        }
    } catch (e) {
        // .log 파일이 아직 없을 수 있음
    }

    return NextResponse.json({ status: 'processing', logs, progress });
} 