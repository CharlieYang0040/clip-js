import { useRef, useState, useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '@/app/store';
import { toggleActiveElement, setActiveElement, setMediaFiles, setTextElements, setDraggingElement, setDragOverTrackId } from '@/app/store/slices/projectSlice';
import { MediaFile, TextElement, SelectedElement } from '@/app/types';
import { OnDrag, OnDragStart, OnResize, OnResizeStart, OnResizeEnd, OnDragEnd } from 'react-moveable';

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
        const { transform, clientY, dist } = e;
        let newTransform = transform;

        if (isSnappingEnabled) {
            const allElements = [...mediaFiles, ...textElements];
            const otherElements = allElements.filter(el => !dragStates[el.id]);
            const currentElementDuration = clip.positionEnd - clip.positionStart;

            const elementSnapPoints = otherElements.flatMap(el => [el.positionStart, el.positionEnd]);
            const markerSnapPoint = [currentTime];

            const currentLeft = dragStates[clip.id].startLeft + dist[0];
            const currentStart = currentLeft / timelineZoom;
            const currentEnd = currentStart + currentElementDuration;

            let snapDelta = 0;

            // Priority 1: Snap to other elements
            for (const point of elementSnapPoints) {
                const startDiff = Math.abs(currentStart - point) * timelineZoom;
                const endDiff = Math.abs(currentEnd - point) * timelineZoom;

                if (startDiff < SNAP_THRESHOLD_PX) {
                    snapDelta = (point - currentStart) * timelineZoom;
                    break;
                }
                if (endDiff < SNAP_THRESHOLD_PX) {
                    snapDelta = (point - currentEnd) * timelineZoom;
                    break;
                }
            }

            // Priority 2: Snap to marker if no element snap
            if (snapDelta === 0) {
                for (const point of markerSnapPoint) {
                    const startDiff = Math.abs(currentStart - point) * timelineZoom;
                    const endDiff = Math.abs(currentEnd - point) * timelineZoom;

                    if (startDiff < SNAP_THRESHOLD_PX) {
                        snapDelta = (point - currentStart) * timelineZoom;
                        break;
                    }
                    if (endDiff < SNAP_THRESHOLD_PX) {
                        snapDelta = (point - currentEnd) * timelineZoom;
                        break;
                    }
                }
            }

            if (snapDelta !== 0) {
                newTransform = `translate(${dist[0] + snapDelta}px, 0px)`;
            }
        }

        Object.keys(dragStates).forEach(id => {
            const domElement = document.querySelector(`[data-element-id='${id}']`) as HTMLElement;
            if (domElement) {
                domElement.style.transform = newTransform;
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
        const dragDistance = e.isDrag && e.lastEvent ? Math.hypot(e.lastEvent.dist[0], e.lastEvent.dist[1]) : 0;

        if (!e.isDrag || dragDistance < 5) {
            dispatch(toggleActiveElement({
                element: { id: clip.id, type: elementType },
                metaKey: metaKeyPressed.current
            }));
        } else if (dragOverTrackId) {
            const targetTrack = tracks.find(t => t.id === dragOverTrackId);
            const clipType = elementType === 'media' ? (clip as MediaFile).type : 'text';

            if (targetTrack && targetTrack.type === clipType) {
                const domElement = document.querySelector(`[data-element-id='${clip.id}']`) as HTMLElement;
                if (domElement) {
                    const transform = new DOMMatrix(getComputedStyle(domElement).transform);
                    const newLeft = domElement.offsetLeft + transform.m41;
                    const newPositionStart = newLeft / timelineZoom;
                    const duration = clip.positionEnd - clip.positionStart;

                    const updateData = {
                        trackId: dragOverTrackId,
                        positionStart: newPositionStart,
                        positionEnd: newPositionStart + duration,
                    };

                    if (elementType === 'media') {
                        dispatch(setMediaFiles(mediaFiles.map(f => f.id === clip.id ? { ...f, ...updateData } : f)));
                    } else {
                        dispatch(setTextElements(textElements.map(t => t.id === clip.id ? { ...t, ...updateData } : t)));
                    }
                }
            }
        }
        
        // Reset transform and drag states
        Object.keys(dragStates).forEach(id => {
            const domElement = document.querySelector(`[data-element-id='${id}']`) as HTMLElement;
            if (domElement) domElement.style.transform = 'none';
        });
        setDragStates({});
        dispatch(setDraggingElement(null));
        dispatch(setDragOverTrackId(null));
    };

    const onResizeStart = (e: OnResizeStart) => {
        const { target, clientX, clientY } = e;
        if (!isSelected(clip.id)) {
            dispatch(toggleActiveElement({ element: { id: clip.id, type: elementType }, metaKey: false }));
        }
        const htmlTarget = target as HTMLElement;
        resizeStartStates.current = { left: htmlTarget.offsetLeft, width: htmlTarget.offsetWidth };
        target.style.transition = 'none';

        const content = (parseFloat(target.style.width) / timelineZoom).toFixed(2) + 's';
        updateTooltip({ clientX, clientY }, content);
    };

    const onResize = (e: OnResize) => {
        const { target, dist, direction, clientX, clientY, drag } = e;
        if (!resizeStartStates.current) return;

        const allElements = [...mediaFiles, ...textElements];
        const originalClip = allElements.find(c => c.id === clip.id);
        if (!originalClip) return;

        const { left: startLeft, width: startWidth } = resizeStartStates.current;
        const isMedia = 'sourceDuration' in originalClip;
        let currentIsAtLimit: 'left' | 'right' | null = null;
        let newWidth: number;
        let newLeft: number;

        if (direction[0] === -1) { // left resize
            const distX = drag.dist[0];
            newLeft = startLeft + distX;
            newWidth = startWidth - distX;
        } else { // right resize
            newLeft = startLeft;
            newWidth = startWidth + dist[0];
        }

        if (isSnappingEnabled) {
            const otherElements = allElements.filter(el => el.id !== clip.id);
            const elementSnapPoints = otherElements.flatMap(el => [el.positionStart, el.positionEnd]);
            const markerSnapPoint = [currentTime];
            const snapPoints = [...elementSnapPoints, ...markerSnapPoint];

            let snapDelta = 0;

            if (direction[0] === -1) { // left resize
                const currentStart = newLeft / timelineZoom;
                for (const point of snapPoints) {
                    const diff = Math.abs(currentStart - point) * timelineZoom;
                    if (diff < SNAP_THRESHOLD_PX) {
                        snapDelta = (point - currentStart) * timelineZoom;
                        break;
                    }
                }
                if (snapDelta !== 0) {
                    newLeft += snapDelta;
                    newWidth -= snapDelta;
                }
            } else { // right resize
                const currentEnd = (newLeft + newWidth) / timelineZoom;
                for (const point of snapPoints) {
                    const diff = Math.abs(currentEnd - point) * timelineZoom;
                    if (diff < SNAP_THRESHOLD_PX) {
                        snapDelta = (point - currentEnd) * timelineZoom;
                        break;
                    }
                }
                if (snapDelta !== 0) {
                    newWidth += snapDelta;
                }
            }
        }

        if (isMedia) {
            if (direction[0] === -1) {
                const mediaClip = originalClip as MediaFile;
                const maxTimelineWidth = startWidth + (mediaClip.startTime * timelineZoom);
                if (newWidth >= maxTimelineWidth) {
                    currentIsAtLimit = 'left';
                    newWidth = maxTimelineWidth;
                    newLeft = startLeft + startWidth - newWidth;
                }
            } else {
                const mediaClip = originalClip as MediaFile;
                const maxTimelineWidth = startWidth + (mediaClip.sourceDuration - mediaClip.endTime) * timelineZoom;
                if (newWidth >= maxTimelineWidth) {
                    currentIsAtLimit = 'right';
                    newWidth = maxTimelineWidth;
                }
            }
        }

        if (newLeft < 0) {
            newWidth += newLeft;
            newLeft = 0;
        }

        if (newWidth < MIN_DURATION * timelineZoom) {
            newWidth = MIN_DURATION * timelineZoom;
            if (direction[0] === -1) {
                newLeft = startLeft + startWidth - newWidth;
            }
        }

        target.style.width = `${newWidth}px`;
        target.style.left = `${newLeft}px`;

        setIsAtLimit(currentIsAtLimit);
        const content = (newWidth / timelineZoom).toFixed(2) + 's';
        updateTooltip({ clientX, clientY }, content);
    };

    const onResizeEnd = (e: OnResizeEnd) => {
        const { target } = e;
        hideTooltip();
        setIsAtLimit(null);
        const newLeftPx = parseFloat(target.style.left);
        const newWidthPx = parseFloat(target.style.width);

        const allElements = [...mediaFiles, ...textElements];
        const originalClip = allElements.find(c => c.id === clip.id);

        if (originalClip) {
            const newPositionStart = newLeftPx / timelineZoom;
            const newPositionEnd = newPositionStart + (newWidthPx / timelineZoom);
            let updateData: Partial<T> = { positionStart: newPositionStart, positionEnd: newPositionEnd } as Partial<T>;

            if ('sourceDuration' in originalClip) {
                const mediaClip = originalClip as MediaFile;
                const newDuration = newPositionEnd - newPositionStart;
                const oldDuration = mediaClip.positionEnd - mediaClip.positionStart;
                const sourceUsedDuration = mediaClip.endTime - mediaClip.startTime;
                const isLeftResize = Math.abs(newPositionStart - mediaClip.positionStart) > 0.0001;

                let newStartTime = mediaClip.startTime;
                let newEndTime = mediaClip.endTime;

                if (isLeftResize) {
                    const startTrimAmount = (mediaClip.positionStart - newPositionStart);
                    if (Math.abs(startTrimAmount) > 0.0001) {
                        const sourceTrimAmount = startTrimAmount * (sourceUsedDuration / oldDuration);
                        newStartTime = Math.max(0, mediaClip.startTime - sourceTrimAmount);
                        newEndTime = newStartTime + (newDuration * (sourceUsedDuration / oldDuration));
                    } else {
                        // Right resize
                        newEndTime = newStartTime + (newDuration * (sourceUsedDuration / oldDuration));
                    }
                } else {
                    newEndTime = newStartTime + (newDuration * (sourceUsedDuration / oldDuration));
                }

                updateData = {
                    ...updateData,
                    startTime: newStartTime,
                    endTime: Math.min(newEndTime, mediaClip.sourceDuration),
                };
            }

            if (elementType === 'media') {
                const updatedMediaFiles = mediaFiles.map(file =>
                    file.id === clip.id ? { ...file, ...updateData as Partial<MediaFile> } : file
                );
                dispatch(setMediaFiles(updatedMediaFiles));
            } else if (elementType === 'text') {
                const updatedTextElements = textElements.map(element =>
                    element.id === clip.id ? { ...element, ...updateData as Partial<TextElement> } : element
                );
                dispatch(setTextElements(updatedTextElements));
            }

            dispatch(setActiveElement([{ id: clip.id, type: elementType }]));
        }
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