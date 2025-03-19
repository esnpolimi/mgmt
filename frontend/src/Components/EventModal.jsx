import React, {useEffect, useState} from 'react';
import {
    Modal, Box, TextField, FormControlLabel, Switch, Button, Checkbox, FormControl,
    InputLabel, Select, MenuItem, IconButton, Paper, Typography
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {LocalizationProvider, DatePicker, DateTimePicker} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import {Add as AddIcon, Delete as DeleteIcon} from '@mui/icons-material';
import {fetchCustom} from "../api/api";
import {style, colorOptions} from '../utils/sharedStyles'
import {eventDisplayNames as eventNames} from '../utils/displayAttributes';
import CustomEditor from './CustomEditor';
import Loader from "./Loader";

export default function EventModal({open, handleClose, event, isEdit}) {
    const [isLoading, setLoading] = useState(true);

    const [data, setData] = useState({
        id: '',
        name: '',
        date: dayjs(),
        description: '<h3>Descrizione</h3>' +
            '    <p>Ecco un <a href="https://www.italia.it" target="_blank">link all\'Italia</a>.</p>' +
            '    <blockquote>Citazione elegante.</blockquote>' +
            '    <p style="text-align: center;">Divertiti!</p>',
        cost: '',
        subscription_start_date: dayjs().hour(12).minute(0),
        subscription_end_date: dayjs().hour(24).minute(0),
        tables: []
    });

    useEffect(() => {
        if (isEdit) {
            setData(event);
            console.log("Set form data: ", event);
        }
        setLoading(false);
    }, []);

    const formatDateString = (date) => {
        return dayjs(date).format('YYYY-MM-DD HH:mm:ss');
    };

    const handleEventDateChange = (date) => {
        // Only allow dates from today onward
        if (date && dayjs(date).isBefore(dayjs(), 'day')) return;
        setData({...data, date: date});
    };

    const handleSubscriptionStartChange = (date) => {
        // Only allow dates from today onward
        if (date && dayjs(date).isBefore(dayjs(), 'day')) return;

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
        // Only allow dates and times after start date and time
        if (date && data.subscription_start_date) {
            const startDateTime = dayjs(data.subscription_start_date);
            const endDateTime = dayjs(date);
            if (endDateTime.isBefore(startDateTime)) date = startDateTime;
        }
        setData({...data, subscription_end_date: date});
    };

    const convert = (data) => {
        return ({
            name: data.name,
            date: formatDateString(data.date),
            description: data.description,
            enable_form: data.enableForm,
            tables: Object.fromEntries(data.tables.map((t) => [t.name, t.capacity])),
            profile_fields: data.profileFields,
            additional_fields: Object.fromEntries(data.additionalFields.map((f) => {
                switch (f.type) {
                    case 'text':
                        return ['t_' + f.name, {
                            office_edit: f.editableByOffice,
                            office_view: f.visibleByOffice,
                            length: f.length // Add length here
                        }]
                    case 'integer':
                        return ['i_' + f.name, {
                            office_edit: f.editableByOffice,
                            office_view: f.visibleByOffice
                        }]
                    case 'float':
                        return ['f_' + f.name, {
                            office_edit: f.editableByOffice,
                            office_view: f.visibleByOffice
                        }]
                    case 'single choice':
                        return ['c_' + f.name, {
                            office_edit: f.editableByOffice,
                            office_view: f.visibleByOffice,
                            choices: Object.fromEntries(f.choices.map((c) => {
                                return [c.value, c.color]
                            }))
                        }]
                    case 'multiple choice':
                        return ['m_' + f.name, {
                            office_edit: f.editableByOffice,
                            office_view: f.visibleByOffice,
                            choices: Object.fromEntries(f.choices.map((c) => {
                                return [c.value, c.color]
                            }))
                        }]
                }
            }))
        })
    }

    const handleInputChange = (event) => {
        const {name, value, type, checked} = event.target;
        setData({
            ...data,
            [name]: type === 'checkbox' ? checked : value,
        });
    };

    const handleAddTable = () => {
        setData({
            ...data,
            tables: [...data.tables, {name: '', capacity: ''}],
        });
    };

    const handleTableChange = (index, event) => {
        const {name, value} = event.target;
        const updatedTables = data.tables.map((table, i) =>
            i === index ? {...table, [name]: value} : table
        );
        setData({...data, tables: updatedTables});
    };

    const handleDeleteTable = (index) => {
        setData({
            ...data,
            tables: data.tables.filter((_, i) => i !== index),
        });
    };

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
            [fieldType]: [...data[fieldType], {name: '', editableByOffice: false, visibleByOffice: false, type: '', choices: [], length: ''}],
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
            <Box sx={style}>
                {isLoading ? <Loader/> : (<>
                    <Typography variant="h5" gutterBottom align="center">Nuovo Evento</Typography>
                    <Grid container spacing={2}>
                        <Grid size={{xs: 12, md: 6}}>
                            <TextField
                                fullWidth
                                label={eventNames.name}
                                name="name"
                                value={data.name}
                                onChange={handleInputChange}
                            />
                        </Grid>
                        <Grid size={{xs: 12, md: 6}}>
                            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='en-gb'>
                                <DatePicker
                                    label={eventNames.date}
                                    value={data.date}
                                    onChange={handleEventDateChange}
                                    minDate={dayjs()}
                                    renderInput={(params) => <TextField {...params} fullWidth required/>}
                                />
                            </LocalizationProvider>
                        </Grid>
                        <Grid size={{xs: 12, md: 3}}>
                            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='en-gb'>
                                <DateTimePicker
                                    label={eventNames.subscription_start_date}
                                    value={data.subscription_start_date || null}
                                    onChange={handleSubscriptionStartChange}
                                    minDate={dayjs()}
                                    slotProps={{textField: {fullWidth: true, required: true}}}
                                />
                            </LocalizationProvider>
                        </Grid>
                        <Grid size={{xs: 12, md: 3}}>
                            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='en-gb'>
                                <DateTimePicker
                                    label={eventNames.subscription_end_date}
                                    value={data.subscription_end_date || null}
                                    onChange={handleSubscriptionEndChange}
                                    minDate={data.subscription_start_date || dayjs()}
                                    slotProps={{textField: {fullWidth: true, required: true}}}
                                />
                            </LocalizationProvider>
                        </Grid>
                        <Grid size={{xs: 12, md: 3}}>
                            <TextField
                                fullWidth
                                label={eventNames.cost}
                                name="cost"
                                type="number"
                                slotProps={{htmlInput: {min: "0", step: "0.01"}}}
                                value={data.cost}
                                onChange={handleInputChange}
                                placeholder="Inserisci 0 se gratuito"
                            />
                        </Grid>
                    </Grid>
                    <Grid size={{xs: 12}} data-color-mode="light">
                        <Typography variant="h6" component="div">{eventNames.description}</Typography>
                        <CustomEditor
                            value={data.description}
                            onChange={(value) => {console.log(value);setData({...data, description: value});}}
                        />
                    </Grid>

                    {/* Insert *1 */}

                    <Box my={2}>
                        <Grid container spacing={2} alignItems="center">
                            <Grid><Typography variant="h6" gutterBottom>Liste</Typography></Grid>
                            <Grid><IconButton onClick={handleAddTable}><AddIcon/></IconButton></Grid>
                        </Grid>
                        {data.tables.map((table, index) => (
                            <Grid container spacing={2} alignItems="center" mb={2} key={index}>
                                <Grid>
                                    <TextField
                                        label="Nome"
                                        name="name"
                                        value={table.name}
                                        onChange={(e) => handleTableChange(index, e)}
                                    />
                                </Grid>
                                <Grid>
                                    <TextField
                                        label="Capacità"
                                        name="capacity"
                                        type="number"
                                        value={table.capacity}
                                        onChange={(e) => handleTableChange(index, e)}
                                    />
                                </Grid>
                                <Grid size={{xs: 2}}><IconButton onClick={() => handleDeleteTable(index)}><DeleteIcon/></IconButton></Grid>
                            </Grid>
                        ))}
                    </Box>

                    {/* Insert *2 */}
                    {/* Insert *3 */}

                    <Box mt={2}>
                        <Button variant="contained" color="grey" onClick={handleClose}>Chiudi</Button>
                        <Button variant="contained" color="primary"
                                onClick={() => {
                                    fetchCustom("POST", '/event/', convert(data)).then()
                                }}>
                            Crea
                        </Button>
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
                                        checked={field.editableByOffice}
                                        onChange={(e) => handleFieldChange(fieldType, index, e)}
                                        name="editableByOffice"
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
