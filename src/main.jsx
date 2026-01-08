import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { ToastProvider } from './contexts/ToastContext';
import './i18n';

import GlobalErrorBoundary from './components/common/GlobalErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <GlobalErrorBoundary>
            <ToastProvider>
                <App />
            </ToastProvider>
        </GlobalErrorBoundary>
    </React.StrictMode>,
)
