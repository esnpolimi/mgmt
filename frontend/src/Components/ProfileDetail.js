import {Card, Box, Grid, TextField, FormControl, InputLabel, Select, MenuItem} from "@mui/material";
import {React, useState, useEffect, useMemo} from 'react';
import {LocalizationProvider, DatePicker} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import {
    useMaterialReactTable,
} from 'material-react-table';


import EditButton from "./EditButton";
import CrudTable from "./CrudTable";
import {fetchCustom} from "../api/api";

export default function ProfileDetail({row, updateTableRow}) {


    const [saving, setSaving] = useState(false); /* true when making api call to save data*/

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
        documents: [],
        matricole: [],
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
    });

    /* esncard validation errors */
    const [esncardErrors, setESNcardErrors] = useState({})

    /* columns for esncard table */
    const esncard_columns = useMemo(() => [
        {
            accessorKey: 'number',
            header: 'Number',
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
            header: 'Expiration',
            size: 100,
        },
        {
            enableEditing: false,
            accessorFn: (row) => row.created_at.substring(0, 10),
            header: 'Issue date',
            size: 100,
        }
    ]);

    const saveESNcard = async (row, values) => {
        console.log(row);
        const response = await fetchCustom("PATCH", `/esncard/${row.id}/`, values);
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
            header: 'Type',
            size: 80,
            editVariant: 'select',
            editSelectOptions: ['Passport', 'Identity Card'],
            muiEditTextFieldProps: {
                select: true,
                helperText: documentErrors?.type,
                error: !!documentErrors?.type
            }
        },
        {
            accessorKey: 'number',
            header: 'Number',
            size: 100,
            muiEditTextFieldProps: {
                required: true,
                helperText: documentErrors?.number,
                error: !!documentErrors?.number
            },
        },
        {
            accessorKey: 'expiration',
            header: 'Expiration',
            size: 100,
            muiEditTextFieldProps: {
                required: true,
                helperText: documentErrors?.expiration,
                error: !!documentErrors?.expiration
            },
        },

    ]);

    /* document creation */
    const createDocument = async (values) => {
        let val = {...values, profile: row.original.id}
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
            return true;
        } else if (response.status === 400) {
            response.json().then((errors) => setDocumentErrors(errors))
            return false;
        } else {
            return false;
        }
    }

    /* matricola validation errors */
    const [matricolaErrors, setMatricolaErrors] = useState({});

    /* columns for matricola table */
    const matricola_columns = useMemo(() => [
        {
            accessorKey: 'number',
            header: 'Number',
            size: 100,
            muiEditTextFieldProps: {
                required: true,
                helperText: matricolaErrors?.number,
                error: !!matricolaErrors?.number
            },
        },
        {
            accessorKey: 'exchange_end',
            header: 'Exchange end',
            size: 100,
            muiEditTextFieldProps: {
                required: true,
                helperText: matricolaErrors?.exchange_end,
                error: !!matricolaErrors?.exchange_end
            },
        }
    ]);

    /* matricola creation */
    const createMatricola = async (values) => {
        let val = {...values, profile: row.original.id}
        console.log(val)
        const response = await fetchCustom("POST", '/matricola/', val);

        if (response.ok) {
            setMatricolaErrors({});
            return await response.json();
        } else if (response.status === 400) {
            response.json().then((errors) => setMatricolaErrors(errors))
            return false;
        } else {
            return false;
        }
    }

    /* save edited matricola */
    const saveMatricola = async (row, values) => {
        console.log(row);
        const response = await fetchCustom("PATCH", `/matricola/${row.id}/`, values);
        if (response.ok) {
            setMatricolaErrors({});
            return true;
        } else if (response.status === 400) {
            response.json().then((errors) => setMatricolaErrors(errors))
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

    const matricola_table = useMaterialReactTable({
        columns: matricola_columns,
        data: data.matricole,
        enableColumnActions: false,
        enableColumnFilters: false,
        enablePagination: false,
        enableSorting: false,
    })

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
        const body = {
            ...updatedData,
            birthdate: formatDateString(updatedData.birthdate)
        }
        fetchCustom("GET", `/profile/${row.original.id.toString()}/`, body
        ).then((response) => {
            setSaving(false);
            if (response.ok) {
                setData(updatedData);
                resetErrors();

                //update table row
                updateTableRow(row.original.id, updatedData);
            } else if (response.status === 400) {
                response.json().then((json) => {
                    var updatedErrors = Object.fromEntries(Object.keys(errors).map(
                        (e) => {
                            if (e in json) {
                                return [e, [true, json[e]]];
                            } else {
                                return [e, [false, '']];
                            }
                        }
                    ));
                    setErrors(updatedErrors);
                })
            } else {
                throw new Error('Error while patching profile ' + row.original.id.toString())
            }
        }).catch((error) => {
            setUpdatedData(data);
            console.log(error);
        })
    };


    useEffect(() => {
        console.log('Fetching ' + row.original.id)
        fetchCustom("GET", `/profile/${row.original.id.toString()}/`
        ).then((response) => {
            if (response.ok) {
                return response.json()
            } else {
                throw new Error('Error while fetching profile ' + row.original.id.toString())
            }
        }).then((json) => {
            var update = {}
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
        <Box sx={{flexGrow: 1, padding: 2, maxWidth: '80vw', position: 'sticky', left: 20}}>
            <Card sx={{p: '20px'}}>
                <Grid container spacing={2}>
                    <Grid item xs={12} md={4} lg={3}>
                        <TextField
                            label='Name'
                            name='name'
                            value={updatedData.name}
                            error={errors.name[0]}
                            helperText={errors.name[1]}
                            InputProps={{readOnly: readOnly.name}}
                            onChange={handleChange}
                            fullWidth/>
                    </Grid>
                    <Grid item xs={12} md={4} lg={3}>
                        <TextField
                            label='Surname'
                            name='surname'
                            value={updatedData.surname}
                            error={errors.surname[0]}
                            helperText={errors.surname[1]}
                            onChange={handleChange}
                            InputProps={{readOnly: readOnly.surname}}
                            fullWidth/>
                    </Grid>
                    <Grid item xs={12} md={4} lg={3}>
                        <TextField
                            label='Email'
                            name='email'
                            type='email'
                            value={updatedData.email}
                            error={errors.email[0]}
                            helperText={errors.email[1]}
                            InputProps={{readOnly: readOnly.email}}
                            onChange={handleChange} fullWidth/>
                    </Grid>
                    <Grid item xs={12} md={4} lg={3}>
                        <TextField
                            label='Phone number'
                            name='phone'
                            value={updatedData.phone}
                            error={errors.phone[0]}
                            helperText={errors.phone[1]}
                            onChange={handleChange}
                            InputProps={{readOnly: readOnly.phone}}
                            fullWidth/>
                    </Grid>
                    <Grid item xs={12} md={4} lg={3}>
                        <TextField
                            label='Whatsapp number'
                            name='whatsapp'
                            value={updatedData.whatsapp}
                            error={errors.whatsapp[0]}
                            helperText={errors.whatsapp[1]}
                            onChange={handleChange}
                            InputProps={{readOnly: readOnly.whatsapp}}
                            fullWidth/>
                    </Grid>
                    <Grid item xs={12} md={4} lg={3}>
                        <TextField
                            label='Domicile'
                            name='domicile'
                            value={updatedData.domicile}
                            error={errors.domicile[0]}
                            helperText={errors.domicile[1]}
                            onChange={handleChange}
                            InputProps={{readOnly: readOnly.domicile}}
                            fullWidth/>
                    </Grid>
                    <Grid item xs={12} md={4} lg={3}>
                        <TextField
                            label='Residency'
                            name='residency'
                            value={updatedData.residency}
                            error={errors.residency[0]}
                            helperText={errors.residency[1]}
                            onChange={handleChange}
                            InputProps={{readOnly: readOnly.residency}}
                            fullWidth/>
                    </Grid>
                    <Grid item xs={12} md={4} lg={3}>
                        <TextField
                            label='Person code'
                            name='person_code'
                            value={updatedData.person_code}
                            error={errors.person_code[0]}
                            helperText={errors.person_code[1]}
                            onChange={handleChange}
                            InputProps={{readOnly: readOnly.person_code}}
                            fullWidth/>
                    </Grid>
                    <Grid item xs={12} md={4} lg={3}>
                        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='en-gb'>
                            <DatePicker
                                label="Birthdate"
                                value={dayjs(updatedData.birthdate, 'YYYY-MM-DD')}
                                readOnly={readOnly.birthdate}
                                onChange={(date) => handleDateChange('birthdate', date)}
                                renderInput={(params) => <TextField {...params}
                                                                    fullWidth
                                                                    required
                                />}
                            />
                        </LocalizationProvider>
                    </Grid>
                    <Grid item xs={12} md={4} lg={3}>
                        <FormControl
                            fullWidth
                            required
                        >
                            <InputLabel id="country-label">Country</InputLabel>
                            <Select
                                labelId="country-label"
                                name="country"
                                label="Country"
                                value={updatedData.country}
                                error={errors.country[0]}
                                onChange={handleChange}
                                inputProps={{readOnly: readOnly.country}}
                            >
                                <MenuItem value="">
                                    <em>None</em>
                                </MenuItem>
                                <MenuItem value="US">USA</MenuItem>
                                <MenuItem value="Canada">Canada</MenuItem>
                                {/* Add more countries here */}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={4} lg={3}>
                        <FormControl
                            fullWidth
                            required
                        >
                            <InputLabel id="gender-label">Gender</InputLabel>
                            <Select
                                labelId="gender-label"
                                name="gender"
                                label="Gender"
                                value={updatedData.gender}
                                onChange={handleChange}
                                inputProps={{readOnly: readOnly.gender}}
                            >
                                <MenuItem value="M">Male</MenuItem>
                                <MenuItem value="F">Female</MenuItem>
                                <MenuItem value="O">Other</MenuItem>
                                {/* Add more countries here */}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={4} lg={3}>
                        <FormControl
                            fullWidth
                            required
                        >
                            <InputLabel id="course-label">Course</InputLabel>
                            <Select
                                labelId="course-label"
                                name="course"
                                label="Course"
                                value={updatedData.course}
                                onChange={handleChange}
                                inputProps={{readOnly: readOnly.course}}
                            >
                                <MenuItem value="Engineering">Engineering</MenuItem>
                                <MenuItem value="Design">Design</MenuItem>
                                <MenuItem value="Architecture">Architecture</MenuItem>
                                {/* Add more countries here */}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={4} lg={3}>
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
            </Card>
            <Box sx={{display: 'flex', flexDirection: 'row', justifyContent: 'space-around', mt: '30px'}}>
                <CrudTable
                    cols={document_columns}
                    canCreate
                    onCreate={createDocument}
                    onSave={saveDocument}
                    initialData={data.documents}
                    title={'Documents'}/>
                <CrudTable
                    cols={matricola_columns}
                    canCreate
                    initialData={data.matricole}
                    onCreate={createMatricola}
                    onSave={saveMatricola}
                    title={'Matricole'}/>
                <CrudTable
                    cols={esncard_columns}
                    initialData={data.esncards}

                    title={'ESNcard'}/>
            </Box>
        </Box>
    );
}
