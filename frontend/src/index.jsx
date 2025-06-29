import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {itIT} from '@mui/material/locale';

// Import Sentry and tracing
import * as Sentry from "@sentry/react";
// import {BrowserTracing} from "@sentry/tracing";
// import {browserTracingIntegration} from "@sentry/react";

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

// Initialize Sentry as early as possible
Sentry.init({
    dsn: "https://f7ee9b97bae2c35e767d8e156eb7b116@o4509581352828928.ingest.de.sentry.io/4509581461487696",
    sendDefaultPii: true,
    //integrations: [Sentry.browserTracingIntegration()],
    //tracesSampleRate: 1.0,  // Adjust in production to reduce volume
    //tracePropagationTargets: ["localhost", /^https:\/\/mgmt.esnpolimi.it\.io\/api/],
});

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
    //<React.StrictMode>
    <ThemeProvider theme={createTheme(theme, itIT)}>
        <CssBaseline/>
        <App/>
    </ThemeProvider>
    //</React.StrictMode>
);

reportWebVitals();
