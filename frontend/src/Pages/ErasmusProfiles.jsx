import React, {useMemo} from 'react';
import ProfilesList from './ProfilesList.jsx';
import {Box, Chip, Typography} from "@mui/material";
import SnowboardingIcon from '@mui/icons-material/Snowboarding';
import Sidebar from "../Components/Sidebar";
import {profileDisplayNames as names} from "../utils/displayAttributes";
import countryCodes from "../data/countryCodes.json";

export default function ErasmusProfiles() {

    const columns = useMemo(() => [
        {
            accessorKey: 'id',
            header: names.id,
            size: 50,
        },
        {
            accessorKey: 'name',
            header: names.name,
            size: 150,
        },
        {
            accessorKey: 'surname',
            header: names.surname,
            size: 150,
        },
        {
            accessorKey: 'email',
            header: names.email,
            size: 150,
        },
        {
            accessorKey: 'latest_esncard.number',
            header: names.latest_esncard,
            size: 50,
            Cell: ({cell}) => (
                <Box sx={{}}>
                    {cell.getValue() !== undefined ? (
                        <Chip label={cell.getValue()} color="success"/>
                    ) : (
                        <Chip label="Nessuna ESNcard" color="error"/>
                    )}
                </Box>
            ),
        },
        {
            accessorKey: 'country',
            header: names.country,
            size: 150,
            Cell: ({row}) => {
                const countryCode = row.original.country;
                const country = countryCodes.find(c => c.code === countryCode);
                return country ? country.name : countryCode || '(vuoto)';
            },
        },
        {
            accessorKey: 'birthdate',
            header: names.birthdate,
            size: 100,
        },
        {
            accessorKey: 'course',
            header: names.course,
            size: 100,
        },
        {
            id: 'fullPhoneNumber',
            header: names.phone_number,
            size: 150,
            Cell: ({row}) => (
                <span>({row.original.phone_prefix || 'vuoto'}) {row.original.phone_number || '(vuoto)'}</span>
            ),
        },
        {
            id: 'fullWANumber',
            header: names.whatsapp_number,
            size: 150,
            Cell: ({row}) => (
                <span>({row.original.whatsapp_prefix || 'vuoto'}) {row.original.whatsapp_number || '(vuoto)'}</span>
            ),
        },
        {
            accessorKey: 'domicile',
            header: names.domicile,
            size: 200,
        },
        {
            accessorKey: 'matricola_number',
            header: names.matricola_number,
            size: 50,
        },
        {
            accessorKey: 'matricola_expiration',
            header: names.matricola_expiration,
            size: 50,
        },
        {
            accessorKey: 'latest_document.number',
            header: names.latest_document,
            size: 50,
        },

    ], []);

    const columnVisibility = {
        id: true,
        name: true,
        surname: true,
        email: true,
        country: false,
        birthdate: false,
        course: false,
        fullPhoneNumber: true,
        fullWANumber: true,
        person_code: false,
        domicile: false,
        matricola_number: false,
        matricola_expiration: false,
        'latest_document.number': false,
    }

    return (
        <Box>
            <Sidebar/>
            <Box sx={{mx: '5%'}}>
                <Box sx={{display: 'flex', alignItems: 'center', marginBottom: '20px'}}>
                    <SnowboardingIcon sx={{marginRight: '10px'}}/>
                    <Typography variant="h4">Profili Erasmus</Typography>
                </Box>
            </Box>
            <ProfilesList
                apiEndpoint="/erasmus_profiles/"
                columns={columns}
                columnVisibility={columnVisibility}
                profileType="Erasmus"
            />
        </Box>
    );
}