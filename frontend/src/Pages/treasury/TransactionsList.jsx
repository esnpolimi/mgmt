import React, {useState, useEffect, useMemo} from 'react';
import {Box, Typography, FormControl, InputLabel, Select, MenuItem, OutlinedInput, Grid, IconButton, Chip, Button} from '@mui/material';
import Sidebar from '../../Components/Sidebar.jsx';
import Loader from '../../Components/Loader';
import {fetchCustom} from '../../api/api';
import {MaterialReactTable, useMaterialReactTable} from 'material-react-table';
import {MRT_Localization_IT} from 'material-react-table/locales/it';
import {transactionDisplayNames as names} from '../../utils/displayAttributes';
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {useNavigate} from "react-router-dom";
import {DatePicker, LocalizationProvider} from '@mui/x-date-pickers';
import {AdapterDateFns} from '@mui/x-date-pickers/AdapterDateFns';
import itLocale from 'date-fns/locale/it';
import ClearIcon from '@mui/icons-material/Clear';

const transactionTypes = [
    {value: '', label: 'Tutti'},
    {value: 'subscription', label: names.type_event, color: 'primary'},
    {value: 'esncard', label: names.type_esncard, color: 'secondary'},
    {value: 'deposit', label: names.type_deposit, color: 'success'},
    {value: 'withdrawal', label: names.type_withdrawal, color: 'error'},
];

export default function TransactionsList() {
    const [isLoading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [filters, setFilters] = useState({
        account: [],
        type: [],
        dateFrom: null,
        dateTo: null,
    });
    const navigate = useNavigate();

    useEffect(() => {
        setLoading(true);
        Promise.all([
            fetchCustom('GET', '/transactions/'),
            fetchCustom('GET', '/accounts/')
        ]).then(async ([txRes, accRes]) => {
            const txJson = txRes.ok ? await txRes.json() : {results: []};
            const accJson = accRes.ok ? await accRes.json() : {results: []};
            setTransactions(txJson.results || []);
            setAccounts(accJson.results || []);
        }).finally(() => setLoading(false));
    }, []);

    const filteredData = useMemo(() => {
        return transactions.filter(tx => {
            const matchAccount = !filters.account.length || (tx.account && filters.account.includes(tx.account.id));
            const matchType = !filters.type.length || filters.type.includes(tx.type);
            const txDate = new Date(tx.created_at);
            const matchFrom = !filters.dateFrom || txDate >= filters.dateFrom;
            const matchTo = !filters.dateTo || txDate <= filters.dateTo;
            return matchAccount && matchType && matchFrom && matchTo;
        });
    }, [transactions, filters]);

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
                const colorMap = {
                    subscription: 'primary',
                    esncard: 'secondary',
                    deposit: 'success',
                    withdrawal: 'error',
                };
                const labelMap = {
                    subscription: names.type_event,
                    esncard: names.type_esncard,
                    deposit: names.type_deposit,
                    withdrawal: names.type_withdrawal,
                }
                return (
                    <Chip
                        label={labelMap[type] || 'Sconosciuto'}
                        color={colorMap[type] || 'default'}
                        variant="outlined"
                    />
                );
            }
        },
        {accessorKey: 'executor.name', header: names.executor, size: 150},
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
                        <Chip label={`€${cell.getValue()}`} color="primary"/>) : (
                        <Chip label="N/A" color="warning"/>)}
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
    ], []);

    const table = useMaterialReactTable({
        columns,
        data: filteredData,
        enableStickyHeader: true,
        enableStickyFooter: true,
        enableColumnFilterModes: true,
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
    });

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
            <Box sx={{mx: '5%'}}>
                <Box sx={{display: 'flex', alignItems: 'center', marginBottom: '20px'}}>
                    <IconButton onClick={() => navigate(-1)} sx={{mr: 2}}><ArrowBackIcon/></IconButton>
                    <Typography variant="h4">Lista Transazioni</Typography>
                </Box>
                <Grid container spacing={2} sx={{mb: 2, mt: 4}} alignItems="center">
                    <Grid size={{xs: 12, sm: 3}}>
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
                    <Grid size={{xs: 12, sm: 3}}>
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
                                Azzera filtri date
                            </Button>
                        </Grid>
                    )}
                </Grid>
                {isLoading ? <Loader/> : <MaterialReactTable  sx={{mt: 2}} table={table}/>}
            </Box>
        </Box>
    );
}

