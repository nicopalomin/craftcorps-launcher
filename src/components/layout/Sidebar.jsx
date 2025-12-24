import React, { useRef, useEffect } from 'react';
import { Sprout, Play, Edit3, HardDrive, Settings, Shirt } from 'lucide-react';
import SidebarItem from './SidebarItem';
import SneakyAd from '../common/SneakyAd';

const Sidebar = ({ activeTab, onTabChange }) => {
    return (
        <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col p-4 z-20 select-none">
            {/* Logo area */}
            <div className="flex items-center gap-3 px-2 mb-8 mt-2 select-none pointer-events-none">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-green-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-900/50">
                    <Sprout size={20} className="text-white" />
                </div>
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-green-200">
                    CraftCrops
                </h1>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1">
                <SidebarItem
                    icon={Play}
                    label="Play"
                    active={activeTab === 'home'}
                    onClick={() => onTabChange('home')}
                />
                <SidebarItem
                    icon={Edit3}
                    label="Edit Crops"
                    active={activeTab === 'instances'}
                    onClick={() => onTabChange('instances')}
                />
                <SidebarItem
                    icon={HardDrive}
                    label="Mod Vault"
                    active={activeTab === 'mods'}
                    onClick={() => onTabChange('mods')}
                />
                <div className="pt-4 mt-4 border-t border-slate-800">
                    <SidebarItem
                        icon={Settings}
                        label="Settings"
                        active={activeTab === 'settings'}
                        onClick={() => onTabChange('settings')}
                    />
                    <SidebarItem
                        icon={Shirt}
                        label="Wardrobe"
                        active={activeTab === 'wardrobe'}
                        onClick={() => onTabChange('wardrobe')}
                    />
                </div>
            </nav>

            {/* Ad Space (Preserved) */}
            <div className="mt-auto pt-4 border-t border-slate-800 relative flex flex-col">
                <SneakyAd />
            </div>
        </aside>
    );
};

export default Sidebar;
