import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { TextElement, MediaFile, ActiveElement, ExportConfig, SelectedElement, Track, TrackType } from '../../types';
import { ProjectState } from '../../types';

const createDefaultTracks = (): Track[] => [
    { id: `track-video-${crypto.randomUUID()}`, type: 'video', name: 'Video 1', visible: true, locked: false },
    { id: `track-audio-${crypto.randomUUID()}`, type: 'audio', name: 'Audio 1', visible: true, locked: false },
    { id: `track-image-${crypto.randomUUID()}`, type: 'image', name: 'Image 1', visible: true, locked: false },
    { id: `track-text-${crypto.randomUUID()}`, type: 'text', name: 'Text 1', visible: true, locked: false },
];

export const initialState: ProjectState = {
    id: '',
    projectName: 'Untitled Project',
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    tracks: [],
    mediaFiles: [],
    textElements: [],
    currentTime: 0,
    isPlaying: false,
    isMuted: false,
    duration: 0,
    zoomLevel: 1,
    timelineZoom: 100,
    enableMarkerTracking: true,
    isSnappingEnabled: true,
    activeSection: 'media',
    activeElements: [],
    activeGap: null,
    resolution: { width: 1920, height: 1080 },
    fps: 30,
    aspectRatio: '16:9',
    history: [],
    future: [],
    exportSettings: {
        resolution: '1080p',
        quality: 'high',
        speed: 'fastest',
        fps: 30,
        format: 'mp4',
        includeSubtitles: false,
    },
    draggingElement: null,
    dragOverTrackId: null,
};

const calculateTotalDuration = (
    mediaFiles: MediaFile[],
    textElements: TextElement[]
): number => {
    const mediaDurations = mediaFiles.map(v => v.positionEnd);
    const textDurations = textElements.map(v => v.positionEnd);
    return Math.max(0, ...mediaDurations, ...textDurations);
};

// Helper function to create a snapshot for undo/redo
const createSnapshot = (state: ProjectState): Partial<ProjectState> => {
    const { history, future, ...snapshot } = state;
    return snapshot;
};

// Helper function to add state to history
const addToHistory = (state: ProjectState) => {
    const snapshot = createSnapshot(state);
    state.history.push(snapshot as ProjectState);
    // Limit history to 50 states to prevent memory issues
    if (state.history.length > 50) {
        state.history.shift();
    }
    // Clear future when new action is performed
    state.future = [];
};

const projectStateSlice = createSlice({
    name: 'projectState',
    initialState,
    reducers: {
        setDraggingElement: (state, action: PayloadAction<{ clip: MediaFile | TextElement, elementType: 'media' | 'text' } | null>) => {
            state.draggingElement = action.payload;
        },
        setDragOverTrackId: (state, action: PayloadAction<string | null>) => {
            state.dragOverTrackId = action.payload;
        },
        // Undo/Redo actions
        undo: (state) => {
            if (state.history.length > 0) {
                const currentSnapshot = createSnapshot(state);
                state.future.unshift(currentSnapshot as ProjectState);
                
                const previousState = state.history.pop()!;
                
                // Apply previous state properties
                state.id = previousState.id;
                state.projectName = previousState.projectName;
                state.createdAt = previousState.createdAt;
                state.lastModified = previousState.lastModified;
                state.mediaFiles = previousState.mediaFiles;
                state.textElements = previousState.textElements;
                state.currentTime = previousState.currentTime;
                state.isPlaying = previousState.isPlaying;
                state.isMuted = previousState.isMuted;
                state.duration = previousState.duration;
                state.zoomLevel = previousState.zoomLevel;
                state.timelineZoom = previousState.timelineZoom;
                state.enableMarkerTracking = previousState.enableMarkerTracking;
                state.activeSection = previousState.activeSection;
                state.activeElements = previousState.activeElements;
                state.activeGap = previousState.activeGap;
                state.resolution = previousState.resolution;
                state.fps = previousState.fps;
                state.aspectRatio = previousState.aspectRatio;
                state.exportSettings = previousState.exportSettings;
                state.filesID = previousState.filesID;
                
                // Limit future stack
                if (state.future.length > 50) {
                    state.future.pop();
                }
            }
        },
        redo: (state) => {
            if (state.future.length > 0) {
                const currentSnapshot = createSnapshot(state);
                state.history.push(currentSnapshot as ProjectState);
                
                const nextState = state.future.shift()!;
                
                // Apply next state properties
                state.id = nextState.id;
                state.projectName = nextState.projectName;
                state.createdAt = nextState.createdAt;
                state.lastModified = nextState.lastModified;
                state.mediaFiles = nextState.mediaFiles;
                state.textElements = nextState.textElements;
                state.currentTime = nextState.currentTime;
                state.isPlaying = nextState.isPlaying;
                state.isMuted = nextState.isMuted;
                state.duration = nextState.duration;
                state.zoomLevel = nextState.zoomLevel;
                state.timelineZoom = nextState.timelineZoom;
                state.enableMarkerTracking = nextState.enableMarkerTracking;
                state.activeSection = nextState.activeSection;
                state.activeElements = nextState.activeElements;
                state.activeGap = nextState.activeGap;
                state.resolution = nextState.resolution;
                state.fps = nextState.fps;
                state.aspectRatio = nextState.aspectRatio;
                state.exportSettings = nextState.exportSettings;
                state.filesID = nextState.filesID;
                
                // Limit history stack
                if (state.history.length > 50) {
                    state.history.shift();
                }
            }
        },
        clearHistory: (state) => {
            state.history = [];
            state.future = [];
        },
        
        setTracks: (state, action: PayloadAction<Track[]>) => {
            addToHistory(state);
            state.tracks = action.payload;
        },
        addTrack: (state, action: PayloadAction<TrackType>) => {
            addToHistory(state);
            const type = action.payload;
            const trackCount = state.tracks.filter(t => t.type === type).length;
            const newTrack: Track = {
                id: `track-${type}-${crypto.randomUUID()}`,
                type,
                name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${trackCount + 1}`,
                visible: true,
                locked: false,
            };
            state.tracks.push(newTrack);
        },
        removeTrack: (state, action: PayloadAction<string>) => {
            addToHistory(state);
            const trackId = action.payload;
            state.tracks = state.tracks.filter(t => t.id !== trackId);
            // Also remove elements associated with this track
            state.mediaFiles = state.mediaFiles.filter(m => m.trackId !== trackId);
            state.textElements = state.textElements.filter(t => t.trackId !== trackId);
            state.duration = calculateTotalDuration(state.mediaFiles, state.textElements);
        },
        reorderTracks: (state, action: PayloadAction<{ draggingTrackId: string; dropTrackId: string }>) => {
            addToHistory(state);
            const { draggingTrackId, dropTrackId } = action.payload;
            const draggingIndex = state.tracks.findIndex(t => t.id === draggingTrackId);
            const dropIndex = state.tracks.findIndex(t => t.id === dropTrackId);

            if (draggingIndex > -1 && dropIndex > -1) {
                const [draggedTrack] = state.tracks.splice(draggingIndex, 1);
                state.tracks.splice(dropIndex, 0, draggedTrack);
            }
        },
        
        setMediaFiles: (state, action: PayloadAction<MediaFile[]>) => {
            addToHistory(state);
            state.mediaFiles = action.payload;
            state.duration = calculateTotalDuration(state.mediaFiles, state.textElements);
        },
        updateMediaFiles_INTERNAL: (state, action: PayloadAction<MediaFile[]>) => {
            state.mediaFiles = action.payload;
            state.duration = calculateTotalDuration(state.mediaFiles, state.textElements);
        },
        setProjectName: (state, action: PayloadAction<string>) => {
            state.projectName = action.payload;
        },
        setProjectId: (state, action: PayloadAction<string>) => {
            state.id = action.payload;
        },
        setProjectCreatedAt: (state, action: PayloadAction<string>) => {
            state.createdAt = action.payload;
        },
        setProjectLastModified: (state, action: PayloadAction<string>) => {
            state.lastModified = action.payload;
        },

        setTextElements: (state, action: PayloadAction<TextElement[]>) => {
            addToHistory(state);
            state.textElements = action.payload;
            state.duration = calculateTotalDuration(state.mediaFiles, state.textElements);
        },
        updateTextElements_INTERNAL: (state, action: PayloadAction<TextElement[]>) => {
            state.textElements = action.payload;
            state.duration = calculateTotalDuration(state.mediaFiles, state.textElements);
        },
        setCurrentTime: (state, action: PayloadAction<number>) => {
            state.currentTime = action.payload;
        },
        setIsPlaying: (state, action: PayloadAction<boolean>) => {
            state.isPlaying = action.payload;
        },
        setIsMuted: (state, action: PayloadAction<boolean>) => {
            state.isMuted = action.payload;
        },
        setActiveSection: (state, action: PayloadAction<ActiveElement>) => {
            state.activeSection = action.payload;
        },
        toggleActiveElement: (state, action: PayloadAction<{ element: SelectedElement; metaKey?: boolean }>) => {
            const { element, metaKey } = action.payload;
            const isSelected = state.activeElements.some(e => e.id === element.id);

            if (metaKey) {
                if (isSelected) {
                    state.activeElements = state.activeElements.filter(e => e.id !== element.id);
                } else {
                    state.activeElements.push(element);
                }
            } else {
                if (!isSelected || state.activeElements.length > 1) {
                    state.activeElements = [element];
                }
            }
            state.activeGap = null;
        },
        setActiveElement: (state, action: PayloadAction<SelectedElement[]>) => {
            state.activeElements = action.payload;
            state.activeGap = null;
        },
        resetActiveElements: (state) => {
            state.activeElements = [];
            state.activeGap = null;
        },
        setActiveGap: (state, action: PayloadAction<{ start: number, end: number, trackId: string, trackType: TrackType } | null>) => {
            state.activeGap = action.payload;
            state.activeElements = [];
        },
        setFilesID: (state, action: PayloadAction<string[]>) => {
            state.filesID = action.payload;
        },
        setExportSettings: (state, action: PayloadAction<ExportConfig>) => {
            state.exportSettings = action.payload;
        },
        setResolution: (state, action: PayloadAction<string>) => {
            state.exportSettings.resolution = action.payload;
        },
        setQuality: (state, action: PayloadAction<string>) => {
            state.exportSettings.quality = action.payload;
        },
        setSpeed: (state, action: PayloadAction<string>) => {
            state.exportSettings.speed = action.payload;
        },
        setFps: (state, action: PayloadAction<number>) => {
            state.exportSettings.fps = action.payload;
        },
        setTimelineZoom: (state, action: PayloadAction<number>) => {
            state.timelineZoom = action.payload;
        },
        setMarkerTrack: (state, action: PayloadAction<boolean>) => {
            state.enableMarkerTracking = action.payload;
        },
        setSnapMode: (state, action: PayloadAction<boolean>) => {
            state.isSnappingEnabled = action.payload;
        },
        // Special reducer for rehydrating state from IndexedDB
        rehydrate: (state, action: PayloadAction<ProjectState>) => {
            return { ...state, ...action.payload };
        },
        createNewProject: (state) => {
            const newId = crypto.randomUUID();
            const now = new Date().toISOString();
            return {
                ...initialState,
                id: newId,
                createdAt: now,
                lastModified: now,
                tracks: createDefaultTracks(),
            };
        },
    },
});

export const {
    undo,
    redo,
    clearHistory,
    setMediaFiles,
    updateMediaFiles_INTERNAL,
    setTextElements,
    updateTextElements_INTERNAL,
    setCurrentTime,
    setIsPlaying,
    setIsMuted,
    setActiveSection,
    toggleActiveElement,
    setActiveElement,
    resetActiveElements,
    setActiveGap,
    setFilesID,
    setExportSettings,
    setResolution,
    setQuality,
    setSpeed,
    setFps,
    setMarkerTrack,
    setSnapMode,
    rehydrate,
    createNewProject,
    setTimelineZoom,
    setProjectName,
    setProjectId,
    setProjectCreatedAt,
    setProjectLastModified,
    setTracks,
    addTrack,
    removeTrack,
    reorderTracks,
    setDraggingElement,
    setDragOverTrackId,
} = projectStateSlice.actions;

export default projectStateSlice.reducer; 