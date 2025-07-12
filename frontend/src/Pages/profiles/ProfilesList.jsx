import {useEffect, useState, useRef, forwardRef, useImperativeHandle} from 'react';
import {Box, Grid, FormControl, InputLabel, Select, MenuItem, OutlinedInput, IconButton} from '@mui/material';
import {MaterialReactTable, useMaterialReactTable} from 'material-react-table';
import {fetchCustom} from '../../api/api';
import {MRT_Localization_IT} from "material-react-table/locales/it";
import Loader from "../../Components/Loader";
import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import {useNavigate} from 'react-router-dom';

const ESNCARD_VALIDITY_OPTIONS = [
    {value: 'valid', label: 'Valida'},
    {value: 'expired', label: 'Scaduta'},
    {value: 'absent', label: 'Assente'}
];

const ProfilesList = forwardRef(function ProfilesList({apiEndpoint, columns, columnVisibility, profileType}, ref) {
    const [data, setData] = useState([]);
    const [pagination, setPagination] = useState({pageIndex: 0, pageSize: 10});
    const [rowCount, setRowCount] = useState(0);
    const [groups, setGroups] = useState([]);
    const [filters, setFilters] = useState({esncardValidity: [], group: []});
    const [search, setSearch] = useState('');
    const [appliedSearch, setAppliedSearch] = useState('');
    const [internalLoading, setInternalLoading] = useState(true);
    const searchInputRef = useRef(null);
    const navigate = useNavigate();

    const fetchData = () => {
        setInternalLoading(true);
        const params = new URLSearchParams();
        params.append('page', pagination.pageIndex + 1);
        params.append('page_size', pagination.pageSize);
        if (appliedSearch) params.append('search', appliedSearch);
        if (filters.esncardValidity.length)
            params.append('esncardValidity', filters.esncardValidity.join(','));
        if (filters.group.length)
            params.append('group', filters.group.join(','));
        fetchCustom('GET', `${apiEndpoint}?${params.toString()}`, {
            onSuccess: (data) => {
                setRowCount(data.count || 0);
                setData(data.results);
            },
            onError: () => {},
            onFinally: () => setInternalLoading(false)
        });
    };

    useImperativeHandle(ref, () => ({
        refreshData: () => {
            fetchData();
        }
    }));

    useEffect(() => {
        fetchData();

        if (profileType === 'ESNer')
            fetchCustom("GET", "/groups/", {onSuccess: (data) => setGroups(data)});
    }, [apiEndpoint, pagination.pageIndex, pagination.pageSize, profileType, filters, appliedSearch]);

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

    const columnsWithActions = [
        ...columns,
        {
            accessorKey: 'actions',
            header: 'Azioni',
            size: 80,
            Cell: ({row}) => (
                <IconButton
                    title="Gestisci profilo"
                    color="primary"
                    onClick={e => {
                        e.stopPropagation();
                        navigate(`/profile/${row.original.id.toString()}`);
                    }}>
                    <ManageAccountsIcon/>
                </IconButton>
            ),
            enableSorting: false,
            enableColumnActions: false,
        }
    ];

    const table = useMaterialReactTable({
        columns: columnsWithActions,
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
            columnVisibility
        },
        paginationDisplayMode: 'pages',
        positionToolbarAlertBanner: 'bottom',
        enableGlobalFilter: false,
        muiPaginationProps: {
            color: 'secondary',
            rowsPerPageOptions: [10, 20, 50],
            shape: 'rounded',
            variant: 'outlined',
        },
        manualPagination: true,
        rowCount,
        onPaginationChange: setPagination,
        state: {pagination},
        localization: MRT_Localization_IT,
    });

    const handleFilterChange = (e) => {
        const {name, value} = e.target;
        setFilters(prev => ({
            ...prev,
            [name]: typeof value === 'string' ? value.split(',') : value
        }));
    };

    return (
        <Box sx={{mx: '5%'}}>
            <Grid
                container
                spacing={2}
                sx={{mb: 2, mt: 2}}
                alignItems="center"
                justifyContent="space-between"
            >
                <Grid size={{xs: 12, md: 2}}>
                    <FormControl fullWidth>
                        <InputLabel id="esncard-validity-label">Validità ESNcard</InputLabel>
                        <Select
                            labelId="esncard-validity-label"
                            name="esncardValidity"
                            variant="outlined"
                            multiple
                            value={filters.esncardValidity}
                            onChange={handleFilterChange}
                            input={<OutlinedInput label="Validità ESNcard"/>}
                            renderValue={(selected) =>
                                ESNCARD_VALIDITY_OPTIONS.filter(opt => selected.includes(opt.value)).map(opt => opt.label).join(', ')
                            }>
                            {ESNCARD_VALIDITY_OPTIONS.map(opt => (
                                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>
                {profileType === 'ESNer' && groups.length > 0 && (
                    <Grid size={{xs: 12, md: 2}}>
                        <FormControl fullWidth>
                            <InputLabel id="group-label">Gruppo</InputLabel>
                            <Select
                                labelId="group-label"
                                name="group"
                                variant="outlined"
                                multiple
                                value={filters.group}
                                onChange={handleFilterChange}
                                input={<OutlinedInput label="Gruppo"/>}
                                renderValue={(selected) =>
                                    groups.filter(opt => selected.includes(opt.name)).map(opt => opt.name).join(', ')
                                }>
                                {groups.map(opt => (
                                    <MenuItem key={opt.name} value={opt.name}>{opt.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                )}
                <Grid size={{xs: 12, md: 3}} sx={{ml: {sm: 'auto'}}}>
                    <OutlinedInput
                        inputRef={searchInputRef}
                        size="small"
                        placeholder="Cerca"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') handleSearchApply();
                        }}
                        fullWidth
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
            {internalLoading ? <Loader/> :
                <MaterialReactTable table={table}/>
            }
        </Box>
    );
});

export default ProfilesList;
