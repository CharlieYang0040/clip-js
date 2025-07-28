'use client'

import FfmpegRender from "./FfmpegRender";
import RenderOptions from "./RenderOptions";

export default function Ffmpeg() {
    // All FFmpeg loading logic is removed as it's now handled by the server.

    return (
        <div className="flex flex-col justify-center items-center py-2">
            <RenderOptions />
            {/* The props for FFmpeg loading are no longer needed */}
            <FfmpegRender />
        </div>
    );
}
