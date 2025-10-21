import React, {useEffect, useState} from 'react';
import {
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    FormControl,
    FormControlLabel,
    FormLabel,
    Grid,
    IconButton,
    InputLabel,
    MenuItem,
    Modal,
    Paper,
    Radio,
    RadioGroup,
    Select,
    Switch,
    TextField,
    Tooltip,
    Typography,
    Alert
} from '@mui/material';
import {DatePicker, DateTimePicker, LocalizationProvider} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import {Add as AddIcon, Delete as DeleteIcon, Info as InfoIcon, ArrowUpward as ArrowUpwardIcon, ArrowDownward as ArrowDownwardIcon} from '@mui/icons-material';
import {defaultErrorHandler, fetchCustom} from "../../api/api";
import {style} from '../../utils/sharedStyles'
import CustomEditor from '../CustomEditor';
import Loader from "../Loader";
import CloseIcon from '@mui/icons-material/Close';
import Popup from "../Popup";
import ConfirmDialog from "../ConfirmDialog";
import StatusBanner from "../StatusBanner";
import ProfileSearch from '../ProfileSearch';
import {eventDisplayNames as eventNames, profileDisplayNames} from '../../utils/displayAttributes';
import {useAuth} from "../../Context/AuthContext";

export default function EventModal({open, event, isEdit, onClose}) {
    const errorsRef = React.useRef({
        name: [false, ''],
        date: [false, ''],
        description: [false, ''],
        cost: [false, ''],
        deposit: [false, ''],
        subscription_start_date: [false, ''],
        subscription_end_date: [false, ''],
        lists: [false, ''],
        listItems: [],
        form: ''
    });

    // --- Add board member detection ---
    const {user} = useAuth();
    const isBoardMember = user.groups[0] === "Board";
    const currentProfileId = user?.profile?.id ?? user?.profile_id ?? user?.id;
    const isOrganizer = Array.isArray(event?.organizers) && event.organizers.some(o => o.profile === currentProfileId);

    /* General event information block, at the top of the modal */
    const GeneralInfoBlock = function GeneralInfoBlock({isEdit, hasSubscriptions, dataRef, onSubscriptionWindowChange}) {
        // Local state for UI only (fast typing, no parent re-render)
        const [localData, setLocalData] = useState(dataRef.current);

        // Update ref and local state on input change
        const handleInputChange = (event) => {
            const {name, value, type, checked} = event.target;
            const newData = {
                ...localData,
                [name]: type === 'checkbox' ? checked : value,
            };
            setLocalData(newData);
            dataRef.current = newData;
        };

        const handleEventDateChange = (date) => {
            const newData = {...localData, date};
            setLocalData(newData);
            dataRef.current = newData;
        };

        const handleSubscriptionStartChange = (date) => {
            let newData;
            if (localData.subscription_end_date && dayjs(date).isAfter(dayjs(localData.subscription_end_date))) {
                newData = {
                    ...localData,
                    subscription_start_date: date,
                    subscription_end_date: dayjs(date).add(1, 'day'),
                };
            } else {
                newData = {...localData, subscription_start_date: date};
            }

            // Adjust programmed form open time if now invalid (must be >= start + 1 minute and < end - 1 minute)
            if (dataRef.current.enable_form && newData.form_programmed_open_time) {
                const minAllowed = dayjs(newData.subscription_start_date).add(1, 'minute');
                const maxAllowed = dayjs(newData.subscription_end_date).subtract(1, 'minute');
                
                if (dayjs(newData.form_programmed_open_time).isBefore(minAllowed)) {
                    newData.form_programmed_open_time = minAllowed.toISOString();
                } else if (dayjs(newData.form_programmed_open_time).isAfter(maxAllowed)) {
                    newData.form_programmed_open_time = maxAllowed.toISOString();
                }
            }

            setLocalData(newData);
            dataRef.current = newData;
            onSubscriptionWindowChange(); // notify parent to refresh FormBlock
        };

        const handleSubscriptionEndChange = (date) => {
            let newDate = date;
            if (date) {
                const startDateTime = dayjs(localData.subscription_start_date);
                const endDateTime = dayjs(date);
                const now = dayjs();
                if (endDateTime.isBefore(startDateTime)) {
                    newDate = startDateTime;
                } else if (!isEdit && endDateTime.isBefore(now)) {
                    // Only prevent past dates when creating new events, not when editing existing ones
                    newDate = now;
                }
            }
            const newData = {...localData, subscription_end_date: newDate};
            
            // Adjust programmed form open time if now invalid (must be < end - 1 minute)
            if (dataRef.current.enable_form && newData.form_programmed_open_time && newDate) {
                const maxAllowed = dayjs(newDate).subtract(1, 'minute');
                if (dayjs(newData.form_programmed_open_time).isAfter(maxAllowed)) {
                    newData.form_programmed_open_time = maxAllowed.toISOString();
                }
            }
            
            setLocalData(newData);
            dataRef.current = newData;
            onSubscriptionWindowChange(); // keep consistency if needed
        };

        return (
            <Box>
                <Grid container spacing={2} sx={{mt: 4}}>
                    <Grid size={{xs: 12, md: 6}}>
                        <TextField
                            fullWidth
                            label={eventNames.name}
                            name="name"
                            value={localData.name}
                            onChange={handleInputChange}
                            required
                            //error={errors.name[0]}
                        />
                    </Grid>
                    <Grid size={{xs: 12, md: 6}}>
                        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='en-gb'>
                            <DatePicker
                                label={eventNames.date}
                                value={localData.date}
                                onChange={handleEventDateChange}
                                slotProps={{textField: {variant: 'outlined'}}}
                                required
                                //error={errors.date[0]}
                            />
                        </LocalizationProvider>
                    </Grid>
                    <Grid size={{xs: 12, md: 4}}>
                        <Tooltip title={isEdit && hasSubscriptions ? "Non modificabile con iscrizioni esistenti" : ""}>
                            <span>
                                <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='en-gb'>
                                    <DateTimePicker
                                        label={eventNames.subscription_start_date}
                                        value={localData.subscription_start_date || null}
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
                                        //error={errors.subscription_start_date[0]}
                                    />
                                </LocalizationProvider>
                            </span>
                        </Tooltip>
                    </Grid>
                    <Grid size={{xs: 12, md: 4}}>
                        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='en-gb'>
                            <DateTimePicker
                                label={eventNames.subscription_end_date}
                                value={localData.subscription_end_date || null}
                                onChange={handleSubscriptionEndChange}
                                minDate={isEdit ? localData.subscription_start_date || null : (dayjs().isAfter(localData.subscription_start_date) ? dayjs() : localData.subscription_start_date || dayjs())}
                                slotProps={{textField: {fullWidth: true, required: true}}}
                                required
                                //error={errors.subscription_end_date[0]}
                            />
                        </LocalizationProvider>
                    </Grid>
                    <Grid size={{xs: 12, md: 4}}/>
                    <Grid size={{xs: 12, md: 3}}>
                        <Tooltip title={isEdit && hasSubscriptions ? "Non modificabile con iscrizioni esistenti" : ""}>
                            <span>
                                <TextField
                                    fullWidth
                                    label={eventNames.cost + " (decimali con punto)"}
                                    name="cost"
                                    type="number"
                                    slotProps={{htmlInput: {min: "0", step: "0.01"}}}
                                    value={localData.cost ?? ""}
                                    onChange={handleInputChange}
                                    placeholder="Inserisci 0 se gratuito"
                                    required
                                    //error={errors.cost[0]}
                                    disabled={isEdit && hasSubscriptions}
                                />
                            </span>
                        </Tooltip>
                    </Grid>
                    <Grid size={{xs: 12, md: 3}}>
                        <Tooltip title={isEdit && hasSubscriptions ? "Non modificabile con iscrizioni esistenti" : ""}>
                            <span>
                                <TextField
                                    fullWidth
                                    label={eventNames.deposit + " (decimali con punto)"}
                                    name="deposit"
                                    type="number"
                                    slotProps={{htmlInput: {min: "0", step: "0.01"}}}
                                    value={localData.deposit ?? ""}
                                    onChange={handleInputChange}
                                    //error={errors.deposit && errors.deposit[0]}
                                    disabled={isEdit && hasSubscriptions}
                                />
                            </span>
                        </Tooltip>
                    </Grid>
                </Grid>
                <Grid container spacing={2} sx={{mt: 2, mb: 2}}>
                    <Grid size={{xs: 12, md: 3}}>
                        <FormControlLabel
                            label="Evento A Bando"
                            control={
                                <Switch
                                    checked={!!localData.is_a_bando}
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
                                    checked={!!localData.is_allow_external}
                                    onChange={handleInputChange}
                                    name="is_allow_external"
                                    color="primary"
                                />
                            }
                        />
                    </Grid>
                    <Grid size={{xs: 12, md: 3}}>
                        <FormControlLabel
                            label="Notifica Lista assegnata nelle conferme via email"
                            control={
                                <Switch
                                    checked={!!localData.notify_list}
                                    onChange={handleInputChange}
                                    name="notify_list"
                                    color="primary"
                                />
                            }
                        />
                    </Grid>
                    {/* --- Reimbursements by organizers only toggle --- */}
                    {(isBoardMember || isOrganizer || !isEdit) && (
                        <Grid size={{xs: 12, md: 3}}>
                            <FormControlLabel
                                label="Rimborsi limitati agli Organizzatori"
                                control={
                                    <Switch
                                        checked={!!localData.reimbursements_by_organizers_only}
                                        onChange={handleInputChange}
                                        name="reimbursements_by_organizers_only"
                                        color="warning"
                                    />
                                }
                            />
                        </Grid>
                    )}
                    {/* --- Board-only visibility toggle --- */}
                    {isBoardMember && (
                        <Grid size={{xs: 12, md: 3}}>
                            <FormControlLabel
                                label="Visibile solo ai Board Members"
                                control={
                                    <Switch
                                        checked={!!localData.visible_to_board_only}
                                        onChange={handleInputChange}
                                        name="visible_to_board_only"
                                        color="warning"
                                    />
                                }
                            />
                        </Grid>
                    )}
                </Grid>
            </Box>
        );
    };

    /* Event description block */
    const Description = function Description({dataRef}) {

        const [desc, setDesc] = useState(dataRef.current.description)

        return (
            <Grid size={{xs: 12}} data-color-mode="light" sx={{mt: 2}}>
                <Typography variant="h6" component="div" sx={{mb: 1}}>{eventNames.description}</Typography>
                <CustomEditor
                    value={desc}
                    onChange={(value) => {
                        setDesc(value)
                        dataRef.current.description = value
                    }}
                />
            </Grid>
        )
    }

    /* Event organizers block */
    const Organizers = function Organizers({dataRef}) {

        const [localData, setLocalData] = useState(dataRef.current)
        const [selectedProfile, setSelectedProfile] = useState(null)

        const handleOrganizerSelect = function (_, val) {

            if (val === undefined || val === null) {
                setSelectedProfile(null)
                return
            }

            //Check if already exists
            const exists = localData.organizers?.some(o => o.profile === val.id);

            if (!exists) {
                const name = `${val.name}${val.surname ? ` ${val.surname}` : ''}`;

                //Update local state
                setLocalData(prev => ({
                    ...prev,
                    organizers: [...(prev.organizers || []), {profile: val.id, profile_name: name, is_lead: false}]
                }));

                // Update the ref as well
                dataRef.current.organizers = [...(localData.organizers || []), {
                    profile: val.id,
                    profile_name: name,
                    is_lead: false
                }];
            }

            setSelectedProfile(null);
        }

        const handleRemoveOrganizer = function (idx) {

            //Update local state
            setLocalData(prev => {
                const arr = [...(prev.organizers || [])];
                arr.splice(idx, 1);
                return {...prev, organizers: arr};
            });

            // Update the ref as well
            dataRef.current.organizers = [...(localData.organizers || [])].filter((_, i) => i !== idx);
        }

        const handleToggleLeader = (idx, e) => {
            const val = e.target.checked;

            // Update local state
            setLocalData(prev => {
                const arr = [...(prev.organizers || [])];
                if (!arr[idx]) return prev;
                arr[idx] = {...arr[idx], is_lead: val};
                return {...prev, organizers: arr};
            });

            // Update the ref as well
            dataRef.current.organizers = [...(localData.organizers || [])].map((org, i) =>
                i === idx ? {...org, is_lead: val} : org
            );
        };


        return (
            <Box>

                <Grid container spacing={2} alignItems="center" sx={{display: 'flex', mt: 2, mb: 1}}>
                    <Typography variant="h6">Organizzatori</Typography>
                    {/* removed AddIcon button beside title */}
                </Grid>

                <Grid container spacing={2} alignItems="center" sx={{mt: 1}}>
                    <Grid size={{xs: 12, md: 4}}>
                        <ProfileSearch
                            //value={newOrganizer}
                            onChange={handleOrganizerSelect}
                            value={selectedProfile}
                            label="Cerca ESNer"
                            esner_only={true}
                            valid_only={true}
                        />
                    </Grid>
                </Grid>

                {(localData.organizers && localData.organizers.length > 0) && (
                    <Grid container spacing={2} sx={{mt: 1}}>
                        {localData.organizers.map((org, idx) => (
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
                                                onChange={(e) => handleToggleLeader(idx, e)}
                                                color="primary"
                                            />
                                        }
                                        label="Leader"
                                        sx={{mr: 1}}
                                    />
                                    <IconButton onClick={() => handleRemoveOrganizer(idx)} title="Rimuovi">
                                        <DeleteIcon/>
                                    </IconButton>
                                </Box>
                            </Grid>
                        ))}
                    </Grid>
                )}
            </Box>
        )
    }

    /* Lists block*/
    const Lists = function Lists({dataRef, isEdit}) {

        const [localData, setLocalData] = useState(dataRef.current);
        //const [localErrors] = useState(errorsRef.current);

        /* Helpers */
        const handleAddList = () => {

            //Update local state
            setLocalData({
                ...localData,
                lists: [...localData.lists, {id: '', name: '', capacity: ''}],
            });

            //Update the ref as well
            dataRef.current = {
                ...dataRef.current,
                lists: [...dataRef.current.lists, {id: '', name: '', capacity: ''}],
            };
        };

        const handleListChange = (index, event) => {
            const {name, value} = event.target;
            const listObj = localData.lists[index];
            // Prevent renaming (or changing type) of the special form list in edit mode
            if (isEdit && listObj && listObj.name === 'Form List') {
                if (name === 'name') return;
            }

            const updatedLists = localData.lists.map((list, i) =>
                i === index ? {...list, [name]: value} : list
            );

            //Update local state
            setLocalData({...localData, lists: updatedLists});

            //Update the ref as well
            dataRef.current = {...dataRef.current, lists: updatedLists};
        };

        const handleDeleteList = (index) => {
            const listObj = localData.lists[index];
            if (isEdit && listObj && listObj.name === 'Form List') {
                return; // cannot delete form list
            }

            // Update local state
            setLocalData({
                ...localData,
                lists: localData.lists.filter((_, i) => i !== index),
            });

            // Update the ref as well
            dataRef.current = {
                ...dataRef.current,
                lists: dataRef.current.lists.filter((_, i) => i !== index),
            };
        };

        const handleListTypeChange = (index, type) => {
            const listObj = localData.lists[index];
            if (isEdit && listObj && listObj.name === 'Form List') return; // cannot change type

            const updatedLists = localData.lists.map((list, i) => {
                if (type === 'main') {
                    // Set ML only for selected index, clear ML from others, keep WL unchanged
                    return {
                        ...list,
                        is_main_list: i === index,
                        is_waiting_list: list.is_waiting_list && i !== index
                    };
                } else if (type === 'waiting') {
                    // Set WL only for selected index, clear WL from others, keep ML unchanged
                    return {
                        ...list,
                        is_main_list: list.is_main_list && i !== index,
                        is_waiting_list: i === index
                    };
                } else {
                    // Set both to false for selected index, keep others unchanged
                    return i === index
                        ? {...list, is_main_list: false, is_waiting_list: false}
                        : list;
                }
            });

            // Update local state
            setLocalData({...localData, lists: updatedLists});

            //Update the ref as well
            dataRef.current = {...dataRef.current, lists: updatedLists};
        }

        return (
            <Box>
                <Grid container spacing={2} alignItems="center" sx={{display: 'flex', mt: 2}}>
                    <Typography variant="h6">Liste</Typography>
                    <IconButton title="Aggiungi Lista" onClick={handleAddList} sx={{ml: -2}}><AddIcon/></IconButton>
                </Grid>

                {localData.lists.map((list, index) => {
                    const isFormList = isEdit && list.name === 'Form List';
                    return (
                        <Grid container spacing={2} alignItems="center" sx={{mt: 1}} key={index}>
                            <Grid>
                                <TextField
                                    label={eventNames.list_name}
                                    name="name"
                                    value={list.name}
                                    onChange={(e) => handleListChange(index, e)}
                                    required
                                    disabled={isFormList}
                                    //error={localErrors.listItems[index]?.name}
                                    //helperText={localErrors.listItems[index]?.name ? "Il nome è obbligatorio" : ""}
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
                                    //error={localErrors.listItems[index]?.capacity}
                                    //helperText={localErrors.listItems[index]?.capacity ? "La capacità è obbligatoria" : ""}
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
                                            control={<Radio/>}
                                            label="Main List"
                                            disabled={isFormList || localData.lists.some((l, i) => l.is_main_list && i !== index)}
                                        />
                                        <FormControlLabel
                                            value="waiting"
                                            control={<Radio/>}
                                            label="Waiting List"
                                            disabled={isFormList || localData.lists.some((l, i) => l.is_waiting_list && i !== index)}
                                        />
                                        <FormControlLabel
                                            value="none"
                                            control={<Radio/>}
                                            label="Altro"
                                            disabled={isFormList}
                                        />
                                    </RadioGroup>
                                </FormControl>
                            </Grid>
                            <Grid size={{xs: 2}}>
                                <IconButton
                                    onClick={() => handleDeleteList(index)}
                                    disabled={isFormList}
                                >
                                    <DeleteIcon/>
                                </IconButton>
                            </Grid>
                        </Grid>
                    )
                })}
            </Box>
        )
    }

    /* Profile data */
    const ProfileData = function ProfileData({dataRef}) {

        const [localData, setLocalData] = useState(dataRef.current);

        // Helpers
        const canonicalProfileOrder = [
            "name", "surname", "birthdate", "email", "latest_esncard", "country", "domicile",
            // removed: "phone_prefix", "whatsapp_prefix"
            "phone_number", "whatsapp_number",
            "latest_document", "course", "matricola_expiration", "person_code", "matricola_number"
        ];

        function orderProfileFields() {
            return canonicalProfileOrder.filter(f => localData.profile_fields.includes(f));
        }

        return (
            <Box my={2}>
                <Typography variant="h6" gutterBottom>Dati Anagrafici</Typography>
                <Typography variant="body2" color="text.secondary" sx={{mb: 1}}>
                    Dati visualizzati nelle liste come colonne, visibili solo a ESNers per aiutare nell&apos;organizzazione.<br/>
                    I dati sono presi dal profilo Erasmus! Richiedi dati aggiornati tra i campi del Form di Iscrizione.<br/>
                    {/* NEW: clarify combined formatting */}
                    Numero Telefono e Numero WhatsApp includono automaticamente il prefisso (es: +39 3396793228).
                </Typography>
                <Select
                    multiple
                    variant="outlined"
                    value={orderProfileFields(localData.profile_fields)}
                    onChange={e => {
                        setLocalData({
                            ...localData,
                            profile_fields: e.target.value,
                        })
                        dataRef.current = {
                            ...dataRef.current,
                            profile_fields: e.target.value,
                        }
                    }}
                    // Always editable, never disabled
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
                        // Exclude technical and prefix-only fields
                        .filter(([k]) =>
                            k !== 'id' &&
                            k !== 'group' &&
                            k !== 'created_at' &&
                            k !== 'phone_prefix' &&
                            k !== 'whatsapp_prefix'
                        )
                        .map(([k, v]) => (
                            <MenuItem key={k} value={k}>
                                {v}
                            </MenuItem>
                        ))}
                </Select>
            </Box>
        )
    }

    /* FieldRow component for additional fields and form fields */
    const FieldRow = function FieldRow({
                                           field,
                                           index,
                                           onUpdate,
                                           onDelete,
                                           addChoice,
                                           updateChoice,
                                           deleteChoice,
                                           disabled,
                                           onMoveUp,
                                           onMoveDown,
                                           isFirst,
                                           isLast,
                                       }) {
        const typeOptions = [
            {value: 't', label: 'Testo'},
            {value: 'n', label: 'Numero'},
            {value: 'c', label: 'Scelta Singola'},
            {value: 'm', label: 'Scelta Multipla'},
            {value: 'b', label: 'Sì/No'},
            {value: 'd', label: 'Data'},
            {value: 'e', label: 'ESNcard'},
            {value: 'p', label: 'Telefono'},
            {value: 'l', label: 'File Upload'},
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

                    <Grid size={{xs: 12, sm: 'auto'}} sx={{display: 'flex', gap: 0.5, alignItems: 'center'}}>
                        <Tooltip title="Sposta su">
                            <span>
                                <IconButton
                                    onClick={() => onMoveUp(index)}
                                    disabled={disabled || isFirst}
                                    size="small"
                                >
                                    <ArrowUpwardIcon fontSize="small"/>
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title="Sposta giù">
                            <span>
                                <IconButton
                                    onClick={() => onMoveDown(index)}
                                    disabled={disabled || isLast}
                                    size="small"
                                >
                                    <ArrowDownwardIcon fontSize="small"/>
                                </IconButton>
                            </span>
                        </Tooltip>
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

    function FieldSection({
                              title,
                              description,
                              fields,
                              onAdd,
                              onUpdate,
                              onDelete,
                              addChoice,
                              updateChoice,
                              deleteChoice,
                              disabled,
                              alert, // NEW: optional alert node rendered under description
                              onMoveUp,
                              onMoveDown
                          }) {

        return (
            <>
                <Box sx={{display: 'flex', alignItems: 'center'}}>
                    <Typography variant="h6">{title}</Typography>
                    <Tooltip title={`Aggiungi`}>
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
                {alert && (
                    <Box sx={{mb: 1}}>
                        {alert}
                    </Box>
                )}
                <Paper elevation={1} sx={{p: 2, mb: 3}}>
                    {fields.length === 0 ? (
                        <Typography color="text.secondary">Nessun campo configurato</Typography>
                    ) : (
                        fields.map((field, i) => {
                            return (
                                <FieldRow
                                    key={i}
                                    field={field}
                                    index={i}
                                    onUpdate={onUpdate}
                                    onDelete={onDelete}
                                    addChoice={addChoice}
                                    updateChoice={updateChoice}
                                    deleteChoice={deleteChoice}
                                    disabled={disabled}
                                    onMoveUp={onMoveUp}
                                    onMoveDown={onMoveDown}
                                    isFirst={i === 0}
                                    isLast={i === fields.length - 1}
                                />
                            );
                        })
                    )}
                </Paper>
            </>
        );
    }


    /* Additional fields */
    const AdditionalFields = function AdditionalFields({dataRef, isEdit, hasSubscriptions}) {

        const [localData, setLocalData] = useState(dataRef.current)

        const globalIndex = function globalIndex(ix) {
            return localData.fields.map(
                (field, index) => {
                    return ({type: field.field_type, index: index})
                }).filter(
                (f) => f.type === 'additional'
            )[ix].index
        }

        const onAdd = function onAdd() {
            let newField = {field_type: 'additional', name: '', type: 'b'}

            // Update local state
            setLocalData({
                ...localData,
                fields: [
                    ...localData.fields,
                    newField
                ]
            })

            // Update data ref
            dataRef.current.fields = [
                ...dataRef.current.fields,
                newField
            ]
        }


        const onDelete = function onDelete(index) {

            let gIndex = globalIndex(index)

            //Update local state
            setLocalData({
                ...localData,
                fields: localData.fields.filter((_, ix) => ix !== gIndex)
            })

            //Update ref
            dataRef.current.fields = dataRef.current.fields.filter((_, ix) => ix !== gIndex)
        }

        const onUpdate = function onUpdate(index, update) {

            let gIndex = globalIndex(index)
            // Create a new updated field (do not mutate original)
            const updated_field = {...localData.fields[gIndex], ...update};

            // Update local state
            setLocalData({
                ...localData,
                fields: [
                    ...localData.fields.slice(0, gIndex),
                    updated_field,
                    ...localData.fields.slice(gIndex + 1),
                ],
            });

            // Update data ref
            dataRef.current.fields = [
                ...dataRef.current.fields.slice(0, gIndex),
                updated_field,
                ...dataRef.current.fields.slice(gIndex + 1),
            ];
        };

        const addChoice = function addChoice(fieldIndex) {

            let gIndex = globalIndex(fieldIndex)

            // Update field
            onUpdate(fieldIndex, {
                choices: [
                    ...localData.fields[gIndex].choices || [],
                    ""
                ]
            })
        }

        const updateChoice = function updateChoice(fieldIndex, choiceIndex, update) {

            let gIndex = globalIndex(fieldIndex)

            //note: update is a string
            onUpdate(fieldIndex, {
                choices: [
                    ...localData.fields[gIndex].choices.slice(0, choiceIndex),
                    update,
                    ...localData.fields[gIndex].choices.slice(choiceIndex + 1)
                ]
            })
        }

        const deleteChoice = function deleteChoice(fieldIndex, choiceIndex) {

            let gIndex = globalIndex(fieldIndex)

            onUpdate(fieldIndex,
                {choices: localData.fields[gIndex].choices.filter((_, i) => i !== choiceIndex)})
        }

        const onMoveUp = function onMoveUp(index) {
            if (index === 0) return;

            let gIndex = globalIndex(index)
            let gIndexPrev = globalIndex(index - 1)

            const newFields = [...localData.fields];
            [newFields[gIndexPrev], newFields[gIndex]] = [newFields[gIndex], newFields[gIndexPrev]];

            // Update local state
            setLocalData({
                ...localData,
                fields: newFields
            });

            // Update ref
            dataRef.current.fields = newFields;
        }

        const onMoveDown = function onMoveDown(index) {
            const additionalFields = localData.fields.filter(f => f.field_type === 'additional');
            if (index === additionalFields.length - 1) return;

            let gIndex = globalIndex(index)
            let gIndexNext = globalIndex(index + 1)

            const newFields = [...localData.fields];
            [newFields[gIndex], newFields[gIndexNext]] = [newFields[gIndexNext], newFields[gIndex]];

            // Update local state
            setLocalData({
                ...localData,
                fields: newFields
            });

            // Update ref
            dataRef.current.fields = newFields;
        }

        return (
            <FieldSection
                title={"Campi aggiuntivi"}
                description={"Dati visualizzati nelle liste come colonne, visibili solo a ESNers per aiutare nell'organizzazione."}
                fields={localData.fields.filter((field) => field.field_type === "additional")}
                onAdd={onAdd}
                onDelete={onDelete}
                onUpdate={onUpdate}
                addChoice={addChoice}
                updateChoice={updateChoice}
                deleteChoice={deleteChoice}
                disabled={isEdit && hasSubscriptions}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
            />
        )
    }

    /* Form block */
    const FormBlock = function FormBlock({dataRef, errorsRef, hasSubscriptions, isEdit}) {

        const [localData, setLocalData] = useState(dataRef.current)
        const [localErrors] = useState(errorsRef.current)

        //Helpers
        const setFormOpenTime = function setFormOpenTime(val) {
            let t = val && val.isValid() ? val.toISOString() : null;

            // Ensure it's after subscription start date
            if (t && localData.subscription_start_date && dayjs(t).isBefore(dayjs(localData.subscription_start_date))) {
                t = dayjs(localData.subscription_start_date).add(1, 'minute').toISOString()
            }

            // Ensure it's before subscription end date
            if (t && localData.subscription_end_date && dayjs(t).isAfter(dayjs(localData.subscription_end_date))) {
                t = dayjs(localData.subscription_end_date).subtract(1, 'minute').toISOString()
            }

            //Update local data
            setLocalData({
                ...localData,
                form_programmed_open_time: t
            })

            //Update ref
            dataRef.current.form_programmed_open_time = t
        }

        const setAllowOnlinePayment = function setAllowOnlinePayment(val) {
            //Update local data
            setLocalData({
                ...localData,
                allow_online_payment: val
            })

            //Update ref
            dataRef.current.allow_online_payment = val
        }

        // Form field helpers
        const globalIndex = function globalIndex(ix) {
            return localData.fields.map(
                (field, index) => {
                    return ({type: field.field_type, index: index})
                }).filter(
                (f) => f.type === 'form'
            )[ix].index
        }

        const onAdd = function onAdd() {
            let newField = {field_type: 'form', name: '', type: 'b'}

            // Update local state
            setLocalData({
                ...localData,
                fields: [
                    ...localData.fields,
                    newField
                ]
            })

            // Update data ref
            dataRef.current.fields = [
                ...dataRef.current.fields,
                newField
            ]
        }

        const onDelete = function onDelete(index) {

            let gIndex = globalIndex(index)

            //Update local state
            setLocalData({
                ...localData,
                fields: localData.fields.filter((_, ix) => ix !== gIndex)
            })

            //Update ref
            dataRef.current.fields = dataRef.current.fields.filter((_, ix) => ix !== gIndex)
        }

        const onUpdate = function onUpdate(index, update) {

            let gIndex = globalIndex(index)
            // Create a new updated field (do not mutate original)
            const updated_field = {...localData.fields[gIndex], ...update};

            // Update local state
            setLocalData({
                ...localData,
                fields: [
                    ...localData.fields.slice(0, gIndex),
                    updated_field,
                    ...localData.fields.slice(gIndex + 1),
                ],
            });

            // Update data ref
            dataRef.current.fields = [
                ...dataRef.current.fields.slice(0, gIndex),
                updated_field,
                ...dataRef.current.fields.slice(gIndex + 1),
            ];
        };

        const addChoice = function addChoice(fieldIndex) {

            let gIndex = globalIndex(fieldIndex)

            // Update field
            onUpdate(fieldIndex, {
                choices: [
                    ...localData.fields[gIndex].choices || [],
                    ""
                ]
            })
        }

        const updateChoice = function updateChoice(fieldIndex, choiceIndex, update) {

            let gIndex = globalIndex(fieldIndex)

            //note: update is a string
            onUpdate(fieldIndex, {
                choices: [
                    ...localData.fields[gIndex].choices.slice(0, choiceIndex),
                    update,
                    ...localData.fields[gIndex].choices.slice(choiceIndex + 1)
                ]
            })
        }

        const deleteChoice = function deleteChoice(fieldIndex, choiceIndex) {

            let gIndex = globalIndex(fieldIndex)

            onUpdate(fieldIndex,
                {choices: localData.fields[gIndex].choices.filter((_, i) => i !== choiceIndex)})
        }

        const onMoveUp = function onMoveUp(index) {
            if (index === 0) return;

            let gIndex = globalIndex(index)
            let gIndexPrev = globalIndex(index - 1)

            const newFields = [...localData.fields];
            [newFields[gIndexPrev], newFields[gIndex]] = [newFields[gIndex], newFields[gIndexPrev]];

            // Update local state
            setLocalData({
                ...localData,
                fields: newFields
            });

            // Update ref
            dataRef.current.fields = newFields;
        }

        const onMoveDown = function onMoveDown(index) {
            const formFields = localData.fields.filter(f => f.field_type === 'form');
            if (index === formFields.length - 1) return;

            let gIndex = globalIndex(index)
            let gIndexNext = globalIndex(index + 1)

            const newFields = [...localData.fields];
            [newFields[gIndex], newFields[gIndexNext]] = [newFields[gIndexNext], newFields[gIndex]];

            // Update local state
            setLocalData({
                ...localData,
                fields: newFields
            });

            // Update ref
            dataRef.current.fields = newFields;
        }

        return (
            <>
                <Grid size={{xs: 12, md: 4}} sx={{mt: 3}}>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={!!localData.enable_form}
                                onChange={(e) => {
                                    if (isEdit && hasSubscriptions) return;
                                    const enabled = e.target.checked;
                                    setLocalData({
                                        ...localData,
                                        enable_form: enabled,
                                        form_programmed_open_time: enabled
                                            ? (localData.form_programmed_open_time || dayjs().add(1, 'hour').toISOString())
                                            : null
                                    });
                                    dataRef.current.enable_form = enabled;
                                    dataRef.current.form_programmed_open_time = enabled
                                        ? (dataRef.current.form_programmed_open_time || dayjs().add(1, 'hour').toISOString())
                                        : null;
                                }}
                                name="enable_form"
                                color="primary"
                                disabled={isEdit && hasSubscriptions}
                            />
                        }
                        label="Abilita Form Iscrizione"
                    />
                </Grid>

                {localData.enable_form && (
                    <Alert severity="info" sx={{mt: 1}}>
                        Abilitando il form viene creata automaticamente la lista &#34;Form List&#34;.
                        Le iscrizioni online finiscono lì e saranno spostate automaticamente in Main/Waiting List al pagamento online,
                        oppure manualmente quando pagano in ufficio. Il nome della lista non sarà modificabile, ma la capacità sì (default: illimitata).
                    </Alert>
                )}

                {localData.enable_form && <Paper elevation={3} sx={{p: 2, my: 2}}>
                    <Typography variant="h5" gutterBottom>Impostazioni Form di Iscrizione Online</Typography>

                    {/* Display validation errors if present */}
                    {localErrors.form[0] && (
                        <Typography color="error" sx={{mb: 2}}>
                            {localErrors.form[1]}
                        </Typography>
                    )}

                    {/* --- Abilita Form Iscrizione extra options --- */}
                    <Box my={2}>
                        <Grid container spacing={2} sx={{mt: 2}}>
                            <Grid size={{xs: 12, md: 4}}>
                                <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='en-gb'>
                                    <DateTimePicker
                                        label={eventNames.form_programmed_open_time}
                                        value={localData.form_programmed_open_time ? dayjs(localData.form_programmed_open_time) : null}
                                        onChange={val => setFormOpenTime(val)}
                                        minDate={localData.subscription_start_date ? dayjs(localData.subscription_start_date).add(1, 'minute') : dayjs()}
                                        maxDate={localData.subscription_end_date ? dayjs(localData.subscription_end_date).subtract(1, 'minute') : null}
                                        slotProps={{
                                            textField: {
                                                fullWidth: true,
                                                required: true,
                                            }
                                        }}
                                        //disabled={formOpenTimeDisabled}
                                        required
                                    />
                                </LocalizationProvider>
                                <Typography variant="body2" color="text.secondary" sx={{mt: 1}}>
                                    Per chiudere il form, agire sul campo di fine iscrizioni.
                                </Typography>
                            </Grid>
                            <Grid size={{xs: 12, md: 4}} sx={{ml: 2}}>
                                <FormControlLabel
                                    label="Consenti pagamenti online"
                                    control={
                                        <Switch
                                            checked={!!localData.allow_online_payment}
                                            onChange={e => setAllowOnlinePayment(e.target.checked)}
                                            name="allow_online_payment"
                                            color="primary"
                                            disabled={isEdit && hasSubscriptions}
                                        />
                                    }
                                />
                            </Grid>
                        </Grid>
                    </Box>
                    <FieldSection
                        title={"Campi form"}
                        description={"Campi richiesti nel form. Le risposte sono visualizzate nelle liste."}
                        alert={
                            <Alert severity="info" sx={{mt: 1}}>
                                L&apos;email viene sempre raccolta prima della compilazione del form: non aggiungere un campo Email.
                                Per mostrarla nelle liste selezionala tra i Dati Anagrafici.
                            </Alert>
                        }
                        fields={localData.fields.filter((field) => field.field_type === "form")}
                        onAdd={onAdd}
                        onDelete={onDelete}
                        onUpdate={onUpdate}
                        addChoice={addChoice}
                        updateChoice={updateChoice}
                        deleteChoice={deleteChoice}
                        disabled={isEdit && hasSubscriptions}
                        onMoveUp={onMoveUp}
                        onMoveDown={onMoveDown}
                    />
                </Paper>}
            </>
        )
    }

    /* Data ref */
    const dataRef = React.useRef({
        name: '',
        date: dayjs(),
        cost: '',
        deposit: '',
        description: '',
        subscription_start_date: dayjs().hour(12).minute(0),
        subscription_end_date: dayjs().hour(24).minute(0),
        is_a_bando: false,
        is_allow_external: false,
        notify_list: true,
        is_variable_fee: false,
        allow_online_payment: false,
        organizers: [],
        lists: [{id: '', name: 'Main List', capacity: '', is_main_list: true}], // set default as Main List type
        profile_fields: [],
        fields: [],
        enable_form: false,
        form_programmed_open_time: dayjs(),
    })

    /* State variables*/
    const [isLoading, setLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState(null);
    const [hasSubscriptions, setHasSubscriptions] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [popup, setPopup] = useState(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [, setSeed] = useState(0); // Used to trigger re-renders when displaying errors
    const [subscriptionWindowVersion, setSubscriptionWindowVersion] = useState(0); // triggers FormBlock remount on subscription window changes

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

            dataRef.current = {
                ...dataRef.current,
                ...eventData
            }
            // Remove fields we don't want selectable anymore
            dataRef.current.profile_fields = (dataRef.current.profile_fields || []).filter(
                f => !['created_at', 'phone_prefix', 'whatsapp_prefix'].includes(f)
            );
            setHasSubscriptions(event.subscriptions && event.subscriptions.length > 0);
        } else {
            dataRef.current = {
                ...dataRef.current,
                organizers: [],
                profile_fields: ['name', 'surname', 'email'],
                fields: [
                    {field_type: 'form', name: 'Vegetarian?', type: 'b', required: true}
                ],
            }
            // Safety: ensure created_at never slips in
            dataRef.current.profile_fields = dataRef.current.profile_fields.filter(f => f !== 'created_at');
        }
        setLoading(false);
    }, []);

    const formatDateString = (date) => {
        return dayjs(date).format('YYYY-MM-DD');
    };

    const formatDateTimeString = (date) => {
        return dayjs(date).toISOString();
    };

    const convert = (data) => {
        // Exclude keys we don't want to send without creating unused variables
        const rest = {...data};
        delete rest.subscriptions;
        delete rest.form_fields;
        delete rest.additional_fields;

        return {
            ...rest,
            name: (rest.name || '').trim(),
            date: formatDateString(rest.date),
            description: rest.description,
            subscription_start_date: formatDateTimeString(rest.subscription_start_date),
            subscription_end_date: formatDateTimeString(rest.subscription_end_date),
            cost: Number(rest.cost || 0).toFixed(2),
            deposit: Number(rest.deposit || 0).toFixed(2),
            lists: (rest.lists || []).map(t => ({
                id: t.id || null,
                name: t.name,
                capacity: Math.floor(Number(t.capacity || 0)),
                is_main_list: !!t.is_main_list,
                is_waiting_list: !!t.is_waiting_list
            })),
            is_a_bando: !!rest.is_a_bando,
            is_allow_external: !!rest.is_allow_external,
            notify_list: !!rest.notify_list,
            fields: rest.fields ?? [],
            allow_online_payment: !!rest.allow_online_payment,
            enable_form: !!rest.enable_form,
            form_programmed_open_time: rest.enable_form ? (rest.form_programmed_open_time || null) : null,
            organizers: (rest.organizers || []).map(o => ({
                profile: o.profile,
                is_lead: !!o.is_lead
            }))
        };
    };

    const scrollUp = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });

        //Trigger re-render to display errors
        setSeed(s => s + 1)
    }

    // Helper
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

    // Validate form fields
    const validateFormFields = () => {

        // Enforce email in form fields if form is enabled
        // TODO: actually enforce it

        const cleaned = normalizeFieldsForValidation(dataRef.current.fields);

        for (let i = 0; i < cleaned.length; i++) {
            const field = cleaned[i];
            if (!field.name) {

                errorsRef.current.form = `Tutti i campi devono avere un nome (manca il nome al campo #${i + 1}).`
                return false;
            }
            if (['c', 'm'].includes(field.type)) {
                if (!Array.isArray(field.choices) || field.choices.length === 0) {

                    errorsRef.current.form = `Il campo "${field.name}" deve avere almeno un'opzione valida.`
                    return false;
                }
            }
        }

        errorsRef.current.form = ''
        return true;
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Validate lists - check if any list has empty name or capacity
        const listErrors = dataRef.current.lists.map(list => ({
            name: !list.name.trim(),
            capacity: list.capacity === ''
        }));

        const hasListErrors = listErrors.some(error => error.name || error.capacity);
        errorsRef.current = {...errorsRef.current, listItems: listErrors, lists: [hasListErrors]};
        if (hasListErrors) {
            setStatusMessage({message: 'Errore campi Liste', state: 'error'});
            scrollUp();
            return;
        }

        // Validate fields names and choices
        if (dataRef.current.enable_form) {
            if (!validateFormFields()) {
                setStatusMessage({
                    message: 'Errore nei campi del form: tutti i nomi e le opzioni devono essere compilati.',
                    state: 'error'
                });
                scrollUp();
                return;
            }
        }

        // Prevent submit if form is enabled but no form_programmed_open_time is set
        if (dataRef.current.enable_form && !dataRef.current.form_programmed_open_time) {
            setStatusMessage({
                message: 'Devi specificare l\'orario di apertura del form iscrizione.',
                state: 'error'
            });
            scrollUp();
            return;
        }

        setSubmitting(true);

        const payload = convert(dataRef.current)
        const method = isEdit ? "PATCH" : "POST";
        const url = isEdit ? `/event/${dataRef.current.id}/` : '/event/';

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
        fetchCustom("DELETE", `/event/${dataRef.current.id}/`, {
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

    const title = isEdit ? 'Modifica evento - ' + event.name : 'Crea Evento';

    return (
        <Modal open={open} onClose={handleClose}>
            <Box sx={style} component="form" onSubmit={handleSubmit} noValidate={false}>
                {isLoading ? <Loader/> : (
                    <>
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

                        <GeneralInfoBlock
                            dataRef={dataRef}
                            errorsRef={errorsRef}
                            hasSubscriptions={isEdit && hasSubscriptions}
                            isEdit={isEdit}
                            onSubscriptionWindowChange={() => setSubscriptionWindowVersion(v => v + 1)}
                        />
                        <Description dataRef={dataRef}/>
                        <Organizers dataRef={dataRef}/>
                        <Lists dataRef={dataRef} errorsRef={errorsRef} isEdit={isEdit}/>
                        <ProfileData dataRef={dataRef} formFieldsDisabled={isEdit && hasSubscriptions}/>
                        <AdditionalFields dataRef={dataRef} isEdit={isEdit} hasSubscriptions={hasSubscriptions}/>
                        <FormBlock
                            key={subscriptionWindowVersion} // force remount so minDate updates when subscription start date changes
                            dataRef={dataRef}
                            errorsRef={errorsRef}
                            hasSubscriptions={hasSubscriptions}
                            isEdit={isEdit}
                        />

                        <Box mt={2} sx={{display: 'flex', gap: 2}}>
                            <Button variant="contained" color="primary" type="submit" disabled={submitting}>
                                {submitting ? (
                                    <CircularProgress size={24}
                                                      color="inherit"/>) : (isEdit ? 'Salva Modifiche' : 'Crea')}
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
