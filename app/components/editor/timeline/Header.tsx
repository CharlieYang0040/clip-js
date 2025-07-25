import React, { useMemo } from 'react';
import { useAppSelector } from '../../../store';

export const Header = ({ onDragStart }: { onDragStart?: (e: React.MouseEvent<HTMLDivElement>) => void }) => {
    const { duration, timelineZoom } = useAppSelector((state) => state.projectState);

    const { tickInterval, majorTickMultiplier, labelPrecision } = useMemo(() => {
        if (timelineZoom < 2) return { tickInterval: 45, majorTickMultiplier: 2, labelPrecision: 0 };
        if (timelineZoom < 3) return { tickInterval: 30, majorTickMultiplier: 2, labelPrecision: 0 };
        if (timelineZoom < 4) return { tickInterval: 20, majorTickMultiplier: 3, labelPrecision: 0 };
        if (timelineZoom < 5) return { tickInterval: 15, majorTickMultiplier: 2, labelPrecision: 0 };
        if (timelineZoom < 6) return { tickInterval: 12, majorTickMultiplier: 2.5, labelPrecision: 0 };
        if (timelineZoom < 10) return { tickInterval: 10, majorTickMultiplier: 2, labelPrecision: 0 };
        if (timelineZoom < 15) return { tickInterval: 5, majorTickMultiplier: 2, labelPrecision: 0 };
        if (timelineZoom < 25) return { tickInterval: 2, majorTickMultiplier: 2.5, labelPrecision: 0 };
        if (timelineZoom < 50) return { tickInterval: 1, majorTickMultiplier: 5, labelPrecision: 0 };
        if (timelineZoom < 100) return { tickInterval: 0.5, majorTickMultiplier: 2, labelPrecision: 1 };
        if (timelineZoom < 200) return { tickInterval: 0.2, majorTickMultiplier: 2.5, labelPrecision: 1 };
        if (timelineZoom < 400) return { tickInterval: 0.1, majorTickMultiplier: 5, labelPrecision: 1 };
        if (timelineZoom < 800) return { tickInterval: 0.05, majorTickMultiplier: 4, labelPrecision: 2 };
        return { tickInterval: 0.02, majorTickMultiplier: 5, labelPrecision: 2 };
    }, [timelineZoom]);

    const totalSeconds = Math.max(duration + 2, 61);
    const tickMarkers = Array.from({ length: Math.ceil(totalSeconds / tickInterval) }, (_, i) => i * tickInterval);

    return (
        <div className="relative w-full h-full">
            {/* Interaction Layer */}
            <div
                className="absolute top-0 left-0 w-full h-full cursor-ew-resize z-10"
                onMouseDown={onDragStart}
            />

            {/* Visual Layer */}
            <div className="relative h-8 pointer-events-none">
                {tickMarkers.map((marker) => {
                    const tolerance = 0.00001;
                    const isMajorTick = Math.abs((marker / (tickInterval * majorTickMultiplier)) % 1) < tolerance || marker === 0;

                    return (
                        <div
                            key={marker}
                            className="absolute flex flex-col items-center"
                            style={{
                                left: `${marker * timelineZoom}px`,
                                width: `1px`,
                                height: '100%',
                            }}
                        >
                            <div className={`w-px ${isMajorTick ? 'h-7 bg-gray-400' : 'h-2 bg-gray-300'}`} />
                            {isMajorTick && (
                                <span className="mt-1 text-[10px] text-gray-400">
                                    {marker.toFixed(labelPrecision)}s
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Header; 