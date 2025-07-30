import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function forceDeleteFile(filePath: string, maxRetries: number = 5): Promise<boolean> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await fs.promises.unlink(filePath);
            return true;
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                // 파일이 이미 삭제됨
                return true;
            }
            
            if (error.code === 'EBUSY' || error.code === 'EPERM') {
                console.log(`File ${filePath} is busy/locked, attempt ${attempt}/${maxRetries}`);
                
                // Windows에서 파일을 사용 중인 프로세스를 찾아서 종료 시도
                if (process.platform === 'win32' && filePath.endsWith('.mp4')) {
                    try {
                        const fileName = path.basename(filePath);
                        // handle.exe가 있다면 사용, 없다면 무시
                        await execAsync(`handle.exe "${fileName}" 2>nul || echo "handle.exe not found"`).catch(() => {});
                        
                        // FFmpeg 프로세스 종료 시도
                        await execAsync(`taskkill /F /IM ffmpeg.exe 2>nul || echo "No ffmpeg process"`).catch(() => {});
                    } catch (killError) {
                        console.log(`Failed to kill processes: ${killError}`);
                    }
                }
                
                // 대기 시간을 점진적으로 증가
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                continue;
            }
            
            console.log(`Failed to delete ${filePath} (attempt ${attempt}/${maxRetries}):`, error.message);
            if (attempt === maxRetries) {
                return false;
            }
        }
    }
    return false;
}

async function cancelRender(renderId: string, request: NextRequest) {
    const tempDir = path.join(process.cwd(), ".tmp");

    try {
        console.log(`Starting cancellation for render ID: ${renderId}`);

        // 1. FFmpeg 프로세스 강제 종료 시도
        try {
            if (process.platform === 'win32') {
                await execAsync(`taskkill /F /IM ffmpeg.exe 2>nul || echo "No ffmpeg process to kill"`);
            } else {
                await execAsync(`pkill -f ffmpeg || echo "No ffmpeg process to kill"`);
            }
            console.log("FFmpeg processes killed");
        } catch (killError) {
            console.log("Failed to kill FFmpeg processes:", killError);
        }

        // 2. manifest 파일에서 업로드된 미디어 파일들을 먼저 정리
        try {
            const manifestPath = path.join(tempDir, `${renderId}.json`);
            
            await fs.promises.access(manifestPath);
            const manifestData = await fs.promises.readFile(manifestPath, "utf-8");
            const { usedMediaUrls } = JSON.parse(manifestData);

            if (Array.isArray(usedMediaUrls)) {
                for (const url of usedMediaUrls) {
                    try {
                        const sourcePath = path.join(process.cwd(), "public", url);
                        await fs.promises.access(sourcePath);
                        const deleted = await forceDeleteFile(sourcePath);
                        if (deleted) {
                            console.log(`Deleted media file: ${url}`);
                        } else {
                            console.log(`Failed to delete media file: ${url}`);
                        }
                    } catch (fileErr) {
                        console.log(`Media file not found or already deleted: ${url}`);
                    }
                }
            }
        } catch (err) {
            console.log("Manifest cleanup skipped:", (err as Error).message);
        }

        // 3. 해당 renderId의 모든 임시 파일을 강제로 삭제
        const extensionsToDelete = ['.mp4', '.done', '.log', '.json', '.error'];
        const deletionResults: {
            success: string[];
            failed: string[];
        } = {
            success: [],
            failed: []
        };

        // 프로세스 종료 후 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 2000));

        for (const ext of extensionsToDelete) {
            const filePath = path.join(tempDir, `${renderId}${ext}`);
            try {
                await fs.promises.access(filePath);
                const deleted = await forceDeleteFile(filePath);
                if (deleted) {
                    deletionResults.success.push(`${renderId}${ext}`);
                    console.log(`Successfully deleted: ${renderId}${ext}`);
                } else {
                    deletionResults.failed.push(`${renderId}${ext}: Force deletion failed`);
                }
            } catch (accessErr) {
                // 파일이 없으면 성공으로 간주
                console.log(`File not found (already deleted): ${renderId}${ext}`);
            }
        }

        // 4. 추가로 패턴 매칭으로 놓친 파일들이 있는지 확인
        try {
            const tempFiles = await fs.promises.readdir(tempDir);
            const remainingFiles = tempFiles.filter(file => 
                file.startsWith(renderId) && !file.endsWith('.cancelled') && !deletionResults.success.includes(file)
            );

            for (const file of remainingFiles) {
                const filePath = path.join(tempDir, file);
                const deleted = await forceDeleteFile(filePath);
                if (deleted) {
                    deletionResults.success.push(file);
                    console.log(`Successfully deleted remaining file: ${file}`);
                } else {
                    deletionResults.failed.push(`${file}: Force deletion failed`);
                }
            }
        } catch (err) {
            console.log("Directory scan failed:", (err as Error).message);
        }

        // 5. 렌더링 취소 표시 파일 생성 (가장 마지막에)
        try {
            const cancelPath = path.join(tempDir, `${renderId}.cancelled`);
            await fs.promises.writeFile(cancelPath, `cancelled at ${new Date().toISOString()}\nDeleted: ${deletionResults.success.join(', ')}\nFailed: ${deletionResults.failed.join(', ')}`);
        } catch (err) {
            console.log("Failed to create cancel marker:", (err as Error).message);
        }

        // 6. 잠시 후에 cleanup API 호출
        setTimeout(async () => {
            try {
                await fetch(`${request.nextUrl.origin}/api/video/cleanup`, {
                    method: "POST",
                    headers: { host: request.headers.get("host") || "localhost" }
                });
            } catch (err) {
                console.log("General cleanup skipped:", (err as Error).message);
            }
        }, 3000);

        console.log(`Cancellation completed for ${renderId}. Success: ${deletionResults.success.length}, Failed: ${deletionResults.failed.length}`);

        return { 
            message: "Render cancelled and cleanup initiated",
            deleted: deletionResults.success,
            failed: deletionResults.failed,
            renderId
        };

    } catch (error) {
        console.error("Error cancelling render:", error);
        throw error;
    }
}

export async function DELETE(request: NextRequest, { params }: { params: { renderId: string } }) {
    const { renderId } = params;
    if (!renderId) {
        return new NextResponse("Render ID is required", { status: 400 });
    }

    try {
        const result = await cancelRender(renderId, request);
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json(
            { message: "Error cancelling render", error: (error as Error).message },
            { status: 500 }
        );
    }
}

// POST 메서드도 추가 (navigator.sendBeacon용)
export async function POST(request: NextRequest, { params }: { params: { renderId: string } }) {
    const { renderId } = params;
    if (!renderId) {
        return new NextResponse("Render ID is required", { status: 400 });
    }

    try {
        const result = await cancelRender(renderId, request);
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json(
            { message: "Error cancelling render", error: (error as Error).message },
            { status: 500 }
        );
    }
}
