import { Player, PlayerRef } from "@remotion/player";
import Composition from "./sequence/composition";
import { useAppSelector, useAppDispatch } from "@/app/store";
import { useRef, useState, useEffect } from "react";
import { setIsPlaying, setCurrentTime, setIsMuted } from "@/app/store/slices/projectSlice";
import Image from "next/image";

const fps = 30;

const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const PreviewPlayer = () => {
    const projectState = useAppSelector((state) => state.projectState);
    const { duration, currentTime, isPlaying, isMuted } = projectState;
    const playerRef = useRef<PlayerRef>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);
    const wasPlayingRef = useRef(false);
    const dispatch = useAppDispatch();
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [isSeeking, setIsSeeking] = useState(false);
    const [seekTime, setSeekTime] = useState<number | null>(null);

    const displayTime = seekTime ?? currentTime;

    useEffect(() => {
        const frame = Math.round(currentTime * fps);
        if (playerRef.current && !isPlaying && !isSeeking) {
            playerRef.current.seekTo(frame);
        }
    }, [currentTime, isPlaying, isSeeking]);

    useEffect(() => {
        if (!playerRef.current) return;
        if (isPlaying) {
            playerRef.current.play();
        } else {
            playerRef.current.pause();
        }
    }, [isPlaying]);

    useEffect(() => {
        if (!playerRef.current) return;
        if (isMuted) {
            playerRef.current.mute();
        } else {
            playerRef.current.unmute();
        }
    }, [isMuted]);

    useEffect(() => {
        const player = playerRef.current;
        if (!player) return;

        const onTimeUpdate = (e: any) => {
            if (!isSeeking) {
                dispatch(setCurrentTime(e.detail.frame / fps));
            }
        };
        const onPlay = () => dispatch(setIsPlaying(true));
        const onPause = () => dispatch(setIsPlaying(false));

        player.addEventListener('timeupdate', onTimeUpdate);
        player.addEventListener('play', onPlay);
        player.addEventListener('pause', onPause);

        return () => {
            player.removeEventListener('timeupdate', onTimeUpdate);
            player.removeEventListener('play', onPlay);
            player.removeEventListener('pause', onPause);
        };
    }, [dispatch, isSeeking]);

    const handleScrub = (e: MouseEvent) => {
        if (progressBarRef.current && playerRef.current) {
            const rect = progressBarRef.current.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const width = rect.width;
            const newTime = Math.max(0, Math.min((clickX / width) * duration, duration));
            setSeekTime(newTime);
            playerRef.current.seekTo(Math.round(newTime * fps));
        }
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isSeeking) {
                handleScrub(e);
            }
        };

        const handleMouseUp = () => {
            if (isSeeking) {
                setIsSeeking(false);
                if (seekTime !== null) {
                    dispatch(setCurrentTime(seekTime));
                }
                setSeekTime(null);
                if (wasPlayingRef.current) {
                    dispatch(setIsPlaying(true));
                }
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isSeeking, dispatch, duration, seekTime]);

    const handlePlayPauseClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        dispatch(setIsPlaying(!isPlaying));
    };
    
    const handleMuteToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        dispatch(setIsMuted(!isMuted));
    };

    const handleFullscreenToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!containerRef.current) return;
        if (!isFullScreen) {
            containerRef.current.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    };
    
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullScreen(document.fullscreenElement !== null);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    if (typeof duration !== 'number' || isNaN(duration) || duration <= 0) {
        return (
            <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                <p className="text-gray-400">Add media to the timeline to start editing.</p>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="relative w-full h-full bg-black group" onClick={handlePlayPauseClick}>
            <Player
                ref={playerRef}
                component={Composition}
                inputProps={{}}
                durationInFrames={Math.max(1, Math.floor((duration || 0) * fps) + 1)}
                compositionWidth={1920}
                compositionHeight={1080}
                fps={fps}
                style={{ width: "100%", height: "100%" }}
                controls={false}
                clickToPlay={false}
                acknowledgeRemotionLicense
            />
             <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="flex items-center gap-4 text-white">
                    <button onClick={handlePlayPauseClick} className="p-1">
                        <Image src={isPlaying ? "/icons/pause.svg" : "/icons/play.svg"} alt="Play/Pause" width={20} height={20} className="invert" />
                    </button>
                    <div className="flex-grow">
                        <div
                            ref={progressBarRef}
                            className="bg-gray-500/50 h-1.5 rounded-full cursor-pointer"
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                setIsSeeking(true);
                                wasPlayingRef.current = isPlaying;
                                dispatch(setIsPlaying(false));
                                handleScrub(e.nativeEvent);
                            }}
                        >
                            <div className="bg-white h-full rounded-full pointer-events-none" style={{ width: `${(displayTime / duration) * 100}%` }}></div>
                        </div>
                    </div>
                    <div className="text-xs font-mono">{formatTime(displayTime)} / {formatTime(duration)}</div>
                    <button onClick={handleMuteToggle} className="p-1">
                        <Image src={isMuted ? "/icons/volume-off.svg" : "/icons/volume-up.svg"} alt="Mute/Unmute" width={20} height={20} className="invert" />
                    </button>
                    <button onClick={handleFullscreenToggle} className="p-1">
                        <Image src={isFullScreen ? "/icons/fullscreen-exit.svg" : "/icons/fullscreen-alt.svg"} alt="Fullscreen" width={20} height={20} className="invert" />
                    </button>
                </div>
            </div>
        </div>
    )
};