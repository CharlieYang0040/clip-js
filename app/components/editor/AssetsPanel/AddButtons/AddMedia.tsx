"use client";

import { getFile, useAppDispatch, useAppSelector } from "../../../../store";
import { setMediaFiles } from "../../../../store/slices/projectSlice";
import { storeFile } from "../../../../store";
import { categorizeFile } from "../../../../utils/utils";
import Image from 'next/image';
import toast from 'react-hot-toast';

export default function AddMedia({ fileId }: { fileId: string }) {
    const { mediaFiles, tracks } = useAppSelector((state) => state.projectState);
    const dispatch = useAppDispatch();

    const handleFileChange = async () => {
        const file = await getFile(fileId);
        if (!fileId || !file) {
            toast.error("File not found.");
            return;
        }

        const mediaType = categorizeFile(file.type);
        if (mediaType === 'unknown') {
            toast.error(`Unsupported file type for: ${file.name}`);
            return;
        }

        const targetTrack = tracks.find(track => track.type === mediaType);

        if (!targetTrack) {
            toast.error(`Please create a ${mediaType} track first.`);
            return;
        }

        const relevantClips = mediaFiles.filter(clip => clip.trackId === targetTrack.id);
        const lastEnd = relevantClips.length > 0
            ? Math.max(...relevantClips.map(f => f.positionEnd))
            : 0;

        let duration = 5; // Default for images
        let width = 1920; // Default width, fallback
        let height = 1080; // Default height, fallback

        const objectUrl = URL.createObjectURL(file);

        try {
            if (mediaType === 'video') {
                const video = await new Promise<HTMLVideoElement>((resolve, reject) => {
                    const videoElement = document.createElement('video');
                    videoElement.onloadedmetadata = () => resolve(videoElement);
                    videoElement.onerror = (e) => reject(`Could not read metadata from ${file.name}`);
                    videoElement.src = objectUrl;
                });
                duration = video.duration;
                width = video.videoWidth;
                height = video.videoHeight;
            } else if (mediaType === 'audio') {
                const audio = await new Promise<HTMLAudioElement>((resolve, reject) => {
                    const audioElement = document.createElement('audio');
                    audioElement.onloadedmetadata = () => resolve(audioElement);
                    audioElement.onerror = (e) => reject(`Could not read metadata from ${file.name}`);
                    audioElement.src = objectUrl;
                });
                duration = audio.duration;
                width = 0;
                height = 0;
            } else if (mediaType === 'image') {
                const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                    const imgElement = new window.Image();
                    imgElement.onload = () => resolve(imgElement);
                    imgElement.onerror = (e) => reject(`Could not read dimensions from ${file.name}`);
                    imgElement.src = objectUrl;
                });
                width = img.naturalWidth;
                height = img.naturalHeight;
            }
        } catch (error) {
            toast.error(String(error));
            console.error("Error processing media:", error);
            URL.revokeObjectURL(objectUrl); // Clean up
            return;
        }

        const newMediaFile = {
            id: crypto.randomUUID(),
            fileName: file.name,
            url: fileId,
            src: objectUrl,
            type: mediaType,
            trackId: targetTrack.id,
            positionStart: lastEnd,
            positionEnd: lastEnd + duration,
            startTime: 0,
            endTime: duration,
            sourceDuration: duration,
            x: 0,
            y: 0,
            layerOrder: 0,
            opacity: 100,
            volume: mediaType === 'audio' || mediaType === 'video' ? 100 : 0,
        };

        dispatch(setMediaFiles([...mediaFiles, newMediaFile]));
        toast.success('Media added to timeline.');
    };

    return (
        <div>
            <label
                className="cursor-pointer rounded-full bg-white border border-solid border-transparent transition-colors flex flex-col items-center justify-center text-gray-800 hover:bg-[#ccc] dark:hover:bg-[#ccc] font-medium sm:text-base py-2 px-2"
            >
                <Image
                    alt="Add to Timeline"
                    className="Black"
                    height={12}
                    width={12}
                    src="/icons/add.svg"
                />
                <button
                    onClick={handleFileChange}
                    className="hidden"
                >
                </button>
            </label>
        </div>
    );
}
