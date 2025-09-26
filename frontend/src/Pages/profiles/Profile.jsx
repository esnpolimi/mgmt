import {
    Box,
    Button,
    Card,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    Toolbar,
    Typography,
    Grid,
    IconButton,
    Collapse,
    Chip, Divider,
    Tooltip,
    Dialog, DialogTitle, DialogContent, DialogActions
} from "@mui/material";
import React, {useEffect, useMemo, useState} from 'react';
import {DatePicker, LocalizationProvider} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import EditButton from "../../Components/EditButton";
import CrudTable from "../../Components/CrudTable";
import {fetchCustom, defaultErrorHandler} from "../../api/api";
import {useAuth} from "../../Context/AuthContext";
import Popup from '../../Components/Popup'
import {profileDisplayNames as names} from '../../utils/displayAttributes';
import ESNcardEmissionModal from "../../Components/profiles/ESNcardEmissionModal";
import Loader from "../../Components/Loader";
import countryCodes from "../../data/countryCodes.json";
import {Person, School, Group} from '@mui/icons-material';
import {useNavigate, useParams} from "react-router-dom";
import Sidebar from "../../Components/Sidebar";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SubscriptionModal from "../../Components/events/SubscriptionModal";
import EventSelectorModal from "../../Components/profiles/EventSelectorModal";
import {MRT_Table, useMaterialReactTable} from 'material-react-table';
import {MRT_Localization_IT} from 'material-react-table/locales/it';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from "@mui/icons-material/Refresh";
import StarIcon from "@mui/icons-material/Star";
import DocumentScannerIcon from '@mui/icons-material/DocumentScanner';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import ListAltIcon from '@mui/icons-material/ListAlt';
import EventIcon from '@mui/icons-material/Event';
import EditIcon from "@mui/icons-material/Edit";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import DeleteIcon from '@mui/icons-material/Delete';
import EmailIcon from '@mui/icons-material/Email';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

const profileFieldRules = {
    ESNer: {hideFields: ['course', 'matricola_expiration', 'whatsapp_prefix', 'whatsapp_number']},
    Erasmus: {hideFields: ['group']}
};

export default function Profile() {
    const {user, logout} = useAuth();
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
    const [organizedEvents, setOrganizedEvents] = useState([]);
    const [showSubscriptions, setShowSubscriptions] = useState(false);
    const [showOrganizedEvents, setShowOrganizedEvents] = useState(false);
    const [financePerms, setFinancePerms] = useState(null); // new
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deletingProfile, setDeletingProfile] = useState(false);
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

    const rules = profileFieldRules[profileType] || {hideFields: []};
    const shouldHideField = (fieldName) => {
        return rules.hideFields.includes(fieldName);
    };

    const fetchFinancePerms = (email) => {
        fetchCustom("GET", `/users/finance-permissions/?email=${encodeURIComponent(email)}`, {
                onSuccess: (data) => setFinancePerms(data),
                onError: () => setFinancePerms(null),
            }
        )
        ;
    };

    useEffect(() => {
        refreshProfileData();
    }, []);

    const refreshProfileData = () => {
        setLoading(true);
        fetchCustom("GET", `/profile/${id}/`, {
            onSuccess: (data) => {
                setData(data);
                setUpdatedData(data);
                setProfile(data);
                setProfileType(data.is_esner ? "ESNer" : "Erasmus");
                fetchSubscriptions();
                fetchGroups();
                if (data.is_esner) {
                    fetchOrganizedEvents();
                    // Fetch finance perms only for ESNers (Aspiranti toggle case)
                    fetchFinancePerms(data.email);
                }
            },
            onError: (responseOrError) => defaultErrorHandler(responseOrError, setPopup),
            onFinally: () => setLoading(false)
        });
    };

    const fetchSubscriptions = () => {
        fetchCustom("GET", `/profile_subscriptions/${id}/`, {
            onSuccess: (data) => setSubscriptions(data),
            onError: () => setSubscriptions([]),
        });
    };

    const fetchGroups = () => {
        fetchCustom("GET", "/groups/", {
            onSuccess: (data) => setGroups(data),
            onError: (responseOrError) => defaultErrorHandler(responseOrError, setPopup),
        });
    };

    const fetchOrganizedEvents = () => {
        fetchCustom("GET", `/profile_events/${id}/`, {
            onSuccess: (data) => setOrganizedEvents(data),
            onError: () => setOrganizedEvents([]),
        });
    };

    const handleOpenESNcardModal = () => {
        setESNcardModalOpen(true);
    };

    const handleCloseESNcardModal = (success) => {
        setESNcardModalOpen(false);
        if (success) {
            setPopup({message: "ESNcard emessa con successo!", state: "success", id: Date.now()});
            refreshProfileData();
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

    const saveESNcard = (row, values) => {
        setSaving(true);
        fetchCustom("PATCH", `/esncard/${row.id}/`, {
            body: values,
            onSuccess: () => {
                setESNcardErrors({});
                setPopup({message: "ESNcard aggiornata con successo!", state: "success", id: Date.now()});
                refreshProfileData();
            },
            onError: (responseOrError) => setPopup({
                message: "Errore nell'aggiornamento ESNcard: " + responseOrError.message,
                state: "error",
                id: Date.now()
            }),
            onFinally: () => setSaving(false)
        });
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

    const deleteDocument = (row) => {
        setSaving(true);
        fetchCustom("DELETE", `/document/${row.id}/`, {
            onSuccess: () => {
                setDocumentErrors({});
                setPopup({message: "Documento eliminato con successo!", state: "success", id: Date.now()});
                refreshProfileData();
            },
            onError: (responseOrError) => defaultErrorHandler(responseOrError, setPopup),
            onFinally: () => setSaving(false)
        });
    };

    /* document creation */
    const createDocument = (values) => {
        setSaving(true);
        let val = {...values, profile: profile.id};
        fetchCustom("POST", '/document/', {
            body: val,
            onSuccess: () => {
                setDocumentErrors({});
                setPopup({message: "Documento aggiunto con successo!", state: "success", id: Date.now()});
                refreshProfileData();
            },
            onError: (responseOrError) => defaultErrorHandler(responseOrError, setPopup),
            onFinally: () => setSaving(false)
        });
    };

    /* save edited document */
    const saveDocument = (row, values) => {
        setSaving(true);
        fetchCustom("PATCH", `/document/${row.id}/`, {
            body: values,
            onSuccess: () => {
                setDocumentErrors({});
                setPopup({message: "Documento aggiornato con successo!", state: "success", id: Date.now()});
                refreshProfileData();
            },
            onError: (responseOrError) => defaultErrorHandler(responseOrError, setPopup),
            onFinally: () => setSaving(false)
        });
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

    const handleSave = () => {
        setSaving(true);
        if (updatedData.matricola_number && !/^\d{6}$/.test(updatedData.matricola_number)) {
            setErrors((prevErrors) => ({
                ...prevErrors,
                matricola_number: [true, 'La Matricola deve essere composta da 6 cifre'],
            }));
            setSaving(false);
            return false;
        }
        const body = {
            ...updatedData,
            birthdate: formatDateString(updatedData.birthdate),
            matricola_expiration: formatDateString(updatedData.matricola_expiration)
        };
        const isCurrentUserProfile = user?.profile?.id === profile?.id;
        const groupChanged = isCurrentUserProfile && updatedData.group !== data.group;
        fetchCustom("PATCH", `/profile/${profile.id.toString()}/`, {
            body,
            onSuccess: () => {
                if (groupChanged) {
                    logout();
                    navigate('/login');
                    return;
                }
                refreshProfileData();
                resetErrors();
                setPopup({message: "Profilo aggiornato con successo!", state: "success", id: Date.now()});
                toggleEdit(false);
            },
            onError: (responseOrError) => {
                setUpdatedData(data);
                defaultErrorHandler(responseOrError, setPopup);
                toggleEdit(false);
            },
            onFinally: () => setSaving(false)
        });
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
        if (success) refreshProfileData();
        if (success && msg) setPopup({message: msg, state: "success", id: Date.now()});
    };

    const toggleFinancePerms = () => {
        if (!profile) return;
        const targetEmail = profile.email;
        const enable = !(financePerms?.can_manage_casse || false); // toggle both together
        fetchCustom("PATCH", `/users/finance-permissions/?email=${encodeURIComponent(targetEmail)}`, {
            body: {
                can_manage_casse: enable,
                can_view_casse_import: enable
            },
            onSuccess: (res) => {
                setFinancePerms(res);
                setPopup({
                    message: enable ? 'Permessi casse concessi.' : 'Permessi casse revocati.',
                    state: 'success',
                    id: Date.now()
                });
            },
            onError: (err) => defaultErrorHandler(err, setPopup)
        });
    };

    // Determine which columns to show based on subscriptions data
    const showQuotaColumn = subscriptions.some(sub => sub.status_quota !== undefined && sub.status_quota !== null);
    const showCauzioneColumn = subscriptions.some(sub => sub.status_cauzione !== undefined && sub.status_cauzione !== null);

    const subscriptionsColumns = useMemo(() => {
        const cols = [
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
                header: 'Data Evento',
                size: 100,
                Cell: ({cell}) => {
                    const date = cell.getValue();
                    if (!date) return '';
                    const d = new Date(date);
                    return d.toLocaleDateString('it-IT', {day: '2-digit', month: '2-digit', year: 'numeric'});
                }
            },
        ];
        if (showQuotaColumn) {
            cols.push({
                accessorKey: 'status_quota',
                header: 'Stato Pagamento Quota',
                size: 100,
                Cell: ({cell}) => {
                    const status = cell.getValue();
                    if (!status) return '';
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
                        case 'reimbursed':
                            color = "success";
                            label = "Rimborsato";
                            break;
                        default:
                            color = "error";
                            label = status || "Sconosciuto";
                    }
                    return (
                        <span style={{
                            color: color === "success" ? "#388e3c" : color === "warning" ? "#f57c00" : "#d32f2f",
                            fontWeight: 600
                        }}>
                            {label}
                        </span>
                    );
                }
            });
        }
        if (showCauzioneColumn) {
            cols.push({
                accessorKey: 'status_cauzione',
                header: 'Stato Pagamento Cauzione',
                size: 100,
                Cell: ({cell}) => {
                    const status = cell.getValue();
                    if (!status) return '';
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
                        case 'reimbursed':
                            color = "success";
                            label = "Rimborsato";
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
            });
        }
        return cols;
    }, [subscriptions, navigate, showQuotaColumn, showCauzioneColumn]);

    // Columns for organized events table
    const organizedEventsColumns = [
        {
            accessorKey: 'event_name',
            header: 'Evento',
            Cell: ({row}) => (
                <Button
                    variant="text"
                    color="primary"
                    sx={{textTransform: 'none', padding: 0, minWidth: 0}}
                    endIcon={<OpenInNewIcon fontSize="small"/>}
                    onClick={() => window.open(`/event/${row.original.event_id}`, '_blank', 'noopener,noreferrer')}
                >
                    {row.original.event_name}
                </Button>
            ),
        },
        {
            accessorKey: 'event_date',
            header: 'Data Evento',
            Cell: ({cell}) => {
                const date = cell.getValue();
                if (!date) return '';
                const d = new Date(date);
                return d.toLocaleDateString('it-IT', {day: '2-digit', month: '2-digit', year: 'numeric'});
            }
        },
        {
            accessorKey: 'is_lead',
            header: 'Ruolo',
            Cell: ({cell}) => {
                const isLead = cell.getValue();
                return (
                    <Chip
                        label={isLead ? 'Responsabile Sezione' : 'Responsabile Evento'}
                        color={isLead ? 'primary' : 'default'}
                        icon={isLead ? <StarIcon/> : null}
                    />
                );
            }
        }
    ];

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

    // Table for organized events (no pagination)
    const organizedEventsTable = useMaterialReactTable({
        columns: organizedEventsColumns,
        data: organizedEvents,
        enablePagination: false,
        enableSorting: false,
        enableColumnActions: false,
        enableColumnFilters: false,
        enableGlobalFilter: false,
        initialState: {showColumnFilters: false, showGlobalFilter: false},
        muiTableBodyRowProps: {hover: false},
        localization: MRT_Localization_IT,
    });

    const handleDeleteProfile = () => setDeleteConfirmOpen(true);

    const confirmDeleteProfile = () => {
        setDeletingProfile(true);
        fetchCustom("DELETE", `/profile/${profile.id}/`, {
            onSuccess: () => {
                navigate(`/profiles/${profileType === 'ESNer' ? 'esners/' : 'erasmus/'}`);
            },
            onError: (err) => defaultErrorHandler(err, setPopup),
            onFinally: () => {
                setDeletingProfile(false);
                setDeleteConfirmOpen(false);
            }
        });
    };

    // Helper: copy formatted number (prefix + number) or simple number
    const handleCopyNumber = async (prefix, number, label = 'Numero') => {
        const plainNumber = (prefix ? `${prefix} ${number || ''}` : (number || '')).trim();
        if (!plainNumber) {
            setPopup({message: `${label} vuoto`, state: "error", id: Date.now()});
            return;
        }
        try {
            await navigator.clipboard.writeText(plainNumber);
            setPopup({message: `${label} copiato: ${plainNumber}`, state: "success", id: Date.now()});
        } catch {
            setPopup({message: `Errore copia ${label}`, state: "error", id: Date.now()});
        }
    };

    return (
        <Box>
            <Sidebar/>
            {loading ? <Loader/> : (<>
                    <Box sx={{mx: '5%'}}>
                        <Box sx={{display: 'flex', alignItems: 'center', mb: 4}}>
                            <IconButton
                                onClick={() => navigate(`/profiles/${profileType === 'ESNer' ? 'esners/' : 'erasmus/'}`)}
                                sx={{mr: 2}}>
                                <ArrowBackIcon/>
                            </IconButton>
                            <Typography variant="h4">Profilo {profileType}</Typography>
                            <Box sx={{flexGrow: 1}}/>
                            <IconButton onClick={refreshProfileData}
                                        title="Aggiorna"
                                        disabled={saving}>
                                <RefreshIcon/>
                            </IconButton>
                        </Box>
                        <Card sx={{p: '20px'}}>
                            <Grid container spacing={2}>
                                {/* --- Personal Information Section --- */}
                                <Grid container size={{xs: 12}} alignItems="center">
                                    <Person sx={{color: 'primary.main'}}/>
                                    <Typography variant="h6" sx={{m: 0}}>Informazioni Personali</Typography>
                                    <Box sx={{ml: 2, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1}}>
                                        <Typography variant="body2" color="text.secondary">
                                            Data Iscrizione: {dayjs(profile?.created_at).format('DD MMMM YYYY')}
                                        </Typography>
                                        {profile?.email_is_verified ? (
                                            <Chip 
                                                sx={{ml: 2}} 
                                                icon={<CheckCircleIcon />}
                                                label="Email verificata" 
                                                color="success" 
                                                size="small"
                                            />
                                        ) : (
                                            <Tooltip title="Email non verificata" arrow>
                                                <Chip 
                                                    sx={{ml: 2}} 
                                                    icon={<WarningIcon />}
                                                    label="Email non verificata" 
                                                    color="error" 
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            </Tooltip>
                                        )}
                                    </Box>
                                    <Grid sx={{marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 1}}>
                                        <Tooltip title="Modifica Profilo" arrow>
                                            <Box
                                                sx={{
                                                    display: 'inline-flex',
                                                    '& .MuiButton-root, & .MuiIconButton-root': {color: 'primary.main'},
                                                    '& .MuiButton-contained': {
                                                        backgroundColor: 'primary.main',
                                                        color: 'primary.contrastText'
                                                    },
                                                    '& .MuiButton-contained:hover': {backgroundColor: 'primary.dark'}
                                                }}
                                            >
                                                <EditButton
                                                    onEdit={() => toggleEdit(true)}
                                                    onCancel={() => {
                                                        toggleEdit(false);
                                                        setUpdatedData(data);
                                                    }}
                                                    saving={saving}
                                                    onSave={handleSave}
                                                />
                                            </Box>
                                        </Tooltip>
                                        <Tooltip
                                            arrow
                                            title={
                                                !user?.groups?.includes('Board')
                                                    ? "Solo Board Members possono eliminare profili"
                                                    : (subscriptions.length > 0
                                                        ? "Elimina prima tutte le iscrizioni associate"
                                                        : "Elimina profilo")
                                            }>
                                        <span>
                                            <IconButton
                                                variant="contained"
                                                color="error"
                                                disabled={
                                                    !user?.groups?.includes('Board') ||
                                                    subscriptions.length > 0 ||
                                                    deletingProfile
                                                }
                                                onClick={handleDeleteProfile}
                                                sx={{
                                                    opacity: (!user?.groups?.includes('Board') || subscriptions.length > 0) ? 0.6 : 1
                                                }}>
                                                <DeleteIcon/>
                                            </IconButton>
                                        </span>
                                        </Tooltip>
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
                                    <Grid size={{xs: 12, md: 3}}>
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
                                        <Grid size={{xs: 12, md: 1.5}}>
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
                                        <Grid size={{xs: 12, md: 2.5}}>
                                            {/* Box wraps the TextField and copy button */}
                                            <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                                                <TextField
                                                    label={names.phone_number}
                                                    name='phone_number'
                                                    value={updatedData.phone_number || ''}
                                                    error={errors.phone_number[0]}
                                                    helperText={errors.phone_number[1]}
                                                    onChange={handleChange}
                                                    slotProps={{input: {readOnly: readOnly.phone_number}}}
                                                    sx={{backgroundColor: readOnly.phone_number ? 'grey.200' : 'white', flexGrow: 1}}
                                                    fullWidth/>
                                                <Tooltip title="Copia numero" arrow>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleCopyNumber(updatedData.phone_prefix, updatedData.phone_number, 'Telefono')}
                                                    >
                                                        <ContentCopyIcon fontSize="small"/>
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </Grid>
                                    </Grid>
                                )}
                                {!shouldHideField('whatsapp_prefix') && !shouldHideField('whatsapp_number') && (
                                    <Grid size={{xs: 12}} container spacing={2}>
                                        <Grid size={{xs: 12, md: 1.5}}>
                                            <FormControl fullWidth required>
                                                <InputLabel
                                                    id="whatsapp-prefix-label">{names.whatsapp_prefix}</InputLabel>
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
                                        <Grid size={{xs: 12, md: 2.5}}>
                                            <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                                                <TextField
                                                    label={names.whatsapp_number}
                                                    name='whatsapp_number'
                                                    value={updatedData.whatsapp_number || ''}
                                                    error={errors.whatsapp_number[0]}
                                                    helperText={errors.whatsapp_number[1]}
                                                    onChange={handleChange}
                                                    slotProps={{input: {readOnly: readOnly.whatsapp_number}}}
                                                    sx={{backgroundColor: readOnly.whatsapp_number ? 'grey.200' : 'white', flexGrow: 1}}
                                                    fullWidth/>
                                                <Tooltip title="Copia numero" arrow>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleCopyNumber(updatedData.whatsapp_prefix, updatedData.whatsapp_number, 'WhatsApp')}
                                                    >
                                                        <ContentCopyIcon fontSize="small"/>
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </Grid>
                                    </Grid>
                                )}
                                {/* --- Polimi fields --- */}
                                <Grid container size={{xs: 12}} sx={{mt: 2}} alignItems="center">
                                    <School sx={{color: 'primary.main'}}/>
                                    <Typography variant="h6" sx={{m: 0}}>Dati Studente</Typography>
                                </Grid>
                                {!shouldHideField('person_code') && (
                                    <Grid size={{xs: 12, md: 2}}>
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
                                    <Grid size={{xs: 12, md: 2}}>
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
                                        <Group sx={{color: 'primary.main', mr: 1}}/>
                                        <Grid size={{xs: 12, md: 2}}>
                                            <FormControl fullWidth required>
                                                <InputLabel id="group-label">{names.group}</InputLabel>
                                                <Select
                                                    variant="outlined"
                                                    labelId="group-label"
                                                    label={names.group}
                                                    name="group"
                                                    value={
                                                        groups.some(g => g.name === updatedData.group)
                                                            ? updatedData.group
                                                            : ""
                                                    }
                                                    onChange={handleChange}
                                                    slotProps={{input: {readOnly: readOnly.group}}}
                                                    sx={{backgroundColor: readOnly.group ? 'grey.200' : 'white'}}>
                                                    <MenuItem value=""><em>None</em></MenuItem>
                                                    {groups.map((group) => (<MenuItem key={group.name}
                                                                                      value={group.name}>{group.name}</MenuItem>))}
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                    </Grid>
                                )}
                            </Grid>
                        </Card>
                        <Card sx={{p: 1, mt: 2, minHeight: '80px', display: 'flex', alignItems: 'center'}}>
                            <Toolbar sx={{justifyContent: 'space-between', width: '100%', p: 0}}>
                                <Box sx={{display: 'flex', alignItems: 'center'}}>
                                    <EditIcon sx={{color: 'primary.main', mr: 2}}/>
                                    <Typography variant="h6">Azioni</Typography>
                                </Box>
                                <Box sx={{display: 'flex', gap: 1}}>
                                    <Button variant="contained" color="primary" onClick={handleIscriviAdEvento}>
                                        Iscrivi ad Evento
                                    </Button>
                                    {/* Finance permission toggle (Board → ESNer Aspiranti) */}
                                    {user?.groups?.includes('Board') && profileType === 'ESNer' && profile?.group === 'Aspiranti' && (
                                        <Tooltip
                                            title="Come per Attivi: apertura/chiusura + visualizzazione importi"
                                            arrow>
                                            <Button
                                                variant={financePerms?.can_manage_casse ? 'outlined' : 'contained'}
                                                color="secondary"
                                                startIcon={<AccountBalanceIcon/>}
                                                onClick={toggleFinancePerms}
                                            >
                                                {financePerms?.can_manage_casse ? 'Revoca Permessi Casse' : 'Concedi Permessi Casse'}
                                            </Button>
                                        </Tooltip>
                                    )}
                                </Box>
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
                        <Divider variant="middle" sx={{my: 3}}/>

                        {/* --- Documents and ESNcards Section --- */}
                        <Grid container sx={{width: '100%'}} spacing={2}>
                            <Grid size={{xs: 12, md: 6}}>
                                <Card sx={{p: 2}}>
                                    <Box sx={{display: 'flex', alignItems: 'center', mb: 2}}>
                                        <DocumentScannerIcon sx={{color: 'primary.main', mr: 2}}/>
                                        <Typography variant="h5" sx={{flexGrow: 1}}>Documenti</Typography>
                                    </Box>
                                    <CrudTable
                                        cols={document_columns}
                                        canCreate={user.permissions.includes('add_document')}
                                        canEdit={user.permissions.includes('change_document')}
                                        canDelete={user.permissions.includes('delete_document')}
                                        onCreate={createDocument}
                                        onSave={saveDocument}
                                        onDelete={deleteDocument}
                                        initialData={data.documents}
                                        title={null}
                                        sortColumn={'expiration'}/>
                                </Card>
                            </Grid>
                            <Grid size={{xs: 12, md: 6}}>
                                <Card sx={{p: 2}}>
                                    <Box sx={{display: 'flex', alignItems: 'center', mb: 2}}>
                                        <CreditCardIcon sx={{color: 'primary.main', mr: 2}}/>
                                        <Typography variant="h5" sx={{flexGrow: 1}}>ESNcards</Typography>
                                    </Box>
                                    <CrudTable
                                        cols={esncard_columns}
                                        canCreate={user.permissions.includes('add_esncard')}
                                        onCreate={handleOpenESNcardModal}
                                        createText={!profile.latest_esncard ? "Rilascia" : (profile.latest_esncard.is_valid ? "Card Smarrita" : "Rinnova")}
                                        canEdit={user.permissions.includes('change_esncard')}
                                        onSave={saveESNcard}
                                        initialData={data.esncards}
                                        title={null}
                                        sortColumn={'expiration'}/>
                                </Card>
                            </Grid>

                            <Grid size={{xs: 12}}><Divider variant="middle" sx={{my: 1}}/></Grid>

                            {/* --- Subscriptions and Organized Events Section --- */}
                            <Grid size={{xs: 12}} sx={{mb: 5}}>
                                <Card sx={{p: 2}}>
                                    <Box
                                        sx={{display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', py: 0.5}}
                                        onClick={() => setShowSubscriptions(v => !v)}
                                    >
                                        <ListAltIcon sx={{color: 'primary.main'}}/>
                                        <Typography variant="h6" sx={{flexGrow: 1, ml: 1}}>Iscrizioni</Typography>
                                        <IconButton size="small" aria-label="toggle iscrizioni"
                                                    onClick={() => setShowSubscriptions(v => !v)}>
                                            <ExpandMoreIcon
                                                sx={{
                                                    transform: showSubscriptions ? 'rotate(180deg)' : 'rotate(0deg)',
                                                    transition: 'transform 0.2s'
                                                }}
                                            />
                                        </IconButton>
                                    </Box>
                                    <Collapse in={showSubscriptions} timeout="auto" unmountOnExit>
                                        <Box sx={{mt: 1}}>
                                            <MRT_Table table={subscriptionsTable}/>
                                        </Box>
                                    </Collapse>
                                </Card>
                            </Grid>
                            {profileType === "ESNer" && (<>
                                    <Grid size={{xs: 12}}><Divider variant="middle" sx={{my: 1, mt: -5}}/></Grid>
                                    <Grid size={{xs: 12}} sx={{mb: 5, mt: -5}}>
                                        <Card sx={{p: 2}}>
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 1,
                                                    cursor: 'pointer',
                                                    py: 0.5
                                                }}
                                                onClick={() => setShowOrganizedEvents(v => !v)}
                                            >
                                                <EventIcon sx={{color: 'primary.main'}}/>
                                                <Typography variant="h6" sx={{flexGrow: 1, ml: 1}}>Eventi
                                                    Organizzati</Typography>
                                                <IconButton size="small" aria-label="toggle eventi organizzati"
                                                            onClick={() => setShowOrganizedEvents(v => !v)}>
                                                    <ExpandMoreIcon
                                                        sx={{
                                                            transform: showOrganizedEvents ? 'rotate(180deg)' : 'rotate(0deg)',
                                                            transition: 'transform 0.2s'
                                                        }}
                                                    />
                                                </IconButton>
                                            </Box>
                                            <Collapse in={showOrganizedEvents} timeout="auto" unmountOnExit>
                                                <Box sx={{mt: 1}}>
                                                    <MRT_Table table={organizedEventsTable}/>
                                                </Box>
                                            </Collapse>
                                        </Card>
                                    </Grid>
                                </>
                            )}
                        </Grid>
                        {popup && <Popup key={popup.id} message={popup.message} state={popup.state}/>}
                    </Box>
                </>
            )}
            <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Conferma Eliminazione</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        Sei sicuro di voler eliminare questo profilo (e l&apos;utente associato se ESNer)?
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirmOpen(false)} disabled={deletingProfile}>Annulla</Button>
                    <Button
                        color="error"
                        variant="contained"
                        onClick={confirmDeleteProfile}
                        disabled={deletingProfile}
                    >
                        {deletingProfile ? "Elimino..." : "Conferma"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
