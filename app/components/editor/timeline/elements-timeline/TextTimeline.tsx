import React, { useRef, useMemo, useEffect, useState } from "react";
import ReactDOM from "react-dom";
import Moveable from "react-moveable";
import { useAppSelector } from "@/app/store";
import { setTextElements, setActiveGap, toggleActiveElement, resetActiveElements } from "@/app/store/slices/projectSlice";
import { memo } from "react";
import { useDispatch } from "react-redux";
import Image from "next/image";
import { TextElement } from "@/app/types";
import { debounce } from "lodash";
import { useTimelineElement } from "@/app/hooks/useTimelineElement";

const SNAP_THRESHOLD = 15;

const Tooltip = ({ info }: { info: { visible: boolean; content: string; x: number; y: number } | null }) => {
    if (!info || !info.visible) return null;
    return ReactDOM.createPortal(
        <div
            className="fixed top-0 left-0 bg-black text-white px-2 py-1 rounded-md text-xs z-[9999] pointer-events-none"
            style={{ transform: `translate3d(${info.x}px, ${info.y}px, 0)` }}
        >
            {info.content}
        </div>,
        document.body
    );
};

const TextClipItem = memo(({
    clip,
    timelineZoom,
    isSnappingEnabled,
    verticalGuidelines,
    isSelected,
    activeElementsLength
}: {
    clip: TextElement & { zIndex: number };
    timelineZoom: number;
    isSnappingEnabled: boolean;
    verticalGuidelines: number[];
    isSelected: (clipId: string) => boolean;
    activeElementsLength: number;
}) => {
    const [target, setTarget] = useState<HTMLDivElement | null>(null);
    const moveableRef = useRef<Moveable | null>(null);

    const moveableProps = useTimelineElement({
        clip,
        elementType: 'text',
    });
    
    const { resizeInfo, isAtLimit } = moveableProps;

    useEffect(() => {
        moveableRef.current?.updateRect();
    }, [timelineZoom, clip.positionStart, clip.positionEnd]);

    useEffect(() => {
        const moveableInstance = moveableRef.current;
        if (moveableInstance) {
            const controlBox = (moveableInstance as any).controlBox;
            if(controlBox) {
                const controlElements = controlBox.getElementsByClassName('moveable-control');
                for (let i = 0; i < controlElements.length; i++) {
                    const control = controlElements[i] as HTMLElement;
                    if (isAtLimit) {
                        control.style.backgroundColor = 'red';
                    } else {
                        control.style.backgroundColor = '';
                    }
                }
            }
        }
    }, [isAtLimit]);

    return (
        <div className="relative z-10">
            <Tooltip info={resizeInfo} />
            <div
                data-element-id={clip.id}
                ref={setTarget}
                className={`absolute border border-gray-500 border-opacity-50 rounded-md top-4 h-12 rounded bg-[#27272A] text-white text-sm flex items-center justify-center cursor-pointer ${isSelected(clip.id) ? 'bg-[#3F3F46] border-blue-500' : ''}`}
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
                    src="/icons/text.svg"
                />
                <span className="truncate text-x">{clip.content}</span>
            </div>
            <Moveable
                ref={moveableRef}
                target={target}
                container={null}
                renderDirections={isSelected(clip.id) && activeElementsLength === 1 ? ['w', 'e'] : []}
                draggable={true}
                throttleDrag={0}
                rotatable={false}
                resizable={true}
                throttleResize={0}
                {...moveableProps}
                snappable={isSnappingEnabled}
                verticalGuidelines={verticalGuidelines}
                snapDirections={{ "left": true, "right": true, "top": false, "bottom": false, "center": false, "middle": false }}
                elementSnapDirections={{ "left": true, "right": true }}
                snapThreshold={SNAP_THRESHOLD}
            />
        </div>
    );
});
TextClipItem.displayName = 'TextClipItem';

export default function TextTimeline({ trackId, trackIndex, totalTracks }: { trackId: string, trackIndex: number, totalTracks: number }) {
    const targetRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const { mediaFiles, textElements, activeElements, timelineZoom, isSnappingEnabled, currentTime, activeGap, duration } = useAppSelector((state) => state.projectState);
    const dispatch = useDispatch();
    const moveableRef = useRef<Record<string, Moveable | null>>({});

    const sortedTextElements = useMemo(() =>
        [...textElements].filter(clip => clip.trackId === trackId).sort((a, b) => a.positionStart - b.positionStart),
        [textElements, trackId]
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

    const { tickInterval } = useMemo(() => {
        if (timelineZoom < 2) return { tickInterval: 45 };
        if (timelineZoom < 800) return { tickInterval: 0.05 };
        return { tickInterval: 0.02 };
    }, [timelineZoom]);

    const verticalGuidelines = useMemo(() => {
        if (!isSnappingEnabled) return [];
        const points: number[] = [0, currentTime * timelineZoom];
        const draggedIds = new Set(activeElements.map(e => e.id));
        const totalSeconds = Math.max(duration + 2, 61);
        const tickMarkers = Array.from({ length: Math.ceil(totalSeconds / tickInterval) }, (_, i) => i * tickInterval);
        tickMarkers.forEach(tick => points.push(tick * timelineZoom));
        mediaFiles.forEach(clip => {
            points.push(clip.positionStart * timelineZoom, clip.positionEnd * timelineZoom);
        });
        textElements.forEach(text => {
            if (!draggedIds.has(text.id)) {
                points.push(text.positionStart * timelineZoom, text.positionEnd * timelineZoom);
            }
        });
        return Array.from(new Set(points));
    }, [isSnappingEnabled, currentTime, timelineZoom, mediaFiles, textElements, activeElements, duration, tickInterval]);

    const handleGapClick = (gap: { start: number, end: number }, e: React.MouseEvent) => {
        e.stopPropagation();
        dispatch(resetActiveElements());
        dispatch(setActiveGap({ ...gap, trackId, trackType: 'text' }));
    };

    const isSelected = (clipId: string) => activeElements.some(el => el.id === clipId);

    useEffect(() => {
        for (const clip of textElements) {
            if (targetRefs.current[clip.id]) {
                moveableRef.current[clip.id]?.updateRect();
            }
        }
    }, [timelineZoom, textElements]);

    return (
        <div className="relative h-full w-full">
            {gaps.map((gap, index) => (
                <div
                    key={`gap-text-${index}`}
                    className={`absolute top-0 h-full z-0 ${activeGap?.trackId === trackId && activeGap?.start === gap.start ? 'bg-yellow-500 bg-opacity-30 border-2 border-yellow-500' : 'hover:bg-gray-500 hover:bg-opacity-20'}`}
                    style={{
                        left: `${gap.start * timelineZoom}px`,
                        width: `${(gap.end - gap.start) * timelineZoom}px`,
                    }}
                    onClick={(e) => handleGapClick(gap, e)}
                />
            ))}
            {sortedTextElements.map((clip) => {
                const baseZIndex = (totalTracks - trackIndex - 1) * 10;
                const finalZIndex = baseZIndex + (clip.layerOrder || 0);
                return (
                    <TextClipItem
                        key={clip.id}
                        clip={{...clip, zIndex: finalZIndex}}
                        timelineZoom={timelineZoom}
                        isSnappingEnabled={isSnappingEnabled}
                        verticalGuidelines={verticalGuidelines}
                        isSelected={isSelected}
                        activeElementsLength={activeElements.length}
                    />
                );
            })}
        </div>
    );
}

memo(TextTimeline);
