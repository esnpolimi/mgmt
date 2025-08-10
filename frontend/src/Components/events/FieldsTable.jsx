import React, {useState} from 'react';
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
    Typography
} from '@mui/material';
import {Add as AddIcon, Delete as DeleteIcon} from '@mui/icons-material';
import {profileDisplayNames} from '../../utils/displayAttributes';

export default function FieldsTable({
                                        profile_fields,
                                        setProfileFields,
                                        fields,
                                        setFields,
                                        excludedProfileFields = [],
                                        formFieldsDisabled = false,
                                        additionalFieldsDisabled = false,
                                        hasSubscriptions = false,
                                        isEdit = false,
                                        originalAdditionalFields = []
                                    }) {

    const formFields = fields.filter(field => field.field_type === 'form');
    const additionalFields = fields.filter(field => field.field_type === 'additional');

    const [validationError, setValidationError] = useState('');

    const addField = (fieldType) => {
        const newField = {
            name: '',
            type: 't',
            field_type: fieldType,
            choices: [],
            required: false,
            // ...(fieldType === 'additional' && {accessibility: 0})
        };
        setFields([...fields, newField]);
    };

    const updateField = (index, updates) => {
        const updatedFields = [...fields];
        let newField = {...updatedFields[index], ...updates};
        // If type is changed and is not 'c' or 'm', remove choices
        if (
            Object.prototype.hasOwnProperty.call(updates, 'type') &&
            !['c', 'm'].includes(updates.type)
        ) {
            delete newField.choices;
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

    // Validation: ensure all field names and choices are non-empty
    FieldsTable.validateFields = () => {
        for (const field of fields) {
            if (!field.name || !field.name.trim()) {
                setValidationError("Tutti i campi devono avere un nome.");
                return false;
            }
            if (['c', 'm'].includes(field.type)) {
                if (!Array.isArray(field.choices) || field.choices.length === 0) {
                    setValidationError("Tutti i campi a scelta devono avere almeno un'opzione.");
                    return false;
                }
                for (const choice of field.choices) {
                    if (!choice || !choice.trim()) {
                        setValidationError("Tutte le opzioni devono avere un nome.");
                        return false;
                    }
                }
            }
        }
        setValidationError('');
        return true;
    };

    return (
        <Paper elevation={3} sx={{p: 2, my: 2, border: '1px solid #eee', background: '#fafbfc'}}>
            {validationError && (
                <Typography color="error" sx={{mb: 2}}>
                    {validationError}
                </Typography>
            )}
            {/* Profile Fields */}
            <Box my={2}>
                <Typography variant="h6" gutterBottom>Dati Anagrafici</Typography>
                <Typography variant="body2" color="text.secondary" sx={{mb: 1}}>
                    Campi richiesti e salvati per ogni iscrizione via form. {formFieldsDisabled ? "Non modificabili - evento con iscrizioni esistenti." : ""}
                </Typography>
                <Select
                    multiple
                    variant="outlined"
                    value={Array.isArray(profile_fields) ? profile_fields : []}
                    onChange={e => setProfileFields(e.target.value)}
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
                            <MenuItem key={k} value={k}>{v}</MenuItem>
                        ))}
                </Select>
            </Box>

            {/* Form Fields */}
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
                showAccessibility={false}
                hasSubscriptions={hasSubscriptions}
                isEdit={isEdit}
                originalAdditionalFields={originalAdditionalFields}
            />

            {/* Additional Fields */}
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
                showAccessibility={false}
                hasSubscriptions={hasSubscriptions}
                isEdit={isEdit}
                originalAdditionalFields={originalAdditionalFields}
            />
        </Paper>
    );
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
                          showAccessibility,
                          hasSubscriptions = false,
                          isEdit = false,
                          originalAdditionalFields = []
                      }) {
    // Add a description for each section
    let description = "";
    if (title === "Campi Form") {
        description = "Campi richiesti e salvati per ogni iscrizione via form.";
        if (isEdit && hasSubscriptions) {
            description += " Non modificabili - evento con iscrizioni esistenti.";
        }
    } else if (title === "Campi Aggiuntivi") {
        description = "Campi visibili e modificabili solo da ESNers.";
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
                                // showAccessibility={showAccessibility}
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
                      isExistingAdditionalField = false
    // showAccessibility
                  }) {
    const typeOptions = [
        {value: 't', label: 'Testo'},
        {value: 'n', label: 'Numero'},
        {value: 'c', label: 'Scelta Singola'},
        {value: 'm', label: 'Scelta Multipla'},
        {value: 'b', label: 'Sì/No'}
    ];

    /*const accessibilityOptions = [
        {value: 0, label: 'Visualizza e Modifica'},
        {value: 1, label: 'Solo Visualizza'},
        {value: 2, label: 'Nascosto'}
    ];*/

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
