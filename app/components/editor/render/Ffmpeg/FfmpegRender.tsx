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
    const videoRef = useRef<HTMLVideoElement>(null);
    const [loaded, setLoaded] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isRendering, setIsRendering] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [showLogs, setShowLogs] = useState(false);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (previewUrl && videoRef.current) {
            const videoElement = videoRef.current;

            const handleCanPlay = () => {
                setLoaded(true);
                setIsRendering(false);
                toast.dismiss();
                toast.success('Render complete!');
            };

            videoElement.addEventListener('canplay', handleCanPlay);

            // Start loading the video
            videoElement.src = previewUrl;

            return () => {
                videoElement.removeEventListener('canplay', handleCanPlay);
            };
        }
    }, [previewUrl]);

    const handleCloseModal = () => {
        setShowModal(false);
        setIsRendering(false);
        setLoaded(false);
        setPreviewUrl(null);
        setLogs([]);
        setShowLogs(false);
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
        }
    };

    const render = async () => {
        if (mediaFiles.length === 0 && textElements.length === 0) {
            toast.error('No media or text elements to render.');
            return;
        }
        
        setIsUploading(true);
        setLogs([]);
        toast.loading('Uploading media files...');

        try {
            const uploadedMediaFiles = await Promise.all(
                projectState.mediaFiles.map(async (mediaFile) => {
                    const file = await getFile(mediaFile.url!); 
                    if (!file) {
                        throw new Error(`File not found for ${mediaFile.fileName}`);
                    }

                    const formData = new FormData();
                    formData.append('file', file);

                    const response = await fetch('/api/v1/upload', {
                        method: 'POST',
                        body: formData,
                    });

                    const result = await response.json();
                    if (!response.ok) {
                        throw new Error(result.message || 'File upload failed');
                    }
                    return { ...mediaFile, url: result.filePath };
                })
            );
            
            toast.dismiss();
            toast.loading('Render process started on server...');
            setIsUploading(false);
            setIsRendering(true);
            setShowModal(true);

            const serverProjectState: ProjectState = {
                ...projectState,
                mediaFiles: uploadedMediaFiles,
            };

            const response = await fetch('/api/render', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(serverProjectState),
            });

            const result = await response.json();

            if (response.ok) {
                setPreviewUrl(result.outputUrl);
                // Polling will now be triggered by the useEffect
            } else {
                throw new Error(result.message || 'Failed to start rendering.');
            }

        } catch (error) {
            toast.dismiss();
            toast.error(`Error: ${(error as Error).message}`);
            console.error("Render process failed:", error);
            setIsUploading(false);
            setIsRendering(false);
            setShowModal(false);
        }
    };

    const buttonText = () => {
        if (isUploading) return 'Uploading...';
        if (isRendering) return 'Rendering...';
        return 'Render Video';
    }

    return (
        <>
            <button
                onClick={render}
                className={`inline-flex items-center p-3 bg-white hover:bg-[#ccc] rounded-lg disabled:opacity-50 text-gray-900 font-bold transition-all transform`}
                disabled={isUploading || isRendering || (mediaFiles.length === 0 && textElements.length === 0)}
            >
                {(isUploading || isRendering) && <span className="animate-spin mr-2">
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
                <p>{buttonText()}</p>
            </button>

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
                    <div className="bg-black rounded-xl shadow-lg p-6 max-w-xl w-full">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold">
                                {isRendering ? 'Rendering...' : (loaded ? 'Render Complete' : 'Starting Render...')}
                            </h2>
                            <button
                                onClick={handleCloseModal}
                                className="text-white text-4xl font-bold hover:text-red-400"
                                aria-label="Close"
                            >
                                &times;
                            </button>
                        </div>

                        {!loaded ? (
                            <div>
                                <div className="w-full bg-gray-700 rounded-full h-4 mb-2">
                                    <div className="bg-blue-600 h-4 rounded-full animate-pulse" style={{ width: `100%` }}></div>
                                </div>
                                <p className="text-center text-sm">Rendering is in progress on the server. This may take a moment...</p>
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
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div>
                                {previewUrl && (
                                    <video ref={videoRef} src={previewUrl} controls className="w-full mb-4" />
                                )}
                                <div className="flex justify-between">
                                    <a
                                        href={previewUrl || '#'} // Use the same URL for download
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
    );
}