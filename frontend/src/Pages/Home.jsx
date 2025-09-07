import {useEffect, useState, useRef} from "react";
import Sidebar from "../Components/Sidebar";
import {Box, Typography, Card, CardContent, CardActions, Button, IconButton, Paper} from "@mui/material";
import ConfirmDialog from "../Components/ConfirmDialog";
import {defaultErrorHandler, fetchCustom} from "../api/api";
import {useAuth} from "../Context/AuthContext";
import logo from '../assets/esnpolimi-logo.png';
import Popup from "../Components/Popup";
import {accountDisplayNames as names} from "../utils/displayAttributes";
import TransactionAdd from "../Components/treasury/TransactionAdd";
import RefreshIcon from '@mui/icons-material/Refresh';
import ReimbursementRequestModal from "../Components/treasury/ReimbursementRequestModal";
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange';
import ListAltIcon from '@mui/icons-material/ListAlt';
import RecentAccountTransactionsModal from "../Components/treasury/RecentAccountTransactionsModal";


const style = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    mt: 2,
};

export default function Home() {
    const {user} = useAuth();
    const [accounts, setAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [actionType, setActionType] = useState(""); // "open" or "close"
    const [popup, setPopup] = useState(null);
    const [transactionModalOpen, setTransactionModalOpen] = useState(false);
    const [casseLoading, setCasseLoading] = useState(false);
    const [showAccountDetails, setShowAccountDetails] = useState(false); // hidden by default
    const casseRef = useRef(null);
    const [rimborsoModalOpen, setRimborsoModalOpen] = useState(false);
    const [showFirstLoginBanner, setShowFirstLoginBanner] = useState(!user?.last_login);
    const [recentModalAccount, setRecentModalAccount] = useState(null);

    const groupname = user?.groups
        ? user.groups[0] === "Aspiranti"
            ? "Aspirante"
            : user.groups[0] === "Attivi"
                ? "Active Member"
                : user.groups[0] === "Board"
                    ? "Board Member"
                    : user.groups[0]
        : null;
    const staticLinks = [
        {
            topic: "LINK UTILI",
            links: [
                {
                    name: "FOGLIO TURNI UFFICIO",
                    description: "",
                    url: "https://docs.google.com/spreadsheets/d/1oHRaRcJvzt5XLfEjU-zlTcgH8ZOg9G-a9w0wGejAY2I/edit?gid=2036311463#gid=2036311463",
                    color: "#388e3c"
                },
                {
                    name: "FOGLIO CONTASOLDI",
                    description: "",
                    url: "https://docs.google.com/spreadsheets/d/1Ewt9DggEyDy8lT2Kh6YiN2k5SvGZnVkvPwpufZ0w5sU/edit",
                    color: "#f57c00"
                },
                {
                    name: "FORM REPORT UFFICI",
                    description: "",
                    url: "https://goo.gl/forms/xAusvfJZdKppn2D13",
                    color: "#d32f2f"
                },
                {
                    name: "FOGLI FIRME BANDI",
                    description: "",
                    url: "https://drive.google.com/drive/folders/1MBFMmga6IFPqPD_ER9HCdiHoI092y3Zs?usp=sharing",
                    color: "#7b1fa2"
                },
                {
                    name: "RICHIESTA RIMBORSO",
                    description: "",
                    url: "",
                    color: "#1976d2",
                    onClick: () => setRimborsoModalOpen(true)
                },
            ]
        },
        {
            topic: "WIKI E TUTORIAL",
            links: [
                {
                    name: "WIKI ESN POLIMI",
                    description: "",
                    url: "https://wiki.esnpolimi.it/",
                    color: "#512da8"
                },
                {
                    name: "TUTORIAL viaggi e attività",
                    description: "",
                    url: "https://drive.google.com/drive/folders/13DZUKo7D74VmbX2S3uKTOPrO5h1VFTGh",
                    color: "#0288d1"
                },
                {
                    name: "Importazione Contatti DI MASSA",
                    description: "",
                    url: "https://docs.google.com/document/d/1OnwtNsKL9R5ph30IQcFMtPoMxq8-HyDs/edit?usp=sharing&ouid=112656928168770237958&rtpof=true&sd=true",
                    color: "#0097a7"
                },
            ]
        },
        {
            topic: "ISTRUZIONI RESPONSABILI UFFICIO",
            descriptor: "PER APRIRE E CHIUDERE UFFICIO",
            links: [
                {
                    name: "1. Contare i soldi in cassa con il foglio contasoldi dell'ufficio giusto",
                    description: "",
                    url: "",
                    color: "#607d8b"
                },
                {
                    name: "2. Verificare che coincidano con quelli in cassa a gestionale (se non coincidono comunicarlo al tesoriere)",
                    description: "",
                    url: "",
                    color: "#607d8b"
                },
                {
                    name: "3. Aprire/chiudere cassa a gestionale",
                    description: "",
                    url: "",
                    color: "#607d8b"
                }
            ]
        }
    ];

    useEffect(() => {
        fetchAccounts();
    }, [user]);

    const fetchAccounts = () => {
        setCasseLoading(true);
        fetchCustom("GET", "/accounts/", {
            onSuccess: (data) => setAccounts(data),
            onError: (responseOrError) => defaultErrorHandler(responseOrError, setPopup),
            onFinally: () => setCasseLoading(false)
        });
    };

    const handleAction = (account, type) => {
        setSelectedAccount(account);
        setActionType(type);
        setConfirmDialogOpen(true);
    };

    const confirmAction = () => {
        fetchCustom("PATCH", `/account/${selectedAccount.id}/`, {
            body: {status: actionType === "open" ? "open" : "closed"},
            onSuccess: () => {
                fetchAccounts();
                setPopup({
                    message: `Cassa ${actionType === "open" ? "aperta" : "chiusa"} con successo!`,
                    state: "success",
                    id: Date.now()
                });
            },
            onError: (responseOrError) => defaultErrorHandler(responseOrError, setPopup),
            onFinally: () => setConfirmDialogOpen(false)
        });
    };

    const handleTransactionModalOpen = (success) => {
        setTransactionModalOpen(false);
        if (success) {
            setPopup({message: "Transazione registrata con successo!", state: "success", id: Date.now()});
            fetchAccounts();
        }
    };

    const openTransactionModal = (account) => {
        setSelectedAccount(account);
        setPopup(null); // Clear any existing popup when opening the modal
        setTransactionModalOpen(true);
    };

    const handleReimbursementRequestModalClose = (success) => {
        setRimborsoModalOpen(false);
        if (success) setPopup({
            message: "Richiesta di rimborso inviata con successo!",
            state: "success",
            id: Date.now()
        });
    };

    useEffect(() => {
        setShowFirstLoginBanner(!user?.last_login);
    }, [user]);

    const isAspirante = user?.groups && user.groups[0] === "Aspiranti";
    const isActive = user?.groups && user.groups[0] === "Attivi";
    const isBoard = user?.groups && user.groups[0] === "Board";
    // New derived finance permission flags (from UserReactSerializer)
    const canManageCasse = !!user?.effective_can_manage_casse;
    const canViewBalances = !!user?.effective_can_view_casse_import;
    const restrictedAccounts = user?.restricted_accounts || [];
    const displayGroupName = (groupname === "Aspirante" && canManageCasse)
        ? "Aspirante (con permessi casse)"
        : groupname;

    return (
        <Box sx={{
            minHeight: "100vh",
            background: "#f9f9fb",
            pb: 2,
            position: "relative"
        }}>
            {/* Sidebar */}
            <Sidebar/>
            {/* First Login Banner */}
            {showFirstLoginBanner && (
                <Box sx={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    width: "100vw",
                    height: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 1300,
                    background: "rgba(240,245,255,0.75)",
                }}>
                    <Paper elevation={6} sx={{
                        p: 3,
                        borderRadius: 3,
                        background: "#e3f2fd",
                        boxShadow: "0 2px 8px rgba(60,80,120,0.12)",
                        maxWidth: 600,
                        textAlign: "center",
                        position: "relative"
                    }}>
                        <Typography variant="h6" sx={{fontWeight: 700, color: "#1976d2", mb: 1}}>
                            Benvenuto! Ecco alcune istruzioni per iniziare:
                        </Typography>
                        <Typography variant="body1" sx={{color: "#2d3a4b", mb: 2}}>
                            Disabilita il tuo AdBlocker per permetterci di rilevare errori.<br/>
                            Consulta i link utili qui sotto.<br/>
                            Se hai bisogno di aiuto, visita la Guida nei link utili.<br/>
                        </Typography>
                        <Button variant="contained" color="primary" onClick={() => setShowFirstLoginBanner(false)}>
                            Ho capito
                        </Button>
                    </Paper>
                </Box>
            )}
            {/* Simplified Centered Header */}
            <Box sx={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                mt: -2,
                mb: 2,
            }}>
                <img src={logo}
                     alt="ESN Polimi Logo"
                     style={{
                         height: "15vh",
                         width: "auto",
                         objectFit: "contain",
                         borderRadius: "8px",
                     }}
                />
                <Typography variant="h4" sx={{fontWeight: 700, color: "#2d3a4b", mt: 1}}>
                    Sistema di Gestione
                </Typography>
                <Typography variant="h5" sx={{fontWeight: 500, color: "#2d3a4b", mt: 1, mb: 2}}>
                    {user ? user.profile.name + ' ' + user.profile.surname + ' - ' + displayGroupName : ''}
                </Typography>
            </Box>
            {/* Main Content */}
            <Box sx={{...style}}>

                <Box sx={{
                    width: "100%",
                    maxWidth: 1200,
                    mb: 2,
                    display: "grid",
                    gridTemplateColumns: {
                        xs: "1fr",
                        sm: "1fr 1fr",
                        md: "1fr 1fr 1fr"
                    },
                    gap: 2,
                    justifyContent: "center",
                }}>
                    {staticLinks.map((section) => (
                        <Paper key={section.topic}
                               elevation={2}
                               sx={{
                                   p: 2,
                                   borderRadius: 3,
                                   background: "#fff",
                                   boxShadow: "0 2px 8px rgba(60,80,120,0.06)",
                                   display: "flex",
                                   flexDirection: "column",
                                   alignItems: "flex-start",
                                   minWidth: 220,
                               }}>
                            <Typography variant="subtitle1" sx={{fontWeight: 700, color: "#2d3a4b", mb: 1}}>
                                {section.topic}
                            </Typography>
                            {section.descriptor && (
                                <Typography variant="body2" sx={{color: "#607d8b", mb: 1}}>
                                    {section.descriptor}
                                </Typography>
                            )}
                            <Box sx={{display: "flex", flexDirection: "column", gap: 1, width: "100%"}}>
                                {section.links.map((link) => (
                                    <Box key={link.name}
                                         sx={{
                                             mb: 0.5,
                                             pl: 2,
                                             borderLeft: `5px solid ${link.color}`,
                                             background: "#f7fafd",
                                             borderRadius: 1,
                                             py: 0.5,
                                         }}>
                                        <a href={link.url ? link.url : "#"}
                                           style={{
                                               textDecoration: "none",
                                               color: link.color,
                                               fontWeight: 600,
                                               fontSize: "1rem",
                                           }}
                                           target={link.url ? "_blank" : "_self"}
                                           rel="noopener noreferrer"
                                           onClick={link.onClick}>
                                            {link.name}
                                        </a>
                                        {link.description && (
                                            <Typography variant="body2" sx={{color: "#607d8b"}}>
                                                {link.description}
                                            </Typography>
                                        )}
                                    </Box>
                                ))}
                            </Box>
                        </Paper>
                    ))}
                </Box>
            </Box>
            {/* Casse Section at the bottom (Full Width) */}
            <Box ref={casseRef}
                 sx={{
                     mx: 3,
                     mt: 2,
                     mb: 2,
                     display: "flex",
                     flexDirection: "column",
                     alignItems: "center",
                 }}>
                <Paper elevation={4}
                       sx={{
                           p: 2,
                           mb: 0,
                           borderRadius: 4,
                           background: "#fff",
                           boxShadow: "0 8px 32px rgba(60,80,120,0.08)",
                           border: "1px solid #e3e8f0",
                           mt: 2,
                           width: "100%",
                       }}>
                    <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
                        <Typography variant="h5" sx={{fontWeight: 600}}>Casse</Typography>
                        <Box>
                            <IconButton
                                variant="outlined"
                                color="primary"
                                size="small"
                                onClick={fetchAccounts}
                                disabled={casseLoading}
                                sx={{mr: 1}}>
                                <RefreshIcon/>
                            </IconButton>
                            {canViewBalances && (
                                <IconButton
                                    variant="outlined"
                                    color="primary"
                                    size="small"
                                    onClick={() => setShowAccountDetails(v => !v)}
                                    sx={{mr: 1}}
                                    title={showAccountDetails ? "Nascondi Importi" : "Mostra Importi"}>
                                    {showAccountDetails ? <VisibilityOffIcon/> : <VisibilityIcon/>}
                                </IconButton>
                            )}
                        </Box>
                    </Box>
                    <Box
                        sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 1,
                            mt: 2,
                            justifyContent: "center",
                        }}>
                        {accounts.map((account) => {
                            const balanceValue = account.balance;
                            const isRestrictedBackend = balanceValue === null || balanceValue === undefined;
                            const balanceVisible = showAccountDetails
                                && canViewBalances
                                && !restrictedAccounts.includes(account.name)
                                && !isRestrictedBackend;
                            return (
                                <Card
                                    key={account.id}
                                    sx={{
                                        flex: "1 1 300px",
                                        minWidth: 200,
                                        maxWidth: 300,
                                        display: "flex",
                                        alignItems: "stretch",
                                        justifyContent: "space-between",
                                        boxShadow: 4,
                                        borderRadius: 2,
                                        m: 1,
                                        p: 0.5
                                    }}>
                                    <CardContent
                                        sx={{
                                            flex: "1 1 auto",
                                            minWidth: 0,
                                            pr: 1.5,
                                            pb: 1.5
                                        }}>
                                        <Typography variant="h6" sx={{fontWeight: 700, color: "#2d3a4b"}}>
                                            {account.name}
                                        </Typography>
                                        {/* Status always visible */}
                                        <Typography
                                            variant="body2"
                                            sx={{fontWeight: 600, mb: 0.5}}>
                                            {account.status === "closed" ? "Cassa Chiusa" : "Cassa Aperta"}
                                        </Typography>
                                        {/* Balance (Board full, others masked if restricted) */}
                                        {canViewBalances && (
                                            <Typography variant="body1" sx={{color: "#3e5060"}}>
                                                {names.balance}: <b>{balanceVisible ? `€${balanceValue}` : ' --'}</b>
                                            </Typography>
                                        )}
                                        {/* Last modification (show to Active / Board / granted Aspiranti) */}
                                        {(isActive || isBoard || (isAspirante && canManageCasse)) && account.changed_by && (
                                            <Typography variant="body2" sx={{color: "#607d8b"}}>
                                                {names.changed_by}: {account.changed_by.name}
                                            </Typography>
                                        )}
                                    </CardContent>
                                    {canManageCasse ? (
                                        <CardActions
                                            sx={{
                                                p: 0.5,
                                                pr: 0.5,
                                                flexDirection: 'row',
                                                gap: 0.5,
                                                flexWrap: 'wrap',
                                                maxWidth: 86,
                                                height: '100%',
                                                alignItems: 'center',
                                                alignContent: 'center',
                                                justifyContent: 'flex-end',
                                                alignSelf: 'center'
                                            }}>
                                            <IconButton
                                                color={account.status === "closed" ? "success" : "error"}
                                                size="small"
                                                onClick={() => handleAction(account, account.status === "closed" ? "open" : "close")}
                                                sx={{minWidth: 40}}
                                                disabled={(isActive || (isAspirante && canManageCasse)) && account.name === "SumUp"}
                                                title={account.status === "closed" ? "Apri Cassa" : "Chiudi Cassa"}
                                            >
                                                <PowerSettingsNewIcon/>
                                            </IconButton>
                                            <IconButton
                                                color="primary"
                                                size="small"
                                                onClick={() => openTransactionModal(account)}
                                                sx={{minWidth: 40}}
                                                disabled={!((isBoard || isActive || (isAspirante && canManageCasse)) && account.status === "open")}
                                                title="Deposita/Preleva"
                                            >
                                                <CurrencyExchangeIcon/>
                                            </IconButton>
                                            <IconButton
                                                color="warning"
                                                size="small"
                                                sx={{minWidth: 40}}
                                                disabled={!((isBoard || ((isActive || (isAspirante && canManageCasse)) && account.name !== "SumUp")))}
                                                title="Lista Movimenti (ultime 24h)"
                                                onClick={() => setRecentModalAccount(account)}
                                            >
                                                <ListAltIcon/>
                                            </IconButton>
                                        </CardActions>
                                    ) : null}
                                </Card>
                            )
                        })}
                    </Box>
                </Paper>
            </Box>
            <ConfirmDialog
                open={confirmDialogOpen}
                message={
                    selectedAccount
                        ? `Confermi la presenza ${
                            (canViewBalances
                                && !restrictedAccounts.includes(selectedAccount.name)
                                && selectedAccount?.balance != null)
                                ? `di €${selectedAccount.balance}`
                                : "dell'importo corretto"
                        } nella cassa "${selectedAccount.name}" prima di ${actionType === "open" ? "aprirla" : "chiuderla"}?`
                        : ''
                }
                onConfirm={confirmAction}
                onClose={() => setConfirmDialogOpen(false)}
            />
            <TransactionAdd
                open={transactionModalOpen}
                onClose={handleTransactionModalOpen}
                account={selectedAccount}
            />
            {/* Recent Transactions Modal */}
            {recentModalAccount && (
                <RecentAccountTransactionsModal
                    account={recentModalAccount}
                    onClose={(changed) => {
                        setRecentModalAccount(null);
                        if (changed) fetchAccounts();
                    }}
                />
            )}
            <ReimbursementRequestModal
                open={rimborsoModalOpen}
                onClose={handleReimbursementRequestModalClose}
            />
            {popup && <Popup key={popup.id} message={popup.message} state={popup.state}/>}
        </Box>
    );
}
