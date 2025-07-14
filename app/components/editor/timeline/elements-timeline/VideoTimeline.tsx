import React, { useRef, useCallback, useMemo } from "react";
import Moveable from "react-moveable";
import { useAppSelector } from "@/app/store";
import { setActiveElement, setActiveElementIndex, setMediaFiles } from "@/app/store/slices/projectSlice";
import { memo, useEffect } from "react";
import { useDispatch } from "react-redux";
import Image from "next/image";
import Header from "../Header";
import { MediaFile } from "@/app/types";
import { debounce } from "lodash";

const SNAP_THRESHOLD = 5; // in pixels

export default function VideoTimeline() {
    const targetRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const { mediaFiles, textElements, activeElement, activeElementIndex, timelineZoom, isSnappingEnabled } = useAppSelector((state) => state.projectState);
    const dispatch = useDispatch();
    const moveableRef = useRef<Record<string, Moveable | null>>({});

    const MIN_DURATION = 0.1;

    const mediaFilesRef = useRef(mediaFiles);
    useEffect(() => {
        mediaFilesRef.current = mediaFiles;
    }, [mediaFiles]);

    const getSnapPoints = useCallback((excludeId: string) => {
        if (!isSnappingEnabled) return [];
        const points: number[] = [];
        mediaFiles.forEach(clip => {
            if (clip.id !== excludeId) {
                points.push(clip.positionStart, clip.positionEnd);
            }
        });
        textElements.forEach(text => {
            points.push(text.positionStart, text.positionEnd);
        });
        return points;
    }, [mediaFiles, textElements, isSnappingEnabled]);

    const getSnapPosition = useCallback((position: number, snapPoints: number[]) => {
        if (!isSnappingEnabled) return position;
        for (const point of snapPoints) {
            if (Math.abs(position - (point * timelineZoom)) < SNAP_THRESHOLD) {
                return point * timelineZoom;
            }
        }
        return position;
    }, [timelineZoom, isSnappingEnabled]);

    const finalUpdateMedia = useMemo(() =>
        debounce((id: string, updates: Partial<MediaFile>) => {
            const currentFiles = mediaFilesRef.current;
            const updated = currentFiles.map(media =>
                media.id === id ? { ...media, ...updates } : media
            );
            dispatch(setMediaFiles(updated));
        }, 50), [dispatch]
    );

    const handleClick = (element: string, index: number | string) => {
        if (element === 'media') {
            dispatch(setActiveElement('media') as any);
            const actualIndex = mediaFiles.findIndex(clip => clip.id === index as unknown as string);
            dispatch(setActiveElementIndex(actualIndex));
        }
    };

    const handleDrag = useCallback((target: HTMLElement, left: number) => {
        if (!isSnappingEnabled) {
            const constrainedLeft = Math.max(left, 0);
            target.style.left = `${constrainedLeft}px`;
            return;
        }

        const snapPointsPx = getSnapPoints(target.id).map(p => p * timelineZoom);
        const durationPx = target.offsetWidth;

        const startPosition = left;
        const endPosition = left + durationPx;

        let snappedLeft = left;

        let minStartDist = SNAP_THRESHOLD;
        let minEndDist = SNAP_THRESHOLD;
        let startSnapPos: number | null = null;
        let endSnapPos: number | null = null;

        for (const point of snapPointsPx) {
            const startDist = Math.abs(startPosition - point);
            if (startDist < minStartDist) {
                minStartDist = startDist;
                startSnapPos = point;
            }

            const endDist = Math.abs(endPosition - point);
            if (endDist < minEndDist) {
                minEndDist = endDist;
                endSnapPos = point;
            }
        }

        if (startSnapPos !== null && endSnapPos !== null) {
            if (minStartDist <= minEndDist) {
                snappedLeft = startSnapPos;
            } else {
                snappedLeft = endSnapPos - durationPx;
            }
        } else if (startSnapPos !== null) {
            snappedLeft = startSnapPos;
        } else if (endSnapPos !== null) {
            snappedLeft = endSnapPos - durationPx;
        }

        const constrainedLeft = Math.max(snappedLeft, 0);
        target.style.left = `${constrainedLeft}px`;
    }, [timelineZoom, getSnapPoints, isSnappingEnabled]);

    const handleRightResize = useCallback((clip: MediaFile, target: HTMLElement, width: number) => {
        if (!isSnappingEnabled) {
            target.style.width = `${width}px`;
            return;
        }

        const snapPoints = getSnapPoints(clip.id);
        const newWidth = getSnapPosition(clip.positionStart * timelineZoom + width, snapPoints.map(p => p * timelineZoom)) - (clip.positionStart * timelineZoom);
        target.style.width = `${newWidth}px`;

    }, [timelineZoom, getSnapPoints, getSnapPosition, isSnappingEnabled]);

    const handleLeftResize = useCallback((clip: MediaFile, target: HTMLElement, newLeftPx: number) => {
        if (!isSnappingEnabled) {
            const constrainedLeftPx = Math.max(0, newLeftPx);
            const newWidth = (clip.positionEnd * timelineZoom) - constrainedLeftPx;
            target.style.left = `${constrainedLeftPx}px`;
            target.style.width = `${newWidth}px`;
            return;
        }
        const snapPoints = getSnapPoints(clip.id);
        const snappedLeftPx = getSnapPosition(newLeftPx, snapPoints.map(p => p * timelineZoom));
        
        const constrainedLeftPx = Math.max(0, snappedLeftPx);
        const newWidth = (clip.positionEnd * timelineZoom) - constrainedLeftPx;

        target.style.left = `${constrainedLeftPx}px`;
        target.style.width = `${newWidth}px`;
    }, [timelineZoom, getSnapPoints, getSnapPosition, isSnappingEnabled]);

    useEffect(() => {
        for (const clip of mediaFiles) {
            moveableRef.current[clip.id]?.updateRect();
        }
    }, [timelineZoom, mediaFiles]);

    return (
        <div >
            {mediaFiles
                .filter((clip) => clip.type === 'video')
                .map((clip) => (
                    <div key={clip.id}>
                        <div
                            key={clip.id}
                            ref={(el: HTMLDivElement | null) => {
                                if (el) {
                                    targetRefs.current[clip.id] = el;
                                }
                            }}
                            onClick={(e) => { e.stopPropagation(); handleClick('media', clip.id); }}
                            className={`absolute border border-gray-500 border-opacity-50 rounded-md top-2 h-12 rounded bg-[#27272A] text-white text-sm flex items-center justify-center cursor-pointer ${activeElement === 'media' && mediaFiles[activeElementIndex]?.id === clip.id ? 'bg-[#3F3F46] border-blue-500' : ''}`}
                            style={{
                                left: `${clip.positionStart * timelineZoom}px`,
                                width: `${(clip.positionEnd - clip.positionStart) * timelineZoom}px`,
                                zIndex: clip.zIndex,
                                transition: 'none',
                            }}
                        >
                            <Image
                                alt="Video"
                                className="h-7 w-7 min-w-6 mr-2 flex-shrink-0"
                                height={30}
                                width={30}
                                src="https://www.svgrepo.com/show/532727/video.svg"
                            />
                            <span className="truncate text-x">{clip.fileName}</span>

                        </div>
                        <Moveable
                            ref={(el: Moveable | null) => {
                                if (el) {
                                    moveableRef.current[clip.id] = el;
                                }
                            }}
                            target={targetRefs.current[clip.id] || null}
                            container={null}
                            renderDirections={activeElement === 'media' && mediaFiles[activeElementIndex]?.id === clip.id ? ['w', 'e'] : []}
                            draggable={true}
                            throttleDrag={0}
                            rotatable={false}
                            onDragStart={({ target, clientX, clientY }) => {
                                handleClick('media', clip.id);
                            }}
                            onDrag={({
                                target,
                                left,
                            }) => {
                                handleDrag(target as HTMLElement, left);
                            }}
                            onDragEnd={({ target, isDrag, clientX, clientY }) => {
                                const currentLeft = parseFloat((target as HTMLElement).style.left) || 0;
                                const newPositionStart = currentLeft / timelineZoom;
                                const duration = clip.positionEnd - clip.positionStart;
                                
                                finalUpdateMedia(clip.id, {
                                    positionStart: newPositionStart,
                                    positionEnd: newPositionStart + duration,
                                });
                            }}

                            resizable={true}
                            throttleResize={0}
                            onResizeStart={({ target, clientX, clientY }) => {
                                handleClick('media', clip.id);
                            }}
                            onResize={({
                                target, width,
                                delta, direction, drag, clientX
                            }) => {

                                if (direction[0] === 1) { // Right resize
                                    handleRightResize(clip, target as HTMLElement, width);
                                }
                                else if (direction[0] === -1) { // Left resize
                                    const newLeftPx = (drag.target.style.left ? parseFloat(drag.target.style.left) : 0) + drag.delta[0];
                                    handleLeftResize(clip, target as HTMLElement, newLeftPx);
                                }
                            }}
                            onResizeEnd={({ target, isDrag, clientX, clientY }) => {
                                const currentLeft = parseFloat((target as HTMLElement).style.left) || 0;
                                const currentWidth = parseFloat((target as HTMLElement).style.width) || 0;
                                const newPositionStart = currentLeft / timelineZoom;
                                const newDuration = currentWidth / timelineZoom;
                                const newPositionEnd = newPositionStart + newDuration;
                                
                                const constrainedPositionStart = Math.max(0, newPositionStart);
                                const constrainedPositionEnd = Math.max(constrainedPositionStart + MIN_DURATION, newPositionEnd);
                                
                                const originalDuration = clip.positionEnd - clip.positionStart;
                                const newClipDuration = constrainedPositionEnd - constrainedPositionStart;
                                const sourceDuration = clip.endTime - clip.startTime;
                                
                                let newStartTime = clip.startTime;
                                let newEndTime = clip.endTime;
                                
                                if (newClipDuration < originalDuration) {
                                    if (constrainedPositionStart > clip.positionStart) { // Left resize
                                        const trimRatio = (constrainedPositionStart - clip.positionStart) / originalDuration;
                                        newStartTime = clip.startTime + (sourceDuration * trimRatio);
                                    } else { // Right resize
                                        const trimRatio = (clip.positionEnd - constrainedPositionEnd) / originalDuration;
                                        newEndTime = clip.endTime - (sourceDuration * trimRatio);
                                    }
                                }

                                finalUpdateMedia(clip.id, {
                                    positionStart: constrainedPositionStart,
                                    positionEnd: constrainedPositionEnd,
                                    startTime: newStartTime,
                                    endTime: newEndTime,
                                });
                            }}
                        />
                    </div>
                ))
            }
        </div>
    )
}
