import React from 'react';
import { Plus, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import QuickSelectCard from '../common/QuickSelectCard';
import { useTranslation } from 'react-i18next';

const QuickSwitchPanel = ({
    instances,
    selectedInstance,
    setSelectedInstance,
    onManageAll,
    onNewCrop,
    className = ""
}) => {
    const { t } = useTranslation();
    const scrollContainerRef = React.useRef(null);
    const panelRef = React.useRef(null);
    const [isMinimized, setIsMinimized] = React.useState(true);
    const [hasResetScroll, setHasResetScroll] = React.useState(false);

    // Click outside to minimize
    React.useEffect(() => {
        function handleClickOutside(event) {
            if (panelRef.current && !panelRef.current.contains(event.target) && !isMinimized) {
                setIsMinimized(true);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isMinimized]);

    // Initial scroll reset
    React.useEffect(() => {
        if (instances && instances.length > 0 && !hasResetScroll && scrollContainerRef.current) {
            scrollContainerRef.current.scrollLeft = 0;
            setHasResetScroll(true);
        }
    }, [instances, hasResetScroll]);

    const handleWheel = (e) => {
        if (scrollContainerRef.current && e.deltaY !== 0) {
            scrollContainerRef.current.scrollBy({
                left: e.deltaY,
                behavior: 'smooth'
            });
        }
    };

    return (
        <div ref={panelRef} className={`absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl z-40 animate-in slide-in-from-bottom-10 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] overflow-hidden ${className} ${isMinimized ? 'w-[90%] max-w-[240px] px-6 py-3 scale-95 opacity-80 hover:scale-100 hover:opacity-100' : 'w-[90%] max-w-5xl p-4 scale-100 opacity-100'}`}>
            <div className={`flex items-center ${isMinimized ? 'justify-center relative' : 'justify-between mb-3 px-2'}`}>
                <button
                    onClick={() => setIsMinimized(!isMinimized)}
                    className={`flex items-center gap-3 group focus:outline-none cursor-pointer transition-all ${isMinimized ? 'w-full justify-center' : ''}`}
                >
                    <span className="text-slate-500 group-hover:text-white transition-colors">
                        {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </span>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap group-hover:text-white transition-colors">Quick Switch</span>
                </button>

                {!isMinimized && (
                    <button
                        onClick={onManageAll}
                        className="flex items-center gap-1 text-slate-500 text-xs font-medium hover:text-white transition-colors"
                    >
                        Manage All <ChevronRight size={12} />
                    </button>
                )}
            </div>

            {!isMinimized && (
                <div
                    ref={scrollContainerRef}
                    onWheel={handleWheel}
                    className="flex items-center gap-3 overflow-x-auto custom-scrollbar pb-2 snap-x"
                >
                    {instances.map((instance) => (
                        <QuickSelectCard
                            key={instance.id}
                            instance={instance}
                            isSelected={selectedInstance?.id === instance.id}
                            onClick={() => {
                                setSelectedInstance(instance);
                                setIsMinimized(true);
                            }}
                        />
                    ))}

                    <button
                        onClick={onNewCrop}
                        className="focus:outline-none snap-center flex-shrink-0 w-12 h-[72px] rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20 flex items-center justify-center transition-all group"
                        title={t ? t('home_new_crop') : 'New Crop'}
                    >
                        <Plus size={20} className="text-slate-500 group-hover:text-emerald-400" />
                    </button>
                </div>
            )}
        </div>
    );
};

export default QuickSwitchPanel;
