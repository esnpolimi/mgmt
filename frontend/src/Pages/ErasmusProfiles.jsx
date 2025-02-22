import React, {useMemo} from 'react';
import ProfileList from '../Components/ProfileList.jsx';
import {Box, Chip} from "@mui/material";
import SnowboardingIcon from '@mui/icons-material/Snowboarding';

export default function ErasmusProfiles() {

    const columns = useMemo(() => [
        {
            accessorKey: 'id',
            header: 'Id',
            size: 50,
        },
        {
            accessorKey: 'name',
            header: 'Nome',
            size: 150,
        },
        {
            accessorKey: 'surname',
            header: 'Cognome',
            size: 150,
        },
        {
            accessorKey: 'email',
            header: 'Email',
            size: 150,
        },
        {
            accessorKey: 'latest_esncard.number',
            header: 'Ultima ESNcard',
            size: 50,
            Cell: ({cell}) => (
                <Box sx={{}}>
                    {cell.getValue() !== undefined ? (
                        <Chip label={cell.getValue()} color="success"/>
                    ) : (
                        <Chip label="No ESNcard" color="error"/>
                    )}
                </Box>
            ),
        },
        {
            accessorKey: 'whatsapp',
            header: 'Numero WhatsApp',
            size: 150,
        },
        {
            accessorKey: 'country',
            header: 'Nazione',
            size: 150,
        },
        {
            accessorKey: 'gender',
            header: 'Genere',
            size: 50,
            Cell: ({cell}) => (
                <Box sx={{textAlign: 'center'}}>{cell.getValue()}</Box>
            ),
        },
        {
            accessorKey: 'birthdate',
            header: 'Data di nascita',
            size: 100,
        },
        {
            accessorKey: 'course',
            header: 'Corso',
            size: 100,
        },
        {
            accessorKey: 'phone',
            header: 'Numero di telefono',
            size: 150,
        },
        {
            accessorKey: 'person_code',
            header: 'Codice persona',
            size: 150,
        },
        {
            accessorKey: 'domicile',
            header: 'Domicilio',
            size: 200,
        },
        {
            accessorKey: 'residency',
            header: 'Residenza',
            size: 200,
        },
        {
            accessorKey: 'latest_document.number',
            header: 'Ultimo documento',
            size: 50,
        },
        {
            accessorKey: 'latest_matricola.number',
            header: 'Matricola',
            size: 50,
        },
    ], []);

    const columnVisibility = {
        id: true,
        name: true,
        surname: true,
        email: true,
        whatsapp: true,
        country: false,
        gender: false,
        birthdate: false,
        course: false,
        phone: false,
        person_code: false,
        domicile: false,
        residency: false,
        'latest_document.number': false,
        'latest_matricola.number': false,
    }

    return (
        <ProfileList
            apiEndpoint="/erasmus_profiles/"
            columns={columns}
            columnVisibility={columnVisibility}
            icon={SnowboardingIcon}
            title="Erasmus"
        />
    );
}