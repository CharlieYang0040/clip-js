import { useRef, useState, useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '@/app/store';
import { toggleActiveElement, setActiveElement } from '@/app/store/slices/projectSlice';
import { MediaFile, TextElement, SelectedElement } from '@/app/types';
import { debounce } from 'lodash';
import { OnDrag, OnDragStart, OnResize, OnResizeStart, OnResizeEnd } from 'react-moveable';

const MIN_DURATION = 0.1;

type ElementType = MediaFile | TextElement;
type ElementDataType = 'media' | 'text';

interface UseTimelineElementProps<T extends ElementType> {
    clip: T;
    elementsRef: React.RefObject<T[]>;
    elementType: ElementDataType;
    updateFunction: (updates: { id: string; data: Partial<T> }[]) => void;
}

export function useTimelineElement<T extends ElementType>({
    clip,
    elementsRef,
    elementType,
    updateFunction,
}: UseTimelineElementProps<T>) {
    const dispatch = useAppDispatch();
    const { timelineZoom, activeElements } = useAppSelector((state) => state.projectState);
    const [dragStates, setDragStates] = useState<Record<string, { startX: number; startLeft: number }>>({});
    const [resizeInfo, setResizeInfo] = useState<{
        visible: boolean;
        content: string;
        x: number;
        y: number;
    } | null>(null);
    const [isAtLimit, setIsAtLimit] = useState<'left' | 'right' | null>(null);
    const resizeStartStates = useRef<{ left: number, width: number } | null>(null);

    const isSelected = (clipId: string) => activeElements.some((el) => el.id === clipId);

    const onClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        dispatch(toggleActiveElement({ 
            element: { id: clip.id, type: elementType }, 
            metaKey: e.metaKey || e.shiftKey 
        }));
    };

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
        const { clientX } = e;
        const newDragStates: typeof dragStates = {};
        let elementsToDrag: SelectedElement[] = activeElements;

        if (!isSelected(clip.id)) {
            elementsToDrag = [{ id: clip.id, type: elementType }];
            if (!activeElements.some(e => e.id === clip.id)) {
                dispatch(toggleActiveElement({ element: { id: clip.id, type: elementType } }));
            }
        }
        
        elementsToDrag.forEach(el => {
            const elData = elementsRef.current?.find(e => e.id === el.id);
            if (elData) {
                const domElement = document.querySelector(`[data-element-id='${el.id}']`) as HTMLElement;
                if(domElement) {
                    newDragStates[el.id] = { startX: clientX, startLeft: domElement.offsetLeft };
                }
            }
        });

        setDragStates(newDragStates);
    };

    const onDrag = (e: OnDrag) => {
        const { transform } = e;
        Object.keys(dragStates).forEach(id => {
            const domElement = document.querySelector(`[data-element-id='${id}']`) as HTMLElement;
            if (domElement) {
                domElement.style.transform = transform;
            }
        });
    };

    const onDragEnd = () => {
        const updates: { id: string; data: Partial<T> }[] = [];
        Object.keys(dragStates).forEach(id => {
            const domElement = document.querySelector(`[data-element-id='${id}']`) as HTMLElement;
            if (domElement) {
                const transform = new DOMMatrix(getComputedStyle(domElement).transform);
                const newLeft = domElement.offsetLeft + transform.m41;
                domElement.style.transform = 'none';

                const newPositionStart = newLeft / timelineZoom;
                const originalElement = elementsRef.current?.find(m => m.id === id);
                if (originalElement) {
                    const duration = originalElement.positionEnd - originalElement.positionStart;
                    updates.push({
                        id: id,
                        data: {
                            positionStart: newPositionStart,
                            positionEnd: newPositionStart + duration,
                        } as Partial<T>
                    });
                }
            }
        });
        if (updates.length > 0) {
            updateFunction(updates);
            const updatedElementsForSelection = updates.map(u => ({ id: u.id, type: elementType }));
            dispatch(setActiveElement(updatedElementsForSelection));
        }
        setDragStates({});
    };

    const onResizeStart = (e: OnResizeStart) => {
        const { target, clientX, clientY } = e;
        if (!isSelected(clip.id)) {
            dispatch(toggleActiveElement({ element: { id: clip.id, type: elementType } }));
        }
        const htmlTarget = target as HTMLElement;
        resizeStartStates.current = { left: htmlTarget.offsetLeft, width: htmlTarget.offsetWidth };
        target.style.transition = 'none';
        
        const content = (parseFloat(target.style.width) / timelineZoom).toFixed(2) + 's';
        updateTooltip({clientX, clientY}, content);
    };

    const onResize = (e: OnResize) => {
        const { target, dist, direction, clientX, clientY, drag } = e;
        if (!resizeStartStates.current) return;
        
        const originalClip = elementsRef.current?.find(c => c.id === clip.id);
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

            if (isMedia) {
                const mediaClip = originalClip as MediaFile;
                const maxTimelineWidth = mediaClip.sourceDuration * timelineZoom;

                if (newWidth >= maxTimelineWidth) {
                    currentIsAtLimit = 'left';
                    newWidth = maxTimelineWidth;
                    newLeft = (originalClip.positionEnd * timelineZoom) - maxTimelineWidth;
                }
            }
            if (newLeft < 0) {
                newWidth += newLeft;
                newLeft = 0;
            }

        } else { // right resize
            newLeft = startLeft;
            newWidth = startWidth + dist[0];

            if (isMedia){
                const mediaClip = originalClip as MediaFile;
                const maxTimelineWidth = mediaClip.sourceDuration * timelineZoom;
                if(newWidth >= maxTimelineWidth) {
                    currentIsAtLimit = 'right';
                    newWidth = maxTimelineWidth;
                }
            }
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
        const originalClip = elementsRef.current?.find(c => c.id === clip.id);

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
                    const sourceTrimAmount = startTrimAmount * (sourceUsedDuration / oldDuration);
                    newStartTime = Math.max(0, mediaClip.startTime - sourceTrimAmount);
                    newEndTime = newStartTime + (newDuration * (sourceUsedDuration / oldDuration));
                } else {
                    newEndTime = newStartTime + (newDuration * (sourceUsedDuration / oldDuration));
                }
                
                updateData = {
                    ...updateData,
                    startTime: newStartTime,
                    endTime: Math.min(newEndTime, mediaClip.sourceDuration),
                };
            }
            
            updateFunction([{ id: clip.id, data: updateData }]);
            dispatch(setActiveElement([{ id: clip.id, type: elementType }]));
        }
    };

    return {
        onClick,
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