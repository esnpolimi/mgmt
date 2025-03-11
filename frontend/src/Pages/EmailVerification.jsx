import React, {useState, useEffect} from 'react';
import {useParams} from 'react-router-dom';
import {Container, Typography, Box} from '@mui/material';
import {fetchCustom} from "../api/api";
import StatusBanner from '../components/StatusBanner';

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

                <StatusBanner
                    status={status}
                    message={message}
                    loadingText="Verifying your email address..."
                    successText="Your email address has been verified and your account is now active."
                    errorText="We couldn't verify your email address. The verification link may be expired or invalid. Please contact us."
                />
            </Box>
        </Container>
    );
}