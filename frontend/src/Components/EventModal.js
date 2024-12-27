import React, {useState} from 'react';
import {
    Modal, Box, TextField, FormControlLabel, Switch, Button, Grid, Checkbox, FormControl,
    InputLabel, Select, MenuItem, IconButton, Paper, Typography
} from '@mui/material';
import {LocalizationProvider, DatePicker} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import {Add as AddIcon, Delete as DeleteIcon} from '@mui/icons-material';
import Cookies from 'js-cookie';
import {fetchCustom} from "../api/api";

const style = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '80%',
    maxWidth: 1200,
    maxHeight: '90vh',
    bgcolor: 'background.paper',
    border: '2px solid #000',
    boxShadow: 24,
    p: 4,
    overflow: 'auto',
};

const colorOptions = [
    {label: 'Red', value: '#FF0000'},
    {label: 'Green', value: '#00FF00'},
    {label: 'Blue', value: '#0000FF'},
    {label: 'Yellow', value: '#FFFF00'},
    {label: 'Cyan', value: '#00FFFF'},
    {label: 'Magenta', value: '#FF00FF'},
    {label: 'Black', value: '#000000'},
    {label: 'White', value: '#FFFFFF'},
    {label: 'Orange', value: '#FFA500'},
    {label: 'Purple', value: '#800080'},
    {label: 'Pink', value: '#FFC0CB'},
    {label: 'Brown', value: '#A52A2A'},
    {label: 'Gray', value: '#808080'},
    {label: 'Lime', value: '#00FF00'},
    {label: 'Maroon', value: '#800000'},
    {label: 'Navy', value: '#000080'}
];

const FormModal = ({open, handleClose}) => {
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

    const profileFieldOptions = ['name', 'surname', 'email', 'phone', 'whatsapp', 'gender', 'birthdate', 'latest_esncard', 'latest_document', 'latest_matricola', 'person_code', 'domicile', 'residency'];

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
                <form>
                    <Typography variant="h5" gutterBottom align="center">
                        New Event
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Name"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}

                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='en-gb'>
                                <DatePicker
                                    label="Date"
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
                        label="Description"
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
                        label="Enable Form"
                    />
                    <Box my={2}>
                        <Grid container spacing={2} alignItems="center">
                            <Grid item>
                                <Typography variant="h6" gutterBottom>
                                    Tables
                                </Typography>
                            </Grid>
                            <Grid item>
                                <IconButton onClick={handleAddTable}>
                                    <AddIcon/>
                                </IconButton>
                            </Grid>
                        </Grid>
                        {formData.tables.map((table, index) => (
                            <Grid container spacing={2} alignItems="center" mb={2} key={index}>
                                <Grid item>
                                    <TextField
                                        label="Name"
                                        name="name"
                                        value={table.name}
                                        onChange={(e) => handleTableChange(index, e)}
                                    />
                                </Grid>
                                <Grid item>
                                    <TextField
                                        label="Capacity"
                                        name="capacity"
                                        type="number"
                                        value={table.capacity}
                                        onChange={(e) => handleTableChange(index, e)}
                                    />
                                </Grid>
                                <Grid item xs={2}>
                                    <IconButton onClick={() => handleDeleteTable(index)}>
                                        <DeleteIcon/>
                                    </IconButton>
                                </Grid>
                            </Grid>
                        ))}
                    </Box>

                    <Box my={2}>
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                                <Typography variant="h6" gutterBottom>
                                    Profile Fields
                                </Typography>
                                <FormControl sx={{minWidth: '100%'}}>
                                    <Select
                                        multiple
                                        value={formData.profileFields}
                                        onChange={handleProfileFieldChange}
                                        renderValue={(selected) => selected.join(', ')}
                                    >
                                        {profileFieldOptions.map((option) => (
                                            <MenuItem key={option} value={option}>
                                                <Checkbox checked={formData.profileFields.indexOf(option) > -1}/>
                                                {option}
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
                                <Grid item xs={6}>
                                    <Typography variant="h6" gutterBottom>
                                        {fieldType === 'additionalFields' ? 'Additional Fields' : 'Form Fields'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6} textAlign="right">
                                    <IconButton onClick={() => handleAddField(fieldType)}>
                                        <AddIcon/>
                                    </IconButton>
                                </Grid>
                            </Grid>
                            {formData[fieldType].map((field, index) => (
                                <Paper key={index} sx={{p: 2, mb: 1}}>
                                    <Grid container spacing={2} alignItems="center">
                                        <Grid item xs={4}>
                                            <TextField
                                                fullWidth
                                                label="Name"
                                                name="name"
                                                value={field.name}
                                                onChange={(e) => handleFieldChange(fieldType, index, e)}
                                            />
                                        </Grid>
                                        <Grid item xs={2}>
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={field.editableByOffice}
                                                        onChange={(e) => handleFieldChange(fieldType, index, e)}
                                                        name="editableByOffice"
                                                    />
                                                }
                                                label="Editable"
                                            />
                                        </Grid>
                                        <Grid item xs={2}>
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={field.visibleByOffice}
                                                        onChange={(e) => handleFieldChange(fieldType, index, e)}
                                                        name="visibleByOffice"
                                                    />
                                                }
                                                label="Visible"
                                            />
                                        </Grid>
                                        <Grid item xs={3}>
                                            <FormControl fullWidth>
                                                <InputLabel>Type</InputLabel>
                                                <Select
                                                    name="type"
                                                    value={field.type}
                                                    onChange={(e) => handleFieldChange(fieldType, index, e)}
                                                >
                                                    <MenuItem value="text">Text</MenuItem>
                                                    <MenuItem value="integer">Integer</MenuItem>
                                                    <MenuItem value="float">Float</MenuItem>
                                                    <MenuItem value="single choice">Single Choice</MenuItem>
                                                    <MenuItem value="multiple choice">Multiple Choice</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                        <Grid item xs={1}>
                                            <IconButton onClick={() => handleDeleteField(fieldType, index)}>
                                                <DeleteIcon/>
                                            </IconButton>
                                        </Grid>
                                    </Grid>
                                    {field.type === 'text' && (
                                        <Grid container spacing={2} alignItems="center">
                                            <Grid item xs={4}>
                                                <TextField
                                                    fullWidth
                                                    label="Length"
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
                                                <Grid item xs={12}><Button onClick={() => handleAddChoice(fieldType, index)}>Add Choice</Button></Grid>
                                                {field.choices.map((choice, choiceIndex) => (
                                                    <Grid container spacing={2} key={choiceIndex} alignItems="center">
                                                        <Grid item xs={5}>
                                                            <TextField
                                                                fullWidth
                                                                label="Value"
                                                                name="value"
                                                                value={choice.value}
                                                                onChange={(e) => handleChoiceChange(fieldType, index, choiceIndex, e)}
                                                            />
                                                        </Grid>
                                                        <Grid item xs={5}>
                                                            <FormControl fullWidth>
                                                                <InputLabel>Color</InputLabel>
                                                                <Select
                                                                    name="color"
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
                        <Button variant="contained" color="grey" onClick={handleClose}>Close</Button>
                        <Button variant="contained" color="primary" onClick={
                            () => {
                                fetchCustom("POST", '/event/', convert(formData)).then()
                            }}>Submit</Button>
                    </Box>
                </form>
            </Box>
        </Modal>
    );
};

export default FormModal;
