"use client";
import { useEffect, useRef, useState } from "react";
import { getFile, storeProject, useAppDispatch, useAppSelector } from "../../../store";
import { getProject } from "../../../store";
import { setCurrentProject, updateProject } from "../../../store/slices/projectsSlice";
import { rehydrate, setMediaFiles } from '../../../store/slices/projectSlice';
import { setActiveSection } from "../../../store/slices/projectSlice";
import AddText from '../../../components/editor/AssetsPanel/tools-section/AddText';
import AddMedia from '../../../components/editor/AssetsPanel/AddButtons/UploadMedia';
import MediaList from '../../../components/editor/AssetsPanel/tools-section/MediaList';
import { useRouter } from 'next/navigation';
import TextButton from "@/app/components/editor/AssetsPanel/SidebarButtons/TextButton";
import LibraryButton from "@/app/components/editor/AssetsPanel/SidebarButtons/LibraryButton";
import ExportButton from "@/app/components/editor/AssetsPanel/SidebarButtons/ExportButton";
import HomeButton from "@/app/components/editor/AssetsPanel/SidebarButtons/HomeButton";
import ShortcutsButton from "@/app/components/editor/AssetsPanel/SidebarButtons/ShortcutsButton";
import MediaProperties from "../../../components/editor/PropertiesSection/MediaProperties";
import TextProperties from "../../../components/editor/PropertiesSection/TextProperties";
import { Timeline } from "../../../components/editor/timeline/Timline";
import { PreviewPlayer } from "../../../components/editor/player/remotion/Player";
import { MediaFile } from "@/app/types";
import ExportList from "../../../components/editor/AssetsPanel/tools-section/ExportList";
import Image from "next/image";
import ProjectName from "../../../components/editor/player/ProjectName";

export default function Project({ params }: { params: { id: string } }) {
    const { id } = params;
    const dispatch = useAppDispatch();
    const projectState = useAppSelector((state) => state.projectState);
    const { currentProjectId } = useAppSelector((state) => state.projects);
    const [isLoading, setIsLoading] = useState(true);
    const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
    const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);

    const router = useRouter();
    const { activeSection, activeElements } = projectState;
    const firstActiveElement = activeElements.length > 0 ? activeElements[0] : null;

    // when page is loaded set the project id if it exists
    useEffect(() => {
        const loadProject = async () => {
            if (id) {
                setIsLoading(true);
                const project = await getProject(id);
                if (project) {
                    dispatch(setCurrentProject(id));
                    setIsLoading(false);
                } else {
                    router.push('/404');
                }
            }
        };
        loadProject();
    }, [id, dispatch]);

    // set project state from with the current project id
    useEffect(() => {
        const loadProject = async () => {
            if (currentProjectId) {
                const project = await getProject(currentProjectId);
                if (project) {
                    const validMediaFiles = (await Promise.all(
                        project.mediaFiles.map(async (media: MediaFile) => {
                            const file = await getFile(media.fileId);
                            if (file) {
                                return { ...media, src: URL.createObjectURL(file) };
                            }
                            console.warn(`File not found in IndexedDB for fileId: ${media.fileId}`);
                            return null;
                        })
                    )).filter(Boolean) as MediaFile[];

                    const hydratedProject = { ...project, mediaFiles: validMediaFiles };
                    dispatch(rehydrate(hydratedProject));
                }
            }
        };
        loadProject();
    }, [dispatch, currentProjectId]);

    // save
    useEffect(() => {
        const saveProject = async () => {
            if (!projectState || projectState.id != currentProjectId) return;
            await storeProject(projectState);
            dispatch(updateProject(projectState));
        };
        saveProject();
    }, [projectState, dispatch]);

    const handleFocus = (section: "media" | "text" | "export") => {
        dispatch(setActiveSection(section));
    };

    const ShortcutsModal = () => (
        <div className="fixed inset-0 flex items-center bg-black bg-opacity-50 justify-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-white">Keyboard Shortcuts</h2>
                    <button
                        onClick={() => setShowShortcuts(false)}
                        className="text-white hover:text-gray-300 text-2xl"
                    >
                        ×
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-white">
                    <div>
                        <h3 className="font-semibold mb-2 text-blue-300">Playback</h3>
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span>Play/Pause</span>
                                <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Space</kbd>
                            </div>
                            <div className="flex justify-between">
                                <span>Mute/Unmute</span>
                                <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">M</kbd>
                            </div>
                            <div className="flex justify-between">
                                <span>Frame Forward</span>
                                <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">→</kbd>
                            </div>
                            <div className="flex justify-between">
                                <span>Frame Backward</span>
                                <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">←</kbd>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h3 className="font-semibold mb-2 text-blue-300">Navigation</h3>
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span>Go to Start</span>
                                <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Home</kbd>
                            </div>
                            <div className="flex justify-between">
                                <span>Go to End</span>
                                <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">End</kbd>
                            </div>
                            <div className="flex justify-between">
                                <span>Toggle Marker Track</span>
                                <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">T</kbd>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h3 className="font-semibold mb-2 text-blue-300">Editing</h3>
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span>Split Element</span>
                                <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">S</kbd>
                            </div>
                            <div className="flex justify-between">
                                <span>Duplicate Element</span>
                                <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">D</kbd>
                            </div>
                            <div className="flex justify-between">
                                <span>Delete Element</span>
                                <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Del</kbd>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h3 className="font-semibold mb-2 text-blue-300">Undo/Redo & Zoom</h3>
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span>Undo</span>
                                <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Ctrl+Z</kbd>
                            </div>
                            <div className="flex justify-between">
                                <span>Redo</span>
                                <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Ctrl+Y</kbd>
                            </div>
                            <div className="flex justify-between">
                                <span>Zoom In</span>
                                <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">+</kbd>
                            </div>
                            <div className="flex justify-between">
                                <span>Zoom Out</span>
                                <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">-</kbd>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="mt-6 text-center">
                    <button
                        onClick={() => setShowShortcuts(false)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
                    >
                        Got it!
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-screen select-none">
            {/* Loading screen */}
            {
                isLoading ? (
                    <div className="fixed inset-0 flex items-center bg-black bg-opacity-50 justify-center z-50">
                        <div className="bg-black bg-opacity-70 p-6 rounded-lg flex flex-col items-center">
                            <div className="w-16 h-16 border-4 border-t-white border-r-white border-opacity-30 border-t-opacity-100 rounded-full animate-spin"></div>
                            <p className="mt-4 text-white text-lg">Loading project...</p>
                        </div>
                    </div>
                ) : null
            }

            {/* Shortcuts Modal */}
            {showShortcuts && <ShortcutsModal />}

            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar - Buttons */}
                <div className={`${leftSidebarCollapsed ? 'w-0' : 'flex-[0.1] min-w-[60px] max-w-[100px]'} border-r border-gray-700 overflow-hidden transition-all duration-300 ease-in-out`}>
                    <div className="flex flex-col space-y-2 p-4">
                        <HomeButton />
                        <TextButton onClick={() => handleFocus("text")} />
                        <LibraryButton onClick={() => handleFocus("media")} />
                        <ExportButton onClick={() => handleFocus("export")} />
                        <button
                            onClick={() => setShowShortcuts(true)}
                            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors flex items-center justify-center"
                            title="Show keyboard shortcuts"
                        >
                            <span className="text-white text-xs">?</span>
                        </button>
                    </div>
                </div>

                {/* Add media and text */}
                <div className={`${leftSidebarCollapsed ? 'w-0' : 'flex-[0.3] min-w-[200px]'} border-r border-gray-800 overflow-hidden transition-all duration-300 ease-in-out`}>
                    <div className="overflow-y-auto p-4 h-full">
                        {/* Collapse button */}
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold text-white">
                                {activeSection === "media" && "Media Library"}
                                {activeSection === "text" && "Text Tools"}
                                {activeSection === "export" && "Export"}
                            </h2>
                            <button
                                onClick={() => setLeftSidebarCollapsed(true)}
                                className="text-white hover:text-gray-300 p-1"
                                title="Collapse sidebar"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                        </div>

                        {activeSection === "media" && (
                            <div>
                                <div className="flex flex-row gap-2 items-center justify-center mb-4">
                                    <AddMedia />
                                </div>
                                <MediaList />
                            </div>
                        )}
                        {activeSection === "text" && (
                            <div>
                                <AddText />
                            </div>
                        )}
                        {activeSection === "export" && (
                            <div>
                                <ExportList />
                            </div>
                        )}
                    </div>
                </div>

                {/* Expand button for left sidebar */}
                {leftSidebarCollapsed && (
                    <button
                        onClick={() => setLeftSidebarCollapsed(false)}
                        className="absolute left-2 top-1/2 transform -translate-y-1/2 z-10 bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-r-lg transition-colors"
                        title="Expand sidebar"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                )}

                {/* Center - Video Preview */}
                <div className="flex items-center justify-center flex-col flex-[1] overflow-hidden relative">
                    {/* Toggle buttons for sidebars */}
                    <div className="absolute top-4 right-4 flex gap-2 z-10">
                        {rightSidebarCollapsed && (
                            <button
                                onClick={() => setRightSidebarCollapsed(false)}
                                className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-lg transition-colors"
                                title="Show properties panel"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                                </svg>
                            </button>
                        )}
                        <button
                            onClick={() => setShowShortcuts(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors"
                            title="Show keyboard shortcuts"
                        >
                            <span className="text-sm font-bold">?</span>
                        </button>
                    </div>

                    <ProjectName />
                    <PreviewPlayer />
                </div>

                {/* Expand button for right sidebar */}
                {rightSidebarCollapsed && (
                    <button
                        onClick={() => setRightSidebarCollapsed(false)}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 z-10 bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-l-lg transition-colors"
                        title="Expand properties panel"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                )}

                {/* Right Sidebar - Element Properties */}
                <div className={`${rightSidebarCollapsed ? 'w-0' : 'flex-[0.4] min-w-[200px]'} border-l border-gray-800 overflow-hidden transition-all duration-300 ease-in-out`}>
                    <div className="overflow-y-auto p-4 h-full">
                        {/* Collapse button */}
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold text-white">
                                {firstActiveElement?.type === "media" && "Media Properties"}
                                {firstActiveElement?.type === "text" && "Text Properties"}
                                {!firstActiveElement && "Properties"}
                            </h2>
                            <button
                                onClick={() => setRightSidebarCollapsed(true)}
                                className="text-white hover:text-gray-300 p-1"
                                title="Collapse properties panel"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>

                        {firstActiveElement?.type === "media" && (
                            <div>
                                <MediaProperties />
                            </div>
                        )}
                        {firstActiveElement?.type === "text" && (
                            <div>
                                <TextProperties />
                            </div>
                        )}
                        {!firstActiveElement && (
                            <div className="text-gray-400 text-center mt-8">
                                <p>Select an element from the timeline to view its properties.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Timeline at bottom */}
            <div className="flex flex-row border-t border-gray-500">
                <div className=" bg-darkSurfacePrimary flex flex-col items-center justify-center mt-20">

                    <div className="relative h-16">
                        <div className="flex items-center gap-2 p-4">
                            <Image
                                alt="Video"
                                className="invert h-auto w-auto max-w-[30px] max-h-[30px]"
                                height={30}
                                width={30}
                                src="https://www.svgrepo.com/show/532727/video.svg"
                            />
                        </div>
                    </div>

                    <div className="relative h-16">
                        <div className="flex items-center gap-2 p-4">
                            <Image
                                alt="Audio"
                                className="invert h-auto w-auto max-w-[30px] max-h-[30px]"
                                height={30}
                                width={30}
                                src="https://www.svgrepo.com/show/532708/music.svg"
                            />
                        </div>
                    </div>

                    <div className="relative h-16">
                        <div className="flex items-center gap-2 p-4">
                            <Image
                                alt="Image"
                                className="invert h-auto w-auto max-w-[30px] max-h-[30px]"
                                height={30}
                                width={30}
                                src="https://www.svgrepo.com/show/535454/image.svg"
                            />
                        </div>
                    </div>

                    <div className="relative h-16">
                        <div className="flex items-center gap-2 p-4">
                            <Image
                                alt="Text"
                                className="invert h-auto w-auto max-w-[30px] max-h-[30px]"
                                height={30}
                                width={30}
                                src="https://www.svgrepo.com/show/535686/text.svg"
                            />
                        </div>
                    </div>
                </div>
                <Timeline />
            </div>
        </div >
    );
}
