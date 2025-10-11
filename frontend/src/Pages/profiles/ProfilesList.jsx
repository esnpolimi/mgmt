import {useEffect, useState, useRef, forwardRef, useImperativeHandle} from 'react';
import {Box, Grid, FormControl, InputLabel, Select, MenuItem, OutlinedInput, IconButton, Button} from '@mui/material';
import {MaterialReactTable, useMaterialReactTable} from 'material-react-table';
import {fetchCustom} from '../../api/api';
import {MRT_Localization_IT} from "material-react-table/locales/it";
import Loader from "../../Components/Loader";
import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {useNavigate} from 'react-router-dom';
import {profileDisplayNames} from "../../utils/displayAttributes";

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
    const [ordering, setOrdering] = useState('-created_at');
    const searchInputRef = useRef(null);
    const navigate = useNavigate();

    const fetchData = () => {
        setInternalLoading(true);
        const params = new URLSearchParams();
        params.append('page', pagination.pageIndex + 1);
        params.append('page_size', pagination.pageSize);
        params.append('ordering', ordering);
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
            onError: () => {
            },
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
    }, [apiEndpoint, pagination.pageIndex, pagination.pageSize, profileType, filters, appliedSearch, ordering]);

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
        enableColumnFilters: false,
        enableColumnOrdering: false,
        enableSorting: false,  // server-side sorting only
        enableSortingRemoval: false,
        enableGrouping: false,
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
        renderTopToolbarCustomActions: () => {
            return (
                <Box sx={{display: 'flex', flexDirection: 'row'}}>
                    <Button
                        variant="outlined"
                        color="primary"
                        startIcon={<OpenInNewIcon/>}
                        onClick={() => window.open(profileType === 'Erasmus' ? '/erasmus_form' : '/esner_form', "_blank")}
                        sx={{ml: 2}}
                    >
                        {profileType === "Erasmus" ? "Iscrivi Erasmus" : "Iscrivi ESNer"}
                    </Button>
                </Box>
            );
        },
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
                {/* New ordering selector */}
                <Grid size={{xs: 12, md: 3}}>
                    <FormControl fullWidth>
                        <InputLabel id="ordering-label">Ordina per</InputLabel>
                        <Select
                            labelId="ordering-label"
                            value={ordering}
                            label="Ordina per"
                            variant="outlined"
                            onChange={(e) => {
                                setOrdering(e.target.value);
                                setPagination(prev => ({...prev, pageIndex: 0}));
                            }}>
                            <MenuItem value="-created_at">{profileDisplayNames.created_at} (più recenti)</MenuItem>
                            <MenuItem value="created_at">{profileDisplayNames.created_at} (più vecchi)</MenuItem>
                            <MenuItem value="id">{profileDisplayNames.id} 0-9</MenuItem>
                            <MenuItem value="-id">{profileDisplayNames.id} 9-0</MenuItem>
                            <MenuItem value="name">{profileDisplayNames.name} A-Z</MenuItem>
                            <MenuItem value="-name">{profileDisplayNames.name} Z-A</MenuItem>
                            <MenuItem value="surname">{profileDisplayNames.surname} A-Z</MenuItem>
                            <MenuItem value="-surname">{profileDisplayNames.surname} Z-A</MenuItem>
                            <MenuItem value="email">{profileDisplayNames.email} A-Z</MenuItem>
                            <MenuItem value="-email">{profileDisplayNames.email} Z-A</MenuItem>
                            <MenuItem value="esncard">{profileDisplayNames.latest_esncard} A-Z</MenuItem>
                            <MenuItem value="-esncard">{profileDisplayNames.latest_esncard} Z-A</MenuItem>
                            <MenuItem value="country">{profileDisplayNames.country} A-Z</MenuItem>
                            <MenuItem value="-country">{profileDisplayNames.country} Z-A</MenuItem>
                            <MenuItem value="birthdate">{profileDisplayNames.birthdate} (più vecchi)</MenuItem>
                            <MenuItem value="-birthdate">{profileDisplayNames.birthdate} (più giovani)</MenuItem>
                            <MenuItem value="fullPhoneNumber">{profileDisplayNames.phone_number} 0-9</MenuItem>
                            <MenuItem value="-fullPhoneNumber">{profileDisplayNames.phone_number} 9-0</MenuItem>
                            {profileType === 'Erasmus' && (
                                <MenuItem value="fullWANumber">{profileDisplayNames.whatsapp_number} 0-9</MenuItem>
                            )}
                            {profileType === 'Erasmus' && (
                                <MenuItem value="-fullWANumber">{profileDisplayNames.whatsapp_number} 9-0</MenuItem>
                            )}
                            <MenuItem value="person_code">{profileDisplayNames.person_code} A-Z</MenuItem>
                            <MenuItem value="-person_code">{profileDisplayNames.person_code} Z-A</MenuItem>
                            <MenuItem value="domicile">{profileDisplayNames.domicile} A-Z</MenuItem>
                            <MenuItem value="-domicile">{profileDisplayNames.domicile} Z-A</MenuItem>
                            <MenuItem value="latest_document.number">{profileDisplayNames.latest_document} A-Z</MenuItem>
                            <MenuItem value="-latest_document.number">{profileDisplayNames.latest_document} Z-A</MenuItem>
                            <MenuItem value="matricola_number">{profileDisplayNames.matricola_number} A-Z</MenuItem>
                            <MenuItem value="-matricola_number">{profileDisplayNames.matricola_number} Z-A</MenuItem>
                            {profileType === 'Erasmus' && (
                                <MenuItem value="matricola_expiration">{profileDisplayNames.matricola_expiration} (più vecchi)</MenuItem>
                            )}
                            {profileType === 'Erasmus' && (
                                <MenuItem value="-matricola_expiration">{profileDisplayNames.matricola_expiration} (più giovani)</MenuItem>
                            )}
                    </Select>
                </FormControl>
            </Grid>
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
                        <InputLabel id="group-label">Gruppi</InputLabel>
                        <Select
                            labelId="group-label"
                            name="group"
                            variant="outlined"
                            multiple
                            value={filters.group}
                            onChange={handleFilterChange}
                            input={<OutlinedInput label="Gruppi"/>}
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
                    placeholder="Cerca tra tutti i campi"
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
{
    internalLoading ? <Loader/> :
        <MaterialReactTable table={table}/>
}
</Box>
)
    ;
});

export default ProfilesList;
