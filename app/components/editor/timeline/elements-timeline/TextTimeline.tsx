import React, { useRef, useCallback, useMemo } from "react";
import Moveable, { OnScale, OnDrag, OnResize, OnRotate } from "react-moveable";
import { useAppSelector } from "@/app/store";
import { setActiveElement, setActiveElementIndex, setTextElements, updateTextElements_INTERNAL, setActiveGap } from "@/app/store/slices/projectSlice";
import { memo, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import Image from "next/image";
import Header from "../Header";
import { MediaFile, TextElement } from "@/app/types";
import { debounce, throttle } from "lodash";

const SNAP_THRESHOLD = 5; // in pixels
const MIN_DURATION = 0.1;

export default function TextTimeline() {
    const targetRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const { mediaFiles, textElements, activeElement, activeElementIndex, timelineZoom, isSnappingEnabled, activeGap } = useAppSelector((state) => state.projectState);
    const dispatch = useDispatch();
    const moveableRef = useRef<Record<string, Moveable | null>>({});

    const textElementsRef = useRef(textElements);
    useEffect(() => {
        textElementsRef.current = textElements;
    }, [textElements]);

    const sortedTextElements = useMemo(() =>
        [...textElements].sort((a, b) => a.positionStart - b.positionStart),
        [textElements]
    );

    const gaps = useMemo(() => {
        const calculatedGaps: { start: number, end: number }[] = [];
        let lastEnd = 0;
        for (const element of sortedTextElements) {
            if (element.positionStart > lastEnd) {
                calculatedGaps.push({ start: lastEnd, end: element.positionStart });
            }
            lastEnd = Math.max(lastEnd, element.positionEnd);
        }
        return calculatedGaps;
    }, [sortedTextElements]);

    const getSnapPoints = useCallback((excludeId: string) => {
        if (!isSnappingEnabled) return [];
        const points: number[] = [];
        mediaFiles.forEach(clip => {
            points.push(clip.positionStart, clip.positionEnd);
        });
        textElements.forEach(text => {
            if (text.id !== excludeId) {
                points.push(text.positionStart, text.positionEnd);
            }
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


    const onUpdateText = useMemo(() =>
        throttle((id: string, updates: Partial<TextElement>) => {
            const currentFiles = textElementsRef.current;
            const updated = currentFiles.map(text =>
                text.id === id ? { ...text, ...updates } : text
            );
            dispatch(updateTextElements_INTERNAL(updated));
        }, 100), [dispatch]
    );

    const finalUpdateText = useMemo(() =>
        debounce((id: string, updates: Partial<TextElement>) => {
            const currentFiles = textElementsRef.current;
            const updated = currentFiles.map(text =>
                text.id === id ? { ...text, ...updates } : text
            );
            dispatch(setTextElements(updated));
        }, 50), [dispatch]
    );

    const handleClick = (element: string, index: number | string) => {
        if (element === 'text') {
            dispatch(setActiveElement('text') as any);
            const actualIndex = textElements.findIndex(clip => clip.id === index as unknown as string);
            dispatch(setActiveElementIndex(actualIndex));
        }
    };

    const handleGapClick = (gap: { start: number, end: number }, e: React.MouseEvent) => {
        e.stopPropagation();
        dispatch(setActiveElement('gap'));
        dispatch(setActiveGap({ ...gap, trackType: 'text' }));
    };

    const handleDrag = (clip: TextElement, target: HTMLElement, left: number) => {
        if (!isSnappingEnabled) {
            const constrainedLeft = Math.max(left, 0);
            const newPositionStart = constrainedLeft / timelineZoom;
            onUpdateText(clip.id, {
                positionStart: newPositionStart,
                positionEnd: (newPositionStart - clip.positionStart) + clip.positionEnd,
            })
    
            target.style.left = `${constrainedLeft}px`;
            return;
        }

        const snapPointsPx = getSnapPoints(clip.id).map(p => p * timelineZoom);
        const durationPx = (clip.positionEnd - clip.positionStart) * timelineZoom;

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
        const newPositionStart = constrainedLeft / timelineZoom;
        const duration = clip.positionEnd - clip.positionStart;
        
        target.style.left = `${constrainedLeft}px`;
        
        onUpdateText(clip.id, {
            positionStart: newPositionStart,
            positionEnd: newPositionStart + duration,
        });
    };

    const handleRightResize = (clip: TextElement, target: HTMLElement, width: number) => {
        const snapPoints = getSnapPoints(clip.id);
        const newWidth = getSnapPosition(clip.positionStart * timelineZoom + width, snapPoints.map(p => p * timelineZoom)) - (clip.positionStart * timelineZoom);

        const newDuration = newWidth / timelineZoom;
        const newPositionEnd = clip.positionStart + Math.max(newDuration, MIN_DURATION);

        onUpdateText(clip.id, {
            positionEnd: newPositionEnd,
        })
        target.style.width = `${newWidth}px`;
    };

    const handleLeftResize = (clip: TextElement, target: HTMLElement, width: number, delta: number) => {
        const snapPoints = getSnapPoints(clip.id);
        const currentLeftPx = clip.positionStart * timelineZoom;
        let newLeftPx = currentLeftPx + delta;

        newLeftPx = getSnapPosition(newLeftPx, snapPoints.map(p => p * timelineZoom));

        const constrainedLeftPx = Math.max(0, newLeftPx);
        const newPositionStart = constrainedLeftPx / timelineZoom;

        const maxPositionStart = clip.positionEnd - MIN_DURATION;
        const constrainedPositionStart = Math.min(newPositionStart, maxPositionStart);

        const newWidth = (clip.positionEnd - constrainedPositionStart) * timelineZoom;

        onUpdateText(clip.id, {
            positionStart: constrainedPositionStart,
        });

        target.style.left = `${constrainedPositionStart * timelineZoom}px`;
        target.style.width = `${newWidth}px`;
    };

    useEffect(() => {
        for (const clip of textElements) {
            moveableRef.current[clip.id]?.updateRect();
        }
    }, [timelineZoom, textElements]);

    return (
        <div className="relative h-full">
            {gaps.map((gap, index) => (
                <div
                    key={`gap-text-${index}`}
                    className={`absolute top-0 h-full z-0 ${activeElement === 'gap' && activeGap?.trackType === 'text' && activeGap?.start === gap.start ? 'bg-yellow-500 bg-opacity-30 border-2 border-yellow-500' : 'hover:bg-gray-500 hover:bg-opacity-20'}`}
                    style={{
                        left: `${gap.start * timelineZoom}px`,
                        width: `${(gap.end - gap.start) * timelineZoom}px`,
                    }}
                    onClick={(e) => handleGapClick(gap, e)}
                />
            ))}
            {sortedTextElements.map((clip, index) => (
                <div key={clip.id} className="relative z-10">
                    <div
                        key={clip.id}
                        ref={(el: HTMLDivElement | null) => {
                            if (el) {
                                targetRefs.current[clip.id] = el;
                            }
                        }}
                        onClick={(e) => { e.stopPropagation(); handleClick('text', clip.id); }}
                        className={`absolute border border-gray-500 border-opacity-50 rounded-md top-2 h-12 rounded bg-[#27272A] text-white text-sm flex items-center justify-center cursor-pointer ${activeElement === 'text' && textElements[activeElementIndex]?.id === clip.id ? 'bg-[#3F3F46] border-blue-500' : ''}`}
                        style={{
                            left: `${clip.positionStart * timelineZoom}px`,
                            width: `${(clip.positionEnd - clip.positionStart) * timelineZoom}px`,
                            zIndex: clip.zIndex,
                        }}
                    >
                        <Image
                            alt="Text"
                            className="h-7 w-7 min-w-6 mr-2 flex-shrink-0"
                            height={30}
                            width={30}
                            src="https://www.svgrepo.com/show/535686/text.svg"
                        />
                        <span className="truncate text-x">{clip.text}</span>

                    </div>

                    <Moveable
                        ref={(el: Moveable | null) => {
                            if (el) {
                                moveableRef.current[clip.id] = el;
                            }
                        }}
                        target={targetRefs.current[clip.id] || null}
                        container={null}
                        renderDirections={activeElement === 'text' && textElements[activeElementIndex] && textElements[activeElementIndex].id === clip.id ? ['w', 'e'] : []}
                        draggable={true}
                        throttleDrag={0}
                        rotatable={false}
                        onDragStart={({ target, clientX, clientY }) => {
                            handleClick('text', clip.id);
                        }}
                        onDrag={({
                            target,
                            left,
                        }: OnDrag) => {
                            handleDrag(clip, target as HTMLElement, left);
                        }}
                        onDragEnd={({ target, isDrag, clientX, clientY }) => {
                            const currentLeft = parseFloat((target as HTMLElement).style.left) || 0;
                            const newPositionStart = currentLeft / timelineZoom;
                            const duration = clip.positionEnd - clip.positionStart;
                            finalUpdateText(clip.id, {
                                positionStart: newPositionStart,
                                positionEnd: newPositionStart + duration,
                            });
                        }}

                        resizable={true}
                        throttleResize={0}
                        onResizeStart={({ target, clientX, clientY }) => {
                            handleClick('text', clip.id);
                        }}
                        onResize={({
                            target, width,
                            delta, direction, drag
                        }: OnResize) => {
                            if (direction[0] === 1) {
                                handleRightResize(clip, target as HTMLElement, width);
                            }
                            else if (direction[0] === -1) {
                                handleLeftResize(clip, target as HTMLElement, width, drag.delta[0]);
                            }
                        }}
                        onResizeEnd={({ target, isDrag, clientX, clientY }) => {
                            const currentLeft = parseFloat((target as HTMLElement).style.left) || 0;
                            const currentWidth = parseFloat((target as HTMLElement).style.width) || 0;
                            const newPositionStart = currentLeft / timelineZoom;
                            const newDuration = currentWidth / timelineZoom;
                            finalUpdateText(clip.id, {
                                positionStart: newPositionStart,
                                positionEnd: newPositionStart + newDuration,
                            });
                        }}

                    />
                </div>

            ))}
        </div>
    );
}
