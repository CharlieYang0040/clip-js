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

export default function ImageTimeline() {
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

        // Update visual immediately
        target.style.width = `${width}px`;

        // For images, just update the end time to match position
        onUpdateMedia(clip.id, {
            positionEnd: newPositionEnd,
            endTime: newPositionEnd,
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

        // Update visual position and width immediately
        const newWidth = (clip.positionEnd - constrainedPositionStart) * timelineZoom;
        target.style.left = `${constrainedPositionStart * timelineZoom}px`;
        target.style.width = `${newWidth}px`;

        // For images, we don't need complex startTime/endTime calculations
        // Just update the position
        onUpdateMedia(clip.id, {
            positionStart: constrainedPositionStart,
            startTime: constrainedPositionStart,
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
                .filter(clip => clip.type === 'image')
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
                                alt="Image"
                                className="h-7 w-7 min-w-6 mr-2 flex-shrink-0"
                                height={30}
                                width={30}
                                src="https://www.svgrepo.com/show/535454/image.svg"
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
                                delta, direction, drag
                            }: OnResize) => {
                                handleClick('media', clip.id);

                                if (direction[0] === 1) {
                                    // Right resize
                                    handleRightResize(clip, target as HTMLElement, width);
                                }
                                else if (direction[0] === -1) {
                                    // Left resize
                                    handleLeftResize(clip, target as HTMLElement, width, drag.delta);
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

                                // For images, simple duration adjustment
                                finalUpdateMedia(clip.id, {
                                    positionStart: constrainedPositionStart,
                                    positionEnd: constrainedPositionEnd,
                                    startTime: constrainedPositionStart,
                                    endTime: constrainedPositionEnd,
                                });
                            }}
                            className={activeElement === 'media' && mediaFiles[activeElementIndex].id === clip.id ? '' : 'moveable-control-box-hidden'}

                        />
                    </div>

                ))}
        </div>
    );
}
