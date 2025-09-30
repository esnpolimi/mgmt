import {useEffect, useState, useRef} from 'react';
import {useLocation, useNavigate, useParams} from 'react-router-dom';
import {Box, Container, Typography, CircularProgress, Alert} from '@mui/material';
import {fetchCustom} from '../../api/api';

export default function EventPayment() {
    const {id} = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const {subscriptionId: stateSubId, assignedList: stateAssigned, checkoutId: stateCheckout} = location.state || {};
    const search = new URLSearchParams(location.search);
    const qpSubId = search.get('subscriptionId');
    const subscriptionId = stateSubId || qpSubId;
    const [assignedList] = useState(stateAssigned);
    const [checkoutId, setCheckoutId] = useState(stateCheckout || null);
    const [status, setStatus] = useState('init'); // init | widget | processing | success | failed
    const [message, setMessage] = useState('');
    const sumupMountedRef = useRef(false);

    const loadScript = (src) =>
        new Promise((res, rej) => {
            if (document.querySelector(`script[src="${src}"]`)) return res();
            const s = document.createElement('script');
            s.src = src;
            s.onload = res;
            s.onerror = rej;
            document.head.appendChild(s);
        });

    useEffect(() => {
        if (!subscriptionId) {
            setStatus('failed');
            setMessage('Missing subscription reference.');
            return;
        }
        // If we already have checkoutId from state proceed to widget loader (handled by other effect)
        if (checkoutId) return;
        let canceled = false;
        (async () => {
            try {
                setStatus('init');
                setMessage('Checking payment status...');
                await fetchCustom('GET', `/subscription/${subscriptionId}/status/`, {
                    auth: false,
                    onSuccess: (data) => {
                        if (canceled) return;
                        if (data.overall_status === 'paid') {
                            navigate(`/event/${id}/formresult`, {
                                state: {subscriptionId, assignedList, paid: true}
                            });
                            return;
                        }
                        if (!data.sumup_checkout_id) {
                            setStatus('failed');
                            setMessage('No online payment session available.');
                            return;
                        }
                        setCheckoutId(data.sumup_checkout_id);
                        // proceed to script loading effect
                    },
                    onError: () => {
                        if (canceled) return;
                        setStatus('failed');
                        setMessage('Unable to retrieve payment session.');
                    }
                });
            } catch {
                if (!canceled) {
                    setStatus('failed');
                    setMessage('Error preparing payment.');
                }
            }
        })();
        return () => {canceled = true;};
    }, [subscriptionId, checkoutId, id, navigate, assignedList]);

    useEffect(() => {
        if (!checkoutId || !subscriptionId) return;
        // existing script loader effect modified
        if (status !== 'init' && status !== 'widget' && status !== 'failed') return;
        // existing logic moved to separate effect below
    }, [checkoutId, subscriptionId, status]);

    useEffect(() => {
        if (!checkoutId || !subscriptionId) return;
        if (status !== 'init') return;
        let canceled = false;
        (async () => {
            try {
                setMessage('Loading payment widget...');
                await loadScript('https://gateway.sumup.com/gateway/ecom/card/v2/sdk.js');
                if (canceled) return;
                if (!window.SumUpCard) {
                    setStatus('failed');
                    setMessage('Payment widget unavailable.');
                    return;
                }
                setStatus('widget');
            } catch {
                if (!canceled) {
                    setStatus('failed');
                    setMessage('Failed to load payment resources.');
                }
            }
        })();
        return () => {canceled = true;};
    }, [checkoutId, subscriptionId]);

    useEffect(() => {
        if (status !== 'widget' || sumupMountedRef.current || !window.SumUpCard || !checkoutId) return;
        try {
            window.SumUpCard.mount({
                id: 'sumup-card',
                checkoutId,
                onResponse: (type) => {
                    if (type === 'success') {
                        setStatus('processing');
                        setMessage('Finalizing payment...');
                        // No widget payload needed anymore
                        fetchCustom('POST', `/subscription/${subscriptionId}/process_payment/`, {
                            auth: false,
                            body: {},
                            onSuccess: (resp) => {
                                const st = (resp.status || '').toUpperCase();
                                if (st === 'PAID') {
                                    setStatus('success');
                                    setMessage('Payment successful.');
                                    setTimeout(() => {
                                        navigate(`/event/${id}/formresult`, {
                                            state: {subscriptionId, assignedList, paid: true}
                                        });
                                    }, 600);
                                } else if (st === 'FAILED' || st === 'CANCELED') {
                                    setStatus('failed');
                                    setMessage('Payment failed.');
                                } else if (st === 'PENDING') {
                                    setStatus('processing');
                                    setMessage('Awaiting confirmation...');
                                } else {
                                    setStatus('failed');
                                    setMessage('Unexpected payment status.');
                                }
                            },
                            onError: () => {
                                setStatus('failed');
                                setMessage('Payment confirmation error.');
                            }
                        });
                    } else if (type === 'error') {
                        setStatus('failed');
                        setMessage('Payment failed.');
                    }
                }
            });
            sumupMountedRef.current = true;
        } catch (e) {
            setStatus('failed');
            setMessage('Failed to initialize payment form: ' + e.message);
        }
    }, [status, checkoutId, subscriptionId, assignedList, id, navigate]);

    const finish = () => navigate(`/event/${id}/formresult`, {
        state: {subscriptionId, assignedList, paymentError: status === 'failed'}
    });

    return (
        <Container maxWidth="sm" sx={{mt:8}}>
            <Typography variant="h4" align="center" gutterBottom>Event Payment</Typography>
            {status === 'init' && (
                <Box sx={{display:'flex', flexDirection:'column', alignItems:'center', gap:2}}>
                    <CircularProgress/><Typography>{message}</Typography>
                </Box>
            )}
            {status === 'widget' && (
                <Box sx={{mt:2}}>
                    <div id="sumup-card"></div>
                </Box>
            )}
            {status === 'processing' && (
                <Box sx={{display:'flex', flexDirection:'column', alignItems:'center', gap:2}}>
                    <CircularProgress/><Typography>{message}</Typography>
                </Box>
            )}
            {status === 'failed' && (
                <Alert severity="error" sx={{mt:2}}>
                    {message}
                </Alert>
            )}
        </Container>
    );
}
