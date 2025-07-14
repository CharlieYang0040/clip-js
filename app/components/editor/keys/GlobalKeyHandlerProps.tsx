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
        future
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
    }, [dispatch, future.length]);

    const handleGoToStart = useCallback(() => {
        dispatch(setCurrentTime(0));
        toast.success('Jumped to start');
    }, [dispatch]);

    const handleGoToEnd = useCallback(() => {
        dispatch(setCurrentTime(durationRef.current));
        toast.success('Jumped to end');
    }, [dispatch]);

    const handleZoomIn = useCallback(() => {
        const newZoom = Math.min(timelineZoomRef.current + 50, 1000);
        dispatch(setTimelineZoom(newZoom));
    }, [dispatch]);

    const handleZoomOut = useCallback(() => {
        const newZoom = Math.max(timelineZoomRef.current - 50, 1);
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
        handleZoomOut
    ]);

    return null;
};

export default GlobalKeyHandler;
