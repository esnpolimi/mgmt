import React, {useEffect, useState, useCallback} from 'react';
import {
    Modal,
    Box,
    TextField,
    Button,
    IconButton,
    Typography,
    Tooltip,
    Grid,
    CircularProgress,
    FormControlLabel,
    Switch
} from '@mui/material';
import {LocalizationProvider, DatePicker, DateTimePicker} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import {Add as AddIcon, Delete as DeleteIcon, Info as InfoIcon} from '@mui/icons-material';
import {fetchCustom, defaultErrorHandler} from "../../api/api";
import {style} from '../../utils/sharedStyles'
import {eventDisplayNames as eventNames} from '../../utils/displayAttributes';
import CustomEditor from '../CustomEditor';
import Loader from "../Loader";
import CloseIcon from '@mui/icons-material/Close';
import Popup from "../Popup";
import ConfirmDialog from "../ConfirmDialog";
import StatusBanner from "../StatusBanner";
import EventModalForm from './EventModalForm';
import {Radio, RadioGroup, FormControl, FormLabel} from '@mui/material';
import ProfileSearch from '../ProfileSearch';

export default function EventModal({open, event, isEdit, onClose}) {
    const [isLoading, setLoading] = useState(true);
    const title = isEdit ? 'Modifica Evento - ' + event.name : 'Crea Evento';
    const [statusMessage, setStatusMessage] = useState(null);
    const [hasSubscriptions, setHasSubscriptions] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [popup, setPopup] = useState(null);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const [data, setData] = useState({
        id: '',
        name: '',
        date: dayjs(),
        description: '',
        cost: '',
        deposit: '',
        subscription_start_date: dayjs().hour(12).minute(0),
        subscription_end_date: dayjs().hour(24).minute(0),
        lists: [{id: '', name: 'Main List', capacity: ''}],
        is_a_bando: false,
        is_allow_external: false,
        enable_form: false,
        profile_fields: ['name', 'surname', 'email', 'whatsapp_prefix', 'whatsapp_number'], // default profile fields
        fields: [ // unified fields of form fields and additional columns
            {field_type: 'form', name: 'What are your allergies?', type: 't', required: true},
            {field_type: 'form', name: 'Vegetarian?', type: 'b', required: true},
            {field_type: 'additional', name: 'Verificato', type: 'b'},
        ],
        organizers: [],
    });

    const [errors, setErrors] = React.useState({
        name: [false, ''],
        date: [false, ''],
        description: [false, ''],
        cost: [false, ''],
        deposit: [false, ''],
        subscription_start_date: [false, ''],
        subscription_end_date: [false, ''],
        lists: [false, ''],
        listItems: []
    });

    const [originalAdditionalFields, setOriginalAdditionalFields] = useState([]);

    useEffect(() => {
        if (isEdit) {
            const eventData = {
                ...event,
                profile_fields: Array.isArray(event.profile_fields) ? event.profile_fields : ['name', 'surname'],
                fields: Array.isArray(event.fields) ? event.fields : [],
                enable_form: Boolean(event.enable_form),
                organizers: Array.isArray(event.organizers)
                    ? event.organizers.map(o => ({
                        profile: o.profile,
                        profile_name: o.profile_name,
                        is_lead: !!o.is_lead
                    }))
                    : []
            };
            setData(eventData);
            setHasSubscriptions(event.subscriptions && event.subscriptions.length > 0);

            // Store original additional fields for comparison
            const originalAdditional = eventData.fields.filter(f => f.field_type === 'additional');
            setOriginalAdditionalFields(originalAdditional);
        }
        setLoading(false);
    }, [event, isEdit]);

    const formatDateString = (date) => {
        return dayjs(date).format('YYYY-MM-DD');
    };

    const formatDateTimeString = (date) => {
        return dayjs(date).toISOString();
    };

    const handleEventDateChange = (date) => {
        setData({...data, date: date});
    };

    const handleSubscriptionStartChange = (date) => {
        // If end date exists and is now before start date, update it
        if (data.subscription_end_date && dayjs(date).isAfter(dayjs(data.subscription_end_date))) {
            setData({
                ...data,
                subscription_start_date: date,
                subscription_end_date: dayjs(date).add(1, 'day'),
            });
        } else {
            setData({...data, subscription_start_date: date});
        }
        
        // If form opening time exists and is now before or equal to start date, update it
        if (formProgrammedOpenTime && dayjs(date).isAfter(dayjs(formProgrammedOpenTime))) {
            setFormProgrammedOpenTime(dayjs(date).add(1, 'hour').toISOString());
        }
    };

    const handleSubscriptionEndChange = (date) => {
        // Only allow dates and times after start date and time and current time
        if (date) {
            const startDateTime = dayjs(data.subscription_start_date);
            const endDateTime = dayjs(date);
            const now = dayjs();

            // End date should not be before start date or current time
            if (endDateTime.isBefore(startDateTime)) {
                date = startDateTime;
            } else if (endDateTime.isBefore(now)) {
                date = now;
            }
        }
        setData({...data, subscription_end_date: date});
    };


    const convert = (data) => {
        // Remove subscriptions, form_fields, and additional_fields if present
        const {subscriptions, form_fields, additional_fields, ...rest} = data;
        return ({
            ...rest,
            name: rest.name,
            date: formatDateString(rest.date),
            description: rest.description,
            subscription_start_date: formatDateTimeString(rest.subscription_start_date),
            subscription_end_date: formatDateTimeString(rest.subscription_end_date),
            cost: Number(rest.cost).toFixed(2),
            deposit: Number(rest.deposit).toFixed(2),
            lists: rest.lists.map(t => ({
                id: t.id || null,
                name: t.name,
                capacity: Math.floor(Number(t.capacity)),
                is_main_list: !!t.is_main_list,
                is_waiting_list: !!t.is_waiting_list
            })),
            is_a_bando: !!rest.is_a_bando,
            is_allow_external: !!rest.is_allow_external,
            fields: rest.fields ?? [],
            allow_online_payment: allowOnlinePayment,
            form_programmed_open_time: formProgrammedOpenTime || null,
            organizers: (rest.organizers || []).map(o => ({
                profile: o.profile,
                is_lead: !!o.is_lead
            })),
        })
    }

    const scrollUp = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    const handleInputChange = (event) => {
        const {name, value, type, checked} = event.target;
        setData({
            ...data,
            [name]: type === 'checkbox' ? checked : value,
        });
    };

    const handleAddList = () => {
        setData({
            ...data,
            lists: [...data.lists, {id: '', name: '', capacity: ''}],
        });
    };

    const handleListChange = (index, event) => {
        const {name, value} = event.target;
        const updatedLists = data.lists.map((list, i) =>
            i === index ? {...list, [name]: value} : list
        );
        setData({...data, lists: updatedLists});
    };

    const handleDeleteList = (index) => {
        setData({
            ...data,
            lists: data.lists.filter((_, i) => i !== index),
        });
    };

    const handleListTypeChange = (index, type) => {
        setData(prev => {
            const updatedLists = prev.lists.map((list, i) => {
                if (type === 'main') {
                    // Set ML only for selected index, clear ML from others, keep WL unchanged
                    return {
                        ...list,
                        is_main_list: i === index,
                        is_waiting_list: list.is_waiting_list
                    };
                } else if (type === 'waiting') {
                    // Set WL only for selected index, clear WL from others, keep ML unchanged
                    return {
                        ...list,
                        is_main_list: list.is_main_list,
                        is_waiting_list: i === index
                    };
                } else {
                    // Set both to false for selected index, keep others unchanged
                    return i === index
                        ? { ...list, is_main_list: false, is_waiting_list: false }
                        : list;
                }
            });
            return { ...prev, lists: updatedLists };
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Validate lists - check if any list has empty name or capacity
        const listErrors = data.lists.map(list => ({
            name: !list.name.trim(),
            capacity: list.capacity === ''
        }));
        const hasListErrors = listErrors.some(error => error.name || error.capacity);
        setErrors({...errors, listItems: listErrors, lists: [hasListErrors]});
        if (hasListErrors) {
            setStatusMessage({message: 'Errore campi Liste', state: 'error'});
            scrollUp();
            return;
        }

        // Validate fields' names and choices
        if (data.enable_form && typeof EventModalForm.validateFields === 'function') {
            if (!EventModalForm.validateFields()) {
                setStatusMessage({
                    message: 'Errore nei campi del form: tutti i nomi e le opzioni devono essere compilati.',
                    state: 'error'
                });
                scrollUp();
                return;
            }
        }

        // Prevent submit if form is enabled but no form_programmed_open_time is set
        if (data.enable_form && !formProgrammedOpenTime) {
            setStatusMessage({
                message: 'Devi specificare l\'orario di apertura del form iscrizioni.',
                state: 'error'
            });
            scrollUp();
            return;
        }

        setSubmitting(true);

        const payload = convert(data);
        const method = isEdit ? "PATCH" : "POST";
        const url = isEdit ? `/event/${data.id}/` : '/event/';

        fetchCustom(method, url, {
            body: payload,
            onSuccess: () => onClose(true),
            onError: (err) => {
                defaultErrorHandler(err, setPopup).then(() => {
                    scrollUp()
                });
            },
            onFinally: () => setSubmitting(false)
        });
    }

    const handleDelete = () => {
        setDeleting(true);
        fetchCustom("DELETE", `/event/${data.id}/`, {
            onSuccess: () => onClose(true, 'deleted'),
            onError: (err) => {
                defaultErrorHandler(err, setPopup).then(() => {
                    scrollUp();
                });
            },
            onFinally: () => {
                setDeleting(false);
                setConfirmOpen(false);
            }
        });
    };

    const handleClose = () => {
        onClose(false);
    }

    // Helper to disable form/profile fields editing if there are subscriptions
    const formFieldsDisabled = isEdit && hasSubscriptions;

    // Memoize the setter functions to prevent infinite re-renders
    const handleSetProfileFields = useCallback((fields) => {
        setData(prev => {
            if (formFieldsDisabled) return prev;
            return {...prev, profile_fields: fields};
        });
    }, [formFieldsDisabled]);

    const handleSetFields = useCallback((fields) => {
        setData(prev => {
            if (isEdit && hasSubscriptions) {
                // Keep existing form fields unchanged
                const existingFormFields = prev.fields.filter(f => f.field_type === 'form');

                // For additional fields: allow editing name and deletion, but not type change
                // Match original additional fields by index
                const newAdditionalFields = fields.filter(f => f.field_type === 'additional');
                const updatedAdditionalFields = [];

                // Update existing additional fields by index
                for (let i = 0; i < originalAdditionalFields.length; i++) {
                    // If the field at this index still exists in the new fields, update its name (and other editable props)
                    const updated = newAdditionalFields[i];
                    if (updated) {
                        // Preserve original type, allow name/other edits
                        updatedAdditionalFields.push({
                            ...updated,
                            type: originalAdditionalFields[i].type,
                        });
                    }
                    // If not present, it was deleted (skip)
                }
                // Add any truly new additional fields (those beyond the original length)
                for (let i = originalAdditionalFields.length; i < newAdditionalFields.length; i++) {
                    updatedAdditionalFields.push(newAdditionalFields[i]);
                }

                return {...prev, fields: [...existingFormFields, ...updatedAdditionalFields]};
            }

            return {...prev, fields: fields};
        });
    }, [isEdit, hasSubscriptions, originalAdditionalFields]);

    // Add state for new fields
    const [allowOnlinePayment, setAllowOnlinePayment] = React.useState(data.allow_online_payment || false);
    const [formProgrammedOpenTime, setFormProgrammedOpenTime] = React.useState(data.form_programmed_open_time || '');

    // When data changes (e.g. when opening modal), sync state
    React.useEffect(() => {
        setAllowOnlinePayment(data.allow_online_payment || false);
        setFormProgrammedOpenTime(data.form_programmed_open_time || '');
    }, [data]);

    // Organizers UI state and handlers
    const [newOrganizer, setNewOrganizer] = useState(null);

    // removed handleAddOrganizer; add on-select behavior instead
    const handleOrganizerSelect = (_, val) => {
        if (!val) {
            setNewOrganizer(null);
            return;
        }
        setData(prev => {
            const exists = prev.organizers?.some(o => o.profile === val.id);
            if (exists) return prev;
            const name = `${val.name}${val.surname ? ` ${val.surname}` : ''}`;
            return {
                ...prev,
                organizers: [...(prev.organizers || []), {profile: val.id, profile_name: name, is_lead: false}]
            };
        });
        // clear selection in the autocomplete after adding
        setNewOrganizer(null);
    };

    const handleToggleLeader = (idx) => (e) => {
        const val = e.target.checked;
        setData(prev => {
            const arr = [...(prev.organizers || [])];
            if (!arr[idx]) return prev;
            arr[idx] = {...arr[idx], is_lead: val};
            return {...prev, organizers: arr};
        });
    };

    const handleRemoveOrganizer = (idx) => () => {
        setData(prev => {
            const arr = [...(prev.organizers || [])];
            arr.splice(idx, 1);
            return {...prev, organizers: arr};
        });
    };

    return (
        <Modal open={open} onClose={handleClose}>
            <Box sx={style} component="form" onSubmit={handleSubmit} noValidate={false}>
                {isLoading ? <Loader/> : (<>
                    <Box sx={{display: 'flex', justifyContent: 'flex-end', mb: -2}}>
                        <IconButton onClick={() => onClose(false)} sx={{minWidth: 0}}><CloseIcon/></IconButton>
                    </Box>
                    <Typography variant="h5" gutterBottom sx={{mb: 2}} align="center">{title}</Typography>
                    {statusMessage && (<StatusBanner message={statusMessage.message} state={statusMessage.state}/>)}

                    {isEdit && hasSubscriptions && (
                        <Box sx={{mb: 2, p: 1, bgcolor: '#fff3e0', borderRadius: 1}}>
                            <Typography variant="body2" color="warning.main">
                                <InfoIcon fontSize="small" sx={{verticalAlign: 'middle', mr: 1}}/>
                                Alcuni campi non sono modificabili perché sono presenti iscrizioni. Rimuovile per
                                abilitare la modifica.<br/>
                            </Typography>
                        </Box>
                    )}

                    <Grid container spacing={2} sx={{mt: 4}}>
                        <Grid size={{xs: 12, md: 6}}>
                            <TextField
                                fullWidth
                                label={eventNames.name}
                                name="name"
                                value={data.name}
                                onChange={handleInputChange}
                                required
                                error={errors.name[0]}
                            />
                        </Grid>
                        <Grid size={{xs: 12, md: 6}}>
                            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='en-gb'>
                                <DatePicker
                                    label={eventNames.date}
                                    value={data.date}
                                    onChange={handleEventDateChange}
                                    slotProps={{textField: {variant: 'outlined'}}}
                                    required
                                    error={errors.date[0]}/>
                            </LocalizationProvider>
                        </Grid>
                        <Grid size={{xs: 12, md: 4}}>
                            <Tooltip
                                title={isEdit && hasSubscriptions ? "Non modificabile con iscrizioni esistenti" : ""}>
                                <span>
                                    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='en-gb'>
                                        <DateTimePicker
                                            label={eventNames.subscription_start_date}
                                            value={data.subscription_start_date || null}
                                            onChange={handleSubscriptionStartChange}
                                            minDate={isEdit ? null : dayjs()}
                                            slotProps={{
                                                textField: {
                                                    fullWidth: true,
                                                    required: true,
                                                }
                                            }}
                                            disabled={isEdit && hasSubscriptions}
                                            required
                                            error={errors.subscription_start_date[0]}
                                        />
                                    </LocalizationProvider>
                                </span>
                            </Tooltip>
                        </Grid>
                        <Grid size={{xs: 12, md: 4}}>
                            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='en-gb'>
                                <DateTimePicker
                                    label={eventNames.subscription_end_date}
                                    value={data.subscription_end_date || null}
                                    onChange={handleSubscriptionEndChange}
                                    minDate={dayjs().isAfter(data.subscription_start_date) ? dayjs() : data.subscription_start_date || dayjs()}
                                    slotProps={{textField: {fullWidth: true, required: true}}}
                                    required
                                    error={errors.subscription_start_date[0]}
                                />
                            </LocalizationProvider>
                        </Grid>
                        <Grid size={{xs: 12, md: 4}}>
                        </Grid>

                        <Grid size={{xs: 12, md: 3}}>
                            <Tooltip
                                title={isEdit && hasSubscriptions ? "Non modificabile con iscrizioni esistenti" : ""}>
                                <span>
                                    <TextField
                                        fullWidth
                                        label={eventNames.cost + " (decimali con punto)"}
                                        name="cost"
                                        type="number"
                                        slotProps={{htmlInput: {min: "0", step: "0.01"}}}
                                        value={data.cost ?? ""}
                                        onChange={handleInputChange}
                                        placeholder="Inserisci 0 se gratuito"
                                        required
                                        error={errors.cost[0]}
                                        disabled={isEdit && hasSubscriptions}
                                    />
                                </span>
                            </Tooltip>
                        </Grid>
                        <Grid size={{xs: 12, md: 3}}>
                            <Tooltip
                                title={isEdit && hasSubscriptions ? "Non modificabile con iscrizioni esistenti" : ""}>
                                <span>
                                    <TextField
                                        fullWidth
                                        label={eventNames.deposit + " (decimali con punto)"}
                                        name="deposit"
                                        type="number"
                                        slotProps={{htmlInput: {min: "0", step: "0.01"}}}
                                        value={data.deposit ?? ""}
                                        onChange={handleInputChange}
                                        error={errors.deposit && errors.deposit[0]}
                                        disabled={isEdit && hasSubscriptions}
                                    />
                                </span>
                            </Tooltip>
                        </Grid>
                    </Grid>

                    <Grid size={{xs: 12}} data-color-mode="light" sx={{mt: 2}}>
                        <Typography variant="h6" component="div" sx={{mb: 1}}>{eventNames.description}</Typography>
                        <CustomEditor
                            value={data.description}
                            onChange={(value) => {
                                setData(prev => ({...prev, description: value}));
                            }}
                        />
                    </Grid>

                    {/* --- Move all toggles here --- */}
                    <Grid container spacing={2} sx={{mt: 2, mb: 2}}>
                        <Grid size={{xs: 12, md: 3}}>
                            <FormControlLabel
                                label="Evento A Bando"
                                control={
                                    <Switch
                                        checked={!!data.is_a_bando}
                                        onChange={handleInputChange}
                                        name="is_a_bando"
                                        color="primary"
                                    />
                                }
                            />
                        </Grid>
                        <Grid size={{xs: 12, md: 3}}>
                            <FormControlLabel
                                label="Consenti iscrizione esterni"
                                control={
                                    <Switch
                                        checked={!!data.is_allow_external}
                                        onChange={handleInputChange}
                                        name="is_allow_external"
                                        color="primary"
                                    />
                                }
                            />
                        </Grid>
                    </Grid>
                    {/* --- End toggles section --- */}

                    {/* --- Organizzatori section --- */}
                    <Grid container spacing={2} alignItems="center" sx={{display: 'flex', mt: 2, mb: 1}}>
                        <Typography variant="h6">Organizzatori</Typography>
                        {/* removed AddIcon button beside title */}
                    </Grid>

                    <Grid container spacing={2} alignItems="center" sx={{mt: 1}}>
                        <Grid size={{xs: 12, md: 4}}>
                            <ProfileSearch
                                value={newOrganizer}
                                onChange={handleOrganizerSelect}
                                label="Cerca ESNer"
                                esner_only={true}
                                valid_only={true}
                            />
                        </Grid>
                    </Grid>

                    {(data.organizers && data.organizers.length > 0) && (
                        <Grid container spacing={2} sx={{mt: 1}}>
                            {data.organizers.map((org, idx) => (
                                <Grid size={{xs: 6}} key={`${org.profile}-${idx}`}>
                                    <Box
                                        sx={{
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            borderRadius: 1,
                                            p: 1.5,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 2,
                                            justifyContent: 'space-between'
                                        }}
                                    >
                                        <Typography sx={{flex: 1}}>{org.profile_name || `ID ${org.profile}`}</Typography>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={!!org.is_lead}
                                                    onChange={handleToggleLeader(idx)}
                                                    color="primary"
                                                />
                                            }
                                            label="Leader"
                                            sx={{mr: 1}}
                                        />
                                        <IconButton onClick={handleRemoveOrganizer(idx)} title="Rimuovi">
                                            <DeleteIcon/>
                                        </IconButton>
                                    </Box>
                                </Grid>
                            ))}
                        </Grid>
                    )}
                    {/* --- End Organizzatori section --- */}

                    <Grid container spacing={2} alignItems="center" sx={{display: 'flex', mt: 2}}>
                        <Typography variant="h6">Liste</Typography>
                        <IconButton title="Aggiungi Lista" onClick={handleAddList} sx={{ml: -2}}><AddIcon/></IconButton>
                    </Grid>
                    {data.lists.map((list, index) => (
                        <Grid container spacing={2} alignItems="center" sx={{mt: 2}} key={index}>
                            <Grid>
                                <TextField
                                    label={eventNames.list_name}
                                    name="name"
                                    value={list.name}
                                    onChange={(e) => handleListChange(index, e)}
                                    required
                                    error={errors.listItems[index]?.name}
                                    helperText={errors.listItems[index]?.name ? "Il nome è obbligatorio" : ""}
                                />
                            </Grid>
                            <Grid>
                                <TextField
                                    label={eventNames.list_capacity}
                                    name="capacity"
                                    type="number"
                                    value={list.capacity}
                                    slotProps={{htmlInput: {min: "0", step: "1"}}}
                                    onChange={(e) => handleListChange(index, e)}
                                    placeholder="Inserisci 0 se illimitata"
                                    required
                                    error={errors.listItems[index]?.capacity}
                                    helperText={errors.listItems[index]?.capacity ? "La capacità è obbligatoria" : ""}
                                />
                            </Grid>
                            <Grid>
                                <FormControl component="fieldset">
                                    <FormLabel component="legend" sx={{fontSize: '0.9rem'}}>Tipo</FormLabel>
                                    <RadioGroup
                                        row
                                        value={
                                            list.is_main_list
                                                ? 'main'
                                                : list.is_waiting_list
                                                    ? 'waiting'
                                                    : 'none'
                                        }
                                        onChange={(e) => handleListTypeChange(index, e.target.value)}
                                    >
                                        <FormControlLabel
                                            value="main"
                                            control={<Radio />}
                                            label="Main List"
                                            disabled={data.lists.some((l, i) => l.is_main_list && i !== index)}
                                        />
                                        <FormControlLabel
                                            value="waiting"
                                            control={<Radio />}
                                            label="Waiting List"
                                            disabled={data.lists.some((l, i) => l.is_waiting_list && i !== index)}
                                        />
                                        <FormControlLabel
                                            value="none"
                                            control={<Radio />}
                                            label="Altro"
                                        />
                                    </RadioGroup>
                                </FormControl>
                            </Grid>
                            <Grid size={{xs: 2}}>
                                <IconButton onClick={() => handleDeleteList(index)}><DeleteIcon/></IconButton>
                            </Grid>
                        </Grid>
                    ))}

                    <Grid size={{xs: 12, md: 4}} sx={{mt: 3}}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={!!data.enable_form}
                                    onChange={(e) => {
                                        if (formFieldsDisabled) return;
                                        setData({...data, enable_form: e.target.checked})
                                    }}
                                    name="enable_form"
                                    color="primary"
                                    disabled={formFieldsDisabled}
                                />
                            }
                            label="Abilita Form Iscrizioni"
                        />
                    </Grid>

                    {/* Unified EventModalForm */}
                    {data.enable_form && (
                        <EventModalForm
                            profile_fields={data.profile_fields || []}
                            setProfileFields={handleSetProfileFields}
                            fields={data.fields || []}
                            setFields={handleSetFields}
                            formFieldsDisabled={formFieldsDisabled}
                            additionalFieldsDisabled={false}
                            hasSubscriptions={hasSubscriptions}
                            isEdit={isEdit}
                            originalAdditionalFields={originalAdditionalFields}
                            allow_online_payment={allowOnlinePayment}
                            setAllowOnlinePayment={setAllowOnlinePayment}
                            form_programmed_open_time={formProgrammedOpenTime}
                            setFormProgrammedOpenTime={setFormProgrammedOpenTime}
                        />
                    )}

                    <Box mt={2} sx={{display: 'flex', gap: 2}}>
                        <Button variant="contained" color="primary" type="submit" disabled={submitting}>
                            {submitting ? (
                                <CircularProgress size={24} color="inherit"/>) : (isEdit ? 'Salva Modifiche' : 'Crea')}
                        </Button>
                        {isEdit && (
                            <Button variant="outlined"
                                    color="error"
                                    startIcon={<DeleteIcon/>}
                                    onClick={() => setConfirmOpen(true)}
                                    disabled={deleting || hasSubscriptions}>
                                {deleting ? <CircularProgress size={20} color="inherit"/> : "Elimina Evento"}
                            </Button>
                        )}
                    </Box>
                    {popup && <Popup key={popup.id} message={popup.message} state={popup.state}/>}
                    <ConfirmDialog
                        open={confirmOpen}
                        message="Sei sicuro di voler eliminare questo evento? L'operazione è irreversibile."
                        onConfirm={handleDelete}
                        onClose={() => setConfirmOpen(false)}
                    />
                </>)}
            </Box>
        </Modal>

    );
}
