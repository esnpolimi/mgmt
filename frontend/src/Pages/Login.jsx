import {Button, Box, Container, Link, TextField, CssBaseline, CircularProgress, Typography} from '@mui/material';
import {useState} from 'react';
import {useNavigate} from "react-router-dom";
import {useAuth} from "../Context/AuthContext";
import logo from '../assets/esnpolimi-logo.png';
import StatusBanner from "../Components/StatusBanner";
import {defaultErrorHandler, fetchCustom} from "../api/api";

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const {login} = useAuth();
    const navigate = useNavigate();
    const [statusMessage, setStatusMessage] = useState(null);
    const [isResetSubmitted, setResetSubmitted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleForgotPassword = () => {
        setIsLoading(true);
        fetchCustom("POST", '/api/forgot-password/', {
            body: {email: email},
            auth: false,
            onSuccess: () => {
                setResetSubmitted(true);
                setStatusMessage({message: 'Se il profilo è registrato, l\'email è stata inviata con successo a "' + email + '". Controlla la tua casella di posta.', state: 'success'});
            },
            onError: (responseOrError) => defaultErrorHandler(responseOrError, (msgObj) => setStatusMessage(msgObj)),
            onFinally: () => setIsLoading(false)
        });
    };

    const handleLogin = async () => {
        setIsLoading(true);
        setStatusMessage(null);
        const success = await login(email, password);
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
                <img src={logo} alt='ESN Polimi Logo' style={{height: '25vh', marginBottom: "4px"}}/>
                <Typography variant="h5" gutterBottom align="center">
                    Login al Sistema di Gestione
                </Typography>
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
                            onChange={(e) => setEmail(e.target.value)}
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