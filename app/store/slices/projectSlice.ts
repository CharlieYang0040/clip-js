import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { TextElement, MediaFile, ActiveElement, ExportConfig, SelectedElement } from '../../types';
import { ProjectState } from '../../types';

export const initialState: ProjectState = {
    id: crypto.randomUUID(),
    projectName: '',
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
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
        
        setMediaFiles: (state, action: PayloadAction<MediaFile[]>) => {
            addToHistory(state);
            state.mediaFiles = action.payload;
            state.duration = calculateTotalDuration(state.mediaFiles, state.textElements);
            state.activeElements = [];
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
            state.activeElements = [];
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
                if (isSelected && state.activeElements.length === 1) {
                    state.activeElements = [];
                } else {
                    state.activeElements = [element];
                }
            }
            state.activeGap = null;
        },
        resetActiveElements: (state) => {
            state.activeElements = [];
            state.activeGap = null;
        },
        setActiveGap: (state, action: PayloadAction<{ start: number, end: number, trackType: 'video' | 'audio' | 'image' | 'text' } | null>) => {
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
            return { ...initialState };
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
} = projectStateSlice.actions;

export default projectStateSlice.reducer; 