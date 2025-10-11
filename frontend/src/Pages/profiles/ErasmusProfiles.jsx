import {useMemo, useRef} from 'react';
import ProfilesList from './ProfilesList.jsx';
import {Box, Chip, Typography, IconButton} from "@mui/material";
import SnowboardingIcon from '@mui/icons-material/Snowboarding';
import Sidebar from "../../Components/Sidebar";
import {profileDisplayNames as names} from "../../utils/displayAttributes";
import countryCodes from "../../data/countryCodes.json";
import RefreshIcon from "@mui/icons-material/Refresh";

export default function ErasmusProfiles() {
    const profilesListRef = useRef();

    const columns = useMemo(() => [
        {
            accessorKey: 'created_at',
            header: names.created_at,
            size: 50,
            Cell: ({cell}) => {
                const v = cell.getValue();
                if (!v) return '';
                return new Date(v).toLocaleDateString('it-IT', {day: '2-digit', month: 'short', year: 'numeric'});
            },
        },
        {
            accessorKey: 'id',
            header: names.id,
            size: 50,
        },
        {
            accessorKey: 'name',
            header: names.name,
            size: 50,
            Cell: ({cell}) => (
                <Box component="span" fontWeight="bold">
                    {cell.getValue()}
                </Box>
            ),
        },
        {
            accessorKey: 'surname',
            header: names.surname,
            size: 50,
            Cell: ({cell}) => (
                <Box component="span" fontWeight="bold">
                    {cell.getValue()}
                </Box>
            ),
        },
        {
            accessorKey: 'email',
            header: names.email,
            size: 50,
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
                        <Chip label="Assente" color="error"/>
                    )}
                </Box>
            ),
        },
        {
            accessorKey: 'country',
            header: names.country,
            size: 50,
            Cell: ({row}) => {
                const countryCode = row.original.country;
                const country = countryCodes.find(c => c.code === countryCode);
                return country ? country.name : countryCode || '(vuoto)';
            },
        },
        {
            accessorKey: 'birthdate',
            header: names.birthdate,
            size: 50,
            Cell: ({cell}) => {
                const v = cell.getValue();
                if (!v) return '';
                return new Date(v).toLocaleDateString('it-IT', {day: '2-digit', month: 'short', year: 'numeric'});
            },
        },
        {
            accessorKey: 'course',
            header: names.course,
            size: 50,
        },
        {
            accessorKey: 'phone_prefix',
            header: 'Prefisso Telefono',
            size: 50,
        },
        {
            accessorKey: 'phone_number',
            header: 'Numero Telefono (no prefisso)',
            size: 50,
        },
        {
            id: 'fullPhoneNumber',
            header: names.phone_number,
            size: 50,
            accessorFn: row => `(${row.phone_prefix || 'vuoto'}) ${row.phone_number || '(vuoto)'}`,
            Cell: ({row}) => (
                <span>({row.original.phone_prefix || 'vuoto'}) {row.original.phone_number || '(vuoto)'}</span>
            ),
        },
        {
            accessorKey: 'whatsapp_prefix',
            header: 'Prefisso WhatsApp',
            size: 50,
        },
        {
            accessorKey: 'whatsapp_number',
            header: 'Numero WhatsApp (no prefisso)',
            size: 50,
        },
        {
            id: 'fullWANumber',
            header: names.whatsapp_number,
            size: 50,
            accessorFn: row => `(${row.whatsapp_prefix || 'vuoto'}) ${row.whatsapp_number || '(vuoto)'}`,
            Cell: ({row}) => (
                <span>({row.original.whatsapp_prefix || 'vuoto'}) {row.original.whatsapp_number || '(vuoto)'}</span>
            ),
        },
        {
            accessorKey: 'domicile',
            header: names.domicile,
            size: 50,
        },
        {
            accessorKey: 'person_code',
            header: names.person_code,
            size: 50,
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
            Cell: ({cell}) => {
                const v = cell.getValue();
                if (!v) return '';
                return new Date(v).toLocaleDateString('it-IT', {day: '2-digit', month: 'short', year: 'numeric'});
            },
        },
        {
            accessorKey: 'latest_document.number',
            header: names.latest_document,
            size: 50,
        },

    ], []);

    const columnVisibility = {
        created_at: true,
        id: false,
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
        matricola_number: true,
        matricola_expiration: false,
        'latest_document.number': false,
        phone_prefix: false,
        phone_number: false,
        whatsapp_prefix: false,
        whatsapp_number: false
    }

    return (
        <Box>
            <Sidebar/>
            <Box sx={{mx: '5%'}}>
                <Box sx={{display: 'flex', alignItems: 'center', mb: 4}}>
                    <SnowboardingIcon sx={{marginRight: '10px'}}/>
                    <Typography variant="h4">Profili Erasmus</Typography>
                    <Box sx={{flexGrow: 1}}/>
                    <IconButton
                        onClick={() => profilesListRef.current?.refreshData()}
                        title="Aggiorna">
                        <RefreshIcon/>
                    </IconButton>
                </Box>
            </Box>
            <ProfilesList
                ref={profilesListRef}
                apiEndpoint="/erasmus_profiles/"
                columns={columns}
                columnVisibility={columnVisibility}
                profileType="Erasmus"
            />
        </Box>
    );
}