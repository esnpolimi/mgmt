import {useLocation, useParams, useNavigate} from 'react-router-dom';
import {Container, Typography, Box, Button, Alert} from '@mui/material';
import StatusBanner from '../../Components/StatusBanner';

export default function EventFormResult() {
    const {id} = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    const navState = location.state || {};
    const paymentError = !!navState.paymentError;
    const paymentErrorMessage = navState.paymentErrorMessage ||
        "Online payment currently unavailable. Your subscription is recorded; please contact us at informatica@esnpolimi.it";
    const subscriptionId = navState.subscriptionId || new URLSearchParams(location.search).get('subscription_id');
    const assignedList = navState.assignedList || localStorage.getItem('sumup_last_assigned_list');
    const paid = !!navState.paid;
    const noPayment = !!navState.noPayment;

    let bannerMessage;
    let bannerState;

    if (!subscriptionId) {
        bannerMessage = 'Missing subscription identifier.';
        bannerState = 'error';
    } else if (paymentError) {
        bannerMessage = `Subscription saved.`;
        bannerState = 'success';
    } else if (noPayment) {
        bannerMessage = `Subscription successful${assignedList ? ` - ${assignedList}` : ''}.`;
        bannerState = 'success';
    } else if (paid) {
        bannerMessage = 'Subscription confirmed. Payment received.';
        bannerState = 'success';
    } else {
        bannerMessage = 'Subscription submitted. Awaiting payment completion.';
        bannerState = 'info';
    }

    const retryNavigate = () => navigate(`/event/${id}/formlogin`);

    return (
        <Container maxWidth="sm">
            <Box sx={{mt:4, display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', p:3, gap:2}}>
                <Typography variant="h4" gutterBottom>Event Subscription</Typography>
                <StatusBanner message={bannerMessage} state={bannerState}/>
                {paymentError && (
                    <Alert severity="warning">{paymentErrorMessage}</Alert>
                )}
                {!paid && !noPayment && !paymentError && (
                    <Alert severity="info">
                        If you already completed payment but still see this message, it will update shortly.
                    </Alert>
                )}
                {assignedList && bannerState === 'success' && (
                    <Typography variant="body2">
                        You were placed in: <strong>{assignedList}</strong>
                    </Typography>
                )}
                <Typography variant="caption">
                    An email has been sent for confirmation.
                 </Typography>
                {bannerState === 'error' && (
                    <Button variant="contained" sx={{mt:2}} onClick={retryNavigate}>Start Over</Button>
                )}
            </Box>
        </Container>
    );
}
