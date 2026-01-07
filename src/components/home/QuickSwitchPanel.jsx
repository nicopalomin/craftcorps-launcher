import React from 'react';
import { Plus, ChevronRight } from 'lucide-react';
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

    const handleWheel = (e) => {
        if (scrollContainerRef.current) {
            // Prevent default vertical scrolling if meaningful horizontal scroll happens
            // e.preventDefault(); 
            // - Note: preventDefault can't be called on a passive event listener which React 18+ implies.
            // But we can just scroll.
            scrollContainerRef.current.scrollLeft += e.deltaY;
        }
    };

    return (
        <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-5xl bg-slate-950/80 backdrop-blur-xl border border-white/10 p-4 rounded-3xl shadow-2xl z-40 animate-in slide-in-from-bottom-10 duration-500 transition-all ${className}`}>
            <div className="flex items-center justify-between mb-3 px-2">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quick Switch</h3>
                <button
                    onClick={onManageAll}
                    className="flex items-center gap-1 text-slate-500 text-xs font-medium hover:text-white transition-colors"
                >
                    Manage All <ChevronRight size={12} />
                </button>
            </div>

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
                        onClick={() => setSelectedInstance(instance)}
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
        </div>
    );
};

export default QuickSwitchPanel;
