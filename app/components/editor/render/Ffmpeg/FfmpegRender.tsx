'use client'
import { useEffect, useRef, useState } from "react";
import { getFile, useAppSelector } from "@/app/store";
import { Heart } from "lucide-react";
import Image from "next/image";
import { toast } from "react-hot-toast";
import { ProjectState } from "@/app/types";
import RenderOptions from './RenderOptions';

interface FfmpegRenderProps {}

export default function FfmpegRender({}: FfmpegRenderProps) {
    const projectState = useAppSelector(state => state.projectState);
    const { mediaFiles, projectName, textElements } = projectState;
    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    const toastIdRef = useRef<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    const [renderId, setRenderId] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'starting' | 'processing' | 'complete' | 'error'>('idle');
    const [logs, setLogs] = useState('');
    const [showLogs, setShowLogs] = useState(false);
    const [finalUrl, setFinalUrl] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [progress, setProgress] = useState(0);

    const resetState = () => {
        setRenderId(null);
        setStatus('idle');
        setLogs('');
        setFinalUrl(null);
        setIsSaving(false);
        setIsSaved(false);
        setShowLogs(false);
        setProgress(0);
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
        }
    };

    const handleSaveVideo = async () => {
        if (!renderId || !projectName) {
            toast.error('Could not save video: missing render ID or project name.');
            return;
        }
        setIsSaving(true);
        toast.loading('Saving video...');
        try {
            const response = await fetch('/api/video/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ renderId, projectName }),
            });
            const data = await response.json();
            toast.dismiss();

            if (response.ok) {
                toast.success('Video saved successfully!');
                setIsSaved(true);
                // Optionally, trigger download or show a link
                const link = document.createElement('a');
                link.href = data.url;
                link.download = data.finalName || `${projectName}.mp4`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                throw new Error(data.message || 'Failed to save video');
            }
        } catch (error) {
            toast.dismiss();
            toast.error(`Save failed: ${(error as Error).message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const checkStatus = async (id: string) => {
        try {
            const response = await fetch(`/api/render/status/${id}`);
            if (!response.ok) {
                throw new Error('Failed to check status');
            }
            const data = await response.json();
            
            setLogs(data.logs || '');
            setProgress(data.progress || 0);

            if (data.status === 'complete') {
                if (toastIdRef.current) toast.dismiss(toastIdRef.current);
                setStatus('complete');
                setFinalUrl(data.url);
                toast.success('Render Complete!');
                if (pollingRef.current) clearInterval(pollingRef.current);
            } else if (data.status === 'error') {
                if (toastIdRef.current) toast.dismiss(toastIdRef.current);
                setStatus('error');
                toast.error(`Render failed: ${data.message}`);
                if (pollingRef.current) clearInterval(pollingRef.current);
            } else {
                setStatus('processing');
            }
        } catch (error) {
            console.error('Error checking render status:', error);
            if (toastIdRef.current) toast.dismiss(toastIdRef.current);
            setStatus('error');
            toast.error('Could not retrieve render status.');
            if (pollingRef.current) clearInterval(pollingRef.current);
        }
    };
    
    useEffect(() => {
        if (renderId && (status === 'starting' || status === 'processing')) {
            pollingRef.current = setInterval(() => checkStatus(renderId), 2000);
        }
    
        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
            }
        };
    }, [status, renderId]);

    useEffect(() => {
        if (isOpen && status === 'idle') {
            render();
        }
    }, [isOpen, status]);

    const handleCloseModal = () => {
        if (status === 'processing' || status === 'starting') {
            if (confirm('A render is in progress. Are you sure you want to close? This will not cancel the render.')) {
                setIsOpen(false);
            }
        } else {
            if (status === 'complete') {
                if (renderId) {
                    fetch(`/api/video/temp/${renderId}`, {
                        method: 'DELETE',
                        keepalive: true,
                    });
                }
                fetch('/api/video/cleanup', {
                    method: 'POST',
                    keepalive: true,
                });
            }
            setIsOpen(false);
            resetState();
            toast.dismiss();
        }
    };

    const render = async () => {
        setStatus('starting');

        try {
            const { tracks, mediaFiles, textElements } = projectState;
            const isSoloActive = tracks.some(track => track.isSoloed);

            const activeMediaFiles = mediaFiles.filter(mediaFile => {
                const track = tracks.find(t => t.id === mediaFile.trackId);
                if (!track) return false;
                if (isSoloActive) {
                    return track.isSoloed && !track.isMuted;
                }
                return !track.isMuted;
            });
            
            const activeTextElements = textElements.filter(textElement => {
                const track = tracks.find(t => t.id === textElement.trackId);
                if (!track) return false;
                if (isSoloActive) {
                    return track.isSoloed && !track.isMuted;
                }
                return !track.isMuted;
            });

            const uploadedMediaFiles = await Promise.all(
                activeMediaFiles.map(async (mediaFile) => {
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
            
            if (toastIdRef.current) toast.dismiss(toastIdRef.current);
            toastIdRef.current = toast.loading('Initializing render...');
            const serverProjectState: ProjectState = { 
                ...projectState, 
                mediaFiles: uploadedMediaFiles,
                textElements: activeTextElements 
            };

            const response = await fetch('/api/render', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(serverProjectState)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Render initiation failed');
            }

            const { renderId: newRenderId } = await response.json();
            setRenderId(newRenderId);
            setStatus('starting'); 

        } catch (error) {
            if (toastIdRef.current) toast.dismiss(toastIdRef.current);
            toast.error(`Error: ${(error as Error).message}`);
            setStatus('idle');
        }
    };

    const getButtonText = () => {
        if (status === 'starting' || status === 'processing') return 'Rendering...';
        return 'Render Video';
    };

    return (
        <>
            <button onClick={() => setIsOpen(true)} className={`inline-flex items-center p-3 bg-white hover:bg-[#ccc] rounded-lg disabled:opacity-50 text-gray-900 font-bold transition-all transform`}>
                <p>Export</p>
            </button>
            {isOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
                    <div className="bg-black rounded-xl shadow-lg p-6 max-w-2xl w-full">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold">
                                {status === 'complete' ? 'Render Complete' : (status === 'error' ? 'Render Failed' : 'Rendering...')}
                            </h2>
                            <button onClick={handleCloseModal} className="text-white text-4xl font-bold hover:text-red-400">
                                &times;
                            </button>
                        </div>
                        <div className="p-2 rounded-lg w-full">
                            <div className="mt-4 pt-4 border-t border-gray-700">
                                {(status === 'idle' || status === 'starting' || status === 'processing') && (
                                    <div>
                                        <div className="w-full bg-gray-700 rounded-full h-4 mb-2 overflow-hidden">
                                            <div className="bg-blue-600 h-4 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                                        </div>
                                        <p className="text-center text-sm mb-2">
                                            {status === 'processing' ? `Rendering... ${progress}%` : 'Starting...'}
                                        </p>
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
                                            <div className="mt-2 p-2 bg-gray-900 rounded text-xs text-gray-300 max-h-48 overflow-y-auto">
                                                <pre>{logs}</pre>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {status === 'complete' && finalUrl ? (
                                    <div>
                                        <video src={finalUrl} controls className="w-full mb-4" />
                                        <button onClick={handleSaveVideo} disabled={isSaving || isSaved} className={`w-full inline-flex items-center justify-center p-3 bg-green-600 hover:bg-green-700 rounded-lg text-white font-bold transition-all transform disabled:opacity-50 disabled:bg-green-800`}>
                                            {isSaving ? 'Saving...' : (isSaved ? 'Saved!' : 'Save Video and Download')}
                                        </button>
                                    </div>
                                ) : null}

                                {status === 'error' && (
                                    <div>
                                        <p className="text-red-500 text-center mb-2">Render Failed</p>
                                        <button onClick={resetState} className="w-full p-2 bg-gray-600 hover:bg-gray-700 rounded text-white">
                                            Try Again
                                        </button>
                                        <div className="mt-2 p-2 bg-gray-900 rounded text-xs text-gray-300 max-h-48 overflow-y-auto">
                                            <pre>{logs}</pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}