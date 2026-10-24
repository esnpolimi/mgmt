import {useEffect, useState, useRef} from 'react';
import {useLocation, useNavigate, useParams} from 'react-router-dom';
import {Box, Container, Typography, CircularProgress, Alert} from '@mui/material';
import {fetchCustom} from '../../api/api';

const SOLD_OUT_MESSAGE = "All spots are currently sold out unfortunately, so we cannot accept your subscription at the moment. " +
    "Thank you for filling out the form. Please wait for any notifications from the ESN team.";
const IS_DEVELOPMENT = import.meta.env.DEV;
const SUMUP_TEST_CARDS_URL = 'https://developer.sumup.com/online-payments/testing';

// Result-page state from a PAID process_payment response (null when the confirmation call failed)
const paidResultState = (resp, subscriptionId, assignedList) => ({
    subscriptionId,
    assignedList: resp?.assigned_list || assignedList,
    paid: true,
    isMainList: !!resp?.is_main_list,
    whatsappEnabled: !!resp?.whatsapp_enabled,
    whatsappLinkUrl: resp?.whatsapp_link_url || null,
});

export default function EventPayment() {
    const {id} = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const {
        subscriptionId: stateSubId,
        assignedList: stateAssigned,
        checkoutId: stateCheckout,
        accessToken: stateToken
    } = location.state || {};
    const search = new URLSearchParams(location.search);
    const qpSubId = search.get('subscriptionId');
    const subscriptionId = stateSubId || qpSubId;
    // Signed per-subscription token: only its holder receives the WhatsApp group link after payment
    const accessToken = stateToken || search.get('t');
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
                            // Re-confirm server side to get list placement and, with a valid token, the WhatsApp link
                            void fetchCustom('POST', `/subscription/${subscriptionId}/process_payment/`, {
                                auth: false,
                                body: {t: accessToken},
                                onSuccess: (resp) => {
                                    if (canceled) return;
                                    navigate(`/event/${id}/formresult`, {state: paidResultState(resp, subscriptionId, assignedList)});
                                },
                                onError: () => {
                                    if (canceled) return;
                                    navigate(`/event/${id}/formresult`, {state: paidResultState(null, subscriptionId, assignedList)});
                                }
                            });
                            return;
                        }
                        if (data.payment_blocked) {
                            setStatus('failed');
                            setMessage(data.payment_blocked_message || SOLD_OUT_MESSAGE);
                            return;
                        }
                        const checkoutFromStatus = data.sumup_checkout_id || stateCheckout;
                        if (!checkoutFromStatus) {
                            setStatus('failed');
                            setMessage('No online payment session available.');
                            return;
                        }
                        setCheckoutId(checkoutFromStatus);
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

        return () => {
            canceled = true;
        };
    }, [subscriptionId, id, navigate, assignedList, stateCheckout, accessToken]);

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

        return () => {
            canceled = true;
        };
    }, [checkoutId, subscriptionId, status]);

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
                        fetchCustom('POST', `/subscription/${subscriptionId}/process_payment/`, {
                            auth: false,
                            body: {t: accessToken},
                            onSuccess: (resp) => {
                                const st = (resp.status || '').toUpperCase();
                                if (st === 'PAID') {
                                    setStatus('success');
                                    setMessage('Payment successful.');
                                    setTimeout(() => {
                                        navigate(`/event/${id}/formresult`, {state: paidResultState(resp, subscriptionId, assignedList)});
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
                            onError: async (errorResponse) => {
                                let apiMessage = '';
                                if (errorResponse?.json) {
                                    try {
                                        const errorData = await errorResponse.json();
                                        apiMessage = errorData?.message || errorData?.error || '';
                                    } catch {
                                        apiMessage = '';
                                    }
                                } else if (errorResponse?.message) {
                                    apiMessage = errorResponse.message;
                                }
                                setStatus('failed');
                                setMessage(apiMessage || 'Payment confirmation error.');
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
    }, [status, checkoutId, subscriptionId, assignedList, id, navigate, accessToken]);

    return (
        <Container maxWidth="sm" sx={{mt: 8}}>
            <Typography variant="h4" align="center" gutterBottom>
                {IS_DEVELOPMENT ? 'Ambiente di testing - Sandbox' : 'Event Payment'}
            </Typography>
            {IS_DEVELOPMENT && (
                <Alert severity="info" sx={{mt: 2}}>
                    Ambiente di testing - Sandbox. Usa le carte di test indicate nella{' '}
                    <a href={SUMUP_TEST_CARDS_URL} target="_blank" rel="noreferrer">
                        documentazione SumUp
                    </a>
                    .
                </Alert>
            )}
            {status === 'init' && (
                <Box sx={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2}}>
                    <CircularProgress />
                    <Typography>{message}</Typography>
                </Box>
            )}
            {status === 'widget' && (
                <Box sx={{mt: 2}}>
                    <div id="sumup-card"></div>
                </Box>
            )}
            {status === 'processing' && (
                <Box sx={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2}}>
                    <CircularProgress />
                    <Typography>{message}</Typography>
                </Box>
            )}
            {status === 'failed' && (
                <Alert severity="error" sx={{mt: 2}}>
                    {message}
                </Alert>
            )}
        </Container>
    );
}
