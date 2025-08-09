import React, {useMemo, useState, useEffect} from 'react';
import {MRT_Table, useMaterialReactTable} from 'material-react-table';
import {TextField, Select, MenuItem, IconButton, Button, Box, Typography, Grid, Paper, Chip} from '@mui/material';
import {Delete as DeleteIcon, Add as AddIcon} from '@mui/icons-material';
import {MRT_Localization_IT} from "material-react-table/locales/it";
import {profileDisplayNames} from '../../utils/displayAttributes';

// Utility for unique IDs
function generateId() {
    return `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

// Shared column generator
function getColumns({ typeLabel, textAccessor, onTextChange, onTypeChange, onDelete, typeOptions }) {
    return [
        {
            accessorKey: textAccessor,
            header: typeLabel,
            accessorFn: row => row?.[textAccessor] ?? '',
            Cell: ({row}) => {
                if (!row?.original) return null;
                return (
                    <TextField
                        fullWidth
                        value={row.original[textAccessor] ?? ''}
                        onChange={(e) => onTextChange(row.original.id, e.target.value)}
                    />
                );
            },
        },
        {
            accessorKey: 'type',
            header: 'Tipo',
            accessorFn: row => row?.type ?? 't',
            Cell: ({row}) => {
                if (!row?.original) return null;
                return (
                    <Select
                        fullWidth
                        variant="outlined"
                        value={row.original.type ?? 't'}
                        onChange={(e) => onTypeChange(row.original.id, e.target.value)}
                    >
                        {typeOptions.map(opt => (
                            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                        ))}
                    </Select>
                );
            },
        },
        {
            id: 'actions',
            header: 'Azioni',
            Cell: ({row}) => {
                if (!row?.original) return null;
                return (
                    <IconButton onClick={() => onDelete(row.original.id)}>
                        <DeleteIcon/>
                    </IconButton>
                );
            },
        },
    ];
}

// Shared detail panel for choices
function ChoicesDetailPanel({row, onChoiceChange, onChoiceDelete, onChoiceAdd}) {
    if (!row?.original) return null;
    return (
        <Box sx={{p: 2}}>
            {row.original.choices?.map((choice, cIndex) => (
                <Box key={cIndex} display="flex" alignItems="center" gap={1} mb={1}>
                    <TextField
                        value={choice ?? ''}
                        onChange={(e) => onChoiceChange(row.original.id, cIndex, e.target.value)}
                        fullWidth
                        label={`Risposta ${cIndex + 1}`}
                    />
                    <IconButton onClick={() => onChoiceDelete(row.original.id, cIndex)}>
                        <DeleteIcon/>
                    </IconButton>
                </Box>
            ))}
            <Button onClick={() => onChoiceAdd(row.original.id)}>Aggiungi Risposta</Button>
        </Box>
    );
}

export default function FieldsTable({
    profile_fields,
    setProfileFields,
    excludedProfileFields,
    form_fields,
    setFormFields,
    additional_fields,
    setAdditionalFields
}) {
    // Ensure unique id for each form field and additional field
    useEffect(() => {
        if (form_fields.some(f => !f.id)) {
            setFormFields(form_fields.map(f => f.id ? f : {...f, id: generateId()}));
        }
        if (additional_fields.some(f => !f.id)) {
            setAdditionalFields(additional_fields.map(f => f.id ? f : {...f, id: generateId()}));
        }
        // eslint-disable-next-line
    }, []);

    // --- Domande state/handlers ---
    const [data, setData] = useState(form_fields);

    useEffect(() => {
        setData(form_fields);
    }, [form_fields]);

    useEffect(() => {
        setFormFields(data);
    }, [data]); // eslint-disable-line

    const handleDomandaTextChange = (id, value) => {
        setData(prev => prev.map(q => q.id === id ? {...q, text: value} : q));
    };
    const handleDomandaTypeChange = (id, value) => {
        setData(prev => prev.map(q => q.id === id ? {...q, type: value} : q));
    };
    const handleDomandaDelete = (id) => {
        setData(prev => prev.filter(q => q.id !== id));
    };
    const handleDomandaAdd = () => {
        setData(prev => [...prev, {id: generateId(), text: '', type: 't', choices: []}]);
    };
    const handleDomandaChoiceAdd = (id) => {
        setData(prev =>
            prev.map(q =>
                q.id === id ? {...q, choices: q.choices ? [...q.choices, ''] : ['']} : q
            )
        );
    };
    const handleDomandaChoiceChange = (id, cIndex, value) => {
        setData(prev =>
            prev.map(q =>
                q.id === id
                    ? {...q, choices: q.choices.map((c, i) => i === cIndex ? value : c)}
                    : q
            )
        );
    };
    const handleDomandaChoiceDelete = (id, cIndex) => {
        setData(prev =>
            prev.map(q =>
                q.id === id
                    ? {...q, choices: q.choices.filter((_, i) => i !== cIndex)}
                    : q
            )
        );
    };

    // --- Campi aggiuntivi handlers ---
    const [campi, setCampi] = useState(additional_fields);

    useEffect(() => {
        setCampi(additional_fields);
    }, [additional_fields]);

    useEffect(() => {
        setAdditionalFields(campi);
    }, [campi]); // eslint-disable-line

    const handleCampoTextChange = (id, value) => {
        setCampi(prev => prev.map(f => f.id === id ? {...f, name: value} : f));
    };
    const handleCampoTypeChange = (id, value) => {
        setCampi(prev => prev.map(f => f.id === id ? {...f, type: value} : f));
    };
    const handleCampoDelete = (id) => {
        setCampi(prev => prev.filter(f => f.id !== id));
    };
    const handleCampoAdd = () => {
        setCampi(prev => [...prev, {id: generateId(), name: '', type: 't', choices: [], accessibility: 0}]);
    };
    const handleCampoChoiceAdd = (id) => {
        setCampi(prev =>
            prev.map(f =>
                f.id === id ? {...f, choices: f.choices ? [...f.choices, ''] : ['']} : f
            )
        );
    };
    const handleCampoChoiceChange = (id, cIndex, value) => {
        setCampi(prev =>
            prev.map(f =>
                f.id === id
                    ? {...f, choices: f.choices.map((c, i) => i === cIndex ? value : c)}
                    : f
            )
        );
    };
    const handleCampoChoiceDelete = (id, cIndex) => {
        setCampi(prev =>
            prev.map(f =>
                f.id === id
                    ? {...f, choices: f.choices.filter((_, i) => i !== cIndex)}
                    : f
            )
        );
    };

    // --- Column and table definitions ---
    const domandaTypeOptions = [
        {value: 't', label: 'Testo'},
        {value: 'n', label: 'Numero'},
        {value: 'c', label: 'Risposta Singola'},
        {value: 'm', label: 'Risposta Multipla'},
        {value: 'b', label: 'Vero/Falso'},
    ];
    const campoTypeOptions = [
        {value: 't', label: 'Testo'},
        {value: 'n', label: 'Numero'},
        {value: 'c', label: 'Scelta singola'},
        {value: 'm', label: 'Scelta multipla'},
        {value: 'b', label: 'Vero/Falso'},
    ];

    const domandaColumns = useMemo(() =>
        getColumns({
            typeLabel: 'Domanda',
            textAccessor: 'text',
            onTextChange: handleDomandaTextChange,
            onTypeChange: handleDomandaTypeChange,
            onDelete: handleDomandaDelete,
            typeOptions: domandaTypeOptions,
        }), []
    );
    const campoColumns = useMemo(() =>
        getColumns({
            typeLabel: 'Nome colonna',
            textAccessor: 'name',
            onTextChange: handleCampoTextChange,
            onTypeChange: handleCampoTypeChange,
            onDelete: handleCampoDelete,
            typeOptions: campoTypeOptions,
        }), []
    );

    const domandaTable = useMaterialReactTable({
        columns: domandaColumns,
        data: data || [],
        enableExpanding: true,
        enableColumnActions: false,
        enableSorting: false,
        getRowId: row => row?.id ?? `temp_${Math.random()}`,
        getRowCanExpand: ({row}) => row?.original && (row.original.type === 'c' || row.original.type === 'm'),
        renderDetailPanel: ({row}) =>
            row?.original && (row.original.type === 'c' || row.original.type === 'm') ? (
                <ChoicesDetailPanel
                    row={row}
                    onChoiceChange={handleDomandaChoiceChange}
                    onChoiceDelete={handleDomandaChoiceDelete}
                    onChoiceAdd={handleDomandaChoiceAdd}
                />
            ) : null,
        localization: MRT_Localization_IT,
    });

    const campoTable = useMaterialReactTable({
        columns: campoColumns,
        data: campi || [],
        enableExpanding: true,
        enableColumnActions: false,
        enableSorting: false,
        getRowId: row => row?.id ?? `temp_${Math.random()}`,
        getRowCanExpand: ({row}) => row?.original && (row.original.type === 'c' || row.original.type === 'm'),
        renderDetailPanel: ({row}) =>
            row?.original && (row.original.type === 'c' || row.original.type === 'm') ? (
                <ChoicesDetailPanel
                    row={row}
                    onChoiceChange={handleCampoChoiceChange}
                    onChoiceDelete={handleCampoChoiceDelete}
                    onChoiceAdd={handleCampoChoiceAdd}
                />
            ) : null,
        localization: MRT_Localization_IT,
    });

    return (
        <Paper elevation={3} sx={{p: 2, my: 2, border: '1px solid #eee', background: '#fafbfc'}}>
            {/* Dati anagrafici */}
            <Box my={2}>
                <Typography variant="h6" gutterBottom>Dati anagrafici</Typography>
                <Select
                    multiple
                    variant="outlined"
                    value={profile_fields}
                    onChange={(e) => setProfileFields(e.target.value)}
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
                        .filter(([k]) => !excludedProfileFields.includes(k))
                        .map(([k, v]) => (
                            <MenuItem key={k} value={k}>
                                {v}
                            </MenuItem>
                        ))}
                </Select>
            </Box>

            {/* Domande */}
            <Box my={2}>
                <Grid container spacing={2} alignItems="center" sx={{display: 'flex', mt: 2, mb: 1}}>
                    <Typography variant="h6">Domande</Typography>
                    <IconButton
                        title="Aggiungi Domanda"
                        onClick={handleDomandaAdd}
                        sx={{ml: -2}}>
                        <AddIcon/>
                    </IconButton>
                </Grid>
                <MRT_Table table={domandaTable}/>
            </Box>

            {/* Campi aggiuntivi */}
            <Box my={2}>
                <Grid container spacing={2} alignItems="center" sx={{display: 'flex', mt: 2, mb: 1}}>
                    <Typography variant="h6">Campi aggiuntivi</Typography>
                    <IconButton
                        title="Aggiungi Campo"
                        onClick={handleCampoAdd}
                        sx={{ml: -2}}>
                        <AddIcon/>
                    </IconButton>
                </Grid>
                <MRT_Table table={campoTable}/>
            </Box>
        </Paper>
    );
}
