import React, {useMemo} from 'react';
import ProfilesList from './ProfilesList.jsx';
import {Box, Chip, Typography} from "@mui/material";
import SnowboardingIcon from '@mui/icons-material/Snowboarding';
import Sidebar from "../Components/Sidebar";
import {profileDisplayNames as names} from "../utils/displayAttributes";

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
            accessorKey: 'gender',
            header: names.gender,
            size: 50,
            Cell: ({cell}) => (
                <Box sx={{textAlign: 'center'}}>{cell.getValue()}</Box>
            ),
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
            accessorKey: 'residency',
            header: names.residency,
            size: 200,
        },
        {
            accessorKey: 'latest_document.number',
            header: names.latest_document,
            size: 50,
        },
        {
            accessorKey: 'latest_matricola.number',
            header: names.latest_matricola,
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