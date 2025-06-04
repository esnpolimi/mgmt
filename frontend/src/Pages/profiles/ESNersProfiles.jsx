import React, {useMemo} from 'react';
import ProfilesList from './ProfilesList.jsx';
import {Box, Chip, Typography} from "@mui/material";
import BabyChangingStationIcon from '@mui/icons-material/BabyChangingStation';
import Sidebar from "../../Components/Sidebar";
import {profileDisplayNames as names} from '../../utils/displayAttributes';
import countryCodes from "../../data/countryCodes.json";

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
            accessorKey: 'group',
            header: names.group,
            size: 150,
        },
        {
            accessorKey: 'email',
            header: names.email,
            size: 150,
        },
        {
            accessorKey: 'latest_esncard',
            header: names.latest_esncard,
            size: 50,
            Cell: ({cell}) => (
                <Box sx={{}}>
                    {cell.getValue() !== null ? (
                        <Chip label={cell.getValue().number} color={cell.getValue().is_valid ? "success" : "warning"}/>
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
            id: 'fullPhoneNumber',
            header: names.phone_number,
            size: 150,
            Cell: ({row}) => (
                <span>({row.original.phone_prefix || 'vuoto'}) {row.original.phone_number || '(vuoto)'}</span>
            ),
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
        country: true,
        birthdate: false,
        fullPhoneNumber: true,
        person_code: false,
        domicile: false,
        matricola_number: false,
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
