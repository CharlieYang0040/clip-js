import { AbsoluteFill, OffthreadVideo, Audio, Img, Sequence } from "remotion";
import { MediaFile, TextElement } from "@/app/types";

const REMOTION_SAFE_FRAME = 0;

interface SequenceItemOptions {
    handleTextChange?: (id: string, text: string) => void;
    fps: number;
    editableTextId?: string | null;
    currentTime?: number;
}

const calculateFrames = (
    display: { from: number; to: number },
    fps: number
) => {
    const from = display.from * fps;
    const to = display.to * fps;
    const durationInFrames = Math.max(1, to - from);
    return { from, durationInFrames };
};

export const SequenceItem: Record<
    string,
    (item: any, options: SequenceItemOptions) => JSX.Element> = {
    video: (item: MediaFile & { zIndex: number }, options: SequenceItemOptions) => {
        const { fps } = options;

        const playbackRate = item.playbackSpeed || 1;
        const { from, durationInFrames } = calculateFrames(
            {
                from: item.positionStart,
                to: item.positionEnd
            },
            fps
        );

        // TODO: Add crop
        // const crop = item.crop || {
        //     x: 0,
        //     y: 0,
        //     width: item.width,
        //     height: item.height
        // };

        const trim = {
            from: (item.startTime) / playbackRate,
            to: (item.endTime) / playbackRate
        };

        return (
            <Sequence
                key={item.id}
                from={from}
                durationInFrames={durationInFrames + REMOTION_SAFE_FRAME}
                style={{ pointerEvents: "none" }}
            >
                <AbsoluteFill
                    data-track-item="transition-element"
                    className={`designcombo-scene-item id-${item.id} designcombo-scene-item-type-${item.type}`}
                    style={{
                        pointerEvents: "auto",
                        top: item.y ?? 0,
                        left: item.x ?? 0,
                        width: "100%",
                        height: "100%",
                        transform: "none",
                        zIndex: item.zIndex,
                        opacity:
                            item?.opacity !== undefined
                                ? item.opacity / 100
                                : 1,
                        borderRadius: `10px`, // Default border radius
                        overflow: "hidden",
                    }}
                >
                    <OffthreadVideo
                        startFrom={(trim.from) * fps}
                        endAt={(trim.to) * fps + REMOTION_SAFE_FRAME}
                        playbackRate={playbackRate}
                        src={item.src || ""}
                        volume={item.volume !== undefined ? item.volume / 100 : 1}
                        style={{
                            pointerEvents: "none",
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            position: "absolute"
                        }}
                    />
                </AbsoluteFill>
            </Sequence>
        );
    },
    text: (item: TextElement & { zIndex: number }, options: SequenceItemOptions) => {
        const { handleTextChange, fps, editableTextId } = options;


        const { from, durationInFrames } = calculateFrames(
            {
                from: item.positionStart,
                to: item.positionEnd
            },
            fps
        );

        // TODO: add more options for text
        return (
            <Sequence
                className={`designcombo-scene-item id-${item.id} designcombo-scene-item-type-text pointer-events-none`}
                key={item.id}
                from={from}
                durationInFrames={durationInFrames + REMOTION_SAFE_FRAME}
                data-track-item="transition-element"
                style={{
                    position: "absolute",
                    width: item.width || 3000,
                    height: item.height || 400,
                    fontSize: item.fontSize || "16px",
                    top: item.y,
                    left: item.x,
                    color: item.color || "#000000",
                    // backgroundColor: item.backgroundColor || "transparent",
                    opacity:
                            item?.opacity !== undefined
                                ? item.opacity / 100
                                : 1,
                    fontFamily: item.fontFamily || "Arial",
                }}
            >
                <div
                    data-text-id={item.id}
                    style={{
                        height: "100%",
                        boxShadow: "none",
                        outline: "none",
                        whiteSpace: "normal",
                        backgroundColor: item.backgroundColor || "transparent",
                        zIndex: item.zIndex || 0,
                        position: "relative",
                        width: "100%",
                    }}
                    dangerouslySetInnerHTML={{ __html: item.content }}
                    className="designcombo_textLayer"
                />
            </Sequence>
        );
    },
    image: (item: MediaFile & { zIndex: number }, options: SequenceItemOptions) => {
        const { fps } = options;

        const { from, durationInFrames } = calculateFrames(
            {
                from: item.positionStart,
                to: item.positionEnd
            },
            fps
        );

        const crop = item.crop || {
            x: 0,
            y: 0,
            width: item.width,
            height: item.height
        };

        return (
            <Sequence
                key={item.id}
                from={from}
                durationInFrames={durationInFrames + REMOTION_SAFE_FRAME}
                style={{ pointerEvents: "none" }}
            >
                <AbsoluteFill
                    data-track-item="transition-element"
                    className={`designcombo-scene-item id-${item.id} designcombo-scene-item-type-${item.type}`}
                    style={{
                        pointerEvents: "auto",
                        top: item.y,
                        left: item.x,
                        width: "100%",
                        height: "100%",
                        // transform: item?.transform || "none",
                        opacity:
                            item?.opacity !== undefined
                                ? item.opacity / 100
                                : 1,
                        overflow: "hidden",
                    }}
                >
                    <Img
                        style={{
                            pointerEvents: "none",
                            width: "100%",
                            height: "100%",
                            objectFit: 'contain',
                            position: "absolute",
                            zIndex: item.zIndex || 0,
                        }}
                        data-id={item.id}
                        src={item.src || ""}
                    />
                </AbsoluteFill>
            </Sequence>
        );
    },
    audio: (item: MediaFile, options: SequenceItemOptions) => {
        const { fps } = options;
        const playbackRate = item.playbackSpeed || 1;
        const { from, durationInFrames } = calculateFrames(
            {
                from: item.positionStart,
                to: item.positionEnd
            },
            fps
        );

        const trim = {
            from: (item.startTime) / playbackRate,
            to: (item.endTime) / playbackRate
        };
        return (
            <Sequence
                key={item.id}
                from={from}
                durationInFrames={durationInFrames + REMOTION_SAFE_FRAME}
                style={{
                    userSelect: "none",
                    pointerEvents: "none"
                }}
            >
                <AbsoluteFill>
                    <Audio
                        startFrom={(trim.from) * fps}
                        endAt={(trim.to) * fps + REMOTION_SAFE_FRAME}
                        playbackRate={playbackRate}
                        src={item.src || ""}
                        volume={item.volume !== undefined ? item.volume / 100 : 1}
                    />
                </AbsoluteFill>
            </Sequence>
        );
    }
};
