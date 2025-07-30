'use client';
import { useAppSelector } from "@/app/store";
import { useEffect, useRef, useState, useCallback } from "react";
import { setIsPlaying, setIsMuted, setCurrentTime, setMarkerTrack, setTimelineZoom, undo, redo } from "@/app/store/slices/projectSlice";
import { useDispatch } from "react-redux";
import toast from "react-hot-toast";

interface GlobalKeyHandlerProps {
    handleDuplicate: () => void;
    handleSplit: () => void;
    handleDelete: () => void;
}

const GlobalKeyHandler = ({ handleDuplicate, handleSplit, handleDelete }: GlobalKeyHandlerProps) => {
    const dispatch = useDispatch();
    const { 
        currentTime, 
        isPlaying, 
        isMuted, 
        enableMarkerTracking, 
        duration, 
        timelineZoom,
        history,
        future,
        activeElements,
        mediaFiles,
        textElements
    } = useAppSelector((state) => state.projectState);
    
    const [hasInteracted, setHasInteracted] = useState(false);

    // Use refs to avoid stale closures in event handlers
    const currentTimeRef = useRef(currentTime);
    const isPlayingRef = useRef(isPlaying);
    const isMutedRef = useRef(isMuted);
    const enableMarkerTrackingRef = useRef(enableMarkerTracking);
    const durationRef = useRef(duration);
    const timelineZoomRef = useRef(timelineZoom);

    useEffect(() => {
        currentTimeRef.current = currentTime;
        isPlayingRef.current = isPlaying;
        isMutedRef.current = isMuted;
        enableMarkerTrackingRef.current = enableMarkerTracking;
        durationRef.current = duration;
        timelineZoomRef.current = timelineZoom;
    }, [currentTime, isPlaying, isMuted, enableMarkerTracking, duration, timelineZoom]);

    const handleUndo = useCallback(() => {
        if (history.length > 0) {
            dispatch(undo());
            toast.success('Undone');
        } else {
            toast.error('Nothing to undo');
        }
    }, [dispatch, history.length]);

    const handleRedo = useCallback(() => {
        if (future.length > 0) {
            dispatch(redo());
            toast.success('Redone');
        } else {
            toast.error('Nothing to redo');
        }
    }, [future.length, dispatch]);

    const handleFitToElements = useCallback(() => {
        const allElements = [...mediaFiles, ...textElements];
        
        let targetElements;
        let messagePrefix;
        
        if (activeElements.length === 0) {
            // 선택된 엘리먼트가 없으면 모든 엘리먼트를 대상으로 함
            if (allElements.length === 0) {
                toast.error('No elements in timeline');
                return;
            }
            targetElements = allElements;
            messagePrefix = 'Zoomed to fit all';
        } else {
            // 선택된 엘리먼트들만 대상으로 함
            targetElements = allElements.filter(el => 
                activeElements.some(activeEl => activeEl.id === el.id)
            );
            
            if (targetElements.length === 0) {
                toast.error('Selected elements not found');
                return;
            }
            messagePrefix = 'Zoomed to fit selected';
        }

        const minStart = Math.min(...targetElements.map(el => el.positionStart));
        const maxEnd = Math.max(...targetElements.map(el => el.positionEnd));
        const totalDuration = maxEnd - minStart;
        const centerTime = minStart + (totalDuration / 2);

        if (totalDuration <= 0) {
            toast.error('Invalid element range');
            return;
        }

        // 현재 타임라인 viewport 크기를 실제 DOM에서 가져오기
        const timelineContainer = document.querySelector('[data-timeline-viewport]') as HTMLElement;
        let viewportWidth = window.innerWidth - 144 - 40; // 기본값 (좌측 패널 - 여백)
        
        if (timelineContainer) {
            viewportWidth = timelineContainer.clientWidth;
        }

        // 적절한 줌 레벨 계산 (여유를 위해 10% 추가)
        const targetZoom = (viewportWidth * 0.9) / totalDuration;
        
        // 줌 레벨 제한 (1 ~ 1000)
        const clampedZoom = Math.max(1, Math.min(1000, targetZoom));

        dispatch(setTimelineZoom(clampedZoom));
        
        // 줌 적용 후 선택된 엘리먼트들이 viewport 중앙에 오도록 스크롤 조정
        setTimeout(() => {
            if (timelineContainer) {
                const centerPositionPx = centerTime * clampedZoom;
                const scrollLeft = centerPositionPx - (viewportWidth / 2);
                timelineContainer.scrollLeft = Math.max(0, scrollLeft);
            }
        }, 0); // 줌 적용이 완료된 후 스크롤 조정
        
        toast.success(`${messagePrefix} ${targetElements.length} element(s)`);
    }, [activeElements, mediaFiles, textElements, dispatch]);

    const handleGoToStart = useCallback(() => {
        dispatch(setCurrentTime(0));
        toast.success('Jumped to start');
    }, [dispatch]);

    const handleGoToEnd = useCallback(() => {
        dispatch(setCurrentTime(durationRef.current));
        toast.success('Jumped to end');
    }, [dispatch]);

    const handleZoomIn = useCallback(() => {
        const currentZoom = timelineZoomRef.current;
        let step = 50;
        if (currentZoom < 10) {
            step = 1;
        } else if (currentZoom < 100) {
            step = 10;
        }
        const newZoom = Math.min(currentZoom + step, 1000);
        dispatch(setTimelineZoom(newZoom));
    }, [dispatch]);

    const handleZoomOut = useCallback(() => {
        const currentZoom = timelineZoomRef.current;
        let step = 50;
        if (currentZoom <= 10) {
            step = 1;
        } else if (currentZoom <= 100) {
            step = 10;
        }
        const newZoom = Math.max(currentZoom - step, 1);
        dispatch(setTimelineZoom(newZoom));
    }, [dispatch]);

    useEffect(() => {
        const handleUserInteraction = () => {
            setHasInteracted(true);
        };

        document.addEventListener('click', handleUserInteraction);
        document.addEventListener('keydown', handleUserInteraction);

        return () => {
            document.removeEventListener('click', handleUserInteraction);
            document.removeEventListener('keydown', handleUserInteraction);
        };
    }, []);

    useEffect(() => {
        if (!hasInteracted) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isTyping =
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable;

            if (isTyping) return;

            // Handle Ctrl combinations first
            if (e.ctrlKey || e.metaKey) {
                switch (e.code) {
                    case 'KeyZ':
                        e.preventDefault();
                        if (e.shiftKey) {
                            handleRedo();
                        } else {
                            handleUndo();
                        }
                        break;
                    case 'KeyY':
                        e.preventDefault();
                        handleRedo();
                        break;
                    default:
                        return;
                }
                return;
            }

            // Handle other shortcuts
            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    dispatch(setIsPlaying(!isPlayingRef.current));
                    break;
                case 'KeyM':
                    e.preventDefault();
                    dispatch(setIsMuted(!isMutedRef.current));
                    break;
                case 'KeyD':
                    e.preventDefault();
                    handleDuplicate();
                    break;
                case 'KeyS':
                    e.preventDefault();
                    handleSplit();
                    break;
                case 'Delete':
                    e.preventDefault();
                    handleDelete();
                    break;
                case 'KeyT':
                    e.preventDefault();
                    dispatch(setMarkerTrack(!enableMarkerTrackingRef.current));
                    break;
                case 'Home':
                    e.preventDefault();
                    handleGoToStart();
                    break;
                case 'End':
                    e.preventDefault();
                    handleGoToEnd();
                    break;
                case 'Equal':
                case 'NumpadAdd':
                    e.preventDefault();
                    handleZoomIn();
                    break;
                case 'Minus':
                case 'NumpadSubtract':
                    e.preventDefault();
                    handleZoomOut();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    if (isPlayingRef.current) return;
                    const nextTime = currentTimeRef.current + .01 > durationRef.current ? 0 : currentTimeRef.current + .01;
                    dispatch(setCurrentTime(nextTime));
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    if (isPlayingRef.current) return;
                    const prevTime = currentTimeRef.current - .01 < 0 ? 0 : currentTimeRef.current - .01;
                    dispatch(setCurrentTime(prevTime));
                    break;
                case 'KeyF':
                    e.preventDefault();
                    handleFitToElements();
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [
        dispatch, 
        hasInteracted, 
        handleDuplicate, 
        handleSplit, 
        handleDelete,
        handleUndo,
        handleRedo,
        handleGoToStart,
        handleGoToEnd,
        handleZoomIn,
        handleZoomOut,
        handleFitToElements
    ]);

    return null;
};

export default GlobalKeyHandler;
