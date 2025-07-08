import {Box, Button, Card, FormControl, InputLabel, MenuItem, Select, TextField, Toolbar, Typography, Grid, IconButton} from "@mui/material";
import {useEffect, useMemo, useState} from 'react';
import {DatePicker, LocalizationProvider} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import EditButton from "../../Components/EditButton";
import CrudTable from "../../Components/CrudTable";
import {fetchCustom} from "../../api/api";
import {useAuth} from "../../Context/AuthContext";
import Popup from '../../Components/Popup'
import {profileDisplayNames as names} from '../../utils/displayAttributes';
import ESNcardEmissionModal from "../../Components/profiles/ESNcardEmissionModal";
import Loader from "../../Components/Loader";
import countryCodes from "../../data/countryCodes.json";
import {extractErrorMessage} from "../../utils/errorHandling";
import {Person, School, Group} from '@mui/icons-material';
import {useNavigate, useParams} from "react-router-dom";
import Sidebar from "../../Components/Sidebar";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import * as Sentry from "@sentry/react";
import SubscriptionModal from "../../Components/events/SubscriptionModal";
import EventSelectorModal from "../../Components/profiles/EventSelectorModal";
import {MRT_Table, useMaterialReactTable} from 'material-react-table';
import {MRT_Localization_IT} from 'material-react-table/locales/it';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

const profileFieldRules = {
    ESNer: {hideFields: ['course', 'matricola_expiration', 'whatsapp_prefix', 'whatsapp_number']},
    Erasmus: {hideFields: ['group']}
};

export default function Profile() {
    const {user} = useAuth();
    const {id} = useParams();
    const [saving, setSaving] = useState(false); /* true when making api call to save data */
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);
    const [popup, setPopup] = useState(null);
    const [ESNcardModalOpen, setESNcardModalOpen] = useState(false);
    const [esncardErrors, setESNcardErrors] = useState({})
    const [documentErrors, setDocumentErrors] = useState({})
    const [groups, setGroups] = useState([]);
    const [profileType, setProfileType] = useState(null);
    const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
    const [subscriptionEvent, setSubscriptionEvent] = useState(null);
    const [eventSelectorModalOpen, setEventSelectorModalOpen] = useState(false);
    const [subscriptions, setSubscriptions] = useState([]); // For MRT_Table
    const navigate = useNavigate();
    //console.log("ProfileModal profile:", profile);
    // Qua puoi disattivare manualmente i permessi degli utenti
    // user.permissions = user.permissions.filter((permission) => !['delete_document', 'change_document', 'add_document'].includes(permission));

    const [data, setData] = useState({  /* profile fields */
        email: '',
        name: '',
        surname: '',
        birthdate: '',
        country: '',
        phone_prefix: '',
        phone_number: '',
        whatsapp_prefix: '',
        whatsapp_number: '',
        person_code: '',
        domicile: '',
        course: '',
        matricola_number: '',
        matricola_expiration: '',
        documents: [],
        esncards: [],
        group: ''
    });
    const [updatedData, setUpdatedData] = useState({    /* profile fields when edited */
        email: '',
        name: '',
        surname: '',
        birthdate: '',
        country: '',
        phone_prefix: '',
        phone_number: '',
        whatsapp_prefix: '',
        whatsapp_number: '',
        person_code: '',
        domicile: '',
        course: '',
        matricola_number: '',
        matricola_expiration: '',
        group: ''
    });
    const [errors, setErrors] = useState({  /* validation errors */
        email: [false, ''],
        name: [false, ''],
        surname: [false, ''],
        birthdate: [false, ''],
        country: [false, ''],
        phone_prefix: [false, ''],
        phone_number: [false, ''],
        whatsapp_prefix: [false, ''],
        whatsapp_number: [false, ''],
        person_code: [false, ''],
        domicile: [false, ''],
        course: [false, ''],
        matricola_number: [false, ''],
        matricola_expiration: [false, ''],
        group: [false, '']
    });
    const [readOnly, setReadOnly] = useState({  /* readonly states for profile fields */
        email: true,
        name: true,
        surname: true,
        birthdate: true,
        country: true,
        phone_prefix: true,
        phone_number: true,
        whatsapp_prefix: true,
        whatsapp_number: true,
        person_code: true,
        domicile: true,
        course: true,
        matricola_number: true,
        matricola_expiration: true,
        group: true
    });

    useEffect(() => {
        setLoading(true);
        const fetchData = async () => {
            try {
                const response = await fetchCustom("GET", `/profile/${id}/`);
                const json = await response.json();
                if (!response.ok) {
                    const errorMessage = await extractErrorMessage(json, response.status);
                    setPopup({message: `Errore: ${errorMessage}`, state: 'error'});
                } else {
                    const update = {};
                    Object.keys(data).map((key) => {
                        update[key] = json[key];
                    });
                    setData(update)
                    setUpdatedData(update)
                    setProfile(json);
                    setProfileType(json.is_esner ? "ESNer" : "Erasmus");
                }
            } catch (error) {
                Sentry.captureException(error);
                setPopup({message: `Errore generale: ${error}`, state: "error"});
            } finally {
                setLoading(false);
            }
        };
        fetchData().then();
    }, []);

    // Fetch subscriptions for MRT_Table
    useEffect(() => {
        const fetchSubscriptions = async () => {
            try {
                const response = await fetchCustom("GET", `/profile_subscriptions/${id}/`);
                const json = await response.json();
                if (response.ok) setSubscriptions(json);
                else setSubscriptions([]);
            } catch (error) {
                Sentry.captureException(error);
                setSubscriptions([]);
            }
        };
        fetchSubscriptions().then();
    }, [id]);

    useEffect(() => {
        const fetchGroups = async () => {
            try {
                const response = await fetchCustom("GET", "/groups/");
                const json = await response.json();
                if (response.ok) setGroups(json);
                else setPopup({message: `Errore nel recupero dei gruppi: ${await extractErrorMessage(json, response.status)}`, state: "error"});
            } catch (error) {
                Sentry.captureException(error);
                setPopup({message: `Errore generale: ${error}`, state: "error"});
            }
        };
        fetchGroups().then();
    }, []);


    const rules = profileFieldRules[profileType] || {hideFields: []};
    const shouldHideField = (fieldName) => {
        return rules.hideFields.includes(fieldName);
    };

    const refreshProfileData = async () => {
        try {
            const response = await fetchCustom("GET", `/profile/${profile.id.toString()}/`);
            const json = await response.json();
            if (!response.ok) {
                const errorMessage = await extractErrorMessage(json, response.status);
                setPopup({message: `Errore: ${errorMessage}`, state: 'error'});
            } else {
                setData(json);
                setUpdatedData(json);
                setProfile(json);
            }
        } catch (error) {
            Sentry.captureException(error);
            setPopup({message: `Errore generale: ${error}`, state: "error"});
        }
    };

    const handleOpenESNcardModal = () => {
        setESNcardModalOpen(true);
    };

    const handleCloseESNcardModal = async (success) => {
        setESNcardModalOpen(false);
        if (success) {
            setPopup({message: "ESNcard emessa con successo!", state: "success"});
            await refreshProfileData();
        }
    };

    /* columns for esncard table */
    const esncard_columns = useMemo(() => [
        {
            accessorKey: 'number',
            header: 'Numero',
            size: 100,
            muiEditTextFieldProps: {
                required: true,
                helperText: esncardErrors?.number,
                error: !!esncardErrors?.number
            },
        },
        {
            accessorKey: 'created_at',
            enableEditing: false,
            header: 'Rilascio',
            size: 100,
            Cell: ({cell}) => {
                const date = new Date(cell.getValue());
                return date == null ? 'Null' : date.toISOString().split('T')[0];
            }
        },
        {
            accessorKey: 'expiration',
            enableEditing: false,
            header: 'Scadenza',
            size: 100,
            Cell: ({cell}) => {
                const expirationDate = new Date(cell.getValue());
                const today = new Date();
                const isExpired = expirationDate < today;
                return (
                    <span style={{color: isExpired ? 'orange' : 'green'}}>
                        {cell.getValue()}
                    </span>
                );
            }
        },
    ], []);

    const saveESNcard = async (row, values) => {
        try {
            const response = await fetchCustom("PATCH", `/esncard/${row.id}/`, values);
            if (!response.ok) {
                const json = await response.json();
                const errorMessage = await extractErrorMessage(json, response.status);
                setPopup({message: `Errore: ${errorMessage}`, state: 'error'});
                return false;
            } else {
                setESNcardErrors({});
                setPopup({message: "ESNcard aggiornata con successo!", state: "success"});
                await refreshProfileData();
                return true;
            }
        } catch (error) {
            Sentry.captureException(error);
            setPopup({message: `Errore generale: ${error}`, state: "error"});
        }
    }

    /* columns for documents table */
    const document_columns = useMemo(() => [
        {
            accessorKey: 'type',
            header: 'Tipo',
            size: 100,
            editVariant: 'select',
            editSelectOptions: ['Passport', 'ID Card', 'Driving License', 'Residency Permit', 'Other'],
            muiEditTextFieldProps: {
                select: true,
                helperText: documentErrors?.type,
                error: !!documentErrors?.type,
            }
        },
        {
            accessorKey: 'number',
            header: 'Numero',
            size: 60,
            muiEditTextFieldProps: {
                required: true,
                helperText: documentErrors?.number,
                error: !!documentErrors?.number
            },
        },
        {
            accessorKey: 'expiration',
            header: 'Scadenza',
            size: 60,
            muiEditTextFieldProps: {
                required: true,
                helperText: documentErrors?.expiration,
                error: !!documentErrors?.expiration,
                type: 'date'
            },
            Cell: ({cell}) => {
                const expirationDate = new Date(cell.getValue());
                const today = new Date();
                const isExpired = expirationDate < today;
                return (
                    <span style={{color: isExpired ? 'orange' : 'green'}}>
                        {cell.getValue()}
                    </span>
                );
            }
        },


    ], []);

    const deleteDocument = async (row) => {
        try {
            const response = await fetchCustom("DELETE", `/document/${row.id}/`);
            if (!response.ok) {
                response.json().then((errors) => setDocumentErrors(errors))
                const json = await response.json();
                const errorMessage = await extractErrorMessage(json, response.status);
                setPopup({message: `Errore: ${errorMessage}`, state: 'error'});
            } else {
                setDocumentErrors({});
                setPopup({message: "Documento eliminato con successo!", state: "success"});
                await refreshProfileData();
                return true;
            }
        } catch (error) {
            Sentry.captureException(error);
            setPopup({message: `Errore generale: ${error}`, state: "error"});
        }
    };

    /* document creation */
    const createDocument = async (values) => {
        let val = {...values, profile: profile.id};
        try {
            const response = await fetchCustom("POST", '/document/', val);
            if (!response.ok) {
                response.json().then((errors) => setDocumentErrors(errors))
                const json = await response.json();
                const errorMessage = await extractErrorMessage(json, response.status);
                setPopup({message: `Errore: ${errorMessage}`, state: 'error'});
                return false;
            } else {
                setDocumentErrors({});
                setPopup({message: "Documento aggiunto con successo!", state: "success"});
                await refreshProfileData();
                return true;
            }
        } catch (error) {
            Sentry.captureException(error);
            setPopup({message: `Errore generale: ${error}`, state: "error"});
            return false;
        }
    };

    /* save edited document */
    const saveDocument = async (row, values) => {
        try {
            const response = await fetchCustom("PATCH", `/document/${row.id}/`, values);
            if (!response.ok) {
                response.json().then((errors) => setDocumentErrors(errors))
                const json = await response.json();
                const errorMessage = await extractErrorMessage(json, response.status);
                setPopup({message: `Errore: ${errorMessage}`, state: 'error'});
                return false;
            } else {
                setDocumentErrors({});
                setPopup({message: "Documento aggiornato con successo!", state: "success"});
                await refreshProfileData();
                return true;
            }
        } catch (error) {
            Sentry.captureException(error);
            setPopup({message: `Errore generale: ${error}`, state: "error"});
            return false;
        }
    }

    const formatDateString = (date) => {
        if (!date) return null;
        return dayjs(date).format('YYYY-MM-DD');
    };

    const handleChange = (e) => {
        setUpdatedData({
            ...updatedData,
            [e.target.name]: e.target.value,
        });
    };

    const handleDateChange = (name, date) => {
        setUpdatedData({
            ...updatedData,
            [name]: date,
        });
    };

    const resetErrors = () => {
        const resetObj = {};
        Object.keys(errors).forEach(key => {
            resetObj[key] = [false, ''];
        });
        setErrors(resetObj);
    };

    const toggleEdit = (edit) => {
        setReadOnly(Object.fromEntries(Object.keys(readOnly).map((k) =>
            [k, !edit]
        )));
        resetErrors();
    };

    const handleSave = async () => {
        setSaving(true);

        // Check if matricola_number is provided and verify it's exactly 6 digits
        if (updatedData.matricola_number && !/^\d{6}$/.test(updatedData.matricola_number)) {
            setErrors((prevErrors) => ({
                ...prevErrors,
                matricola_number: [true, 'La Matricola deve essere composta da 6 cifre'],
            }));
            setSaving(false);
            return false;
        }
        try {
            const body = {
                ...updatedData,
                birthdate: formatDateString(updatedData.birthdate),
                matricola_expiration: formatDateString(updatedData.matricola_expiration)
            }
            const response = await fetchCustom("PATCH", `/profile/${profile.id.toString()}/`, body);
            if (!response.ok) {
                const json = await response.json();
                const updatedErrors = Object.fromEntries(Object.keys(errors).map(
                    (e) => {
                        if (e in json) return [e, [true, json[e]]];
                        else return [e, [false, '']];
                    }
                ));
                setErrors(updatedErrors);
            } else {
                await refreshProfileData();
                if (data) {
                    resetErrors();
                    setPopup({message: "Profilo aggiornato con successo!", state: "success"});
                    toggleEdit(false);
                }
            }
        } catch (error) {
            Sentry.captureException(error);
            setUpdatedData(data);
            setPopup({message: `Errore generale: ${error}`, state: "error"});
            toggleEdit(false);
        } finally {
            setSaving(false);
        }
    };

    const handleIscriviAdEvento = () => {
        setEventSelectorModalOpen(true);
    };

    const handleEventSelected = (event) => {
        setSubscriptionEvent(event);
        setEventSelectorModalOpen(false);
        setSubscriptionModalOpen(true);
    };

    const handleSubscriptionModalClose = (success, msg) => {
        setSubscriptionModalOpen(false);
        setSubscriptionEvent(null);
        if (success && msg) setPopup({message: msg, state: "success"});
    };

    const subscriptionsColumns = useMemo(() => [
        {
            accessorKey: 'subscribed_at',
            header: 'Data e Ora Iscrizione',
            size: 120,
            Cell: ({cell}) => {
                const date = cell.getValue();
                if (!date) return '';
                const d = new Date(date);
                return d.toLocaleDateString('it-IT', {day: '2-digit', month: '2-digit', year: 'numeric'}) + ' ' +
                    d.toLocaleTimeString('it-IT');
            }
        },
        {
            accessorKey: 'event_name',
            header: 'Evento',
            size: 150,
            Cell: ({row}) => (
                <span>
                    <Button variant="text"
                            color="primary"
                            sx={{textTransform: 'none', padding: 0, minWidth: 0}}
                            endIcon={<OpenInNewIcon fontSize="small"/>}
                            onClick={() => window.open(`/event/${row.original.event_id}`, '_blank', 'noopener,noreferrer')}>
                        {row.original.event_name}
                    </Button>
                </span>
            ),
        },
        {
            accessorKey: 'list_name',
            header: 'Lista',
            size: 100,
        },
        {
            accessorKey: 'event_date',
            header: 'Data',
            size: 100,
            Cell: ({cell}) => {
                const date = cell.getValue();
                if (!date) return '';
                const d = new Date(date);
                return d.toLocaleDateString('it-IT', {day: '2-digit', month: '2-digit', year: 'numeric'});
            }
        },
        {
            accessorKey: 'status',
            header: 'Stato Pagamento',
            size: 100,
            Cell: ({cell}) => {
                const status = cell.getValue();
                let color;
                let label;
                switch (status) {
                    case 'paid':
                        color = "success";
                        label = "Pagato";
                        break;
                    case 'pending':
                        color = "warning";
                        label = "In attesa";
                        break;
                    default:
                        color = "error";
                        label = status || "Sconosciuto";
                }
                return (
                    <span style={{
                        color:
                            color === "success" ? "#388e3c" :
                                color === "warning" ? "#f57c00" :
                                    "#d32f2f",
                        fontWeight: 600
                    }}>
                        {label}
                    </span>
                );
            }
        },
    ], [navigate]);

    const subscriptionsTable = useMaterialReactTable({
        columns: subscriptionsColumns,
        data: subscriptions,
        enableKeyboardShortcuts: false,
        enableColumnActions: false,
        enableColumnFilters: false,
        enablePagination: false,
        enableSorting: false,
        initialState: {showColumnFilters: false, showGlobalFilter: false},
        paginationDisplayMode: 'default',
        muiTableBodyRowProps: {hover: false},
        localization: MRT_Localization_IT,
    });

    return (
        <Box>
            <Sidebar/>
            {loading ? <Loader/> : (<>
                    <Box sx={{mx: '5%'}}>
                        <Box sx={{display: 'flex', alignItems: 'center', marginBottom: '20px'}}>
                            <IconButton
                                onClick={() => navigate(`/profiles/${profileType === 'ESNer' ? 'esners/' : 'erasmus/'}`)}
                                sx={{mr: 2}}>
                                <ArrowBackIcon/></IconButton>
                            <Typography variant="h4">Profilo {profileType}</Typography>
                        </Box>
                        <Card sx={{p: '20px'}}>
                            <Grid container spacing={2}>
                                {/* --- Personal Information Section --- */}
                                <Grid container size={{xs: 12}} alignItems="center">
                                    <Person/>
                                    <Typography variant="h6" sx={{m: 0}}>Informazioni Personali</Typography>
                                    <Grid sx={{marginLeft: 'auto'}}>
                                        <EditButton
                                            onEdit={() => toggleEdit(true)}
                                            onCancel={() => {
                                                toggleEdit(false);
                                                setUpdatedData(data);
                                            }}
                                            saving={saving}
                                            onSave={handleSave}/>

                                    </Grid>
                                </Grid>
                                {!shouldHideField('name') && (
                                    <Grid size={{xs: 12, md: 3}}>
                                        <TextField
                                            label={names.name}
                                            name='name'
                                            value={updatedData.name}
                                            error={errors.name[0]}
                                            helperText={errors.name[1]}
                                            slotProps={{input: {readOnly: readOnly.name}}}
                                            onChange={handleChange}
                                            sx={{backgroundColor: readOnly.name ? 'grey.200' : 'white'}}
                                            fullWidth/>
                                    </Grid>
                                )}
                                {!shouldHideField('surname') && (
                                    <Grid size={{xs: 12, md: 3}}>
                                        <TextField
                                            label={names.surname}
                                            name='surname'
                                            value={updatedData.surname}
                                            error={errors.surname[0]}
                                            helperText={errors.surname[1]}
                                            onChange={handleChange}
                                            slotProps={{input: {readOnly: readOnly.surname}}}
                                            sx={{backgroundColor: readOnly.surname ? 'grey.200' : 'white'}}
                                            fullWidth/>
                                    </Grid>
                                )}
                                {!shouldHideField('email') && (
                                    <Grid size={{xs: 12, md: 3}}>
                                        <TextField
                                            label={names.email}
                                            name='email'
                                            type='email'
                                            value={updatedData.email}
                                            error={errors.email[0]}
                                            helperText={errors.email[1]}
                                            slotProps={{input: {readOnly: true}}}
                                            sx={{backgroundColor: 'grey.200'}}
                                            onChange={handleChange} fullWidth/>
                                    </Grid>
                                )}
                                {!shouldHideField('birthdate') && (
                                    <Grid size={{xs: 12, md: 3}}>
                                        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='en-gb'>
                                            <DatePicker
                                                label={names.birthdate}
                                                value={updatedData.birthdate ? dayjs(updatedData.birthdate, 'YYYY-MM-DD') : null}
                                                readOnly={readOnly.birthdate}
                                                onChange={(date) => handleDateChange('birthdate', date)}
                                                sx={{backgroundColor: readOnly.birthdate ? 'grey.200' : 'white'}}
                                                slotProps={{textField: {variant: 'outlined'}}}/>
                                        </LocalizationProvider>
                                    </Grid>
                                )}
                                {!shouldHideField('country') && (
                                    <Grid size={{xs: 12, md: 2}}>
                                        <FormControl fullWidth required>
                                            <InputLabel id="country-label">{names.country}</InputLabel>
                                            <Select
                                                variant="outlined"
                                                labelId="country-label"
                                                name="country"
                                                label={names.country}
                                                value={updatedData.country}
                                                error={errors.country[0]}
                                                onChange={handleChange}
                                                slotProps={{input: {readOnly: readOnly.country}}}
                                                sx={{backgroundColor: readOnly.country ? 'grey.200' : 'white'}}>

                                                <MenuItem value=""><em>None</em></MenuItem>
                                                {countryCodes.map((country) => (
                                                    <MenuItem key={country.code} value={country.code}>
                                                        {country.name}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                )}
                                {!shouldHideField('domicile') && (
                                    <Grid size={{xs: 12, md: 4}}>
                                        <TextField
                                            label={names.domicile}
                                            name='domicile'
                                            value={updatedData.domicile}
                                            error={errors.domicile[0]}
                                            helperText={errors.domicile[1]}
                                            onChange={handleChange}
                                            slotProps={{input: {readOnly: readOnly.domicile}}}
                                            sx={{backgroundColor: readOnly.domicile ? 'grey.200' : 'white'}}
                                            fullWidth/>
                                    </Grid>
                                )}
                                {/* --- Phone numbers --- */}
                                {!shouldHideField('phone_prefix') && !shouldHideField('phone_number') && (
                                    <Grid size={{xs: 12}} container spacing={2}>
                                        <Grid size={{xs: 12, md: 1}}>
                                            <FormControl fullWidth required>
                                                <InputLabel id="phone-prefix-label">{names.phone_prefix}</InputLabel>
                                                <Select
                                                    variant="outlined"
                                                    labelId="phone-prefix-label"
                                                    id="phone-prefix"
                                                    name="phone_prefix"
                                                    value={updatedData.phone_prefix || ''}
                                                    onChange={handleChange}
                                                    slotProps={{input: {readOnly: readOnly.phone_number}}}
                                                    sx={{backgroundColor: readOnly.phone_number ? 'grey.200' : 'white'}}
                                                    label={names.phone_prefix}
                                                    renderValue={(value) => value}>
                                                    {countryCodes.map((country) => (
                                                        <MenuItem key={country.code} value={country.dial}>
                                                            {country.dial} ({country.name})
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                        <Grid size={{xs: 12, md: 2}}>
                                            <TextField
                                                label={names.phone_number}
                                                name='phone_number'
                                                value={updatedData.phone_number || ''}
                                                error={errors.phone_number[0]}
                                                helperText={errors.phone_number[1]}
                                                onChange={handleChange}
                                                slotProps={{input: {readOnly: readOnly.phone_number}}}
                                                sx={{backgroundColor: readOnly.phone_number ? 'grey.200' : 'white'}}
                                                fullWidth/>
                                        </Grid>
                                    </Grid>
                                )}
                                {!shouldHideField('whatsapp_prefix') && !shouldHideField('whatsapp_number') && (
                                    <Grid size={{xs: 12}} container spacing={2}>
                                        <Grid size={{xs: 12, md: 1}}>
                                            <FormControl fullWidth required>
                                                <InputLabel id="whatsapp-prefix-label">{names.whatsapp_prefix}</InputLabel>
                                                <Select
                                                    variant="outlined"
                                                    labelId="whatsapp-prefix-label"
                                                    id="whatsapp-prefix"
                                                    name="whatsapp_prefix"
                                                    value={updatedData.whatsapp_prefix || ''}
                                                    onChange={handleChange}
                                                    slotProps={{input: {readOnly: readOnly.whatsapp_prefix}}}
                                                    sx={{backgroundColor: readOnly.whatsapp_prefix ? 'grey.200' : 'white'}}
                                                    label={names.whatsapp_prefix}
                                                    renderValue={(value) => value}>
                                                    {countryCodes.map((country) => (
                                                        <MenuItem key={country.code} value={country.dial}>
                                                            {country.dial} ({country.name})
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                        <Grid size={{xs: 12, md: 2}}>
                                            <TextField
                                                label={names.whatsapp_number}
                                                name='whatsapp_number'
                                                value={updatedData.whatsapp_number || ''}
                                                error={errors.whatsapp_number[0]}
                                                helperText={errors.whatsapp_number[1]}
                                                onChange={handleChange}
                                                slotProps={{input: {readOnly: readOnly.whatsapp_number}}}
                                                sx={{backgroundColor: readOnly.whatsapp_number ? 'grey.200' : 'white'}}
                                                fullWidth/>
                                        </Grid>
                                    </Grid>
                                )}
                                {/* --- Polimi fields --- */}
                                <Grid container size={{xs: 12}} sx={{mt: 2}} alignItems="center">
                                    <School/>
                                    <Typography variant="h6" sx={{m: 0}}>Dati Studente</Typography>
                                </Grid>
                                {!shouldHideField('person_code') && (
                                    <Grid size={{xs: 12, md: 3}}>
                                        <TextField
                                            label={names.person_code}
                                            name='person_code'
                                            value={updatedData.person_code || ''}
                                            error={errors.person_code[0]}
                                            helperText={errors.person_code[1]}
                                            onChange={handleChange}
                                            slotProps={{input: {readOnly: readOnly.person_code}}}
                                            sx={{backgroundColor: readOnly.person_code ? 'grey.200' : 'white'}}
                                            fullWidth/>
                                    </Grid>
                                )}
                                {!shouldHideField('course') && (
                                    <Grid size={{xs: 12, md: 3}}>
                                        <FormControl fullWidth required>
                                            <InputLabel id="course-label">{names.course}</InputLabel>
                                            <Select
                                                variant="outlined"
                                                labelId="course-label"
                                                name="course"
                                                label={names.course}
                                                value={updatedData.course || ''}
                                                onChange={handleChange}
                                                slotProps={{input: {readOnly: readOnly.course}}}
                                                sx={{backgroundColor: readOnly.course ? 'grey.200' : 'white'}}>
                                                <MenuItem value="Engineering">Ingegneria</MenuItem>
                                                <MenuItem value="Design">Design</MenuItem>
                                                <MenuItem value="Architecture">Architettura</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                )}
                                {!shouldHideField('matricola_number') && (
                                    <Grid size={{xs: 12, md: 3}}>
                                        <TextField
                                            label={names.matricola_number}
                                            name='matricola_number'
                                            value={updatedData.matricola_number || ''}
                                            error={errors.matricola_number[0]}
                                            helperText={errors.matricola_number[1]}
                                            onChange={handleChange}
                                            sx={{backgroundColor: readOnly.matricola_number ? 'grey.200' : 'white'}}
                                            type="number"
                                            slotProps={{input: {readOnly: readOnly.matricola_number}}}
                                            fullWidth/>
                                    </Grid>
                                )}
                                {!shouldHideField('matricola_expiration') && (
                                    <Grid size={{xs: 12, md: 3}}>
                                        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='en-gb'>
                                            <DatePicker
                                                label={names.matricola_expiration}
                                                value={updatedData.matricola_expiration ? dayjs(updatedData.matricola_expiration, 'YYYY-MM-DD') : null}
                                                readOnly={readOnly.matricola_expiration}
                                                onChange={(date) => handleDateChange('matricola_expiration', date)}
                                                sx={{backgroundColor: readOnly.matricola_expiration ? 'grey.200' : 'white'}}
                                                slotProps={{textField: {variant: 'outlined'}}}/>
                                        </LocalizationProvider>
                                    </Grid>
                                )}
                                {!shouldHideField('group') && (
                                    <Grid container alignItems="center" spacing={1} sx={{width: '100%', mt: 2}}>
                                        <Group/>
                                        <Grid size={{xs: 12, md: 2}}>
                                            <FormControl fullWidth required>
                                                <InputLabel id="group-label">{names.group}</InputLabel>
                                                <Select
                                                    variant="outlined"
                                                    labelId="group-label"
                                                    label={names.group}
                                                    name="group"
                                                    value={updatedData.group || ''}
                                                    onChange={handleChange}
                                                    slotProps={{input: {readOnly: readOnly.group}}}
                                                    sx={{backgroundColor: readOnly.group ? 'grey.200' : 'white'}}>
                                                    {groups.map((group) => (<MenuItem key={group.name} value={group.name}>{group.name}</MenuItem>))}
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                    </Grid>
                                )}
                            </Grid>
                        </Card>
                        <Card sx={{p: 1, mt: 2, mb: 2, minHeight: '80px', display: 'flex', alignItems: 'center'}}>
                            <Toolbar sx={{justifyContent: 'space-between', width: '100%', p: 0}}>
                                <Typography variant="h6">Azioni</Typography>
                                <Button variant="contained" color="primary" onClick={handleIscriviAdEvento}>
                                    Iscrivi ad Evento
                                </Button>
                            </Toolbar>
                            {ESNcardModalOpen &&
                                <ESNcardEmissionModal
                                    open={ESNcardModalOpen}
                                    profile={profile}
                                    onClose={handleCloseESNcardModal}/>
                            }
                        </Card>
                        {eventSelectorModalOpen && (
                            <EventSelectorModal
                                open={eventSelectorModalOpen}
                                onSelect={handleEventSelected}
                                onClose={() => setEventSelectorModalOpen(false)}
                            />
                        )}
                        {subscriptionModalOpen && subscriptionEvent && (
                            <SubscriptionModal
                                open={subscriptionModalOpen}
                                onClose={handleSubscriptionModalClose}
                                event={subscriptionEvent}
                                listId={subscriptionEvent.selectedList ? subscriptionEvent.selectedList.id : null}
                                subscription={null}
                                isEdit={false}
                                profileId={profile.id}
                                profileName={`${profile.name} ${profile.surname}`}
                            />
                        )}
                        <Grid container sx={{width: '100%', mb: 5}} spacing={2}>
                            <Grid size={{xs: 12, md: 6}}>
                                <CrudTable
                                    cols={document_columns}
                                    canCreate={user.permissions.includes('add_document')}
                                    canEdit={user.permissions.includes('change_document')}
                                    canDelete={user.permissions.includes('delete_document')}
                                    onCreate={createDocument}
                                    onSave={saveDocument}
                                    onDelete={deleteDocument}
                                    initialData={data.documents}
                                    title={'Documenti'}
                                    sortColumn={'expiration'}/>
                            </Grid>
                            <Grid size={{xs: 12, md: 6}}>
                                <CrudTable
                                    cols={esncard_columns}
                                    canCreate={user.permissions.includes('add_esncard')}
                                    onCreate={handleOpenESNcardModal}
                                    createText={!profile.latest_esncard ? "Rilascia" : (profile.latest_esncard.is_valid ? "Card Smarrita" : "Rinnova")}
                                    canEdit={user.permissions.includes('change_esncard')}
                                    onSave={saveESNcard}
                                    initialData={data.esncards}
                                    title={'ESNcards'}
                                    sortColumn={'expiration'}/>
                            </Grid>
                            <Grid size={{xs: 12}}>
                                <Card sx={{p: 2, mt: 2}}>
                                    <Typography variant="h5" sx={{mb: 2}}>Iscrizioni</Typography>
                                    <MRT_Table table={subscriptionsTable}/>
                                </Card>
                            </Grid>
                        </Grid>
                        {popup && <Popup message={popup.message} state={popup.state}/>}
                    </Box>
                </>
            )}
        </Box>
    );
}
