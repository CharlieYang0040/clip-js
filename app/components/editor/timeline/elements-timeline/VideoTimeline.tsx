import React, { useRef, useCallback, useMemo, useState } from "react";
import Moveable from "react-moveable";
import { useAppSelector } from "@/app/store";
import { setMediaFiles, setActiveGap, toggleActiveElement, resetActiveElements } from "@/app/store/slices/projectSlice";
import { memo, useEffect } from "react";
import { useDispatch } from "react-redux";
import Image from "next/image";
import { MediaFile } from "@/app/types";
import { debounce } from "lodash";

const SNAP_THRESHOLD = 15; // in pixels

export default function VideoTimeline() {
    const targetRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const { mediaFiles, textElements, activeElements, timelineZoom, isSnappingEnabled, currentTime, activeGap } = useAppSelector((state) => state.projectState);
    const dispatch = useDispatch();
    const moveableRef = useRef<Record<string, Moveable | null>>({});
    const [dragStates, setDragStates] = useState<Record<string, { startX: number, startLeft: number }>>({});

    const MIN_DURATION = 0.1;

    const mediaFilesRef = useRef(mediaFiles);
    useEffect(() => {
        mediaFilesRef.current = mediaFiles;
    }, [mediaFiles]);

    const videoClips = useMemo(() =>
        mediaFiles.filter(clip => clip.type === 'video').sort((a, b) => a.positionStart - b.positionStart),
        [mediaFiles]
    );

    const gaps = useMemo(() => {
        const calculatedGaps: { start: number, end: number }[] = [];
        let lastEnd = 0;
        for (const element of videoClips) {
            if (element.positionStart > lastEnd) {
                calculatedGaps.push({ start: lastEnd, end: element.positionStart });
            }
            lastEnd = Math.max(lastEnd, element.positionEnd);
        }
        return calculatedGaps;
    }, [videoClips]);

    const verticalGuidelines = useMemo(() => {
        if (!isSnappingEnabled) return [];
    
        const points: number[] = [0, currentTime * timelineZoom];
        const draggedIds = new Set(activeElements.map(e => e.id));
    
        mediaFiles.forEach(clip => {
            if (!draggedIds.has(clip.id)) {
                points.push(clip.positionStart * timelineZoom, clip.positionEnd * timelineZoom);
            }
        });
    
        textElements.forEach(text => {
            if (!draggedIds.has(text.id)) {
                points.push(text.positionStart * timelineZoom, text.positionEnd * timelineZoom);
            }
        });
    
        return Array.from(new Set(points));
    }, [isSnappingEnabled, currentTime, timelineZoom, mediaFiles, textElements, activeElements]);

    const finalUpdateMedia = useMemo(() =>
        debounce((updates: { id: string, data: Partial<MediaFile> }[]) => {
            const currentFiles = mediaFilesRef.current;
            const updatedFiles = currentFiles.map(media => {
                const update = updates.find(u => u.id === media.id);
                return update ? { ...media, ...update.data } : media;
            });
            dispatch(setMediaFiles(updatedFiles));
        }, 50), [dispatch]
    );

    const handleClick = (e: React.MouseEvent, clip: MediaFile) => {
        e.stopPropagation();
        dispatch(toggleActiveElement({
            element: { id: clip.id, type: 'media' },
            metaKey: e.metaKey || e.ctrlKey,
        }));
    };

    const handleGapClick = (gap: { start: number, end: number }, e: React.MouseEvent) => {
        e.stopPropagation();
        dispatch(resetActiveElements());
        dispatch(setActiveGap({ ...gap, trackType: 'video' }));
    };

    const isSelected = (clipId: string) => activeElements.some(el => el.id === clipId);

    useEffect(() => {
        for (const clip of mediaFiles) {
            if (targetRefs.current[clip.id]) {
                 moveableRef.current[clip.id]?.updateRect();
            }
        }
    }, [timelineZoom, mediaFiles]);

    return (
        <div className="relative h-full">
            {gaps.map((gap, index) => (
                <div
                    key={`gap-video-${index}`}
                    className={`absolute top-0 h-full z-0 ${activeGap?.trackType === 'video' && activeGap?.start === gap.start ? 'bg-yellow-500 bg-opacity-30 border-2 border-yellow-500' : 'hover:bg-gray-500 hover:bg-opacity-20'}`}
                    style={{
                        left: `${gap.start * timelineZoom}px`,
                        width: `${(gap.end - gap.start) * timelineZoom}px`,
                    }}
                    onClick={(e) => handleGapClick(gap, e)}
                />
            ))}
            {videoClips
                .map((clip) => (
                    <div key={clip.id} className="relative z-10">
                        <div
                            key={clip.id}
                            ref={(el: HTMLDivElement | null) => {
                                if (el) {
                                    targetRefs.current[clip.id] = el;
                                }
                            }}
                            onClick={(e) => handleClick(e, clip)}
                            className={`absolute border border-gray-500 border-opacity-50 rounded-md top-2 h-12 rounded bg-[#27272A] text-white text-sm flex items-center justify-center cursor-pointer ${isSelected(clip.id) ? 'bg-[#3F3F46] border-blue-500' : ''}`}
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
                            renderDirections={isSelected(clip.id) && activeElements.length === 1 ? ['w', 'e'] : []}
                            draggable={true}
                            throttleDrag={0}
                            rotatable={false}
                            onDragStart={({ target, clientX }) => {
                                const newDragStates: typeof dragStates = {};
                                let elementsToDrag = activeElements;

                                // If dragging an unselected item, drag it alone without changing selection
                                if (!isSelected(clip.id)) {
                                    elementsToDrag = [{id: clip.id, type: "media"}];
                                }
                                
                                elementsToDrag.forEach(el => {
                                    const elRef = targetRefs.current[el.id];
                                    if(elRef) {
                                        newDragStates[el.id] = { startX: clientX, startLeft: elRef.offsetLeft };
                                    }
                                });
                                setDragStates(newDragStates);
                            }}
                            onDrag={({ transform }) => {
                                Object.keys(dragStates).forEach(id => {
                                    const elRef = targetRefs.current[id];
                                    if (elRef) {
                                        elRef.style.transform = transform;
                                    }
                                });
                            }}
                            onDragEnd={({ target, isDrag }) => {
                                if (!isDrag) {
                                    setDragStates({});
                                    return;
                                }

                                const updates: { id: string, data: Partial<MediaFile> }[] = [];

                                Object.keys(dragStates).forEach(id => {
                                    const elRef = targetRefs.current[id];
                                    if (elRef) {
                                        const transform = new DOMMatrix(getComputedStyle(elRef).transform);
                                        const newLeft = elRef.offsetLeft + transform.m41;
                                        
                                        elRef.style.transform = 'none';
                                        
                                        const newPositionStart = newLeft / timelineZoom;
                                        const originalClip = mediaFiles.find(m => m.id === id);
                                        if (originalClip) {
                                            const duration = originalClip.positionEnd - originalClip.positionStart;
                                            updates.push({
                                                id: id,
                                                data: {
                                                    positionStart: newPositionStart,
                                                    positionEnd: newPositionStart + duration,
                                                }
                                            });
                                        }
                                    }
                                });
                                
                                if(updates.length > 0) finalUpdateMedia(updates);
                                setDragStates({});
                            }}
                            resizable={true}
                            throttleResize={0}
                            onResizeStart={({ target }) => {
                                if (!isSelected(clip.id)) {
                                    dispatch(toggleActiveElement({ element: { id: clip.id, type: 'media' } }));
                                }
                                target.style.left = `${clip.positionStart * timelineZoom}px`;
                                target.style.width = `${(clip.positionEnd - clip.positionStart) * timelineZoom}px`;
                            }}
                            onResize={({ target, width, dist, direction }) => {
                                if (direction[0] === -1) { // left resize
                                    const newLeft = Math.max(0, (clip.positionStart * timelineZoom) + dist[0]);
                                    const newWidth = (clip.positionEnd * timelineZoom) - newLeft;
                                    
                                    if (newWidth / timelineZoom >= MIN_DURATION) {
                                        target.style.left = `${newLeft}px`;
                                        target.style.width = `${newWidth}px`;
                                    }
                                } else { // right resize
                                    const newWidth = Math.max(width, MIN_DURATION * timelineZoom);
                                    target.style.width = `${newWidth}px`;
                                }
                            }}
                            onResizeEnd={({ target, isDrag }) => {
                                if (!isDrag) return;
                                const newLeft = parseFloat(target.style.left) / timelineZoom;
                                const newWidth = parseFloat(target.style.width) / timelineZoom;
                                const originalClip = mediaFiles.find(c => c.id === clip.id);
                                
                                if (originalClip) {
                                    const isLeftResize = newLeft !== originalClip.positionStart;
                                    const newPositionStart = isLeftResize ? newLeft : originalClip.positionStart;
                                    const newPositionEnd = newPositionStart + newWidth;

                                    const sourceDuration = originalClip.endTime - originalClip.startTime;
                                    const newClipDuration = newPositionEnd - newPositionStart;
                                    const oldClipDuration = originalClip.positionEnd - originalClip.positionStart;

                                    let newStartTime = originalClip.startTime;
                                    let newEndTime = originalClip.endTime;

                                    if (isLeftResize) {
                                        const trimStartAmount = (newPositionStart - originalClip.positionStart) * (sourceDuration / oldClipDuration);
                                        newStartTime = originalClip.startTime + trimStartAmount;
                                    }
                                    const trimEndAmount = (newClipDuration - oldClipDuration) * (sourceDuration / oldClipDuration);
                                    newEndTime = (isLeftResize ? originalClip.endTime : newStartTime) + (newClipDuration * (sourceDuration/oldClipDuration))

                                    finalUpdateMedia([{
                                        id: clip.id, data: {
                                            positionStart: newPositionStart,
                                            positionEnd: newPositionEnd,
                                            startTime: newStartTime,
                                            endTime: newEndTime,
                                        }
                                    }]);
                                }
                            }}
                            snappable={isSnappingEnabled}
                            verticalGuidelines={verticalGuidelines}
                            snapDirections={{ "left": true, "right": true, "top": false, "bottom": false, "center": false, "middle": false }}
                            elementSnapDirections={{ "left": true, "right": true }}
                            snapThreshold={SNAP_THRESHOLD}
                        />
                    </div>
                ))
            }
        </div>
    );
}

memo(VideoTimeline)
