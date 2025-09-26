import {useState, useEffect} from 'react';
import {Box, Button, Container, CssBaseline, TextField, Typography, Link, CircularProgress, Paper} from '@mui/material';
import {useNavigate, useParams} from "react-router-dom";
import {fetchCustom} from "../../api/api";
import StatusBanner from "../../Components/StatusBanner";
import logo from '../../assets/esnpolimi-logo.png';
import Alert from '@mui/material/Alert';

export default function EventFormLogin() {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState(null);
    const [eventData, setEventData] = useState(null);
    const [fetching, setFetching] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [formStatus, setFormStatus] = useState(null);
    const [emailError, setEmailError] = useState('');
    const navigate = useNavigate();
    const {id} = useParams();

    useEffect(() => {
        setFetching(true);
        fetchCustom("GET", `/event/${id}/form/`, {
            auth: false,
            onSuccess: (data) => {
                setEventData(data);
                setFetching(false);
            },
            onError: (err) => {
                setFetchError(err?.error || "Error in fetching event data");
                setFetching(false);
            }
        });
        // Fetch form status for ML/WL capacity
        fetchCustom("GET", `/event/${id}/formstatus/`, {
            auth: false,
            onSuccess: (data) => {
                console.log("Form status data:", data);
                setFormStatus(data);
            },
            onError: () => {
                setFormStatus(null);
            }
        });
    }, [id]);

    // Email format validator
    const isValidEmail = (email) => {
        // Simple regex for email validation
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    // Handler for login/continue
    const handleContinue = () => {
        setStatusMessage(null);
        setEmailError('');
        if (!isValidEmail(email)) {
            setEmailError('Please enter a valid email address.');
            return;
        }
        setIsLoading(true);
        fetchCustom("POST", "/check_erasmus_email/", {
            body: {email},
            auth: false,
            onSuccess: (data) => {
                // Handle specific error cases first
                if (data?.error === 'email_not_found') {
                    if (eventData?.is_allow_external) {
                        navigate(`/event/${id}/form`, {state: {email, eventData, esncardNumber: ''}});
                    } else {
                        setStatusMessage({
                            message: data.message || "This email does not belong to a registered Erasmus user.",
                            state: "error"
                        });
                    }
                } else if (data?.error === 'email_not_active') {
                    setStatusMessage({
                        message: data.message || "This email is not active. Please verify your email or contact support.",
                        state: "error"
                    });
                } else if (data && Object.keys(data).length > 0 && !data.error) {
                    // Valid profile found - extract possible ESNcard number fields
                    const esncardNumber = data?.esncard_number || '';
                    navigate(`/event/${id}/form`, {state: {email, eventData, esncardNumber}});
                } else if (eventData?.is_allow_external) {
                    // Fallback for external users
                    navigate(`/event/${id}/form`, {state: {email, eventData, esncardNumber: ''}});
                } else {
                    setStatusMessage({
                        message: "This email does not belong to a registered Erasmus user.",
                        state: "error"
                    });
                }
                setIsLoading(false);
            },
            onError: (errorResponse) => {
                // Generic error handling
                if (eventData?.is_allow_external) {
                    navigate(`/event/${id}/form`, {state: {email, eventData, esncardNumber: ''}});
                } else {
                    setStatusMessage({message: "Error checking email. Please try again.", state: "error"});
                }
                setIsLoading(false);
            }
        });
    };

    // Format date/time for display
    const formatDateTime = (dt) => {
        if (!dt) return '';
        const date = new Date(dt);
        return date.toLocaleString('en-GB', {dateStyle: 'full', timeStyle: 'short'});
    };

    if (fetching) {
        return (
            <Container component="main" maxWidth="xs">
                <CssBaseline/>
                <Box sx={{marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                    <CircularProgress/>
                </Box>
            </Container>
        );
    }

    if (fetchError) {
        return (
            <Container component="main" maxWidth="xs">
                <CssBaseline/>
                <Box sx={{marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                    <img src={logo} alt='ESN Polimi Logo' style={{height: '20vh', marginBottom: "4px"}}/>
                    <Paper elevation={3} sx={{p: 3, mt: 2, textAlign: 'center'}}>
                        <Typography variant="h6" color="error" gutterBottom>
                            {fetchError}
                        </Typography>
                    </Paper>
                </Box>
            </Container>
        );
    }

    // If event is not open, show info
    if (eventData.status !== 'open') {
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
                    <img src={logo} alt='ESN Polimi Logo' style={{height: '20vh', marginBottom: "4px"}}/>
                    <Paper elevation={3} sx={{p: 3, mt: 2, textAlign: 'center'}}>
                        <Typography variant="h5" gutterBottom>
                            The event is not open for subscriptions
                        </Typography>
                        <Typography variant="body1" sx={{mt: 2}}>
                            This event is currently not accepting subscriptions. Please check back later.
                        </Typography>
                    </Paper>
                </Box>
            </Container>
        );
    }

    // If form is not open, show info
    if (!eventData?.is_form_open) {
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
                    <img src={logo} alt='ESN Polimi Logo' style={{height: '20vh', marginBottom: "4px"}}/>
                    <Paper elevation={3} sx={{p: 3, mt: 2, textAlign: 'center'}}>
                        <Typography variant="h5" gutterBottom>
                            The event form is not open yet
                        </Typography>
                        <Typography variant="body1" sx={{mt: 2}}>
                            {eventData.form_programmed_open_time
                                ? <>The form will open
                                    on <strong>{formatDateTime(eventData.form_programmed_open_time)}</strong>.</>
                                : <>The form is currently closed. Please check back later.</>
                            }
                        </Typography>
                    </Paper>
                </Box>
            </Container>
        );
    }

    // --- LEGACY FULL CHECK (ML + WL) NOW DISABLED: replaced by Form List capacity ---
    /*
    if (formStatus?.main_list_full && formStatus?.waiting_list_full) {
        return (
            <Container component="main" maxWidth="xs">
                <CssBaseline/>
                <Box sx={{marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                    <img src={logo} alt='ESN Polimi Logo' style={{height: '20vh', marginBottom: "4px"}}/>
                    <Paper elevation={3} sx={{p: 3, mt: 2, textAlign: 'center'}}>
                        <Alert severity="error" sx={{mb: 2}}>
                            {formStatus.message || "All lists for this event are full. Subscription is not possible."}
                        </Alert>
                        <Typography variant="body1" sx={{mt: 2}}>
                            This event is currently not accepting subscriptions. Please check back later.
                        </Typography>
                    </Paper>
                </Box>
            </Container>
        );
    }
    */

    // New: block access only if the Form List itself is full
    if (formStatus?.form_list_full) {
        return (
            <Container component="main" maxWidth="xs">
                <CssBaseline/>
                <Box sx={{marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                    <img src={logo} alt='ESN Polimi Logo' style={{height: '20vh', marginBottom: "4px"}}/>
                    <Paper elevation={3} sx={{p: 3, mt: 2, textAlign: 'center'}}>
                        <Alert severity="error" sx={{mb: 2}}>
                            {formStatus.form_message || "The Form List is full. Subscription is not possible."}
                        </Alert>
                        <Typography variant="body1" sx={{mt: 2}}>
                            All available form slots have been taken.
                        </Typography>
                    </Paper>
                </Box>
            </Container>
        );
    }

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
                <img src={logo} alt='ESN Polimi Logo' style={{height: '20vh', marginBottom: "8px"}}/>
                <Typography variant="h5" gutterBottom align="center">
                    Event Subscription Form
                </Typography>
                <Typography variant="h4" gutterBottom align="center" component="div">
                    <i>{eventData.name}</i>
                </Typography>
                <Box sx={{width: '100%'}}>
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="email"
                        label={eventData.is_allow_external ? "Your email or the one used for ESN registration" : "Email used for ESN registration"}
                        name="email"
                        autoComplete="email"
                        type="email"
                        autoFocus
                        value={email}
                        onChange={(e) => {
                            setEmail(e.target.value);
                            setEmailError('');
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
                        error={!!emailError}
                        helperText={emailError}
                    />
                    <Button
                        fullWidth
                        variant="contained"
                        sx={{mt: 2, mb: 2, backgroundColor: 'black'}}
                        onClick={handleContinue}
                        disabled={isLoading || !email}
                    >
                        {isLoading ? <CircularProgress size={24} color="inherit"/> : 'Continue'}
                    </Button>
                    <Box sx={{textAlign: 'center', mt: 2}}>
                        <Link
                            href={"/erasmus_form"}
                            target="_blank"
                            rel="noopener"
                            variant="body2"
                            sx={{display: 'inline-block'}}
                        >
                            Don&#39;t have an ESN profile? Register here
                        </Link>
                    </Box>
                </Box>
                {statusMessage && (<StatusBanner message={statusMessage.message} state={statusMessage.state}/>)}
            </Box>
        </Container>
    );
}
