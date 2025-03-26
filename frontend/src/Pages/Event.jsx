import React, {useEffect, useState} from 'react';
import {useLocation, useNavigate, useParams} from 'react-router-dom';
import Sidebar from "../Components/Sidebar";
import {Accordion, AccordionDetails, AccordionSummary, Box, Button, Card, CardContent, Chip, Divider, IconButton, LinearProgress, Typography} from "@mui/material";
import Grid from "@mui/material/Grid2";
import EventIcon from "@mui/icons-material/Event";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import DescriptionIcon from '@mui/icons-material/Description';
import EuroIcon from '@mui/icons-material/Euro';
import AdjustIcon from '@mui/icons-material/Adjust';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import BallotIcon from '@mui/icons-material/Ballot';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import Loader from "../Components/Loader";
import {fetchCustom} from "../api/api";
import dayjs from "dayjs";
import EditIcon from "@mui/icons-material/Edit";
import EventModal from "../Components/EventModal";
import CustomEditor from '../Components/CustomEditor';
import Popup from "../Components/Popup";
import {MaterialReactTable, useMaterialReactTable} from 'material-react-table';
import {MRT_Localization_IT} from "material-react-table/locales/it";
import SubscriptionModal from "../Components/SubscriptionModal";

export default function Event() {
    const {id} = useParams(); // Get the ID from URL
    const location = useLocation();
    const navigate = useNavigate();
    const [eventModalOpen, setEventModalOpen] = useState(false);
    const [subscribeModalOpen, setSubscribeModalOpen] = useState(false);
    const [isLoading, setLoading] = useState(true);
    const [showSuccessPopup, setShowSuccessPopup] = useState(null);
    const [data, setData] = useState(null);
    // Try to get event from location state, if not available we'll fetch it using ID
    const eventFromState = location.state?.event;
    // States for subscription management
    const [selectedList, setSelectedList] = useState(null);

    useEffect(() => {
        setLoading(true);
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

    const refreshEventData = async () => {
        setLoading(true);
        try {
            const response = await fetchCustom("GET", `/event/${data.id}/`);
            if (response.ok) {
                const json = await response.json();
                setData(json);
                setLoading(false);
            }
        } catch (error) {
            console.error("Error refreshing events data:", error);
            setLoading(false);
        }
    };

    const handleBack = () => {
        navigate('/events');
    };

    const handleOpenEventModal = () => {
        setEventModalOpen(true);
    };

    const handleCloseEventModal = async (success) => {
        if (success) {
            setShowSuccessPopup({message: "Evento modificato con successo!", state: "success"});
            await refreshEventData();
        }
        setEventModalOpen(false);
    };

    const handleOpenSubscribeModal = (listId) => {
        setSelectedList(listId);
        setSubscribeModalOpen(true);
    };

    const handleCloseSubscribeModal = async (success) => {
        if (success) {
            setShowSuccessPopup({message: "Iscrizione completata con successo!", state: "success"});
            await refreshEventData();
        }
        setSubscribeModalOpen(false);
        setSelectedList(null);
    };

    const handleSubscriptionStatus = () => {
        if (!data) return <Chip label="Loading..." variant="outlined" size="medium"/>;

        const now = dayjs();
        const startDateTime = data.subscription_start_date ? dayjs(data.subscription_start_date) : null;
        const endDateTime = data.subscription_end_date ? dayjs(data.subscription_end_date) : null;

        let color = "error";

        if (startDateTime && endDateTime) {
            if (now.isAfter(startDateTime) && now.isBefore(endDateTime)) color = "success";
            else if (now.isBefore(startDateTime)) color = "warning";
        }

        let startText = data.subscription_start_date ? dayjs(data.subscription_start_date).format('DD/MM/YYYY HH:mm') : 'Inizio non specificato';
        let endText = data.subscription_end_date ? dayjs(data.subscription_end_date).format('DD/MM/YYYY HH:mm') : 'Fine non specificata';

        return (
            <Chip
                label={startText + ' - ' + endText}
                color={color}
                variant="outlined"
                size="medium"
            />
        );
    };

    const handleEditSubscription = (subscriptionId) => {
        // Implementation for editing a subscription
        console.log("Edit subscription:", subscriptionId);
        // TODO: Open subscription edit modal
    };

    const handleDeleteSubscription = (subscriptionId) => {
        // Implementation for deleting a subscription
        console.log("Delete subscription:", subscriptionId);
        // TODO: Show confirmation dialog before deletion
    };

    // Columns and data for lists
    const listConfigs = React.useMemo(() => {
        if (!data?.lists) return [];

        return data.lists.map(list => {
            const listSubscriptions = data.subscriptions?.filter(sub => sub.list === list.id) || [];

            const listSubscriptionsColumns = [
                {
                    accessorKey: 'id',
                    header: 'ID',
                    size: 50,
                },
                {
                    accessorKey: 'profile_name',
                    header: 'Profilo',
                    size: 150,
                },
                {
                    accessorKey: 'status',
                    header: 'Stato',
                    size: 100,
                    Cell: ({cell}) => {
                        const status = cell.getValue();
                        let color;
                        let label;
                        switch (status) {
                            case 'confirmed':
                                color = 'success';
                                label = 'Confermato';
                                break;
                            case 'pending':
                                color = 'warning';
                                label = 'In attesa';
                                break;
                            case 'canceled':
                                color = 'error';
                                label = 'Cancellato';
                                break;
                            default:
                                color = 'default';
                                label = status;
                        }
                        return <Chip label={label} color={color} size="small"/>;
                    }
                },
                {
                    accessorKey: 'notes',
                    header: 'Note',
                    size: 200,
                }
            ];

            return {
                listId: list.id,
                listName: list.name,
                capacity: list.capacity,
                subscriptions: listSubscriptions,
                columns: listSubscriptionsColumns
            };
        });
    }, [data]);

    const lists = React.useMemo(() => {
        return listConfigs.map(config => ({
            ...config,
            tableOptions: {
                columns: config.columns,
                data: config.subscriptions,
                enableStickyHeader: true,
                enablePagination: true,
                initialState: {
                    pagination: {
                        pageSize: 10,
                        pageIndex: 0,
                    },
                },
                paginationDisplayMode: 'pages', // Use literal type instead of string
                localization: MRT_Localization_IT,
                renderDetailPanel: ({row}) => (
                    <Box sx={{p: 2}}>
                        <Box sx={{display: 'flex', gap: 1}}>
                            <Button
                                variant="contained"
                                color="secondary"
                                startIcon={<EditIcon/>}
                                onClick={() => handleEditSubscription(row.original.id)}
                            >
                                Modifica iscrizione
                            </Button>
                            <Button
                                variant="outlined"
                                color="error"
                                startIcon={<DeleteIcon/>}
                                onClick={() => handleDeleteSubscription(row.original.id)}
                            >
                                Cancella iscrizione
                            </Button>
                        </Box>
                    </Box>
                ),
                renderEmptyRowsFallback: () => (
                    <Box sx={{textAlign: 'center', p: 2}}>
                        <Typography variant="body1">Nessuna iscrizione presente</Typography>
                    </Box>
                ),
                muiTablePaginationProps: {
                    labelRowsPerPage: 'Righe per pagina:'
                }
            }
        }));
    }, [listConfigs]);

    const ListAccordions = React.memo(() => {
        if (!lists || lists.length === 0) {
            return <Typography>Nessuna lista disponibile (aggiungine una per poter iscrivere persone)</Typography>;
        }

        return lists.map(listConfig => {
            const {listId, listName, capacity, subscriptions, tableOptions} = listConfig;
            const occupancyPercentage = Math.round((subscriptions.length / capacity) * 100) || 0;
            const occupancyColor = occupancyPercentage >= 60 ? 'error' : occupancyPercentage >= 70 ? 'warning' : 'success';
            const fixedTableOptions = {
                ...tableOptions,
                paginationDisplayMode: 'pages', // Use literal value instead of string type
            };
            const list = useMaterialReactTable(fixedTableOptions);

            return (
                <Accordion key={listId} sx={{mt: 2}}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon/>}>
                        <Box sx={{display: 'flex', alignItems: 'center', width: '100%'}}>
                            <BallotIcon sx={{color: 'primary.main', mr: 1}}/>
                            <Typography variant="h6" component="div" sx={{flexGrow: 1}}>
                                {listName} ({subscriptions.length}/{capacity})
                            </Typography>
                            <Box sx={{width: '200px', ml: 2}}>
                                <Box sx={{display: 'flex', justifyContent: 'space-between'}}>
                                    <Typography variant="body2">{subscriptions.length}/{capacity}</Typography>
                                </Box>
                                <LinearProgress
                                    variant="determinate"
                                    value={occupancyPercentage}
                                    color={occupancyColor}
                                    sx={{height: 8, borderRadius: 5}}
                                />
                            </Box>
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Box sx={{mb: 2}}>
                            {subscriptions.length < capacity && <Button
                                variant="contained"
                                color="primary"
                                startIcon={<PersonAddIcon/>}
                                onClick={() => handleOpenSubscribeModal(listId)}
                                disabled={subscriptions.length >= capacity}
                            >
                                Iscrivi Erasmus
                            </Button>}
                        </Box>
                        <MaterialReactTable table={list}/>
                    </AccordionDetails>
                </Accordion>
            );
        });
    });

    return (
        <Box>
            <Sidebar/>
            {eventModalOpen && <EventModal
                open={eventModalOpen}
                onClose={handleCloseEventModal}
                event={{
                    ...data,
                    date: data.date ? dayjs(data.date) : null,
                    subscription_start_date: data.subscription_start_date ? dayjs(data.subscription_start_date) : null,
                    subscription_end_date: data.subscription_end_date ? dayjs(data.subscription_end_date) : null
                }}
                isEdit={true}
            />}
            {subscribeModalOpen && <SubscriptionModal
                open={subscribeModalOpen}
                onClose={handleCloseSubscribeModal}
                event={data}
                listId={selectedList}
            />}
            {/* TODO: Add SubscriptionModal component when subscribeModalOpen is true */}
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
                                            <AdjustIcon sx={{color: 'primary.main', mr: 1}}/>
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
                                    <Grid size={{xs: 12}}>
                                        <Divider sx={{my: 1}}/>
                                        <Box sx={{mt: 2}}>
                                            <Typography variant="h6" component="div" sx={{mb: 2}}>Liste</Typography>
                                            <ListAccordions/>
                                        </Box>
                                    </Grid>
                                </Grid>
                            </CardContent>
                        </Card>
                    </>
                )}
                {showSuccessPopup && <Popup message={showSuccessPopup.message} state={showSuccessPopup.state}/>}
            </Box>
        </Box>
    );
}