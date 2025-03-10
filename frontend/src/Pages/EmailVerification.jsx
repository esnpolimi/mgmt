import React, {useState, useEffect} from 'react';
import {useParams} from 'react-router-dom';
import {Container, Typography, Box, CircularProgress, Alert} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import {fetchCustom} from "../api/api";

export default function EmailVerification() {
    const {uid, token} = useParams();
    const [status, setStatus] = useState('loading');
    const [message, setMessage] = useState('');

    useEffect(() => {
        const verifyEmail = async () => {
            try {
                const response = await fetchCustom('GET', `/api/profile/verify-email/${uid}/${token}/`, null, {}, false);
                const data = await response.json();
                if (response.ok) {
                    setStatus('success');
                    setMessage(data.message);
                } else {
                    setStatus('error');
                    setMessage(data.message);
                }
            } catch (error) {
                setStatus('error');
                setMessage('An unexpected error occurred: ' + error.message);
            }
        };

        if (uid && token) {
            verifyEmail().then();
        } else {
            setStatus('error');
            setMessage('Invalid verification link');
        }
    }, [uid, token]);

    return (
        <Container maxWidth="sm">
            <Box
                sx={{
                    mt: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    p: 3,
                    borderRadius: 2,
                    boxShadow: 3,
                    bgcolor: 'background.paper'
                }}
            >
                <Typography variant="h4" component="h1" gutterBottom>
                    Email Verification
                </Typography>

                {status === 'loading' && (
                    <>
                        <CircularProgress sx={{my: 4}}/>
                        <Typography>Verifying your email address...</Typography>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <CheckCircleOutlineIcon color="success" sx={{fontSize: 80, my: 2}}/>
                        <Alert severity="success" sx={{width: '100%', mb: 2}}>
                            {message || 'Email verified successfully!'}
                        </Alert>
                        <Typography>
                            Your email address has been verified and your account is now active.
                        </Typography>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <ErrorOutlineIcon color="error" sx={{fontSize: 80, my: 2}}/>
                        <Alert severity="error" sx={{width: '100%', mb: 2}}>
                            {message || 'Verification failed'}
                        </Alert>
                        <Typography>
                            We couldn't verify your email address. The verification link may be expired or invalid.
                            Please contact us.
                        </Typography>
                    </>
                )}
            </Box>
        </Container>
    );
}