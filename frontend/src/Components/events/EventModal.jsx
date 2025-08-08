import React, {useEffect, useState} from 'react';
import {Modal, Box, TextField, Button, IconButton, Typography, Tooltip, Grid, CircularProgress, FormControlLabel, Switch} from '@mui/material';
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

export default function EventModal({open, event, isEdit, onClose}) {
    const [isLoading, setLoading] = useState(true);
    const title = isEdit ? 'Modifica Evento - ' + event.name : 'Crea Evento';
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
        is_allow_external: false
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

    useEffect(() => {
        if (isEdit) {
            setData(event);
            setHasSubscriptions(event.subscriptions.length > 0)
        }
        setLoading(false);
    }, []);

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
        return ({
            name: data.name,
            date: formatDateString(data.date),
            description: data.description,
            subscription_start_date: formatDateTimeString(data.subscription_start_date),
            subscription_end_date: formatDateTimeString(data.subscription_end_date),
            cost: Number(data.cost).toFixed(2),
            deposit: Number(data.deposit).toFixed(2),
            lists: data.lists.map(t => ({
                id: t.id,
                name: t.name,
                capacity: Math.floor(Number(t.capacity))
            })),
            is_a_bando: !!data.is_a_bando,
            is_allow_external: !!data.is_allow_external
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
            setPopup({message: 'Errore campi Liste', state: 'error', id: Date.now()});
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
                    scrollUp();
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

    /*
    const profileFieldOptions = ['name', 'surname', 'email', 'phone', 'whatsapp', 'birthdate', 'latest_esncard', 'latest_document', 'matricola_number', 'matricola_expiration', 'person_code', 'domicile'];

    const handleProfileFieldChange = (event) => {
        const {value} = event.target;
        setData({
            ...data,
            profileFields: value,
        });
    };

    const handleAddField = (fieldType) => {
        setData({
            ...data,
            [fieldType]: [...data[fieldType], {name: '', edilistByOffice: false, visibleByOffice: false, type: '', choices: [], length: ''}],
        });
    };

    const handleFieldChange = (fieldType, index, event) => {
        const {name, value, type, checked} = event.target;
        const updatedFields = data[fieldType].map((field, i) =>
            i === index ? {...field, [name]: type === 'checkbox' ? checked : value} : field
        );
        setData({...data, [fieldType]: updatedFields});
    };

    const handleDeleteField = (fieldType, index) => {
        setData({
            ...data,
            [fieldType]: data[fieldType].filter((_, i) => i !== index),
        });
    };

    const handleAddChoice = (fieldType, index) => {
        const updatedFields = data[fieldType].map((field, i) =>
            i === index ? {...field, choices: [...field.choices, {value: '', color: '#FFFFFF'}]} : field
        );
        setData({...data, [fieldType]: updatedFields});
    };

    const handleChoiceChange = (fieldType, fieldIndex, choiceIndex, event) => {
        const {name, value} = event.target;
        const updatedFields = data[fieldType].map((field, i) => {
            if (i === fieldIndex) {
                const updatedChoices = field.choices.map((choice, j) =>
                    j === choiceIndex ? {...choice, [name]: value} : choice
                );
                return {...field, choices: updatedChoices};
            }
            return field;
        });
        setData({...data, [fieldType]: updatedFields});
    };

    const handleColorChange = (fieldType, fieldIndex, choiceIndex, event) => {
        const {value} = event.target;
        const updatedFields = data[fieldType].map((field, i) => {
            if (i === fieldIndex) {
                const updatedChoices = field.choices.map((choice, j) =>
                    j === choiceIndex ? {...choice, color: value} : choice
                );
                return {...field, choices: updatedChoices};
            }
            return field;
        });
        setData({...data, [fieldType]: updatedFields});
    };
    */

    return (
        <Modal open={open} onClose={handleClose}>
            <Box sx={style} component="form" onSubmit={handleSubmit} noValidate={false}>
                {isLoading ? <Loader/> : (<>
                    <Box sx={{display: 'flex', justifyContent: 'flex-end', mb: -2}}>
                        <IconButton onClick={() => onClose(false)} sx={{minWidth: 0}}><CloseIcon/></IconButton>
                    </Box>
                    <Typography variant="h5" gutterBottom sx={{mb: 2}} align="center">{title}</Typography>

                    {isEdit && hasSubscriptions && (
                        <Box sx={{mb: 2, p: 1, bgcolor: '#fff3e0', borderRadius: 1}}>
                            <Typography variant="body2" color="warning.main">
                                <InfoIcon fontSize="small" sx={{verticalAlign: 'middle', mr: 1}}/>
                                Alcuni campi non sono modificabili perché ci sono già iscrizioni. Rimuovi tutte le iscrizioni per abilitare la modifica.
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
                            <Tooltip title={isEdit && hasSubscriptions ? "Non modificabile con iscrizioni esistenti" : ""}>
                                <div>
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
                                </div>
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
                            <FormControlLabel
                                label="Evento A Bando"
                                labelPlacement="start"
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

                        <Grid size={{xs: 12, md: 4}}>
                            <Tooltip title={isEdit && hasSubscriptions ? "Non modificabile con iscrizioni esistenti" : ""}>
                                <div>
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
                                </div>
                            </Tooltip>
                        </Grid>
                        <Grid size={{xs: 12, md: 4}}>
                            <Tooltip title={isEdit && hasSubscriptions ? "Non modificabile con iscrizioni esistenti" : ""}>
                                <div>
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
                                </div>
                            </Tooltip>
                        </Grid>
                        <Grid size={{xs: 12, md: 4}}>
                            <FormControlLabel
                                label="Consenti iscrizione esterni"
                                labelPlacement="start"
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
                    <Grid size={{xs: 12}} data-color-mode="light" sx={{mt: 2}}>
                        <Typography variant="h6" component="div" sx={{mb: 1}}>{eventNames.description}</Typography>
                        <CustomEditor
                            value={data.description}
                            onChange={(value) => {
                                setData(prev => ({...prev, description: value}));
                            }}
                        />
                    </Grid>

                    <Box my={2}>
                        <Grid container spacing={2} alignItems="center" sx={{display: 'flex', mb: 1}}>
                            <Typography variant="h6">Liste</Typography>
                            <IconButton onClick={handleAddList} sx={{ml: -1}}><AddIcon/></IconButton>
                        </Grid>
                        {data.lists.map((list, index) => (
                            <Grid container spacing={2} alignItems="center" mb={2} key={index}>
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
                                <Grid size={{xs: 2}}><IconButton onClick={() => handleDeleteList(index)}><DeleteIcon/></IconButton></Grid>
                            </Grid>
                        ))}
                    </Box>

                    {/* Insert *1 */}
                    {/* Insert *2 */}
                    {/* Insert *3 */}

                    <Box mt={2} sx={{display: 'flex', gap: 2}}>
                        <Button variant="contained" color="primary" type="submit" disabled={submitting}>
                            {submitting ? (<CircularProgress size={24} color="inherit"/>) : (isEdit ? 'Salva Modifiche' : 'Crea')}
                        </Button>
                        {isEdit && !hasSubscriptions && (
                            <Button variant="outlined"
                                    color="error"
                                    startIcon={<DeleteIcon/>}
                                    onClick={() => setConfirmOpen(true)}
                                    disabled={deleting}>
                                {deleting ? <CircularProgress size={20} color="inherit"/> : "Elimina"}
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