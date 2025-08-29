import {useState, useEffect, useMemo, useRef} from 'react';
import {Box, Typography, FormControl, InputLabel, Select, MenuItem, OutlinedInput, Grid, IconButton, Chip, Button} from '@mui/material';
import Sidebar from '../../Components/Sidebar.jsx';
import Loader from '../../Components/Loader';
import {fetchCustom, defaultErrorHandler} from '../../api/api';
import {MaterialReactTable, useMaterialReactTable} from 'material-react-table';
import {MRT_Localization_IT} from 'material-react-table/locales/it';
import {transactionDisplayNames as names} from '../../utils/displayAttributes';
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {useNavigate} from "react-router-dom";
import {DatePicker, LocalizationProvider} from '@mui/x-date-pickers';
import {AdapterDateFns} from '@mui/x-date-pickers/AdapterDateFns';
import itLocale from 'date-fns/locale/it';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import EditIcon from '@mui/icons-material/Edit';
import TransactionModal from "../../Components/treasury/TransactionModal.jsx";
import TransactionAdd from "../../Components/treasury/TransactionAdd.jsx";
import Popup from "../../Components/Popup";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import {TRANSACTION_CONFIGS} from "../../data/transactionConfigs";
import RefreshIcon from "@mui/icons-material/Refresh";
import ReceiptIcon from '@mui/icons-material/Receipt';

// For the filter dropdown
const transactionTypes = [
    {value: '', label: 'Tutti'},
    ...Object.entries(TRANSACTION_CONFIGS).map(([value, config]) => ({
        value,
        label: config.label,
        color: config.color
    }))
];

export default function TransactionsList() {
    const [isLoading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const navigate = useNavigate();
    const [popup, setPopup] = useState(null);
    const [transactionModalOpen, setTransactionModalOpen] = useState(false);
    const [transactionAddOpen, setTransactionAddOpen] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [pagination, setPagination] = useState({pageIndex: 0, pageSize: 10});
    const [rowCount, setRowCount] = useState(0);

    const [filters, setFilters] = useState({
        account: [],
        type: [],
        dateFrom: null,
        dateTo: null,
    });
    const [search, setSearch] = useState('');
    const [appliedSearch, setAppliedSearch] = useState('');
    const searchInputRef = useRef(null);

    useEffect(() => {
        refreshTransactionsData();
    }, [pagination.pageIndex, pagination.pageSize, filters, appliedSearch]);

    const refreshTransactionsData = () => {
        setLoading(true);
        const params = new URLSearchParams();
        params.append('page', pagination.pageIndex + 1);
        params.append('page_size', pagination.pageSize);
        if (appliedSearch) params.append('search', appliedSearch);
        if (filters.account.length)
            filters.account.forEach(acc => params.append('account', acc));
        if (filters.type.length)
            filters.type.forEach(t => params.append('type', t));
        if (filters.dateFrom)
            params.append('dateFrom', filters.dateFrom.toISOString());
        if (filters.dateTo)
            params.append('dateTo', filters.dateTo.toISOString());

        // Transactions
        fetchCustom('GET', `/transactions/?${params.toString()}`, {
            onSuccess: (data) => {
                setRowCount(data.count || 0);
                setTransactions(data.results || []);
            },
            onError: (responseOrError) => {
                defaultErrorHandler(responseOrError, setPopup).then();
                setTransactions([]);
                setRowCount(0);
            },
            onFinally: () => setLoading(false)
        });

        // Accounts
        fetchCustom('GET', '/accounts/', {
            onSuccess: (data) => setAccounts(data),
            onError: () => setAccounts([]),
            // No need to setLoading here, handled above
        });
    };

    const columns = useMemo(() => [
        {
            accessorKey: 'created_at', header: names.date, size: 120,
            Cell: ({cell}) => {
                const date = new Date(cell.getValue());
                return new Intl.DateTimeFormat('it-IT', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                }).format(date);
            }
        },
        {
            accessorKey: 'type', header: names.type, size: 100,
            Cell: ({cell}) => {
                const type = cell.getValue();
                const config = TRANSACTION_CONFIGS[type] || {label: 'Sconosciuto', color: 'default'};
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
            accessorKey: 'executor.name', header: names.executor, size: 150,
            Cell: ({row}) => {
                const exec = row.original.executor;
                if (!exec) return <span style={{color: '#777'}}>Pagamento Online</span>;
                return (
                    <span>
                        <Button
                            variant="text"
                            color="primary"
                            sx={{textTransform: 'none', padding: 0, minWidth: 0}}
                            endIcon={exec.id ? <OpenInNewIcon fontSize="small"/> : null}
                            onClick={() => {
                                if (exec.id) window.open(`/profile/${exec.id}`, '_blank', 'noopener,noreferrer');
                            }}
                        >
                            {exec.name || exec.email || 'N/A'}
                        </Button>
                    </span>
                );
            }
        },
        {
            accessorKey: 'account.name',
            header: names.account,
            size: 120,
            Cell: ({cell}) => (
                <Box component="span" fontWeight="bold">
                    {cell.getValue()}
                </Box>
            ),
        },
        {
            accessorKey: 'amount', header: names.amount, size: 100,
            Cell: ({cell}) => (
                <Box>
                    {cell.getValue() !== null ? (
                        <Chip
                            label={`€${cell.getValue()}`}
                            color={cell.getValue() < 0 ? "error" : "primary"}
                        />
                    ) : (
                        <Chip label="N/A" color="warning"/>
                    )}
                </Box>
            ),
        },
        {
            accessorKey: 'description',
            header: names.description,
            size: 200,
            Cell: ({cell}) => (
                <Box component="span" fontStyle="italic">
                    {cell.getValue()}
                </Box>
            ),
        },
        {
            accessorKey: 'actions',
            header: 'Azioni',
            size: 80,
            Cell: ({row}) => (
                <IconButton
                    color="primary"
                    title="Modifica Transazione"
                    onClick={() => {
                        setSelectedTransaction(row.original);
                        setTransactionModalOpen(true);
                    }}>
                    <EditIcon/>
                </IconButton>
            ),
            enableSorting: false,
            enableColumnActions: false,
        }
    ], []);

    const table = useMaterialReactTable({
        columns,
        data: transactions,
        enableStickyHeader: true,
        enableStickyFooter: true,
        enableColumnFilters: false, // Disable MUI filters, because they only search in the current page
        enableColumnOrdering: true,
        enableGrouping: true,
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
        renderTopToolbarCustomActions: () => (
            <Box sx={{display: 'flex', flexDirection: 'row', alignItems: 'center'}}>
                <Button
                    variant="contained"
                    sx={{ml: 2}}
                    onClick={() => {
                        setTransactionAddOpen(true);
                    }}
                >
                    Deposita/Preleva
                </Button>
            </Box>
        ),
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

    const handleCloseTransactionModal = (success) => {
        setTransactionModalOpen(false);
        if (success) {
            setPopup({message: "Transazione modificata con successo!", state: "success", id: Date.now()});
            refreshTransactionsData();
        }
        setSelectedTransaction(null);
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

    const handleFilterChange = (e) => {
        const {name, value} = e.target;
        setFilters(prev => {
            let newFilters = {...prev, [name]: value};
            // For multi-selects
            if (name === 'account' || name === 'type') {
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
            {transactionModalOpen && <TransactionModal
                open={transactionModalOpen}
                onClose={handleCloseTransactionModal}
                transaction={selectedTransaction}
            />}
            {/* Transaction Add Modal */}
            {transactionAddOpen &&
                <TransactionAdd
                    open={transactionAddOpen}
                    onClose={(success) => {
                        setTransactionAddOpen(false);
                        if (success) {
                            setPopup({message: "Transazione aggiunta con successo!", state: "success", id: Date.now()});
                            refreshTransactionsData();
                        }
                    }}
                />
            }
            <Box sx={{mx: '5%'}}>
                <Box sx={{display: 'flex', alignItems: 'center', mb: 4}}>
                    <IconButton onClick={() => navigate(-1)} sx={{mr: 2}}><ArrowBackIcon/></IconButton>
                    <Typography variant="h4" sx={{mr: 2}}>
                        <ReceiptIcon sx={{mr: 2}}/>
                        Lista Transazioni
                    </Typography>
                    <Box sx={{flexGrow: 1}}/>
                    <IconButton onClick={refreshTransactionsData}
                                title="Aggiorna"
                                disabled={isLoading}
                                sx={{ml: 1}}>
                        <RefreshIcon/>
                    </IconButton>
                </Box>
                <Grid container spacing={2} sx={{mb: 2, mt: 4}} alignItems="center">
                    <Grid size={{xs: 12, sm: 2}}>
                        <FormControl fullWidth>
                            <InputLabel id="account-label">Cassa</InputLabel>
                            <Select
                                labelId="account-label"
                                name="account"
                                multiple
                                value={filters.account}
                                onChange={handleFilterChange}
                                input={<OutlinedInput label="Cassa"/>}
                                variant="outlined"
                                renderValue={(selected) =>
                                    accounts.filter(acc => selected.includes(acc.id)).map(acc => acc.name).join(', ')
                                }>
                                {accounts.map(acc => (
                                    <MenuItem key={acc.id} value={acc.id}>{acc.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{xs: 12, sm: 2}}>
                        <FormControl fullWidth>
                            <InputLabel id="type-label">Tipo</InputLabel>
                            <Select
                                labelId="type-label"
                                name="type"
                                multiple
                                value={filters.type}
                                onChange={handleFilterChange}
                                input={<OutlinedInput label="Tipo"/>}
                                variant="outlined"
                                renderValue={(selected) =>
                                    transactionTypes.filter(t => selected.includes(t.value) && t.value).map(t => t.label).join(', ')
                                }>
                                {transactionTypes.filter(t => t.value).map(t => (
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
                {popup && <Popup key={popup.id} message={popup.message} state={popup.state}/>}
            </Box>
        </Box>
    );
}