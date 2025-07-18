"use client";

import { useEffect, useState } from "react";
import { getFile, RootState } from "@/app/store";
import { categorizeFile } from "@/app/utils/utils";
import Image from 'next/image';
import { MediaFile, MediaType, Track } from "@/app/types";
import { useAppDispatch, useAppSelector } from "@/app/store";
import { setMediaFiles } from "@/app/store/slices/projectSlice";

// A simple cache for file metadata
const metadataCache = new Map<string, any>();

export default function AssetItem({ fileId }: { fileId: string }) {
    const [file, setFile] = useState<File | null>(null);
    const [mediaType, setMediaType] = useState<MediaType>('unknown');
    const [thumbnail, setThumbnail] = useState<string | null>(null);
    const [duration, setDuration] = useState<number>(0);
    const dispatch = useAppDispatch();
    const { tracks, mediaFiles } = useAppSelector((state: RootState) => state.projectState);

    useEffect(() => {
        const fetchFile = async () => {
            const cached = metadataCache.get(fileId);
            if (cached) {
                setFile(cached.file);
                setMediaType(cached.mediaType);
                setThumbnail(cached.thumbnail);
                setDuration(cached.duration);
                return;
            }

            const fetchedFile = await getFile(fileId);
            if (fetchedFile) {
                const type = categorizeFile(fetchedFile.type);
                setFile(fetchedFile);
                setMediaType(type);

                let thumb: string | null = null;
                let dur = 0;

                const objectUrl = URL.createObjectURL(fetchedFile);

                try {
                    if (type === 'video') {
                        thumb = await createVideoThumbnail(objectUrl);
                        dur = await getMediaDuration(objectUrl, 'video');
                    } else if (type === 'audio') {
                        thumb = "https://www.svgrepo.com/show/532708/music.svg"; // Default audio icon
                        dur = await getMediaDuration(objectUrl, 'audio');
                    } else if (type === 'image') {
                        thumb = objectUrl;
                        dur = 5; // Default duration for images
                    }
                } catch (error) {
                    console.error("Error generating metadata for", fetchedFile.name, error);
                }

                setThumbnail(thumb);
                setDuration(dur);

                metadataCache.set(fileId, { file: fetchedFile, mediaType: type, thumbnail: thumb, duration: dur });
            }
        };
        fetchFile();
    }, [fileId]);

    const handleClick = () => {
        if (!file || mediaType === 'unknown') {
            if (mediaType === 'unknown') console.error("Cannot add file of unknown type");
            return;
        }

        const targetTrack = tracks.find((track: Track) => track.type === mediaType);

        if (!targetTrack) {
            console.error(`No track found for media type: ${mediaType}`);
            return;
        }

        const lastMediaFile = mediaFiles
            .filter((mf: MediaFile) => mf.trackId === targetTrack.id)
            .sort((a: MediaFile, b: MediaFile) => b.positionEnd - a.positionEnd)[0];

        const positionStart = lastMediaFile ? lastMediaFile.positionEnd : 0;
        const positionEnd = positionStart + duration;

        const newMediaFile: MediaFile = {
            id: crypto.randomUUID(),
            fileName: file.name,
            url: fileId,
            type: mediaType,
            trackId: targetTrack.id,
            positionStart,
            positionEnd,
            startTime: 0,
            endTime: duration,
            sourceDuration: duration,
            layerOrder: 0,
            x: 0, y: 0, opacity: 100,
        };

        dispatch(setMediaFiles([...mediaFiles, newMediaFile]));
    };

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        if (!file || mediaType === 'unknown') return;

        const newMediaFile: Omit<MediaFile, 'id' | 'trackId' | 'positionStart' | 'positionEnd'> = {
            fileName: file.name,
            url: fileId,
            type: mediaType,
            startTime: 0,
            endTime: duration,
            sourceDuration: duration,
            layerOrder: 0,
            x: 0, y: 0, opacity: 100,
        };

        const dragData = {
            file: newMediaFile,
            type: mediaType,
        };
        e.dataTransfer.setData("application/json", JSON.stringify(dragData));
        e.dataTransfer.effectAllowed = "move";
    };

    if (!file) {
        return <div className="aspect-square bg-gray-700 animate-pulse rounded-md"></div>;
    }

    return (
        <div
            draggable={true}
            onClick={handleClick}
            onDragStart={handleDragStart}
            className="group relative aspect-square bg-gray-800 rounded-md cursor-pointer active:cursor-grabbing flex items-center justify-center p-1"
        >
            {thumbnail ? (
                <Image
                    src={thumbnail}
                    alt={file.name}
                    layout="fill"
                    objectFit="cover"
                    className="rounded-md"
                />
            ) : (
                <div className="text-white text-xs text-center">Loading...</div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate">
                {file.name}
            </div>
        </div>
    );
}

const createVideoThumbnail = (videoUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.crossOrigin = "anonymous";
        const canvas = document.createElement('canvas');
        video.onloadedmetadata = () => {
            video.currentTime = Math.min(1, video.duration / 2); // Capture frame at 1s or midpoint
        };
        video.onseeked = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL());
            } else {
                reject("Could not get canvas context");
            }
            URL.revokeObjectURL(video.src);
        };
        video.onerror = (e) => {
            reject(`Error loading video for thumbnail: ${e}`);
        };
        video.src = videoUrl;
    });
};

const getMediaDuration = (mediaUrl: string, type: 'video' | 'audio'): Promise<number> => {
    return new Promise((resolve, reject) => {
        const media = document.createElement(type);
        media.onloadedmetadata = () => {
            resolve(media.duration);
            URL.revokeObjectURL(media.src);
        };
        media.onerror = (e) => reject(`Error loading media for duration: ${e}`);
        media.src = mediaUrl;
    });
}; 