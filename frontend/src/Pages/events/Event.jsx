import React, {useEffect, useState} from 'react';
import {useLocation, useNavigate, useParams} from 'react-router-dom';
import Sidebar from "../../Components/Sidebar";
import {Accordion, AccordionDetails, AccordionSummary, Box, Button, Card, CardContent, Chip, Divider, IconButton, LinearProgress, Typography, Grid} from "@mui/material";
import EventIcon from "@mui/icons-material/Event";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import DescriptionIcon from '@mui/icons-material/Description';
import EuroIcon from '@mui/icons-material/Euro';
import AdjustIcon from '@mui/icons-material/Adjust';
import BallotIcon from '@mui/icons-material/Ballot';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import Loader from "../../Components/Loader";
import {fetchCustom} from "../../api/api";
import dayjs from "dayjs";
import EditIcon from "@mui/icons-material/Edit";
import EventModal from "../../Components/events/EventModal";
import CustomEditor from '../../Components/CustomEditor';
import Popup from "../../Components/Popup";
import {MaterialReactTable, useMaterialReactTable} from 'material-react-table';
import {MRT_Localization_IT} from "material-react-table/locales/it";
import SubscriptionModal from "../../Components/events/SubscriptionModal";
import MoveToListModal from "../../Components/events/MoveToListModal";
import ReimburseDepositsModal from "../../Components/events/ReimburseDepositsModal";
import {extractErrorMessage} from "../../utils/errorHandling";
import * as Sentry from "@sentry/react";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PriceCheckIcon from '@mui/icons-material/PriceCheck';

export default function Event() {
    const {id} = useParams(); // Get the ID from URL
    const location = useLocation();
    const navigate = useNavigate();
    const [eventModalOpen, setEventModalOpen] = useState(false);
    const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
    const [moveToListModalOpen, setMoveToListModalOpen] = useState(false);
    const [reimburseDepositsModalOpen, setReimburseDepositsModalOpen] = useState(false);
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

    useEffect(() => {
        setLoading(true);
        const fetchData = async () => {
            try {
                // Use ID from URL params if available, otherwise from state
                const eventId = id || eventFromState?.id;
                const response = await fetchCustom("GET", `/event/${eventId}/`);
                const json = await response.json();
                if (!response.ok) {
                    const errorMessage = await extractErrorMessage(json, response.status);
                    setPopup({message: `Errore: ${errorMessage}`, state: 'error'});
                } else {
                    setData(json);
                    console.log("Event Data: ", json);
                }
            } catch (error) {
                Sentry.captureException(error);
                setPopup({message: `Errore generale: ${error}`, state: "error"});
            } finally {
                setLoading(false);
            }
        };
        fetchData().then();
    }, [id, eventFromState]);

    const refreshEventData = async () => {
        setLoading(true);
        try {
            const response = await fetchCustom("GET", `/event/${data.id}/`);
            const json = await response.json();
            if (!response.ok) {
                const errorMessage = await extractErrorMessage(json, response.status);
                setPopup({message: `Errore: ${errorMessage}`, state: 'error'});
                navigate('/events/');
            } else {
                setData(json);
                setLoading(false);
            }
        } catch (error) {
            Sentry.captureException(error);
            setPopup({message: `Errore generale: ${error}`, state: "error"});
        } finally {
            setLoading(false);
        }
    };

    const handleOpenEventModal = () => {
        setEventModalOpen(true);
    };

    const handleCloseEventModal = async (success, message) => {
        setEventModalOpen(false);
        if (success && message === 'deleted') {
            navigate('/events/');
            return;
        }
        if (success) {
            setPopup({message: "Evento modificato con successo!", state: "success"});
            await refreshEventData();
        }
    };

    const handleCloseSubscriptionModal = async (success, message) => {
        setSubscriptionModalOpen(false);
        if (success) {
            setPopup({message: message, state: "success"});
            await refreshEventData();
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

    const handleEditSubscription = (subscriptionId) => {
        // Implementation for editing a subscription
        console.log("Editing subscription:", subscriptionId);
        setSelectedList(null);
        setSubscription(data.subscriptions.find(sub => sub.id === subscriptionId) || null);
        setSubscriptionIsEdit(true);
        setSubscriptionModalOpen(true);
    };

    const handleOpenSubscriptionModal = (listId) => {
        setSelectedList(listId);
        setSubscription(null);
        setSubscriptionIsEdit(false);
        setSubscriptionModalOpen(true);
    };

    // Columns and data for lists
    const listConfigs = React.useMemo(() => {
        if (!data?.lists) return [];
        const hasDeposit = data && data.deposit && Number(data.deposit) > 0;
        return data.lists.map(list => {
            const listSubscriptions = data.subscriptions?.filter(sub => sub.list_id === list.id) || [];
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
                    Cell: ({row}) => (
                        <span>
                            <Button variant="text"
                                    color="primary"
                                    sx={{textTransform: 'none', padding: 0, minWidth: 0}}
                                    endIcon={<OpenInNewIcon fontSize="small"/>}
                                    onClick={() => window.open(`/profile/${row.original.profile_id}`, '_blank', 'noopener,noreferrer')}>
                                {row.original.profile_name}
                            </Button>
                        </span>
                    )
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
                            case 'paid':
                                color = 'success';
                                label = 'PAGATO';
                                break;
                            case 'pending':
                                color = 'warning';
                                label = 'IN ATTESA';
                                break;
                            case 'cancelled':
                                color = 'error';
                                label = 'CANCELLATO';
                                break;
                            default:
                                color = 'default';
                                label = status;
                        }
                        return <Chip label={label} color={color}/>;
                    }
                },
                {
                    accessorKey: 'deposit_reimbursed',
                    header: 'Cauzione Rimborsata',
                    size: 150,
                    Cell: ({cell}) => {
                        const isReimbursed = cell.getValue();
                        return (
                            <Chip
                                label={isReimbursed ? 'Sì' : 'No'}
                                color={isReimbursed ? 'success' : 'default'}
                            />
                        );
                    },
                },
                {
                    accessorKey: 'notes',
                    header: 'Note',
                    size: 200,
                },
            ];

            if (hasDeposit) {
                listSubscriptionsColumns.push({
                    accessorKey: 'actions',
                    header: 'Azioni',
                    size: 80,
                    enableSorting: false,
                    enableColumnActions: false,
                    Cell: ({row}) => {
                        const sub = row.original;
                        const isEnabled = sub.status === 'paid' && !sub.deposit_reimbursed;
                        return (
                            <IconButton
                                title="Rimborsa Cauzione"
                                color="primary"
                                disabled={!isEnabled}
                                onClick={() => {
                                    setSingleSubToReimburse(sub);
                                    setReimburseDepositsModalOpen(true);
                                }}>
                                <PriceCheckIcon/>
                            </IconButton>
                        );
                    },
                });
            }

            return {
                listId: list.id,
                listName: list.name,
                capacity: list.capacity,
                subscription_count: list.subscription_count,
                subscriptions: listSubscriptions,
                columns: listSubscriptionsColumns
            };
        });
    }, [data]);

    const lists = React.useMemo(() => {
        const hasDeposit = data && data.deposit && Number(data.deposit) > 0;
        return listConfigs.map(config => ({
            ...config,
            tableOptions: {
                columns: config.columns,
                data: config.subscriptions,
                enableStickyHeader: true,
                enablePagination: true,
                enableRowSelection: true,
                enableRowActions: false,
                display: false,
                initialState: {
                    pagination: {
                        pageSize: 10,
                        pageIndex: 0,
                    },
                    columnVisibility: {id: false}
                },
                paginationDisplayMode: 'pages',
                localization: MRT_Localization_IT,
                renderEmptyRowsFallback: () => (
                    <Box sx={{textAlign: 'center', p: 2}}>
                        <Typography variant="body1">Nessuna iscrizione presente</Typography>
                    </Box>
                ),
                muiTablePaginationProps: {
                    labelRowsPerPage: 'Righe per pagina:'
                },
                renderTopToolbarCustomActions: ({table}) => {
                    const selectedRows = table.getSelectedRowModel().rows;
                    const selectedCount = selectedRows.length;
                    return (
                        <Box sx={{display: 'flex', gap: 1}}>
                            {selectedCount >= 1 && (<>
                                    <Button
                                        variant="outlined"
                                        color="primary"
                                        onClick={() => handleMoveToList(selectedRows, config.listId)}>
                                        Sposta in Altra Lista
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        color="secondary"
                                        onClick={() => handleExportSelected(selectedRows)}>
                                        Esporta
                                    </Button>
                                </>
                            )}
                            {selectedCount === 1 && (<>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        onClick={() => handleEditSubscription(selectedRows[0].original.id)}>
                                        Modifica Iscrizione
                                    </Button>
                                </>
                            )}
                            {/* Show Rimborsa Cauzioni button only if deposit is set and > 0 and TODO: is treasurer */}
                            {hasDeposit && (
                                <Button variant="contained"
                                        color="success"
                                        onClick={() => {
                                            setSingleSubToReimburse(null);
                                            setReimburseDepositsListId(config.listId);
                                            setReimburseDepositsModalOpen(true);
                                        }}
                                        sx={{ml: 1}}>
                                    Rimborsa Cauzioni
                                </Button>
                            )}
                        </Box>
                    );
                },
            }
        }));
    }, [listConfigs, data]);

    const ListAccordions = React.memo(() => {
        if (!lists || lists.length === 0) {
            return <Typography>Nessuna lista disponibile (aggiungine una per poter iscrivere)</Typography>;
        }

        const {isActive} = handleSubscriptionStatus();

        return lists.map(listConfig => {
            const {listId, listName, capacity, subscription_count, tableOptions} = listConfig;
            const occupancyPercentage = capacity > 0 ? Math.round((subscription_count / capacity) * 100) : 0;
            const occupancyColor = occupancyPercentage >= 90 ? 'error' : occupancyPercentage >= 60 ? 'warning' : 'success';
            const fixedTableOptions = {...tableOptions, paginationDisplayMode: 'pages'};
            const list = useMaterialReactTable(fixedTableOptions);

            return (
                <Accordion key={listId} sx={{mt: 2}}>
                    <AccordionSummary>
                        <Box sx={{display: 'flex', alignItems: 'center', width: '100%'}}>
                            <BallotIcon sx={{color: 'primary.main', mr: 1}}/>
                            <Typography variant="h6" component="div" sx={{flexGrow: 1}}>{listName}</Typography>
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    cursor: (capacity === 0 || subscription_count < capacity) && isActive ? 'pointer' : 'not-allowed',
                                    opacity: (capacity === 0 || subscription_count < capacity) && isActive ? 1 : 0.5,
                                    px: 2,
                                    py: 1,
                                    borderRadius: 1,
                                    bgcolor: 'primary.main',
                                    color: 'white',
                                    ml: 2,
                                }}
                                onClick={(capacity === 0 || subscription_count < capacity) && isActive ? () => handleOpenSubscriptionModal(listId) : undefined}>
                                <PersonAddIcon sx={{mr: 1}}/> ISCRIVI
                            </Box>
                            <Box sx={{width: '200px', ml: 2}}>
                                <Box sx={{display: 'flex', justifyContent: 'space-between'}}>
                                    <Typography variant="body2">{subscription_count}/{capacity}</Typography>
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
                        <MaterialReactTable table={list}/>
                    </AccordionDetails>
                </Accordion>
            );
        });
    });
    ListAccordions.displayName = "ListAccordions";

    // Handlers for actions
    const handleMoveToList = (selectedRows, listId) => {
        console.log("Moving selected rows to another list:", selectedRows);
        setSelectedRows(selectedRows);
        setSelectedList(listId);
        setMoveToListModalOpen(true);
    };

    const handleCloseMoveToListModal = async (success) => {
        setMoveToListModalOpen(false);
        if (success) {
            setPopup({message: "Spostamento effettuato con successo!", state: "success"});
            await refreshEventData();
        }
    }

    const handleCloseRemburseDepositsModal = async (success, message) => {
        setReimburseDepositsModalOpen(false);
        setReimburseDepositsListId(null);
        setSingleSubToReimburse(null);
        if (success) {
            setPopup({message: message, state: "success"});
            await refreshEventData();
        }
    }

    const handleExportSelected = (selectedRows) => {
        console.log("Exporting selected rows:", selectedRows);
        // Implement export logic here
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
            <Box sx={{mx: '5%'}}>
                {isLoading ? <Loader/> : (<>
                        <Box sx={{display: 'flex', alignItems: 'center', marginBottom: '20px'}}>
                            <IconButton onClick={() => {
                                navigate('/events/');
                            }} sx={{mr: 2}}><ArrowBackIcon/></IconButton>
                            <EventIcon sx={{marginRight: '10px'}}/>
                            <Typography variant="h4">Evento - {data.name}</Typography>
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
                                            {data.cost !== 0 ? `€ ${data.cost}` : 'Gratuito'}
                                        </Typography>
                                    </Grid>
                                    <Grid size={{xs: 12, md: 3}}>
                                        <Box sx={{display: 'flex', alignItems: 'center'}}>
                                            <EuroIcon sx={{color: 'primary.main', mr: 1}}/>
                                            <Typography variant="h6" component="div">Cauzione</Typography>
                                        </Box>
                                        <Typography variant="body1" color="text.secondary" sx={{mt: 2}}>
                                            {data.deposit && data.deposit !== "0.00" && data.deposit !== 0
                                                ? `€ ${data.deposit}`
                                                : 'Nessuna cauzione'}
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
                {popup && <Popup message={popup.message} state={popup.state}/>}
            </Box>
        </Box>
    );
}