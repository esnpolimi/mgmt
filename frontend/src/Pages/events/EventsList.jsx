import {useEffect, useState, useMemo, useRef} from 'react';
import {Box, Typography, Chip, Button, Grid, OutlinedInput, IconButton, FormControl, InputLabel, Select, MenuItem} from '@mui/material';
import {MaterialReactTable, useMaterialReactTable} from 'material-react-table';
import Sidebar from '../../Components/Sidebar.jsx'
import EventIcon from '@mui/icons-material/Event';
import EventModal from '../../Components/events/EventModal.jsx';
import {fetchCustom} from "../../api/api";
import {MRT_Localization_IT} from "material-react-table/locales/it";
import {useNavigate} from "react-router-dom";
import {eventDisplayNames as names} from "../../utils/displayAttributes";
import Loader from "../../Components/Loader";
import dayjs from "dayjs";
import Popup from "../../Components/Popup";
import {extractErrorMessage} from "../../utils/errorHandling";
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import {DatePicker, LocalizationProvider} from '@mui/x-date-pickers';
import {AdapterDateFns} from '@mui/x-date-pickers/AdapterDateFns';
import itLocale from 'date-fns/locale/it';
import * as Sentry from "@sentry/react";
import FestivalIcon from '@mui/icons-material/Festival';
import RefreshIcon from "@mui/icons-material/Refresh";


const SUBSCRIPTION_STATUS_OPTIONS = [
    {value: 'open', label: 'Iscrizioni aperte'},
    {value: 'not_yet', label: 'Non ancora aperte'},
    {value: 'closed', label: 'Iscrizioni chiuse'}
];

export default function EventsList() {
    const [data, setData] = useState([]);
    const [eventModalOpen, setEventModalOpen] = useState(false);
    const navigate = useNavigate();
    const [popup, setPopup] = useState(null);
    const [pagination, setPagination] = useState({pageIndex: 0, pageSize: 10});
    const [rowCount, setRowCount] = useState(0);
    const [search, setSearch] = useState('');
    const [appliedSearch, setAppliedSearch] = useState('');
    const [filters, setFilters] = useState({
        subscriptionStatus: [],
        dateFrom: null,
        dateTo: null,
    });

    const [localLoading, setLocalLoading] = useState(false);
    const searchInputRef = useRef(null);

    const formatDateString = (date) => {
        return dayjs(date).format('YYYY-MM-DD');
    };

    const refreshData = async () => {
        setLocalLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('page', pagination.pageIndex + 1);
            params.append('page_size', pagination.pageSize);
            if (appliedSearch) params.append('search', appliedSearch);
            if (filters.subscriptionStatus.length)
                params.append('status', filters.subscriptionStatus.join(','));
            if (filters.dateFrom)
                params.append('dateFrom', formatDateString(filters.dateFrom));
            if (filters.dateTo)
                params.append('dateTo', formatDateString(filters.dateTo));
            const response = await fetchCustom("GET", `/events/?${params.toString()}`);
            const json = await response.json();
            if (!response.ok) {
                const errorMessage = await extractErrorMessage(json, response.status);
                setPopup({message: `Errore: ${errorMessage}`, state: 'error'});
            } else {
                setRowCount(json.count || 0);
                setData(json.results);
            }
        } catch (error) {
            Sentry.captureException(error);
            setPopup({message: `Errore generale: ${error}`, state: "error"});
        } finally {
            setLocalLoading(false);
        }
    };

    useEffect(() => {
        refreshData().then();
    }, [pagination.pageIndex, pagination.pageSize, filters, appliedSearch]);

    const columns = useMemo(() => [
        {accessorKey: 'id', header: names.id, size: 50},
        {
            accessorKey: 'name',
            header: names.name,
            size: 150,
            Cell: ({cell}) => (
                <Box component="span" fontWeight="bold">
                    {cell.getValue()}
                </Box>
            ),
        },
        {accessorKey: 'date', header: names.date, size: 150},
        {
            accessorKey: 'cost',
            header: names.cost,
            size: 150,
            Cell: ({cell}) => (
                <Box>
                    {cell.getValue() !== null ? (
                        <Chip label={`€${cell.getValue()}`} color="primary"/>) : (
                        <Chip label="N/A" color="warning"/>)}
                </Box>
            ),
        },
        {
            accessorKey: 'status',
            header: names.status,
            size: 150,
            Cell: ({row}) => {
                let status = row.original.status || '';
                let color;
                switch (status) {
                    case 'open':
                        status = "Iscrizioni aperte";
                        color = "success";
                        break;
                    case 'not_yet':
                        status = "Non ancora aperte";
                        color = "warning";
                        break;
                    case 'closed':
                        status = "Iscrizioni chiuse";
                        color = "error";
                        break;
                    default:
                        color = "error";
                        status = "Stato sconosciuto";
                }
                return <Chip label={status} color={color}/>;
            },
        },
        {
            accessorKey: 'actions',
            header: 'Azioni',
            size: 80,
            Cell: ({row}) => (
                <IconButton
                    title="Gestisci Evento"
                    color="primary"
                    onClick={e => {
                        e.stopPropagation();
                        navigate('/event/' + row.original.id, {state: {event: row.original}});
                    }}>
                    <FestivalIcon/>
                </IconButton>
            ),
            enableSorting: false,
            enableColumnActions: false,
        }
    ], []);

    const table = useMaterialReactTable({
        columns,
        data,
        enableStickyHeader: true,
        enableStickyFooter: true,
        enableColumnFilters: false, // Disabled cause it only allows to search in the current page
        enableColumnOrdering: true,
        enableGrouping: true,
        enableColumnPinning: true,
        enableFacetedValues: true,
        enableRowActions: false,
        enableRowSelection: false,
        enableRowPinning: false,
        enableExpandAll: false,
        initialState: {
            showColumnFilters: false,
            showGlobalFilter: true,
            columnPinning: {
                left: ['mrt-row-expand', 'mrt-row-select'],
                right: ['mrt-row-actions'],
            },
            columnVisibility: {
                id: false,
                name: true,
                date: true,
                cost: true
            },
        },
        paginationDisplayMode: 'pages',
        positionToolbarAlertBanner: 'bottom',
        enableGlobalFilter: false,
        muiPaginationProps: {
            color: 'secondary',
            rowsPerPageOptions: [10, 20, 30],
            shape: 'rounded',
            variant: 'outlined',
        },
        manualPagination: true,
        rowCount,
        onPaginationChange: setPagination,
        state: {pagination},
        localization: MRT_Localization_IT,
        renderTopToolbarCustomActions: () => {
            return (
                <Box sx={{display: 'flex', flexDirection: 'row'}}>
                    <Button variant='contained' onClick={() => setEventModalOpen(true)} sx={{width: '150px'}}>
                        Crea
                    </Button>
                </Box>
            );
        }
    });

    // Manual search handlers
    const handleSearchApply = () => {
        setAppliedSearch(search);
        setPagination(prev => ({...prev, pageIndex: 0}));
    };
    const handleSearchClear = () => {
        setSearch('');
        setAppliedSearch('');
        setPagination(prev => ({...prev, pageIndex: 0}));
        if (searchInputRef.current) searchInputRef.current.focus();
    };

    const handleFilterChange = (e) => {
        const {name, value} = e.target;
        setFilters(prev => ({
            ...prev,
            [name]: typeof value === 'string' ? value.split(',') : value
        }));
    };

    const handleDateChange = (name, value) => {
        setFilters(prev => {
            let newFilters = {...prev, [name]: value};
            // Prevent invalid date ranges
            if (name === 'dateFrom' && newFilters.dateTo && value && value > newFilters.dateTo)
                newFilters.dateTo = value;
            if (name === 'dateTo' && newFilters.dateFrom && value && value < newFilters.dateFrom)
                newFilters.dateFrom = value;
            return newFilters;
        });
    };

    const handleClearDates = () => {
        setFilters(prev => ({
            ...prev,
            dateFrom: null,
            dateTo: null,
        }));
    };

    const handleCloseEventModal = async (success) => {
        setEventModalOpen(false);
        if (success) {
            setPopup({message: "Evento creato con successo!", state: "success"});
            await refreshData();
        }
    };

    return (
        <Box>
            <Sidebar/>
            {eventModalOpen && <EventModal
                open={eventModalOpen}
                onClose={handleCloseEventModal}
                isEdit={false}
            />}
            <Box sx={{mx: '5%'}}>
                <Box sx={{display: 'flex', alignItems: 'center', mb: 4}}>
                    <EventIcon sx={{mr: 2}}/>
                    <Typography variant="h4">Lista Eventi</Typography>
                    <Box sx={{flexGrow: 1}}/>
                    <IconButton onClick={refreshData}
                                title="Aggiorna"
                                disabled={localLoading}>
                        <RefreshIcon/>
                    </IconButton>
                </Box>
                <Grid container spacing={2} sx={{mb: 2}} alignItems="center" justifyContent="flex-end">
                    <Grid size={{xs: 12, sm: 2}}>
                        <FormControl fullWidth>
                            <InputLabel id="subscription-status-label">Stato iscrizione</InputLabel>
                            <Select
                                labelId="subscription-status-label"
                                name="subscriptionStatus"
                                multiple
                                value={filters.subscriptionStatus}
                                onChange={handleFilterChange}
                                input={<OutlinedInput label="Stato iscrizione"/>}
                                variant="outlined"
                                renderValue={(selected) =>
                                    SUBSCRIPTION_STATUS_OPTIONS.filter(opt => selected.includes(opt.value)).map(opt => opt.label).join(', ')
                                }>
                                {SUBSCRIPTION_STATUS_OPTIONS.map(opt => (
                                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{xs: 12, sm: 2}}>
                        <FormControl fullWidth>
                            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={itLocale}>
                                <DatePicker
                                    label="Inizio Data Evento"
                                    value={filters.dateFrom}
                                    maxDate={filters.dateTo || undefined}
                                    onChange={date => handleDateChange('dateFrom', date)}
                                    format="d MMM yyyy"/>
                            </LocalizationProvider>
                        </FormControl>
                    </Grid>
                    <Grid size={{xs: 12, sm: 2}}>
                        <FormControl fullWidth>
                            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={itLocale}>
                                <DatePicker
                                    label="Fine Data Evento"
                                    value={filters.dateTo}
                                    minDate={filters.dateFrom || undefined}
                                    onChange={date => handleDateChange('dateTo', date)}
                                    format="d MMM yyyy"/>
                            </LocalizationProvider>
                        </FormControl>
                    </Grid>
                    {(filters.dateFrom || filters.dateTo) && (
                        <Grid size={{xs: 12, sm: 2}} sx={{display: 'flex', alignItems: 'center'}}>
                            <Button
                                variant="outlined"
                                color="secondary"
                                startIcon={<ClearIcon/>}
                                onClick={handleClearDates}
                                sx={{height: '100%', minWidth: 0, px: 1, mr: 1}}>
                                Azzera date
                            </Button>
                        </Grid>
                    )}
                    <Grid size={{xs: 12, sm: 2}} sx={{ml: 'auto'}}>
                        <OutlinedInput
                            inputRef={searchInputRef}
                            size="small"
                            placeholder="Cerca"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleSearchApply();
                            }}
                            endAdornment={
                                search && appliedSearch === search ? (
                                    <IconButton
                                        aria-label="clear"
                                        onClick={handleSearchClear}
                                        edge="end">
                                        <ClearIcon/>
                                    </IconButton>
                                ) : (
                                    <IconButton
                                        aria-label="search"
                                        onClick={handleSearchApply}
                                        edge="end">
                                        <SearchIcon/>
                                    </IconButton>
                                )
                            }
                        />
                    </Grid>
                </Grid>
                {localLoading
                    ? <Loader/>
                    : <MaterialReactTable table={table}/>}
                {popup && <Popup message={popup.message} state={popup.state}/>}
            </Box>
        </Box>
    );
}
