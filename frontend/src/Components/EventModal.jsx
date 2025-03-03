import React, {useState} from 'react';
import {
    Modal, Box, TextField, FormControlLabel, Switch, Button, Checkbox, FormControl,
    InputLabel, Select, MenuItem, IconButton, Paper, Typography
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {LocalizationProvider, DatePicker} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import {Add as AddIcon, Delete as DeleteIcon} from '@mui/icons-material';
import {fetchCustom} from "../api/api";
import {style, colorOptions} from '../utils/sharedStyles'
import {profileDisplayNames as names} from '../utils/displayAttributes';


export default function FormModal({open, handleClose}) {
    const [formData, setFormData] = useState({
        name: '',
        date: dayjs(),
        description: '',
        enableForm: false,
        tables: [],
        profileFields: [],
        additionalFields: [],
        formFields: []
    });

    const formatDateString = (date) => {
        return dayjs(date).format('YYYY-MM-DD');
    };

    const handleDateChange = (name, date) => {
        setFormData({
            ...formData,
            [name]: date,
        });
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

    const profileFieldOptions = ['name', 'surname', 'email', 'phone', 'whatsapp', 'gender', 'birthdate', 'latest_esncard', 'latest_document', 'matricola-number', 'matricola-expiration', 'person_code', 'domicile', 'residency'];

    const handleInputChange = (event) => {
        const {name, value, type, checked} = event.target;
        setFormData({
            ...formData,
            [name]: type === 'checkbox' ? checked : value,
        });
    };

    const handleProfileFieldChange = (event) => {
        const {value} = event.target;
        setFormData({
            ...formData,
            profileFields: value,
        });
    };

    const handleAddTable = () => {
        setFormData({
            ...formData,
            tables: [...formData.tables, {name: '', capacity: ''}],
        });
    };

    const handleTableChange = (index, event) => {
        const {name, value} = event.target;
        const updatedTables = formData.tables.map((table, i) =>
            i === index ? {...table, [name]: value} : table
        );
        setFormData({...formData, tables: updatedTables});
    };

    const handleDeleteTable = (index) => {
        setFormData({
            ...formData,
            tables: formData.tables.filter((_, i) => i !== index),
        });
    };

    const handleAddField = (fieldType) => {
        setFormData({
            ...formData,
            [fieldType]: [...formData[fieldType], {name: '', editableByOffice: false, visibleByOffice: false, type: '', choices: [], length: ''}],
        });
    };

    const handleFieldChange = (fieldType, index, event) => {
        const {name, value, type, checked} = event.target;
        const updatedFields = formData[fieldType].map((field, i) =>
            i === index ? {...field, [name]: type === 'checkbox' ? checked : value} : field
        );
        setFormData({...formData, [fieldType]: updatedFields});
    };

    const handleDeleteField = (fieldType, index) => {
        setFormData({
            ...formData,
            [fieldType]: formData[fieldType].filter((_, i) => i !== index),
        });
    };

    const handleAddChoice = (fieldType, index) => {
        const updatedFields = formData[fieldType].map((field, i) =>
            i === index ? {...field, choices: [...field.choices, {value: '', color: '#FFFFFF'}]} : field
        );
        setFormData({...formData, [fieldType]: updatedFields});
    };

    const handleChoiceChange = (fieldType, fieldIndex, choiceIndex, event) => {
        const {name, value} = event.target;
        const updatedFields = formData[fieldType].map((field, i) => {
            if (i === fieldIndex) {
                const updatedChoices = field.choices.map((choice, j) =>
                    j === choiceIndex ? {...choice, [name]: value} : choice
                );
                return {...field, choices: updatedChoices};
            }
            return field;
        });
        setFormData({...formData, [fieldType]: updatedFields});
    };

    const handleColorChange = (fieldType, fieldIndex, choiceIndex, event) => {
        const {value} = event.target;
        const updatedFields = formData[fieldType].map((field, i) => {
            if (i === fieldIndex) {
                const updatedChoices = field.choices.map((choice, j) =>
                    j === choiceIndex ? {...choice, color: value} : choice
                );
                return {...field, choices: updatedChoices};
            }
            return field;
        });
        setFormData({...formData, [fieldType]: updatedFields});
    };

    return (
        <Modal open={open} onClose={handleClose}>
            <Box sx={style}>
                <Typography variant="h5" gutterBottom align="center">
                    Nuovo Evento
                </Typography>
                <Grid container spacing={2}>
                    <Grid item={undefined} xs={12} md={6}>
                        <TextField
                            fullWidth
                            label="Nome"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                        />
                    </Grid>
                    <Grid item={undefined} xs={12} md={6}>
                        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='en-gb'>
                            <DatePicker
                                label="Data"
                                value={formData.date}
                                onChange={(date) => handleDateChange('date', date)}
                                renderInput={(params) => <TextField {...params}
                                                                    fullWidth
                                                                    required
                                />}
                            />
                        </LocalizationProvider>
                    </Grid>
                </Grid>
                <TextField
                    fullWidth
                    label="Descrizione"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    margin="normal"
                    multiline
                    rows={4}
                />
                <FormControlLabel
                    control={
                        <Switch
                            checked={formData.enableForm}
                            onChange={handleInputChange}
                            name="enableForm"
                            color="primary"
                        />
                    }
                    label="Attiva Form"
                />
                <Box my={2}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item={undefined}>
                            <Typography variant="h6" gutterBottom>
                                Tabelle
                            </Typography>
                        </Grid>
                        <Grid item={undefined}>
                            <IconButton onClick={handleAddTable}>
                                <AddIcon/>
                            </IconButton>
                        </Grid>
                    </Grid>
                    {formData.tables.map((table, index) => (
                        <Grid container spacing={2} alignItems="center" mb={2} key={index}>
                            <Grid item={undefined}>
                                <TextField
                                    label="Nome"
                                    name="name"
                                    value={table.name}
                                    onChange={(e) => handleTableChange(index, e)}
                                />
                            </Grid>
                            <Grid item={undefined}>
                                <TextField
                                    label="Capacità"
                                    name="capacity"
                                    type="number"
                                    value={table.capacity}
                                    onChange={(e) => handleTableChange(index, e)}
                                />
                            </Grid>
                            <Grid item={undefined} xs={2}>
                                <IconButton onClick={() => handleDeleteTable(index)}>
                                    <DeleteIcon/>
                                </IconButton>
                            </Grid>
                        </Grid>
                    ))}
                </Box>

                <Box my={2}>
                    <Grid container spacing={2}>
                        <Grid item={undefined} xs={12} md={6}>
                            <Typography variant="h6" gutterBottom>
                                Campi Profilo
                            </Typography>
                            <FormControl sx={{minWidth: '100%'}}>
                                <Select
                                    variant="outlined"
                                    multiple
                                    value={formData.profileFields}
                                    onChange={handleProfileFieldChange}
                                    renderValue={(selected) => selected.join(', ')}
                                >
                                    {profileFieldOptions.map((option) => (
                                        <MenuItem key={option} value={option}>
                                            <Checkbox checked={formData.profileFields.indexOf(option) > -1}/>
                                            {names[option]}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </Box>

                {['additionalFields', 'formFields'].map((fieldType) => (
                    <Box my={2} key={fieldType}>
                        <Grid container spacing={2} alignItems="center">
                            <Grid item={undefined} xs={6}>
                                <Typography variant="h6" gutterBottom>
                                    {fieldType === 'additionalFields' ? 'Campi Aggiuntivi' : 'Campi Form'}
                                </Typography>
                            </Grid>
                            <Grid item={undefined} xs={6} textAlign="right">
                                <IconButton onClick={() => handleAddField(fieldType)}>
                                    <AddIcon/>
                                </IconButton>
                            </Grid>
                        </Grid>
                        {formData[fieldType].map((field, index) => (
                            <Paper key={index} sx={{p: 2, mb: 1}}>
                                <Grid container spacing={2} alignItems="center">
                                    <Grid item={undefined} xs={4}>
                                        <TextField
                                            fullWidth
                                            label="Nome campo"
                                            name="name"
                                            value={field.name}
                                            onChange={(e) => handleFieldChange(fieldType, index, e)}
                                        />
                                    </Grid>
                                    <Grid item={undefined} xs={2}>
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
                                    <Grid item={undefined} xs={2}>
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
                                    <Grid item={undefined} xs={3}>
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
                                    <Grid item={undefined} xs={1}>
                                        <IconButton onClick={() => handleDeleteField(fieldType, index)}>
                                            <DeleteIcon/>
                                        </IconButton>
                                    </Grid>
                                </Grid>
                                {field.type === 'text' && (
                                    <Grid container spacing={2} alignItems="center">
                                        <Grid item={undefined} xs={4}>
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
                                            <Grid item={undefined} xs={12}><Button onClick={() => handleAddChoice(fieldType, index)}>Aggiungi Scelta</Button></Grid>
                                            {field.choices.map((choice, choiceIndex) => (
                                                <Grid container spacing={2} key={choiceIndex} alignItems="center">
                                                    <Grid item={undefined} xs={5}>
                                                        <TextField
                                                            fullWidth
                                                            label="Valore"
                                                            name="value"
                                                            value={choice.value}
                                                            onChange={(e) => handleChoiceChange(fieldType, index, choiceIndex, e)}
                                                        />
                                                    </Grid>
                                                    <Grid item={undefined} xs={5}>
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
                ))}

                <Box mt={2}>
                    <Button variant="contained" color="grey" onClick={handleClose}>Chiudi</Button>
                    <Button variant="contained" color="primary" onClick={
                        () => {
                            fetchCustom("POST", '/event/', convert(formData)).then()
                        }}>Crea</Button>
                </Box>
            </Box>
        </Modal>
    );
}
