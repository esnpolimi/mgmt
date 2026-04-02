import React, {useEffect, useMemo, useState} from 'react';
import {
    Modal,
    Box,
    Typography,
    Button,
    IconButton,
    Grid,
    TextField,
    MenuItem,
    CircularProgress,
    FormControlLabel,
    Checkbox,
    Chip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Loader from '../Loader';
import ConfirmDialog from '../ConfirmDialog';
import Popup from '../Popup';
import {fetchCustom, defaultErrorHandler} from '../../api/api';
import {styleESNcardModal as style} from '../../utils/sharedStyles';

function formatApiError(data, status) {
    if (!data) return `Server error (${status}) with empty response`;
    if (typeof data === 'string') return data;
    if (data.detail) return data.detail;
    if (data.error) return data.error;
    if (data.message) return data.message;
    if (Array.isArray(data.non_field_errors) && data.non_field_errors.length) {
        return data.non_field_errors.join(', ');
    }
    for (const [, errors] of Object.entries(data)) {
        if (!errors) continue;
        if (Array.isArray(errors)) return errors.join(', ');
        return String(errors);
    }
    return JSON.stringify(data);
}

async function extractErrorMessage(responseOrError) {
    if (responseOrError?.json) {
        try {
            const json = await responseOrError.json();
            return formatApiError(json, responseOrError.status);
        } catch (_err) {
            return `Errore server (${responseOrError.status || 'sconosciuto'})`;
        }
    }
    return responseOrError?.message || String(responseOrError || 'Errore sconosciuto');
}

function makeInitialSelection(items) {
    return items.reduce((acc, item) => {
        acc[item.key] = !item.disabled;
        return acc;
    }, {});
}

export default function ReimburseSelectionModal({open, onClose, onRefresh, event, subscription}) {
    const [isLoading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState('');
    const [notes, setNotes] = useState('');
    const [selectedItems, setSelectedItems] = useState({});
    const [completedItems, setCompletedItems] = useState({});
    const [itemResults, setItemResults] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState({open: false, action: null, message: ''});
    const [popup, setPopup] = useState(null);

    const quotaStatus = subscription?.status_quota;
    const servicesStatus = subscription?.status_services;
    const depositStatus = subscription?.status_cauzione;

    const servicesTotal = useMemo(() => {
        return (subscription?.selected_services || []).reduce((sum, s) => {
            const price = Number(s?.price_at_purchase ?? s?.price ?? 0);
            const qty = Number(s?.quantity ?? 1);
            if (!Number.isFinite(price) || !Number.isFinite(qty) || qty <= 0) return sum;
            return sum + (price * qty);
        }, 0);
    }, [subscription]);

    const refundItems = useMemo(() => {
        const items = [];

        const hasQuota = Number(event?.cost || 0) > 0;
        if (hasQuota) {
            let disabled = false;
            let reason = '';
            if (quotaStatus === 'reimbursed') {
                disabled = true;
                reason = 'Gia rimborsata';
            } else if (quotaStatus !== 'paid') {
                disabled = true;
                reason = 'Non pagata';
            }
            items.push({
                key: 'quota',
                label: 'Quota',
                amount: Number(event?.cost || 0),
                disabled,
                reason
            });
        }

        const hasServices = servicesTotal > 0 || servicesStatus !== null && servicesStatus !== undefined;
        if (hasServices) {
            let disabled = false;
            let reason = '';
            if (servicesStatus === 'reimbursed') {
                disabled = true;
                reason = 'Servizi gia rimborsati';
            } else if (servicesTotal <= 0) {
                disabled = true;
                reason = 'Nessun servizio selezionato';
            } else if (servicesStatus !== 'paid') {
                disabled = true;
                reason = 'Servizi non pagati';
            }
            items.push({
                key: 'services',
                label: 'Servizi aggiuntivi',
                amount: servicesTotal,
                disabled,
                reason
            });
        }

        const hasDeposit = Number(event?.deposit || 0) > 0;
        if (hasDeposit) {
            let disabled = false;
            let reason = '';
            if (depositStatus === 'reimbursed') {
                disabled = true;
                reason = 'Gia rimborsata';
            } else if (depositStatus !== 'paid') {
                disabled = true;
                reason = 'Non pagata';
            }
            items.push({
                key: 'deposit',
                label: 'Cauzione',
                amount: Number(event?.deposit || 0),
                disabled,
                reason
            });
        }

        return items;
    }, [event, quotaStatus, servicesStatus, depositStatus, servicesTotal]);

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        setPopup(null);
        setSelectedAccount('');
        setNotes('');
        setCompletedItems({});
        setItemResults({});
        setSelectedItems(makeInitialSelection(refundItems));

        fetchCustom('GET', '/accounts/', {
            onSuccess: (results) => setAccounts(results || []),
            onError: (err) => defaultErrorHandler(err, setPopup),
            onFinally: () => setLoading(false)
        });
    }, [open, subscription?.id]);

    const selectedCount = Object.values(selectedItems).filter(Boolean).length;

    const selectedAmount = refundItems.reduce((sum, item) => {
        if (!selectedItems[item.key]) return sum;
        return sum + Number(item.amount || 0);
    }, 0);

    const callPost = (path, body) => {
        return new Promise((resolve) => {
            fetchCustom('POST', path, {
                body,
                onSuccess: (data) => resolve({ok: true, data}),
                onError: async (responseOrError) => {
                    const message = await extractErrorMessage(responseOrError);
                    resolve({ok: false, message});
                }
            });
        });
    };

    const handleSubmit = () => {
        setPopup(null);
        if (!selectedAccount) {
            setPopup({message: 'Seleziona una cassa.', state: 'error', id: Date.now()});
            return;
        }
        if (!subscription?.id) {
            setPopup({message: 'Iscrizione non trovata.', state: 'error', id: Date.now()});
            return;
        }
        if (selectedCount === 0) {
            setPopup({message: 'Seleziona almeno una voce da rimborsare.', state: 'error', id: Date.now()});
            return;
        }

        if (selectedItems.services && !selectedItems.quota && quotaStatus !== 'reimbursed') {
            setPopup({
                message: 'Con la logica attuale puoi rimborsare solo i servizi separatamente solo se la quota e gia rimborsata.',
                state: 'error',
                id: Date.now()
            });
            return;
        }

        const selectedLabels = refundItems
            .filter((item) => selectedItems[item.key])
            .map((item) => item.label)
            .join(', ');

        const accountName = accounts.find(acc => acc.id === selectedAccount)?.name || 'N/A';
        const message = `Confermi il rimborso di ${selectedLabels} (totale €${selectedAmount.toFixed(2)}) a ${subscription.profile_name} dalla cassa ${accountName}?`;

        setConfirmDialog({
            open: true,
            action: () => doSubmit(),
            message
        });
    };

    const doSubmit = async () => {
        setConfirmDialog({open: false, action: null, message: ''});
        setSubmitting(true);
        setPopup(null);
        setItemResults({});

        const results = {};
        const completed = {};
        let successCount = 0;
        const totalRequested = selectedCount;

        const markSuccess = (key, message) => {
            results[key] = {ok: true, message};
            completed[key] = true;
            successCount += 1;
        };
        const markError = (key, message) => {
            results[key] = {ok: false, message};
        };

        const shouldCallQuotaEndpoint = selectedItems.quota || selectedItems.services;
        if (shouldCallQuotaEndpoint) {
            const quotaResult = await callPost('/reimburse_quota/', {
                event: event.id,
                subscription_id: subscription.id,
                account: selectedAccount,
                notes,
                include_services: Boolean(selectedItems.services)
            });

            if (quotaResult.ok) {
                if (selectedItems.quota) markSuccess('quota', 'Rimborso quota completato');
                if (selectedItems.services) markSuccess('services', 'Rimborso servizi completato');
            } else {
                if (selectedItems.quota) markError('quota', quotaResult.message);
                if (selectedItems.services) markError('services', quotaResult.message);
            }
        }

        if (selectedItems.deposit) {
            const depositResult = await callPost('/reimburse_deposits/', {
                event: event.id,
                subscription_ids: [subscription.id],
                account: selectedAccount,
                notes
            });

            if (depositResult.ok) {
                markSuccess('deposit', 'Rimborso cauzione completato');
            } else {
                markError('deposit', depositResult.message);
            }
        }

        setItemResults(results);
        setCompletedItems((prev) => ({...prev, ...completed}));
        setSelectedItems((prev) => {
            const next = {...prev};
            Object.keys(completed).forEach((key) => {
                next[key] = false;
            });
            return next;
        });

        if (successCount > 0 && typeof onRefresh === 'function') {
            onRefresh();
        }

        if (successCount === totalRequested) {
            setSubmitting(false);
            onClose(true, 'Rimborso completato con successo');
            return;
        }

        const failedItems = Object.entries(results)
            .filter(([, value]) => value && !value.ok)
            .map(([key, value]) => {
                const item = refundItems.find((it) => it.key === key);
                return `${item?.label || key}: ${value.message}`;
            });

        if (failedItems.length > 0) {
            setPopup({
                message: `Rimborso parziale. Errori: ${failedItems.join(' | ')}`,
                state: 'error',
                id: Date.now()
            });
        }

        setSubmitting(false);
    };

    const renderStatusChip = (item) => {
        const result = itemResults[item.key];
        if (result) {
            return (
                <Chip
                    size="small"
                    color={result.ok ? 'success' : 'error'}
                    label={result.ok ? 'OK' : 'Errore'}
                />
            );
        }

        if (completedItems[item.key]) {
            return <Chip size="small" color="success" label="Completato"/>;
        }

        if (item.disabled && item.reason) {
            return <Chip size="small" variant="outlined" label={item.reason}/>;
        }

        return <Chip size="small" variant="outlined" color="info" label="Disponibile"/>;
    };

    return (
        <Modal open={open} onClose={() => onClose(false)}>
            <Box sx={style}>
                {isLoading ? <Loader/> : (
                    <>
                        <Box sx={{display: 'flex', justifyContent: 'flex-end', mt: -2}}>
                            <IconButton onClick={() => onClose(false)} sx={{minWidth: 0}}><CloseIcon/></IconButton>
                        </Box>
                        <Typography variant="h4" component="h2" gutterBottom align="center">
                            Rimborsa
                        </Typography>
                        <Grid container spacing={1} sx={{mt: 1}}>
                            <Grid size={{xs: 12}}>
                                <Typography>
                                    <b>Ricevente:</b> {subscription?.profile_name}
                                </Typography>
                            </Grid>
                            <Grid size={{xs: 12}}>
                                <Box sx={{display: 'flex', flexDirection: 'column', gap: 1}}>
                                    {refundItems.map((item) => {
                                        const disabled = Boolean(item.disabled || completedItems[item.key] || submitting);
                                        return (
                                            <Box key={item.key}
                                                 sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1}}>
                                                <FormControlLabel
                                                    control={
                                                        <Checkbox
                                                            checked={Boolean(selectedItems[item.key])}
                                                            onChange={(e) => {
                                                                const checked = e.target.checked;
                                                                setSelectedItems((prev) => ({...prev, [item.key]: checked}));
                                                            }}
                                                            color="primary"
                                                            disabled={disabled}
                                                        />
                                                    }
                                                    label={`${item.label} (€${Number(item.amount || 0).toFixed(2)})`}
                                                />
                                                {renderStatusChip(item)}
                                            </Box>
                                        );
                                    })}
                                    {refundItems.length === 0 && (
                                        <Typography variant="body2" color="text.secondary">
                                            Nessuna voce rimborsabile disponibile.
                                        </Typography>
                                    )}
                                </Box>
                            </Grid>
                            <Grid size={{xs: 12}}>
                                <Typography variant="subtitle2" sx={{mt: 1}}>
                                    Totale selezionato: <b>€{selectedAmount.toFixed(2)}</b>
                                </Typography>
                            </Grid>
                            <Grid size={{xs: 12}}>
                                <TextField
                                    select
                                    fullWidth
                                    label="Cassa"
                                    value={selectedAccount}
                                    onChange={e => setSelectedAccount(e.target.value)}
                                    sx={{mt: 1}}
                                >
                                    {accounts.map(acc => (
                                        <MenuItem key={acc.id}
                                                  value={acc.id}
                                                  disabled={acc.status === 'closed'}
                                                  style={acc.status === 'closed' ? {color: '#aaa'} : {}}>
                                            {acc.name} {acc.status === 'closed' ? '(chiusa)' : ''}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Grid>
                            <Grid size={{xs: 12}}>
                                <TextField
                                    fullWidth
                                    label="Note (opzionale)"
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    sx={{mb: 2, mt: 1}}
                                />
                            </Grid>
                            <Grid size={{xs: 12}}>
                                <Box sx={{display: 'flex', justifyContent: 'flex-end', gap: 2}}>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        fullWidth
                                        onClick={handleSubmit}
                                        disabled={submitting || refundItems.length === 0}
                                        startIcon={submitting ? <CircularProgress size={20}/> : null}
                                    >
                                        Rimborsa Selezionati
                                    </Button>
                                </Box>
                            </Grid>
                        </Grid>
                        <ConfirmDialog
                            open={confirmDialog.open}
                            message={confirmDialog.message}
                            onConfirm={confirmDialog.action}
                            onClose={() => setConfirmDialog({open: false, action: null, message: ''})}
                        />
                        {popup && <Popup key={popup.id} message={popup.message} state={popup.state}/>}
                    </>
                )}
            </Box>
        </Modal>
    );
}
