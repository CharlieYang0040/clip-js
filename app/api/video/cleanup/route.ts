import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { NextRequest } from 'next/server';

const uploadsDir = path.join(process.cwd(), 'public/uploads');
const rendersDir = path.join(process.cwd(), 'public/renders');

async function deleteFileWithRetry(filePath: string, maxRetries: number = 3): Promise<boolean> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await fs.unlink(filePath);
            return true;
        } catch (error: any) {
            if (error.code === 'EBUSY' && attempt < maxRetries) {
                // 파일이 사용 중이면 잠시 대기 후 재시도
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                continue;
            } else if (error.code === 'ENOENT') {
                // 파일이 이미 삭제됨
                return true;
            } else {
                console.log(`Failed to delete ${filePath} (attempt ${attempt}/${maxRetries}):`, error.message);
                if (attempt === maxRetries) {
                    return false;
                }
            }
        }
    }
    return false;
}

async function clearDirectory(directory: string) {
    try {
        const files = await fs.readdir(directory);
        const results = {
            success: 0,
            failed: 0,
            skipped: 0
        };

        for (const file of files) {
            // .gitkeep 파일은 삭제하지 않도록 예외 처리
            if (file !== '.gitkeep') {
                const filePath = path.join(directory, file);
                const deleted = await deleteFileWithRetry(filePath);
                if (deleted) {
                    results.success++;
                } else {
                    results.failed++;
                }
            } else {
                results.skipped++;
            }
        }

        console.log(`Directory ${directory} cleanup: ${results.success} deleted, ${results.failed} failed, ${results.skipped} skipped`);
        return results;

    } catch (error: any) {
        // 디렉토리가 존재하지 않는 경우 오류를 무시
        if (error.code !== 'ENOENT') {
            console.error(`Error clearing directory ${directory}:`, error);
            throw error;
        }
        return { success: 0, failed: 0, skipped: 0 };
    }
}

export async function POST(req: NextRequest) {
    const isLocal = req.headers.get('host')?.includes('localhost');
    if (!isLocal) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    try {
        const uploadsResult = await clearDirectory(uploadsDir);
        const rendersResult = await clearDirectory(rendersDir);

        const totalSuccess = uploadsResult.success + rendersResult.success;
        const totalFailed = uploadsResult.failed + rendersResult.failed;

        if (totalFailed > 0) {
            return NextResponse.json({ 
                message: `Cleanup partially successful: ${totalSuccess} files deleted, ${totalFailed} files failed`,
                details: { uploads: uploadsResult, renders: rendersResult }
            }, { status: 207 }); // 207 Multi-Status
        }

        return NextResponse.json({ 
            message: `Cleanup successful: ${totalSuccess} files deleted`,
            details: { uploads: uploadsResult, renders: rendersResult }
        });
    } catch (error) {
        console.error('Cleanup failed:', error);
        return NextResponse.json({ message: 'Cleanup failed', error: (error as Error).message }, { status: 500 });
    }
} 