import {useEffect, useState, useMemo} from 'react';
import {MRT_Table, useMaterialReactTable} from 'material-react-table';
import {transactionDisplayNames as names} from '../../utils/displayAttributes';
import {defaultErrorHandler, fetchCustom} from '../../api/api';
import {MRT_Localization_IT} from 'material-react-table/locales/it';
import Loader from '../Loader';
import {Box, Chip, IconButton, Typography} from "@mui/material";
import RefreshIcon from '@mui/icons-material/Refresh';
import {TRANSACTION_CONFIGS} from "../../data/transactionConfigs";
import ReceiptIcon from "@mui/icons-material/Receipt";
import Popup from "../Popup";

export default function TransactionsDash({limit = 3}) {
    const [popup, setPopup] = useState(null);
    const [data, setData] = useState([]);
    const [isLoading, setLoading] = useState(true);

    const fetchData = () => {
        setLoading(true);
        fetchCustom("GET", `/transactions/?limit=${limit}`, {
            onSuccess: (data) => setData(data.results || []),
            onError: (err) => {
                setData([]);
                defaultErrorHandler(err, setPopup);
            },
            onFinally: () => setLoading(false)
        });
    };

    useEffect(() => {
        fetchData();
    }, [limit]);

    const columns = useMemo(() => [
        {
            accessorKey: 'created_at', header: names.date, size: 100,
            Cell: ({cell}) => {
                const date = new Date(cell.getValue());
                return (
                    <Box>
                        {new Intl.DateTimeFormat('it-IT', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                        }).format(date)}
                    </Box>
                );
            },
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
            accessorKey: 'executor.name',
            header: names.executor,
            size: 150,
            Cell: ({cell}) => (
                <Box component="span" fontWeight="bold">
                    {cell.getValue() || "Pagamento Online"}
                </Box>
            ),
        },
        {
            accessorKey: 'account.name',
            header: names.account,
            size: 100,
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
    ], []);

    const table = useMaterialReactTable({
        columns,
        data: data,
        enableKeyboardShortcuts: false,
        enableColumnActions: false,
        enableColumnFilters: false,
        enablePagination: false,
        enableSorting: true,
        initialState: {
            showColumnFilters: false,
            showGlobalFilter: false,
            sorting: [{id: 'created_at', desc: true}],
        },
        paginationDisplayMode: 'default',
        muiTableBodyRowProps: {hover: false},
        localization: MRT_Localization_IT,
    });

    return (
        <Box>
            <Box sx={{display: 'flex', alignItems: 'center', mb: 2}}>
                <ReceiptIcon sx={{mr: 2}}/>
                <Typography variant="h6">Ultime Transazioni</Typography>
                <Box sx={{flexGrow: 1}}/>
                <IconButton size="small" onClick={fetchData} disabled={isLoading} title="Aggiorna">
                    <RefreshIcon/>
                </IconButton>
            </Box>
            {isLoading ? <Loader/> : <MRT_Table table={table}/>}
            {popup && <Popup key={popup.id} message={popup.message} state={popup.state}/>}
        </Box>
    );
}
