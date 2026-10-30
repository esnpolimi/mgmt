import {useEffect, useMemo, useState} from 'react';
import {MaterialReactTable, useMaterialReactTable} from 'material-react-table';
import {Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, TextField, Tooltip, Typography} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Sidebar from '../Components/Sidebar';
import {fetchCustom} from '../api/api';
import {MRT_Localization_IT} from 'material-react-table/locales/it';

const statuses = [
    {value: 'NEW', label: 'Nuova', color: 'info'},
    {value: 'IN_PROGRESS', label: 'In lavorazione', color: 'warning'},
    {value: 'DONE', label: 'Completata', color: 'success'},
];

export default function WishlistSubmissions() {
    const [items, setItems] = useState([]);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [selectedIdea, setSelectedIdea] = useState(null);
    const formUrl = `${window.location.origin}/wishlist`;

    const load = () => fetchCustom('GET', '/content/wishlist-submissions/', {
        onSuccess: setItems,
        onError: () => setError('Impossibile caricare le richieste.'),
    });

    useEffect(load, []);

    const updateStatus = (item, status) => fetchCustom('PATCH', '/content/wishlist-submissions/', {
        body: {id: item.id, status},
        onSuccess: (updated) => setItems((current) => current.map((entry) => entry.id === updated.id ? updated : entry)),
        onError: () => setError('Impossibile aggiornare lo stato.'),
    });

    const copyFormUrl = async () => {
        try {
            await navigator.clipboard.writeText(formUrl);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            setError('Impossibile copiare il link del form.');
        }
    };

    const columns = useMemo(() => [
        {
            accessorKey: 'created_at',
            header: 'Data',
            Cell: ({cell}) => new Date(cell.getValue()).toLocaleDateString('it-IT'),
        },
        {accessorKey: 'email', header: 'Email'},
        {
            id: 'name',
            header: 'Nome',
            accessorFn: (row) => `${row.first_name} ${row.last_name}`.trim(),
        },
        {accessorKey: 'phone', header: 'Telefono'},
        {accessorKey: 'country', header: 'Paese'},
        {
            accessorKey: 'message',
            header: 'Idea',
            size: 350,
            Cell: ({cell}) => {
                const message = cell.getValue() || '';
                const preview = message.length > 180 ? `${message.slice(0, 180)}...` : message;
                return <Box>
                    <Typography sx={{whiteSpace: 'pre-wrap'}}>{preview}</Typography>
                    {message.length > 180 && <Button size="small" onClick={() => setSelectedIdea(message)}>Vedi tutto</Button>}
                </Box>;
            },
        },
        {
            accessorKey: 'status',
            header: 'Stato',
            Cell: ({row}) => {
                const status = statuses.find((entry) => entry.value === row.original.status);
                return <Chip label={status?.label || row.original.status} color={status?.color || 'default'} size="small"/>;
            },
            Edit: ({row}) => (
                <TextField
                    select
                    fullWidth
                    value={row.original.status}
                    SelectProps={{native: true}}
                    onChange={(event) => updateStatus(row.original, event.target.value)}
                >
                    {statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                </TextField>
            ),
        },
    ], []);

    const table = useMaterialReactTable({
        columns,
        data: items,
        enableGlobalFilter: true,
        enableColumnFilters: true,
        enableSorting: true,
        enableColumnOrdering: true,
        enablePagination: true,
        enableEditing: true,
        editDisplayMode: 'cell',
        enableDensityToggle: false,
        enableFullScreenToggle: true,
        localization: MRT_Localization_IT,
        initialState: {sorting: [{id: 'created_at', desc: true}]},
        muiTableBodyCellProps: ({cell, table}) => ({
            sx: {verticalAlign: 'top'},
            ...(cell.column.id === 'status' && {
                onDoubleClick: () => table.setEditingCell(cell),
            }),
        }),
    });

    return <Box>
        <Sidebar/>
        <Box sx={{mx: '5%', mb: 6}}>
            <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5, mb: 3}}>
                <Typography variant="h4">Wishlist</Typography>
                <Tooltip title="Fai doppio click sul campo Stato per modificarlo">
                    <IconButton size="small" aria-label="Informazioni modifica stato">
                        <InfoOutlinedIcon/>
                    </IconButton>
                </Tooltip>
            </Box>
            <Box sx={{display: 'flex', gap: 1, alignItems: 'center', mb: 3}}>
                <TextField fullWidth size="small" label="Link del form da condividere" value={formUrl} slotProps={{input: {readOnly: true}}}/>
                <Button variant="outlined" startIcon={copied ? <CheckIcon/> : <ContentCopyIcon/>} onClick={copyFormUrl}>
                    {copied ? 'Copiato' : 'Copia'}
                </Button>
            </Box>
            {error && <Typography color="error" sx={{mb: 2}}>{error}</Typography>}
            <MaterialReactTable table={table}/>
            <Dialog open={selectedIdea !== null} onClose={() => setSelectedIdea(null)} fullWidth maxWidth="md">
                <DialogTitle>Idea completa</DialogTitle>
                <DialogContent>
                    <Typography sx={{whiteSpace: 'pre-wrap'}}>{selectedIdea}</Typography>
                </DialogContent>
                <DialogActions><Button onClick={() => setSelectedIdea(null)}>Chiudi</Button></DialogActions>
            </Dialog>
        </Box>
    </Box>;
}
