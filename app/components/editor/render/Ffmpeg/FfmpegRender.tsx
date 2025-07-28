'use client'
import { useEffect, useRef, useState } from "react";
import { getFile, useAppSelector } from "@/app/store";
import { Heart } from "lucide-react";
import Image from "next/image";
import { toast } from "react-hot-toast";
import { ProjectState } from "@/app/types";

interface FfmpegRenderProps {}

export default function FfmpegRender({}: FfmpegRenderProps) {
    const projectState = useAppSelector(state => state.projectState);
    const { mediaFiles, projectName, textElements } = projectState;
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    const [renderId, setRenderId] = useState<string | null>(null);
    const [status, setStatus] = useState('idle');
    const [logs, setLogs] = useState('');
    const [showLogs, setShowLogs] = useState(false);
    const [finalUrl, setFinalUrl] = useState<string | null>(null);

    useEffect(() => {
        if (renderId && (status === 'starting' || status === 'processing')) {
            pollingRef.current = setInterval(async () => {
                try {
                    const response = await fetch(`/api/status/${renderId}`);
                    if (!response.ok) return;
                    const data = await response.json();
                    
                    setLogs(data.log || '');
                    setStatus(data.status);

                    if (data.status === 'complete' || data.status === 'failed') {
                        if (pollingRef.current) clearInterval(pollingRef.current);
                        if (data.status === 'complete') {
                            setFinalUrl(data.url);
                            toast.success('Render Complete!');
                        } else {
                            toast.error('Render Failed. Check logs for details.');
                        }
                    }
                } catch (error) {
                    console.error("Status polling failed:", error);
                    if (pollingRef.current) clearInterval(pollingRef.current);
                }
            }, 2000);

            return () => {
                if (pollingRef.current) clearInterval(pollingRef.current);
            };
        }
    }, [renderId, status]);

    const handleCloseModal = () => {
        setRenderId(null);
        setStatus('idle');
        setLogs('');
        setFinalUrl(null);
        setShowLogs(false);
    };

    const render = async () => {
        if (mediaFiles.length === 0 && textElements.length === 0) {
            toast.error('No media or text elements to render.');
            return;
        }
        
        setStatus('uploading');
        toast.loading('Uploading media files...');

        try {
            const uploadedMediaFiles = await Promise.all(
                projectState.mediaFiles.map(async (mediaFile) => {
                    const file = await getFile(mediaFile.url!);
                    if (!file) throw new Error(`File not found for ${mediaFile.fileName}`);
                    const formData = new FormData();
                    formData.append('file', file);
                    const response = await fetch('/api/v1/upload', { method: 'POST', body: formData });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.message || 'File upload failed');
                    return { ...mediaFile, url: result.filePath };
                })
            );
            
            toast.dismiss();
            toast.loading('Initializing render...');
            const serverProjectState: ProjectState = { ...projectState, mediaFiles: uploadedMediaFiles };

            const response = await fetch('/api/render', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(serverProjectState),
            });

            const result = await response.json();
            toast.dismiss();

            if (response.ok) {
                setRenderId(result.renderId);
                setStatus('starting');
            } else {
                throw new Error(result.message || 'Failed to start render');
            }
        } catch (error) {
            toast.dismiss();
            toast.error(`Error: ${(error as Error).message}`);
            setStatus('idle');
        }
    };

    const getButtonText = () => {
        if (status === 'uploading') return 'Uploading...';
        if (status === 'starting' || status === 'processing') return 'Rendering...';
        return 'Render Video';
    };

    return (
        <>
            <button onClick={render} disabled={status !== 'idle'} className={`inline-flex items-center p-3 bg-white hover:bg-[#ccc] rounded-lg disabled:opacity-50 text-gray-900 font-bold transition-all transform`}>
                {(status === 'uploading' || status === 'starting' || status === 'processing') && <span className="animate-spin mr-2">
                    <svg viewBox="0 0 1024 1024" focusable="false" data-icon="loading" width="1em" height="1em">
                        <path d="M988 548c-19.9 0-36-16.1-36-36 0-59.4-11.6-117-34.6-171.3a440.45 440.45 0 00-94.3-139.9 437.71 437.71 0 00-139.9-94.3C629 83.6 571.4 72 512 72c-19.9 0-36-16.1-36-36s16.1-36 36-36c69.1 0 136.2 13.5 199.3 40.3C772.3 66 827 103 874 150c47 47 83.9 101.8 109.7 162.7 26.7 63.1 40.2 130.2 40.2 199.3.1 19.9-16 36-35.9 36z"></path>
                    </svg>
                </span>}
                <p>{getButtonText()}</p>
            </button>

            {status !== 'idle' && status !== 'uploading' && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
                    <div className="bg-black rounded-xl shadow-lg p-6 max-w-2xl w-full">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold">
                                {status === 'complete' ? 'Render Complete' : (status === 'failed' ? 'Render Failed' : 'Rendering...')}
                            </h2>
                            <button onClick={handleCloseModal} className="text-white text-4xl font-bold hover:text-red-400">
                                &times;
                            </button>
                        </div>

                        {status === 'complete' && finalUrl ? (
                            <div>
                                <video src={finalUrl} controls className="w-full mb-4" />
                                <a href={finalUrl} download={`${projectName || 'render'}.mp4`} className={`inline-flex items-center p-3 bg-white hover:bg-[#ccc] rounded-lg text-gray-900 font-bold transition-all transform`}>
                                    <Image alt='Download' className="Black" height={18} src={'https://www.svgrepo.com/show/501347/save.svg'} width={18} />
                                    <span className="ml-2">Save Video</span>
                                </a>
                            </div>
                        ) : (
                            <div>
                                <div className="w-full bg-gray-700 rounded-full h-4 mb-2 overflow-hidden">
                                    <div className="bg-blue-600 h-4 w-full animate-pulse" />
                                </div>
                                <p className="text-center text-sm mb-2">Status: {status}</p>
                                <div className="flex justify-between items-center mt-2">
                                    <button onClick={() => setShowLogs(!showLogs)} className="text-sm text-blue-400 hover:underline">
                                        {showLogs ? 'Hide Logs' : 'Show Logs'}
                                    </button>
                                    {showLogs && (
                                        <button onClick={() => navigator.clipboard.writeText(logs)} className="text-sm text-gray-400 hover:text-white">
                                            Copy
                                        </button>
                                    )}
                                </div>
                                {showLogs && (
                                    <textarea readOnly value={logs} className="w-full h-60 mt-2 bg-gray-900 text-white p-2 rounded-md font-mono text-xs" />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}