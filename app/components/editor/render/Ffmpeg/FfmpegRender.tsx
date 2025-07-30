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
            pollingRef.current = null;
        }
        if (toastIdRef.current) {
            toast.dismiss(toastIdRef.current);
            toastIdRef.current = null;
        }
    };

    const handleSaveVideo = async () => {
        if (!renderId || !projectName) {
            toast.error('Could not save video: missing render ID or project name.');
            return;
        }
        setIsSaving(true);
        const saveToastId = toast.loading('Saving video...');
        try {
            const response = await fetch('/api/video/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ renderId, projectName }),
            });
            const data = await response.json();
            toast.dismiss(saveToastId);

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
            toast.dismiss(saveToastId);
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
                if (toastIdRef.current) {
                    toast.dismiss(toastIdRef.current);
                    toastIdRef.current = null;
                }
                setStatus('complete');
                setFinalUrl(data.url);
                toast.success('Render Complete!');
                if (pollingRef.current) {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;
                }
            } else if (data.status === 'error') {
                if (toastIdRef.current) {
                    toast.dismiss(toastIdRef.current);
                    toastIdRef.current = null;
                }
                setStatus('error');
                toast.error(`Render failed: ${data.message}`);
                if (pollingRef.current) {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;
                }
            } else {
                setStatus('processing');
            }
        } catch (error) {
            console.error('Error checking render status:', error);
            if (toastIdRef.current) {
                toast.dismiss(toastIdRef.current);
                toastIdRef.current = null;
            }
            setStatus('error');
            toast.error('Could not retrieve render status.');
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
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

    // 웹페이지 종료 시 cleanup 처리
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (renderId && (status === 'processing' || status === 'starting' || status === 'complete')) {
                // 브라우저 종료 시 cleanup 시도
                if (status === 'processing' || status === 'starting') {
                    // 렌더링 중인 경우 취소 API 호출 (POST 메서드로)
                    navigator.sendBeacon(`/api/render/cancel/${renderId}`, '');
                } else if (status === 'complete' && !isSaved) {
                    // 완료됐지만 저장하지 않은 경우 임시 파일 삭제
                    // DELETE 메서드는 sendBeacon으로 불가능하므로 fetch로 시도
                    fetch(`/api/video/temp/${renderId}`, {
                        method: 'DELETE',
                        keepalive: true
                    }).catch(() => {});
                    navigator.sendBeacon('/api/video/cleanup', '');
                }
                
                // 사용자에게 경고 메시지 표시 (렌더링 중인 경우)
                if (status === 'processing' || status === 'starting') {
                    e.preventDefault();
                    e.returnValue = '렌더링이 진행 중입니다. 페이지를 닫으면 렌더링이 취소됩니다.';
                    return e.returnValue;
                }
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden' && renderId) {
                // 페이지가 숨겨질 때 cleanup 시도 (모바일 등에서 유용)
                if (status === 'processing' || status === 'starting') {
                    fetch(`/api/render/cancel/${renderId}`, {
                        method: 'DELETE',
                        keepalive: true
                    }).catch(() => {});
                } else if (status === 'complete' && !isSaved) {
                    fetch(`/api/video/temp/${renderId}`, {
                        method: 'DELETE',
                        keepalive: true
                    }).catch(() => {});
                    fetch('/api/video/cleanup', {
                        method: 'POST',
                        keepalive: true
                    }).catch(() => {});
                }
            }
        };

        const handlePageHide = () => {
            // 페이지가 완전히 숨겨질 때 (백그라운드로 이동 등)
            if (renderId && (status === 'processing' || status === 'starting')) {
                // POST 메서드로 취소 API 호출
                navigator.sendBeacon(`/api/render/cancel/${renderId}`, '');
            }
        };

        // 이벤트 리스너 등록
        window.addEventListener('beforeunload', handleBeforeUnload);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('pagehide', handlePageHide);

        return () => {
            // 컴포넌트 언마운트 시 이벤트 리스너 제거
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('pagehide', handlePageHide);
        };
    }, [renderId, status, isSaved]);

    const handleCloseModal = async () => {
        if (status === 'processing' || status === 'starting') {
            const shouldCancel = confirm('렌더링이 진행 중입니다. 정말로 취소하시겠습니까?\n모든 렌더링 작업이 중단되고 임시 파일들이 삭제됩니다.');
            if (shouldCancel) {
                if (renderId) {
                    const cancelToastId = toast.loading('렌더링을 취소하는 중...');
                    try {
                        const response = await fetch(`/api/render/cancel/${renderId}`, {
                            method: 'DELETE',
                        });
                        
                        if (response.ok) {
                            const data = await response.json();
                            toast.dismiss(cancelToastId);
                            toast.success('렌더링이 취소되었습니다.');
                            console.log('Cancel response:', data);
                        } else {
                            throw new Error('Cancel request failed');
                        }
                    } catch (error) {
                        console.error('Failed to cancel render:', error);
                        toast.dismiss(cancelToastId);
                        toast.error('렌더링 취소 중 오류가 발생했습니다.\n임시 파일 정리가 완전하지 않을 수 있습니다.');
                    }
                }
                setIsOpen(false);
                resetState();
            }
        } else {
            if (status === 'complete' && !isSaved) {
                // 렌더링 완료됐지만 저장하지 않은 경우만 임시 파일 삭제
                if (renderId) {
                    try {
                        await fetch(`/api/video/temp/${renderId}`, {
                            method: 'DELETE',
                            keepalive: true,
                        });
                    } catch (error) {
                        console.error('Failed to delete temp files:', error);
                    }
                }
                // 로컬 환경에서만 전체 cleanup 실행
                try {
                    await fetch('/api/video/cleanup', {
                        method: 'POST',
                        keepalive: true,
                    });
                } catch (error) {
                    console.error('Failed to cleanup:', error);
                }
            } else if (status === 'complete' && isSaved) {
                // 저장된 경우에는 임시 파일만 삭제하고 .done 파일은 보존
                if (renderId) {
                    try {
                        await fetch(`/api/video/temp/${renderId}?preserveSuccess=true`, {
                            method: 'DELETE',
                            keepalive: true,
                        });
                        console.log('Cleaned up temp files while preserving success marker');
                    } catch (error) {
                        console.error('Failed to delete temp files:', error);
                    }
                }
            }
            
            setIsOpen(false);
            resetState();
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
                                        {!isSaved && (
                                            <video 
                                                src={finalUrl} 
                                                controls 
                                                className="w-full mb-4"
                                                onError={(e) => {
                                                    console.error('Video preview error:', e);
                                                    toast.error('비디오 미리보기를 로드할 수 없습니다.');
                                                }}
                                            />
                                        )}
                                        {isSaved && (
                                            <div className="text-center mb-4 p-4 bg-green-900 rounded-lg">
                                                <p className="text-green-400 font-semibold">✅ 비디오가 성공적으로 저장되었습니다!</p>
                                                <p className="text-sm text-gray-300 mt-2">비디오 파일이 다운로드되었습니다.</p>
                                            </div>
                                        )}
                                        <button 
                                            onClick={handleSaveVideo} 
                                            disabled={isSaving || isSaved} 
                                            className={`w-full inline-flex items-center justify-center p-3 bg-green-600 hover:bg-green-700 rounded-lg text-white font-bold transition-all transform disabled:opacity-50 disabled:bg-green-800`}
                                        >
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