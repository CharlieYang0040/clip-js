"use client";

import { useAppSelector } from '../../../store';
import { setMediaFiles } from '../../../store/slices/projectSlice';
import { MediaFile } from '../../../types';
import { useAppDispatch } from '../../../store';
import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';

export default function MediaProperties() {
    const { mediaFiles, activeElements } = useAppSelector((state) => state.projectState);
    const activeMediaElement = activeElements.find(el => el.type === 'media');
    const mediaFile = mediaFiles.find(file => file.id === activeMediaElement?.id);

    const dispatch = useAppDispatch();
    const [isEditing, setIsEditing] = useState<string | null>(null);
    const [tempValues, setTempValues] = useState<Record<string, number>>({});

    const onUpdateMedia = useCallback((id: string, updates: Partial<MediaFile>) => {
        dispatch(setMediaFiles(mediaFiles.map(media =>
            media.id === id ? { ...media, ...updates } : media
        )));
    }, [dispatch, mediaFiles]);

    const validateTimeInput = useCallback((value: number, field: string, clip: MediaFile) => {
        switch (field) {
            case 'startTime':
                return Math.max(0, Math.min(value, clip.endTime - 0.1));
            case 'endTime':
                return Math.max(clip.startTime + 0.1, value);
            case 'positionStart':
                return Math.max(0, value);
            case 'positionEnd':
                return Math.max(clip.positionStart + 0.1, value);
            default:
                return value;
        }
    }, []);

    const handleTimeInputChange = useCallback((field: string, value: string) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return;
        
        setTempValues(prev => ({ ...prev, [field]: numValue }));
    }, []);

    const handleTimeInputBlur = useCallback((field: string) => {
        if (!mediaFile || tempValues[field] === undefined) return;
        
        const validatedValue = validateTimeInput(tempValues[field], field, mediaFile);
        const updates: Partial<MediaFile> = {};
        
        if (field === 'startTime') {
            updates.startTime = validatedValue;
        } else if (field === 'endTime') {
            updates.endTime = validatedValue;
        } else if (field === 'positionStart') {
            const duration = mediaFile.positionEnd - mediaFile.positionStart;
            updates.positionStart = validatedValue;
            updates.positionEnd = validatedValue + duration;
        } else if (field === 'positionEnd') {
            if (validatedValue <= mediaFile.positionStart) {
                toast.error('End time must be greater than start time');
                return;
            }
            updates.positionEnd = validatedValue;
        }

        onUpdateMedia(mediaFile.id, updates);
        setIsEditing(null);
        setTempValues(prev => {
            const newValues = { ...prev };
            delete newValues[field];
            return newValues;
        });
        
        if (validatedValue !== tempValues[field]) {
            toast.success('Time adjusted to valid range');
        }
    }, [mediaFile, tempValues, validateTimeInput, onUpdateMedia]);

    const handleTimeInputKeyDown = useCallback((e: React.KeyboardEvent, field: string) => {
        if (e.key === 'Enter') {
            handleTimeInputBlur(field);
        } else if (e.key === 'Escape') {
            setIsEditing(null);
            setTempValues(prev => {
                const newValues = { ...prev };
                delete newValues[field];
                return newValues;
            });
        }
    }, [handleTimeInputBlur]);

    const getDisplayValue = useCallback((field: string, originalValue: number) => {
        if (isEditing === field && tempValues[field] !== undefined) {
            return tempValues[field].toString();
        }
        return originalValue.toFixed(2);
    }, [isEditing, tempValues]);

    if (!mediaFile) return null;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-8">
                {/* Source Video */}
                <div className="space-y-2">
                    <h4 className="font-semibold">Source Video</h4>
                    <div className="flex items-center space-x-4">
                        <div>
                            <label className="block text-sm">Start (s)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={getDisplayValue('startTime', mediaFile.startTime)}
                                min={0}
                                max={mediaFile.endTime - 0.1}
                                onFocus={() => setIsEditing('startTime')}
                                onChange={(e) => handleTimeInputChange('startTime', e.target.value)}
                                onBlur={() => handleTimeInputBlur('startTime')}
                                onKeyDown={(e) => handleTimeInputKeyDown(e, 'startTime')}
                                className="w-full p-2 bg-darkSurfacePrimary border border-white border-opacity-10 shadow-md text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm">End (s)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={getDisplayValue('endTime', mediaFile.endTime)}
                                min={mediaFile.startTime + 0.1}
                                onFocus={() => setIsEditing('endTime')}
                                onChange={(e) => handleTimeInputChange('endTime', e.target.value)}
                                onBlur={() => handleTimeInputBlur('endTime')}
                                onKeyDown={(e) => handleTimeInputKeyDown(e, 'endTime')}
                                className="w-full p-2 bg-darkSurfacePrimary border border-white border-opacity-10 shadow-md text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                </div>
                {/* Timing Position */}
                <div className="space-y-2">
                    <h4 className="font-semibold">Timing Position</h4>
                    <div className="flex items-center space-x-4">
                        <div>
                            <label className="block text-sm">Start (s)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={getDisplayValue('positionStart', mediaFile.positionStart)}
                                min={0}
                                onFocus={() => setIsEditing('positionStart')}
                                onChange={(e) => handleTimeInputChange('positionStart', e.target.value)}
                                onBlur={() => handleTimeInputBlur('positionStart')}
                                onKeyDown={(e) => handleTimeInputKeyDown(e, 'positionStart')}
                                className="w-full p-2 bg-darkSurfacePrimary border border-white border-opacity-10 shadow-md text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm">End (s)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={getDisplayValue('positionEnd', mediaFile.positionEnd)}
                                min={mediaFile.positionStart + 0.1}
                                onFocus={() => setIsEditing('positionEnd')}
                                onChange={(e) => handleTimeInputChange('positionEnd', e.target.value)}
                                onBlur={() => handleTimeInputBlur('positionEnd')}
                                onKeyDown={(e) => handleTimeInputKeyDown(e, 'positionEnd')}
                                className="w-full p-2 bg-darkSurfacePrimary border border-white border-opacity-10 shadow-md text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                        Duration: {(mediaFile.positionEnd - mediaFile.positionStart).toFixed(2)}s
                    </div>
                </div>
                {/* Visual Properties */}
                <div className="space-y-6">
                    <h4 className="font-semibold">Visual Properties</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm">X Position</label>
                            <input
                                type="number"
                                step="10"
                                value={mediaFile.x || 0}
                                onChange={(e) => onUpdateMedia(mediaFile.id, { x: Number(e.target.value) })}
                                className="w-full p-2 bg-darkSurfacePrimary border border-white border-opacity-10 shadow-md text-white rounded focus:outline-none focus:ring-2 focus:ring-white-500 focus:border-white-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm">Y Position</label>
                            <input
                                type="number"
                                step="10"
                                value={mediaFile.y || 0}
                                onChange={(e) => onUpdateMedia(mediaFile.id, { y: Number(e.target.value) })}
                                className="w-full p-2 bg-darkSurfacePrimary border border-white border-opacity-10 shadow-md text-white rounded focus:outline-none focus:ring-2 focus:ring-white-500 focus:border-white-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm">Width</label>
                            <input
                                type="number"
                                step="10"
                                value={mediaFile.width || 100}
                                onChange={(e) => onUpdateMedia(mediaFile.id, { width: Number(e.target.value) })}
                                className="w-full p-2 bg-darkSurfacePrimary border border-white border-opacity-10 shadow-md text-white rounded focus:outline-none focus:ring-2 focus:ring-white-500 focus:border-white-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm">Height</label>
                            <input
                                type="number"
                                step="10"
                                value={mediaFile.height || 100}
                                onChange={(e) => onUpdateMedia(mediaFile.id, { height: Number(e.target.value) })}
                                className="w-full p-2 bg-darkSurfacePrimary border border-white border-opacity-10 shadow-md text-white rounded focus:outline-none focus:ring-2 focus:ring-white-500 focus:border-white-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm">Zindex</label>
                            <input
                                type="number"
                                value={mediaFile.layerOrder || 0}
                                onChange={(e) => onUpdateMedia(mediaFile.id, { layerOrder: Number(e.target.value) })}
                                className="w-full p-2 bg-darkSurfacePrimary border border-white border-opacity-10 shadow-md text-white rounded focus:outline-none focus:ring-2 focus:ring-white-500 focus:border-white-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm">Opacity</label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={mediaFile.opacity ?? 100}
                                onChange={(e) => onUpdateMedia(mediaFile.id, { opacity: Number(e.target.value) })}
                                className="w-full bg-darkSurfacePrimary border border-white border-opacity-10 shadow-md text-white rounded focus:outline-none focus:border-white-500"
                            />
                        </div>
                    </div>
                </div>
                {/* Audio Properties */}
                {(mediaFile.type === "video" || mediaFile.type === "audio") && <div className="space-y-2">
                    <h4 className="font-semibold">Audio Properties</h4>
                    <div>
                        <label className="block text-sm">Volume</label>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={mediaFile.volume ?? 100}
                            onChange={(e) => onUpdateMedia(mediaFile.id, { volume: Number(e.target.value) })}
                            className="w-full bg-darkSurfacePrimary border border-white border-opacity-10 shadow-md text-white rounded focus:outline-none focus:border-white-500"
                        />
                    </div>
                </div>}
                <div>
                    <div className="bg-blue-900 bg-opacity-20 border border-blue-500 border-opacity-30 rounded-lg p-3 mt-4">
                        <div className="flex items-center space-x-2 text-blue-300 text-sm">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <span className="font-medium">Tip:</span>
                        </div>
                        <p className="text-blue-200 text-sm mt-1">
                            Press Enter to apply changes, Escape to cancel. Time values are automatically validated.
                        </p>
                    </div>
                </div>
            </div>
        </div >
    );
}