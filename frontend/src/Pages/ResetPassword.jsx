import React, {useState} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import {Container, TextField, Button, Box, Typography, Link} from '@mui/material';
import StatusBanner from '../Components/StatusBanner';
import logo from '../assets/esnpolimi-logo.png';
import {extractErrorMessage} from "../utils/errorHandling";
import {fetchCustom} from "../api/api";

export default function ResetPassword() {
    const {uid, token} = useParams();
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [statusMessage, setStatusMessage] = useState(null);
    const [isSubmitted, setSubmitted] = useState(false);

    const handleResetPassword = async () => {
        if (password !== confirmPassword) {
            setStatusMessage({message: 'Le password non coincidono.', state: 'error'});
            return;
        }

        try {
            const response = await fetchCustom("POST", `/api/reset-password/${uid}/${token}/`, {
                password: password,
                confirm_password: confirmPassword
            }, {}, false);
            if (response.ok) {
                setSubmitted(true);
                setStatusMessage({message: 'Password reimpostata con successo!', state: 'success'});
            } else {
                const errorMessage = await extractErrorMessage(response);
                setStatusMessage({message: `Errore durante il reset della password: ${errorMessage}`, state: 'error'});
            }
        } catch (error) {
            setStatusMessage({message: `Errore generale: ${error}`, state: 'error'});
        }
    };

    return (
        <Container maxWidth="xs">
            <Box
                sx={{
                    marginTop: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}>
                <img alt='' src={logo || ''} style={{height: '25vh'}}/>
                <Typography style={{marginTop: 10}} variant="h5">Reimposta Password</Typography>
                {statusMessage && <StatusBanner message={statusMessage.message} state={statusMessage.state}/>}
                {!isSubmitted && (<>
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        label="Nuova Password"
                        type="password"
                        onChange={(e) => setPassword(e.target.value)}/>
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        label="Conferma Password"
                        type="password"
                        onChange={(e) => setConfirmPassword(e.target.value)}/>
                    <Button
                        fullWidth
                        variant="contained"
                        sx={{mt: 3, mb: 2}}
                        onClick={handleResetPassword}>
                        Reimposta Password
                    </Button>
                </>)}
                {isSubmitted && (
                    <Link
                        component="button"
                        variant="body2"
                        sx={{textAlign: 'center'}}
                        onClick={() => navigate('/login')}>
                        Vai al Login
                    </Link>
                )}
            </Box>
        </Container>
    );
}
