import { useRef, useState, useCallback, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@/app/store';
import { toggleActiveElement, setActiveElement, setMediaFiles, setTextElements, setDraggingElement, setDragOverTrackId, setCurrentTime } from '@/app/store/slices/projectSlice';
import { MediaFile, TextElement, SelectedElement } from '@/app/types';
import { OnDrag, OnDragStart, OnResize, OnResizeStart, OnResizeEnd, OnDragEnd } from 'react-moveable';
import { throttle } from 'lodash';

const MIN_DURATION = 0.1;
const SNAP_THRESHOLD_PX = 10; // Snap sensitivity in pixels

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

    const throttledSetMediaFiles = useCallback(throttle((files: MediaFile[]) => dispatch(setMediaFiles(files)), 50), [dispatch]);
    const throttledSetTextElements = useCallback(throttle((elements: TextElement[]) => dispatch(setTextElements(elements)), 50), [dispatch]);

    const throttledSetCurrentTime = useCallback(
        throttle((time: number) => {
            dispatch(setCurrentTime(time));
        }, 100),
        [dispatch]
    );

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
    }, []);

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
            const allElements = [...mediaFiles, ...textElements];
            const elData = allElements.find(e => e.id === el.id);

            if (elData) {
                const domElement = document.querySelector(`[data-element-id='${el.id}']`) as HTMLElement;
                if (domElement) {
                    newDragStates[el.id] = { startX: clientX, startLeft: domElement.offsetLeft };
                }
            }
        });

        setDragStates(newDragStates);
    };

    const onDrag = (e: OnDrag) => {
        const { clientY, dist } = e;
        let snapDelta = 0;

        if (isSnappingEnabled) {
            const allElements = [...mediaFiles, ...textElements];
            const otherElements = allElements.filter(el => !dragStates[el.id]);
            
            const sameTrackElements = otherElements.filter(el => el.trackId === clip.trackId);
            const otherTrackElements = otherElements.filter(el => el.trackId !== clip.trackId);

            const sameTrackSnapPoints = sameTrackElements.flatMap(el => [el.positionStart, el.positionEnd]);
            const markerSnapPoint = [currentTime];
            const otherTrackSnapPoints = otherTrackElements.flatMap(el => [el.positionStart, el.positionEnd]);

            const currentElementDuration = clip.positionEnd - clip.positionStart;
            const currentLeft = dragStates[clip.id].startLeft + dist[0];
            const currentStart = currentLeft / timelineZoom;
            const currentEnd = currentStart + currentElementDuration;

            const findSnapDelta = (points: number[], start: number, end: number): number => {
                for (const point of points) {
                    const startDiff = Math.abs(start - point) * timelineZoom;
                    if (startDiff < SNAP_THRESHOLD_PX) return (point - start) * timelineZoom;
                    const endDiff = Math.abs(end - point) * timelineZoom;
                    if (endDiff < SNAP_THRESHOLD_PX) return (point - end) * timelineZoom;
                }
                return 0;
            };

            snapDelta = findSnapDelta(sameTrackSnapPoints, currentStart, currentEnd);
            if (snapDelta === 0) snapDelta = findSnapDelta(markerSnapPoint, currentStart, currentEnd);
            if (snapDelta === 0) snapDelta = findSnapDelta(otherTrackSnapPoints, currentStart, currentEnd);
        }
        
        const deltaX = dist[0] + snapDelta;
        const allElements = [...mediaFiles, ...textElements];

        const elementsToUpdate = Object.keys(dragStates).map(id => {
            const el = allElements.find(e => e.id === id);
            if (!el) return null;
            const startLeft = dragStates[id].startLeft;
            const newLeftPx = startLeft + deltaX;
            const newPositionStart = Math.max(0, newLeftPx / timelineZoom);
            const duration = el.positionEnd - el.positionStart;
            return { ...el, positionStart: newPositionStart, positionEnd: newPositionStart + duration };
        }).filter((u): u is MediaFile | TextElement => u !== null);
        
        const mediaToUpdate = elementsToUpdate.filter(el => 'type' in el && el.type !== 'text') as MediaFile[];
        const textToUpdate = elementsToUpdate.filter(el => el.type === 'text') as TextElement[];

        if (mediaToUpdate.length > 0) {
            throttledSetMediaFiles(mediaFiles.map(f => mediaToUpdate.find(u => u.id === f.id) || f));
        }
        if (textToUpdate.length > 0) {
            throttledSetTextElements(textElements.map(t => textToUpdate.find(u => u.id === t.id) || t));
        }

        const deltaY = dist[1];
        Object.keys(dragStates).forEach(id => {
            const domElement = document.querySelector(`[data-element-id='${id}']`) as HTMLElement;
            if (domElement) {
                domElement.style.transform = `translateY(${deltaY}px)`;
            }
        });

        const trackElements = Array.from(document.querySelectorAll('[data-track-id]'));
        const targetTrack = trackElements.find(el => {
            const rect = el.getBoundingClientRect();
            return clientY >= rect.top && clientY <= rect.bottom;
        });

        if (targetTrack) {
            dispatch(setDragOverTrackId(targetTrack.getAttribute('data-track-id')));
        } else {
            dispatch(setDragOverTrackId(null));
        }
    };

    const onDragEnd = (e: OnDragEnd) => {
        throttledSetMediaFiles.cancel();
        throttledSetTextElements.cancel();

        Object.keys(dragStates).forEach(id => {
            const domElement = document.querySelector(`[data-element-id='${id}']`) as HTMLElement;
            if (domElement) {
                domElement.style.transform = 'none';
            }
        });
        
        const dragDistance = e.isDrag && e.lastEvent ? Math.hypot(e.lastEvent.dist[0], e.lastEvent.dist[1]) : 0;

        if (!e.isDrag || dragDistance < 5) {
            dispatch(toggleActiveElement({
                element: { id: clip.id, type: elementType },
                metaKey: metaKeyPressed.current
            }));
        } else {
            const allElements = [...mediaFiles, ...textElements];
            let snapDelta = 0;

            if (isSnappingEnabled && e.lastEvent) {
                const { dist } = e.lastEvent;
                const sameTrackElements = allElements.filter(el => !dragStates[el.id] && el.trackId === clip.trackId);
                const otherTrackElements = allElements.filter(el => !dragStates[el.id] && el.trackId !== clip.trackId);
                const sameTrackSnapPoints = sameTrackElements.flatMap(el => [el.positionStart, el.positionEnd]);
                const markerSnapPoint = [currentTime];
                const otherTrackSnapPoints = otherTrackElements.flatMap(el => [el.positionStart, el.positionEnd]);
                const currentElementDuration = clip.positionEnd - clip.positionStart;
                const currentLeft = dragStates[clip.id].startLeft + dist[0];
                const currentStart = currentLeft / timelineZoom;
                const currentEnd = currentStart + currentElementDuration;

                const findSnapDelta = (points: number[], start: number, end: number): number => {
                    for (const point of points) {
                        const startDiff = Math.abs(start - point) * timelineZoom;
                        if (startDiff < SNAP_THRESHOLD_PX) return (point - start) * timelineZoom;
                        const endDiff = Math.abs(end - point) * timelineZoom;
                        if (endDiff < SNAP_THRESHOLD_PX) return (point - end) * timelineZoom;
                    }
                    return 0;
                };

                snapDelta = findSnapDelta(sameTrackSnapPoints, currentStart, currentEnd);
                if (snapDelta === 0) snapDelta = findSnapDelta(markerSnapPoint, currentStart, currentEnd);
                if (snapDelta === 0) snapDelta = findSnapDelta(otherTrackSnapPoints, currentStart, currentEnd);
            }

            const deltaX = (e.lastEvent?.dist[0] || 0) + snapDelta;

            const elementsToUpdate = Object.keys(dragStates).map(id => {
                const el = allElements.find(e => e.id === id);
                if (!el) return null;
                const startLeft = dragStates[id].startLeft;
                const newLeftPx = startLeft + deltaX;
                const newPositionStart = Math.max(0, newLeftPx / timelineZoom);
                const duration = el.positionEnd - el.positionStart;
                const newTrackId = (dragOverTrackId && tracks.find(t => t.id === dragOverTrackId)?.type === ('type' in el ? el.type : 'text')) ? dragOverTrackId : el.trackId;
                return { ...el, positionStart: newPositionStart, positionEnd: newPositionStart + duration, trackId: newTrackId };
            }).filter((u): u is MediaFile | TextElement => u !== null);

            const mediaToUpdate = elementsToUpdate.filter(el => el.type !== 'text') as MediaFile[];
            const textToUpdate = elementsToUpdate.filter(el => el.type === 'text') as TextElement[];

            if (mediaToUpdate.length > 0) dispatch(setMediaFiles(mediaFiles.map(f => mediaToUpdate.find(u => u.id === f.id) || f)));
            if (textToUpdate.length > 0) dispatch(setTextElements(textElements.map(t => textToUpdate.find(u => u.id === t.id) || t)));
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
        const newTime = direction[0] === -1 ? clip.positionStart : clip.positionEnd;
        updateTooltip({ clientX, clientY }, `${newTime.toFixed(2)}s`);
    };

    const onResize = (e: OnResize) => {
        const { target, width, height, dist, delta, direction, clientX, clientY } = e;
        if (!resizeStartStates.current) return;

        const originalStart = resizeStartStates.current.left / timelineZoom;
        const newWidthInSeconds = width / timelineZoom;
        let newStart = originalStart;

        if (direction[0] === -1) { // Resizing from the left
            newStart = (resizeStartStates.current.left + dist[0]) / timelineZoom;
        }

        const newEnd = newStart + newWidthInSeconds;

        const newTime = direction[0] === -1 ? newStart : newEnd;
        throttledSetCurrentTime(newTime);
        updateTooltip({ clientX, clientY }, `${newTime.toFixed(2)}s`);
        
        target.style.width = `${width}px`;
        target.style.left = `${resizeStartStates.current.left + delta[0]}px`;
    };

    const onResizeEnd = (e: OnResizeEnd) => {
        hideTooltip();
        if (!resizeStartStates.current) return;

        const { lastEvent } = e;
        if (lastEvent) {
            const newStart = parseFloat(lastEvent.target.style.left) / timelineZoom;
            const newWidth = parseFloat(lastEvent.target.style.width) / timelineZoom;
            const newEnd = newStart + newWidth;

            const updatedClip = {
                ...clip,
                positionStart: newStart,
                positionEnd: newEnd,
            };

            if (elementType === 'media') {
                const updatedMediaFiles = mediaFiles.map(m => m.id === clip.id ? updatedClip as MediaFile : m);
                dispatch(setMediaFiles(updatedMediaFiles));
            } else {
                const updatedTextElements = textElements.map(t => t.id === clip.id ? updatedClip as TextElement : t);
                dispatch(setTextElements(updatedTextElements));
            }
        }
        resizeStartStates.current = null;
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