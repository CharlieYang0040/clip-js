import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { NextRequest } from 'next/server';

const uploadsDir = path.join(process.cwd(), 'public/uploads');
const rendersDir = path.join(process.cwd(), 'public/renders');

async function clearDirectory(directory: string) {
    try {
        const files = await fs.readdir(directory);
        for (const file of files) {
            // .gitkeep 파일은 삭제하지 않도록 예외 처리
            if (file !== '.gitkeep') {
                await fs.unlink(path.join(directory, file));
            }
        }
    } catch (error: any) {
        // 디렉토리가 존재하지 않는 경우 오류를 무시
        if (error.code !== 'ENOENT') {
            console.error(`Error clearing directory ${directory}:`, error);
        }
    }
}

export async function POST(req: NextRequest) {
    const isLocal = req.headers.get('host')?.includes('localhost');
    if (!isLocal) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    try {
        await clearDirectory(uploadsDir);
        await clearDirectory(rendersDir);
        return NextResponse.json({ message: 'Cleanup successful' });
    } catch (error) {
        console.error('Cleanup failed:', error);
        return NextResponse.json({ message: 'Cleanup failed' }, { status: 500 });
    }
} 