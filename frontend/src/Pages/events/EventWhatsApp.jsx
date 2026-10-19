import {useEffect, useState} from 'react';
import {useLocation} from 'react-router-dom';
import {Alert, Box, Button, CircularProgress, Container, Typography} from '@mui/material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import {fetchCustom} from '../../api/api';

/**
 * Stable entry point sent by email / encoded in QR codes.
 * Resolves the event's *current* WhatsApp group link (organizers may replace it) and redirects to it.
 */
export default function EventWhatsApp() {
    const location = useLocation();
    const search = new URLSearchParams(location.search);
    const subscriptionId = search.get('subscriptionId');
    const token = search.get('t');
    const [status, setStatus] = useState('loading'); // loading | ready | unavailable
    const [link, setLink] = useState(null);

    useEffect(() => {
        if (!subscriptionId || !token) {
            setStatus('unavailable');
            return;
        }
        fetchCustom('GET', `/subscription/${subscriptionId}/whatsapp/?t=${encodeURIComponent(token)}`, {
            auth: false,
            onSuccess: (data) => {
                if (!data?.whatsapp_group_link) {
                    setStatus('unavailable');
                    return;
                }
                setLink(data.whatsapp_group_link);
                setStatus('ready');
                window.location.replace(data.whatsapp_group_link);
            },
            onError: () => setStatus('unavailable'),
        });
    }, [subscriptionId, token]);

    return (
        <Container maxWidth="sm">
            <Box sx={{mt: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 2}}>
                <WhatsAppIcon sx={{fontSize: 48, color: '#25D366'}}/>
                {status === 'loading' && <CircularProgress/>}
                {status === 'ready' && (
                    <>
                        <Typography>Opening WhatsApp...</Typography>
                        <Button variant="contained" href={link} sx={{bgcolor: '#25D366', '&:hover': {bgcolor: '#1ebe5b'}}}>
                            Open the group
                        </Button>
                    </>
                )}
                {status === 'unavailable' && (
                    <Alert severity="info" sx={{width: '100%'}}>
                        The WhatsApp group link is not available for this subscription.
                        If you think this is a mistake, please contact the event organizers.
                    </Alert>
                )}
            </Box>
        </Container>
    );
}
