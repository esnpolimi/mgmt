import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const theme = createTheme({
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif', // Default font for body text
    h1: {
      fontFamily: 'Lato, Arial, sans-serif',
    },
    h2: {
      fontFamily: 'Lato, Arial, sans-serif',
    },
    h3: {
      fontFamily: 'Lato, Arial, sans-serif',
    },
    h4: {
      fontFamily: 'Lato, Arial, sans-serif',
    },
    h5: {
      fontFamily: 'Lato, Arial, sans-serif',
    }
  },
  palette: {
    primary: {
      main: '#1976d2', // Custom primary color
    },
    secondary: {
      main: '#dc004e', // Custom secondary color
    },
    cyan:{
      main: '#00aeef',
      contrastText: '#ffffff',
    },
    magenta:{
      main: '#ec008c',
      contrastText: '#ffffff',  
    },
    gray:{
      main: '#999999',
      contrastText: '#ffffff',  
    },
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals

reportWebVitals();
