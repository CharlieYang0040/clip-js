"use client";

import { getFile, useAppDispatch, useAppSelector } from "../../../../store";
import { setMediaFiles } from "../../../../store/slices/projectSlice";
import { storeFile } from "../../../../store";
import { categorizeFile } from "../../../../utils/utils";
import Image from 'next/image';
import { toast } from 'react-hot-toast';


export default function AddMedia({ fileId }: { fileId: string }) {
    const { mediaFiles, tracks, currentTime } = useAppSelector((state) => state.projectState);
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

        let duration = 5; // Default for images
        let width = 1920; // Default width, fallback
        let height = 1080; // Default height, fallback

        const objectUrl = URL.createObjectURL(file);

        try {
            if (mediaType === 'video') {
                const video = document.createElement('video');
                video.src = objectUrl;
                await new Promise((resolve) => {
                    video.onloadedmetadata = () => {
                        duration = video.duration;
                        width = video.videoWidth;
                        height = video.videoHeight;
                        resolve(null);
                    };
                });
                video.remove();
            } else if (mediaType === 'audio') {
                const audio = document.createElement('audio');
                audio.src = objectUrl;
                await new Promise((resolve) => {
                    audio.onloadedmetadata = () => {
                        duration = audio.duration;
                        resolve(null);
                    };
                });
                audio.remove();
            } else if (mediaType === 'image') {
                const img = document.createElement('img');
                img.src = objectUrl;
                await new Promise((resolve) => {
                    img.onload = () => {
                        width = img.naturalWidth;
                        height = img.naturalHeight;
                        resolve(null);
                    };
                });
                img.remove();
            }
        } catch (error) {
            console.error("Error loading media metadata:", error);
            toast.error("Failed to load media metadata. Using default values.");
        }

        const newMediaFile = {
            id: crypto.randomUUID(),
            fileName: file.name,
            url: fileId,
            src: objectUrl,
            type: mediaType,
            trackId: targetTrack.id,
            positionStart: currentTime,
            positionEnd: currentTime + duration,
            startTime: 0,
            endTime: duration,
            sourceDuration: duration,
            x: 0,
            y: 0,
            width,
            height,
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
