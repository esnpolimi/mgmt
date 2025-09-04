import {useEffect, useMemo, useState} from 'react';
import {
    Box,
    Modal,
    Paper,
    Typography,
    IconButton,
    Chip,
    Button
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import {MaterialReactTable, useMaterialReactTable} from 'material-react-table';
import {MRT_Localization_IT} from 'material-react-table/locales/it';
import {fetchCustom, defaultErrorHandler} from '../../api/api';
import {transactionDisplayNames as names} from '../../utils/displayAttributes';
import {TRANSACTION_CONFIGS} from '../../data/transactionConfigs';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Popup from '../Popup';
import TransactionModal from './TransactionModal';

const style = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 'min(1000px, 95vw)',
    maxHeight: '90vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 5,
    padding: 1
};

export default function RecentAccountTransactionsModal({account, onClose}) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [popup, setPopup] = useState(null);
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [transactionModalOpen, setTransactionModalOpen] = useState(false);

    const fetchData = () => {
        if (!account) return;
        setLoading(true);
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const params = new URLSearchParams({
            account: account.id,
            dateFrom: since,
            page: 1,
            page_size: 200
        });
        fetchCustom('GET', `/transactions/?${params.toString()}`, {
            onSuccess: data => setTransactions(data.results || []),
            onError: err => defaultErrorHandler(err, setPopup),
            onFinally: () => setLoading(false)
        });
    };

    useEffect(() => {
        fetchData();
    }, [account?.id]);

    const columns = useMemo(() => [
        {
            accessorKey: 'created_at',
            header: names.date,
            size: 140,
            Cell: ({cell}) => {
                const d = new Date(cell.getValue());
                return new Intl.DateTimeFormat('it-IT', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                }).format(d);
            }
        },
        {
            accessorKey: 'type',
            header: names.type,
            size: 110,
            Cell: ({cell}) => {
                const t = cell.getValue();
                const config = TRANSACTION_CONFIGS[t] || {label: 'Sconosciuto', color: 'default'};
                return <Chip label={config.label} color={config.color} variant="outlined"/>;
            }
        },
        {
            accessorKey: 'executor.name',
            header: names.executor,
            size: 160,
            Cell: ({row}) => {
                const exec = row.original.executor;
                if (!exec) return <span style={{color: '#777'}}>Pagamento Online</span>;
                return (
                    <Button
                        variant="text"
                        color="primary"
                        sx={{textTransform: 'none', p: 0, minWidth: 0}}
                        endIcon={exec.id ? <OpenInNewIcon fontSize="small"/> : null}
                        onClick={() => {
                            if (exec.id) window.open(`/profile/${exec.id}`, '_blank', 'noopener,noreferrer');
                        }}
                    >
                        {exec.name || exec.email || 'N/A'}
                    </Button>
                );
            }
        },
        {
            accessorKey: 'amount',
            header: names.amount,
            size: 110,
            Cell: ({cell}) => {
                const v = cell.getValue();
                return v !== null ? (
                    <Chip
                        label={`€${v}`}
                        color={v < 0 ? 'error' : 'primary'}
                        variant="filled"
                    />
                ) : <Chip label="N/A" color="warning"/>;
            }
        },
        {
            accessorKey: 'description',
            header: names.description,
            size: 250,
            Cell: ({cell}) => <Box component="span" fontStyle="italic">{cell.getValue()}</Box>
        },
        {
            accessorKey: 'actions',
            header: 'Azioni',
            size: 80,
            enableSorting: false,
            enableColumnActions: false,
            Cell: ({row}) => (
                <IconButton
                    color="primary"
                    size="small"
                    title="Modifica Transazione"
                    onClick={() => {
                        setSelectedTransaction(row.original);
                        setTransactionModalOpen(true);
                    }}
                >
                    <EditIcon fontSize="small"/>
                </IconButton>
            )
        }
    ], []);

    const table = useMaterialReactTable({
        columns,
        data: transactions,
        enableStickyHeader: true,
        enableColumnFilters: false,
        enableGlobalFilter: false,
        enablePagination: false,
        enableBottomToolbar: false,
        enableTopToolbar: false,
        initialState: {
            sorting: [{id: 'created_at', desc: true}]
        },
        localization: MRT_Localization_IT,
        state: {isLoading: loading}
    });

    const handleTxModalClose = (success) => {
        setTransactionModalOpen(false);
        if (success) {
            setPopup({message: "Transazione modificata con successo!", state: "success", id: Date.now()});
            fetchData();
            onClose?.(true);
        }
        setSelectedTransaction(null);
    };

    return (
        <Modal open={!!account} onClose={() => onClose(false)}>
            <Paper elevation={6} sx={style}>
                {transactionModalOpen && selectedTransaction && (
                    <TransactionModal
                        open={transactionModalOpen}
                        onClose={handleTxModalClose}
                        transaction={selectedTransaction}
                    />
                )}
                <Box sx={{display: 'flex', alignItems: 'center', p: 2, pb: 1}}>
                    <Typography variant="h6" fontWeight={600}>
                        Movimenti Ultime 24h - {account?.name}
                    </Typography>
                    <Box sx={{flexGrow: 1}}/>
                    <IconButton
                        onClick={fetchData}
                        disabled={loading}
                        title="Aggiorna"
                        sx={{mr: 1}}
                        size="small">
                        <RefreshIcon fontSize="small"/>
                    </IconButton>
                    <IconButton onClick={() => onClose(false)} size="small">
                        <CloseIcon fontSize="small"/>
                    </IconButton>
                </Box>
                <Box sx={{px: 2, pb: 2, overflow: 'auto'}}>
                    <MaterialReactTable table={table}/>
                    {transactions.length === 0 && !loading && (
                        <Typography variant="body2" sx={{mt: 2, textAlign: 'center', color: 'text.secondary'}}>
                            Nessuna transazione nelle ultime 24 ore.
                        </Typography>
                    )}
                </Box>
                {popup && <Popup key={popup.id} message={popup.message} state={popup.state}/>}
            </Paper>
        </Modal>
    );
}

