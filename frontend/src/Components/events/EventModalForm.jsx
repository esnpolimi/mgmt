import React, {useState, useEffect} from 'react';
import {
    Box,
    Button,
    Checkbox,
    Chip, FormControl,
    FormControlLabel,
    Grid,
    IconButton, InputLabel,
    MenuItem,
    Paper,
    Select,
    TextField,
    Tooltip,
    Typography,
    Switch
} from '@mui/material';
import {Add as AddIcon, Delete as DeleteIcon} from '@mui/icons-material';
import {eventDisplayNames as eventNames, profileDisplayNames} from '../../utils/displayAttributes';
import {AdapterDayjs} from "@mui/x-date-pickers/AdapterDayjs";
import {DateTimePicker, LocalizationProvider} from "@mui/x-date-pickers";
import dayjs from "dayjs";

export default function EventModalForm({
                                           profile_fields,
                                           setProfileFields,
                                           fields,
                                           setFields,
                                           excludedProfileFields = [],
                                           formFieldsDisabled = false,
                                           additionalFieldsDisabled = false,
                                           hasSubscriptions = false,
                                           isEdit = false,
                                           originalAdditionalFields = [],
                                           allow_online_payment = false,
                                           setAllowOnlinePayment,
                                           form_programmed_open_time = null,
                                           setFormProgrammedOpenTime,
                                           paymentAndOpenTimeDisabled: formOpenTimeDisabled = false,
                                           subscription_start_date = null,
                                       }) {

    const formFields = fields.filter(field => field.field_type === 'form');
    const additionalFields = fields.filter(field => field.field_type === 'additional');

    const [validationError, setValidationError] = useState('');
    const isFormEnabled = !!form_programmed_open_time;

    // Ensure 'email' is always present when form is enabled
    useEffect(() => {
        if (!isFormEnabled) return;
        const current = Array.isArray(profile_fields) ? profile_fields : [];
        if (!current.includes('email')) {
            setProfileFields([...current, 'email']);
        }
    }, [isFormEnabled, profile_fields, setProfileFields]);

    const addField = (fieldType) => {
        const newField = {
            name: '',
            type: 't',
            field_type: fieldType,
            choices: [],
            required: false,
        };
        setFields([...fields, newField]);
    };

    const updateField = (index, updates) => {
        const updatedFields = [...fields];
        let newField = {...updatedFields[index], ...updates};
        // Ensure choices exists when switching to choice types
        if (Object.prototype.hasOwnProperty.call(updates, 'type')) {
            if (['c', 'm'].includes(updates.type)) {
                if (!Array.isArray(newField.choices)) newField.choices = [''];
            } else {
                delete newField.choices;
            }
        }
        updatedFields[index] = newField;
        setFields(updatedFields);
    };

    const deleteField = (index) => {
        setFields(fields.filter((_, i) => i !== index));
    };

    const addChoice = (index) => {
        const updatedFields = [...fields];
        const choices = Array.isArray(updatedFields[index].choices) ? updatedFields[index].choices : [];
        updatedFields[index].choices = [...choices, ""];
        setFields(updatedFields);
    };

    const updateChoice = (fieldIndex, choiceIndex, value) => {
        const updatedFields = [...fields];
        const choices = Array.isArray(updatedFields[fieldIndex].choices) ? updatedFields[fieldIndex].choices : [];
        choices[choiceIndex] = value;
        updatedFields[fieldIndex].choices = choices;
        setFields(updatedFields);
    };

    const deleteChoice = (fieldIndex, choiceIndex) => {
        const updatedFields = [...fields];
        const choices = Array.isArray(updatedFields[fieldIndex].choices) ? updatedFields[fieldIndex].choices : [];
        choices.splice(choiceIndex, 1);
        updatedFields[fieldIndex].choices = choices;
        setFields(updatedFields);
    };

    // Helper: trim names/options and drop empty options
    const normalizeFieldsForValidation = (arr) => {
        return arr.map(f => {
            const name = (f.name || '').trim();
            if (['c', 'm'].includes(f.type)) {
                const raw = Array.isArray(f.choices) ? f.choices : [];
                const cleanedChoices = raw.map(c => (c || '').trim()).filter(Boolean);
                return {...f, name, choices: cleanedChoices};
            }
            return {...f, name};
        });
    };

    // Validation: ensure all field names and choices are non-empty
    EventModalForm.validateFields = () => {
        // Enforce email in anagrafica if form is enabled
        if (isFormEnabled) {
            const pf = Array.isArray(profile_fields) ? profile_fields : [];
            if (!pf.includes('email')) {
                setValidationError("Email obbligatoria nei Dati Anagrafici quando il form è abilitato.");
                return false;
            }
        }

        const cleaned = normalizeFieldsForValidation(fields);
        // Persist cleaned values so stray empty options don’t keep failing
        setFields(cleaned);

        for (let i = 0; i < cleaned.length; i++) {
            const field = cleaned[i];
            if (!field.name) {
                setValidationError(`Tutti i campi devono avere un nome (manca il nome al campo #${i + 1}).`);
                return false;
            }
            if (['c', 'm'].includes(field.type)) {
                if (!Array.isArray(field.choices) || field.choices.length === 0) {
                    setValidationError(`Il campo "${field.name}" deve avere almeno un'opzione valida.`);
                    return false;
                }
            }
        }
        setValidationError('');
        return true;
    };

    return (
        <Paper elevation={3} sx={{p: 2, my: 2, border: '1px solid #eee', background: '#fafbfc'}}>
            <Typography variant="h5" gutterBottom>Impostazioni Form di Iscrizioni Online</Typography>
            {validationError && (
                <Typography color="error" sx={{mb: 2}}>
                    {validationError}
                </Typography>
            )}
            {/* --- Abilita Form Iscrizioni extra options --- */}
            <Box my={2}>
                <Grid container spacing={2} sx={{mt: 2}}>
                    <Grid size={{xs: 12, md: 4}}>
                        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='en-gb'>
                            <DateTimePicker
                                label={eventNames.form_programmed_open_time}
                                value={form_programmed_open_time ? dayjs(form_programmed_open_time) : null}
                                onChange={val => {
                                    const newValue = val && val.isValid() ? val.toISOString() : null;
                                    // Ensure it's after subscription start date
                                    if (newValue && subscription_start_date && dayjs(newValue).isBefore(dayjs(subscription_start_date))) {
                                        setFormProgrammedOpenTime(dayjs(subscription_start_date).add(1, 'hour').toISOString());
                                    } else {
                                        setFormProgrammedOpenTime(newValue);
                                    }
                                }}
                                minDate={subscription_start_date ? dayjs(subscription_start_date).add(1, 'minute') : dayjs()}
                                slotProps={{
                                    textField: {
                                        fullWidth: true,
                                        required: true,
                                    }
                                }}
                                disabled={formOpenTimeDisabled}
                                required
                            />
                        </LocalizationProvider>
                        <Typography variant="body2" color="text.secondary" sx={{mt: 1}}>
                            Per chiudere il form, agire sul campo di fine iscrizioni.
                        </Typography>
                    </Grid>
                    <Grid size={{xs: 12, md: 4}} sx={{ml:2}}>
                        <FormControlLabel
                            label="Consenti pagamenti online"
                            control={
                                <Switch
                                    checked={!!allow_online_payment}
                                    onChange={e => setAllowOnlinePayment(e.target.checked)}
                                    name="allow_online_payment"
                                    color="primary"
                                    disabled={formFieldsDisabled}
                                />
                            }
                        />
                    </Grid>
                </Grid>
            </Box>
            {/* --- End extra options --- */
            }
            {/* Profile Fields */
            }
            <Box my={2}>
                <Typography variant="h6" gutterBottom>Dati Anagrafici</Typography>
                <Typography variant="body2" color="text.secondary" sx={{mb: 1}}>
                    Campi richiesti e salvati per ogni iscrizione via
                    form. {formFieldsDisabled ? "Campi non modificabili (iscrizioni presenti)." : ""}
                </Typography>
                <Select
                    multiple
                    variant="outlined"
                    value={orderProfileFields(Array.isArray(profile_fields) ? profile_fields : [])}
                    onChange={e => {
                        const next = e.target.value || [];
                        const ensured = isFormEnabled ? Array.from(new Set([...next, 'email'])) : next;
                        setProfileFields(orderProfileFields(ensured));
                    }}
                    disabled={formFieldsDisabled}
                    renderValue={(selected) => (
                        <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.5}}>
                            {selected.map((val) => (
                                <Chip key={val} label={profileDisplayNames[val]}/>
                            ))}
                        </Box>
                    )}
                    fullWidth
                >
                    {Object.entries(profileDisplayNames)
                        .filter(([k]) => !excludedProfileFields.includes(k) && k !== 'id' && k !== 'group')
                        .map(([k, v]) => (
                            <MenuItem key={k} value={k} disabled={isFormEnabled && k === 'email'}>
                                {v}
                            </MenuItem>
                        ))}
                </Select>
            </Box>

            {/* Form Fields */
            }
            <FieldSection
                title="Campi Form"
                fields={formFields}
                onAdd={() => addField('form')}
                onUpdate={updateField}
                onDelete={deleteField}
                addChoice={addChoice}
                updateChoice={updateChoice}
                deleteChoice={deleteChoice}
                disabled={formFieldsDisabled}
                allFields={fields}
                hasSubscriptions={hasSubscriptions}
                isEdit={isEdit}
                originalAdditionalFields={originalAdditionalFields}
            />

            {/* Additional Fields */
            }
            <FieldSection
                title="Campi Aggiuntivi"
                fields={additionalFields}
                onAdd={() => addField('additional')}
                onUpdate={updateField}
                onDelete={deleteField}
                addChoice={addChoice}
                updateChoice={updateChoice}
                deleteChoice={deleteChoice}
                disabled={additionalFieldsDisabled}
                allFields={fields}
                hasSubscriptions={hasSubscriptions}
                isEdit={isEdit}
                originalAdditionalFields={originalAdditionalFields}
            />
        </Paper>
    )
        ;
}

function FieldSection({
                          title,
                          fields,
                          onAdd,
                          onUpdate,
                          onDelete,
                          addChoice,
                          updateChoice,
                          deleteChoice,
                          disabled,
                          allFields,
                          hasSubscriptions = false,
                          isEdit = false,
                          originalAdditionalFields = []
                      }) {
    // Add a description for each section
    let description = "";
    if (title === "Campi Form") {
        description = "Campi richiesti e salvati per ogni iscrizione via form (NB: il campo Note Aggiuntive è presente di default).";
        if (isEdit && hasSubscriptions) {
            description += " Campi non modificabili (iscrizioni presenti).";
        }
    } else if (title === "Campi Aggiuntivi") {
        description = "Campi form visibili e modificabili solo da ESNers.";
        if (isEdit && hasSubscriptions) {
            description += " Puoi aggiungere nuovi campi ma non modificare quelli esistenti.";
        }
    }

    return (
        <>
            <Box sx={{display: 'flex', alignItems: 'center'}}>
                <Typography variant="h6">{title}</Typography>
                <Tooltip title={`Aggiungi ${title.toLowerCase()}`}>
                    <span>
                        <IconButton onClick={onAdd} disabled={disabled}>
                            <AddIcon/>
                        </IconButton>
                    </span>
                </Tooltip>
            </Box>
            {description && (
                <Typography variant="body2" color="text.secondary" sx={{mb: 1}}>
                    {description}
                </Typography>
            )}
            <Paper elevation={1} sx={{p: 2, mb: 3}}>
                {fields.length === 0 ? (
                    <Typography color="text.secondary">Nessun campo configurato</Typography>
                ) : (
                    fields.map((field) => {
                        const globalIndex = allFields.findIndex(f => f === field);
                        const isAdditionalField = field.field_type === 'additional';

                        // Simple check: if this additional field exists in original list, it's existing
                        const isExistingAdditionalField = isAdditionalField && isEdit && hasSubscriptions &&
                            originalAdditionalFields.some(original => original.name === field.name && field.name);

                        return (
                            <FieldRow
                                key={globalIndex}
                                field={field}
                                index={globalIndex}
                                onUpdate={onUpdate}
                                onDelete={onDelete}
                                addChoice={addChoice}
                                updateChoice={updateChoice}
                                deleteChoice={deleteChoice}
                                disabled={disabled || isExistingAdditionalField}
                                isExistingAdditionalField={isExistingAdditionalField}
                            />
                        );
                    })
                )}
            </Paper>
        </>
    );
}

function FieldRow({
                      field,
                      index,
                      onUpdate,
                      onDelete,
                      addChoice,
                      updateChoice,
                      deleteChoice,
                      disabled,
                  }) {
    const typeOptions = [
        {value: 't', label: 'Testo'},
        {value: 'n', label: 'Numero'},
        {value: 'c', label: 'Scelta Singola'},
        {value: 'm', label: 'Scelta Multipla'},
        {value: 'b', label: 'Sì/No'}
    ];

    const needsChoices = ['c', 'm'].includes(field.type);
    const isFormField = field.field_type === 'form';

    return (
        <Box sx={{mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1}}>
            <Grid container spacing={2} alignItems="center">
                <Grid size={{xs: 12, sm: isFormField ? 7 : 9}}>
                    <TextField
                        fullWidth
                        label="Nome Campo"
                        required
                        value={field.name || ''}
                        onChange={(e) => onUpdate(index, {name: e.target.value})}
                        disabled={disabled}
                        size="small"
                    />
                </Grid>

                <Grid size={{xs: 12, sm: 2}}>
                    <FormControl fullWidth>
                        <InputLabel id="type-label">Tipo</InputLabel>
                        <Select
                            labelId="type-label"
                            label="Tipo"
                            fullWidth
                            variant="outlined"
                            value={field.type || 't'}
                            onChange={(e) => onUpdate(index, {type: e.target.value})}
                            disabled={disabled}
                            size="small"
                        >
                            {typeOptions.map(opt => (
                                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>

                {/* Only show Required checkbox for form fields */}
                {isFormField && (
                    <Grid size={{xs: 6, sm: 1}} sx={{mr: 2}}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={field.required || false}
                                    onChange={(e) => onUpdate(index, {required: e.target.checked})}
                                    disabled={disabled}
                                    size="small"
                                />
                            }
                            label="Required"
                        />
                    </Grid>
                )}

                <Grid size={{xs: 6, sm: 1}}>
                    <IconButton
                        onClick={() => onDelete(index)}
                        disabled={disabled}
                        color="error"
                        size="small"
                    >
                        <DeleteIcon fontSize="small"/>
                    </IconButton>
                </Grid>
            </Grid>
            {/* Opzioni, if needed */}
            {needsChoices && (
                <Box sx={{mt: 2, ml: 1}}>
                    {Array.isArray(field.choices) && field.choices.length > 0 ? (
                        field.choices.map((choice, cIdx) => (
                            <Box key={cIdx} sx={{display: 'flex', alignItems: 'center', mb: 1}}>
                                <Grid size={{xs: 12, sm: 4}}>
                                    <TextField
                                        value={choice}
                                        onChange={e => updateChoice(index, cIdx, e.target.value)}
                                        size="small"
                                        sx={{mr: 1, width: 400}}
                                        disabled={disabled}
                                        placeholder={`Opzione ${cIdx + 1}`}
                                        required
                                    />
                                </Grid>
                                <Grid size={{xs: 12, sm: 1}}>
                                    <IconButton
                                        onClick={() => deleteChoice(index, cIdx)}
                                        disabled={disabled}
                                        color="error"
                                        size="small"
                                    >
                                        <DeleteIcon fontSize="small"/>
                                    </IconButton>
                                </Grid>
                            </Box>
                        ))
                    ) : null}
                    <Button
                        onClick={() => addChoice(index)}
                        disabled={disabled}
                        size="small"
                        variant="outlined"
                        sx={{mt: 1}}
                    >
                        Aggiungi Opzione
                    </Button>
                </Box>
            )}
        </Box>
    );
}

// Canonical order for profile fields (same as frontend event form)
const canonicalProfileOrder = [
    "name", "surname", "birthdate", "email", "latest_esncard", "country", "domicile",
    "phone_prefix", "phone_number", "whatsapp_prefix", "whatsapp_number",
    "latest_document", "course", "matricola_expiration", "person_code", "matricola_number"
];

function orderProfileFields(fields) {
    return canonicalProfileOrder.filter(f => fields.includes(f));
}
