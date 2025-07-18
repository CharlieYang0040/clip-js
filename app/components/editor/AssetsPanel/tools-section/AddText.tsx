"use client";

import { useState } from 'react';
import { TextElement, Track } from '../../../../types';
import { useAppDispatch, useAppSelector } from '../../../../store';
import { setTextElements } from '../../../../store/slices/projectSlice';
import toast from 'react-hot-toast';

export default function AddText() {
    const { tracks, textElements } = useAppSelector((state) => state.projectState);
    const dispatch = useAppDispatch();
    const [textConfig, setTextConfig] = useState({
        content: 'Hello World',
        fontFamily: 'Arial',
        fontSize: 48,
        color: '#FFFFFF',
        layerOrder: 0,
    });

    const handleAddText = (e: React.FormEvent) => {
        e.preventDefault();

        const activeTrack = tracks.find(track => track.type === 'text');
        if (!activeTrack) {
            toast.error("No text track found. Please add a text track first.");
            return;
        }

        const lastElement = textElements
            .filter(t => t.trackId === activeTrack.id)
            .sort((a, b) => b.positionEnd - a.positionEnd)[0];
        
        const positionStart = lastElement ? lastElement.positionEnd : 0;
        const positionEnd = positionStart + 5; // Default 5s duration

        const newTextElement: TextElement = {
            id: crypto.randomUUID(),
            trackId: activeTrack.id,
            positionStart,
            positionEnd,
            content: textConfig.content,
            fontFamily: textConfig.fontFamily,
            fontSize: textConfig.fontSize,
            color: textConfig.color,
            layerOrder: textConfig.layerOrder,
            x: 50,
            y: 50,
        };

        dispatch(setTextElements([...textElements, newTextElement]));
        toast.success('Text added successfully.');
    };

    return (
        <form onSubmit={handleAddText} className="space-y-4 p-4 bg-gray-800 rounded-lg">
            <h3 className="text-lg font-semibold text-white">Add Text</h3>
            <div>
                <label className="block text-sm font-medium text-gray-300">Content</label>
                <input
                    type="text"
                    value={textConfig.content}
                    onChange={(e) => setTextConfig({ ...textConfig, content: e.target.value })}
                    className="w-full p-2 bg-gray-700 rounded"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-300">Z-index</label>
                <input
                    type="number"
                    value={textConfig.layerOrder}
                    onChange={(e) => setTextConfig({ ...textConfig, layerOrder: Number(e.target.value) })}
                    className="w-full p-2 bg-gray-700 rounded"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-300">Font</label>
                <select
                    value={textConfig.fontFamily}
                    onChange={(e) => setTextConfig({ ...textConfig, fontFamily: e.target.value })}
                    className="w-full p-2 bg-gray-700 rounded"
                >
                    <option>Arial</option>
                    <option>Verdana</option>
                    <option>Times New Roman</option>
                </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300">Font Size</label>
                    <input
                        type="number"
                        value={textConfig.fontSize}
                        onChange={(e) => setTextConfig({ ...textConfig, fontSize: Number(e.target.value) })}
                        className="w-full p-2 bg-gray-700 rounded"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300">Color</label>
                    <input
                        type="color"
                        value={textConfig.color}
                        onChange={(e) => setTextConfig({ ...textConfig, color: e.target.value })}
                        className="w-full h-10 p-1 bg-gray-700 rounded"
                    />
                </div>
            </div>
            <button type="submit" className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold">
                Add to Timeline
            </button>
        </form>
    );
} 