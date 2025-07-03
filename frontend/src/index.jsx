import * as Sentry from "@sentry/react";

if (import.meta.env.MODE === 'production') {
    Sentry.init({
        dsn: import.meta.env.VITE_SENTRY_DSN,
        sendDefaultPii: true,
        environment: 'production'
    });
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {itIT} from '@mui/material/locale';

const theme = createTheme({
    typography: {
        fontFamily: 'Roboto, Arial, sans-serif',
        h1: {fontFamily: 'Lato, Arial, sans-serif'},
        h2: {fontFamily: 'Lato, Arial, sans-serif'},
        h3: {fontFamily: 'Lato, Arial, sans-serif'},
        h4: {fontFamily: 'Lato, Arial, sans-serif'},
        h5: {fontFamily: 'Lato, Arial, sans-serif'},
    },
    palette: {
        primary: {main: '#1976d2'},
        secondary: {main: '#dc004e'},
        cyan: {main: '#00aeef', contrastText: '#ffffff'},
        magenta: {main: '#ec008c', contrastText: '#ffffff'},
        gray: {main: '#999999', contrastText: '#ffffff'},
    },
});

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
    <React.StrictMode>
        <Sentry.ErrorBoundary fallback={<p>An unexpected error occurred.</p>}>
            <ThemeProvider theme={createTheme(theme, itIT)}>
                <CssBaseline/>
                <App/>
            </ThemeProvider>
        </Sentry.ErrorBoundary>
    </React.StrictMode>
);

reportWebVitals();
