import React, { useRef, useCallback, useMemo } from "react";
import Moveable, { OnScale, OnDrag, OnResize, OnRotate } from "react-moveable";
import { useAppSelector } from "@/app/store";
import { setActiveElement, setActiveElementIndex, setMediaFiles } from "@/app/store/slices/projectSlice";
import { memo, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import Image from "next/image";
import Header from "../Header";
import { MediaFile } from "@/app/types";
import { debounce, throttle } from "lodash";

export default function AudioTimeline() {
    const targetRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const { mediaFiles, textElements, activeElement, activeElementIndex, timelineZoom } = useAppSelector((state) => state.projectState);
    const dispatch = useDispatch();
    const moveableRef = useRef<Record<string, Moveable | null>>({});

    // Minimum duration in seconds to prevent clips from becoming too small
    const MIN_DURATION = 0.1;

    // TODO: this is a hack to prevent the mediaFiles from being updated too often while dragging or resizing
    const mediaFilesRef = useRef(mediaFiles);
    useEffect(() => {
        mediaFilesRef.current = mediaFiles;
    }, [mediaFiles]);

    // More aggressive throttling for smooth performance
    const onUpdateMedia = useMemo(() =>
        throttle((id: string, updates: Partial<MediaFile>) => {
            const currentFiles = mediaFilesRef.current;
            const updated = currentFiles.map(media =>
                media.id === id ? { ...media, ...updates } : media
            );
            dispatch(setMediaFiles(updated));
        }, 16), [dispatch]
    );

    // Debounced update for final position
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
            // TODO: cause we pass id when media to find the right index i will change this later (this happens cause each timeline pass its index not index from mediaFiles array)
            const actualIndex = mediaFiles.findIndex(clip => clip.id === index as unknown as string);
            dispatch(setActiveElementIndex(actualIndex));
        }
    };

    const handleDrag = useCallback((clip: MediaFile, target: HTMLElement, left: number) => {
        // no negative left
        const constrainedLeft = Math.max(left, 0);
        const newPositionStart = constrainedLeft / timelineZoom;
        const duration = clip.positionEnd - clip.positionStart;
        
        // Update visual immediately
        target.style.left = `${constrainedLeft}px`;
        
        // Throttled state update
        onUpdateMedia(clip.id, {
            positionStart: newPositionStart,
            positionEnd: newPositionStart + duration,
        });
    }, [timelineZoom, onUpdateMedia]);

    const handleRightResize = useCallback((clip: MediaFile, target: HTMLElement, width: number) => {
        const newDuration = width / timelineZoom;
        const newPositionEnd = clip.positionStart + Math.max(newDuration, MIN_DURATION);
        
        // Calculate new endTime for audio trimming
        const sourceDuration = clip.endTime - clip.startTime;
        const newSourceDuration = Math.min(newDuration, sourceDuration);
        const newEndTime = clip.startTime + newSourceDuration;

        // Update visual immediately
        target.style.width = `${width}px`;

        // Throttled state update
        onUpdateMedia(clip.id, {
            positionEnd: newPositionEnd,
            endTime: Math.max(newEndTime, clip.startTime + MIN_DURATION)
        });
    }, [timelineZoom, onUpdateMedia, MIN_DURATION]);

    const handleLeftResize = useCallback((clip: MediaFile, target: HTMLElement, width: number, delta: number[]) => {
        // Calculate new position based on delta change
        const currentLeft = parseFloat(target.style.left) || (clip.positionStart * timelineZoom);
        const newLeft = Math.max(0, currentLeft + delta[0]);
        const newPositionStart = newLeft / timelineZoom;
        
        // Ensure minimum duration
        const maxPositionStart = clip.positionEnd - MIN_DURATION;
        const constrainedPositionStart = Math.min(newPositionStart, maxPositionStart);
        
        // Calculate how much we're trimming from the start
        const trimAmount = constrainedPositionStart - clip.positionStart;
        const sourceDuration = clip.endTime - clip.startTime;
        const currentDuration = clip.positionEnd - clip.positionStart;
        
        // Calculate new startTime based on trim ratio
        let newStartTime = clip.startTime;
        if (currentDuration > 0 && trimAmount > 0) {
            const trimRatio = trimAmount / currentDuration;
            newStartTime = Math.min(clip.startTime + (sourceDuration * trimRatio), clip.endTime - MIN_DURATION);
        }

        // Update visual position and width immediately
        const newWidth = (clip.positionEnd - constrainedPositionStart) * timelineZoom;
        target.style.left = `${constrainedPositionStart * timelineZoom}px`;
        target.style.width = `${newWidth}px`;

        // Throttled state update
        onUpdateMedia(clip.id, {
            positionStart: constrainedPositionStart,
            startTime: newStartTime,
        });
    }, [timelineZoom, onUpdateMedia, MIN_DURATION]);

    useEffect(() => {
        for (const clip of mediaFiles) {
            moveableRef.current[clip.id]?.updateRect();
        }
    }, [timelineZoom]);

    return (
        <div >
            {mediaFiles
                .filter(clip => clip.type === 'audio')
                .map((clip) => (
                    <div key={clip.id} className="bg-green-500">
                        <div
                            key={clip.id}
                            ref={(el: HTMLDivElement | null) => {
                                if (el) {
                                    targetRefs.current[clip.id] = el;
                                }
                            }}
                            onClick={() => handleClick('media', clip.id)}
                            className={`absolute border border-gray-500 border-opacity-50 rounded-md top-2 h-12 rounded bg-[#27272A] text-white text-sm flex items-center justify-center cursor-pointer ${activeElement === 'media' && mediaFiles[activeElementIndex].id === clip.id ? 'bg-[#3F3F46] border-blue-500' : ''}`}
                            style={{
                                left: `${clip.positionStart * timelineZoom}px`,
                                width: `${(clip.positionEnd - clip.positionStart) * timelineZoom}px`,
                                zIndex: clip.zIndex,
                                transition: 'none', // Remove CSS transition to prevent conflicts
                            }}
                        >
                            {/* <MoveableTimeline /> */}
                            <Image
                                alt="Audio"
                                className="h-7 w-7 min-w-6 mr-2 flex-shrink-0"
                                height={30}
                                width={30}
                                src="https://www.svgrepo.com/show/532708/music.svg"
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
                            renderDirections={activeElement === 'media' && mediaFiles[activeElementIndex].id === clip.id ? ['w', 'e'] : []}
                            draggable={true}
                            throttleDrag={0}
                            rotatable={false}
                            onDragStart={({ target, clientX, clientY }) => {
                            }}
                            onDrag={({
                                target,
                                beforeDelta, beforeDist,
                                left,
                                right,
                                delta, dist,
                                transform,
                            }: OnDrag) => {
                                handleClick('media', clip.id)
                                handleDrag(clip, target as HTMLElement, left);
                            }}
                            onDragEnd={({ target, isDrag, clientX, clientY }) => {
                                // Final position update
                                const currentLeft = parseFloat((target as HTMLElement).style.left) || 0;
                                const newPositionStart = currentLeft / timelineZoom;
                                const duration = clip.positionEnd - clip.positionStart;
                                
                                finalUpdateMedia(clip.id, {
                                    positionStart: newPositionStart,
                                    positionEnd: newPositionStart + duration,
                                });
                            }}

                            /* resizable*/
                            resizable={true}
                            throttleResize={0}
                            onResizeStart={({ target, clientX, clientY }) => {
                            }}
                            onResize={({
                                target, width, height,
                                delta, direction,
                            }: OnResize) => {
                                handleClick('media', clip.id);
                                
                                if (direction[0] === 1) {
                                    // Right resize
                                    handleRightResize(clip, target as HTMLElement, width);
                                }
                                else if (direction[0] === -1) {
                                    // Left resize
                                    handleLeftResize(clip, target as HTMLElement, width, delta);
                                }
                            }}
                            onResizeEnd={({ target, isDrag, clientX, clientY }) => {
                                // Final position update after resize
                                const currentLeft = parseFloat((target as HTMLElement).style.left) || 0;
                                const currentWidth = parseFloat((target as HTMLElement).style.width) || 0;
                                const newPositionStart = currentLeft / timelineZoom;
                                const newDuration = currentWidth / timelineZoom;
                                const newPositionEnd = newPositionStart + newDuration;
                                
                                // Ensure minimum duration
                                const constrainedPositionStart = Math.max(0, newPositionStart);
                                const constrainedPositionEnd = Math.max(constrainedPositionStart + MIN_DURATION, newPositionEnd);
                                
                                // Calculate trimming for source audio
                                const originalDuration = clip.positionEnd - clip.positionStart;
                                const newClipDuration = constrainedPositionEnd - constrainedPositionStart;
                                const sourceDuration = clip.endTime - clip.startTime;
                                
                                // Calculate start time offset if position changed
                                const positionChange = constrainedPositionStart - clip.positionStart;
                                let newStartTime = clip.startTime;
                                let newEndTime = clip.endTime;
                                
                                if (positionChange !== 0 && originalDuration > 0) {
                                    // Left resize - trim from start
                                    const trimRatio = Math.abs(positionChange) / originalDuration;
                                    newStartTime = clip.startTime + (sourceDuration * trimRatio);
                                }
                                
                                // Adjust end time based on duration
                                if (newClipDuration !== originalDuration) {
                                    const durationRatio = newClipDuration / originalDuration;
                                    const availableSourceDuration = clip.endTime - newStartTime;
                                    newEndTime = newStartTime + Math.min(newClipDuration, availableSourceDuration);
                                }

                                finalUpdateMedia(clip.id, {
                                    positionStart: constrainedPositionStart,
                                    positionEnd: constrainedPositionEnd,
                                    startTime: Math.max(0, newStartTime),
                                    endTime: Math.max(newStartTime + MIN_DURATION, newEndTime)
                                });
                            }}
                        />
                    </div>

                ))}
        </div>
    );
}
