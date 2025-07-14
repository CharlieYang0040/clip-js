"use client";

import { listFiles, useAppDispatch, useAppSelector } from "../../../../store";
import { setMediaFiles, setFilesID } from "../../../../store/slices/projectSlice";
import { storeFile } from "../../../../store";
import { categorizeFile } from "../../../../utils/utils";
import Image from 'next/image';
import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';

export default function AddMedia() {
    const { mediaFiles, filesID } = useAppSelector((state) => state.projectState);
    const dispatch = useAppDispatch();
    const [isDragOver, setIsDragOver] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

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

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const newFiles = Array.from(e.target.files || []);
        if (newFiles.length > 0) {
            await processFiles(newFiles);
        }
        e.target.value = "";
    };

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

    return (
        <div className="space-y-4">
            {/* Drag and Drop Zone */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-lg p-6 transition-all duration-200 ${
                    isDragOver 
                        ? 'border-blue-400 bg-blue-500 bg-opacity-10' 
                        : 'border-gray-600 hover:border-gray-500'
                } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
            >
                <div className="text-center">
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
                                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
                            />
                        </svg>
                    </div>
                    
                    {isUploading ? (
                        <div className="space-y-2">
                            <div className="w-8 h-8 border-4 border-t-blue-500 border-r-blue-500 border-opacity-30 border-t-opacity-100 rounded-full animate-spin mx-auto"></div>
                            <p className="text-white text-sm">Uploading files...</p>
                        </div>
                    ) : (
                        <>
                            <p className={`text-lg font-medium mb-2 ${isDragOver ? 'text-blue-300' : 'text-white'}`}>
                                {isDragOver ? 'Drop files here' : 'Drag & drop media files'}
                            </p>
                            <p className="text-gray-400 text-sm mb-4">
                                or click the button below to browse
                            </p>
                            <div className="flex flex-wrap gap-2 justify-center text-xs text-gray-500">
                                <span className="bg-gray-700 px-2 py-1 rounded">Video</span>
                                <span className="bg-gray-700 px-2 py-1 rounded">Audio</span>
                                <span className="bg-gray-700 px-2 py-1 rounded">Image</span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Upload Button */}
            <div className="flex justify-center">
                <label
                    htmlFor="file-upload"
                    className={`cursor-pointer rounded-full bg-white border border-solid border-transparent transition-colors flex flex-row gap-2 items-center justify-center text-gray-800 hover:bg-[#ccc] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-auto py-2 px-2 sm:px-5 sm:w-auto ${
                        isUploading ? 'opacity-50 pointer-events-none' : ''
                    }`}
                >
                    <Image
                        alt="Add Project"
                        className="Black"
                        height={12}
                        width={12}
                        src="https://www.svgrepo.com/show/514275/upload-cloud.svg"
                    />
                    <span className="text-xs">Browse Files</span>
                </label>
                <input
                    type="file"
                    accept="video/*,audio/*,image/*"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                    disabled={isUploading}
                />
            </div>
        </div>
    );
}
