import {useEffect, useState, useMemo} from 'react';
import {MRT_Table, useMaterialReactTable} from 'material-react-table';
import {fetchCustom, defaultErrorHandler} from '../../api/api';
import {MRT_Localization_IT} from 'material-react-table/locales/it';
import Loader from '../Loader';
import {Box, Chip, IconButton, Typography} from "@mui/material";
import RefreshIcon from '@mui/icons-material/Refresh';
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import Popup from "../Popup";

const PAYMENT_CONFIGS = {
    cash: {label: "Contanti", color: 'success'},
    paypal: {label: "PayPal", color: 'info'},
    bonifico: {label: "Bonifico", color: 'warning'}
};

export default function ReimbursementRequestsDash({limit = 3}) {
    const [popup, setPopup] = useState(null);
    const [data, setData] = useState([]);
    const [isLoading, setLoading] = useState(true);

    const fetchData = () => {
        setLoading(true);
        fetchCustom("GET", `/reimbursement_requests/?limit=${limit}`, {
            onSuccess: (data) => setData(data.results || []),
            onError: (err) => defaultErrorHandler(err, setPopup),
            onFinally: () => setLoading(false)
        });
    };

    useEffect(() => {
        fetchData();
    }, [limit]);

    const columns = useMemo(() => [
        {
            accessorKey: 'created_at', header: "Data", size: 100,
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
            accessorKey: 'user.name',
            header: "Richiedente",
            size: 150,
            Cell: ({cell}) => cell.getValue() || "-"
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
            accessorKey: 'payment', header: "Metodo", size: 120,
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
            accessorKey: 'is_reimbursed',
            header: "Rimborsato",
            size: 50,
            Cell: ({cell}) => (
                <Chip
                    label={cell.getValue() ? "Sì" : "No"}
                    color={cell.getValue() ? "success" : "error"}
                    variant="outlined"
                />
            )
        }
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
                <ReceiptLongIcon sx={{mr: 2}}/>
                <Typography variant="h6">Ultime Richieste Rimborso</Typography>
                <Box sx={{flexGrow: 1}} />
                <IconButton size="small" onClick={fetchData} disabled={isLoading} title="Aggiorna">
                    <RefreshIcon/>
                </IconButton>
            </Box>
            {isLoading ? <Loader/> : <MRT_Table table={table}/>}
            {popup && <Popup key={popup.id} message={popup.message} state={popup.state}/>}
        </Box>
    );
}
