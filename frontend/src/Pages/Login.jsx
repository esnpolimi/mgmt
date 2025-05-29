import {Button, Box, Container, Link, TextField, CssBaseline} from '@mui/material';
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

    const handleForgotPassword = async () => {
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
        }
    };

    const handleLogin = async () => {
        setStatusMessage(null);
        const success = await login(username, password);
        if (success === true) navigate("/");
        else setStatusMessage({message: `Errore durante il login: ${success}`, state: 'error'});
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
                            onClick={isForgotPassword ? handleForgotPassword : handleLogin}>
                            {isForgotPassword ? 'Invia Email di Reset' : 'Log In'}
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
                    </Box>
                </Box>
                {statusMessage && (<StatusBanner message={statusMessage.message} state={statusMessage.state}/>)}
            </Box>
        </Container>
    );
}