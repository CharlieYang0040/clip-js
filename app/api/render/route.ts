import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { ProjectState } from '@/app/types';
import { extractConfigs } from '@/app/utils/extractConfigs';

export async function POST(request: NextRequest) {
    try {
        const state: ProjectState = await request.json();
        console.log('Received project state for rendering');

        const tempDir = path.join(process.cwd(), '.tmp');
        await ensureDir(tempDir); // Ensure the .tmp directory exists
        const outputFileName = `${state.projectName.replace(/\s+/g, '_') || 'output'}_${Date.now()}.mp4`;
        const outputPath = path.join(tempDir, outputFileName);

        const params = extractConfigs(state.exportSettings);
        const filters: string[] = [];
        const inputs: any[] = [];
        const audioStreams: string[] = [];
        let complexFilter = '';

        filters.push(`color=c=black:size=1920x1080:d=${state.duration.toFixed(3)}[base]`);

        const allElements = [
            ...state.mediaFiles.map(item => ({ ...item, elementType: item.type })),
            ...state.textElements.map(item => ({ ...item, elementType: 'text' as const }))
        ].map(item => {
            const trackIndex = state.tracks.findIndex(t => t.id === item.trackId);
            const totalTracks = state.tracks.length;
            const baseZIndex = (totalTracks - trackIndex - 1) * 10;
            const finalZIndex = baseZIndex + (item.layerOrder || 0);
            return { ...item, zIndex: finalZIndex };
        }).sort((a, b) => a.zIndex - b.zIndex);

        let inputIndex = 0;
        for (const element of allElements) {
            if (element.elementType === 'video' || element.elementType === 'image' || element.elementType === 'audio') {
                const mediaPath = path.join(process.cwd(), 'public', element.url!);
                const currentInput = inputIndex++;

                if (element.type === 'image') {
                    inputs.push('-loop', '1', '-t', (element.positionEnd - element.positionStart).toFixed(3), '-i', mediaPath);
                } else {
                    inputs.push('-i', mediaPath);
                }

                const { startTime, positionStart, positionEnd } = element;
                const duration = positionEnd - positionStart;
                const visualLabel = `visual${currentInput}`;
                const audioLabel = `audio${currentInput}`;

                if (element.type === 'video' || element.type === 'image') {
                    let videoFilter = `[${currentInput}:v]`;
                    if(element.type === 'video') {
                         videoFilter += `trim=start=${startTime.toFixed(3)}:duration=${duration.toFixed(3)},`;
                    }
                    videoFilter += `scale=${element.width || 1920}:${element.height || 1080},setpts=PTS-STARTPTS+${positionStart.toFixed(3)}/TB`;
                    const alpha = Math.min(Math.max((element.opacity || 100) / 100, 0), 1);
                    videoFilter += `,format=yuva420p,colorchannelmixer=aa=${alpha}[${visualLabel}]`;
                    filters.push(videoFilter);
                }

                if (element.type === 'audio' && element.volume > 0) {
                    const delayMs = Math.round(positionStart * 1000);
                    const volume = element.volume !== undefined ? element.volume / 100 : 1;
                    filters.push(
                        `[${currentInput}:a]atrim=start=${startTime.toFixed(3)}:duration=${duration.toFixed(3)},asetpts=PTS-STARTPTS,adelay=${delayMs}|${delayMs},volume=${volume}[${audioLabel}]`
                    );
                    audioStreams.push(`[${audioLabel}]`);
                }
            }
        }

        let lastLabel = 'base';
        let overlayIndex = 0;
        allElements.forEach((element) => {
            if(element.elementType === 'video' || element.elementType === 'image') {
                const nextLabel = `tmp${overlayIndex}`;
                const visualLabel = `visual${overlayIndex}`;
                filters.push(`[${lastLabel}][${visualLabel}]overlay=${element.x}:${element.y}:enable='between(t,${element.positionStart},${element.positionEnd})'[${nextLabel}]`);
                lastLabel = nextLabel;
                overlayIndex++;
            }
        });

        state.textElements.forEach((text, index) => {
            const nextLabel = `tmp_text_${index}`;
            const escapedText = text.content.replace(/:/g, '\\:').replace(/'/g, `'\''`);
            const alpha = Math.min(Math.max((text.opacity ?? 100) / 100, 0), 1);
            const color = (text.color?.includes('@') ? text.color : `${text.color || 'white'}@${alpha}`).replace(/\s/g, '');
            const rawPath = path.join(process.cwd(), 'public', 'fonts', `${text.fontFamily}.ttf`);
            const fontPath = '\'' + rawPath.replace(/\\/g, '/').replace(/:/g, '\\:') + '\'';
            filters.push(
                `[${lastLabel}]drawtext=fontfile=${fontPath}:text='${escapedText}':x=${text.x}:y=${text.y}:fontsize=${text.fontSize || 24}:fontcolor=${color}:enable='between(t,${text.positionStart},${text.positionEnd})'[${nextLabel}]`
            );
            lastLabel = nextLabel;
        });

        complexFilter = filters.join('; ');
        if (audioStreams.length > 0) {
            complexFilter += `; ${audioStreams.join('')}amix=inputs=${audioStreams.length}:normalize=0[outa]`;
        }

        const ffmpegArgs = [
            ...inputs.flat(),
            '-filter_complex', complexFilter,
            '-map', `[${lastLabel}]`,
        ];

        if (audioStreams.length > 0) {
            ffmpegArgs.push('-map', '[outa]');
        }

        const nvencPresetMap = {
            fastest: 'p1',
            fast: 'p2',
            balanced: 'p4',
            slow: 'p6',
            slowest: 'p7'
        };

        ffmpegArgs.push(
            '-c:v', 'h264_nvenc',
            '-preset', nvencPresetMap[params.preset as keyof typeof nvencPresetMap] || 'p4',
            '-cq', (params.crf || 23).toString(),
            '-c:a', 'aac',
            '-b:a', params.audioBitrate || '192k',
            '-t', state.duration.toFixed(3),
            outputPath
        );

        console.log('Executing FFmpeg with args:\n', ffmpegArgs.join(' '));

        const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
        const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);

        ffmpegProcess.on('close', (code) => {
            console.log(`FFmpeg process exited with code ${code}`);
            if (code === 0) {
                console.log(`Render finished: ${outputPath}`);
                setTimeout(() => {
                    fs.unlink(outputPath).catch(err => console.error(`Failed to delete temp file: ${err.message}`));
                }, 600000); // 10 minutes
            } else {
                console.error('FFmpeg process failed.');
            }
        });

        return NextResponse.json({ 
            message: 'Render process started.',
            previewUrl: `/api/download/${outputFileName}`,
            downloadUrl: `/api/download/${outputFileName}`
        }, { status: 202 });

    } catch (error) {
        console.error('Error processing render request:', error);
        return NextResponse.json({ message: 'Error processing request', error: (error as Error).message }, { status: 500 });
    }
}