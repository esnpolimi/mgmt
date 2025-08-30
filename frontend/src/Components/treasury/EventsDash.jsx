import {useEffect, useState} from 'react';
import {Box, IconButton, Typography, Chip, Button} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import EventIcon from '@mui/icons-material/Event';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import Loader from '../Loader';
import Popup from '../Popup';
import {fetchCustom, defaultErrorHandler} from '../../api/api';
import {useNavigate} from 'react-router-dom';

export default function EventsDash({pageSize = 3}) {
    const [data, setData] = useState([]);
    const [page, setPage] = useState(0);
    const [count, setCount] = useState(0);
    const [isLoading, setLoading] = useState(true);
    const [popup, setPopup] = useState(null);
    const navigate = useNavigate();

    const fetchData = () => {
        setLoading(true);
        const params = new URLSearchParams();
        params.append('page', page + 1);
        params.append('page_size', pageSize);
        fetchCustom('GET', `/events/?${params.toString()}`, {
            onSuccess: (res) => {
                setCount(res.count || 0);
                setData(res.results || []);
            },
            onError: (e) => {
                defaultErrorHandler(e, setPopup);
                setData([]);
            },
            onFinally: () => setLoading(false)
        });
    };

    useEffect(() => {
        fetchData();
    }, [page, pageSize]);

    const totalPages = Math.ceil(count / pageSize);

    return (
        <Box>
            <Box sx={{display: 'flex', alignItems: 'center', mb: 1}}>
                <EventIcon sx={{mr: 2}}/>
                <Typography variant="h6">Eventi Recenti</Typography>
                <Box sx={{flexGrow: 1}}/>
                <IconButton size="small" onClick={fetchData} disabled={isLoading} title="Aggiorna">
                    <RefreshIcon fontSize="small"/>
                </IconButton>
                <IconButton
                    size="small"
                    onClick={() => setPage(p => Math.max(p - 1, 0))}
                    disabled={isLoading || page === 0}
                    title="Precedente">
                    <ArrowBackIosNewIcon fontSize="inherit"/>
                </IconButton>
                <IconButton
                    size="small"
                    onClick={() => setPage(p => (p + 1 < totalPages ? p + 1 : p))}
                    disabled={isLoading || page + 1 >= totalPages}
                    title="Successivo">
                    <ArrowForwardIosIcon fontSize="inherit"/>
                </IconButton>
            </Box>
            {isLoading ? <Loader/> : (
                <Box sx={{display: 'flex', flexDirection: 'column', gap: 1, mt:2}}>
                    {data.map(ev => (
                        <Box key={ev.id}
                             sx={{
                                 display: 'flex',
                                 alignItems: 'center',
                                 p: 1,
                                 border: '1px solid #eee',
                                 borderRadius: 1,
                                 bgcolor: '#fafafa'
                             }}>
                            <Box sx={{flexGrow: 1, minWidth: 0}}>
                                <Typography variant="subtitle1" noWrap>
                                    <b>{ev.name}</b> <i>({new Date(ev.date).toLocaleDateString('it-IT')})</i>
                                </Typography>
                            </Box>
                            {ev.is_a_bando &&
                                <Chip
                                    label="Evento a Bando"
                                    color="success"
                                    size="small"
                                    sx={{mr: 1}}
                                />
                            }
                            <Chip
                                label={ev.status === 'open' ? 'Iscrizioni Aperte' :
                                    ev.status === 'not_yet' ? 'Non Aperte' : 'Chiuse'}
                                color={ev.status === 'open' ? 'success' : ev.status === 'not_yet' ? 'warning' : 'default'}
                                size="small"
                                sx={{mr: 1}}
                            />
                            <Chip
                                label={ev.is_refa_done ? 'Refa fatto' : 'Refa da fare'}
                                color={ev.is_refa_done? 'success' : 'warning'}
                                size="small"
                                sx={{mr: 1}}
                            />
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={() => navigate(`/treasury/transactions_list/${ev.id}/`)}
                                sx={{ml: 2}}
                            >
                                Movimenti
                            </Button>
                        </Box>
                    ))}
                    {data.length === 0 && (
                        <Typography variant="body2" color="text.secondary" sx={{mt: 1}}>
                            Nessun evento trovato.
                        </Typography>
                    )}
                </Box>
            )}
            {popup && <Popup key={popup.id} message={popup.message} state={popup.state}/>}
        </Box>
    );
}

