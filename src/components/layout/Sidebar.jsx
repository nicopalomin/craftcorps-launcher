import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sprout, Play, Edit3, HardDrive, Settings, Shirt, ShoppingBag, Gift, PanelLeftClose, PanelLeftOpen, Star, User } from 'lucide-react';
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


    // Timer ref for hover-to-open functionality
    const hoverTimer = useRef(null);

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

    const handleMouseEnter = () => {
        if (isCollapsed) {
            hoverTimer.current = setTimeout(() => {
                setIsCollapsed(false);
                hoverTimer.current = null;
            }, 750);
        }
    };

    const handleMouseLeave = () => {
        // Clear the open timer if the user leaves before 3s
        if (hoverTimer.current) {
            clearTimeout(hoverTimer.current);
            hoverTimer.current = null;
        }
        // Collapse if leaving (and not resizing)
        if (!isResizing) setIsCollapsed(true);
    };

    const getSidebarStyles = () => {
        if (theme === 'midnight') return 'bg-[#050505] border-white/5'; // Match App background
        if (theme === 'white') return 'bg-white border-slate-200';
        return 'bg-slate-900 border-slate-800'; // Default Classic
    };

    return (
        <aside
            ref={sidebarRef}
            className={`${getSidebarStyles()} border-r flex flex-col z-20 select-none relative group/sidebar ${isResizing ? 'transition-none' : 'transition-[width,background-color] duration-500 ease-out'} transform-gpu will-change-[width] overflow-hidden`}
            style={{ width: effectiveWidth }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div className="flex flex-col h-full overflow-hidden p-4" style={{ width: width, minWidth: width }}>
                {/* Logo area */}
                <div className="flex items-center mb-8 mt-2 pl-2 select-none pointer-events-none overflow-hidden whitespace-nowrap transition-all duration-500 ease-out">
                    <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-green-600 rounded-lg flex-shrink-0 flex items-center justify-center shadow-lg shadow-emerald-900/50 transition-all duration-500">
                        <Sprout size={20} className="text-slate-200" />
                    </div>
                    <h1 className={`text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-green-200 transition-all duration-500 ease-out ${width < 180 || isCollapsed ? 'opacity-0 max-w-0 ml-0' : 'opacity-100 max-w-[200px] ml-3'}`}>
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
                        collapsed={isCollapsed}
                    />
                    <SidebarItem
                        icon={Star}
                        label={t('nav_discover', { defaultValue: 'Discover' })}
                        active={activeTab === 'discover'}
                        onClick={() => onTabChange('discover')}
                        collapsed={isCollapsed}
                    />
                    <SidebarItem
                        icon={HardDrive}
                        label={t('nav_mod_vault')}
                        active={activeTab === 'mods'}
                        onClick={() => onTabChange('mods')}
                        collapsed={isCollapsed}
                    />
                    <SidebarItem
                        icon={Edit3}
                        label={t('nav_edit_crops')}
                        active={activeTab === 'instances'}
                        onClick={() => onTabChange('instances')}
                        collapsed={isCollapsed}
                    />
                    <div className={`pt-4 mt-4 border-t border-slate-800 ${isCollapsed ? 'border-transparent' : ''}`}>
                        <SidebarItem
                            icon={User}
                            label={t('nav_profile', { defaultValue: 'Profile' })}
                            active={activeTab === 'profile'}
                            onClick={() => onTabChange('profile')}
                            collapsed={isCollapsed}
                        />
                        <SidebarItem
                            icon={ShoppingBag}
                            label={t('nav_market', { defaultValue: 'Market' })}
                            active={activeTab === 'market'}
                            onClick={() => onTabChange('market')}
                            collapsed={isCollapsed}
                        />
                        <SidebarItem
                            icon={Gift}
                            label="Beta Rewards"
                            active={activeTab === 'rewards'}
                            onClick={() => onTabChange('rewards')}
                            collapsed={isCollapsed}
                        />
                    </div>
                    <div className={`pt-4 mt-4 border-t border-slate-800 ${isCollapsed ? 'border-transparent' : ''}`}>
                        <SidebarItem
                            icon={Settings}
                            label={t('nav_settings')}
                            active={activeTab === 'settings'}
                            onClick={() => onTabChange('settings')}
                            collapsed={isCollapsed}
                        />
                        <SidebarItem
                            icon={Shirt}
                            label={t('nav_wardrobe')}
                            active={activeTab === 'wardrobe'}
                            onClick={() => onTabChange('wardrobe')}
                            collapsed={isCollapsed}
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
