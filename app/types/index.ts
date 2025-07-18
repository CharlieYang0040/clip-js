export type MediaType = 'video' | 'audio' | 'image' | 'unknown';
export type TrackType = 'video' | 'audio' | 'image' | 'text';

export interface Track {
    id: string;
    type: TrackType;
    name: string; // e.g., "Video 1", "Audio 2"
    visible: boolean;
    locked: boolean;
}

export interface UploadedFile {
    id: string;
    file: File;
    type?: MediaType;
    src?: string;
}

export interface MediaFile {
    id: string;
    url?: string;
    fileName: string;
    type: 'video' | 'audio' | 'image';
    trackId: string;
    positionStart: number;
    positionEnd: number;
    startTime: number;
    endTime: number;
    sourceDuration: number;
    zIndex: number;
    width?: number;
    height?: number;
    opacity?: number;
    x?: number;
    y?: number;
    volume?: number;
    src?: string;
    playbackSpeed?: number;
    crop?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

export interface TextElement {
    id: string;
    type: 'text';
    text: string;                     // The actual text content
    trackId: string;
    includeInMerge?: boolean;

    // Timing
    positionStart: number;           // When text appears in final video
    positionEnd: number;             // When text disappears

    // Position & Size (canvas-based)
    x: number;
    y: number;
    width?: number;
    height?: number;

    // Styling
    font?: string;                   // Font family (e.g., 'Arial', 'Roboto')
    fontSize?: number;               // Font size in pixels
    color?: string;                  // Text color (hex or rgba)
    backgroundColor?: string;       // Background behind text
    align?: 'left' | 'center' | 'right'; // Horizontal alignment
    zIndex?: number;                 // Layering

    // Effects
    opacity?: number;                // Transparency (0 to 1)
    rotation?: number;               // Rotation in degrees
    fadeInDuration?: number;        // Seconds to fade in
    fadeOutDuration?: number;       // Seconds to fade out
    animation?: 'slide-in' | 'zoom' | 'bounce' | 'none'; // Optional animation

    // Runtime only (not persisted)
    visible?: boolean;              // Internal flag for rendering logic
}


export type ExportFormat = 'mp4' | 'webm' | 'gif' | 'mov';

export interface ExportConfig {
    resolution: string;
    quality: string;
    speed: string;
    fps: number; // TODO: add this as an option
    format: ExportFormat; // TODO: add this as an option
    includeSubtitles: boolean; // TODO: add this as an option
}

export type ActiveElement = 'media' | 'text' | 'gap' | 'export';

export interface SelectedElement {
    id: string;
    type: 'media' | 'text';
}

export interface ProjectState {
    id: string;
    tracks: Track[];
    mediaFiles: MediaFile[];
    textElements: TextElement[];
    filesID?: string[],
    currentTime: number;
    isPlaying: boolean;
    isMuted: boolean;
    duration: number;
    zoomLevel: number;
    timelineZoom: number;
    enableMarkerTracking: boolean;
    isSnappingEnabled: boolean;
    activeSection: ActiveElement;
    activeElements: SelectedElement[];
    activeGap: { start: number, end: number, trackId: string, trackType: TrackType } | null;
    projectName: string;
    createdAt: string;
    lastModified: string;
    resolution: { width: number; height: number };
    fps: number;
    aspectRatio: string;
    history: ProjectState[]; // stack for undo
    future: ProjectState[]; // stack for redo
    exportSettings: ExportConfig;
    draggingElement: { clip: MediaFile | TextElement, elementType: 'media' | 'text' } | null;
    dragOverTrackId: string | null;
}

export const mimeToExt = {
    'video/mp4': 'mp4',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/webm': 'webm',
    // TODO: Add more as needed
};