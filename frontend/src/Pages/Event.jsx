import React, {useEffect, useState} from 'react';
import {useLocation, useNavigate, useParams} from 'react-router-dom';
import Sidebar from "../Components/Sidebar";
import {Box, Button, Card, CardContent, Chip, Divider, IconButton, Typography} from "@mui/material";
import Grid from "@mui/material/Grid2";
import EventIcon from "@mui/icons-material/Event";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import DescriptionIcon from '@mui/icons-material/Description';
import EuroIcon from '@mui/icons-material/Euro';
import Adjust from '@mui/icons-material/Adjust';
import Loader from "../Components/Loader";
import {fetchCustom} from "../api/api";
import dayjs from "dayjs";
import EditIcon from "@mui/icons-material/Edit";
import EventModal from "../Components/EventModal";
import CustomEditor from '../Components/CustomEditor';

export default function Event() {
    const {id} = useParams(); // Get the ID from URL
    const location = useLocation();
    const navigate = useNavigate();
    const [modalOpen, toggleModal] = useState(false);
    const [isLoading, setLoading] = useState(true);
    // Try to get event from location state, if not available we'll fetch it using ID
    const eventFromState = location.state?.event;

    const [data, setData] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Use ID from URL params if available, otherwise from state
                const eventId = id || eventFromState?.id;
                const response = await fetchCustom("GET", `/event/${eventId}/`);
                const json = await response.json();
                setData(json);
                console.log("Event Data: ", json);
                setLoading(false);
            } catch (error) {
                console.error('Error fetching data:', error);
                setLoading(false);
            }
        };
        fetchData().then();
    }, [id, eventFromState]);


    const handleBack = () => {
        navigate('/events');
    };

    const handleOpenEventModal = () => {
        toggleModal(true);
    };

    const handleCloseEventModal = () => {
        toggleModal(false);
    };

    const handleSubscriptionStatus = () => {
        const now = dayjs();
        const startDateTime = data.subscription_start_date ? dayjs(data.subscription_start_date) : null;
        const endDateTime = data.subscription_end_date ? dayjs(data.subscription_end_date) : null;

        let status = "Non disponibile";
        let color = "error";

        if (startDateTime && endDateTime) {
            if (now.isAfter(startDateTime) && now.isBefore(endDateTime)) {
                status = "Iscrizioni aperte";
                color = "success";
            } else if (now.isBefore(startDateTime)) {
                status = "Iscrizioni non ancora aperte";
                color = "warning";
            } else if (now.isAfter(endDateTime)) {
                status = "Iscrizioni chiuse";
                color = "error";
            }
        }

        return (
            <Chip
                label={status}
                color={color}
                variant="outlined"
                size="medium"
            />
        );
    };

    return (
        <Box>
            <Sidebar/>
            {modalOpen && <EventModal
                open={modalOpen}
                handleClose={handleCloseEventModal}
                event={data}
                isEdit={true}
            />}
            <Box sx={{mx: '5%'}}>
                {isLoading ? <Loader/> : (<>
                        <Box sx={{display: 'flex', alignItems: 'center', marginBottom: '20px'}}>
                            <IconButton onClick={handleBack} sx={{mr: 2}}><ArrowBackIcon/></IconButton>
                            <EventIcon sx={{marginRight: '10px'}}/>
                            <Typography variant="h4">Evento - {data.name}</Typography>
                        </Box>

                        <Card elevation={3} sx={{mt: 5, mb: 4, borderRadius: 2, overflow: 'hidden'}}>
                            <CardContent>
                                <Grid container spacing={3}>
                                    <Grid size={{xs: 12, md: 4}}>
                                        <Box sx={{display: 'flex', alignItems: 'center'}}>
                                            <CalendarTodayIcon sx={{color: 'primary.main', mr: 1}}/>
                                            <Typography variant="h6" component="div">Data</Typography>
                                        </Box>
                                        <Typography variant="body1" color="text.secondary" sx={{mt: 2}}>
                                            {data.date ? dayjs(data.date).format('DD/MM/YYYY') : 'Data non specificata'}
                                        </Typography>
                                    </Grid>

                                    <Grid size={{xs: 12, md: 4}}>
                                        <Box sx={{display: 'flex', alignItems: 'center'}}>
                                            <EuroIcon sx={{color: 'primary.main', mr: 1}}/>
                                            <Typography variant="h6" component="div">Costo</Typography>
                                        </Box>
                                        <Typography variant="body1" color="text.secondary" sx={{mt: 2}}>
                                            {data.cost !== 0 ? `€ ${data.cost}` : 'Gratuito'}
                                        </Typography>
                                    </Grid>

                                    <Grid size={{xs: 12, md: 4}}>
                                        <Box sx={{display: 'flex', alignItems: 'center'}}>
                                            <Adjust sx={{color: 'primary.main', mr: 1}}/>
                                            <Typography variant="h6" component="div">Stato Iscrizioni</Typography>
                                        </Box>
                                        <Box sx={{display: 'flex', alignItems: 'center', mt: 2}}>
                                            {(() => handleSubscriptionStatus())()}
                                        </Box>
                                    </Grid>

                                    <Grid size={{xs: 12}}>
                                        <Divider sx={{my: 1}}/>
                                        <Box sx={{display: 'flex', alignItems: 'center', mt: 2}}>
                                            <DescriptionIcon sx={{color: 'primary.main', mr: 1}}/>
                                            <Typography variant="h6" component="div">Descrizione</Typography>
                                        </Box>
                                        <div data-color-mode="light" style={{marginTop: 10}}>
                                            <CustomEditor
                                                value={data.description || 'Nessuna descrizione disponibile'}
                                                readOnly={true}
                                            />
                                        </div>
                                    </Grid>

                                    <Grid size={{xs: 12}}>
                                        <Divider sx={{my: 1}}/>
                                        <Box sx={{display: 'flex', alignItems: 'center', mt: 2}}>
                                            <EditIcon sx={{color: 'primary.main', mr: 1}}/>
                                            <Typography variant="h6" component="div">Azioni</Typography>
                                        </Box>
                                        <Button sx={{mt: 2}} variant="contained" color="primary" onClick={handleOpenEventModal}>
                                            Modifica Evento
                                        </Button>
                                    </Grid>
                                </Grid>
                            </CardContent>
                        </Card>
                    </>
                )}
            </Box>
        </Box>
    );
}