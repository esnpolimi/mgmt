import {useLocation, useParams, useNavigate} from 'react-router-dom';
import {Container, Typography, Box, Button, Alert} from '@mui/material';

export default function EventFormResult() {
    const {id} = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    const navState = location.state || {};
    const paymentError = !!navState.paymentError;
    const subscriptionId = navState.subscriptionId || new URLSearchParams(location.search).get('subscription_id');
    const assignedList = navState.assignedList || localStorage.getItem('sumup_last_assigned_list');
    const paid = !!navState.paid;
    const noPayment = !!navState.noPayment;
    const paymentRequired = !!navState.paymentRequired;

    // Build concise banner
    let bannerMessage = '';
    let bannerState = 'info';

    if (!subscriptionId) {
        bannerMessage = 'Missing subscription identifier.';
        bannerState = 'error';
    } else if (paid) {
        bannerMessage = `Subscription confirmed${assignedList ? ` - ${assignedList}` : ''}.`;
        bannerState = 'success';
    } else if (noPayment) {
        bannerMessage = `Subscription successful${assignedList ? ` - ${assignedList}` : ''}.`;
        bannerState = 'success';
    } else if (paymentRequired) {
        bannerMessage = 'Subscription saved. Check your email for the payment link.';
        bannerState = 'info';
    } else if (!paymentError) {
        bannerMessage = 'Subscription submitted.';
        bannerState = 'info';
    }
    // paymentError handled by dedicated alert (no banner to avoid duplication)

    const retryNavigate = () => navigate(`/event/${id}/formlogin`);

    return (
        <Container maxWidth="sm">
            <Box sx={{mt:4, display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', p:3, gap:2}}>
                <Typography variant="h4" gutterBottom>Event Subscription</Typography>
                {bannerMessage && !paymentError && (
                    <Alert
                        sx={{width:'100%', alignItems:'center', justifyContent:'center'}}
                        severity={bannerState === 'success' ? 'success' : bannerState === 'error' ? 'error' : 'info'}
                    >
                        {bannerMessage}
                    </Alert>
                )}
                {paymentError && (
                    <Alert severity="warning" sx={{width:'100%'}}>
                        Subscription saved. Online payment currently unavailable. Please contact us at informatica@esnpolimi.it
                    </Alert>
                )}
                {bannerState === 'error' && (
                    <Button variant="contained" sx={{mt:1}} onClick={retryNavigate}>Start Over</Button>
                )}
                <Typography variant="caption">
                    Confirmation email sent.
                </Typography>
            </Box>
        </Container>
    );
}
