import {useEffect, useState, useRef} from "react";
import Sidebar from "../Components/Sidebar";
import {Box, Typography, Card, CardContent, CardActions, Button, Collapse, IconButton, Paper} from "@mui/material";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ConfirmDialog from "../Components/ConfirmDialog";
import {defaultErrorHandler, fetchCustom} from "../api/api";
import {useAuth} from "../Context/AuthContext";
import logo from '../assets/esnpolimi-logo.png';
import Popup from "../Components/Popup";
import {accountDisplayNames as names} from "../utils/displayAttributes";
import TransactionAdd from "../Components/treasury/TransactionAdd";
import RefreshIcon from '@mui/icons-material/Refresh';
import ReimbursementRequestModal from "../Components/treasury/ReimbursementRequestModal";


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
    const [casseOpen, setCasseOpen] = useState(false);
    const [popup, setPopup] = useState(null);
    const [transactionModalOpen, setTransactionModalOpen] = useState(false);
    const [casseLoading, setCasseLoading] = useState(false);
    const accountsDetails = user?.permissions.includes("change_account");
    const casseRef = useRef(null);
    const [rimborsoModalOpen, setRimborsoModalOpen] = useState(false);

    const staticLinks = [
        {
            topic: "LINK UTILI",
            links: [
                {
                    name: "FOGLIO TURNI UFFICIO",
                    description: "",
                    url: "https://docs.google.com/spreadsheets/d/1Bi_jw4_MgAPV3R_Cu-eCRlexbL23xJL63uey1rmY-P0/edit?gid=2036311463#gid=2036311463",
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
                setPopup({message: `Cassa ${actionType === "open" ? "aperta" : "chiusa"} con successo!`, state: "success"});
            },
            onError: (responseOrError) => defaultErrorHandler(responseOrError, setPopup),
            onFinally: () => setConfirmDialogOpen(false)
        });
    };

    const handleCasseToggle = () => {
        setCasseOpen(o => {
            const next = !o;
            if (!o && casseRef.current) {
                setTimeout(() => {
                    casseRef.current.scrollIntoView({behavior: "smooth", block: "start"});
                }, 150); // Wait for collapse animation to start
            }
            return next;
        });
    };

    const handleTransactionModalOpen = (success) => {
        setTransactionModalOpen(false);
        if (success) {
            setPopup({message: "Transazione registrata con successo!", state: "success"});
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
        if (success) setPopup({message: "Richiesta di rimborso inviata con successo!", state: "success"});
    };

    return (
        <Box sx={{
            minHeight: "100vh",
            background: "#f9f9fb",
            pb: 2,
        }}>
            {/* Sidebar */}
            <Sidebar/>
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
                    Ciao, {user ? user.profile.name : "Sir"}!
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
                           borderRadius: 6,
                           background: "#fff",
                           boxShadow: "0 8px 32px rgba(60,80,120,0.08)",
                           border: "1px solid #e3e8f0",
                           mt: 2,
                           width: "100%",
                       }}>
                    <Box sx={{display: "flex", alignItems: "center", cursor: "pointer"}} onClick={handleCasseToggle}>
                        <Typography variant="h5" sx={{flexGrow: 1, fontWeight: 600}}>Casse</Typography>
                        <IconButton>
                            {casseOpen ? <ExpandLessIcon/> : <ExpandMoreIcon/>}
                        </IconButton>
                    </Box>
                    <Collapse in={casseOpen} timeout="auto" unmountOnExit>
                        <Box sx={{display: "flex", alignItems: "center", justifyContent: "flex-end", mt: 1, mb: 1}}>
                            <IconButton variant="outlined"
                                        color="primary"
                                        size="small"
                                        onClick={fetchAccounts}
                                        disabled={casseLoading}
                                        sx={{mr: 2}}>
                                <RefreshIcon/>
                            </IconButton>
                        </Box>
                        <Box
                            sx={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 2,
                                mt: 2,
                                justifyContent: "center",
                            }}>
                            {accounts.map((account) => (
                                <Card
                                    key={account.id}
                                    sx={{
                                        flex: "1 1 320px",
                                        minWidth: 320,
                                        maxWidth: 400,
                                        display: "flex",
                                        alignItems: "center",
                                        boxShadow: 4,
                                        borderRadius: 2,
                                        m: 1,
                                    }}>
                                    <CardContent sx={{flex: 1}}>
                                        <Typography variant="h6" sx={{fontWeight: 700, color: "#2d3a4b"}}>
                                            {account.name}
                                        </Typography>

                                        {accountsDetails && (<>
                                            <Typography variant="body1" sx={{color: "#3e5060"}}>
                                                {names.balance}: <b>€{account.balance}</b>
                                            </Typography>
                                            <Typography variant="body2" sx={{color: "#607d8b"}}>
                                                {names.changed_by}: {account.changed_by.name || "N/A"}
                                            </Typography>
                                        </>)}
                                    </CardContent>

                                    {accountsDetails ? (
                                        <CardActions sx={{pr: 2, flexDirection: 'column', alignItems: 'flex-end'}}>
                                            {account.status === "closed" && (
                                                <Button
                                                    variant="contained"
                                                    color="success"
                                                    onClick={() => handleAction(account, "open")}
                                                    sx={{minWidth: 120, fontWeight: 600}}>
                                                    Apri Cassa
                                                </Button>
                                            )}
                                            {account.status === "open" && (<>
                                                    <Button
                                                        variant="contained"
                                                        color="error"
                                                        onClick={() => handleAction(account, "close")}
                                                        sx={{minWidth: 120, fontWeight: 600, mb: 1}}>
                                                        Chiudi Cassa
                                                    </Button>
                                                    <Button
                                                        variant="contained"
                                                        color="primary"
                                                        onClick={() => openTransactionModal(account)}
                                                        sx={{minWidth: 120, fontWeight: 600}}>
                                                        Deposita/Preleva
                                                    </Button>
                                                </>
                                            )}
                                        </CardActions>
                                    ) : (
                                        <Typography
                                            variant="h7"
                                            style={{
                                                color: account.status === "closed" ? 'red' : 'green',
                                                fontWeight: 'bold',
                                                padding: '20px'
                                            }}>
                                            {account.status === "closed" ? "Cassa Chiusa" : "Cassa Aperta"}
                                        </Typography>)}
                                </Card>
                            ))}
                        </Box>
                    </Collapse>
                </Paper>
            </Box>
            <ConfirmDialog
                open={confirmDialogOpen}
                message={`Confermi la presenza di €${selectedAccount?.balance} nella cassa "${selectedAccount?.name}" prima di ${actionType === "open" ? "aprirla" : "chiuderla"}?`}
                onConfirm={confirmAction}
                onClose={() => setConfirmDialogOpen(false)}
            />
            <TransactionAdd
                open={transactionModalOpen}
                onClose={handleTransactionModalOpen}
                account={selectedAccount}
            />
            <ReimbursementRequestModal
                open={rimborsoModalOpen}
                onClose={handleReimbursementRequestModalClose}
            />
            {popup && <Popup message={popup.message} state={popup.state}/>}
        </Box>
    );
}