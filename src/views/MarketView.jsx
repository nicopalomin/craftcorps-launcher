import React, { useState } from 'react';
import { ShoppingBag, Mail, Server, Check } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

const MarketView = () => {
    const { addToast } = useToast();
    const [email, setEmail] = useState('');
    const [consent, setConsent] = useState(false);
    const [hasSubscribed, setHasSubscribed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    React.useEffect(() => {
        const checkSubscription = async () => {
            const subscribed = await window.electronAPI.storeGet('marketing.hasSubscribed');
            if (subscribed) {
                setHasSubscribed(true);
            }
        };
        checkSubscription();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!consent) return;

        setIsLoading(true);
        try {
            const response = await window.electronAPI.subscribeToNewsletter(email);
            // Persist subscription state
            await window.electronAPI.storeSet('marketing.hasSubscribed', true);
            setHasSubscribed(true);

            // Check the subscriber state from Kit confirmation
            const state = response?.subscription?.state;

            if (state === 'active') {
                addToast("Success! You're on the list.", "success");
            } else {
                addToast("Confirmation email sent! Please check your inbox.", "success");
            }
        } catch (error) {
            console.error('Subscription failed:', error);
            // Show the actual error message if available, otherwise generic
            const errorMessage = error.message && error.message.includes('Error invoking')
                ? "Backend Error: Check terminal logs."
                : error.message || "Failed to join list.";
            addToast(`Error: ${errorMessage}`, "error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex-1 bg-[url('https://images.unsplash.com/photo-1555680202-c86f0e12f086?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center overflow-hidden relative">
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" />

            <div className="relative z-10 h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">

                <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 ring-2 ring-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.2)]">
                    <ShoppingBag size={48} className="text-emerald-400" />
                </div>

                <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400 mb-4 tracking-tight">
                    Market
                </h1>

                <p className="text-xl text-emerald-400/90 font-medium mb-12 max-w-2xl">
                    Built by Developers, for Server Owners.
                </p>

                <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-3xl p-8 max-w-lg w-full shadow-2xl relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-500">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    <div className="relative z-10">
                        <div className="flex justify-center mb-6">
                            <Server size={32} className="text-slate-400" />
                        </div>

                        <h2 className="text-xl font-bold text-slate-200 mb-2">Monetize Your Server</h2>
                        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                            Are you a server owner looking to grow your revenue? Join our mailing list to get exclusive updates on the market launch.
                        </p>

                        {!hasSubscribed ? (
                            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                                        <Mail size={18} />
                                    </div>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Enter your email address..."
                                        className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl py-4 pl-12 pr-32 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 focus:bg-slate-950/80 transition-all shadow-inner"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!consent || isLoading}
                                        className="absolute right-2 top-2 bottom-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold px-4 rounded-lg transition-colors text-sm shadow-lg shadow-emerald-500/20 disabled:shadow-none"
                                    >
                                        {isLoading ? 'Joining...' : 'Join List'}
                                    </button>
                                </div>

                                <label className="flex items-start gap-3 cursor-pointer group text-left px-1 mt-2 select-none">
                                    <div className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-200 shrink-0 ${consent ? 'bg-emerald-500 border-emerald-500 shadow-sm shadow-emerald-500/20' : 'bg-slate-900 border-slate-600 group-hover:border-slate-500'}`}>
                                        <Check size={14} className={`text-slate-950 stroke-[3] transition-transform duration-200 ${consent ? 'scale-100' : 'scale-0'}`} />
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={consent}
                                        onChange={(e) => setConsent(e.target.checked)}
                                    />
                                    <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors leading-relaxed">
                                        I agree to receive marketing emails and updates from CraftCorps. We respect your privacy and process data via Kit.com. {' '}
                                        <button
                                            type="button"
                                            className="text-emerald-500 hover:text-emerald-400 underline decoration-emerald-500/30 underline-offset-2 hover:decoration-emerald-500/50"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                window.electronAPI.openPath('https://kit.com/privacy');
                                            }}
                                        >
                                            Read Policy.
                                        </button>
                                    </span>
                                </label>
                            </form>
                        ) : (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 flex flex-col items-center justify-center gap-3 text-emerald-400 animate-in zoom-in duration-300 w-full">
                                <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mb-1">
                                    <Check size={24} className="text-emerald-400" />
                                </div>
                                <div className="text-center">
                                    <div className="font-bold text-lg text-emerald-300">You're on the list!</div>
                                    <div className="text-sm text-emerald-500/80 mt-1">We'll let you know when the market opens.</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-12 text-slate-500 text-sm font-mono opacity-50">
                    Coming soon to CraftCorps...
                </div>
            </div>
        </div>
    );
};

export default MarketView;
