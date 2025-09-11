import {useState, useEffect, useMemo, useRef} from 'react';
import {Box, Typography, FormControl, InputLabel, Select, MenuItem, OutlinedInput, Grid, IconButton, Chip, Button} from '@mui/material';
import Sidebar from '../../Components/Sidebar.jsx';
import Loader from '../../Components/Loader';
import {fetchCustom, defaultErrorHandler} from '../../api/api';
import {MaterialReactTable, useMaterialReactTable} from 'material-react-table';
import {MRT_Localization_IT} from 'material-react-table/locales/it';
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {useNavigate} from "react-router-dom";
import {DatePicker, LocalizationProvider} from '@mui/x-date-pickers';
import {AdapterDateFns} from '@mui/x-date-pickers/AdapterDateFns';
import itLocale from 'date-fns/locale/it';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import ReimburseRequestModal from '../../Components/treasury/ReimburseRequestModal';
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Popup from "../../Components/Popup";
import RefreshIcon from "@mui/icons-material/Refresh";
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';

const PAYMENT_CONFIGS = {
    cash: {label: "Contanti", color: 'success'},
    paypal: {label: "PayPal", color: 'info'},
    bonifico: {label: "Bonifico", color: 'warning'}
};

const paymentTypes = [
    {value: '', label: 'Tutti'},
    ...Object.entries(PAYMENT_CONFIGS).map(([value, config]) => ({
        value,
        label: config.label,
        color: config.color
    }))
];

export default function ReimbursementRequestsList() {
    const [isLoading, setLoading] = useState(true);
    const [requests, setRequests] = useState([]);
    const [rowCount, setRowCount] = useState(0);
    const [pagination, setPagination] = useState({pageIndex: 0, pageSize: 10});
    const [filters, setFilters] = useState({
        payment: [],
        dateFrom: null,
        dateTo: null,
    });
    const [search, setSearch] = useState('');
    const [appliedSearch, setAppliedSearch] = useState('');
    const [reimburseModalOpen, setReimburseModalOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [popup, setPopup] = useState(null);
    const searchInputRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        refreshRequestsData();
    }, [pagination.pageIndex, pagination.pageSize, filters, appliedSearch]);

    const refreshRequestsData = () => {
        setLoading(true);
        const params = new URLSearchParams();
        params.append('page', pagination.pageIndex + 1);
        params.append('page_size', pagination.pageSize);
        if (appliedSearch) params.append('search', appliedSearch);
        if (filters.payment.length)
            filters.payment.forEach(p => params.append('payment', p));
        if (filters.dateFrom)
            params.append('dateFrom', filters.dateFrom.toISOString());
        if (filters.dateTo)
            params.append('dateTo', filters.dateTo.toISOString());
        fetchCustom('GET', `/reimbursement_requests/?${params.toString()}`, {
            onSuccess: (data) => {
                setRowCount(data.count || 0);
                setRequests(data.results || []);
            },
            onError: (responseOrError) => {
                defaultErrorHandler(responseOrError, setPopup);
                setRequests([]);
                setRowCount(0);
            },
            onFinally: () => setLoading(false)
        });
    };

    const handleOpenReimburseModal = (row) => {
        setSelectedRequest(row.original);
        setReimburseModalOpen(true);
    };

    const handleCloseReimburseModal = (success) => {
        setReimburseModalOpen(false);
        if (success) {
            setPopup({message: "Rimborso effettuato con successo!", state: "success", id: Date.now()});
            refreshRequestsData();
        }
        setSelectedRequest(null);
    };

    const handleReimbursed = () => {
        refreshRequestsData();
    };

    const columns = useMemo(() => [
        {
            accessorKey: 'created_at', header: "Data", size: 100,
            Cell: ({cell}) => {
                const date = new Date(cell.getValue());
                return new Intl.DateTimeFormat('it-IT', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                }).format(date);
            }
        },
        {
            accessorKey: 'user.name', header: "Richiedente", size: 150,
            Cell: ({row}) => (
                <span>
                    <Button variant="text"
                            color="primary"
                            sx={{textTransform: 'none', padding: 0, minWidth: 0}}
                            endIcon={<OpenInNewIcon fontSize="small"/>}
                            onClick={() => window.open(`/profile/${row.original.user.id}`, '_blank', 'noopener,noreferrer')}>
                        {row.original.user.name}
                    </Button>
                </span>
            )
        },
        {
            accessorKey: 'amount', header: "Importo", size: 100,
            Cell: ({cell}) => (
                <Box>
                    {cell.getValue() !== null ? (
                        <Chip label={`€${cell.getValue()}`} color="primary"/>) : (
                        <Chip label="N/A" color="warning"/>)}
                </Box>
            ),
        },
        {
            accessorKey: 'payment',
            header: "Metodo",
            size: 100,
            Cell: ({cell}) => {
                const payment = cell.getValue();
                const config = PAYMENT_CONFIGS[payment] || {label: payment, color: 'default'};
                return (
                    <Chip
                        label={config.label}
                        color={config.color}
                        variant="outlined"
                    />
                );
            }
        },
        {
            accessorKey: 'description',
            header: "Descrizione",
            size: 100,
            Cell: ({cell}) => (
                <Box component="span" fontStyle="italic">
                    {cell.getValue()}
                </Box>
            ),
        },
        {
            accessorKey: 'receipt_link',
            header: "Ricevuta",
            size: 100,
            Cell: ({cell}) => cell.getValue() ? (
                <span>
                    <Button variant="text"
                            color="primary"
                            sx={{textTransform: 'none', padding: 0, minWidth: 0}}
                            endIcon={<OpenInNewIcon fontSize="small"/>}
                            onClick={() => window.open(cell.getValue(), '_blank', 'noopener,noreferrer')}>
                        Link Drive
                    </Button>
                </span>
            ) : ("-")
        },
        {
            accessorKey: 'is_reimbursed',
            header: "Rimborsato",
            size: 50,
            Cell: ({row, cell}) => {
                const isReimbursed = cell.getValue();
                const account = row.original.account;
                return (
                    <Chip
                        label={
                            isReimbursed
                                ? `Sì${account && account.name ? ` (${account.name})` : ""}`
                                : "No"
                        }
                        color={isReimbursed ? "success" : "error"}
                        variant="outlined"/>
                );
            }
        },
        {
            header: "Azioni",
            id: "actions",
            size: 50,
            Cell: ({row}) => (
                <IconButton color="success"
                            title="Modifica / Rimborsa"
                            onClick={() => handleOpenReimburseModal(row)}>
                    <PointOfSaleIcon/>
                </IconButton>
            )
        }
    ], []);

    const table = useMaterialReactTable({
        columns,
        data: requests,
        enableStickyHeader: true,
        enableStickyFooter: true,
        enableColumnFilters: false,
        enableColumnOrdering: true,
        enableGrouping: false,
        enableFacetedValues: true,
        enableRowActions: false,
        enableRowSelection: false,
        enableExpandAll: false,
        initialState: {
            showColumnFilters: false,
            showGlobalFilter: true,
            columnPinning: {
                left: ['mrt-row-expand', 'mrt-row-select'],
                right: ['mrt-row-actions'],
            },
            sorting: [{id: 'created_at', desc: true}],
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
    });

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

    const handleDateChange = (name, value) => {
        setFilters(prev => {
            let newFilters = {...prev, [name]: value};
            if (name === 'dateFrom' && newFilters.dateTo && value && value > newFilters.dateTo)
                newFilters.dateTo = value;
            if (name === 'dateTo' && newFilters.dateFrom && value && value < newFilters.dateFrom)
                newFilters.dateFrom = value;
            return newFilters;
        });
    };

    const handleFilterChange = (e) => {
        const {name, value} = e.target;
        setFilters(prev => {
            let newFilters = {...prev, [name]: value};
            if (name === 'payment') {
                newFilters[name] = typeof value === 'string' ? value.split(',') : value;
            }
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

    return (
        <Box>
            <Sidebar/>
            <Box sx={{mx: '5%'}}>
                <Box sx={{display: 'flex', alignItems: 'center', mb: 4}}>
                    <IconButton onClick={() => navigate(-1)} sx={{mr: 2}}><ArrowBackIcon/></IconButton>
                    <Typography variant="h4">
                        <ReceiptLongIcon sx={{mr: 2}}/>
                        Richieste di Rimborso
                    </Typography>
                    <Box sx={{flexGrow: 1}}/>
                    <IconButton onClick={refreshRequestsData}
                                title="Aggiorna"
                                disabled={isLoading}>
                        <RefreshIcon/>
                    </IconButton>
                </Box>
                <Grid container spacing={2} sx={{mb: 2, mt: 4}} alignItems="center">
                    <Grid size={{xs: 12, sm: 2}}>
                        <FormControl fullWidth>
                            <InputLabel id="payment-label">Metodo</InputLabel>
                            <Select
                                labelId="payment-label"
                                name="payment"
                                multiple
                                value={filters.payment}
                                onChange={handleFilterChange}
                                input={<OutlinedInput label="Metodo"/>}
                                variant="outlined"
                                renderValue={(selected) =>
                                    paymentTypes.filter(t => selected.includes(t.value) && t.value).map(t => t.label).join(', ')
                                }>
                                {paymentTypes.filter(t => t.value).map(t => (
                                    <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{xs: 12, sm: 2}}>
                        <FormControl fullWidth>
                            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={itLocale}>
                                <DatePicker
                                    label="Da"
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
                                    label="A"
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
                                sx={{height: '100%', minWidth: 0, px: 1}}>
                                Azzera date
                            </Button>
                        </Grid>
                    )}
                    <Grid size={{xs: 12, sm: 2}} sx={{ml: 'auto'}}>
                        <FormControl fullWidth>
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
                        </FormControl>
                    </Grid>
                </Grid>
                {isLoading ? <Loader/> : <MaterialReactTable sx={{mt: 2}} table={table}/>}
                <ReimburseRequestModal
                    open={reimburseModalOpen}
                    onClose={handleCloseReimburseModal}
                    requestData={selectedRequest}
                    onReimbursed={handleReimbursed}
                    requestId={selectedRequest ? selectedRequest.id : null}
                />
                {popup && <Popup key={popup.id} message={popup.message} state={popup.state}/>}
            </Box>
        </Box>
    );
}
