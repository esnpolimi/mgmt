import {useEffect, useMemo, useState} from "react";
import {
    Button,
    Box,
    Divider,
    FormControl,
    InputLabel,
    MenuItem,
    Modal,
    Select,
    Typography,
    TextField,
    FormHelperText,
    CircularProgress,
    Alert,
    Checkbox,
} from "@mui/material";
import {Switch, FormControlLabel, Paper, IconButton, Grid} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import {defaultErrorHandler, fetchCustom} from "../../api/api";
import {styleESNcardModal as style} from "../../utils/sharedStyles";
import Loader from "../Loader";
import ConfirmDialog from "../ConfirmDialog";
import ProfileSearch from "../ProfileSearch";
import Popup from "../Popup";
import EditAnswersModal from "./EditAnswersModal";

export default function SubscriptionModal({
                                              open,
                                              onClose,
                                              event,
                                              listId,
                                              subscription,
                                              isEdit,
                                              profileId,
                                              profileName
                                          }) {
    const [isLoading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState([]);
    const [confirmDialog, setConfirmDialog] = useState({open: false, action: null, message: ''});
    const [popup, setPopup] = useState(null);
    const [openEditAnswers, setOpenEditAnswers] = useState(false);
    const [createdSubscription, setCreatedSubscription] = useState(null);
    const [postCreateMessage, setPostCreateMessage] = useState('');
    const title = isEdit ? 'Modifica Iscrizione' : 'Iscrizione Evento';
    const originalAccountId = isEdit ? subscription.account_id || null : null; // 'paid' to 'pending' status needs the original account_id

    const [data, setData] = useState({
        id: '',
        account_id: '',
        account_name: '',
        profile_id: '',
        profile_name: '',
        list_id: listId || '',
        list_name: (event.selectedList ? event.selectedList.name : (event.lists && listId ? (event.lists.find(list => list.id === listId)?.name || 'Lista non trovata') : 'Lista non trovata')),
        external: false,
        external_name: '',
        external_email: '',
        notes: '',
        status_quota: subscription?.status_quota || 'pending',
        status_cauzione: subscription?.status_cauzione || 'pending',
        status_services: subscription?.status_services || 'pending',
        selected_services: subscription?.selected_services || [],
        send_payment_email: true,
        auto_move_after_payment: true
    });

    const [profileHasEsncard, setProfileHasEsncard] = useState(null);

    // Reusable empty errors shape
    const emptyErrors = {
        account_id: [false, ''],
        account_name: [false, ''],
        profile_id: [false, ''],
        profile_name: [false, ''],
        external_name: [false, ''],
        external_email: [false, ''],
        status: [false, ''],
        list_id: [false, ''],
        list_name: [false, ''],
        notes: [false, ''],
    };

// State and reset helper
    const [errors, setErrors] = useState(emptyErrors);
    const resetErrors = () => ({...emptyErrors});

    const toAmount = (v) => Math.max(0, Number.parseFloat(v) || 0);
    const getQuotaImport = () => toAmount(event?.cost);
    const getCauzioneImport = () => toAmount(event?.deposit);

    const eventServices = useMemo(() => (Array.isArray(event?.services) ? event.services : []), [event]);

    const getServicesTotal = () => {
        const list = data.selected_services || [];
        return list.reduce((sum, s) => {
            const price = toAmount(s.price_at_purchase ?? s.price);
            const qty = Math.max(0, Number.parseInt(s.quantity || 1, 10) || 0);
            return sum + (price * qty);
        }, 0);
    };

    const toggleService = (svc) => {
        const serviceId = svc.id || svc.name;
        setData(d => {
            const existing = (d.selected_services || []).find(x => (x.service_id || x.id || x.name) === serviceId);
            if (existing) {
                const nextList = (d.selected_services || []).filter(x => (x.service_id || x.id || x.name) !== serviceId);
                return {
                    ...d,
                    selected_services: nextList,
                    status_services: nextList.length > 0 ? d.status_services : 'pending'
                };
            }
            return {
                ...d,
                selected_services: [
                    ...(d.selected_services || []),
                    {
                        service_id: serviceId,
                        name: svc.name,
                        price_at_purchase: svc.price,
                        quantity: 1
                    }
                ],
                status_services: d.status_services || 'pending'
            };
        });
    };

    const updateServiceQty = (svc, qtyRaw) => {
        const serviceId = svc.id || svc.name;
        const qty = Math.max(1, Number.parseInt(qtyRaw || 1, 10) || 1);
        setData(d => ({
            ...d,
            selected_services: (d.selected_services || []).map(x => {
                const key = (x.service_id || x.id || x.name);
                if (key !== serviceId) return x;
                return {...x, quantity: qty};
            })
        }));
    };

    const fieldsToValidate = useMemo(() => {
        let arr = [];
        if (!data.profile_id && !data.external_name) {
            if (event.is_allow_external) {
                arr.push({field: 'external_name', value: data.external_name, message: "Inserire un nominativo esterno"});
            } else {
                arr.push({field: 'profile_id', value: data.profile_id, message: "Selezionare un Profilo"});
            }
        }
        // If using external, require email
        if (!data.profile_id && data.external_name) {
            arr.push({
                field: 'external_email',
                value: data.external_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.external_email),
                message: "Inserire una email valida"
            });
        }
        if (data.status_quota === 'paid' || data.status_services === 'paid' || (event.deposit > 0 && data.status_cauzione === 'paid')) {
            arr.push({field: 'account_id', value: data.account_id, message: "Selezionare una Cassa"});
        }
        return arr;
    }, [data, event]);

    const [submitLoading, setSubmitLoading] = useState(false);

    useEffect(() => {
        if (listId) { // Ensure listId is used to set the selected list
            const selectedList = event.lists.find(list => list.id === listId);
            setData(d => ({
                ...d,
                list_id: selectedList?.id || '',
                list_name: selectedList?.name || 'Lista non trovata',
                is_main_list: selectedList?.is_main_list || false,
                is_waiting_list: selectedList?.is_waiting_list || false
            }));
        }
        if (isEdit && subscription) {
            setData(d => ({
                ...d,
                ...subscription,
                account_id: subscription.account_id || '',
                external_name: subscription.external_name || '',
                external_email: (subscription.additional_data && subscription.additional_data.external_email) || '',
                notes: subscription.notes || '',
                list_id: subscription.list_id || '', // Ensure list_id is set for editing
                selected_services: Array.isArray(subscription.selected_services) ? subscription.selected_services : [],
                status_services: subscription.status_services || 'pending',
                list_name: event.lists.find(list => list.id === subscription.list_id)?.name || 'Lista non trovata'
            }));
         } else {
            if (profileId) {
                setData(d => ({
                    ...d,
                    profile_id: profileId,
                    profile_name: profileName || ''
                }));
            }
            if (event.selectedList) {
                setData(d => ({
                    ...d,
                    list_id: event.selectedList.id,
                    list_name: event.selectedList.name
                }));
            }
        }
        setLoading(false);
        fetchAccounts();
    }, [isEdit, subscription, profileId, profileName, event, listId]);

    const fetchAccounts = () => {
        fetchCustom("GET", "/accounts/", {
            onSuccess: (data) => setAccounts(data),
            onError: (responseOrError) => defaultErrorHandler(responseOrError, setPopup),
        });
    }

    // Helper to compute total import
    const getTotalImport = () => {
        let total = 0;
        if (data.status_quota === 'paid') total += getQuotaImport();
        if (event.deposit > 0 && data.status_cauzione === 'paid') total += getCauzioneImport();
        if (data.status_services === 'paid') total += getServicesTotal();
        return total;
    };

    const hasAnyPayment = useMemo(() =>
            data.status_quota === 'paid' || (event.deposit > 0 && data.status_cauzione === 'paid') || data.status_services === 'paid',
        [data.status_quota, data.status_cauzione, data.status_services, event.deposit]
    );

    // Helper to detect status changes for quota/cauzione
    const getStatusChanges = () => {
        const quotaChangedToPaid = data.status_quota === 'paid' && (!isEdit || subscription?.status_quota !== 'paid');
        const quotaChangedToPending = isEdit && subscription?.status_quota === 'paid' && data.status_quota === 'pending';
        const cauzioneChangedToPaid = event.deposit > 0 && data.status_cauzione === 'paid' && (!isEdit || subscription?.status_cauzione !== 'paid');
        const cauzioneChangedToPending = isEdit && subscription?.status_cauzione === 'paid' && data.status_cauzione === 'pending';
        const servicesChangedToPaid = data.status_services === 'paid' && (!isEdit || subscription?.status_services !== 'paid');
        const servicesChangedToPending = isEdit && subscription?.status_services === 'paid' && data.status_services === 'pending';
        return {quotaChangedToPaid, quotaChangedToPending, cauzioneChangedToPaid, cauzioneChangedToPending, servicesChangedToPaid, servicesChangedToPending};
    };

    // Helper to show confirm dialog message for payment changes
    const getConfirmMessage = () => {
        const {
            quotaChangedToPaid,
            quotaChangedToPending,
            cauzioneChangedToPaid,
            cauzioneChangedToPending,
            servicesChangedToPaid,
            servicesChangedToPending
        } = getStatusChanges();
        const accountObj = accounts.find(acc => acc.id === data.account_id);
        const accountName = accountObj ? accountObj.name : 'N/A';

        // Check both toggled to paid first
        if (quotaChangedToPaid && cauzioneChangedToPaid && servicesChangedToPaid) {
            return `Confermi un pagamento totale di €${getTotalImport().toFixed(2)} in cassa ${accountName}?`;
        }
        if ((quotaChangedToPaid || cauzioneChangedToPaid || servicesChangedToPaid) && !(quotaChangedToPending || cauzioneChangedToPending || servicesChangedToPending)) {
            return `Confermi un pagamento totale di €${getTotalImport().toFixed(2)} in cassa ${accountName}?`;
        }
        // Check both toggled to pending first
        if (quotaChangedToPending && cauzioneChangedToPending && servicesChangedToPending) {
            return `Confermi la rimozione di entrambi i pagamenti (quota + cauzione) per un totale di €${getTotalImport().toFixed(2)}? Verranno stornati dalla cassa.`;
        }
        // Then single checks
        if (quotaChangedToPaid) {
            return `Confermi il pagamento della quota di €${getQuotaImport().toFixed(2)} in cassa ${accountName}?`;
        }
        if (cauzioneChangedToPaid) {
            return `Confermi il pagamento della cauzione di €${getCauzioneImport().toFixed(2)} in cassa ${accountName}?`;
        }
        if (servicesChangedToPaid) {
            return `Confermi il pagamento dei servizi di €${getServicesTotal().toFixed(2)} in cassa ${accountName}?`;
        }
        if (quotaChangedToPending) {
            return `Confermi la rimozione del pagamento della quota di €${getQuotaImport().toFixed(2)}? Verrà stornato dalla cassa.`;
        }
        if (cauzioneChangedToPending) {
            return `Confermi la rimozione del pagamento della cauzione di €${getCauzioneImport().toFixed(2)}? Verrà stornato dalla cassa.`;
        }
        if (servicesChangedToPending) {
            return `Confermi la rimozione del pagamento dei servizi di €${getServicesTotal().toFixed(2)}? Verrà stornato dalla cassa.`;
        }
        // Default: if either is paid
        if (data.status_quota === 'paid' || (event.deposit > 0 && data.status_cauzione === 'paid') || data.status_services === 'paid') {
            return `Confermi un pagamento totale di €${getTotalImport().toFixed(2)} in cassa ${accountName}?`;
        }
        return '';
    };

    const handleSubmit = () => {
        let hasErrors = false;
        const newErrors = resetErrors();
        fieldsToValidate.forEach(item => {
            if (!item.value) {
                newErrors[item.field] = [true, item.message];
                hasErrors = true;
            }
        });
        if (hasErrors) {
            setErrors(newErrors);
            return;
        }

        const {
            quotaChangedToPaid,
            quotaChangedToPending,
            cauzioneChangedToPaid,
            cauzioneChangedToPending,
            servicesChangedToPaid,
            servicesChangedToPending
        } = getStatusChanges();
        const accountChanged = isEdit && subscription?.account_id !== data.account_id;

        if (quotaChangedToPaid || quotaChangedToPending || cauzioneChangedToPaid || cauzioneChangedToPending || servicesChangedToPaid || servicesChangedToPending || accountChanged) {
            setConfirmDialog({
                open: true,
                action: () => doSubmit(),
                message: getConfirmMessage()
            });
            return;
        }
        // For new subscriptions, show confirm only if either is paid
        if (!isEdit && (data.status_quota === 'paid' || (event.deposit > 0 && data.status_cauzione === 'paid') || data.status_services === 'paid')) {
            setConfirmDialog({
                open: true,
                action: () => doSubmit(),
                message: getConfirmMessage()
            });
            return;
        }
        doSubmit();
    };

    const statusChanges = getStatusChanges();
    const paymentBeingRegistered = statusChanges.quotaChangedToPaid || statusChanges.cauzioneChangedToPaid || statusChanges.servicesChangedToPaid || (!isEdit && hasAnyPayment);

    const doSubmit = () => {
        setConfirmDialog({open: false, action: null, message: ''});
        setSubmitLoading(true);
        const accountId = data.account_id ? data.account_id : (originalAccountId || null);
        fetchCustom(isEdit ? "PATCH" : "POST", `/subscription/${isEdit ? data.id + '/' : ''}`, {
            body: {
                profile: data.profile_id || null,
                event: event.id,
                list: data.list_id,
                account_id: accountId,
                notes: data.notes,
                status_quota: data.status_quota || 'pending',
                status_cauzione: (event.deposit > 0 ? (data.status_cauzione || 'pending') : 'pending'),
                status_services: (data.selected_services && data.selected_services.length > 0) ? (data.status_services || 'pending') : 'pending',
                selected_services: data.selected_services || [],
                external_name: data.external_name || undefined,
                email: (!data.profile_id && data.external_email) ? data.external_email : undefined,
                // Apply only when a payment is being newly registered
                ...(paymentBeingRegistered ? {
                    send_payment_email: !!data.send_payment_email,
                    auto_move_after_payment: !!data.auto_move_after_payment
                } : {}),
            },
            onSuccess: (resp) => {
                let baseMsg = (isEdit ? 'Modifica Iscrizione' : 'Iscrizione') + ' completata con successo!';
                // Append auto-move info if present
                if (resp && resp.auto_move_status) {
                    if (resp.auto_move_status === 'moved' && resp.auto_move_list) {
                        baseMsg += ` Spostata nella lista: ${resp.auto_move_list}.`;
                    } else if (resp.auto_move_status === 'stayed' && resp.auto_move_reason === 'no_capacity') {
                        baseMsg += ' Nessuna disponibilità nelle liste principali: rimane in Form List.';
                    }
                }

                // If it's a creation and there are fields to edit, open EditAnswersModal instead of closing now
                if (!isEdit) {
                    const hasAnyEditableFields = Array.isArray(event?.fields) && event.fields.some(f => f.field_type === 'form' || f.field_type === 'additional');
                    const canEditAnswers = Boolean(event?.enable_form) && hasAnyEditableFields;
                    if (canEditAnswers) {
                        setCreatedSubscription(resp);
                        setPostCreateMessage(baseMsg);
                        setOpenEditAnswers(true);
                        return; // do not close SubscriptionModal yet
                    }
                }
                // Default behavior (edit, or no form/additional fields)
                onClose(true, baseMsg);
            },
            onError: (responseOrError) => defaultErrorHandler(responseOrError, setPopup),
            onFinally: () => setSubmitLoading(false)
        });
    };

    const handleDelete = () => {
        // Only confirm if paid
        if (data.status_quota === 'paid' || data.status_cauzione === 'paid') {
            let message;
            if (data.status_quota === 'paid' && data.status_cauzione !== 'paid') {
                message = `Confermi di voler eliminare un pagamento quota di €${getQuotaImport().toFixed(2)}?`;
            } else if (data.status_cauzione === 'paid' && data.status_quota !== 'paid') {
                message = `Confermi di voler eliminare un pagamento cauzione di €${getCauzioneImport().toFixed(2)}?`;
            } else {
                message = `Confermi di voler eliminare un pagamento totale di €${getTotalImport().toFixed(2)}?`;
            }
            setConfirmDialog({
                open: true,
                action: () => doDelete(),
                message
            });
            return;
        }
        doDelete();
    };

    const doDelete = () => {
        setConfirmDialog({open: false, action: null, message: ''});
        if (!isEdit || !data.id) return;
        fetchCustom("DELETE", `/subscription/${data.id}/`, {
            onSuccess: () => onClose(true, "Eliminazione avvenuta con successo"),
            onError: (responseOrError) => defaultErrorHandler(responseOrError, setPopup)
        });
    };

    const handleChange = (e) => {
        setData({...data, [e.target.name]: e.target.value});
    };

    // Helper to check if either quota or cauzione is reimbursed
    const isReimbursed = data.status_quota === 'reimbursed' || data.status_cauzione === 'reimbursed' || data.status_services === 'reimbursed';

    return (
        <Modal open={open}
               onClose={() => onClose(false)}
               aria-labelledby="modal-modal-title"
               aria-describedby="modal-modal-description">
            <Box sx={{
                ...style,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                maxHeight: '90vh'
            }}>
                <Box sx={{
                    width: '100%',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    paddingRight: 2
                }}>
                    {isLoading ? <Loader/> : (<>
                        <Box sx={{display: 'flex', justifyContent: 'flex-end', mb: -2}}>
                            <IconButton onClick={() => onClose(false)} sx={{minWidth: 0}}><CloseIcon/></IconButton>
                        </Box>
                        <Typography variant="h4" component="h2" gutterBottom align="center">{title}</Typography>
                        <Divider sx={{mb: 2}}/>
                        {/* Show warning if reimbursed */}
                        {isReimbursed && (
                            <Alert severity="warning" sx={{mb: 2}}>
                                Attenzione: la quota o la cauzione sono state rimborsate. Non è possibile efettuare
                                modifiche.
                            </Alert>
                        )}
                        <Typography variant="subtitle1" gutterBottom>
                            <b>Nome Evento:</b> {event.name}
                        </Typography>
                        <Typography variant="subtitle1" gutterBottom>
                            <b>Lista:</b> {data.list_name}
                        </Typography>
                        <Grid container spacing={2} direction="column">
                            {event.is_allow_external ? (
                                <>
                                    {!data.external_name && !data.external_email && (
                                        <Grid size={{xs: 12}} sx={{mt: 1}}>
                                            <ProfileSearch
                                                value={data.profile_id ? {
                                                    id: data.profile_id,
                                                    name: data.profile_name
                                                } : null}
                                                onChange={(ev, newValue) => {
                                                    setData({
                                                        ...data,
                                                        profile_id: newValue?.id || '',
                                                        profile_name: newValue ? `${newValue.name} ${newValue.surname}` : '',
                                                        external_name: ''
                                                    });
                                                    setProfileHasEsncard(newValue ? Boolean(newValue.latest_esncard) : null);
                                                }}
                                                error={errors.profile_id && errors.profile_id[0]}
                                                helperText={errors.profile_id && errors.profile_id[1] || 'Cerca per nome o numero ESNcard'}
                                                label="Cerca profilo"
                                                required={!data.external_name}
                                                disabled={isEdit || !!profileId || isReimbursed}
                                            />
                                        </Grid>
                                    )}
                                    {!data.profile_id && (
                                        <>
                                            <Grid size={{xs: 12}} sx={{mt: 1}}>
                                                <TextField
                                                    label="Email Esterno"
                                                    name="external_email"
                                                    type="email"
                                                    value={data.external_email}
                                                    onChange={handleChange}
                                                    fullWidth
                                                    required={!data.profile_id}
                                                    error={errors.external_email && errors.external_email[0]}
                                                    helperText={errors.external_email && errors.external_email[1]}
                                                    disabled={isReimbursed}
                                                />
                                            </Grid>
                                            <Grid size={{xs: 12}} sx={{mt: 0}}>
                                                <TextField
                                                    label="Nominativo Esterno"
                                                    name="external_name"
                                                    value={data.external_name}
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        setData(d => ({
                                                            ...d,
                                                            external_name: v,
                                                            profile_id: v ? '' : d.profile_id,
                                                            profile_name: v ? '' : d.profile_name
                                                        }));
                                                        if (v) setProfileHasEsncard(null);
                                                    }}
                                                    fullWidth
                                                    required={!data.profile_id}
                                                    error={errors.external_name && errors.external_name[0]}
                                                    helperText={errors.external_name && errors.external_name[1]}
                                                    disabled={isReimbursed}
                                                />
                                            </Grid>

                                        </>
                                    )}
                                </>
                            ) : (
                                <Grid size={{xs: 12}} sx={{mt: 2}}>
                                    <ProfileSearch
                                        value={data.profile_id ? {id: data.profile_id, name: data.profile_name} : null}
                                        onChange={(ev, newValue) => {
                                            setData({
                                                ...data,
                                                profile_id: newValue?.id,
                                                profile_name: newValue ? `${newValue.name} ${newValue.surname}` : '',
                                                external_name: ''
                                            });
                                            // derive ESNcard presence from the selected option (no extra API call)
                                            setProfileHasEsncard(newValue ? Boolean(newValue.latest_esncard) : null);
                                        }}
                                        error={errors.profile_id && errors.profile_id[0]}
                                        helperText={errors.profile_id && errors.profile_id[1] || 'Cerca per nome o numero ESNcard'}
                                        label={isEdit ? data.profile_name : "Cerca profilo"}
                                        required={!event.is_allow_external}
                                        disabled={isEdit || !!profileId || isReimbursed}
                                    />
                                </Grid>
                            )}
                            {/* Services selection */}
                            {eventServices.length > 0 && (
                                <Grid size={{xs: 12}}>
                                    <Paper elevation={1} sx={{p: 1.5, mb: 1}}>
                                        <Typography variant="subtitle2" sx={{mb: 1}}>Servizi aggiuntivi</Typography>
                                        {eventServices.map((svc) => {
                                            const key = svc.id || svc.name;
                                            const selected = (data.selected_services || []).find(x => (x.service_id || x.id || x.name) === key);
                                            const priceLabel = toAmount(svc.price).toFixed(2);
                                            return (
                                                <Box key={key} sx={{mb: 1.5}}>
                                                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 0.5}}>
                                                        <FormControlLabel
                                                            control={
                                                                <Checkbox
                                                                    checked={!!selected}
                                                                    onChange={() => toggleService(svc)}
                                                                    disabled={isReimbursed}
                                                                    size="small"
                                                                />
                                                            }
                                                            label={`${svc.name} (€${priceLabel})`}
                                                        />
                                                        <TextField
                                                            label="Qtà"
                                                            type="number"
                                                            size="small"
                                                            sx={{width: 90}}
                                                            value={selected?.quantity || 1}
                                                            onChange={(e) => updateServiceQty(svc, e.target.value)}
                                                            disabled={!selected || isReimbursed}
                                                            slotProps={{htmlInput: {min: 1, step: 1}}}
                                                        />
                                                    </Box>
                                                    {svc.description && (
                                                        <Typography variant="body2" color="text.secondary" sx={{ml: 4, fontSize: '0.875rem', fontStyle: 'italic'}}>
                                                            {svc.description}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            );
                                        })}
                                        {data.selected_services && data.selected_services.length > 0 && (
                                            <Typography variant="body2" sx={{mt: 1}}>
                                                Totale servizi: €{getServicesTotal().toFixed(2)}
                                            </Typography>
                                        )}
                                    </Paper>
                                </Grid>
                            )}
                            {/* Quota status toggle */}
                            {event.cost > 0 && (
                                <Grid size={{xs: 12}}>
                                    <Paper
                                        elevation={1}
                                        sx={{
                                            p: 1.5,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            bgcolor: data.status_quota === 'paid' ? '#e3f2fd' : 'inherit',
                                            transition: 'background-color 0.8s',
                                            mb: 0
                                        }}
                                    >
                                        <Typography variant="subtitle2" sx={{ml: 1}}>Stato Quota</Typography>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    sx={{ml: 1}}
                                                    checked={data.status_quota === 'paid'}
                                                    onChange={() => setData(d => ({
                                                        ...d,
                                                        status_quota: d.status_quota === 'paid' ? 'pending' : 'paid'
                                                    }))}
                                                    color="primary"
                                                    disabled={isReimbursed}
                                                    size="small"
                                                />
                                            }
                                            label={data.status_quota === 'paid' ? "Pagata" : data.status_quota === 'reimbursed' ? "Rimborsata" : "In attesa"}
                                            labelPlacement="start"
                                            sx={{mr: 1}}
                                        />
                                    </Paper>
                                </Grid>
                            )}
                            {/* Cauzione status toggle */}
                            {event.deposit > 0 && (
                                <Grid size={{xs: 12}}>
                                    <Paper
                                        elevation={1}
                                        sx={{
                                            p: 1.5,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            bgcolor: data.status_cauzione === 'paid' ? '#e3f2fd' : 'inherit',
                                            transition: 'background-color 0.8s',
                                            mb: 0
                                        }}
                                    >
                                        <Typography variant="subtitle2" sx={{ml: 1}}>Stato Cauzione</Typography>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    sx={{ml: 1}}
                                                    checked={data.status_cauzione === 'paid'}
                                                    onChange={() => setData(d => ({
                                                        ...d,
                                                        status_cauzione: d.status_cauzione === 'paid' ? 'pending' : 'paid'
                                                    }))}
                                                    color="primary"
                                                    disabled={isReimbursed}
                                                    size="small"
                                                />
                                            }
                                            label={data.status_cauzione === 'paid' ? "Pagata" : data.status_cauzione === 'reimbursed' ? "Rimborsata" : "In attesa"}
                                            labelPlacement="start"
                                            sx={{mr: 1}}
                                        />
                                    </Paper>
                                </Grid>
                            )}
                            {/* Services status toggle */}
                            {data.selected_services && data.selected_services.length > 0 && (
                                <Grid size={{xs: 12}}>
                                    <Paper
                                        elevation={1}
                                        sx={{
                                            p: 1.5,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            bgcolor: data.status_services === 'paid' ? '#e3f2fd' : 'inherit',
                                            transition: 'background-color 0.8s',
                                            mb: 0
                                        }}
                                    >
                                        <Typography variant="subtitle2" sx={{ml: 1}}>Stato Servizi</Typography>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    sx={{ml: 1}}
                                                    checked={data.status_services === 'paid'}
                                                    onChange={() => setData(d => ({
                                                        ...d,
                                                        status_services: d.status_services === 'paid' ? 'pending' : 'paid'
                                                    }))}
                                                    color="primary"
                                                    disabled={isReimbursed}
                                                    size="small"
                                                />
                                            }
                                            label={data.status_services === 'paid' ? "Pagati" : data.status_services === 'reimbursed' ? "Rimborsati" : "In attesa"}
                                            labelPlacement="start"
                                            sx={{mr: 1}}
                                        />
                                    </Paper>
                                </Grid>
                            )}
                            {/* Show total import and cassa select if either is paid */}
                            {(data.status_quota === 'paid' || (event.deposit > 0 && data.status_cauzione === 'paid') || data.status_services === 'paid') && (
                                <>
                                    <Grid size={{xs: 12}} sx={{mt: 0}}>
                                        <Typography variant="subtitle1" gutterBottom>
                                            <b>Importo totale:</b> €{getTotalImport().toFixed(2)}
                                        </Typography>
                                    </Grid>
                                    <Grid size={{xs: 12}}>
                                        <FormControl fullWidth required error={errors.account_id && errors.account_id[0]}>
                                            <InputLabel htmlFor="account-selector" sx={{mb: 2}}>Seleziona Cassa</InputLabel>
                                            <Select
                                                variant="outlined"
                                                label="Seleziona Cassa"
                                                labelId="account-selector-label"
                                                id="account-selector"
                                                name="account_id"
                                                value={data.account_id || ''}
                                                error={errors.account_id && errors.account_id[0]}
                                                onChange={handleChange}
                                                disabled={isReimbursed}
                                            >
                                                {accounts.map((account) => (
                                                    <MenuItem key={account.id}
                                                              value={account.id}
                                                              disabled={account.status === 'closed'}
                                                              style={{color: account.status === 'closed' ? 'grey' : 'inherit'}}>
                                                        {account.name} {account.status === 'closed' ? '(Chiusa)' : ''}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                            {errors.account_id && errors.account_id[0] &&
                                                <FormHelperText>{errors.account_id[1]}</FormHelperText>}
                                        </FormControl>
                                    </Grid>
                                    {/* Options for email notification + automove */}
                                    {paymentBeingRegistered && (
                                        <Grid size={{xs: 12}} sx={{mt: 1}}>
                                            <Paper elevation={1} sx={{p: 1.5}}>
                                                {paymentBeingRegistered && (
                                                    <FormControlLabel
                                                        control={
                                                            <Switch
                                                                checked={!!data.send_payment_email}
                                                                onChange={() => setData(d => ({...d, send_payment_email: !d.send_payment_email}))}
                                                                color="primary"
                                                                size="small"
                                                                disabled={isReimbursed}
                                                            />
                                                        }
                                                        label="Invia email di conferma pagamento"
                                                        labelPlacement="end"
                                                        sx={{mr: 2}}
                                                    />
                                                )}
                                                {!data.is_main_list && !data.is_waiting_list && (
                                                    <FormControlLabel
                                                        control={
                                                            <Switch
                                                                checked={!!data.auto_move_after_payment}
                                                                onChange={() => setData(d => ({...d, auto_move_after_payment: !d.auto_move_after_payment}))}
                                                                color="primary"
                                                                size="small"
                                                                disabled={isReimbursed}
                                                            />
                                                        }
                                                        label="Sposta nella prima lista libera"
                                                        labelPlacement="end"
                                                    />
                                                )}
                                            </Paper>
                                        </Grid>
                                    )}
                                </>
                            )}
                            <Grid size={{xs: 12}}>
                                <TextField
                                    label="Note"
                                    name="notes"
                                    value={data.notes}
                                    onChange={handleChange}
                                    fullWidth
                                    disabled={isReimbursed}
                                />
                            </Grid>
                        </Grid>

                        {/* Alert: profile without ESNcard when externals are not allowed */}
                        {!event.is_allow_external && data.profile_id && profileHasEsncard === false && (
                            <Alert severity="error" sx={{mt: 2}}>
                                Attenzione! Il profilo selezionato non ha una ESNcard attiva. Contatta gli organizzatori per
                                verificare la situazione.
                            </Alert>
                        )}

                        <Button variant="contained"
                                fullWidth
                                sx={{
                                    mt: 2,
                                    bgcolor: (data.profile_id || (event.is_allow_external && data.external_name)) ? '#1976d2' : '#9e9e9e',
                                    '&:hover': {bgcolor: (data.profile_id || (event.is_allow_external && data.external_name)) ? '#1565c0' : '#757575'}
                                }}
                                onClick={handleSubmit}
                                disabled={submitLoading || isReimbursed || (!data.profile_id && !(data.external_name && data.external_email))}
                                startIcon={submitLoading ? <CircularProgress size={18}/> : null}>
                            {isEdit ? 'Salva Modifiche' : 'Conferma'}
                        </Button>
                        {isEdit && (
                            <Button variant="contained"
                                    fullWidth
                                    sx={{
                                        mt: 1,
                                        bgcolor: '#d32f2f',
                                        '&:hover': {bgcolor: '#b71c1c'}
                                    }}
                                    onClick={handleDelete}
                                    disabled={isReimbursed}>
                                Elimina Iscrizione
                            </Button>
                        )}
                        {popup && <Popup key={popup.id} message={popup.message} state={popup.state}/>}
                    </>)}
                </Box>
                <ConfirmDialog
                    open={confirmDialog.open}
                    message={confirmDialog.message}
                    onConfirm={confirmDialog.action}
                    onClose={() => setConfirmDialog({open: false, action: null, message: ''})}
                />
                {openEditAnswers && createdSubscription && (
                    <EditAnswersModal
                        open={openEditAnswers}
                        event={event}
                        subscription={createdSubscription}
                        onClose={() => {
                            setOpenEditAnswers(false);
                            onClose(true, postCreateMessage || 'Iscrizione completata con successo!');
                        }}
                    />
                )}
            </Box>
        </Modal>
    );
}
