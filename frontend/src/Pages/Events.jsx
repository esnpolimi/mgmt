import React, {useEffect, useState, useMemo} from 'react';
import {Box, Typography, Chip, Button, IconButton} from '@mui/material';
import {MaterialReactTable, useMaterialReactTable} from 'material-react-table';
import Sidebar from '../Components/Sidebar.jsx'
import dayjs from 'dayjs';
import ESNcardEmissionModal from '../Components/ESNcardEmissionModal.jsx'
import EventIcon from '@mui/icons-material/Event'; // Events icon
import EditIcon from '@mui/icons-material/Edit';
import FormModal from '../Components/EventModal.jsx';
import {fetchCustom} from "../api/api";


export default function Events() {

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [drawerOpen, toggleDrawer] = useState(false);

    const [modalOpen, setModalOpen] = useState(false);
    const [emissionProfile, setEmissionProfile] = useState({});

    const formatDateString = (date) => {
        return dayjs(date).format('YYYY-MM-DD');
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetchCustom("GET", '/events/');
                const json = await response.json();
                setData(json.results);
                setLoading(false);
            } catch (error) {
                console.error('Error fetching data:', error);
                setLoading(false);
            }
        };

        fetchData().then();
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
            accessorKey: 'date',
            header: 'Date',
            size: 150,
        },
        {
            accessorKey: 'description',
            header: 'Description',
            size: 150,
        },
        {
            accessorKey: 'enable_form',
            header: 'Form',
            size: 50,
            Cell: ({cell}) => (
                <Box sx={{}}>
                    {cell.getValue() ? (
                        <Chip label="Yes" color="success"/>
                    ) : (
                        <Chip label="No" color="error"/>
                    )}
                </Box>
            ),
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
        renderRowActions: ({row}) => {
            return (
                <IconButton>
                    <EditIcon/>
                </IconButton>
            )
        },
        renderTopToolbarCustomActions: ({table}) => {
            return (
                <Box sx={{display: 'flex', flexDirection: 'row'}}>
                    <Button variant='contained' onClick={() => setModalOpen(true)}>
                        Create
                    </Button>
                </Box>
            );
        },

    });

    return (
        <Box>
            <Sidebar/>
            <FormModal open={modalOpen} handleClose={() => setModalOpen(false)} />
            <Box sx={{mx: '5%'}}>
                <Box sx={{display: 'flex', alignItems: 'center', marginBottom: '20px'}}>
                    <EventIcon sx={{marginRight: '10px'}}/>
                    <Typography variant="h4">Events</Typography>
                </Box>
                <MaterialReactTable table={table}/>
            </Box>
        </Box>
    );
}
