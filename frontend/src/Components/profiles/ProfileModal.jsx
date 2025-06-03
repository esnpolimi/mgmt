import {Box, Button, Card, FormControl, InputLabel, MenuItem, Modal, Select, TextField, Toolbar, Typography, Grid} from "@mui/material";
import React, {useEffect, useMemo, useState} from 'react';
import {DatePicker, LocalizationProvider} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import EditButton from "../EditButton";
import CrudTable from "../CrudTable";
import {fetchCustom} from "../../api/api";
import {style} from '../../utils/sharedStyles'
import {useAuth} from "../../Context/AuthContext";
import Popup from '../Popup'
import {profileDisplayNames as names} from '../../utils/displayAttributes';
import ESNcardEmissionModal from "./ESNcardEmissionModal";
import Loader from "../Loader";
import countryCodes from "../../data/countryCodes.json";
import {extractErrorMessage} from "../../utils/errorHandling";
import {Person, School, Group} from '@mui/icons-material';

const profileFieldRules = {
    ESNer: {hideFields: ['course', 'matricola_expiration', 'whatsapp_prefix', 'whatsapp_number']},
    Erasmus: {hideFields: ['groups']}
};

export default function ProfileModal({open, handleClose, inProfile, profileType, updateProfile}) {
    const [saving, setSaving] = useState(false); /* true when making api call to save data */
    const [loading, setLoading] = useState(true);
    const {user} = useAuth();
    const [profile, setProfile] = useState(inProfile);
    const [showSuccessPopup, setShowSuccessPopup] = useState(null);
    const [ESNcardModalOpen, setESNcardModalOpen] = useState(false);
    const [esncardErrors, setESNcardErrors] = useState({})
    const [documentErrors, setDocumentErrors] = useState({})
    const [groups, setGroups] = useState([]);
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
    });

    useEffect(() => {
        setLoading(true);
        const fetchData = async () => {
            try {
                const response = await fetchCustom("GET", `/profile/${profile.id.toString()}/`);
                if (!response.ok) {
                    const errorMessage = await extractErrorMessage(response);
                    setShowSuccessPopup({message: `Errore: ${errorMessage}`, state: 'error'});
                } else {
                    const json = await response.json();
                    const update = {};
                    Object.keys(data).map((key) => {
                        update[key] = json[key];
                    });
                    setData(update)
                    setUpdatedData(update)
                }
            } catch (error) {
                setShowSuccessPopup({message: `Errore generale: ${error}`, state: "error"});
            } finally {
                setLoading(false);
            }
        };
        fetchData().then();
    }, []);

    useEffect(() => {
        const fetchGroups = async () => {
            try {
                const response = await fetchCustom("GET", "/groups/");
                if (response.ok) {
                    const json = await response.json();
                    setGroups(json);
                }
            } catch (error) {
                console.error("Error fetching groups:", error);
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
            if (!response.ok) {
                const errorMessage = await extractErrorMessage(response);
                setShowSuccessPopup({message: `Errore: ${errorMessage}`, state: 'error'});
            } else {
                const json = await response.json();
                setData(json);
                setUpdatedData(json);
                if (updateProfile) updateProfile(json);
                setProfile(json);
            }
        } catch (error) {
            setShowSuccessPopup({message: `Errore generale: ${error}`, state: "error"});
        }
    };

    const handleOpenESNcardModal = () => {
        setESNcardModalOpen(true);
    };

    const handleCloseESNcardModal = async (success) => {
        if (success) {
            setShowSuccessPopup({message: "ESNcard emessa con successo!", state: "success"});
            await refreshProfileData();
            // set profile latest esncard to the latest one
        }
        setESNcardModalOpen(false);
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
                const errorMessage = await extractErrorMessage(response);
                setShowSuccessPopup({message: `Errore: ${errorMessage}`, state: 'error'});
                return false;
            } else {
                setESNcardErrors({});
                setShowSuccessPopup({message: "ESNcard aggiornata con successo!", state: "success"});
                await refreshProfileData();
                return true;
            }
        } catch (error) {
            setShowSuccessPopup({message: `Errore generale: ${error}`, state: "error"});
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
                const errorMessage = await extractErrorMessage(response);
                setShowSuccessPopup({message: `Errore: ${errorMessage}`, state: 'error'});
            } else {
                setDocumentErrors({});
                setShowSuccessPopup({message: "Documento eliminato con successo!", state: "success"});
                await refreshProfileData();
                return true;
            }
        } catch (error) {
            setShowSuccessPopup({message: `Errore generale: ${error}`, state: "error"});
        }
    };

    /* document creation */
    const createDocument = async (values) => {
        let val = {...values, profile: profile.id};
        try {
            const response = await fetchCustom("POST", '/document/', val);
            if (!response.ok) {
                response.json().then((errors) => setDocumentErrors(errors))
                const errorMessage = await extractErrorMessage(response);
                setShowSuccessPopup({message: `Errore: ${errorMessage}`, state: 'error'});
                return false;
            } else {
                setDocumentErrors({});
                setShowSuccessPopup({message: "Documento aggiunto con successo!", state: "success"});
                await refreshProfileData();
                return true;
            }
        } catch (error) {
            setShowSuccessPopup({message: `Errore generale: ${error}`, state: "error"});
            return false;
        }
    };

    /* save edited document */
    const saveDocument = async (row, values) => {
        try {
            const response = await fetchCustom("PATCH", `/document/${row.id}/`, values);
            if (!response.ok) {
                response.json().then((errors) => setDocumentErrors(errors))
                const errorMessage = await extractErrorMessage(response);
                setShowSuccessPopup({message: `Errore: ${errorMessage}`, state: 'error'});
                return false;
            } else {
                setDocumentErrors({});
                setShowSuccessPopup({message: "Documento aggiornato con successo!", state: "success"});
                await refreshProfileData();
                return true;
            }
        } catch (error) {
            setShowSuccessPopup({message: `Errore generale: ${error}`, state: "error"});
            return false;
        }
    }

    const formatDateString = (date) => {
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
                    setShowSuccessPopup({message: "Profilo aggiornato con successo!", state: "success"});
                    toggleEdit(false);
                }
            }
        } catch (error) {
            setUpdatedData(data);
            setShowSuccessPopup({message: `Errore generale: ${error}`, state: "error"});
            toggleEdit(false);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal open={open} onClose={handleClose}>
            <Box sx={style} onKeyDown={(e) => e.stopPropagation()}>
                <Typography variant="h5" gutterBottom align="center">
                    Profilo {profileType}
                </Typography>
                {loading ? <Loader/> : (<>
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
                                            onSave={handleSave}
                                        />
                                    </Grid>
                                </Grid>
                                {!shouldHideField('name') && (
                                    <Grid size={{xs: 12, md: 4, lg: 4}}>
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
                                    <Grid size={{xs: 12, md: 4, lg: 4}}>
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
                                    <Grid size={{xs: 12, md: 4, lg: 4}}>
                                        <TextField
                                            label={names.email}
                                            name='email'
                                            type='email'
                                            value={updatedData.email}
                                            error={errors.email[0]}
                                            helperText={errors.email[1]}
                                            slotProps={{input: {readOnly: readOnly.email}}}
                                            sx={{backgroundColor: readOnly.email ? 'grey.200' : 'white'}}
                                            onChange={handleChange} fullWidth/>
                                    </Grid>
                                )}
                                {!shouldHideField('country') && (
                                    <Grid size={{xs: 12, md: 4, lg: 4}}>
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
                                                sx={{backgroundColor: readOnly.country ? 'grey.200' : 'white'}}
                                            >
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
                                    <Grid size={{xs: 12, md: 4, lg: 5}}>
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
                                {!shouldHideField('birthdate') && (
                                    <Grid size={{xs: 12, md: 4, lg: 3}}>
                                        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='en-gb'>
                                            <DatePicker
                                                label={names.birthdate}
                                                value={dayjs(updatedData.birthdate, 'YYYY-MM-DD')}
                                                readOnly={readOnly.birthdate}
                                                onChange={(date) => handleDateChange('birthdate', date)}
                                                sx={{backgroundColor: readOnly.birthdate ? 'grey.200' : 'white'}}
                                                renderInput={(params) => <TextField {...params}
                                                                                    fullWidth
                                                                                    required
                                                />}
                                            />
                                        </LocalizationProvider>
                                    </Grid>
                                )}
                                {/* --- Phone numbers --- */}
                                {!shouldHideField('phone_prefix') && !shouldHideField('phone_number') && (
                                    <Grid size={{xs: 12}} container spacing={2}>
                                        <Grid size={{xs: 1.5}}>
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
                                                    renderValue={(value) => value}
                                                >
                                                    {countryCodes.map((country) => (
                                                        <MenuItem key={country.code} value={country.dial}>
                                                            {country.dial} ({country.name})
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                        <Grid size={{xs: 3}}>
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
                                        <Grid size={{xs: 1.5}}>
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
                                                    renderValue={(value) => value}
                                                >
                                                    {countryCodes.map((country) => (
                                                        <MenuItem key={country.code} value={country.dial}>
                                                            {country.dial} ({country.name})
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                        <Grid size={{xs: 3}}>
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
                                    <Grid size={{xs: 12, md: 4, lg: 3}}>
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
                                    <Grid size={{xs: 12, md: 4, lg: 3}}>
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
                                                sx={{backgroundColor: readOnly.course ? 'grey.200' : 'white'}}
                                            >
                                                <MenuItem value="Engineering">Ingegneria</MenuItem>
                                                <MenuItem value="Design">Design</MenuItem>
                                                <MenuItem value="Architecture">Architettura</MenuItem>
                                                {/* TODO Add more values here */}
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                )}
                                {!shouldHideField('matricola_number') && (
                                    <Grid size={{xs: 12, md: 4, lg: 3}}>
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
                                    <Grid size={{xs: 12, md: 4, lg: 3}}>
                                        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='en-gb'>
                                            <DatePicker
                                                label={names.matricola_expiration}
                                                value={dayjs(updatedData.matricola_expiration, 'YYYY-MM-DD')}
                                                readOnly={readOnly.matricola_expiration}
                                                onChange={(date) => handleDateChange('matricola_expiration', date)}
                                                sx={{backgroundColor: readOnly.matricola_expiration ? 'grey.200' : 'white'}}
                                                renderInput={(params) => <TextField {...params}
                                                                                    fullWidth
                                                                                    required
                                                />}
                                            />
                                        </LocalizationProvider>
                                    </Grid>
                                )}
                                <Grid container alignItems="center" spacing={1} sx={{width: '100%'}}>
                                    <Group/>
                                    <Grid size={{xs: 2}}>
                                        <FormControl fullWidth required>
                                            <InputLabel id="group-label">Gruppo</InputLabel>
                                            <Select
                                                variant="outlined"
                                                labelId="group-label"
                                                label="Gruppo"
                                                name="group"
                                                value={updatedData.group || ''}
                                                onChange={handleChange}
                                                sx={{backgroundColor: readOnly.group ? 'grey.200' : 'white'}}
                                            >
                                                {groups.map((group) => (
                                                    <MenuItem key={group.id} value={group.id}>
                                                        {group.name}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                </Grid>
                            </Grid>
                        </Card>
                        <Card sx={{p: 1, mt: 2, mb: 2, minHeight: '80px', display: 'flex', alignItems: 'center'}}>
                            <Toolbar sx={{justifyContent: 'space-between', width: '100%', p: 0}}>
                                <Typography variant="h6">Azioni</Typography>
                                <Button variant="contained" color="primary">
                                    Esporta Profilo
                                </Button>
                            </Toolbar>
                            {ESNcardModalOpen &&
                                <ESNcardEmissionModal
                                    open={ESNcardModalOpen}
                                    profile={profile}
                                    onClose={handleCloseESNcardModal}
                                />}
                        </Card>
                        <Grid container sx={{width: '100%'}} spacing={2}>
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
                                    onCreate={() => setESNcardModalOpen(true)}
                                    createText={!profile.latest_esncard ? "Rilascia" : (profile.latest_esncard.is_valid ? "Card Smarrita" : "Rinnova")}
                                    canEdit={user.permissions.includes('change_esncard')}
                                    onSave={saveESNcard}
                                    initialData={data.esncards}
                                    title={'ESNcards'}
                                    sortColumn={'expiration'}/>
                            </Grid>
                        </Grid>
                        {showSuccessPopup && <Popup message={showSuccessPopup.message} state={showSuccessPopup.state}/>}
                    </>
                )}
            </Box>
        </Modal>
    );
}