import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function DELETE(request: NextRequest, { params }: { params: { renderId: string } }) {
    const { renderId } = params;
    if (!renderId) {
        return new NextResponse('Render ID is required', { status: 400 });
    }

    const tempDir = path.join(process.cwd(), '.tmp');
    
    // URL 파라미터로 성공 마커 보존 여부를 확인
    const url = new URL(request.url);
    const preserveSuccess = url.searchParams.get('preserveSuccess') === 'true';

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

    // Delete temp files for this renderId
    const tempFiles = await fs.promises.readdir(tempDir);
    const deletedFiles: string[] = [];
    const preservedFiles: string[] = [];
    
    for (const file of tempFiles) {
        if (file.startsWith(renderId)) {
            // 저장 완료 후에는 .done 파일을 보존
            if (preserveSuccess && file.endsWith('.done')) {
                preservedFiles.push(file);
                console.log(`Preserved success marker: ${file}`);
                continue;
            }
            
            try {
                await fs.promises.unlink(path.join(tempDir, file));
                deletedFiles.push(file);
                console.log(`Deleted temp file: ${file}`);
            } catch (err) {
                console.error(`Failed to delete temp file ${file}:`, err);
            }
        }
    }

    return NextResponse.json({ 
        message: 'Temporary files cleaned up',
        deleted: deletedFiles,
        preserved: preservedFiles,
        preserveSuccess
    });
} 