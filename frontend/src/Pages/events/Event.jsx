import React, {useEffect, useState} from 'react';
import {useLocation, useNavigate, useParams} from 'react-router-dom';
import Sidebar from "../../Components/Sidebar";
import {Box, Button, Card, CardContent, Chip, Divider, IconButton, Typography, Grid} from "@mui/material";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import DescriptionIcon from '@mui/icons-material/Description';
import EuroIcon from '@mui/icons-material/Euro';
import AdjustIcon from '@mui/icons-material/Adjust';
import Loader from "../../Components/Loader";
import {fetchCustom, defaultErrorHandler} from "../../api/api";
import EditIcon from "@mui/icons-material/Edit";
import EventModal from "../../Components/events/EventModal";
import CustomEditor from '../../Components/CustomEditor';
import Popup from "../../Components/Popup";
import SubscriptionModal from "../../Components/events/SubscriptionModal";
import MoveToListModal from "../../Components/events/MoveToListModal";
import ReimburseDepositsModal from "../../Components/events/ReimburseDepositsModal";
import ReimburseQuotaModal from "../../Components/events/ReimburseQuotaModal";
import PrintableLiberatorieModal from "../../Components/events/PrintableLiberatorieModal";
import dayjs from "dayjs";
import FestivalIcon from "@mui/icons-material/Festival";
import AddCardIcon from '@mui/icons-material/AddCard';
import RefreshIcon from "@mui/icons-material/Refresh";
import {useAuth} from "../../Context/AuthContext";
import EditAnswersModal from "../../Components/events/EditAnswersModal";
import ListAccordions from "../../Components/events/ListAccordions";
import PaymentIcon from '@mui/icons-material/Payment';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';


export default function Event() {
    const {user} = useAuth();
    const canChangeTransactions = user?.permissions.includes("change_transaction");
    const canChangeEvent = user?.permissions.includes("change_event");
    const canChangeSubscription = user?.permissions.includes("change_subscription");
    const isBoardMember = user?.groups?.includes("Board");
    const {id} = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [eventModalOpen, setEventModalOpen] = useState(false);
    const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
    const [moveToListModalOpen, setMoveToListModalOpen] = useState(false);
    const [reimburseDepositsModalOpen, setReimburseDepositsModalOpen] = useState(false);
    const [reimburseQuotaModalOpen, setReimburseQuotaModalOpen] = useState(false);
    const [printableLiberatorieModalOpen, setPrintableLiberatorieModalOpen] = useState(false);
    const [printableLiberatorieListId, setPrintableLiberatorieListId] = useState(null);
    const [selectedRows, setSelectedRows] = useState([]);
    const [isLoading, setLoading] = useState(true);
    const [popup, setPopup] = useState(null);
    const [data, setData] = useState(null);
    // Try to get event from location state, if not available we'll fetch it using ID
    const eventFromState = location.state?.event;
    // States for subscription management
    const [selectedList, setSelectedList] = useState(null);
    const [subscription, setSubscription] = useState(null);
    const [subscriptionIsEdit, setSubscriptionIsEdit] = useState(null);
    const [reimburseDepositsListId, setReimburseDepositsListId] = useState(null);
    const [singleSubToReimburse, setSingleSubToReimburse] = useState(null);
    const [singleSubToReimburseQuota, setSingleSubToReimburseQuota] = useState(null);
    const [editAnswersModalOpen, setEditAnswersModalOpen] = useState(false);
    const [editAnswersSubscription, setEditAnswersSubscription] = useState(null);
    const hasDeposit = data?.deposit > 0;
    const hasQuota = data?.cost > 0;

    useEffect(() => {
        setLoading(true);
        const eventId = id || eventFromState?.id;
        fetchCustom("GET", `/event/${eventId}/`, {
            onSuccess: (data) => setData(data),
            onError: (responseOrError) => defaultErrorHandler(responseOrError, setPopup),
            onFinally: () => setLoading(false)
        });
    }, [id, eventFromState]);

    const refreshEventData = () => {
        setLoading(true);
        fetchCustom("GET", `/event/${data.id}/`, {
            onSuccess: (data) => {
                setData(data);
            },
            onError: (responseOrError) => {
                defaultErrorHandler(responseOrError, setPopup);
                navigate('/events/');
            },
            onFinally: () => setLoading(false)
        });
    };

    const handleOpenEventModal = () => {
        setEventModalOpen(true);
    };

    const handleCloseEventModal = (success, message) => {
        setEventModalOpen(false);
        if (success && message === 'deleted') {
            navigate('/events/');
            return;
        }
        if (success) {
            setPopup({message: "Evento modificato con successo!", state: "success", id: Date.now()});
            refreshEventData();
        }
    };

    const handleCloseSubscriptionModal = (success, message) => {
        setSubscriptionModalOpen(false);
        if (success) {
            setPopup({message: message, state: "success", id: Date.now()});
            refreshEventData();
        }
        setSelectedList(null);
    };

    const handleSubscriptionStatus = () => {
        if (!data) return {chip: <Chip label="Loading..." variant="outlined" size="medium"/>, isActive: false};

        const now = dayjs();
        const startDateTime = data.subscription_start_date ? dayjs(data.subscription_start_date) : null;
        const endDateTime = data.subscription_end_date ? dayjs(data.subscription_end_date) : null;

        let color = "error";
        let isActive = false;

        if (startDateTime && endDateTime) {
            if (now.isAfter(startDateTime) && now.isBefore(endDateTime)) {
                color = "success";
                isActive = true;
            } else if (now.isBefore(startDateTime)) {
                color = "warning";
            }
        }

        let startText = data.subscription_start_date ? dayjs(data.subscription_start_date).format('DD/MM/YYYY HH:mm') : 'Inizio non specificato';
        let endText = data.subscription_end_date ? dayjs(data.subscription_end_date).format('DD/MM/YYYY HH:mm') : 'Fine non specificata';

        return {
            chip: (
                <Chip
                    label={startText + ' - ' + endText}
                    color={color}
                    variant="outlined"
                    size="medium"
                />
            ),
            isActive
        };
    };

    // Handlers for ListAccordions component
    const handleOpenSubscriptionModal = (listId) => {
        setSelectedList(listId);
        setSubscription(null);
        setSubscriptionIsEdit(false);
        setSubscriptionModalOpen(true);
    };

    const handleEditSubscription = (subscriptionId) => {
        setSelectedList(null);
        setSubscription(data.subscriptions.find(sub => sub.id === subscriptionId) || null);
        setSubscriptionIsEdit(true);
        setSubscriptionModalOpen(true);
    };

    const handleMoveToList = (selectedRows, listId) => {
        setSelectedRows(selectedRows);
        setSelectedList(listId);
        setMoveToListModalOpen(true);
    };

    const handleOpenReimburseDeposits = (subscription, listId) => {
        setSingleSubToReimburse(subscription);
        setReimburseDepositsListId(listId);
        setReimburseDepositsModalOpen(true);
    };

    const handleOpenReimburseQuota = (subscription) => {
        setSingleSubToReimburseQuota(subscription);
        setReimburseQuotaModalOpen(true);
    };

    const handleOpenPrintableLibetatorie = (listId) => {
        setPrintableLiberatorieListId(listId);
        setPrintableLiberatorieModalOpen(true);
    };

    const handleOpenEditAnswers = (subscription) => {
        setEditAnswersSubscription(subscription);
        setEditAnswersModalOpen(true);
    }

    // Add missing modal close handlers
    const handleCloseMoveToListModal = (success, message) => {
        setMoveToListModalOpen(false);
        if (success) {
            setPopup({message: message, state: "success", id: Date.now()});
            refreshEventData();
        }
        setSelectedRows([]);
        setSelectedList(null);
    };

    const handleCloseRemburseDepositsModal = (success, message) => {
        setReimburseDepositsModalOpen(false);
        if (success) {
            setPopup({message: message, state: "success", id: Date.now()});
            refreshEventData();
        }
        setReimburseDepositsListId(null);
        setSingleSubToReimburse(null);
    };

    const handleCloseReimburseQuotaModal = (success, message) => {
        setReimburseQuotaModalOpen(false);
        if (success) {
            setPopup({message: message, state: "success", id: Date.now()});
            refreshEventData();
        }
        setSingleSubToReimburseQuota(null);
    };

    const handleCloseEditAnswersModal = (success, message) => {
        setEditAnswersModalOpen(false);
        if (success) {
            setPopup({message: message, state: "success", id: Date.now()});
            refreshEventData();
        }
        setEditAnswersSubscription(null);
    };

    // Add handler for copying form link
    const handleCopyFormLink = () => {
        const url = window.location.origin + `/event/${data.id}/formlogin/`;
        navigator.clipboard.writeText(url).then(() => {
            setPopup({message: "Link del form copiato!", state: "success", id: Date.now()});
        });
    };

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
            {subscriptionModalOpen && <SubscriptionModal
                open={subscriptionModalOpen}
                onClose={handleCloseSubscriptionModal}
                event={data}
                listId={selectedList}
                subscription={subscription}
                isEdit={subscriptionIsEdit}
            />}
            {moveToListModalOpen && <MoveToListModal
                open={moveToListModalOpen}
                onClose={handleCloseMoveToListModal}
                selectedRows={selectedRows}
                event={data}
                listId={selectedList}
            />}
            {reimburseDepositsModalOpen && (
                <ReimburseDepositsModal
                    open={reimburseDepositsModalOpen}
                    onClose={handleCloseRemburseDepositsModal}
                    event={data}
                    listId={reimburseDepositsListId}
                    subscription={singleSubToReimburse}
                    refreshEventData={refreshEventData}
                />
            )}
            {reimburseQuotaModalOpen && (
                <ReimburseQuotaModal
                    open={reimburseQuotaModalOpen}
                    onClose={handleCloseReimburseQuotaModal}
                    event={data}
                    subscription={singleSubToReimburseQuota}
                />
            )}
            {printableLiberatorieModalOpen && (
                <PrintableLiberatorieModal
                    open={printableLiberatorieModalOpen}
                    onClose={() => setPrintableLiberatorieModalOpen(false)}
                    event={data}
                    listId={printableLiberatorieListId}
                />
            )}
            {editAnswersModalOpen && (
                <EditAnswersModal
                    open={editAnswersModalOpen}
                    onClose={handleCloseEditAnswersModal}
                    event={data}
                    subscription={editAnswersSubscription}
                />
            )}
            <Box sx={{mx: '5%'}}>
                {isLoading ? <Loader/> : (<>
                        <Box sx={{display: 'flex', alignItems: 'center', mb: 4}}>
                            <IconButton onClick={() => {
                                navigate('/events/');
                            }} sx={{mr: 2}}><ArrowBackIcon/></IconButton>
                            <FestivalIcon sx={{mr: 2}}/>
                            <Typography variant="h4">Evento - {data.name}</Typography>
                            <Box sx={{flexGrow: 1}}/>
                            <IconButton onClick={refreshEventData}
                                        title="Aggiorna"
                                        disabled={isLoading}>
                                <RefreshIcon/>
                            </IconButton>
                        </Box>
                        <Card elevation={3} sx={{mt: 5, mb: 4, borderRadius: 2, overflow: 'hidden'}}>
                            <CardContent>
                                <Grid container spacing={3}>
                                    <Grid size={{xs: 12, md: 3}}>
                                        <Box sx={{display: 'flex', alignItems: 'center'}}>
                                            <CalendarTodayIcon sx={{color: 'primary.main', mr: 1}}/>
                                            <Typography variant="h6" component="div">Data</Typography>
                                        </Box>
                                        <Typography variant="body1" color="text.secondary" sx={{mt: 2}}>
                                            {data.date ? dayjs(data.date).format('DD/MM/YYYY') : 'Data non specificata'}
                                        </Typography>
                                    </Grid>
                                    <Grid size={{xs: 12, md: 3}}>
                                        <Box sx={{display: 'flex', alignItems: 'center'}}>
                                            <EuroIcon sx={{color: 'primary.main', mr: 1}}/>
                                            <Typography variant="h6" component="div">Costo</Typography>
                                        </Box>
                                        <Typography variant="body1" color="text.secondary" sx={{mt: 2}}>
                                            {hasQuota ? `€ ${data.cost}` : 'Evento gratuito'}
                                        </Typography>
                                    </Grid>
                                    <Grid size={{xs: 12, md: 3}}>
                                        <Box sx={{display: 'flex', alignItems: 'center'}}>
                                            <AddCardIcon sx={{color: 'primary.main', mr: 1}}/>
                                            <Typography variant="h6" component="div">Cauzione</Typography>
                                        </Box>
                                        <Typography variant="body1" color="text.secondary" sx={{mt: 2}}>
                                            {hasDeposit ? `€ ${data.deposit}` : 'Nessuna cauzione'}
                                        </Typography>
                                    </Grid>
                                    <Grid size={{xs: 12, md: 3}}>
                                        <Box sx={{display: 'flex', alignItems: 'center'}}>
                                            <AdjustIcon sx={{color: 'primary.main', mr: 1}}/>
                                            <Typography variant="h6" component="div">Periodo Iscrizioni</Typography>
                                        </Box>
                                        <Box sx={{display: 'flex', alignItems: 'center', mt: 2}}>
                                            {handleSubscriptionStatus().chip}
                                        </Box>
                                    </Grid>
                                    <Grid size={{xs: 12, md: 3}}>
                                        <Box sx={{display: 'flex', alignItems: 'center', flexWrap: 'wrap'}}>
                                            <Chip
                                                label={data.is_a_bando ? "Evento a Bando" : "Evento non a Bando"}
                                                color={data.is_a_bando ? "success" : "error"}
                                                sx={{mr: 1, mb: 1}}
                                            />
                                            {data.is_allow_external && (
                                                <Chip label="Iscrizione Esterni Consentita" color="success"
                                                      sx={{mr: 1, mb: 1}}/>
                                            )}
                                            {/* Show if event has a form */}
                                            {data.enable_form && (
                                                <Box sx={{display: 'flex', alignItems: 'center', mr: 1, mb: 1}}>
                                                    <Chip
                                                        icon={<EditIcon/>}
                                                        label="Form Iscrizioni Attivo"
                                                        color="success"
                                                        sx={{mr: 1}}
                                                        deleteIcon={
                                                            <ContentCopyIcon
                                                                sx={{cursor: 'pointer'}}
                                                                titleAccess="Copia Link"
                                                            />
                                                        }
                                                        onDelete={handleCopyFormLink}
                                                    />
                                                </Box>
                                            )}
                                            {/* Show if form is programmed to open at a specific time */}
                                            {data.enable_form && data.form_programmed_open_time && (() => {
                                                const openTime = dayjs(data.form_programmed_open_time);
                                                const now = dayjs();
                                                const isOpen = now.isAfter(openTime) || now.isSame(openTime);
                                                return (
                                                    <Chip
                                                        icon={<AccessTimeIcon/>}
                                                        label={
                                                            "Apertura Form: " +
                                                            openTime.format('DD/MM/YYYY HH:mm')
                                                        }
                                                        color={isOpen ? "success" : "warning"}
                                                        sx={{mr: 1, mb: 1}}
                                                    />
                                                );
                                            })()}
                                            {/* Show if online payment is enabled */}
                                            {data.enable_form && (
                                                <Chip
                                                    icon={<PaymentIcon/>}
                                                    label={data.allow_online_payment ? "Pagamento Online Abilitato" : "Pagamento Online Disabilitato"}
                                                    color={data.allow_online_payment ? "success" : "error"}
                                                    sx={{mr: 1, mb: 1}}
                                                />
                                            )}
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
                                        <Button
                                            sx={{mt: 2}}
                                            variant="contained"
                                            color="primary"
                                            onClick={handleOpenEventModal}
                                            disabled={!canChangeEvent}
                                        >
                                            Modifica Evento
                                        </Button>
                                    </Grid>
                                    <Grid size={{xs: 12}}>
                                        <Divider sx={{my: 1}}/>
                                        <Box sx={{mt: 2}}>
                                            <Typography variant="h6" component="div" sx={{mb: 2}}>Liste</Typography>
                                            <ListAccordions
                                                data={data}
                                                onOpenSubscriptionModal={handleOpenSubscriptionModal}
                                                onEditSubscription={handleEditSubscription}
                                                onMoveToList={handleMoveToList}
                                                onOpenReimburseDeposits={handleOpenReimburseDeposits}
                                                onOpenReimburseQuota={handleOpenReimburseQuota}
                                                onOpenPrintableLibetatorie={handleOpenPrintableLibetatorie}
                                                onOpenEditAnswers={handleOpenEditAnswers}
                                                canChangeSubscription={canChangeSubscription}
                                                canChangeTransactions={canChangeTransactions}
                                                isBoardMember={isBoardMember}
                                            />
                                        </Box>
                                    </Grid>
                                </Grid>
                            </CardContent>
                        </Card>
                    </>
                )}
                {popup && <Popup key={popup.id} message={popup.message} state={popup.state}/>}
            </Box>
        </Box>
    );
}
