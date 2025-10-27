import React, {useEffect, useState} from 'react';
import {
    Box,
    Button,
    Checkbox,
    FormControlLabel,
    Grid,
    IconButton,
    MenuItem,
    Modal,
    Switch,
    TextField,
    Typography
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import {styleESNcardModal as style} from "../../utils/sharedStyles";
import Popup from "../Popup";
import {defaultErrorHandler, fetchCustom} from "../../api/api";

export default function EditAnswersModal({open, onClose, event, subscription}) {
    // Initialize with proper defaults and ensure all fields exist
    const [formData, setFormData] = useState({});
    const [additionalData, setAdditionalData] = useState({});
    const [saving, setSaving] = useState(false);
    const [popup, setPopup] = useState(null);

    // Initialize data when modal opens
    useEffect(() => {
        if (open && event && subscription) {
            const initialFormData = {};
            // Use unified fields array filtered by field_type
            const formFields = (event.fields || []).filter(field => field.field_type === 'form');
            formFields.forEach(field => {
                const existingValue = subscription.form_data?.[field.name];
                if (field.type === 'm') {
                    initialFormData[field.name] = Array.isArray(existingValue) ? existingValue : [];
                } else if (field.type === 'b') {
                    initialFormData[field.name] = Boolean(existingValue);
                } else if (field.type === 'n') {
                    initialFormData[field.name] = existingValue ?? '';
                } else {
                    // include new types 'd','e','p' treated as string
                    initialFormData[field.name] = existingValue ?? '';
                }
            });

            const initialAdditionalData = {};
            // Use unified fields array filtered by field_type
            const additionalFields = (event.fields || []).filter(field => field.field_type === 'additional');
            additionalFields.forEach(field => {
                const existingValue = subscription.additional_data?.[field.name];
                if (field.type === 'm') {
                    initialAdditionalData[field.name] = Array.isArray(existingValue) ? existingValue : [];
                } else if (field.type === 'b') {
                    initialAdditionalData[field.name] = Boolean(existingValue);
                } else if (field.type === 'n') {
                    initialAdditionalData[field.name] = existingValue ?? '';
                } else {
                    initialAdditionalData[field.name] = existingValue ?? '';
                }
            });

            setFormData(initialFormData);
            setAdditionalData(initialAdditionalData);
        }
    }, [open, event, subscription]);

    // Helper to render a field input for form/additional fields
    const renderFieldInput = (field, value, onChange, isAdditional = false) => {
        switch (field.type) {
            case 't':
            case 'd': // date stored as string
            case 'e': // esncard number
            case 'p': // phone "+prefix number"
                return (
                    <TextField
                        fullWidth
                        value={value || ''}
                        onChange={e => onChange(field, e.target.value)}
                        size="small"
                        variant="outlined"
                    />
                );
            case 'n':
                return (
                    <TextField
                        fullWidth
                        type="number"
                        value={value || ''}
                        onChange={e => onChange(field, e.target.value)}
                        size="small"
                        variant="outlined"
                    />
                );
            case 'c':
                return (
                    <TextField
                        select
                        fullWidth
                        value={value || ''}
                        onChange={e => onChange(field, e.target.value)}
                        size="small"
                        variant="outlined"
                    >
                        {(field.choices || []).map(choice => (
                            <MenuItem key={choice} value={choice}>{choice}</MenuItem>
                        ))}
                    </TextField>
                );
            case 's':
                return (
                    <TextField
                        select
                        fullWidth
                        value={value || ''}
                        onChange={e => onChange(field, e.target.value)}
                        size="small"
                        variant="outlined"
                    >
                        {(field.choices || []).map(choice => (
                            <MenuItem key={choice} value={choice}>{choice}</MenuItem>
                        ))}
                    </TextField>
                );
            case 'm':
                return (
                    <Box>
                        {(field.choices || []).map(choice => (
                            <FormControlLabel
                                key={choice}
                                control={
                                    <Checkbox
                                        checked={Array.isArray(value) ? value.includes(choice) : false}
                                        onChange={e => {
                                            const arr = Array.isArray(value) ? [...value] : [];
                                            if (e.target.checked && !arr.includes(choice)) {
                                                onChange(field, [...arr, choice]);
                                            } else if (!e.target.checked) {
                                                onChange(field, arr.filter(v => v !== choice));
                                            }
                                        }}
                                    />
                                }
                                label={choice}
                            />
                        ))}
                    </Box>
                );
            case 'b':
                return (
                    <Switch
                        checked={Boolean(value)}
                        onChange={e => onChange(field, e.target.checked)}
                    />
                );
            default:
                return null;
        }
    };

    // Handlers for form/additional fields
    const handleFormFieldChange = (field, value) => {
        setFormData(prev => ({...prev, [field.name]: value}));
    };

    const handleAdditionalFieldChange = (field, value) => {
        setAdditionalData(prev => ({...prev, [field.name]: value}));
    };

    // Prepare data for PATCH: convert types as needed for backend validation
    const prepareDataForPatch = () => {
        const cleanedFormData = {};
        const formFields = (event.fields || []).filter(field => field.field_type === 'form');
        formFields.forEach(field => {
            const val = formData[field.name];

            // Handle each field type according to backend validation
            if (field.type === 'n') {
                // For numbers: convert to number or skip if empty
                if (val !== '' && val !== undefined && val !== null) {
                    cleanedFormData[field.name] = Number(val);
                }
            } else if (field.type === 'm') {
                // For multiple choice: ensure it's an array
                cleanedFormData[field.name] = Array.isArray(val) ? val : [];
            } else if (field.type === 'b') {
                // For boolean: convert to boolean
                cleanedFormData[field.name] = Boolean(val);
            } else if (['t','c','d','e','p'].includes(field.type)) {
                cleanedFormData[field.name] = val || '';
            }
        });

        const cleanedAdditionalData = {};
        const additionalFields = (event.fields || []).filter(field => field.field_type === 'additional');
        additionalFields.forEach(field => {
            const val = additionalData[field.name];

            if (field.type === 'n') {
                if (val !== '' && val !== undefined && val !== null) {
                    cleanedAdditionalData[field.name] = Number(val);
                }
            } else if (field.type === 'm') {
                cleanedAdditionalData[field.name] = Array.isArray(val) ? val : [];
            } else if (field.type === 'b') {
                cleanedAdditionalData[field.name] = Boolean(val);
            } else if (['t','c','d','e','p'].includes(field.type)) {
                cleanedAdditionalData[field.name] = val || '';
            }
        });

        return {
            form_data: cleanedFormData,
            additional_data: cleanedAdditionalData
        };
    };

    // Save handler
    const handleSave = () => {
        setSaving(true);
        const {form_data, additional_data} = prepareDataForPatch();

        console.log('Sending data:', {form_data, additional_data}); // Debug log

        fetchCustom("PATCH", `/subscription/${subscription.id}/`, {
            body: {
                form_data,
                additional_data
            },
            onSuccess: () => {
                setSaving(false);
                onClose(true);
            },
            onError: (err) => {
                setSaving(false);
                console.error('Save error:', err); // Debug log
                defaultErrorHandler(err, setPopup);
            }
        });
    };

    if (!event || !subscription) {
        return null;
    }

    // Get form and additional fields from unified fields array
    const formFields = (event.fields || []).filter(field => field.field_type === 'form');
    const additionalFields = (event.fields || []).filter(field => field.field_type === 'additional');

    return (
        <Modal open={open} onClose={() => onClose(false)}>
            <Box
                sx={{
                    ...style,
                    maxWidth: 1200,
                    minWidth: {xs: '0', md: 1000},
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    p: {xs: 2, sm: 3}
                }}
            >
                 <Box sx={{display: 'flex', justifyContent: 'flex-end'}}>
                    <IconButton onClick={() => onClose(false)} sx={{minWidth: 0}}><CloseIcon/></IconButton>
                </Box>
                <Typography variant="h4" component="h2" align="center" gutterBottom>Modifica Risposte Form</Typography>
                {formFields && formFields.length > 0 && (
                    <Box sx={{mb: 2}}>
                        <Typography variant="subtitle1" sx={{mb: 1}}><b>Risposte Form</b></Typography>
                        <Grid container spacing={2}>
                            {formFields.map((field, idx) => (
                                <Grid key={idx} size={{xs: 12, sm: 6, md: 4}}>
                                    <Typography variant="body2" sx={{mb: 0.5}}>{field.name}</Typography>
                                    {renderFieldInput(field, formData[field.name], handleFormFieldChange)}
                                </Grid>
                            ))}
                        </Grid>
                    </Box>
                )}
                {additionalFields && additionalFields.length > 0 && (
                    <Box sx={{mb: 2}}>
                        <Typography variant="subtitle1" sx={{mb: 1}}><b>Campi aggiuntivi</b></Typography>
                        <Grid container spacing={2}>
                            {additionalFields.map((field, idx) => (
                                <Grid key={idx} size={{xs: 12, sm: 6, md: 4}}>
                                    <Typography variant="body2" sx={{mb: 0.5}}>{field.name}</Typography>
                                    {renderFieldInput(field, additionalData[field.name], handleAdditionalFieldChange, true)}
                                </Grid>
                            ))}
                        </Grid>
                    </Box>
                )}
                <Grid container spacing={2} sx={{mt: 2}}>
                    <Grid size={{xs: 12, sm: 6, md: 3}}>
                        <Button fullWidth variant="contained" color="primary" onClick={handleSave} disabled={saving}>
                            Salva
                        </Button>
                    </Grid>
                    <Grid size={{xs: 12, sm: 6, md: 3}}>
                        <Button fullWidth variant="outlined" onClick={() => onClose(false)} disabled={saving}>
                            Annulla
                        </Button>
                    </Grid>
                </Grid>
                {popup && <Popup key={popup.id} message={popup.message} state={popup.state}/>}
            </Box>
        </Modal>
    );
}
