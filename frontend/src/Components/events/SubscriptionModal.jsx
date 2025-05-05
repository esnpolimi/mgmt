import React, {useEffect, useMemo, useState} from "react";
import {Button, Box, Divider, FormControl, InputLabel, MenuItem, Modal, Select, Typography, TextField, FormHelperText, Autocomplete, Switch, FormControlLabel, Paper, IconButton, Grid} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import {fetchCustom} from "../../api/api";
import {styleESNcardModal as style} from "../../utils/sharedStyles";
import Popup from "../Popup";
import {extractErrorMessage} from "../../utils/errorHandling";
import Loader from "../Loader";
import ConfirmDialog from "../ConfirmDialog";
import {useAuth} from "../../Context/AuthContext";

export default function SubscriptionModal({open, onClose, event, listId, subscription, isEdit}) {
    const [isLoading, setLoading] = useState(true);
    const {accounts} = useAuth();
    const [successPopup, setSuccessPopup] = useState(null);
    const [profiles, setProfiles] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchLoading, setSearchLoading] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState({open: false, action: null, message: ''});
    const title = isEdit ? 'Modifica Iscrizione' : 'Iscrizione Evento';
    const originalAccountId = isEdit ? subscription.account_id || null : null; // 'paid' to 'pending' status needs the original account_id

    const [data, setData] = useState({
        id: '',
        account_id: '',
        account_name: '',
        profile_id: '',
        profile_name: '',
        status: 'pending',
        list_id: listId || '',
        list_name: event.lists.find(list => list.id === listId)?.name || 'Lista non trovata',
        notes: '',
    });

    const [errors, setErrors] = useState({
        account_id: [false, ''],
        account_name: [false, ''],
        profile_id: [false, ''],
        profile_name: [false, ''],
        status: [false, ''],
        list_id: [false, ''],
        list_name: [false, ''],
        notes: [false, ''],
    });

    const fieldsToValidate = useMemo(() => [
        {field: 'profile_id', value: data?.profile_id, message: "Selezionare un Profilo"},
        ...(data?.status === 'paid' ? [{field: 'account_id', value: data?.account_id, message: "Selezionare una Cassa"}] : [])
    ], [data]);

    const [originalStatus, setOriginalStatus] = useState(isEdit ? subscription.status : 'pending');

    useEffect(() => {
        if (isEdit) {
            console.log('Setting Subscription:', subscription);
            setData(subscription)
            setOriginalStatus(subscription.status);
        }
        setLoading(false);
    }, [isEdit])

    // Fetch profiles based on search query
    useEffect(() => {
        const searchProfiles = async () => {
            if (searchQuery.length < 3) {
                setProfiles([]);
                return;
            }
            setSearchLoading(true);
            try {
                const response = await fetchCustom("GET", `/profiles/search/?q=${searchQuery}&valid_only=true&esner_only=false`);
                if (!response.ok) {
                    const errorMessage = await extractErrorMessage(response);
                    setSuccessPopup({message: `Errore: ${errorMessage}`, state: 'error'});
                } else {
                    const json = await response.json();
                    setProfiles(json.results || []);
                }
            } catch (error) {
                setSuccessPopup({message: `Errore generale: ${error}`, state: "error"});
            } finally {
                setSearchLoading(false);
            }
        };
        const debounceTimer = setTimeout(() => {
            if (searchQuery.length >= 2) {
                searchProfiles().then();
            }
        }, 300);
        return () => clearTimeout(debounceTimer);
    }, [searchQuery]);

    const resetErrors = () => {
        const resetObj = {};
        Object.keys(errors).forEach(key => {
            resetObj[key] = [false, ''];
        });
        setErrors(resetObj);
        return resetObj;
    };

    const handleSubmit = async () => {
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

        // Confirmation if payment is involved (new paid or status changed to paid)
        if (
            (data.status === 'paid' && (!isEdit || originalStatus !== 'paid'))
            || (isEdit && originalStatus === 'paid' && data.status !== 'paid')
        ) {
            let msg = '';
            if (data.status === 'paid' && (!isEdit || originalStatus !== 'paid')) {
                msg = 'Confermi di registrare un pagamento di €' + event.cost + ' per questa iscrizione?';
            } else if (isEdit && originalStatus === 'paid' && data.status !== 'paid') {
                msg = 'Confermi di annullare un pagamento di €' + event.cost + ' per questa iscrizione?';
            }
            setConfirmDialog({open: true, action: () => doSubmit(), message: msg});
            return;
        }

        await doSubmit();
    };

    const doSubmit = async () => {
        setConfirmDialog({open: false, action: null, message: ''});
        try {
            const response = await fetchCustom(isEdit ? "PATCH" : "POST", `/subscription/${isEdit ? data.id + '/' : ''}`, {
                profile: data.profile_id,
                event: event.id,
                list: data.list_id,
                account_id: data.account_id || originalAccountId,
                notes: data.notes,
                status: data.status
            });
            if (!response.ok) {
                const errorMessage = await extractErrorMessage(response);
                setSuccessPopup({message: `Errore: ${errorMessage}`, state: 'error'});
            } else onClose(true, (isEdit ? 'Modifica Iscrizione' : 'Iscrizione') + ' completata con successo!');
        } catch (error) {
            setSuccessPopup({message: `Errore generale: ${error}`, state: "error"});
        }
    };

    const handleDelete = async () => {
        // Only confirm if paid
        if (data.status === 'paid') {
            setConfirmDialog({
                open: true,
                action: () => doDelete(),
                message: 'Confermi di voler eliminare un pagamento di €' + event.cost + ' per questa iscrizione?'
            });
            return;
        }
        await doDelete();
    };

    const doDelete = async () => {
        setConfirmDialog({open: false, action: null, message: ''});
        if (!isEdit || !data.id) return;
        try {
            const response = await fetchCustom("DELETE", `/subscription/${data.id}/`);
            if (!response.ok) {
                const errorMessage = await extractErrorMessage(response);
                setSuccessPopup({message: `Errore eliminazione: ${errorMessage}`, state: 'error'});
            } else {
                onClose(true, "Eliminazione avvenuta con successo");
            }
        } catch (error) {
            setSuccessPopup({message: `Errore generale: ${error}`, state: "error"});
        }
    };

    const handleChange = (e) => {
        setData({
            ...data,
            [e.target.name]: e.target.value,
        });
    };

    const handleStatusToggle = () => {
        setData({
            ...data,
            status: data.status === 'paid' ? 'pending' : 'paid',
            // Reset account_id if switching to pending
            ...(data.status === 'paid' ? {account_id: ''} : {})
        });
    };

    const getOptionLabel = (option) => {
        return `${option.name} ${option.surname}`;
    };

    const renderOption = (props, option) => {
        const {key, ...otherProps} = props;
        const hasEsncard = option.latest_esncard && option.latest_esncard.number;
        const esnCardExpired = hasEsncard && !option.latest_esncard.is_valid;

        return (
            <li key={key} {...otherProps}>
                <Grid container spacing={1} sx={{width: '100%'}}>
                    <Grid size={{xs: 4}}>
                        <Typography>{option.name} {option.surname}</Typography>
                    </Grid>
                    <Grid size={{xs: 4}}>
                        <Typography
                            component="span"
                            sx={{color: hasEsncard ? (esnCardExpired ? 'error.main' : 'text.primary') : 'error.main'}}
                        >
                            {hasEsncard
                                ? (esnCardExpired ? `${option.latest_esncard.number} (Scaduta)` : option.latest_esncard.number)
                                : 'No ESNcard'}
                        </Typography>
                    </Grid>

                    <Grid size={{xs: 4}}>
                        <Typography
                            component="span"
                            sx={{
                                color: option.is_esner ? 'primary.main' : 'success.main',
                                fontWeight: 'bold',
                                textAlign: 'right',
                                display: 'block'
                            }}
                        >
                            {option.is_esner ? 'ESNer' : 'Erasmus'}
                        </Typography>
                    </Grid>
                </Grid>
            </li>
        );
    };


    return (
        <Modal
            open={open}
            onClose={() => {
                onClose(false);
            }}
            aria-labelledby="modal-modal-title"
            aria-describedby="modal-modal-description"
        >
            <Box sx={style}>
                {isLoading ? <Loader/> : (<>
                    <Box sx={{display: 'flex', justifyContent: 'flex-end', mb: -2}}>
                        <IconButton onClick={() => onClose(false)} sx={{minWidth: 0}}><CloseIcon/></IconButton>
                    </Box>
                    <Typography variant="h4" component="h2" gutterBottom>{title}</Typography>
                    <Divider sx={{mb: 2}}/>
                    <Typography variant="subtitle1" gutterBottom>
                        <b>Nome Evento:</b> {event.name}
                    </Typography>
                    <Typography variant="subtitle1" gutterBottom>
                        <b>Lista:</b> {data.list_name}
                    </Typography>
                    <Typography variant="subtitle1" gutterBottom>
                        <b>Importo:</b> {event.cost}€
                    </Typography>

                    <Grid container spacing={2} direction="column">
                        <Grid size={{xs: 12}} sx={{mt: 2}}>
                            <Autocomplete
                                id="profile-search"
                                options={profiles}
                                loading={searchLoading}
                                getOptionLabel={getOptionLabel}
                                renderOption={renderOption}
                                onChange={(event, newValue) => {
                                    setData({...data, profile_id: newValue?.id});
                                }}
                                onInputChange={(event, newInputValue) => {
                                    setSearchQuery(newInputValue);
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label={isEdit ? data.profile_name : "Cerca profilo"}
                                        variant="outlined"
                                        fullWidth
                                        required
                                        error={errors.profile_id && errors.profile_id[0]}
                                        helperText={errors.profile_id && errors.profile_id[1] || 'Cerca per nome o numero ESNcard'}
                                    />
                                )}
                                noOptionsText="Nessun profilo trovato"
                                loadingText="Caricamento..."
                                disabled={isEdit}
                            />
                        </Grid>
                        <Grid size={{xs: 12}}>
                            <Paper
                                elevation={1}
                                sx={{
                                    p: 2,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    bgcolor: data.status === 'paid' ? '#e3f2fd' : 'inherit',
                                    transition: 'background-color 0.3s'
                                }}
                            >
                                <Typography variant="subtitle1">Stato Pagamento</Typography>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={data.status === 'paid'}
                                            onChange={handleStatusToggle}
                                            color="primary"
                                        />
                                    }
                                    label={data.status === 'paid' ? "Pagato" : "In attesa"}
                                    labelPlacement="start"
                                />
                            </Paper>
                        </Grid>
                        {data.status === 'paid' && (
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
                                        onChange={handleChange}>
                                        {accounts.map((account) => (
                                            <MenuItem key={account.id} value={account.id}>
                                                {account.name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                    {errors.account_id && errors.account_id[0] && <FormHelperText>{errors.account_id[1]}</FormHelperText>}
                                </FormControl>
                            </Grid>
                        )}

                        <Grid size={{xs: 12}}>
                            <TextField
                                label="Note"
                                name="notes"
                                value={data.notes}
                                onChange={handleChange}
                                multiline
                                rows={2}
                                fullWidth
                            />
                        </Grid>
                    </Grid>

                    <Button
                        variant="contained"
                        fullWidth
                        sx={{
                            mt: 2,
                            bgcolor: data.profile_id ? '#1976d2' : '#9e9e9e',
                            '&:hover': {bgcolor: data.profile_id ? '#1565c0' : '#757575'}
                        }}
                        onClick={handleSubmit}>
                        {isEdit ? 'Salva Modifiche' : 'Conferma'}
                    </Button>
                    {isEdit && (
                        <Button
                            variant="contained"
                            fullWidth
                            sx={{
                                mt: 1,
                                bgcolor: '#d32f2f',
                                '&:hover': {bgcolor: '#b71c1c'}
                            }}
                            onClick={handleDelete}
                        >
                            Elimina Iscrizione
                        </Button>
                    )}
                    {successPopup && <Popup message={successPopup.message} state={successPopup.state}/>}
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
