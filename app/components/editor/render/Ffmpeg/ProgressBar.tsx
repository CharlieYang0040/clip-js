import { FFmpeg } from '@ffmpeg/ffmpeg';
import { useAppSelector } from '@/app/store';
import { useEffect, useState } from 'react';

export default function FfmpegProgressBar({ ffmpeg }: { ffmpeg: FFmpeg }) {
    const { duration } = useAppSelector(state => state.projectState);
    const [progress, setProgress] = useState(0);
    const [message, setMessage] = useState('Starting render...');

    useEffect(() => {
        const handleLog = (log: { message: string }) => {
            const timeMatch = log.message.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
            if (timeMatch) {
                const hours = parseInt(timeMatch[1], 10);
                const minutes = parseInt(timeMatch[2], 10);
                const seconds = parseInt(timeMatch[3], 10);
                const milliseconds = parseInt(timeMatch[4], 10) * 10;
                const currentTime = hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;

                if (duration > 0) {
                    const percentage = Math.round((currentTime / duration) * 100);
                    setProgress(Math.min(100, percentage));
                    setMessage(`Processing: ${percentage}%`);
                }
            }
        };

        ffmpeg.on('log', handleLog);

        return () => {
            ffmpeg.off('log', handleLog);
        };
    }, [ffmpeg, duration]);

    return (
        <div>
            <div className="text-white text-sm font-semibold mb-1 text-center">{message}</div>
            <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden border border-gray-600">
                <div
                    className="bg-gradient-to-r from-blue-500 to-purple-600 h-full rounded-full transition-all duration-200 ease-linear"
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
}
