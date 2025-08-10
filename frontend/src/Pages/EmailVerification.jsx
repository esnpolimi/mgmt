import {useState, useEffect} from 'react';
import {useParams} from 'react-router-dom';
import {Container, Typography, Box} from '@mui/material';
import {defaultErrorHandler, fetchCustom} from "../api/api";
import StatusBanner from '../Components/StatusBanner';

export default function EmailVerification() {
    const {uid, token} = useParams();
    const [statusMessage, setStatusMessage] = useState({
        message: '',
        state: 'loading'
    });

    useEffect(() => {
        if (uid && token) {
            fetchCustom('GET', `/api/profile/verify-email/${uid}/${token}/`, {
                auth: false,
                onSuccess: (results) => setStatusMessage({message: results.message, state: 'success'}),
                onError: (responseOrError) => defaultErrorHandler(responseOrError, (msgObj) => setStatusMessage(msgObj)),
            });
        } else {
            setStatusMessage({message: 'Invalid verification link', state: 'error'});
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
                    message={statusMessage.message}
                    state={statusMessage.state}
                    loadingText="Verifying your email address..."
                />
            </Box>
        </Container>
    );
}