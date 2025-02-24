import React, {useMemo} from 'react';
import ProfilesList from '../Components/ProfilesList.jsx';
import {Box, Chip, Typography} from "@mui/material";
import BabyChangingStationIcon from '@mui/icons-material/BabyChangingStation';
import Sidebar from "../Components/Sidebar";
import SnowboardingIcon from "@mui/icons-material/Snowboarding";

export default function ESNersProfiles() {

    const columns = useMemo(() => [
        {
            accessorKey: 'id',
            header: 'Id',
            size: 50,
        },
        {
            accessorKey: 'name',
            header: 'Name',
            size: 150,
        },
        {
            accessorKey: 'surname',
            header: 'Surname',
            size: 150,
        },
        {
            accessorKey: 'groups',
            header: 'Group',
            size: 150,
        },
        {
            accessorKey: 'email',
            header: 'Email',
            size: 150,
        },
        {
            accessorKey: 'latest_esncard.number',
            header: 'Latest ESNcard',
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
            header: 'Whatsapp number',
            size: 150,
        },
        {
            accessorKey: 'country',
            header: 'Country',
            size: 150,
        },
        {
            accessorKey: 'gender',
            header: 'Gender',
            size: 50,
            Cell: ({cell}) => (
                <Box sx={{textAlign: 'center'}}>{cell.getValue()}</Box>
            ),
        },
        {
            accessorKey: 'birthdate',
            header: 'Birthdate',
            size: 100,
        },
        {
            accessorKey: 'course',
            header: 'Course',
            size: 100,
        },
        {
            accessorKey: 'phone',
            header: 'Phone number',
            size: 150,
        },
        {
            accessorKey: 'person_code',
            header: 'Person code',
            size: 150,
        },
        {
            accessorKey: 'domicile',
            header: 'Domicile',
            size: 200,
        },
        {
            accessorKey: 'residency',
            header: 'Residency',
            size: 200,
        },
        {
            accessorKey: 'latest_document.number',
            header: 'Latest document',
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
        groups: true,
        email: true,
        whatsapp: true,
        country: true,
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
