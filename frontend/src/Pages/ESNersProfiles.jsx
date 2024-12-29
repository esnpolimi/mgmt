import React, {useEffect, useState, useMemo} from 'react';
import {Box, Typography, Chip, MenuItem, ListItemIcon, CssBaseline, IconButton} from '@mui/material';
import {AccountCircle, Send, People} from '@mui/icons-material';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import {MaterialReactTable, useMaterialReactTable} from 'material-react-table';
import Sidebar from '../Components/Sidebar.jsx'
import ProfileDetail from '../Components/ProfileDetail.jsx';
import dayjs from 'dayjs';
import ESNcardEmissionModal from '../Components/ESNcardEmissionModal.jsx'
import {fetchCustom} from "../api/api";

export default function ESNersProfiles() {

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [drawerOpen, toggleDrawer] = useState(false);

    const [modalOpen, toggleModal] = useState(false);
    const [emissionProfile, setEmissionProfile] = useState({});

    const formatDateString = (date) => {
        return dayjs(date).format('YYYY-MM-DD');
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetchCustom("GET", '/user_profiles/');
                const json = await response.json();
                const formattedData = json.results.map((item) => ({
                    ...item,
                    id: item.profile.id,  // Bring profile.id to top level
                    name: item.profile.name,
                    surname: item.profile.surname,
                    email: item.profile.email,
                    whatsapp: item.profile.whatsapp,
                    country: item.profile.country,
                    gender: item.profile.gender,
                    birthdate: item.profile.birthdate,
                    course: item.profile.course,
                    phone: item.profile.phone,
                    person_code: item.profile.person_code,
                    domicile: item.profile.domicile,
                    residency: item.profile.residency,
                    latest_document: item.profile.latest_document,
                    latest_matricola: item.profile.latest_matricola,
                    latest_esncard: item.profile.latest_esncard,
                }));
                setData(formattedData);
                setLoading(false);
            } catch (error) {
                console.error('Error fetching data:', error);
                setLoading(false);
            }
        };

        fetchData();
    }, []);

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

    const table = useMaterialReactTable({
        columns,
        data,
        enableStickyHeader: true,
        enableStickyFooter: true,
        enableColumnFilterModes: true,
        enableColumnOrdering: true,
        enableGrouping: true,
        enableColumnPinning: true,
        enableFacetedValues: true,
        enableRowActions: true,
        enableRowSelection: false,
        enableRowPinning: true,
        enableExpandAll: false,
        initialState: {
            showColumnFilters: false,
            showGlobalFilter: true,
            columnPinning: {
                left: ['mrt-row-expand', 'mrt-row-select'],
                right: ['mrt-row-actions'],
            },
            columnVisibility: {
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
            },
        },
        paginationDisplayMode: 'pages',
        positionToolbarAlertBanner: 'bottom',
        muiSearchTextFieldProps: {
            size: 'small',
            variant: 'outlined',
        },
        muiPaginationProps: {
            color: 'secondary',
            rowsPerPageOptions: [10, 20, 30],
            shape: 'rounded',
            variant: 'outlined',
        },
        renderDetailPanel: ({row}) => {
            return (
                <ProfileDetail row={row} updateTableRow={(id, rowData) => {
                    setData(data.map((row) => {
                        if (row.profile.id === id) {
                            let updatedRow = Object.fromEntries(Object.keys(row).map((e) => {
                                if (e in rowData) return [e, rowData[e]];
                                else return [e, row[e]]
                            }));
                            updatedRow.birthdate = formatDateString(rowData.birthdate);
                            return updatedRow;
                        } else {
                            return row;
                        }
                    }));
                }}/>
            );
        },
        renderRowActionMenuItems: ({closeMenu, row, table}) => [
            <MenuItem
                key={1}
                onClick={() => {
                    // Send email logic...
                    closeMenu();
                    setEmissionProfile(row.original);
                    toggleModal(true);
                }}
                sx={{m: 0}}
            >
                <ListItemIcon>
                    <CreditCardIcon/>
                </ListItemIcon>
                Release ESNcard
            </MenuItem>,
        ],
    });

    return (
        <Box>
            <Sidebar/>
            <ESNcardEmissionModal open={modalOpen} profile={emissionProfile} onClose={() => toggleModal(false)}/>
            <Box sx={{mx: '5%'}}>
                <Box sx={{display: 'flex', alignItems: 'center', marginBottom: '20px'}}>
                    <People sx={{marginRight: '10px'}}/>
                    <Typography variant="h4">ESNers Profiles</Typography>
                </Box>
                <MaterialReactTable table={table}/>
            </Box>
        </Box>
    );
}
