import { useAppSelector } from "@/app/store";
import { setMarkerTrack, setTextElements, setMediaFiles, setTimelineZoom, setCurrentTime, setIsPlaying, setActiveElement } from "@/app/store/slices/projectSlice";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import Image from "next/image";
import Header from "./Header";
import VideoTimeline from "./elements-timeline/VideoTimeline";
import ImageTimeline from "./elements-timeline/ImageTimeline";
import AudioTimeline from "./elements-timeline/AudioTimline";
import TextTimeline from "./elements-timeline/TextTimeline";
import { throttle } from 'lodash';
import GlobalKeyHandlerProps from "../../../components/editor/keys/GlobalKeyHandlerProps";
import toast from "react-hot-toast";

export const Timeline = () => {
    const { currentTime, timelineZoom, enableMarkerTracking, activeElement, activeElementIndex, mediaFiles, textElements, duration, isPlaying } = useAppSelector((state) => state.projectState);
    const dispatch = useDispatch();
    const timelineRef = useRef<HTMLDivElement>(null);
    const [isDraggingMarker, setIsDraggingMarker] = useState(false);
    const [dragStartX, setDragStartX] = useState(0);
    const [initialTime, setInitialTime] = useState(0);
    const [localCurrentTime, setLocalCurrentTime] = useState(currentTime);

    const animationFrameRef = useRef<number | null>(null);

    const throttledZoom = useMemo(() =>
        throttle((value: number) => {
            dispatch(setTimelineZoom(value));
        }, 100),
        [dispatch]
    );

    useEffect(() => {
        if (!isDraggingMarker) {
            setLocalCurrentTime(currentTime);
        }
    }, [currentTime, isDraggingMarker]);

    const smoothTimeUpdate = useCallback((time: number) => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        animationFrameRef.current = requestAnimationFrame(() => {
            dispatch(setCurrentTime(time));
        });
    }, [dispatch]);

    useEffect(() => {
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);

    const handleSplit = () => {
        let element = null;
        let elements = null;
        let setElements = null;

        if (!activeElement) {
            toast.error('No element selected.');
            return;
        }

        if (activeElement === 'media') {
            elements = [...mediaFiles];
            element = elements[activeElementIndex];
            setElements = setMediaFiles;

            if (!element) {
                toast.error('No element selected.');
                return;
            }

            const { positionStart, positionEnd } = element;

            if (currentTime <= positionStart || currentTime >= positionEnd) {
                toast.error('Marker is outside the selected element bounds.');
                return;
            }

            const positionDuration = positionEnd - positionStart;

            // Media logic (uses startTime/endTime for trimming)
            const { startTime, endTime } = element;
            const sourceDuration = endTime - startTime;
            const ratio = (currentTime - positionStart) / positionDuration;
            const splitSourceOffset = startTime + ratio * sourceDuration;

            const firstPart = {
                ...element,
                id: crypto.randomUUID(),
                positionStart,
                positionEnd: currentTime,
                startTime,
                endTime: splitSourceOffset
            };

            const secondPart = {
                ...element,
                id: crypto.randomUUID(),
                positionStart: currentTime,
                positionEnd,
                startTime: splitSourceOffset,
                endTime
            };

            elements[activeElementIndex] = firstPart;
            elements.splice(activeElementIndex + 1, 0, secondPart);
        } else if (activeElement === 'text') {
            elements = [...textElements];
            element = elements[activeElementIndex];
            setElements = setTextElements;

            if (!element) {
                toast.error('No element selected.');
                return;
            }

            const { positionStart, positionEnd } = element;

            if (currentTime <= positionStart || currentTime >= positionEnd) {
                toast.error('Marker is outside the selected element bounds.');
                return;
            }

            const firstPart = {
                ...element,
                id: crypto.randomUUID(),
                positionStart,
                positionEnd: currentTime,
            };

            const secondPart = {
                ...element,
                id: crypto.randomUUID(),
                positionStart: currentTime,
                positionEnd,
            };

            elements[activeElementIndex] = firstPart;
            elements.splice(activeElementIndex + 1, 0, secondPart);
        }

        if (elements && setElements) {
            dispatch(setElements(elements as any));
            dispatch(setActiveElement(null));
            toast.success('Element split successfully.');
        }
    };

    const handleDuplicate = () => {
        // @ts-ignore
        let element = null;
        let elements = null;
        let setElements = null;

        if (activeElement === 'media') {
            elements = [...mediaFiles];
            element = elements[activeElementIndex];
            setElements = setMediaFiles;
        } else if (activeElement === 'text') {
            elements = [...textElements];
            element = elements[activeElementIndex];
            setElements = setTextElements;
        }

        if (!element) {
            toast.error('No element selected.');
            return;
        }

        const duplicatedElement = {
            ...element,
            id: crypto.randomUUID(),
        };

        if (elements) {
            elements.splice(activeElementIndex + 1, 0, duplicatedElement as any);
        }

        if (elements && setElements) {
            dispatch(setElements(elements as any));
            dispatch(setActiveElement(null));
            toast.success('Element duplicated successfully.');
        }
    };

    const handleDelete = () => {
        // @ts-ignore
        let element = null;
        let elements = null;
        let setElements = null;

        if (activeElement === 'media') {
            elements = [...mediaFiles];
            element = elements[activeElementIndex];
            setElements = setMediaFiles;
        } else if (activeElement === 'text') {
            elements = [...textElements];
            element = elements[activeElementIndex];
            setElements = setTextElements;
        }

        if (!element) {
            toast.error('No element selected.');
            return;
        }

        if (elements) {
            // @ts-ignore
            elements = elements.filter(ele => ele.id !== element.id)
        }

        if (elements && setElements) {
            dispatch(setElements(elements as any));
            dispatch(setActiveElement(null));
            toast.success('Element deleted successfully.');
        }
    };

    const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!timelineRef.current || isDraggingMarker) return;
        dispatch(setIsPlaying(false));
        const rect = timelineRef.current.getBoundingClientRect();
        const scrollOffset = timelineRef.current.scrollLeft;
        const offsetX = e.clientX - rect.left + scrollOffset;
        const seconds = offsetX / timelineZoom;
        const clampedTime = Math.max(0, Math.min(duration, seconds));
        dispatch(setCurrentTime(clampedTime));
        setLocalCurrentTime(clampedTime);
    };

    const handleDragStart = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!timelineRef.current) return;

        const rect = timelineRef.current.getBoundingClientRect();
        const scrollOffset = timelineRef.current.scrollLeft;
        const offsetX = e.clientX - rect.left + scrollOffset;
        const newTime = Math.max(0, Math.min(duration, offsetX / timelineZoom));

        dispatch(setIsPlaying(false));
        setIsDraggingMarker(true);
        setDragStartX(e.clientX);
        setInitialTime(newTime);
        setLocalCurrentTime(newTime);
        smoothTimeUpdate(newTime);

        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
    };

    const handleDragMove = useCallback((e: MouseEvent) => {
        if (!isDraggingMarker || !timelineRef.current) return;

        const deltaX = e.clientX - dragStartX;
        const deltaTime = deltaX / timelineZoom;
        const newTime = Math.max(0, Math.min(duration, initialTime + deltaTime));

        setLocalCurrentTime(newTime);
        smoothTimeUpdate(newTime);
    }, [isDraggingMarker, dragStartX, timelineZoom, initialTime, duration, smoothTimeUpdate]);

    const handleDragEnd = useCallback(() => {
        if (!isDraggingMarker) return;

        setIsDraggingMarker(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
    }, [isDraggingMarker]);

    useEffect(() => {
        if (isDraggingMarker) {
            document.addEventListener('mousemove', handleDragMove);
            document.addEventListener('mouseup', handleDragEnd);
            return () => {
                document.removeEventListener('mousemove', handleDragMove);
                document.removeEventListener('mouseup', handleDragEnd);
            };
        }
    }, [isDraggingMarker, handleDragMove, handleDragEnd]);

    return (
        <div className="flex w-full flex-col gap-2">
            <div className="flex flex-row items-center justify-between gap-12 w-full">
                <div className="flex flex-row items-center gap-2">
                    {/* Track Marker */}
                    <div className="relative group">
                        <button
                            onClick={() => dispatch(setMarkerTrack(!enableMarkerTracking))}
                            className={`${
                                enableMarkerTracking 
                                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/25' 
                                    : 'bg-white border-transparent text-gray-800 hover:bg-[#ccc]'
                            } border rounded-md transition-all duration-200 flex flex-row items-center justify-center dark:hover:bg-[#ccc] mt-2 font-medium text-sm sm:text-base h-auto px-2 py-1 sm:w-auto`}
                        >
                            {enableMarkerTracking ? (
                                <div className="relative">
                                    <Image
                                        alt="Marker Tracking Enabled"
                                        className="h-auto w-auto max-w-[20px] max-h-[20px]"
                                        height={30}
                                        width={30}
                                        src="https://www.svgrepo.com/show/447546/yes-alt.svg"
                                    />
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
                                </div>
                            ) : (
                                <Image
                                    alt="Marker Tracking Disabled"
                                    className="h-auto w-auto max-w-[20px] max-h-[20px]"
                                    height={30}
                                    width={30}
                                    src="https://www.svgrepo.com/show/447315/dismiss.svg"
                                />
                            )}
                            <span className="ml-2">
                                Track Marker 
                                <span className="text-xs"> (T)</span>
                                {enableMarkerTracking && (
                                    <span className="ml-1 inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                )}
                            </span>
                        </button>
                        
                        {/* Enhanced Tooltip */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap border border-gray-700">
                            <div className="text-center">
                                <div className="font-semibold mb-1">
                                    {enableMarkerTracking ? '🎯 Marker Tracking: ON' : '⭕ Marker Tracking: OFF'}
                                </div>
                                <div className="text-gray-300">
                                    {enableMarkerTracking 
                                        ? 'Timeline cursor follows playback automatically' 
                                        : 'Click to enable automatic cursor tracking'
                                    }
                                </div>
                                <div className="text-gray-400 text-[10px] mt-1">
                                    Press 'T' to toggle
                                </div>
                            </div>
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                        </div>
                    </div>

                    {/* Split */}
                    <button
                        onClick={handleSplit}
                        className="bg-white border rounded-md border-transparent transition-colors flex flex-row items-center justify-center text-gray-800 hover:bg-[#ccc] dark:hover:bg-[#ccc] mt-2 font-medium text-sm sm:text-base h-auto px-2 py-1 sm:w-auto"
                    >
                        <Image
                            alt="cut"
                            className="h-auto w-auto max-w-[20px] max-h-[20px]"
                            height={30}
                            width={30}
                            src="https://www.svgrepo.com/show/509075/cut.svg"
                        />
                        <span className="ml-2">Split <span className="text-xs">(S)</span></span>
                    </button>
                    {/* Duplicate */}
                    <button
                        onClick={handleDuplicate}
                        className="bg-white border rounded-md border-transparent transition-colors flex flex-row items-center justify-center text-gray-800 hover:bg-[#ccc] dark:hover:bg-[#ccc] mt-2 font-medium text-sm sm:text-base h-auto px-2 py-1 sm:w-auto"
                    >
                        <Image
                            alt="cut"
                            className="h-auto w-auto max-w-[20px] max-h-[20px]"
                            height={30}
                            width={30}
                            src="https://www.svgrepo.com/show/521623/duplicate.svg"
                        />
                        <span className="ml-2">Duplicate <span className="text-xs">(D)</span></span>
                    </button>
                    {/* Delete */}
                    <button
                        onClick={handleDelete}
                        className="bg-white border rounded-md border-transparent transition-colors flex flex-row items-center justify-center text-gray-800 hover:bg-[#ccc] dark:hover:bg-[#ccc] mt-2 font-medium text-sm sm:text-base h-auto px-2 py-1 sm:w-auto"
                    >
                        <Image
                            alt="Delete"
                            className="h-auto w-auto max-w-[20px] max-h-[20px]"
                            height={30}
                            width={30}
                            src="https://www.svgrepo.com/show/511788/delete-1487.svg"
                        />
                        <span className="ml-2">Delete <span className="text-xs">(Del)</span></span>
                    </button>
                    
                    {/* Marker Tracking Status Indicator */}
                    {enableMarkerTracking && (
                        <div className="flex items-center space-x-2 bg-blue-900 bg-opacity-30 border border-blue-500 border-opacity-40 rounded-lg px-3 py-1 mt-2">
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                            <span className="text-blue-300 text-xs font-medium">Auto-tracking active</span>
                        </div>
                    )}
                </div>

                {/* Timeline Zoom */}
                <div className="flex flex-row justify-between items-center gap-2 mr-4">
                    <label className="block text-sm mt-1 font-semibold text-white">Zoom</label>
                    <span className="text-white text-lg">-</span>
                    <input
                        type="range"
                        min={1}
                        max={1000}
                        step="1"
                        value={timelineZoom}
                        onChange={(e) => throttledZoom(Number(e.target.value))}
                        className="w-[100px] bg-darkSurfacePrimary border border-white border-opacity-10 shadow-md text-white rounded focus:outline-none focus:border-white-500"
                    />
                    <span className="text-white text-lg">+</span>
                </div>
            </div>

            <div
                className="relative overflow-x-auto w-full border-t border-gray-800 bg-[#1E1D21] z-10"
                ref={timelineRef}
                onClick={handleTimelineClick}
            >
                <Header onDragStart={handleDragStart} />

                <div className="bg-[#1E1D21]" style={{ width: "100%" }}>
                    <div
                        className={`absolute top-0 bottom-0 w-[2px] z-50 cursor-ew-resize bg-red-500`}
                        style={{
                            left: `${localCurrentTime * timelineZoom}px`,
                        }}
                        onMouseDown={handleDragStart}
                    >
                        <div className={`absolute -top-8 -left-8 text-white text-xs px-2 py-1 rounded whitespace-nowrap border bg-red-500 border-red-400 transition-all duration-300`}>
                            {(localCurrentTime).toFixed(2)}s
                        </div>
                    </div>
                    
                    <div className="w-full">
                        <div className="relative h-16 z-10">
                            <VideoTimeline />
                        </div>

                        <div className="relative h-16 z-10">
                            <AudioTimeline />
                        </div>

                        <div className="relative h-16 z-10">
                            <ImageTimeline />
                        </div>

                        <div className="relative h-16 z-10">
                            <TextTimeline />
                        </div>
                    </div>
                </div>
            </div>
            <GlobalKeyHandlerProps handleDuplicate={handleDuplicate} handleSplit={handleSplit} handleDelete={handleDelete} />
        </div>
    );
};

export default memo(Timeline)
