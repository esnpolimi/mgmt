import React, {useMemo} from 'react';
import ProfilesList from './ProfilesList.jsx';
import {Box, Chip, Typography} from "@mui/material";
import BabyChangingStationIcon from '@mui/icons-material/BabyChangingStation';
import Sidebar from "../Components/Sidebar";
import {profileDisplayNames as names} from '../utils/displayAttributes';

export default function ESNersProfiles() {

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
            accessorKey: 'groups',
            header: names.groups,
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
            accessorKey: 'whatsapp',
            header: names.whatsapp,
            size: 150,
        },
        {
            accessorKey: 'country',
            header: names.country,
            size: 150,
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
            accessorKey: 'phone',
            header: names.phone,
            size: 150,
        },
        {
            accessorKey: 'person_code',
            header: names.person_code,
            size: 150,
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
        groups: true,
        email: true,
        whatsapp: true,
        country: true,
        birthdate: false,
        course: false,
        phone: false,
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
                    <BabyChangingStationIcon sx={{marginRight: '10px'}}/>
                    <Typography variant="h4">Profili ESNers</Typography>
                </Box>
            </Box>
            <ProfilesList
                apiEndpoint="/user_profiles/"
                columns={columns}
                columnVisibility={columnVisibility}
                profileType="ESNer"
            />
        </Box>
    );
}
