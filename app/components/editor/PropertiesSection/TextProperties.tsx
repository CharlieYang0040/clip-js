"use client";

import { useAppSelector } from '../../../store';
import { setTextElements } from '../../../store/slices/projectSlice';
import { TextElement } from '../../../types';
import { useAppDispatch } from '../../../store';

export default function TextProperties() {
    const { textElements, activeElements } = useAppSelector((state) => state.projectState);
    const activeTextElement = activeElements.find(el => el.type === 'text');
    const textElement = textElements.find(el => el.id === activeTextElement?.id);
    const dispatch = useAppDispatch();

    const onUpdateText = (id: string, updates: Partial<TextElement>) => {
        dispatch(setTextElements(textElements.map(text =>
            text.id === id ? { ...text, ...updates } : text
        )));
    };

    if (!textElement) return null;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-8">
                {/* Text Content */}
                <div className="space-y-2">
                    <h4 className="font-semibold">Text Content</h4>
                    <div>
                        <textarea
                            value={textElement.content}
                            onChange={(e) => onUpdateText(textElement.id, { content: e.target.value })}
                            className="w-full p-2 bg-darkSurfacePrimary border border-white border-opacity-10 shadow-md text-white rounded focus:outline-none focus:ring-2 focus:ring-white-500 focus:border-white-500"
                            rows={3}
                        />
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
                                value={textElement.positionStart}
                                min={0}
                                readOnly={true}
                                onChange={(e) => onUpdateText(textElement.id, {
                                    positionStart: Number(e.target.value),
                                    positionEnd: Number(e.target.value) + (textElement.positionEnd - textElement.positionStart)
                                })}
                                className="w-full p-2 bg-darkSurfacePrimary border border-white border-opacity-10 shadow-md text-white rounded focus:outline-none focus:ring-2 focus:ring-white-500 focus:border-white-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm">End (s)</label>
                            <input
                                type="number"
                                readOnly={true}
                                value={textElement.positionEnd}
                                min={textElement.positionStart}
                                onChange={(e) => onUpdateText(textElement.id, {
                                    positionEnd: Number(e.target.value)
                                })}
                                className="w-full p-2 bg-darkSurfacePrimary border border-white border-opacity-10 shadow-md text-white rounded focus:outline-none focus:ring-2 focus:ring-white-500 focus:border-white-500"
                            />
                        </div>
                    </div>
                </div>
                {/* Visual Properties */}
                <div className="space-y-2">
                    <h4 className="font-semibold">Visual Properties</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm">X Position</label>
                            <input
                                type="number"
                                step="10"
                                value={textElement.x || 0}
                                onChange={(e) => onUpdateText(textElement.id, { x: Number(e.target.value) })}
                                className="w-full p-2 bg-darkSurfacePrimary border border-white border-opacity-10 shadow-md text-white rounded focus:outline-none focus:ring-2 focus:ring-white-500 focus:border-white-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm">Y Position</label>
                            <input
                                type="number"
                                step="10"
                                value={textElement.y || 0}
                                onChange={(e) => onUpdateText(textElement.id, { y: Number(e.target.value) })}
                                className="w-full p-2 bg-darkSurfacePrimary border border-white border-opacity-10 shadow-md text-white rounded focus:outline-none focus:ring-2 focus:ring-white-500 focus:border-white-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm">Font Size</label>
                            <input
                                type="number"
                                step="5"
                                value={textElement.fontSize || 24}
                                onChange={(e) => onUpdateText(textElement.id, { fontSize: Number(e.target.value) })}
                                className="w-full p-2 bg-darkSurfacePrimary border border-white border-opacity-10 shadow-md text-white rounded focus:outline-none focus:ring-2 focus:ring-white-500 focus:border-white-500"
                            />
                        </div>
                        <div className='flex flex-col gap-2'>
                            <label className="text-sm">Z-index</label>
                            <input
                                type="number"
                                className="p-2 bg-gray-700 rounded"
                                value={textElement.layerOrder || 0}
                                onChange={(e) => onUpdateText(textElement.id, { layerOrder: Number(e.target.value) })}
                            />
                        </div>
                        {/* Font Type */}
                        <div >
                            <label className="block text-sm font-medium text-white">Font Type</label>
                            <select
                                value={textElement.fontFamily}
                                onChange={(e) => onUpdateText(textElement.id, { fontFamily: e.target.value })}
                                className="w-full p-2 bg-darkSurfacePrimary border border-white border-opacity-10 shadow-md text-white rounded focus:outline-none focus:ring-2 focus:ring-white-500 focus:border-white-500"
                            >
                                <option value="Arial">Arial</option>
                                <option value="Inter">Inter</option>
                                <option value="Lato">Lato</option>
                            </select>
                        </div>
                    </div>
                </div>
                {/* Style Properties */}
                <div className="space-y-2">
                    <h4 className="font-semibold">Style Properties</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm">Text Color</label>
                            <input
                                type="color"
                                value={textElement.color || '#ffffff'}
                                onChange={(e) => onUpdateText(textElement.id, { color: e.target.value })}
                                className="w-full h-10 bg-darkSurfacePrimary border border-white border-opacity-10 shadow-md rounded focus:outline-none focus:ring-2 focus:ring-white-500 focus:border-white-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm">Opacity</label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={textElement.opacity}
                                onChange={(e) => onUpdateText(textElement.id, { opacity: Number(e.target.value) })}
                                className="w-full bg-darkSurfacePrimary border border-white border-opacity-10 shadow-md text-white rounded focus:outline-none focus:border-white-500"
                            />
                        </div>
                    </div>
                </div>
                <div >
                </div>
            </div>
        </div >
    );
}