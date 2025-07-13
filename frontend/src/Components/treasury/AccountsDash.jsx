import {useEffect, useState, useMemo} from 'react';
import {MRT_Table, useMaterialReactTable} from 'material-react-table';
import {accountDisplayNames as names} from '../../utils/displayAttributes';
import {fetchCustom, defaultErrorHandler} from '../../api/api';
import {MRT_Localization_IT} from 'material-react-table/locales/it';
import Loader from '../Loader';
import {Box, Chip, IconButton, Typography} from "@mui/material";
import RefreshIcon from '@mui/icons-material/Refresh';
import StoreIcon from "@mui/icons-material/Store";

export default function AccountsDash() {
    const [data, setData] = useState([]);
    const [isLoading, setLoading] = useState(true);

    const fetchData = () => {
        setLoading(true);
        fetchCustom("GET", '/accounts/', {
            onSuccess: (data) => setData(data),
            onError: (err) => defaultErrorHandler(err, setLoading),
            onFinally: () => setLoading(false)
        });
    };

    useEffect(() => {
        fetchData();
    }, []);

    const columns = useMemo(() => [
        {accessorKey: 'name', header: names.name, size: 100},
        {
            accessorKey: 'balance', header: names.balance, size: 100,
            Cell: ({cell}) => (
                <Box>
                    {cell.getValue() !== null ? (
                        <Chip label={`€${cell.getValue()}`} color="primary"/>) : (
                        <Chip label="N/A" color="warning"/>)}
                </Box>
            ),
        },
        {
            accessorKey: 'status', header: names.status, size: 100,
            Cell: ({cell}) => (
                <Box>
                    {cell.getValue() !== null ? (
                        <Chip
                            label={cell.getValue() === 'open' ? "Aperta" : "Chiusa"}
                            color={cell.getValue() === 'open' ? "success" : "error"}/>
                    ) : (
                        <Chip label="Stato ignoto" color="warning"/>
                    )}
                </Box>
            ),
        },
    ], []);

    const table = useMaterialReactTable({
        columns,
        data: data,
        enableKeyboardShortcuts: false,
        enableColumnActions: false,
        enableColumnFilters: false,
        enablePagination: false,
        enableSorting: false,
        initialState: {showColumnFilters: false, showGlobalFilter: false},
        paginationDisplayMode: 'default',
        muiTableBodyRowProps: {hover: false},
        localization: MRT_Localization_IT,
    });

    return (
        <Box>
            <Box sx={{display: 'flex', alignItems: 'center', mb: 2}}>
                <StoreIcon sx={{mr: 2}}/>
                <Typography variant="h6">Casse</Typography>
                <Box sx={{flexGrow: 1}}/>
                <IconButton size="small" onClick={fetchData} disabled={isLoading} title="Aggiorna">
                    <RefreshIcon/>
                </IconButton>
            </Box>
            {isLoading ? <Loader/> : <MRT_Table table={table}/>}
        </Box>
    );
}