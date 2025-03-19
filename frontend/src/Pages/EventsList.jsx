import React, {useEffect, useState, useMemo} from 'react';
import {Box, Typography, Chip, Button} from '@mui/material';
import {MaterialReactTable, useMaterialReactTable} from 'material-react-table';
import Sidebar from '../Components/Sidebar.jsx'
import EventIcon from '@mui/icons-material/Event';
import EventModal from '../Components/EventModal.jsx';
import {fetchCustom} from "../api/api";
import {MRT_Localization_IT} from "material-react-table/locales/it";
import {useNavigate} from "react-router-dom";
import {eventDisplayNames as names} from "../utils/displayAttributes";
import Loader from "../Components/Loader";
import dayjs from "dayjs";


export default function EventsList() {
    const [data, setData] = useState([]);
    const [isLoading, setLoading] = useState(true);
    const [modalOpen, toggleModal] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetchCustom("GET", '/events/');
                const json = await response.json();
                setData(json.results);
                console.log("Event List Data: ", json.results);
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
            header: names.id,
            size: 50,
        },
        {
            accessorKey: 'name',
            header: names.name,
            size: 150,
        },
        {
            accessorKey: 'date',
            header: names.date,
            size: 150,
        },
        {
            accessorKey: 'description',
            header: names.description,
            size: 150,
        },
        {
            accessorKey: 'cost',
            header: names.cost,
            size: 150,
        },
        {
            accessorKey: 'subscription_start_date',
            header: names.subscription_date_status,
            size: 150,
            Cell: ({row}) => {
                const now = dayjs();
                const startDateTime = row.original.subscription_start_date ? dayjs(row.original.subscription_start_date) : null;
                const endDateTime = row.original.subscription_end_date ? dayjs(row.original.subscription_end_date) : null;

                let status = "Non disponibile";
                let color = "error";

                if (startDateTime && endDateTime) {
                    if (now.isAfter(startDateTime) && now.isBefore(endDateTime)) {
                        status = "Iscrizioni aperte";
                        color = "success";
                    } else if (now.isBefore(startDateTime)) {
                        status = "Iscrizioni non ancora aperte";
                        color = "warning";
                    } else if (now.isAfter(endDateTime)) {
                        status = "Iscrizioni chiuse";
                        color = "error";
                    }
                }

                return <Chip label={status} color={color}/>;
            },
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
        enableRowActions: false,
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
                date: true,
                description: true,
                enable_form: true,
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
        localization: MRT_Localization_IT,
        muiTableBodyRowProps: ({row}) => ({
            onClick: () => {
                navigate('/event/' + row.original.id, {state: {event: row.original}});
            },
        }),
        renderTopToolbarCustomActions: ({table}) => {
            return (
                <Box sx={{display: 'flex', flexDirection: 'row'}}>
                    <Button variant='contained' onClick={() => toggleModal(true)} sx={{width: '150px'}}>
                        Crea
                    </Button>
                </Box>
            );
        },

    });

    return (
        <Box>
            <Sidebar/>
            {modalOpen && <EventModal
                open={modalOpen}
                handleClose={() => toggleModal(false)}
                isEdit={false}
            />}
            <Box sx={{mx: '5%'}}>
                {isLoading ? <Loader/> : (<>
                        <Box sx={{display: 'flex', alignItems: 'center', marginBottom: '20px'}}>
                            <EventIcon sx={{marginRight: '10px'}}/>
                            <Typography variant="h4">Lista Eventi</Typography>
                        </Box>
                        <MaterialReactTable table={table}/>
                    </>
                )}
            </Box>
        </Box>
    );
}
