import React from 'react';
import { telemetry } from '../../services/TelemetryService';

class GlobalErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // Log the error to your error reporting service
        console.error('Uncaught error:', error, errorInfo);

        telemetry.track('APP_CRASH_RENDERER', {
            error: error.toString(),
            stack: error.stack,
            componentStack: errorInfo.componentStack
        }, true); // immediate = true
    }

    handleReload = () => {
        window.location.reload();
    };

    handleReset = () => {
        // Optional: clearing local storage or caches if needed
        this.setState({ hasError: false, error: null, errorInfo: null });
        window.location.reload();
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-200 p-8 font-sans">
                    <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-8 text-center">
                        <div className="mb-6 flex justify-center">
                            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                        </div>

                        <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
                        <p className="text-slate-400 mb-6">
                            The application encountered an unexpected error and needs to restart.
                        </p>

                        <div className="bg-slate-950 rounded p-4 mb-6 text-left overflow-auto max-h-32 text-xs font-mono text-red-400 border border-slate-800">
                            {this.state.error && this.state.error.toString()}
                        </div>

                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={this.handleReload}
                                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors"
                            >
                                Restart Application
                            </button>
                        </div>

                        <p className="mt-6 text-xs text-slate-600">
                            A report has been sent to our team.
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default GlobalErrorBoundary;
