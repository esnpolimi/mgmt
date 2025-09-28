import * as Sentry from "@sentry/react";

if (import.meta.env.MODE === 'production') {
    // Set VITE_SENTRY_DSN and VITE_API_HOST manually
    window.API_HOST = "https://mgmt.esnpolimi.it/backend";
    Sentry.init({
        dsn: "https://f7ee9b97bae2c35e767d8e156eb7b116@o4509581352828928.ingest.de.sentry.io/4509581461487696",
        sendDefaultPii: true,
        environment: 'production'
    });
}

else {
    // Set VITE_API_HOST manually
    window.API_HOST = "http://localhost:8000/backend";
}

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
    <Sentry.ErrorBoundary fallback={<p>An unexpected error occurred.</p>}>
        <ThemeProvider theme={createTheme(theme, itIT)}>
            <CssBaseline/>
            <App/>
        </ThemeProvider>
    </Sentry.ErrorBoundary>
);

reportWebVitals();
