import { storeProject, useAppDispatch, useAppSelector } from "@/app/store";
import { SequenceItem } from "./sequence-item";
import { MediaFile, TextElement } from "@/app/types";
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { use, useCallback, useEffect, useRef, useState } from "react";
import { setCurrentTime, setMediaFiles } from "@/app/store/slices/projectSlice";

const Composition = () => {
    const projectState = useAppSelector((state) => state.projectState);
    const { mediaFiles, textElements, currentTime } = projectState;
    const frame = useCurrentFrame();
    const dispatch = useAppDispatch();

    const THRESHOLD = 0.1; // Minimum change to trigger dispatch (in seconds)
    const previousTime = useRef(0); // Store previous time to track changes
    const lastDispatchTime = useRef(0); // Track last dispatch time
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const fps = 30;
        const currentTimeInSeconds = frame / fps;
        
        // Clear existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        
        // Only update if the change is significant and different from current state
        if (Math.abs(currentTimeInSeconds - previousTime.current) > THRESHOLD && 
            Math.abs(currentTimeInSeconds - currentTime) > THRESHOLD) {
            
            // Debounce the dispatch to prevent too frequent updates
            timeoutRef.current = setTimeout(() => {
                const now = Date.now();
                // Prevent dispatches that are too frequent (minimum 50ms between dispatches)
                if (now - lastDispatchTime.current > 50) {
                    dispatch(setCurrentTime(currentTimeInSeconds));
                    lastDispatchTime.current = now;
                }
            }, 16); // ~60fps throttling
            
            // Update the previous time reference
            previousTime.current = currentTimeInSeconds;
        }

        // Cleanup function
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [frame, dispatch, currentTime]);

    const fps = 30;
    return (
        <>
            {mediaFiles
                .filter((item: MediaFile) => item && item.src)
                .map((item: MediaFile) => {
                    const trackItem = {
                        ...item,
                    } as MediaFile;
                    return SequenceItem[trackItem.type](trackItem, {
                        fps
                    });
                })}
            {textElements
                .map((item: TextElement) => {
                    if (!item) return;
                    const trackItem = {
                        ...item,
                    } as TextElement;
                    return SequenceItem["text"](trackItem, {
                        fps
                    });
                })}
        </>
    );
};

export default Composition;
