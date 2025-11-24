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
    FormControlLabel as MuiFormControlLabel,
    FormLabel,
    FormGroup,
    Radio,
    RadioGroup
} from "@mui/material";
import {Switch, FormControlLabel, Paper, IconButton, Grid} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import {defaultErrorHandler, fetchCustom} from "../../api/api";
import {styleESNcardModal as style} from "../../utils/sharedStyles";
import Loader from "../Loader";
import ConfirmDialog from "../ConfirmDialog";
import ProfileSearch from "../ProfileSearch";
import Popup from "../Popup";
import {LocalizationProvider, DatePicker} from "@mui/x-date-pickers";
import {AdapterDayjs} from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import countryCodes from "../../data/countryCodes.json";

dayjs.extend(customParseFormat);

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
    const title = isEdit ? 'Modifica Iscrizione' : 'Iscrizione Evento';
    const originalAccountId = isEdit ? subscription.account_id || null : null; // 'paid' to 'pending' status needs the original account_id

    const [data, setData] = useState({
        id: '',
        account_id: '',
        account_name: '',
        profile_id: '',
        profile_name: '',
        external_name: '',
        email: '',
        list_id: listId || '',
        list_name: (event.selectedList ? event.selectedList.name : (event.lists && listId ? (event.lists.find(list => list.id === listId)?.name || 'Lista non trovata') : 'Lista non trovata')),
        notes: '',
        status_quota: subscription?.status_quota || 'pending',
        status_cauzione: subscription?.status_cauzione || 'pending'
    });

    const [profileHasEsncard, setProfileHasEsncard] = useState(null);

    // Form data and additional data for event fields
    const [formData, setFormData] = useState({});
    const [additionalData, setAdditionalData] = useState({});

    // Reusable empty errors shape
    const emptyErrors = {
        account_id: [false, ''],
        account_name: [false, ''],
        profile_id: [false, ''],
        profile_name: [false, ''],
        external_name: [false, ''],
        email: [false, ''],
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


    const fieldsToValidate = useMemo(() => {
        let arr = [];
        if (!data.profile_id && !data.external_name) {
            if (event.is_allow_external) {
                arr.push({
                    field: 'external_name',
                    value: data.external_name,
                    message: "Inserire un nominativo esterno"
                });
            } else {
                arr.push({field: 'profile_id', value: data.profile_id, message: "Selezionare un Profilo"});
            }
        }
        if (data.external_name && !data.email) {
            arr.push({
                field: 'email',
                value: data.email,
                message: "Inserire un'email per il nominativo esterno"
            });
        }
        if (data.status_quota === 'paid') {
            arr.push({field: 'account_id', value: data.account_id, message: "Selezionare una Cassa"});
        }
        return arr;
    }, [data, event]);

    const [submitLoading, setSubmitLoading] = useState(false);

    useEffect(() => {
        if (isEdit && subscription) {
            // NEW normalization for null/undefined
            setData(d => ({
                ...d,
                ...subscription,
                account_id: subscription.account_id || '',
                external_name: subscription.external_name || '',
                email: subscription.email || (subscription.form_data && subscription.form_data.email) || '',
                notes: subscription.notes || ''
            }));
            // Load existing form_data and additional_data
            setFormData(subscription.form_data || {});
            setAdditionalData(subscription.additional_data || {});
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
            // Initialize form data based on event fields
            const initialFormData = {};
            const initialAdditionalData = {};
            (event.fields || []).forEach(field => {
                if (field.field_type === 'form') {
                    initialFormData[field.name] = field.type === 'm' ? [] : (field.type === 'b' ? null : '');
                } else if (field.field_type === 'additional') {
                    initialAdditionalData[field.name] = field.type === 'm' ? [] : (field.type === 'b' ? null : '');
                }
            });
            setFormData(initialFormData);
            setAdditionalData(initialAdditionalData);
        }
        setLoading(false);
        fetchAccounts();
    }, [isEdit, subscription, profileId, profileName, event])

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
        return total;
    };

    // Helper to detect status changes for quota/cauzione
    const getStatusChanges = () => {
        const quotaChangedToPaid = data.status_quota === 'paid' && (!isEdit || subscription?.status_quota !== 'paid');
        const quotaChangedToPending = isEdit && subscription?.status_quota === 'paid' && data.status_quota === 'pending';
        const cauzioneChangedToPaid = event.deposit > 0 && data.status_cauzione === 'paid' && (!isEdit || subscription?.status_cauzione !== 'paid');
        const cauzioneChangedToPending = isEdit && subscription?.status_cauzione === 'paid' && data.status_cauzione === 'pending';
        return {quotaChangedToPaid, quotaChangedToPending, cauzioneChangedToPaid, cauzioneChangedToPending};
    };

    // Helper to show confirm dialog message for payment changes
    const getConfirmMessage = () => {
        const {
            quotaChangedToPaid,
            quotaChangedToPending,
            cauzioneChangedToPaid,
            cauzioneChangedToPending
        } = getStatusChanges();
        const accountObj = accounts.find(acc => acc.id === data.account_id);
        const accountName = accountObj ? accountObj.name : 'N/A';

        // Check both toggled to paid first
        if (quotaChangedToPaid && cauzioneChangedToPaid) {
            return `Confermi un pagamento totale di €${getTotalImport().toFixed(2)} in cassa ${accountName}?`;
        }
        // Check both toggled to pending first
        if (quotaChangedToPending && cauzioneChangedToPending) {
            return `Confermi la rimozione di entrambi i pagamenti (quota + cauzione) per un totale di €${getTotalImport().toFixed(2)}? Verranno stornati dalla cassa.`;
        }
        // Then single checks
        if (quotaChangedToPaid) {
            return `Confermi il pagamento della quota di €${getQuotaImport().toFixed(2)} in cassa ${accountName}?`;
        }
        if (cauzioneChangedToPaid) {
            return `Confermi il pagamento della cauzione di €${getCauzioneImport().toFixed(2)} in cassa ${accountName}?`;
        }
        if (quotaChangedToPending) {
            return `Confermi la rimozione del pagamento della quota di €${getQuotaImport().toFixed(2)}? Verrà stornato dalla cassa.`;
        }
        if (cauzioneChangedToPending) {
            return `Confermi la rimozione del pagamento della cauzione di €${getCauzioneImport().toFixed(2)}? Verrà stornato dalla cassa.`;
        }
        // Default: if either is paid
        if (data.status_quota === 'paid' || (event.deposit > 0 && data.status_cauzione === 'paid')) {
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
            cauzioneChangedToPending
        } = getStatusChanges();
        const accountChanged = isEdit && subscription?.account_id !== data.account_id;

        if (quotaChangedToPaid || quotaChangedToPending || cauzioneChangedToPaid || cauzioneChangedToPending || accountChanged) {
            setConfirmDialog({
                open: true,
                action: () => doSubmit(),
                message: getConfirmMessage()
            });
            return;
        }
        // For new subscriptions, show confirm only if either is paid
        if (!isEdit && (data.status_quota === 'paid' || (event.deposit > 0 && data.status_cauzione === 'paid'))) {
            setConfirmDialog({
                open: true,
                action: () => doSubmit(),
                message: getConfirmMessage()
            });
            return;
        }
        doSubmit();
    };

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
                external_name: data.external_name || undefined,
                email: data.email || undefined,
                form_data: formData,
                additional_data: additionalData
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
    const isReimbursed = data.status_quota === 'reimbursed' || data.status_cauzione === 'reimbursed';

    // Handlers for form and additional fields
    const handleFormFieldChange = (fieldName, value) => {
        setFormData(prev => ({...prev, [fieldName]: value}));
    };

    const handleAdditionalFieldChange = (fieldName, value) => {
        setAdditionalData(prev => ({...prev, [fieldName]: value}));
    };

    const handleCheckboxChange = (field, choice, isAdditional = false) => {
        const setter = isAdditional ? setAdditionalData : setFormData;
        const current = isAdditional ? additionalData : formData;
        
        setter(prev => {
            const arr = prev[field] || [];
            return {
                ...prev,
                [field]: arr.includes(choice)
                    ? arr.filter(v => v !== choice)
                    : [...arr, choice]
            };
        });
    };

    // Helper to parse phone (stored as single string)
    const parsePhone = (val) => {
        if (!val) return {prefix: '', number: ''};
        const parts = val.trim().split(/\s+/);
        if (parts[0].startsWith('+')) {
            return {prefix: parts[0], number: parts.slice(1).join(' ')};
        }
        return {prefix: '', number: val};
    };
    
    const setPhoneValue = (fieldName, prefix, number, isAdditional = false) => {
        const combined = prefix ? (number ? `${prefix} ${number}` : prefix) : number;
        if (isAdditional) {
            handleAdditionalFieldChange(fieldName, combined);
        } else {
            handleFormFieldChange(fieldName, combined);
        }
    };

    // Render a single field input
    const renderFieldInput = (field, value, onChange, isAdditional = false) => {
        const handleCheckbox = (choice) => handleCheckboxChange(field.name, choice, isAdditional);
        
        switch (field.type) {
            case "t":
                return (
                    <TextField
                        label={field.name}
                        required={field.required}
                        fullWidth
                        margin="normal"
                        value={value || ""}
                        onChange={e => onChange(field.name, e.target.value)}
                        disabled={isReimbursed}
                    />
                );
            case "n":
                return (
                    <TextField
                        label={field.name}
                        required={field.required}
                        fullWidth
                        margin="normal"
                        type="number"
                        value={value || ""}
                        onChange={e => onChange(field.name, e.target.value)}
                        slotProps={{htmlInput: {step: "0.01"}}}
                        disabled={isReimbursed}
                    />
                );
            case "c":
                return (
                    <FormControl required={field.required} margin="normal" fullWidth disabled={isReimbursed}>
                        <FormLabel>{field.name}</FormLabel>
                        <RadioGroup
                            value={value || ""}
                            onChange={e => onChange(field.name, e.target.value)}
                        >
                            {field.choices?.map(choice => (
                                <MuiFormControlLabel
                                    key={choice}
                                    value={choice}
                                    control={<Radio/>}
                                    label={choice}
                                />
                            ))}
                        </RadioGroup>
                    </FormControl>
                );
            case "s":
                return (
                    <FormControl required={field.required} margin="normal" fullWidth disabled={isReimbursed}>
                        <InputLabel>{field.name}</InputLabel>
                        <Select
                            value={value || ""}
                            onChange={e => onChange(field.name, e.target.value)}
                            label={field.name}
                        >
                            {field.choices?.map(choice => (
                                <MenuItem key={choice} value={choice}>
                                    {choice}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                );
            case "m":
                return (
                    <FormControl required={field.required} margin="normal" fullWidth disabled={isReimbursed}>
                        <FormLabel>{field.name}</FormLabel>
                        <FormGroup>
                            {field.choices?.map(choice => (
                                <MuiFormControlLabel
                                    key={choice}
                                    control={
                                        <Checkbox
                                            checked={(value || []).includes(choice)}
                                            onChange={() => handleCheckbox(choice)}
                                        />
                                    }
                                    label={choice}
                                />
                            ))}
                        </FormGroup>
                    </FormControl>
                );
            case "b":
                return (
                    <FormControl required={field.required} margin="normal" fullWidth disabled={isReimbursed}>
                        <FormLabel>{field.name}</FormLabel>
                        <RadioGroup
                            row
                            value={
                                value === true
                                    ? "yes"
                                    : value === false
                                        ? "no"
                                        : ""
                            }
                            onChange={e => onChange(field.name, e.target.value === "yes")}
                        >
                            <MuiFormControlLabel value="yes" control={<Radio/>} label="Yes"/>
                            <MuiFormControlLabel value="no" control={<Radio/>} label="No"/>
                        </RadioGroup>
                    </FormControl>
                );
            case "d":
                return (
                    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='en-gb'>
                        <DatePicker
                            label={field.name}
                            format="DD-MM-YYYY"
                            value={value ? dayjs(value, "DD-MM-YYYY") : null}
                            onChange={val =>
                                onChange(
                                    field.name,
                                    val && val.isValid() ? val.format('DD-MM-YYYY') : ''
                                )
                            }
                            slotProps={{
                                textField: {
                                    fullWidth: true,
                                    margin: "normal",
                                    required: field.required
                                }
                            }}
                            disabled={isReimbursed}
                        />
                    </LocalizationProvider>
                );
            case "e":
                return (
                    <TextField
                        label={field.name}
                        required={field.required}
                        fullWidth
                        margin="normal"
                        value={value || ""}
                        onChange={e => onChange(field.name, e.target.value)}
                        disabled={isReimbursed}
                    />
                );
            case "p": {
                const {prefix, number} = parsePhone(value);
                const dialEntries = [];
                const seen = new Set();
                countryCodes.forEach(c => {
                    if (c.dial && !seen.has(c.dial)) {
                        seen.add(c.dial);
                        dialEntries.push(c);
                    }
                });
                return (
                    <Box sx={{mt: 2}}>
                        <Typography variant="subtitle2" sx={{mb: 1}}>
                            {field.name}{field.required && ' *'}
                        </Typography>
                        <Box sx={{display: 'flex', gap: 1}}>
                            <TextField
                                select
                                label="Prefix"
                                value={prefix}
                                onChange={e => setPhoneValue(field.name, e.target.value, number, isAdditional)}
                                sx={{width: 140}}
                                required={field.required}
                                disabled={isReimbursed}
                            >
                                {dialEntries.map(entry => (
                                    <MenuItem key={entry.dial} value={entry.dial}>
                                        {entry.dial}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                label="Number"
                                value={number}
                                onChange={e => setPhoneValue(field.name, prefix, e.target.value, isAdditional)}
                                fullWidth
                                required={field.required}
                                disabled={isReimbursed}
                            />
                        </Box>
                    </Box>
                );
            }
            default:
                return null;
        }
    };

    // Filter fields by type
    const formFields = (event.fields || []).filter(field => field.field_type === 'form');
    const additionalFields = (event.fields || []).filter(field => field.field_type === 'additional');

    return (
        <Modal open={open}
               onClose={() => onClose(false)}
               aria-labelledby="modal-modal-title"
               aria-describedby="modal-modal-description">
            <Box sx={style}>
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
                                {!data.external_name && (
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
                                    <Grid size={{xs: 12}} sx={{mt: 1}}>
                                        <TextField
                                            label="Nominativo Esterno"
                                            name="external_name"
                                            value={data.external_name}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                setData(d => ({
                                                    ...d,
                                                    external_name: v,
                                                    profile_id: v ? '' : d.profile_id, // ensure exclusivity
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
                                )}
                                {!data.profile_id && data.external_name && (
                                    <Grid size={{xs: 12}} sx={{mt: 1}}>
                                        <TextField
                                            label="Email"
                                            name="email"
                                            value={data.email}
                                            onChange={handleChange}
                                            fullWidth
                                            required
                                            error={errors.email && errors.email[0]}
                                            helperText={errors.email && errors.email[1]}
                                            disabled={isReimbursed}
                                        />
                                    </Grid>
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
                        {/* Show total import and cassa select if either is paid */}
                        {(data.status_quota === 'paid' || (event.deposit > 0 && data.status_cauzione === 'paid')) && (
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

                    {/* Form fields section - only if form is enabled */}
                    {event.enable_form && formFields.length > 0 && (
                        <Box sx={{mt: 3}}>
                            <Typography variant="h6" gutterBottom>Risposte Form</Typography>
                            <Grid container spacing={2}>
                                {formFields.map((field, idx) => (
                                    <Grid key={idx} size={{xs: 12}}>
                                        {renderFieldInput(field, formData[field.name], handleFormFieldChange, false)}
                                    </Grid>
                                ))}
                            </Grid>
                        </Box>
                    )}

                    {/* Additional fields section - always shown if present */}
                    {additionalFields.length > 0 && (
                        <Box sx={{mt: 3}}>
                            <Typography variant="h6" gutterBottom>Campi Aggiuntivi</Typography>
                            <Grid container spacing={2}>
                                {additionalFields.map((field, idx) => (
                                    <Grid key={idx} size={{xs: 12}}>
                                        {renderFieldInput(field, additionalData[field.name], handleAdditionalFieldChange, true)}
                                    </Grid>
                                ))}
                            </Grid>
                        </Box>
                    )}

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
                            disabled={submitLoading || isReimbursed}
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
                <ConfirmDialog
                    open={confirmDialog.open}
                    message={confirmDialog.message}
                    onConfirm={confirmDialog.action}
                    onClose={() => setConfirmDialog({open: false, action: null, message: ''})}
                />
            </Box>
        </Modal>
    );
}
