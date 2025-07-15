"use client";

import { getFile, useAppDispatch, useAppSelector } from "../../../../store";
import { setMediaFiles } from "../../../../store/slices/projectSlice";
import { storeFile } from "../../../../store";
import { categorizeFile } from "../../../../utils/utils";
import Image from 'next/image';
import toast from 'react-hot-toast';

export default function AddMedia({ fileId }: { fileId: string }) {
    const { mediaFiles } = useAppSelector((state) => state.projectState);
    const dispatch = useAppDispatch();

    const handleFileChange = async () => {
        const updatedMedia = [...mediaFiles];

        const file = await getFile(fileId);
        const mediaId = crypto.randomUUID();

        if (fileId && file) {
            const relevantClips = mediaFiles.filter(clip => clip.type === categorizeFile(file.type));
            const lastEnd = relevantClips.length > 0
                ? Math.max(...relevantClips.map(f => f.positionEnd))
                : 0;

            let duration = 5; // Default for images
            let width = 1920; // Default width, fallback
            let height = 1080; // Default height, fallback
            
            const mediaType = categorizeFile(file.type);
            if (mediaType === 'unknown') {
                toast.error(`Unsupported file type for: ${file.name}`);
                return;
            }

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
                    // Audio has no visual dimensions, but we might set defaults if needed
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
                    // Default duration for images is already 5s
                }
            } catch (error) {
                toast.error(String(error));
                console.error("Error processing media:", error);
                URL.revokeObjectURL(objectUrl); // Clean up
                return;
            }

            updatedMedia.push({
                id: mediaId,
                fileName: file.name,
                url: fileId,
                src: objectUrl,
                type: mediaType,
                positionStart: lastEnd,
                positionEnd: lastEnd + duration,
                startTime: 0,
                endTime: duration,
                sourceDuration: duration,
                zIndex: 0,
                width: width,
                height: height,
                x: 0,
                y: 0,
                opacity: 100,
                volume: mediaType === 'audio' || mediaType === 'video' ? 100 : 0,
            });
        }
        dispatch(setMediaFiles(updatedMedia));
        toast.success('Media added successfully.');
    };

    return (
        <div
        >
            <label
                className="cursor-pointer rounded-full bg-white border border-solid border-transparent transition-colors flex flex-col items-center justify-center text-gray-800 hover:bg-[#ccc] dark:hover:bg-[#ccc] font-medium sm:text-base py-2 px-2"
            >
                <Image
                    alt="Add Project"
                    className="Black"
                    height={12}
                    width={12}
                    src="https://www.svgrepo.com/show/513803/add.svg"
                />
                {/* <span className="text-xs">Add Media</span> */}
                <button
                    onClick={handleFileChange}
                >
                </button>
            </label>
        </div>
    );
}

const getMediaDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
        const media = file.type.startsWith('video/') ? document.createElement('video') : document.createElement('audio');
        media.src = URL.createObjectURL(file);
        media.addEventListener('loadedmetadata', () => {
            resolve(media.duration);
        });
        media.load();
    });
};
