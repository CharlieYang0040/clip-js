"use client";

import { listFiles, deleteFile, useAppSelector, storeFile, getFile } from '@/app/store';
import { setMediaFiles, setFilesID } from '@/app/store/slices/projectSlice';
import { MediaFile, UploadedFile } from '@/app/types';
import { useAppDispatch } from '@/app/store';
import AddMedia from '../AddButtons/AddMedia';
import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';

export default function MediaList() {
    const { mediaFiles, filesID } = useAppSelector((state) => state.projectState);
    const dispatch = useAppDispatch();
    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        let mounted = true;

        const fetchFiles = async () => {
            try {
                const storedFilesArray: UploadedFile[] = [];

                for (const fileId of filesID || []) {
                    const file = await getFile(fileId);
                    if (file && mounted) {
                        storedFilesArray.push({
                            file: file,
                            id: fileId,
                        });
                    }
                }

                if (mounted) {
                    setFiles(storedFilesArray);
                }
            } catch (error) {
                toast.error("Error fetching files");
                console.error("Error fetching files:", error);
            }
        };

        fetchFiles();

        // Cleanup
        return () => {
            mounted = false;
        };
    }, [filesID]);

    const processFiles = useCallback(async (files: File[]) => {
        if (isUploading) return;
        
        setIsUploading(true);
        const supportedTypes = ['video/', 'audio/', 'image/'];
        const validFiles = files.filter(file => 
            supportedTypes.some(type => file.type.startsWith(type))
        );

        if (validFiles.length !== files.length) {
            toast.error(`${files.length - validFiles.length} file(s) skipped - unsupported format`);
        }

        if (validFiles.length === 0) {
            setIsUploading(false);
            return;
        }

        try {
            const updatedFiles = [...filesID || []];
            
            for (const file of validFiles) {
                const fileId = crypto.randomUUID();
                await storeFile(file, fileId);
                updatedFiles.push(fileId);
            }
            
            dispatch(setFilesID(updatedFiles));
            toast.success(`${validFiles.length} file(s) uploaded successfully`);
        } catch (error) {
            toast.error('Upload failed. Please try again.');
            console.error('Upload error:', error);
        } finally {
            setIsUploading(false);
        }
    }, [dispatch, filesID, isUploading]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            await processFiles(files);
        }
    }, [processFiles]);

    const onDeleteMedia = async (id: string) => {
        const onUpdateMedia = mediaFiles.filter(f => f.url !== id);
        dispatch(setMediaFiles(onUpdateMedia));
        dispatch(setFilesID(filesID?.filter(f => f !== id) || []));
        await deleteFile(id);
    };

    return (
        <div 
            className={`min-h-[200px] ${files.length === 0 ? 'flex items-center justify-center' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {files.length > 0 ? (
                <div className={`space-y-4 ${isDragOver ? 'opacity-50' : ''}`}>
                    {isDragOver && (
                        <div className="fixed inset-0 bg-blue-500 bg-opacity-10 border-2 border-blue-400 border-dashed rounded-lg flex items-center justify-center z-50 pointer-events-none">
                            <div className="text-center text-blue-300">
                                <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                <p className="text-xl font-medium">Drop files to upload</p>
                            </div>
                        </div>
                    )}
                    {files.map((mediaFile) => (
                        <div key={mediaFile.id} className="border border-gray-700 p-3 rounded bg-black bg-opacity-30 hover:bg-opacity-40 transition-all">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2 flex-1 min-w-0">
                                    <AddMedia fileId={mediaFile.id} />
                                    <span className="py-1 px-1 text-sm flex-1 truncate" title={mediaFile.file.name}>
                                        {mediaFile.file.name}
                                    </span>
                                </div>
                                <button
                                    onClick={() => onDeleteMedia(mediaFile.id)}
                                    className="text-red-500 hover:text-red-700 flex-shrink-0 ml-2"
                                    aria-label="Delete file"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className={`w-full text-center py-8 ${isDragOver ? 'bg-blue-500 bg-opacity-10 border-2 border-blue-400 border-dashed rounded-lg' : 'border-2 border-gray-600 border-dashed rounded-lg'} transition-all duration-200`}>
                    {isUploading ? (
                        <div className="space-y-3">
                            <div className="w-8 h-8 border-4 border-t-blue-500 border-r-blue-500 border-opacity-30 border-t-opacity-100 rounded-full animate-spin mx-auto"></div>
                            <p className="text-white text-sm">Uploading files...</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-center mb-3">
                                <svg 
                                    className={`w-12 h-12 ${isDragOver ? 'text-blue-400' : 'text-gray-400'}`} 
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                >
                                    <path 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round" 
                                        strokeWidth={2} 
                                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" 
                                    />
                                </svg>
                            </div>
                            <p className={`text-lg font-medium mb-2 ${isDragOver ? 'text-blue-300' : 'text-gray-300'}`}>
                                {isDragOver ? 'Drop media files here' : 'No media files yet'}
                            </p>
                            <p className="text-gray-500 text-sm">
                                {isDragOver ? 'Release to upload' : 'Upload files using the button above or drag them here'}
                            </p>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}