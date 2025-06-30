import {useState, useEffect} from 'react';
import {useParams} from 'react-router-dom';
import {Container, Typography, Box} from '@mui/material';
import {fetchCustom} from "../api/api";
import StatusBanner from '../components/StatusBanner';
import {extractErrorMessage} from "../utils/errorHandling";
import * as Sentry from "@sentry/react";

export default function EmailVerification() {
    const {uid, token} = useParams();
    const [statusMessage, setStatusMessage] = useState({
        message: '',
        state: 'loading'
    });

    useEffect(() => {
        const verifyEmail = async () => {
            try {
                const response = await fetchCustom('GET', `/api/profile/verify-email/${uid}/${token}/`, null, {}, false);
                const json = await response.json();
                if (!response.ok) {
                    const errorMessage = extractErrorMessage(json, response.status);
                    setStatusMessage({message: errorMessage, state: 'error'});
                } else {
                    setStatusMessage({message: json.message, state: 'success'});
                }
            } catch (error) {
                Sentry.captureException(error);
                setStatusMessage({message: `General error: ${error}`, state: 'error'});
            }
        };

        if (uid && token) verifyEmail().then();
        else setStatusMessage({message: 'Invalid verification link', state: 'error'});
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
                    message={statusMessage.message}
                    state={statusMessage.state}
                    loadingText="Verifying your email address..."
                />
            </Box>
        </Container>
    );
}