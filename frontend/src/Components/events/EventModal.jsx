import React, {useEffect, useState} from 'react';
import {Modal, Box, TextField, Button, IconButton, Typography, Tooltip, Grid} from '@mui/material';
import {LocalizationProvider, DatePicker, DateTimePicker} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import {Add as AddIcon, Delete as DeleteIcon, Info as InfoIcon} from '@mui/icons-material';
import {fetchCustom} from "../../api/api";
import {style, colorOptions} from '../../utils/sharedStyles'
import {eventDisplayNames as eventNames} from '../../utils/displayAttributes';
import CustomEditor from '../CustomEditor';
import Loader from "../Loader";
import StatusBanner from "../StatusBanner";
import {extractErrorMessage} from "../../utils/errorHandling";
import CloseIcon from '@mui/icons-material/Close';


export default function EventModal({open, event, isEdit, onClose}) {
    const [isLoading, setLoading] = useState(true);
    const title = isEdit ? 'Modifica Evento - ' + event.name : 'Crea Evento';
    const [statusMessage, setStatusMessage] = useState(null);
    const [hasSubscriptions, setHasSubscriptions] = useState(false);

    const [data, setData] = useState({
        id: '',
        name: '',
        date: dayjs(),
        description: '<h3>Descrizione</h3>' +
            '    <p>Ecco un <a href="https://www.italia.it" target="_blank">link all\'Italia</a>.</p>' +
            '    <blockquote>Citazione elegante.</blockquote>' +
            '    <p style="text-align: center;">Adios.</p>',
        cost: '',
        subscription_start_date: dayjs().hour(12).minute(0),
        subscription_end_date: dayjs().hour(24).minute(0),
        lists: [{id: '', name: 'Main List', capacity: ''}]
    });

    const [errors, setErrors] = React.useState({
        name: [false, ''],
        date: [false, ''],
        description: [false, ''],
        cost: [false, ''],
        subscription_start_date: [false, ''],
        subscription_end_date: [false, ''],
        lists: [false, ''],
        listItems: []
    });

    useEffect(() => {
        if (isEdit) {
            console.log("Setting form data: ", event);
            setData(event);
            console.log("#Subsciptions: ", event.subscriptions.length);
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
        // Only allow dates from today onward
        if (date && dayjs(date).isBefore(dayjs(), 'day')) return;
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
            lists: data.lists.map(t => ({
                id: t.id,
                name: t.name,
                capacity: Math.floor(Number(t.capacity))
            }))
            /*enable_form: data.enableForm,
            profile_fields: data.profileFields,
            additional_fields: Object.fromEntries(data.additionalFields.map((f) => {
                switch (f.type) {
                    case 'text':
                        return ['t_' + f.name, {
                            office_edit: f.edilistByOffice,
                            office_view: f.visibleByOffice,
                            length: f.length // Add length here
                        }]
                    case 'integer':
                        return ['i_' + f.name, {
                            office_edit: f.edilistByOffice,
                            office_view: f.visibleByOffice
                        }]
                    case 'float':
                        return ['f_' + f.name, {
                            office_edit: f.edilistByOffice,
                            office_view: f.visibleByOffice
                        }]
                    case 'single choice':
                        return ['c_' + f.name, {
                            office_edit: f.edilistByOffice,
                            office_view: f.visibleByOffice,
                            choices: Object.fromEntries(f.choices.map((c) => {
                                return [c.value, c.color]
                            }))
                        }]
                    case 'multiple choice':
                        return ['m_' + f.name, {
                            office_edit: f.edilistByOffice,
                            office_view: f.visibleByOffice,
                            choices: Object.fromEntries(f.choices.map((c) => {
                                return [c.value, c.color]
                            }))
                        }]
                }
            }))*/
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

    const handleSubmit = async (e) => {
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

        try {
            const response = isEdit
                ? await fetchCustom("PATCH", `/event/${data.id}/`, convert(data))
                : await fetchCustom("POST", '/event/', convert(data));
            if (!response.ok) {
                const errorMessage = await extractErrorMessage(response);
                setStatusMessage({message: `Errore ${isEdit ? 'modifica' : 'creazione'} evento: ${errorMessage}`, state: 'error'});
                scrollUp();
            } else onClose(true);
        } catch (error) {
            console.error("Error creating/updating event:", error);
            const errorMessage = await extractErrorMessage(error);
            setStatusMessage({message: `Errore generale: ${errorMessage}`, state: "error"});
            scrollUp();
        }
    }

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
                    {statusMessage && (<StatusBanner message={statusMessage.message} state={statusMessage.state}/>)}

                    {isEdit && hasSubscriptions && (
                        <Box sx={{mb: 2, p: 1, bgcolor: '#fff3e0', borderRadius: 1}}>
                            <Typography variant="body2" color="warning.main">
                                <InfoIcon fontSize="small" sx={{verticalAlign: 'middle', mr: 1}}/>
                                Alcuni campi non sono modificabili perché ci sono già iscrizioni. Rimuovi tutte le iscrizioni per abilitare la modifica.
                            </Typography>
                        </Box>
                    )}

                    <Grid container spacing={2}>
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
                                    minDate={isEdit ? null : dayjs()}
                                    renderInput={(params) => <TextField {...params} fullWidth required/>}
                                    required
                                    error={errors.date[0]}
                                />
                            </LocalizationProvider>
                        </Grid>
                        <Grid size={{xs: 12, md: 3}}>
                            <Tooltip title={isEdit && hasSubscriptions ? "Non modificabile con iscrizioni esistenti" : ""}>
                                <div> {/* Wrapper div needed for Tooltip to work with disabled elements */}
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
                        <Grid size={{xs: 12, md: 3}}>
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
                        <Grid size={{xs: 12, md: 3}}>
                            <Tooltip title={isEdit && hasSubscriptions ? "Non modificabile con iscrizioni esistenti" : ""}>
                                <div> {/* Wrapper div needed for Tooltip to work with disabled elements */}
                                    <TextField
                                        fullWidth
                                        label={eventNames.cost}
                                        name="cost"
                                        type="number"
                                        slotProps={{htmlInput: {min: "0", step: "0.01"}}}
                                        value={data.cost}
                                        onChange={handleInputChange}
                                        placeholder="Inserisci 0 se gratuito"
                                        required
                                        error={errors.cost[0]}
                                        disabled={isEdit && hasSubscriptions}
                                    />
                                </div>
                            </Tooltip>
                        </Grid>
                    </Grid>
                    <Grid size={{xs: 12}} data-color-mode="light">
                        <Typography variant="h6" component="div">{eventNames.description}</Typography>
                        <CustomEditor
                            value={data.description}
                            onChange={(value) => {
                                setData({...data, description: value});
                            }}
                        />
                    </Grid>

                    <Box my={2}>
                        <Grid container spacing={2} alignItems="center">
                            <Grid><Typography variant="h6" gutterBottom>Liste</Typography></Grid>
                            <Grid><IconButton onClick={handleAddList}><AddIcon/></IconButton></Grid>
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

                    <Box mt={2}>
                        <Button variant="contained" color="primary" type="submit">{isEdit ? 'Salva Modifiche' : 'Crea'}</Button>
                    </Box>
                </>)}
            </Box>
        </Modal>

    );
}
// *1
/*<FormControlLabel
    control={<Switch
        checked={data.enableForm}
        onChange={handleInputChange}
        name="enableForm"
        color="primary"
    />}
    label="Attiva Form"
/>*/

// *2
/*<Box my={2}>
    <Grid container spacing={2}>
        <Grid size={{xs: 12, md: 6}}>
            <Typography variant="h6" gutterBottom>Campi Profilo</Typography>
            <FormControl sx={{minWidth: '100%'}}>
                <Select
                    variant="outlined"
                    multiple
                    value={data.profileFields}
                    onChange={handleProfileFieldChange}
                    renderValue={(selected) => selected.join(', ')}
                >
                    {profileFieldOptions.map((option) => (
                        <MenuItem key={option} value={option}>
                            <Checkbox checked={data.profileFields.indexOf(option) > -1}/>
                            {names[option]}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
        </Grid>
    </Grid>
</Box>*/

// *3
/*{
    ['additionalFields', 'formFields'].map((fieldType) => (
        <Box my={2} key={fieldType}>
            <Grid container spacing={2} alignItems="center">
                <Grid size={{xs: 6}}>
                    <Typography variant="h6" gutterBottom>
                        {fieldType === 'additionalFields' ? 'Campi Aggiuntivi' : 'Campi Form'}
                    </Typography>
                </Grid>
                <Grid size={{xs: 6}} textAlign="right">
                    <IconButton onClick={() => handleAddField(fieldType)}><AddIcon/></IconButton>
                </Grid>
            </Grid>
            {data[fieldType].map((field, index) => (
                <Paper key={index} sx={{p: 2, mb: 1}}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid size={{xs: 4}}>
                            <TextField
                                fullWidth
                                label="Nome campo"
                                name="name"
                                value={field.name}
                                onChange={(e) => handleFieldChange(fieldType, index, e)}
                            />
                        </Grid>
                        <Grid size={{xs: 2}}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={field.edilistByOffice}
                                        onChange={(e) => handleFieldChange(fieldType, index, e)}
                                        name="edilistByOffice"
                                    />
                                }
                                label="Editabile"
                            />
                        </Grid>
                        <Grid size={{xs: 2}}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={field.visibleByOffice}
                                        onChange={(e) => handleFieldChange(fieldType, index, e)}
                                        name="visibleByOffice"
                                    />
                                }
                                label="Visibile"
                            />
                        </Grid>
                        <Grid size={{xs: 3}}>
                            <FormControl fullWidth>
                                <InputLabel>Formato</InputLabel>
                                <Select
                                    variant="outlined"
                                    name="type"
                                    label="Formato"
                                    value={field.type}
                                    onChange={(e) => handleFieldChange(fieldType, index, e)}
                                >
                                    <MenuItem value="text">Testo</MenuItem>
                                    <MenuItem value="integer">Numerico Intero</MenuItem>
                                    <MenuItem value="float">Numerico Decimale</MenuItem>
                                    <MenuItem value="single choice">Scelta Singola</MenuItem>
                                    <MenuItem value="multiple choice">Scelta Multipla</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid size={{xs: 1}}>
                            <IconButton onClick={() => handleDeleteField(fieldType, index)}>
                                <DeleteIcon/>
                            </IconButton>
                        </Grid>
                    </Grid>
                    {field.type === 'text' && (
                        <Grid container spacing={2} alignItems="center">
                            <Grid size={{xs: 4}}>
                                <TextField
                                    fullWidth
                                    label="Lunghezza"
                                    name="length"
                                    value={field.length}
                                    onChange={(e) => handleFieldChange(fieldType, index, e)}
                                    type="number"
                                />
                            </Grid>
                        </Grid>
                    )}
                    {(field.type === 'single choice' || field.type === 'multiple choice') && (
                        <Box mt={2} ml={2}>
                            <Grid container spacing={2}>
                                <Grid size={{xs: 12}}>
                                    <Button onClick={() => handleAddChoice(fieldType, index)}>Aggiungi Scelta</Button>
                                </Grid>
                                {field.choices.map((choice, choiceIndex) => (
                                    <Grid container spacing={2} key={choiceIndex} alignItems="center">
                                        <Grid size={{xs: 5}}>
                                            <TextField
                                                fullWidth
                                                label="Valore"
                                                name="value"
                                                value={choice.value}
                                                onChange={(e) => handleChoiceChange(fieldType, index, choiceIndex, e)}
                                            />
                                        </Grid>
                                        <Grid size={{xs: 5}}>
                                            <FormControl fullWidth>
                                                <InputLabel>Colore</InputLabel>
                                                <Select
                                                    variant="outlined"
                                                    name="color"
                                                    label="Colore"
                                                    value={choice.color}
                                                    onChange={(e) => handleColorChange(fieldType, index, choiceIndex, e)}
                                                >
                                                    {colorOptions.map((option) => (
                                                        <MenuItem key={option.value} value={option.value}>
                                                            <div style={{backgroundColor: option.value, width: 20, height: 20, display: 'inline-block', marginRight: 8}}></div>
                                                            {option.label}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                    </Grid>
                                ))}
                            </Grid>
                        </Box>
                    )}
                </Paper>
            ))}
        </Box>
    ))
}*/

