import React, {useEffect, useState} from 'react';
import {useLocation, useNavigate, useParams} from 'react-router-dom';
import Sidebar from "../../Components/Sidebar";
import {Box, Button, Card, CardContent, Chip, Divider, IconButton, LinearProgress, Typography, Grid, Collapse} from "@mui/material";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import DescriptionIcon from '@mui/icons-material/Description';
import EuroIcon from '@mui/icons-material/Euro';
import AdjustIcon from '@mui/icons-material/Adjust';
import BallotIcon from '@mui/icons-material/Ballot';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import Loader from "../../Components/Loader";
import {fetchCustom, defaultErrorHandler} from "../../api/api";
import EditIcon from "@mui/icons-material/Edit";
import EventModal from "../../Components/events/EventModal";
import CustomEditor from '../../Components/CustomEditor';
import Popup from "../../Components/Popup";
import {MaterialReactTable, useMaterialReactTable} from 'material-react-table';
import {MRT_Localization_IT} from "material-react-table/locales/it";
import SubscriptionModal from "../../Components/events/SubscriptionModal";
import MoveToListModal from "../../Components/events/MoveToListModal";
import ReimburseDepositsModal from "../../Components/events/ReimburseDepositsModal";
import ReimburseQuotaModal from "../../Components/events/ReimburseQuotaModal";
import PrintableLiberatorieModal from "../../Components/events/PrintableLiberatorieModal";
import dayjs from "dayjs";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import FestivalIcon from "@mui/icons-material/Festival";
import AddCardIcon from '@mui/icons-material/AddCard';
import RefreshIcon from "@mui/icons-material/Refresh";
import {useAuth} from "../../Context/AuthContext";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';


export default function Event() {
    const {user} = useAuth();
    const canChangeTransactions = user?.permissions.includes("change_transaction");
    const canChangeEvent = user?.permissions.includes("change_event");
    const canChangeSubscription = user?.permissions.includes("change_subscription");
    const isBoardMember = user?.groups?.includes("Board");
    const {id} = useParams(); // Get the ID from URL
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
    const [expandedAccordion, setExpandedAccordion] = useState([]);
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
            setPopup({message: "Evento modificato con successo!", state: "success"});
            refreshEventData();
        }
    };

    const handleCloseSubscriptionModal = (success, message) => {
        setSubscriptionModalOpen(false);
        if (success) {
            setPopup({message: message, state: "success"});
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

    const handleEditSubscription = (subscriptionId) => {
        // Implementation for editing a subscription
        //console.log("Editing subscription:", subscriptionId);
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

    // Replace handleAccordionChange with a simple toggle function:
    const toggleCollapse = (panel) => {
        setExpandedAccordion(prev =>
            prev.includes(panel) ? prev.filter(p => p !== panel) : [...prev, panel]
        );
    };

    // Columns and data for lists
    const listConfigs = React.useMemo(() => {
        if (!data?.lists) return [];
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
                    Cell: ({row}) => {
                        const sub = row.original;
                        // If external_name is present, show it as plain text
                        if (sub.external_name) {
                            return <span>{sub.external_name}</span>;
                        }
                        // Otherwise, show profile_name as a link
                        return (
                            <span>
                                <Button variant="text"
                                        color="primary"
                                        sx={{textTransform: 'none', padding: 0, minWidth: 0}}
                                        endIcon={<OpenInNewIcon fontSize="small"/>}
                                        onClick={() => window.open(`/profile/${sub.profile_id}`, '_blank', 'noopener,noreferrer')}>
                                    {sub.profile_name}
                                </Button>
                            </span>
                        );
                    }
                },
                // Stato Quota column only if hasQuota
                hasQuota && {
                    accessorKey: 'status_quota',
                    header: 'Stato Quota',
                    size: 120,
                    Cell: ({cell}) => {
                        const status = cell.getValue();
                        let color, label;
                        if (status === 'pending') {
                            color = 'error';
                            label = 'In attesa';
                        } else if (status === 'paid') {
                            color = 'success';
                            label = 'Pagata';
                        } else if (status === 'reimbursed') {
                            color = 'warning';
                            label = 'Rimborsata';
                        } else {
                            color = 'default';
                            label = status;
                        }
                        return <Chip label={label} color={color}/>;
                    }
                },
                // Stato Cauzione column (if deposit enabled)
                hasDeposit && {
                    accessorKey: 'status_cauzione',
                    header: 'Stato Cauzione',
                    size: 120,
                    Cell: ({cell}) => {
                        const status = cell.getValue();
                        let label, color;
                        if (status === 'pending') {
                            label = 'In attesa';
                            color = 'error';
                        } else if (status === 'paid') {
                            label = 'Pagata';
                            color = 'success';
                        } else if (status === 'reimbursed') {
                            label = 'Rimborsata';
                            color = 'warning';
                        } else {
                            label = status;
                            color = 'default';
                        }
                        return <Chip label={label} color={color}/>;
                    }
                },
                data.is_allow_external && {
                    accessorKey: 'is_external',
                    header: 'Esterno',
                    size: 80,
                    Cell: ({row}) => {
                        const sub = row.original;
                        const isExternal = !!sub.external_name;
                        return (
                            <Chip
                                label={isExternal ? "Sì" : "No"}
                                color={isExternal ? "success" : "error"}
                                variant="outlined"
                            />
                        );
                    }
                },
                {
                    accessorKey: 'notes',
                    header: 'Note',
                    size: 150,
                },
            ].filter(Boolean);

            if ((hasDeposit || hasQuota) && isBoardMember) {
                listSubscriptionsColumns.push({
                    accessorKey: 'actions',
                    header: 'Azioni',
                    size: 100,
                    enableSorting: false,
                    enableColumnActions: false,
                    Cell: ({row}) => {
                        const sub = row.original;
                        // Quota button logic
                        const canReimburseQuota = hasQuota && sub.status_quota === 'paid';
                        // Cauzione button logic
                        const canReimburseDeposit = hasDeposit && sub.status_cauzione === 'paid';
                        return (<>
                            {hasQuota && isBoardMember && (
                                <IconButton
                                    title="Rimborsa Quota"
                                    color="secondary"
                                    disabled={!canReimburseQuota}
                                    onClick={e => {
                                        e.stopPropagation();
                                        setSingleSubToReimburseQuota(sub);
                                        setReimburseQuotaModalOpen(true);
                                    }}>
                                    <EuroIcon/>
                                </IconButton>
                            )}
                            {hasDeposit && isBoardMember && (
                                <IconButton
                                    title="Rimborsa Cauzione"
                                    color="primary"
                                    disabled={!canReimburseDeposit}
                                    onClick={e => {
                                        e.stopPropagation();
                                        setSingleSubToReimburse(sub);
                                        setReimburseDepositsModalOpen(true);
                                    }}>
                                    <AddCardIcon/>
                                </IconButton>
                            )}
                        </>);
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
    }, [data, hasDeposit, hasQuota]);

    const lists = React.useMemo(() => {
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
                renderTopToolbar: ({table}) => {
                    const selectedRows = table.getSelectedRowModel().rows;
                    const selectedCount = selectedRows.length;
                    const listId = config.listId;
                    const capacity = config.capacity;
                    const subscription_count = config.subscription_count;
                    const {isActive} = handleSubscriptionStatus();
                    return (
                        <Box sx={{display: 'flex', gap: 1, p: 2}}>
                            {selectedCount === 0 && (<>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        startIcon={<PersonAddIcon/>}
                                        disabled={!((capacity === 0 || subscription_count < capacity) && isActive)}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenSubscriptionModal(listId);
                                        }}>
                                        ISCRIVI
                                    </Button>
                                </>
                            )}
                            {selectedCount >= 1 && (<>
                                    <Button
                                        variant="outlined"
                                        color="primary"
                                        onClick={() => handleMoveToList(selectedRows, listId)}
                                        disabled={!canChangeSubscription}
                                    >
                                        Sposta in Altra Lista
                                    </Button>
                                    {false && (
                                        <Button
                                            variant="outlined"
                                            color="secondary"
                                            onClick={() => handleExportSelected(selectedRows)}>
                                            Esporta
                                        </Button>
                                    )}
                                </>
                            )}
                            {selectedCount === 1 && (<>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        onClick={() => handleEditSubscription(selectedRows[0].original.id)}
                                        disabled={!canChangeSubscription}
                                    >
                                        Modifica Iscrizione
                                    </Button>
                                </>
                            )}
                            {hasDeposit && canChangeTransactions && selectedCount === 0 && isBoardMember && (
                                <Button variant="contained"
                                        color="success"
                                        onClick={e => {
                                            e.stopPropagation();
                                            setSingleSubToReimburse(null);
                                            setReimburseDepositsListId(config.listId);
                                            setReimburseDepositsModalOpen(true);
                                        }}
                                        sx={{ml: 1}}
                                >
                                    Rimborsa Cauzioni
                                </Button>
                            )}
                            {hasQuota && selectedCount === 0 && data.is_a_bando && isBoardMember && (
                                <Button variant="contained"
                                        color="info"
                                        onClick={e => {
                                            e.stopPropagation();
                                            setPrintableLiberatorieListId(config.listId);
                                            setPrintableLiberatorieModalOpen(true);
                                        }}
                                        sx={{ml: 1}}
                                >
                                    Stampa Liberatorie
                                </Button>
                            )}
                        </Box>
                    );
                },
            }
        }));
    }, [listConfigs, data, canChangeSubscription, canChangeTransactions, isBoardMember]);

    const ListAccordions = React.memo(() => {
        if (!lists || lists.length === 0) {
            return <Typography>Nessuna lista disponibile (aggiungine una per poter iscrivere)</Typography>;
        }

        return lists.map(listConfig => {
            const {listId, listName, capacity, subscription_count, tableOptions} = listConfig;
            const occupancyPercentage = capacity > 0 ? Math.round((subscription_count / capacity) * 100) : 0;
            const occupancyColor = occupancyPercentage >= 90 ? 'error' : occupancyPercentage >= 60 ? 'warning' : 'success';
            const fixedTableOptions = {...tableOptions, paginationDisplayMode: 'pages'};
            const list = useMaterialReactTable(fixedTableOptions);

            return (
                <Box key={listId} sx={{mt: 2, border: '1px solid #ccc', borderRadius: 2, overflow: 'hidden'}}>
                    <Box onClick={() => toggleCollapse(listId)}
                         sx={{
                             display: 'flex',
                             alignItems: 'center',
                             cursor: 'pointer',
                             padding: 1,
                             backgroundColor: '#f5f5f5'
                         }}>
                        <BallotIcon sx={{color: 'primary.main', mr: 2}}/>
                        <Typography variant="h6" component="div" sx={{flexGrow: 1}}>{listName}</Typography>
                        <Box sx={{width: '200px', mr: 2}}>
                            <Box sx={{display: 'flex', justifyContent: 'space-between'}}>
                                <Typography variant="body2">{subscription_count}/{capacity}</Typography>
                            </Box>
                            <LinearProgress variant="determinate"
                                            value={occupancyPercentage}
                                            color={occupancyColor}
                                            sx={{height: 8, borderRadius: 5}}/>
                        </Box>
                        <IconButton onClick={(e) => {
                            e.stopPropagation();
                            toggleCollapse(listId);
                        }}>
                            {expandedAccordion.includes(listId) ? <ExpandLessIcon/> : <ExpandMoreIcon/>}
                        </IconButton>
                    </Box>
                    <Collapse in={expandedAccordion.includes(listId)} timeout="auto" unmountOnExit>
                        <Box sx={{p: 2}}> <MaterialReactTable table={list}/> </Box>
                    </Collapse>
                </Box>
            );
        });
    });
    ListAccordions.displayName = "ListAccordions";

    // Handlers for actions
    const handleMoveToList = (selectedRows, listId) => {
        //console.log("Moving selected rows to another list:", selectedRows);
        setSelectedRows(selectedRows);
        setSelectedList(listId);
        setMoveToListModalOpen(true);
    };

    const handleCloseMoveToListModal = (success) => {
        setMoveToListModalOpen(false);
        if (success) {
            setPopup({message: "Spostamento effettuato con successo!", state: "success"});
            refreshEventData();
        }
    }

    const handleCloseRemburseDepositsModal = (success, message) => {
        setReimburseDepositsModalOpen(false);
        setReimburseDepositsListId(null);
        setSingleSubToReimburse(null);
        if (success) {
            setPopup({message: message, state: "success"});
            refreshEventData();
        }
    }

    const handleCloseReimburseQuotaModal = (success, message) => {
        setReimburseQuotaModalOpen(false);
        setSingleSubToReimburseQuota(null);
        if (success) {
            setPopup({message: message, state: "success"});
            refreshEventData();
        }
    }

    const handleExportSelected = (selectedRows) => {
        console.log("Exporting selected rows:", selectedRows);
        // TODO: Implement export logic here
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
                                        <Box sx={{display: 'flex', alignItems: 'center'}}>
                                            <Chip
                                                label={data.is_a_bando ? "Evento a Bando" : "Evento non a Bando"}
                                                color={data.is_a_bando ? "success" : "error"}
                                                sx={{mr: 1}}
                                            />
                                            {data.is_allow_external && (
                                                <Chip label="Iscrizione Esterni Consentita" color="success"/>
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
