"use client";

import { useAppSelector } from "@/app/store";
import AssetItem from "@/app/components/editor/AssetsPanel/AssetItem";

export default function AssetList() {
    const { filesID } = useAppSelector((state) => state.projectState);

    if (!filesID || filesID.length === 0) {
        return (
            <div className="text-center text-sm text-gray-400 mt-4">
                No media files uploaded yet.
            </div>
        );
    }

    return (
        <div className="p-2 space-y-2">
            <h3 className="text-lg font-semibold text-white">My Media</h3>
            <div className="grid grid-cols-2 gap-2">
                {filesID.map((fileId) => (
                    <AssetItem key={fileId} fileId={fileId} />
                ))}
            </div>
        </div>
    );
} 