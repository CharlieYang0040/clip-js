import { useRef, useState, useCallback, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@/app/store';
import { toggleActiveElement, setMediaFiles, setTextElements, setDraggingElement, setDragOverTrackId, setCurrentTime, setSnapLine, setPreviewTime, clearPreviewTime } from '@/app/store/slices/projectSlice';
import { MediaFile, TextElement, SelectedElement } from '@/app/types';
import { OnDrag, OnDragStart, OnResize, OnResizeStart, OnResizeEnd, OnDragEnd } from 'react-moveable';
import { throttle } from 'lodash';

const MIN_DURATION = 0.1;
const SNAP_THRESHOLD_PX = 10;

type ElementType = (MediaFile | TextElement) & { zIndex?: number };

interface UseTimelineElementProps<T extends ElementType> {
    clip: T;
    elementType: 'media' | 'text';
}

export function useTimelineElement<T extends ElementType>({
    clip,
    elementType,
}: UseTimelineElementProps<T>) {
    const dispatch = useAppDispatch();
    const { timelineZoom, activeElements, mediaFiles, textElements, dragOverTrackId, tracks, isSnappingEnabled, currentTime } = useAppSelector((state) => state.projectState);
    const [dragStates, setDragStates] = useState<Record<string, { startX: number; startLeft: number }>>({});
    const [resizeInfo, setResizeInfo] = useState<{
        visible: boolean;
        content: string;
        x: number;
        y: number;
    } | null>(null);
    const [isAtLimit, setIsAtLimit] = useState<'left' | 'right' | null>(null);
    const resizeStartStates = useRef<{ left: number, width: number } | null>(null);
    const metaKeyPressed = useRef(false);
    const resizeDirection = useRef<number>(0);

    const stateRef = useRef({ mediaFiles, textElements, tracks, currentTime, dragOverTrackId, isSnappingEnabled });
    useEffect(() => {
        stateRef.current = { mediaFiles, textElements, tracks, currentTime, dragOverTrackId, isSnappingEnabled };
    }, [mediaFiles, textElements, tracks, currentTime, dragOverTrackId, isSnappingEnabled]);

    const throttledSetCurrentTime = useCallback(
        throttle((time: number) => {
            dispatch(setCurrentTime(time));
        }, 100),
        [dispatch]
    );
    
    const throttledSetSnapLine = useCallback(throttle((snapLine: number | null) => dispatch(setSnapLine(snapLine)), 16), [dispatch]);

    const getSnapPoints = useCallback((excludeIds: string[]): number[] => {
        const { mediaFiles: latestMedia, textElements: latestText, currentTime: latestTime } = stateRef.current;
        const allElements = [...latestMedia, ...latestText];
        const otherElements = allElements.filter(el => !excludeIds.includes(el.id));
        const snapPoints = otherElements.flatMap(el => [el.positionStart, el.positionEnd]);
        return [...snapPoints, latestTime];
    }, []);

    const findSnap = useCallback((
        targetStart: number,
        targetEnd: number,
        snapPoints: number[]
    ): { snapDelta: number, snapLine: number | null } => {
        let bestSnap = { snapDelta: 0, snapLine: null as number | null, distance: SNAP_THRESHOLD_PX };

        for (const point of snapPoints) {
            const startDist = Math.abs(targetStart - point) * timelineZoom;
            const endDist = Math.abs(targetEnd - point) * timelineZoom;

            if (startDist < bestSnap.distance) {
                bestSnap = {
                    snapDelta: (point - targetStart) * timelineZoom,
                    snapLine: point,
                    distance: startDist
                };
            }
            if (endDist < bestSnap.distance) {
                bestSnap = {
                    snapDelta: (point - targetEnd) * timelineZoom,
                    snapLine: point,
                    distance: endDist
                };
            }
        }
        return { snapDelta: bestSnap.snapDelta, snapLine: bestSnap.snapLine };
    }, [timelineZoom]);

    const throttledUpdatePositions = useCallback(throttle((dist: number[]) => {
        const { mediaFiles: latestMedia, textElements: latestText, tracks: latestTracks, dragOverTrackId: latestDragOverTrackId, isSnappingEnabled: latestIsSnappingEnabled } = stateRef.current;
        const allElements = [...latestMedia, ...latestText];
        let snapDelta = 0;

        if (latestIsSnappingEnabled) {
            const snapPoints = getSnapPoints(Object.keys(dragStates));
            const primaryDraggedEl = allElements.find(el => el.id === clip.id);
            if (primaryDraggedEl) {
                const currentElementDuration = primaryDraggedEl.positionEnd - primaryDraggedEl.positionStart;
                const currentLeft = dragStates[clip.id].startLeft + dist[0];
                const currentStart = currentLeft / timelineZoom;
                const currentEnd = currentStart + currentElementDuration;
                const { snapDelta: newSnapDelta, snapLine } = findSnap(currentStart, currentEnd, snapPoints);
                snapDelta = newSnapDelta;
                throttledSetSnapLine(snapLine);
            }
        }

        const deltaX = dist[0] + snapDelta;

        const elementsToUpdate = Object.keys(dragStates).map(id => {
            const el = allElements.find(e => e.id === id);
            if (!el) return null;
            const startLeft = dragStates[id].startLeft;
            const newLeftPx = startLeft + deltaX;
            const newPositionStart = Math.max(0, newLeftPx / timelineZoom);
            const duration = el.positionEnd - el.positionStart;
            
            const targetTrack = latestTracks.find(t => t.id === latestDragOverTrackId);
            let newTrackId = el.trackId;
            if (targetTrack) {
                const currentElementType = 'type' in el ? (el as MediaFile).type : 'text';
                if (targetTrack.type === currentElementType) {
                    newTrackId = targetTrack.id;
                }
            }

            return { ...el, positionStart: newPositionStart, positionEnd: newPositionStart + duration, trackId: newTrackId };
        }).filter((u): u is MediaFile | TextElement => u !== null);

        const mediaToUpdate = elementsToUpdate.filter(el => 'type' in el) as MediaFile[];
        const textToUpdate = elementsToUpdate.filter(el => !('type' in el)) as TextElement[];

        if (mediaToUpdate.length > 0) {
            dispatch(setMediaFiles(latestMedia.map(f => mediaToUpdate.find(u => u.id === f.id) || f)));
        }
        if (textToUpdate.length > 0) {
            dispatch(setTextElements(latestText.map(t => textToUpdate.find(u => u.id === t.id) || t)));
        }
    }, 16), [getSnapPoints, findSnap, throttledSetSnapLine, dragStates, clip.id, timelineZoom, dispatch]);

    const isSelected = (clipId: string) => activeElements.some((el) => el.id === clipId);

    const updateTooltip = useCallback((e: { clientX: number, clientY: number }, content: string) => {
        setResizeInfo({
            visible: true,
            content,
            x: e.clientX + 15,
            y: e.clientY,
        });
    }, []);

    const hideTooltip = useCallback(() => {
        setResizeInfo(null);
        dispatch(setSnapLine(null));
    }, [dispatch]);

    const onDragStart = (e: OnDragStart) => {
        const { clientX, inputEvent } = e;
        dispatch(setDraggingElement({ clip, elementType }));
        metaKeyPressed.current = inputEvent.ctrlKey || inputEvent.shiftKey;
        const newDragStates: typeof dragStates = {};
        let elementsToDrag: SelectedElement[];

        if (isSelected(clip.id)) {
            elementsToDrag = [...activeElements];
        } else {
            elementsToDrag = [{ id: clip.id, type: elementType }];
        }
        
        elementsToDrag.forEach(el => {
            const domElement = document.querySelector(`[data-element-id='${el.id}']`) as HTMLElement;
            if (domElement) {
                newDragStates[el.id] = { startX: clientX, startLeft: domElement.offsetLeft };
            }
        });

        setDragStates(newDragStates);
    };

    const onDrag = (e: OnDrag) => {
        const { clientY, dist } = e;

        throttledUpdatePositions(dist);

        const trackElements = Array.from(document.querySelectorAll('[data-track-id]'));
        const targetTrackEl = trackElements.find(el => {
            const rect = el.getBoundingClientRect();
            return clientY >= rect.top && clientY <= rect.bottom;
        });
        const newDragOverTrackId = targetTrackEl?.getAttribute('data-track-id') || null;
        if (newDragOverTrackId !== dragOverTrackId) {
            dispatch(setDragOverTrackId(newDragOverTrackId));
        }
    };

    const onDragEnd = (e: OnDragEnd) => {
        throttledUpdatePositions.flush();
        throttledSetSnapLine.flush();

        dispatch(setSnapLine(null));
        
        if (!e.isDrag || (e.lastEvent && e.lastEvent.dist[0] === 0 && e.lastEvent.dist[1] === 0)) {
            dispatch(toggleActiveElement({
                element: { id: clip.id, type: elementType },
                metaKey: metaKeyPressed.current
            }));
        }
        
        setDragStates({});
        dispatch(setDraggingElement(null));
        dispatch(setDragOverTrackId(null));
    };

    const onResizeStart = (e: OnResizeStart) => {
        const { target, clientX, clientY, direction } = e;
        resizeStartStates.current = {
            left: parseFloat(target.style.left) || 0,
            width: parseFloat(target.style.width) || 0,
        };
        resizeDirection.current = direction[0];
        const newTime = direction[0] === -1 ? clip.positionStart : clip.positionEnd;
        updateTooltip({ clientX, clientY }, `${newTime.toFixed(2)}s`);
    };

    const onResize = (e: OnResize) => {
        const { target, width, dist, direction, clientX, clientY } = e;
        if (!resizeStartStates.current) return;

        const { left: startLeftPx, width: startWidthPx } = resizeStartStates.current;
        
        let newLeftPx = startLeftPx;
        let newWidthPx = startWidthPx;

        if (direction[0] === -1) { // Resizing left
            newLeftPx = startLeftPx - dist[0];
            newWidthPx = startWidthPx + dist[0];
        } else { // Resizing right
            newWidthPx = startWidthPx + dist[0];
        }

        let newStart = newLeftPx / timelineZoom;
        let newEnd = (newLeftPx + newWidthPx) / timelineZoom;
        
        // Clamping for media files first
        setIsAtLimit(null);
        if (elementType === 'media') {
            const mediaClip = clip as MediaFile;
            if (direction[0] === -1) { // Resizing left
                const minStartTime = 0;
                const maxClipDuration = mediaClip.endTime - minStartTime;
                const currentDuration = newEnd - newStart;
                if (currentDuration > maxClipDuration) {
                    newStart = newEnd - maxClipDuration;
                    setIsAtLimit('left');
                }
            } else { // Resizing right
                const maxEndTime = mediaClip.sourceDuration;
                const maxClipDuration = maxEndTime - mediaClip.startTime;
                const currentDuration = newEnd - newStart;
                if (currentDuration > maxClipDuration) {
                    newEnd = newStart + maxClipDuration;
                    setIsAtLimit('right');
                }
            }
        }
        
        // Snapping
        let currentSnapLine = null;
        if (isSnappingEnabled) {
            const snapPoints = getSnapPoints([clip.id]);
            const { snapDelta, snapLine } = findSnap(newStart, newEnd, snapPoints);
            if(snapDelta !== 0) {
                if (direction[0] === -1) {
                    newStart = (newStart * timelineZoom + snapDelta) / timelineZoom;
                } else {
                    newEnd = (newEnd * timelineZoom + snapDelta) / timelineZoom;
                }
            }
            currentSnapLine = snapLine;
        }
        throttledSetSnapLine(currentSnapLine);

        // Final Calculations
        newLeftPx = newStart * timelineZoom;
        newWidthPx = (newEnd - newStart) * timelineZoom;
        
        if (newWidthPx < MIN_DURATION * timelineZoom) {
            if (direction[0] === -1) {
                newLeftPx = (newEnd * timelineZoom) - (MIN_DURATION * timelineZoom);
            }
            newWidthPx = MIN_DURATION * timelineZoom;
        }

        target.style.left = `${newLeftPx}px`;
        target.style.width = `${newWidthPx}px`;

        const newTime = direction[0] === -1 ? newStart : newEnd;
        dispatch(setPreviewTime(newTime));
        updateTooltip({ clientX, clientY }, `${newTime.toFixed(2)}s`);
    };

    const onResizeEnd = (e: OnResizeEnd) => {
        hideTooltip();
        dispatch(clearPreviewTime());
        if (!resizeStartStates.current) return;

        const { lastEvent } = e;
        if (lastEvent) {
            const newStart = parseFloat(lastEvent.target.style.left) / timelineZoom;
            const newWidth = parseFloat(lastEvent.target.style.width) / timelineZoom;
            const newEnd = newStart + newWidth;

            let updatedClip: ElementType = {
                ...clip,
                positionStart: newStart,
                positionEnd: newEnd,
            };

            if (elementType === 'media') {
                const mediaClip = clip as MediaFile;
                let newStartTime = mediaClip.startTime;
                let newEndTime = mediaClip.endTime;

                const positionDelta = newStart - mediaClip.positionStart;
                if (resizeDirection.current === -1) { // left handle
                     newStartTime = mediaClip.startTime + positionDelta;
                }
                
                const durationDelta = (newEnd - newStart) - (mediaClip.positionEnd - mediaClip.positionStart);
                newEndTime = newStartTime + (mediaClip.endTime - mediaClip.startTime) + durationDelta;

                if (newStartTime < 0) {
                    newStartTime = 0;
                }
                if (newEndTime > mediaClip.sourceDuration) {
                    newEndTime = mediaClip.sourceDuration;
                }

                updatedClip = {
                    ...updatedClip,
                    startTime: newStartTime,
                    endTime: newEndTime,
                } as MediaFile;
            }

            if (elementType === 'media') {
                const updatedMediaFiles = mediaFiles.map(m => m.id === clip.id ? updatedClip as MediaFile : m);
                dispatch(setMediaFiles(updatedMediaFiles));
            } else {
                const updatedTextElements = textElements.map(t => t.id === clip.id ? updatedClip as TextElement : t);
                dispatch(setTextElements(updatedTextElements));
            }
        }
        resizeStartStates.current = null;
        resizeDirection.current = 0;
    };

    return {
        onDragStart,
        onDrag,
        onDragEnd,
        onResizeStart,
        onResize,
        onResizeEnd,
        resizeInfo,
        isAtLimit,
    };
} 