import {Button, Box, Container, Link, TextField, CssBaseline, CircularProgress} from '@mui/material';
import React, {useState} from 'react';
import {useNavigate} from "react-router-dom";
import {useAuth} from "../Context/AuthContext";
import logo from '../assets/esnpolimi-logo.png';
import StatusBanner from "../Components/StatusBanner";
import {fetchCustom} from "../api/api";
import {extractErrorMessage} from "../utils/errorHandling";

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isForgotPassword, setIsForgotPassword] = useState(false); // Toggle for forgot password
    const {login} = useAuth();
    const navigate = useNavigate();
    const [statusMessage, setStatusMessage] = useState(null);
    const [isResetSubmitted, setResetSubmitted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleForgotPassword = async () => {
        setIsLoading(true);
        try {
            console.log("Sending forgot password request for:", username);
            const response = await fetchCustom("POST", '/api/forgot-password/', {email: username}, {}, false);
            if (response.ok) {
                setResetSubmitted(true);
                setStatusMessage({message: 'Se il profilo è registrato, l\'email è stata inviata con successo a "' + username + '". Controlla la tua casella di posta.', state: 'success'});
            } else {
                const errorMessage = await extractErrorMessage(response);
                setStatusMessage({message: `Errore durante l\'invio dell\'email: ${errorMessage}`, state: 'error'});
            }
        } catch (error) {
            setStatusMessage({message: `Errore generale: ${error}`, state: 'error'});
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogin = async () => {
        setIsLoading(true);
        setStatusMessage(null);
        const success = await login(username, password);
        setIsLoading(false);
        if (success === true) {
            navigate("/");
        } else if (
            typeof success === "string" &&
            (success.trim().startsWith("<!DOCTYPE html") || success.trim().startsWith("<html"))
        ) {
            // Open the HTML error in a new tab
            const newWindow = window.open();
            if (newWindow) {
                newWindow.document.open();
                newWindow.document.write(success);
                newWindow.document.close();
            } else {
                setStatusMessage({message: "Impossibile aprire la pagina di errore in una nuova scheda.", state: 'error'});
            }
        } else {
            setStatusMessage({message: `Errore durante il login: ${success}`, state: 'error'});
        }
    };

    return (
        <Container component="main" maxWidth="xs">
            <CssBaseline/>
            <Box
                sx={{
                    marginTop: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}>
                <img alt='' src={logo || ''} style={{height: '25vh'}}/>
                <Box>
                    {!isResetSubmitted && (
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            id="email"
                            label="Email"
                            name="email"
                            autoComplete="email"
                            autoFocus
                            onChange={(e) => setUsername(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (isForgotPassword ? handleForgotPassword() : handleLogin())}
                        />
                    )}
                    {!isForgotPassword && (
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            name="password"
                            label="Password"
                            type="password"
                            id="password"
                            autoComplete="current-password"
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                        />
                    )}
                    {!isResetSubmitted && (
                        <Button
                            fullWidth
                            variant="contained"
                            sx={{mt: 3, mb: 2, backgroundColor: 'black'}}
                            onClick={isForgotPassword ? handleForgotPassword : handleLogin}
                            disabled={isLoading}>
                            {isLoading ? (
                                <CircularProgress size={24} color="inherit"/>
                            ) : (
                                isForgotPassword ? 'Invia Email di Reset' : 'Log In'
                            )}
                        </Button>
                    )}
                    <Box sx={{display: 'flex', justifyContent: 'center', width: '100%'}}>
                        <Link
                            component="button"
                            variant="body2"
                            onClick={() => {
                                setIsForgotPassword(!isForgotPassword);
                                setResetSubmitted(false);
                                setStatusMessage(null);
                            }}
                            sx={{textAlign: 'center'}}>
                            {isForgotPassword ? 'Torna al Login' : 'Password dimenticata?'}
                        </Link>
                        <Link
                            component="button"
                            variant="body2"
                            onClick={() => navigate('/esner_form')}
                            sx={{textAlign: 'center', marginLeft: 2}}>
                            Non hai un account? Registrati
                        </Link>
                    </Box>
                </Box>
                {statusMessage && (<StatusBanner message={statusMessage.message} state={statusMessage.state}/>)}
            </Box>
        </Container>
    );
}