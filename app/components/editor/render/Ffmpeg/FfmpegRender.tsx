'use client'
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { useEffect, useRef, useState } from "react";
import { getFile, useAppSelector } from "@/app/store";
import { Heart } from "lucide-react";
import Image from "next/image";
import { extractConfigs } from "@/app/utils/extractConfigs";
import { MediaFile, TextElement, mimeToExt } from "@/app/types";
import { toast } from "react-hot-toast";
import FfmpegProgressBar from "./ProgressBar";

interface FileUploaderProps {
    loadFunction: () => Promise<void>;
    loadFfmpeg: boolean;
    ffmpeg: FFmpeg;
}

export default function FfmpegRender({ loadFunction, loadFfmpeg, ffmpeg }: FileUploaderProps) {
    const projectState = useAppSelector(state => state.projectState);
    const { mediaFiles, projectName, exportSettings, duration, textElements, tracks } = projectState;
    const totalDuration = duration;
    const videoRef = useRef<HTMLVideoElement>(null);
    const [loaded, setLoaded] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isRendering, setIsRendering] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [showLogs, setShowLogs] = useState(false);

    useEffect(() => {
        if (loaded && videoRef.current && previewUrl) {
            videoRef.current.src = previewUrl;
        }
    }, [loaded, previewUrl]);

    const handleCloseModal = async () => {
        if (isRendering) {
            setIsCancelling(true);
            try {
                await ffmpeg.terminate();
                await loadFunction(); 
                toast.success('Rendering cancelled.');
            } catch (e) {
                console.error("Error during cancellation:", e);
                toast.error('Could not cancel rendering properly.');
            } finally {
                setIsCancelling(false);
            }
        }
        setShowModal(false);
        setIsRendering(false);
        setLogs([]);
        setShowLogs(false);
    };

    const render = async () => {
        if (mediaFiles.length === 0 && textElements.length === 0) {
            console.log('No media files to render');
            return;
        }
        setShowModal(true);
        setIsRendering(true);
        setLogs([]);

        const renderFunction = async (state: typeof projectState) => {
            const params = extractConfigs(state.exportSettings);

            try {
                const filters = [];
                const overlays = [];
                const inputs = [];
                const audioDelays = [];

                filters.push(`color=c=black:size=1920x1080:d=${state.duration.toFixed(3)}[base]`);

                const allElements = [
                    ...state.mediaFiles.map(item => ({ ...item, elementType: item.type })),
                    ...state.textElements.map(item => ({ ...item, elementType: 'text' as const }))
                ];

                const sortedElements = allElements.map(item => {
                    const trackIndex = state.tracks.findIndex(t => t.id === item.trackId);
                    const totalTracks = state.tracks.length;
                    const baseZIndex = (totalTracks - trackIndex - 1) * 10;
                    const finalZIndex = baseZIndex + (item.layerOrder || 0);
                    return { ...item, zIndex: finalZIndex };
                }).sort((a, b) => a.zIndex - b.zIndex);

                for (let i = 0; i < sortedElements.length; i++) {
                    const element = sortedElements[i];

                    if (element.elementType === 'video' || element.elementType === 'image' || element.elementType === 'audio') {
                        const { startTime, positionStart, positionEnd } = element;
                        const duration = positionEnd - positionStart;

                        const fileData = await getFile(element.url!);
                        const buffer = await fileData.arrayBuffer();
                        const ext = mimeToExt[fileData.type as keyof typeof mimeToExt] || fileData.type.split('/')[1];
                        await ffmpeg.writeFile(`input${i}.${ext}`, new Uint8Array(buffer));

                        if (element.type === 'image') {
                            inputs.push('-loop', '1', '-t', duration.toFixed(3), '-i', `input${i}.${ext}`);
                        } else {
                            inputs.push('-i', `input${i}.${ext}`);
                        }

                        const visualLabel = `visual${i}`;
                        const audioLabel = `audio${i}`;

                        const width = element.width || 1920;
                        const height = element.height || 1080;

                        if (element.type === 'video') {
                            filters.push(
                                `[${i}:v]trim=start=${startTime.toFixed(3)}:duration=${duration.toFixed(3)},scale=${width}:${height},setpts=PTS-STARTPTS+${positionStart.toFixed(3)}/TB[${visualLabel}]`
                            );
                        }
                        if (element.type === 'image') {
                            filters.push(
                                `[${i}:v]scale=${width}:${height},setpts=PTS+${positionStart.toFixed(3)}/TB[${visualLabel}]`
                            );
                        }

                        if (element.type === 'video' || element.type === 'image') {
                            const alpha = Math.min(Math.max((element.opacity || 100) / 100, 0), 1);
                            filters.push(
                                `[${visualLabel}]format=yuva420p,colorchannelmixer=aa=${alpha}[${visualLabel}]`
                            );
                            overlays.push({
                                label: visualLabel,
                                x: element.x,
                                y: element.y,
                                start: positionStart.toFixed(3),
                                end: positionEnd.toFixed(3),
                            });
                        }

                        if (element.type === 'audio') {
                            const delayMs = Math.round(positionStart * 1000);
                            const volume = element.volume !== undefined ? element.volume / 100 : 1;
                            filters.push(
                                `[${i}:a]atrim=start=${startTime.toFixed(3)}:duration=${duration.toFixed(3)},asetpts=PTS-STARTPTS,adelay=${delayMs}|${delayMs},volume=${volume}[${audioLabel}]`
                            );
                            audioDelays.push(`[${audioLabel}]`);
                        }
                    }
                }

                let lastLabel = 'base';
                if (overlays.length > 0) {
                    for (let i = 0; i < overlays.length; i++) {
                        const { label, start, end, x, y } = overlays[i];
                        const nextLabel = `tmp${i}`;
                        filters.push(
                            `[${lastLabel}][${label}]overlay=${x}:${y}:enable='between(t\,${start}\,${end})'[${nextLabel}]`
                        );
                        lastLabel = nextLabel;
                    }
                }

                const textElementsToRender = sortedElements.filter(el => el.elementType === 'text');
                if (textElementsToRender.length > 0) {
                     let fonts = ['Arial', 'Inter', 'Lato'];
                     for (let i = 0; i < fonts.length; i++) {
                         const font = fonts[i];
                         const res = await fetch(`/fonts/${font}.ttf`);
                         const fontBuf = await res.arrayBuffer();
                         await ffmpeg.writeFile(`font${font}.ttf`, new Uint8Array(fontBuf));
                     }
                    for (let i = 0; i < textElementsToRender.length; i++) {
                        const text = textElementsToRender[i] as TextElement;
                        const label = `text${i}`;
                        const escapedText = text.content.replace(/:/g, '\:').replace(/'/g, "\\'");
                        const alpha = Math.min(Math.max((text.opacity ?? 100) / 100, 0), 1);
                        const color = text.color?.includes('@') ? text.color : `${text.color || 'white'}@${alpha}`;
                        filters.push(
                            `[${lastLabel}]drawtext=fontfile=font${text.fontFamily}.ttf:text='${escapedText}':x=${text.x}:y=${text.y}:fontsize=${text.fontSize || 24}:fontcolor=${color}:enable='between(t\,${text.positionStart}\,${text.positionEnd})'[${label}]`
                        );
                        lastLabel = label;
                    }
                }
                
                if (overlays.length === 0 && textElementsToRender.length === 0) {
                    filters.push(`[base]copy[outv]`);
                } else {
                    filters.push(`[${lastLabel}]copy[outv]`);
                }

                if (audioDelays.length > 0) {
                    const audioMix = audioDelays.join('');
                    filters.push(`${audioMix}amix=inputs=${audioDelays.length}:normalize=0[outa]`);
                }

                const complexFilter = filters.join('; ');
                const ffmpegArgs = [
                    ...inputs,
                    '-filter_complex', complexFilter,
                    '-map', '[outv]',
                ];

                if (audioDelays.length > 0) {
                    ffmpegArgs.push('-map', '[outa]');
                }

                ffmpegArgs.push(
                    '-c:v', 'libx264',
                    '-c:a', 'aac',
                    '-preset', params.preset,
                    '-crf', params.crf.toString(),
                    '-t', state.duration.toFixed(3),
                    'output.mp4'
                );

                ffmpeg.on('log', (log) => {
                    setLogs(prev => [...prev, log.message]);
                });

                await ffmpeg.exec(ffmpegArgs);

            } catch (err) {
                console.error('FFmpeg processing error:', err);
                setLogs(prev => [...prev, `Error: ${err}`]);
            }

            const outputData = await ffmpeg.readFile('output.mp4');
            const outputBlob = new Blob([outputData as Uint8Array], { type: 'video/mp4' });
            const outputUrl = URL.createObjectURL(outputBlob);
            return outputUrl;
        };

        try {
            const outputUrl = await renderFunction(projectState);
            setPreviewUrl(outputUrl);
            setLoaded(true);
            setIsRendering(false);
            toast.success('Video rendered successfully');
        } catch (err) {
            toast.error('Failed to render video');
            console.error("Failed to render video:", err);
            setLogs(prev => [...prev, `Error: ${err}`]);
        }
    };

    return (
        <>
            <button
                onClick={() => render()}
                className={`inline-flex items-center p-3 bg-white hover:bg-[#ccc] rounded-lg disabled:opacity-50 text-gray-900 font-bold transition-all transform`}
                disabled={!loadFfmpeg || isRendering || isCancelling || (mediaFiles.length === 0 && textElements.length === 0)}
            >
                {(!loadFfmpeg || isRendering) && <span className="animate-spin mr-2">
                    <svg
                        viewBox="0 0 1024 1024"
                        focusable="false"
                        data-icon="loading"
                        width="1em"
                        height="1em"
                    >
                        <path d="M988 548c-19.9 0-36-16.1-36-36 0-59.4-11.6-117-34.6-171.3a440.45 440.45 0 00-94.3-139.9 437.71 437.71 0 00-139.9-94.3C629 83.6 571.4 72 512 72c-19.9 0-36-16.1-36-36s16.1-36 36-36c69.1 0 136.2 13.5 199.3 40.3C772.3 66 827 103 874 150c47 47 83.9 101.8 109.7 162.7 26.7 63.1 40.2 130.2 40.2 199.3.1 19.9-16 36-35.9 36z"></path>
                    </svg>
                </span>}
                <p>{loadFfmpeg ? (isRendering ? 'Rendering...' : 'Render') : 'Loading FFmpeg...'}</p>
            </button>

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
                    <div className="bg-black rounded-xl shadow-lg p-6 max-w-xl w-full">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold">
                                {isRendering ? 'Rendering...' : `${projectName}`}
                            </h2>
                            <button
                                onClick={handleCloseModal}
                                className="text-white text-4xl font-bold hover:text-red-400"
                                aria-label="Close"
                            >
                                &times;
                            </button>
                        </div>

                        {isRendering ? (
                            <div>
                                <FfmpegProgressBar ffmpeg={ffmpeg} />
                                <button onClick={() => setShowLogs(!showLogs)} className="text-sm text-blue-400 hover:underline mt-2">
                                    {showLogs ? 'Hide Logs' : 'Show Logs'}
                                </button>
                                {showLogs && (
                                    <div className="mt-2">
                                        <textarea
                                            readOnly
                                            value={logs.join('\n')}
                                            className="w-full h-40 bg-gray-900 text-white p-2 rounded-md font-mono text-xs"
                                        />
                                        <button 
                                            onClick={() => {
                                                navigator.clipboard.writeText(logs.join('\n'));
                                                toast.success('Logs copied to clipboard');
                                            }}
                                            className="bg-blue-500 text-white px-2 py-1 rounded-md mt-2 hover:bg-blue-600"
                                        >
                                            Copy Logs
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div>
                                {previewUrl && (
                                    <video src={previewUrl} controls className="w-full mb-4" />
                                )}
                                <div className="flex justify-between">
                                    <a
                                        href={previewUrl || '#'}
                                        download={`${projectName}.mp4`}
                                        className={`inline-flex items-center p-3 bg-white hover:bg-[#ccc] rounded-lg text-gray-900 font-bold transition-all transform `}
                                    >
                                        <Image
                                            alt='Download'
                                            className="Black"
                                            height={18}
                                            src={'https://www.svgrepo.com/show/501347/save.svg'}
                                            width={18}
                                        />
                                        <span className="ml-2">Save Video</span>
                                    </a>
                                    <a
                                        href="https://github.com/sponsors/mohyware"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`inline-flex items-center p-3 bg-pink-600 hover:bg-pink-500 rounded-lg text-gray-900 font-bold transition-all transform`}
                                    >
                                        <Heart size={20} className="mr-2" />
                                        Sponsor on Github
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}