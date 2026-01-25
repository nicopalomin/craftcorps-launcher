import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sprout, Play, FolderMinus, Box, Settings, Shirt, Store, Gift, PanelLeftClose, PanelLeftOpen, Star, User } from 'lucide-react';
import SidebarItem from './SidebarItem';

const Sidebar = ({ activeTab, onTabChange, theme, onSelectRunningInstance }) => {
    const { t } = useTranslation();
    // Initialize from local storage or default to 256
    const [width, setWidth] = React.useState(() => {
        const saved = localStorage.getItem('sidebarWidth');
        return saved ? parseInt(saved, 10) : 256;
    });
    // Default to collapsed (icons only) initially
    const [isCollapsed, setIsCollapsed] = React.useState(true);
    const [isResizing, setIsResizing] = React.useState(false);
    const sidebarRef = useRef(null);




    // Save width to local storage whenever it changes
    useEffect(() => {
        localStorage.setItem('sidebarWidth', width);
    }, [width]);

    const effectiveWidth = isCollapsed ? 80 : width;

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

    const handleMouseLeave = () => {
        // Collapse if leaving (and not resizing)
        if (!isResizing) setIsCollapsed(true);
    };

    const handleDoubleClick = () => {
        setIsCollapsed(false);
    };

    const getSidebarStyles = () => {
        const isHome = activeTab === 'home';
        if (theme === 'midnight') return isHome ? 'bg-black/40 backdrop-blur-xl border-white/5' : 'bg-[#050505] border-white/5';
        if (theme === 'white') return isHome ? 'bg-white/60 backdrop-blur-xl border-slate-200' : 'bg-white border-slate-200';
        return isHome ? 'bg-slate-900/40 backdrop-blur-xl border-white/5' : 'bg-slate-900 border-slate-800'; // Default Classic
    };

    return (
        <aside
            ref={sidebarRef}
            className={`${getSidebarStyles()} border-r flex flex-col z-20 select-none relative group/sidebar ${isResizing ? 'transition-none' : 'transition-[width,background-color] duration-500 ease-out'} transform-gpu will-change-[width] overflow-hidden`}
            style={{ width: effectiveWidth }}
            onMouseLeave={handleMouseLeave}
            onDoubleClick={handleDoubleClick}
        >
            <div className="flex flex-col h-full overflow-hidden p-4" style={{ width: width, minWidth: width }}>
                {/* Logo area */}
                <div className="flex items-center mb-8 mt-2 pl-2 select-none pointer-events-none whitespace-nowrap transition-all duration-500 ease-out">
                    <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center transition-all duration-500 relative">
                        <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full scale-110 animate-pulse" />
                        <img
                            src="images/cc-logo.png"
                            alt="CraftCorps"
                            className="w-full h-full object-contain scale-[0.8] transform-gpu drop-shadow-[0_0_12px_rgba(16,185,129,0.4)] z-10"
                        />
                    </div>
                    <h1 className={`text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-green-200 transition-all duration-500 ease-out overflow-hidden ${width < 180 || isCollapsed ? 'opacity-0 max-w-0 ml-0' : 'opacity-100 max-w-[200px] ml-3'}`}>
                        CraftCorps
                    </h1>
                </div>

                {/* Navigation */}
                <nav className="flex-1 flex flex-col space-y-1 overflow-hidden">
                    <SidebarItem
                        icon={Play}
                        label={t('nav_play')}
                        active={activeTab === 'home'}
                        onClick={() => onTabChange('home')}
                        collapsed={isCollapsed}
                        fill="#6ee7b7"
                    />
                    <SidebarItem
                        icon={Star}
                        label={t('nav_discover', { defaultValue: 'Discover' })}
                        active={activeTab === 'discover'}
                        onClick={() => onTabChange('discover')}
                        collapsed={isCollapsed}
                        fill="#fcd34d"
                    />
                    <SidebarItem
                        icon={Box}
                        label={t('nav_mod_vault')}
                        active={activeTab === 'mods'}
                        onClick={() => onTabChange('mods')}
                        collapsed={isCollapsed}
                        fill="#93c5fd"
                    />
                    <SidebarItem
                        icon={FolderMinus}
                        label={t('nav_edit_crops')}
                        active={activeTab === 'instances'}
                        onClick={() => onTabChange('instances')}
                        collapsed={isCollapsed}
                        fill="#fda4af"
                    />
                    <SidebarItem
                        icon={Shirt}
                        label={t('nav_wardrobe')}
                        active={activeTab === 'wardrobe'}
                        onClick={() => onTabChange('wardrobe')}
                        collapsed={isCollapsed}
                        fill="#f9a8d4"
                    />

                    <div className={`pt-4 mt-4 border-t border-slate-800 ${isCollapsed ? 'border-transparent' : ''}`}>
                        <SidebarItem
                            icon={Gift}
                            label="Beta Rewards"
                            active={activeTab === 'rewards'}
                            onClick={() => onTabChange('rewards')}
                            collapsed={isCollapsed}
                            fill="#fca5a5"
                        />
                        <SidebarItem
                            icon={Store}
                            label={t('nav_market', { defaultValue: 'Market' })}
                            active={activeTab === 'market'}
                            onClick={() => onTabChange('market')}
                            collapsed={isCollapsed}
                            fill="#fef08a"
                        />
                    </div>

                    <div className="mt-auto pt-4 border-t border-slate-800 space-y-1">
                        <SidebarItem
                            icon={User}
                            label={t('nav_profile', { defaultValue: 'Profile' })}
                            active={activeTab === 'profile'}
                            onClick={() => onTabChange('profile')}
                            collapsed={isCollapsed}
                            fill="#c4b5fd"
                        />
                        <SidebarItem
                            icon={Settings}
                            label={t('nav_settings')}
                            active={activeTab === 'settings'}
                            onClick={() => onTabChange('settings')}
                            collapsed={isCollapsed}
                            fill="#cbd5e1"
                        />
                    </div>
                </nav>

                {/* Version */}
                <div className={`mt-auto pt-4 border-t border-slate-800 transition-all duration-500 ease-out ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
                    <div className="text-[10px] text-slate-600 text-center pb-2 font-mono opacity-50 hover:opacity-100 transition-opacity">
                        v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0'}
                    </div>
                </div>
            </div>

            {/* Resize Handle */}
            {!isCollapsed && (
                <div
                    className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-emerald-500/50 transition-colors z-30 ${isResizing ? 'bg-emerald-500' : 'bg-transparent'}`}
                    onMouseDown={startResizing}
                />
            )}
        </aside>
    );
};

export default Sidebar;
