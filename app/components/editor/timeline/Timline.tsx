import { useAppSelector } from "@/app/store";
import { setMarkerTrack, setTextElements, setMediaFiles, setTimelineZoom, setCurrentTime, setIsPlaying, setSnapMode, setActiveGap, toggleActiveElement, resetActiveElements, addTrack, removeTrack, reorderTracks } from "@/app/store/slices/projectSlice";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import Image from "next/image";
import Header from "./Header";
import VideoTimeline from "./elements-timeline/VideoTimeline";
import ImageTimeline from "./elements-timeline/ImageTimeline";
import AudioTimeline from "./elements-timeline/AudioTimeline";
import TextTimeline from "./elements-timeline/TextTimeline";
import { throttle } from 'lodash';
import GlobalKeyHandlerProps from "../../../components/editor/keys/GlobalKeyHandlerProps";
import toast from "react-hot-toast";
import { MediaFile, TextElement, Track, TrackType } from "@/app/types";

const trackTypeIcons = {
    video: { src: "/icons/video.svg", alt: "Video" },
    audio: { src: "/icons/music.svg", alt: "Audio" },
    image: { src: "/icons/image.svg", alt: "Image" },
    text: { src: "/icons/text.svg", alt: "Text" },
};

export const Timeline = () => {
    const { currentTime, timelineZoom, enableMarkerTracking, activeElements, mediaFiles, textElements, duration, isPlaying, isSnappingEnabled, activeGap, tracks, draggingElement, dragOverTrackId } = useAppSelector((state) => state.projectState);
    const dispatch = useDispatch();
    const timelineRef = useRef<HTMLDivElement>(null);
    const wasDragging = useRef(false);
    const [isDraggingMarker, setIsDraggingMarker] = useState(false);
    const [dragStartX, setDragStartX] = useState(0);
    const [initialTime, setInitialTime] = useState(0);
    const [localCurrentTime, setLocalCurrentTime] = useState(currentTime);
    const prevZoomRef = useRef(timelineZoom);
    const lastDragX = useRef(0);
    const [draggingTrackId, setDraggingTrackId] = useState<string | null>(null);
    const [dragOverTrackHeaderId, setDragOverTrackHeaderId] = useState<string | null>(null);

    const animationFrameRef = useRef<number | null>(null);

    const timelineContainerWidth = useMemo(() => Math.max(duration, 60) * timelineZoom, [duration, timelineZoom]);

    const throttledZoom = useMemo(() =>
        throttle((value: number) => {
            dispatch(setTimelineZoom(value));
        }, 100),
        [dispatch]
    );

    useEffect(() => {
        if (timelineRef.current && enableMarkerTracking) {
            const markerLeft = currentTime * timelineZoom;
            const containerWidth = timelineRef.current.offsetWidth;
            timelineRef.current.scrollLeft = markerLeft - containerWidth / 2;
        }
    }, [currentTime, timelineZoom, enableMarkerTracking]);

    useEffect(() => {
        const timeline = timelineRef.current;
        if (!timeline) return;

        const oldZoom = prevZoomRef.current;
        const newZoom = timelineZoom;

        if (oldZoom === newZoom) return;

        const markerPositionPx = currentTime * oldZoom;
        const newMarkerPositionPx = currentTime * newZoom;
        const scrollOffset = newMarkerPositionPx - markerPositionPx;

        timeline.scrollLeft += scrollOffset;

        prevZoomRef.current = newZoom;
    }, [timelineZoom, currentTime]);

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
        if (activeElements.length === 0) {
            toast.error('No element selected.');
            return;
        }
    
        if (activeElements.length > 1) {
            toast.error('Cannot split multiple elements at once.');
            return;
        }
    
        const activeElement = activeElements[0];
        let elementToSplit;
        let elements;
        let setElements;
    
        if (activeElement.type === 'media') {
            elements = [...mediaFiles];
            elementToSplit = elements.find(e => e.id === activeElement.id);
            setElements = setMediaFiles;
        } else if (activeElement.type === 'text') {
            elements = [...textElements];
            elementToSplit = elements.find(e => e.id === activeElement.id);
            setElements = setTextElements;
        }
    
        if (!elementToSplit || !elements || !setElements) {
            toast.error('Selected element not found.');
            return;
        }
    
        const { positionStart, positionEnd } = elementToSplit;
    
        if (currentTime <= positionStart || currentTime >= positionEnd) {
            toast.error('Marker is outside the selected element bounds.');
            return;
        }
    
        const activeElementIndex = elements.findIndex(e => e.id === activeElement.id);
    
        if (activeElement.type === 'media') {
            const mediaElement = elementToSplit as MediaFile;
            const positionDuration = positionEnd - positionStart;
            const { startTime, endTime } = mediaElement;
            const sourceDuration = endTime - startTime;
            const ratio = (currentTime - positionStart) / positionDuration;
            const splitSourceOffset = startTime + ratio * sourceDuration;
    
            const firstPart: MediaFile = {
                ...mediaElement,
                id: crypto.randomUUID(),
                positionStart,
                positionEnd: currentTime,
                startTime,
                endTime: splitSourceOffset
            };
    
            const secondPart: MediaFile = {
                ...mediaElement,
                id: crypto.randomUUID(),
                positionStart: currentTime,
                positionEnd,
                startTime: splitSourceOffset,
                endTime
            };
            (elements as MediaFile[]).splice(activeElementIndex, 1, firstPart, secondPart);
        } else { // Text element
            const textElement = elementToSplit as TextElement;
            const firstPart: TextElement = {
                ...textElement,
                id: crypto.randomUUID(),
                positionStart,
                positionEnd: currentTime,
            };
    
            const secondPart: TextElement = {
                ...textElement,
                id:crypto.randomUUID(),
                positionStart: currentTime,
                positionEnd,
            };
            (elements as TextElement[]).splice(activeElementIndex, 1, firstPart, secondPart);
        }
    
        if (activeElement.type === 'media') {
            dispatch(setMediaFiles(elements as MediaFile[]));
        } else {
            dispatch(setTextElements(elements as TextElement[]));
        }
        dispatch(resetActiveElements());
        toast.success('Element split successfully.');
    };

    const handleDuplicate = () => {
        if (activeElements.length === 0) {
            toast.error('No element selected.');
            return;
        }
    
        let newMediaFiles = [...mediaFiles];
        let newTextElements = [...textElements];
    
        activeElements.forEach(activeElement => {
            if (activeElement.type === 'media') {
                const elementToDuplicate = newMediaFiles.find(e => e.id === activeElement.id);
                if (elementToDuplicate) {
                    const duplicatedElement = { ...elementToDuplicate, id: crypto.randomUUID() };
                    const index = newMediaFiles.findIndex(e => e.id === activeElement.id);
                    newMediaFiles.splice(index + 1, 0, duplicatedElement);
                }
            } else if (activeElement.type === 'text') {
                const elementToDuplicate = newTextElements.find(e => e.id === activeElement.id);
                if (elementToDuplicate) {
                    const duplicatedElement = { ...elementToDuplicate, id: crypto.randomUUID() };
                    const index = newTextElements.findIndex(e => e.id === activeElement.id);
                    newTextElements.splice(index + 1, 0, duplicatedElement);
                }
            }
        });
    
        dispatch(setMediaFiles(newMediaFiles));
        dispatch(setTextElements(newTextElements));
        dispatch(resetActiveElements());
        toast.success('Element(s) duplicated successfully.');
    };

    const handleDelete = () => {
        if (activeElements.length === 0 && activeGap) {
            const { start, end, trackType } = activeGap;
            const gapDuration = end - start;
    
            if (trackType === 'video' || trackType === 'audio' || trackType === 'image') {
                const updatedMediaFiles = mediaFiles.map(file => {
                    if (file.type === trackType && file.positionStart >= end) {
                        return {
                            ...file,
                            positionStart: file.positionStart - gapDuration,
                            positionEnd: file.positionEnd - gapDuration,
                        };
                    }
                    return file;
                });
                dispatch(setMediaFiles(updatedMediaFiles));
            } else if (trackType === 'text') {
                const updatedTextElements = textElements.map(text => {
                    if (text.positionStart >= end) {
                        return {
                            ...text,
                            positionStart: text.positionStart - gapDuration,
                            positionEnd: text.positionEnd - gapDuration,
                        };
                    }
                    return text;
                });
                dispatch(setTextElements(updatedTextElements));
            }
            
            dispatch(resetActiveElements());
            toast.success('Gap deleted.');
            return;
        }
    
        if (activeElements.length === 0) {
            toast.error('No element selected.');
            return;
        }
    
        const mediaIdsToDelete = new Set(activeElements.filter(el => el.type === 'media').map(el => el.id));
        const textIdsToDelete = new Set(activeElements.filter(el => el.type === 'text').map(el => el.id));
    
        const updatedMediaFiles = mediaFiles.filter(file => !mediaIdsToDelete.has(file.id));
        const updatedTextElements = textElements.filter(text => !textIdsToDelete.has(text.id));
    
        dispatch(setMediaFiles(updatedMediaFiles));
        dispatch(setTextElements(updatedTextElements));
        dispatch(resetActiveElements());
        toast.success('Element(s) deleted successfully.');
    };

    const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target !== e.currentTarget) {
            return;
        }
        if (wasDragging.current) {
            return;
        }
        if (timelineRef.current) {
            const rect = timelineRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const scrollLeft = timelineRef.current.scrollLeft;
            const time = (x + scrollLeft) / timelineZoom;
            dispatch(setCurrentTime(Math.max(0, time)));
            dispatch(resetActiveElements());
        }
    };

    const handleDragStart = (e: React.MouseEvent) => {
        wasDragging.current = false;
        setIsDraggingMarker(true);
        setDragStartX(e.clientX);
        lastDragX.current = e.clientX;

        if (timelineRef.current) {
            const rect = timelineRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const scrollLeft = timelineRef.current.scrollLeft;
            const time = (x + scrollLeft) / timelineZoom;
            const newTime = Math.max(0, time);

            setInitialTime(newTime);
            setLocalCurrentTime(newTime);
            smoothTimeUpdate(newTime);
        } else {
            setInitialTime(currentTime);
        }

        if (isPlaying) {
            dispatch(setIsPlaying(false));
        }
    };

    const handleDragMove = useCallback((e: MouseEvent) => {
        if (!isDraggingMarker) return;

        wasDragging.current = true;

        if (enableMarkerTracking) {
            const dx = e.clientX - lastDragX.current;
            const dt = dx / timelineZoom;
            const newTime = Math.max(0, localCurrentTime + dt);

            lastDragX.current = e.clientX;

            setLocalCurrentTime(newTime);
            smoothTimeUpdate(newTime);
        } else {
            const deltaX = e.clientX - dragStartX;
            const deltaTime = deltaX / timelineZoom;
            const newTime = Math.max(0, initialTime + deltaTime);

            setLocalCurrentTime(newTime);
            smoothTimeUpdate(newTime);
        }
    }, [isDraggingMarker, dragStartX, timelineZoom, initialTime, smoothTimeUpdate, enableMarkerTracking, localCurrentTime]);

    const handleDragEnd = useCallback(() => {
        setIsDraggingMarker(false);
    }, []);

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

    const handleAddTrack = (type: TrackType) => {
        dispatch(addTrack(type));
        toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} track added.`);
    }

    const handleTrackDragStart = (e: React.DragEvent<HTMLDivElement>, trackId: string) => {
        setDraggingTrackId(trackId);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleTrackDragOver = (e: React.DragEvent<HTMLDivElement>, trackId: string) => {
        e.preventDefault();
        if (draggingTrackId && draggingTrackId !== trackId) {
            setDragOverTrackHeaderId(trackId);
        }
    };

    const handleTrackDrop = (e: React.DragEvent<HTMLDivElement>, dropTrackId: string) => {
        e.preventDefault();
        if (draggingTrackId && draggingTrackId !== dropTrackId) {
            dispatch(reorderTracks({ draggingTrackId, dropTrackId }));
        }
        setDraggingTrackId(null);
        setDragOverTrackHeaderId(null);
    };

    return (
        <div className="flex w-full flex-col">
            {/* Unified Control Header */}
            <div className="flex flex-row items-center justify-between w-full px-4 py-2 bg-[#28272C]">
                {/* Left Group: Add Track Buttons */}
                <div className="flex items-center gap-2">
                    <button onClick={() => handleAddTrack('video')} className="bg-gray-700 text-white px-3 py-1.5 text-xs rounded-md hover:bg-gray-600 transition-colors">Add Video</button>
                    <button onClick={() => handleAddTrack('audio')} className="bg-gray-700 text-white px-3 py-1.5 text-xs rounded-md hover:bg-gray-600 transition-colors">Add Audio</button>
                    <button onClick={() => handleAddTrack('image')} className="bg-gray-700 text-white px-3 py-1.5 text-xs rounded-md hover:bg-gray-600 transition-colors">Add Image</button>
                    <button onClick={() => handleAddTrack('text')} className="bg-gray-700 text-white px-3 py-1.5 text-xs rounded-md hover:bg-gray-600 transition-colors">Add Text</button>
                </div>

                {/* Center Group: Editing Tools */}
                <div className="flex items-center gap-2">
                    {/* Split */}
                    <button
                        onClick={handleSplit}
                        className="bg-white border rounded-md border-transparent transition-colors flex flex-row items-center justify-center text-gray-800 hover:bg-[#ccc] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-auto px-2 py-1 sm:w-auto"
                    >
                        <Image
                            alt="cut"
                            className="h-auto w-auto max-w-[20px] max-h-[20px]"
                            height={30}
                            width={30}
                            src="/icons/cut.svg"
                        />
                        <span className="ml-2 hidden sm:inline">Split <span className="text-xs">(S)</span></span>
                    </button>
                    {/* Duplicate */}
                    <button
                        onClick={handleDuplicate}
                        className="bg-white border rounded-md border-transparent transition-colors flex flex-row items-center justify-center text-gray-800 hover:bg-[#ccc] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-auto px-2 py-1 sm:w-auto"
                    >
                        <Image
                            alt="duplicate"
                            className="h-auto w-auto max-w-[20px] max-h-[20px]"
                            height={30}
                            width={30}
                            src="/icons/duplicate.svg"
                        />
                        <span className="ml-2 hidden sm:inline">Duplicate <span className="text-xs">(D)</span></span>
                    </button>
                    {/* Delete */}
                    <button
                        onClick={handleDelete}
                        className="bg-white border rounded-md border-transparent transition-colors flex flex-row items-center justify-center text-gray-800 hover:bg-[#ccc] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-auto px-2 py-1 sm:w-auto"
                    >
                        <Image
                            alt="Delete"
                            className="h-auto w-auto max-w-[20px] max-h-[20px]"
                            height={30}
                            width={30}
                            src="/icons/delete-1487.svg"
                        />
                        <span className="ml-2 hidden sm:inline">Delete <span className="text-xs">(Del)</span></span>
                    </button>
                </div>

                {/* Right Group: Timeline Settings */}
                <div className="flex items-center gap-4">
                    {/* Track Marker */}
                    <div className="relative group">
                         <button
                            onClick={() => dispatch(setMarkerTrack(!enableMarkerTracking))}
                            className={`${
                                enableMarkerTracking 
                                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/25' 
                                    : 'bg-white border-transparent text-gray-800 hover:bg-[#ccc]'
                            } border rounded-md transition-all duration-200 flex flex-row items-center justify-center dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-auto px-2 py-1 sm:w-auto`}
                        >
                            <Image
                                alt="Marker Tracking"
                                className="h-auto w-auto max-w-[20px] max-h-[20px]"
                                height={30}
                                width={30}
                                src="/icons/yes-alt.svg"
                            />
                        </button>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap border border-gray-700">
                           <div className="font-semibold">{enableMarkerTracking ? 'Marker Tracking: ON' : 'Marker Tracking: OFF'}</div>
                        </div>
                    </div>
                     {/* Snap Mode */}
                    <div className="relative group">
                        <button
                            onClick={() => dispatch(setSnapMode(!isSnappingEnabled))}
                            className={`${
                                isSnappingEnabled
                                    ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/25'
                                    : 'bg-white border-transparent text-gray-800 hover:bg-[#ccc]'
                            } border rounded-md transition-all duration-200 flex flex-row items-center justify-center dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-auto px-2 py-1 sm:w-auto`}
                        >
                            <Image
                                alt="Snap Mode"
                                className="h-auto w-auto max-w-[20px] max-h-[20px]"
                                height={30}
                                width={30}
                                src="/icons/magnet.svg"
                            />
                        </button>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap border border-gray-700">
                             <div className="font-semibold">{isSnappingEnabled ? 'Snap Mode: ON' : 'Snap Mode: OFF'}</div>
                        </div>
                    </div>
                    {/* Timeline Zoom */}
                    <div className="flex flex-row items-center gap-2">
                        <label className="block text-sm font-semibold text-white">Zoom</label>
                        <input
                            type="range"
                            min={1}
                            max={1000}
                            step="1"
                            value={timelineZoom}
                            onChange={(e) => throttledZoom(Number(e.target.value))}
                            className="w-[100px] bg-darkSurfacePrimary border border-white border-opacity-10 shadow-md text-white rounded focus:outline-none focus:border-white-500"
                        />
                    </div>
                </div>
            </div>

            <div className="flex w-full">
                {/* Fixed Left Panel for Track Headers */}
                <div className="w-36 flex-shrink-0 bg-[#28272C] z-20">
                    <div className="h-10 border-b border-gray-800">
                        {/* This space aligns with the timeline Header */}
                    </div>
                    {tracks.map((track: Track) => {
                        const icon = trackTypeIcons[track.type];
                        return (
                            <div 
                                key={track.id} 
                                draggable="true"
                                onDragStart={(e) => handleTrackDragStart(e, track.id)}
                                onDragOver={(e) => handleTrackDragOver(e, track.id)}
                                onDrop={(e) => handleTrackDrop(e, track.id)}
                                onDragLeave={() => setDragOverTrackHeaderId(null)}
                                onDragEnd={() => { setDraggingTrackId(null); setDragOverTrackHeaderId(null); }}
                                className={`group relative h-20 flex flex-col items-center justify-center p-2 border-b border-gray-700 cursor-grab ${draggingTrackId === track.id ? 'opacity-50' : ''} ${dragOverTrackHeaderId === track.id ? 'bg-blue-500 bg-opacity-30' : ''}`}
                            >
                                {icon && (
                                    <Image
                                        src={icon.src}
                                        alt={icon.alt}
                                        width={24}
                                        height={24}
                                        className="mb-1 invert"
                                    />
                                )}
                                <span className="text-white text-sm font-semibold truncate">{track.name}</span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        dispatch(removeTrack(track.id));
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className="absolute top-1 right-1 z-10 p-1 rounded-full text-white bg-black bg-opacity-30 opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all duration-200"
                                    aria-label="Remove track"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                </button>
                            </div>
                        )
                    })}
                </div>

                {/* Scrollable Right Panel for Timeline Content */}
                <div
                    className="relative overflow-x-auto w-full bg-[#1E1D21] z-10"
                    ref={timelineRef}
                >
                    <div
                        onClick={(e) => {
                            if (e.target === e.currentTarget) {
                                handleTimelineClick(e);
                            }
                        }}
                        className="h-10 border-b border-gray-800"
                        style={{ width: `${timelineContainerWidth}px` }}
                    >
                        <Header onDragStart={handleDragStart} />
                    </div>

                    <div className="bg-[#1E1D21]" style={{ width: `${timelineContainerWidth}px` }}>
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
                        
                        <div className="w-full h-full relative">
                            {tracks.map((track: Track, index) => {
                                const totalTracks = tracks.length;
                                const component = (() => {
                                    switch (track.type) {
                                        case 'video':
                                            return <VideoTimeline trackId={track.id} trackIndex={index} totalTracks={totalTracks} />;
                                        case 'audio':
                                            return <AudioTimeline trackId={track.id} trackIndex={index} totalTracks={totalTracks} />;
                                        case 'image':
                                            return <ImageTimeline trackId={track.id} trackIndex={index} totalTracks={totalTracks} />;
                                        case 'text':
                                            return <TextTimeline trackId={track.id} trackIndex={index} totalTracks={totalTracks} />;
                                        default:
                                            return null;
                                    }
                                })();

                                const isOver = dragOverTrackId === track.id;
                                let canDrop = false;
                                if (draggingElement) {
                                    const { clip, elementType } = draggingElement;
                                    const clipType = elementType === 'media' ? (clip as MediaFile).type : 'text';
                                    canDrop = clipType === track.type;
                                }

                                return (
                                    <div 
                                        key={track.id} 
                                        data-track-id={track.id}
                                        className={`relative h-20 border-b border-gray-700 transition-colors duration-200 ${isOver && canDrop ? 'bg-green-500 bg-opacity-20' : ''}`}
                                    >
                                        <div className="relative h-full flex-grow flex items-center">
                                            {component}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
            <GlobalKeyHandlerProps handleDuplicate={handleDuplicate} handleSplit={handleSplit} handleDelete={handleDelete} />
        </div>
    );
};

export default memo(Timeline)