import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sprout, Play, Edit3, HardDrive, Settings, Shirt, ShoppingBag } from 'lucide-react';
import SidebarItem from './SidebarItem';
import SneakyAd from '../common/SneakyAd';

const Sidebar = ({ activeTab, onTabChange, theme }) => {
    const { t } = useTranslation();
    // Initialize from local storage or default to 256
    const [width, setWidth] = React.useState(() => {
        const saved = localStorage.getItem('sidebarWidth');
        return saved ? parseInt(saved, 10) : 256;
    });
    const [isResizing, setIsResizing] = React.useState(false);
    const sidebarRef = useRef(null);

    // Save width to local storage whenever it changes
    useEffect(() => {
        localStorage.setItem('sidebarWidth', width);
    }, [width]);

    const startResizing = React.useCallback(() => {
        setIsResizing(true);
    }, []);

    const stopResizing = React.useCallback(() => {
        setIsResizing(false);
        // Reset cursor
        document.body.style.cursor = 'default';
    }, []);

    const resize = React.useCallback(
        (mouseMoveEvent) => {
            if (isResizing) {
                const newWidth = mouseMoveEvent.clientX;
                const minWidth = window.innerWidth * 0.18; // 18%
                const maxWidth = window.innerWidth * 0.4; // 40%

                if (newWidth >= minWidth && newWidth <= maxWidth) {
                    setWidth(newWidth);
                }
            }
        },
        [isResizing]
    );

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
            // Prevent text selection while resizing
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        } else {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
            document.body.style.userSelect = '';
        }
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isResizing, resize, stopResizing]);

    const getSidebarStyles = () => {
        if (theme === 'midnight') return 'bg-[#050505] border-white/5'; // Match App background
        if (theme === 'white') return 'bg-white border-slate-200';
        return 'bg-slate-900 border-slate-800'; // Default Classic
    };

    return (
        <aside
            ref={sidebarRef}
            className={`${getSidebarStyles()} border-r flex flex-col p-4 z-20 select-none relative group/sidebar transition-colors duration-300`}
            style={{ width: width }}
        >
            {/* Resize Handle */}
            <div
                className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-emerald-500/50 transition-colors z-30 ${isResizing ? 'bg-emerald-500' : 'bg-transparent'}`}
                onMouseDown={startResizing}
            />

            {/* Logo area */}
            <div className="flex items-center gap-3 px-2 mb-8 mt-2 select-none pointer-events-none overflow-hidden whitespace-nowrap">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-green-600 rounded-lg flex-shrink-0 flex items-center justify-center shadow-lg shadow-emerald-900/50">
                    <Sprout size={20} className="text-slate-200" />
                </div>
                <h1 className={`text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-green-200 transition-opacity duration-200 ${width < 180 ? 'opacity-0' : 'opacity-100'}`}>
                    CraftCorps
                </h1>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 overflow-hidden">
                <SidebarItem
                    icon={Play}
                    label={t('nav_play')}
                    active={activeTab === 'home'}
                    onClick={() => onTabChange('home')}
                />
                <SidebarItem
                    icon={Edit3}
                    label={t('nav_edit_crops')}
                    active={activeTab === 'instances'}
                    onClick={() => onTabChange('instances')}
                />
                <SidebarItem
                    icon={HardDrive}
                    label={t('nav_mod_vault')}
                    active={activeTab === 'mods'}
                    onClick={() => onTabChange('mods')}
                />
                <SidebarItem
                    icon={ShoppingBag}
                    label={t('nav_market', { defaultValue: 'Market' })}
                    active={activeTab === 'market'}
                    onClick={() => onTabChange('market')}
                />
                <div className="pt-4 mt-4 border-t border-slate-800">
                    <SidebarItem
                        icon={Settings}
                        label={t('nav_settings')}
                        active={activeTab === 'settings'}
                        onClick={() => onTabChange('settings')}
                    />
                    <SidebarItem
                        icon={Shirt}
                        label={t('nav_wardrobe')}
                        active={activeTab === 'wardrobe'}
                        onClick={() => onTabChange('wardrobe')}
                    />
                </div>
            </nav>

            {/* Ad Space (Preserved) */}
            <div className={`mt-auto pt-4 border-t border-slate-800 relative flex flex-col overflow-hidden transition-opacity duration-200 ${width < 200 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                <SneakyAd />
                <div className="text-[10px] text-slate-600 text-center pb-2 font-mono opacity-50 hover:opacity-100 transition-opacity">
                    v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0'}
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
