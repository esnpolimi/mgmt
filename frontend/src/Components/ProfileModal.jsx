import {Card, Box, TextField, FormControl, InputLabel, Select, MenuItem, Modal, Typography} from "@mui/material";
import Grid from '@mui/material/Grid2';
import {useState, useEffect, useMemo} from 'react';
import {LocalizationProvider, DatePicker} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import {useMaterialReactTable} from 'material-react-table';
import EditButton from "./EditButton";
import CrudTable from "./CrudTable";
import {fetchCustom} from "../api/api";
import {style} from '../utils/sharedStyles'
import {useAuth} from "../Context/AuthContext";
import Popup from './Popup'
import {profileDisplayNames as names} from '../utils/displayAttributes';

export default function ProfileModal({open, handleClose, profile, profileType, updateProfile}) {
    const [saving, setSaving] = useState(false); /* true when making api call to save data */
    const {user} = useAuth();
    // Qua puoi disattivare manualmente i permessi degli utenti
    // user.permissions = user.permissions.filter((permission) => !['delete_document', 'change_document', 'add_document'].includes(permission));
    const [showSuccessPopup, setShowSuccessPopup] = useState(null);

    const [data, setData] = useState({  /* profile fields */
        email: '',
        name: '',
        surname: '',
        gender: '',
        birthdate: '',
        country: '',
        phone: '',
        whatsapp: '',
        person_code: '',
        domicile: '',
        residency: '',
        course: '',
        matricola_number: '',
        matricola_expiration: '',
        documents: [],
        esncards: [],
    });

    const [updatedData, setUpdatedData] = useState({    /* profile fields when edited */
        email: '',
        name: '',
        surname: '',
        gender: '',
        birthdate: '',
        country: '',
        phone: '',
        whatsapp: '',
        person_code: '',
        domicile: '',
        residency: '',
        course: '',
        matricola_number: '',
        matricola_expiration: '',
    });

    const [errors, setErrors] = useState({  /* validation errors */
        email: [false, ''],
        name: [false, ''],
        surname: [false, ''],
        gender: [false, ''],
        birthdate: [false, ''],
        country: [false, ''],
        phone: [false, ''],
        whatsapp: [false, ''],
        person_code: [false, ''],
        domicile: [false, ''],
        residency: [false, ''],
        course: [false, ''],
        matricola_number: [false, ''],
        matricola_expiration: [false, ''],
    });

    const [readOnly, setReadOnly] = useState({  /* readonly states for profile fields */
        email: true,
        name: true,
        surname: true,
        gender: true,
        birthdate: true,
        country: true,
        phone: true,
        whatsapp: true,
        person_code: true,
        domicile: true,
        residency: true,
        course: true,
        matricola_number: true,
        matricola_expiration: true,
    });

    /* esncard validation errors */
    const [esncardErrors, setESNcardErrors] = useState({})

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
            accessorKey: 'expiration',
            enableEditing: false,
            header: 'Scadenza',
            size: 100,
        },
        {
            enableEditing: false,
            accessorFn: (profile) => profile.created_at.substring(0, 10),
            header: 'Data rilascio',
            size: 100,
        }
    ]);

    const saveESNcard = async (row, values) => {
        console.log(row);
        const response = await fetchCustom("PATCH", `/esncard/${profile.id}/`, values);
        if (response.ok) {
            setDocumentErrors({});
            return true;
        } else if (response.status === 400) {
            response.json().then((errors) => setDocumentErrors(errors))
            return false;
        } else {
            return false;
        }
    }

    /* document validation error */
    const [documentErrors, setDocumentErrors] = useState({})

    /* columns for documents table */
    const document_columns = useMemo(() => [
        {
            accessorKey: 'type',
            header: 'Tipo',
            size: 80,
            editVariant: 'select',
            editSelectOptions: ['Passport', 'Identity Card'],
            muiEditTextFieldProps: {
                select: true,
                helperText: documentErrors?.type,
                error: !!documentErrors?.type,
            }
        },
        {
            accessorKey: 'number',
            header: 'Numero',
            size: 100,
            muiEditTextFieldProps: {
                required: true,
                helperText: documentErrors?.number,
                error: !!documentErrors?.number
            },
        },
        {
            accessorKey: 'expiration',
            header: 'Scadenza',
            size: 100,
            muiEditTextFieldProps: {
                required: true,
                helperText: documentErrors?.expiration,
                error: !!documentErrors?.expiration
            },
            Cell: ({cell}) => {
                const expirationDate = new Date(cell.getValue());
                const today = new Date();
                const isExpired = expirationDate < today;
                return (
                    <span style={{color: isExpired ? 'red' : 'green'}}>
                    {cell.getValue()}
                </span>
                );
            }
        },


    ], []);

    const deleteDocument = async (row) => {
        const response = await fetchCustom("DELETE", `/document/${row.id}/`);
        if (response.ok) {
            setDocumentErrors({});
            setShowSuccessPopup({message: "Documento eliminato con successo!", state: "success"});
        } else {
            response.json().then((errors) => setDocumentErrors(errors))
            setShowSuccessPopup({message: "Errore nell'eliminazione del Documento", state: "error"});
        }
    };

    /* document creation */
    const createDocument = async (values) => {
        let val = {...values, profile: profile.id}
        console.log(val)
        const response = await fetchCustom("POST", '/document/', val);
        if (response.ok) {
            setDocumentErrors({});
            return await response.json();
        } else if (response.status === 400) {
            response.json().then((errors) => setDocumentErrors(errors))
            return false;
        } else {
            return false;
        }
    }

    /* save edited document */
    const saveDocument = async (row, values) => {
        console.log(row);
        const response = await fetchCustom("PATCH", `/document/${row.id}/`, values);

        if (response.ok) {
            setDocumentErrors({});
            setShowSuccessPopup({message: "Documento aggiornato con successo!", state: "success"});
            return true;
        } else if (response.status === 400) {
            response.json().then((errors) => setDocumentErrors(errors))
            console.log(response);
            setShowSuccessPopup({message: "Errore aggiornamento Documento: " + response.errors, state: "error"});
            return false;
        } else {
            return false;
        }
    }

    const esncard_table = useMaterialReactTable({
        columns: esncard_columns,
        data: [],
        enableColumnActions: false,
        enableColumnFilters: false,
        enablePagination: false,
        enableSorting: false,
    });

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
        setErrors(Object.fromEntries(Object.keys(errors).map((e) => [e, [false, '']])));
    };

    const toggleEdit = (edit) => {
        setReadOnly(Object.fromEntries(Object.keys(readOnly).map((k) =>
            [k, !edit]
        )));
        resetErrors();
    };

    const handleSave = () => {
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

        const body = {
            ...updatedData,
            birthdate: formatDateString(updatedData.birthdate),
            matricola_expiration: formatDateString(updatedData.matricola_expiration)
        }

        return fetchCustom("PATCH", `/profile/${profile.id.toString()}/`, body
        ).then((response) => {
            setSaving(false);
            if (response.ok) {
                return fetchCustom("GET", `/profile/${profile.id.toString()}/`);
            } else if (response.status === 400) {
                response.json().then((json) => {
                    const updatedErrors = Object.fromEntries(Object.keys(errors).map(
                        (e) => {
                            if (e in json) return [e, [true, json[e]]];
                            else return [e, [false, '']];
                        }
                    ));
                    setErrors(updatedErrors);
                })
            } else {
                throw new Error('Error while patching profile ' + profile.id.toString())
            }
        }).then((response) => {
            if (response && response.ok) return response.json();
        })
            .then((newData) => {
                if (newData) {
                    setData(newData);
                    setUpdatedData(newData);
                    if (updateProfile) updateProfile(newData); // Calls the callback provided by the parent
                    resetErrors();
                    setShowSuccessPopup({message: "Profilo aggiornato con successo!", state: "success"});
                    toggleEdit(false);
                }
                setSaving(false);
            })
            .catch((error) => {
                console.log(error);
                setUpdatedData(data);
                setSaving(false);
                setShowSuccessPopup({message: "Errore nell'aggiornamento del profilo", state: "error"});
                toggleEdit(false);
            });
    };

    useEffect(() => {
        console.log('Fetching ' + profile.id)
        fetchCustom("GET", `/profile/${profile.id.toString()}/`)
            .then((response) => {
                if (response.ok) {
                    return response.json()
                } else {
                    throw new Error('Error while fetching profile ' + profile.id.toString())
                }
            }).then((json) => {
            const update = {};
            Object.keys(data).map((key) => {
                update[key] = json[key];
            });
            setData(update)
            setUpdatedData(update)
        }).catch((error) => {
            console.log(error);
        });
    }, [])

    return (
        <Modal open={open} onClose={handleClose}>
            <Box sx={style} onKeyDown={(e) => e.stopPropagation()}>
                <Typography variant="h5" gutterBottom align="center">
                    Profilo {profileType}
                </Typography>
                <Card sx={{p: '20px'}}>
                    <Grid container spacing={2}>
                        <Grid xs={12} md={4} lg={3}>
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
                        <Grid xs={12} md={4} lg={3}>
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
                        <Grid xs={12} md={4} lg={3}>
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
                        <Grid xs={12} md={4} lg={3}>
                            <TextField
                                label={names.phone}
                                name='phone'
                                value={updatedData.phone}
                                error={errors.phone[0]}
                                helperText={errors.phone[1]}
                                onChange={handleChange}
                                slotProps={{input: {readOnly: readOnly.phone}}}
                                sx={{backgroundColor: readOnly.phone ? 'grey.200' : 'white'}}
                                fullWidth/>
                        </Grid>
                        <Grid xs={12} md={4} lg={3}>
                            <TextField
                                label={names.whatsapp}
                                name='whatsapp'
                                value={updatedData.whatsapp}
                                error={errors.whatsapp[0]}
                                helperText={errors.whatsapp[1]}
                                onChange={handleChange}
                                slotProps={{input: {readOnly: readOnly.whatsapp}}}
                                sx={{backgroundColor: readOnly.whatsapp ? 'grey.200' : 'white'}}
                                fullWidth/>
                        </Grid>
                        <Grid xs={12} md={4} lg={3}>
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
                        <Grid xs={12} md={4} lg={3}>
                            <TextField
                                label={names.residency}
                                name='residency'
                                value={updatedData.residency}
                                error={errors.residency[0]}
                                helperText={errors.residency[1]}
                                onChange={handleChange}
                                sx={{backgroundColor: readOnly.residency ? 'grey.200' : 'white'}}
                                slotProps={{input: {readOnly: readOnly.residency}}}
                                fullWidth/>
                        </Grid>
                        <Grid xs={12} md={4} lg={3}>
                            <TextField
                                label={names.person_code}
                                name='person_code'
                                value={updatedData.person_code}
                                error={errors.person_code[0]}
                                helperText={errors.person_code[1]}
                                onChange={handleChange}
                                slotProps={{input: {readOnly: readOnly.person_code}}}
                                sx={{backgroundColor: readOnly.person_code ? 'grey.200' : 'white'}}
                                fullWidth/>
                        </Grid>
                        <Grid xs={12} md={4} lg={3}>
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
                        <Grid xs={12} md={4} lg={3}>
                            <FormControl
                                fullWidth
                                required
                            >
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
                                    <MenuItem value="">
                                        <em>None</em>
                                    </MenuItem>
                                    <MenuItem value="US">USA</MenuItem>
                                    <MenuItem value="Canada">Canada</MenuItem>
                                    {/* TODO Add more countries here */}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid xs={12} md={4} lg={3}>
                            <FormControl
                                fullWidth
                                required
                            >
                                <InputLabel id="gender-label">{names.gender}</InputLabel>
                                <Select
                                    variant="outlined"
                                    labelId="gender-label"
                                    name="gender"
                                    label={names.gender}
                                    value={updatedData.gender}
                                    onChange={handleChange}
                                    slotProps={{input: {readOnly: readOnly.gender}}}
                                    sx={{backgroundColor: readOnly.gender ? 'grey.200' : 'white'}}
                                >
                                    <MenuItem value="M">Maschio</MenuItem>
                                    <MenuItem value="F">Femmina</MenuItem>
                                    <MenuItem value="O">Altro</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid xs={12} md={4} lg={3}>
                            <FormControl
                                fullWidth
                                required
                            >
                                <InputLabel id="course-label">{names.course}</InputLabel>
                                <Select
                                    variant="outlined"
                                    labelId="course-label"
                                    name="course"
                                    label={names.course}
                                    value={updatedData.course}
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
                        <Grid xs={12} md={4} lg={3}>
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
                        <Grid xs={12} md={4} lg={3}>
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
                        <Grid xs={12} md={4} lg={3}>
                            <EditButton
                                onEdit={() => toggleEdit(true)}
                                onCancel={() => {
                                    toggleEdit(false);
                                    setUpdatedData(data);
                                }}
                                saving={saving}
                                onSave={() => handleSave()}
                            />
                        </Grid>
                    </Grid>
                </Card>
                <Box sx={{display: 'flex', flexDirection: 'row', justifyContent: 'space-around', mt: '20px'}}>
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
                    <CrudTable
                        cols={esncard_columns}
                        canEdit={user.permissions.includes('change_esncard')}
                        initialData={data.esncards}
                        title={'ESNcards'}/>
                </Box>
                {showSuccessPopup && <Popup message={showSuccessPopup.message} state={showSuccessPopup.state}/>}
            </Box>
        </Modal>
    );
}