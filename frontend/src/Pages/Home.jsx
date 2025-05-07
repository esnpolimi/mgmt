import React, {useEffect, useState} from "react";
import Sidebar from "../Components/Sidebar";
import {Box, Typography, Card, CardContent, CardActions, Button, Collapse, IconButton, Stack, Paper} from "@mui/material";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ConfirmDialog from "../Components/ConfirmDialog";
import {fetchCustom} from "../api/api";
import {useAuth} from "../Context/AuthContext";
import logo from '../assets/esnpolimi-logo.png';
import Popup from "../Components/Popup";
import {accountDisplayNames as names} from "../utils/displayAttributes";
import {extractErrorMessage} from "../utils/errorHandling";

const style = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "top",
    mt: 4,
    minHeight: "100vh",
};

export default function Home() {
    const {user} = useAuth(); // Access logged-in user info
    const [accounts, setAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [actionType, setActionType] = useState(""); // "open" or "close"
    const [casseOpen, setCasseOpen] = useState(false);
    const [showSuccessPopup, setShowSuccessPopup] = useState(null);
    const accountsDetails = user?.permissions.includes("change_account");

    useEffect(() => {
        fetchAccounts().then();
    }, [user]);

    const fetchAccounts = async () => {
        try {
            const response = await fetchCustom("GET", "/accounts/");
            if (response.ok) {
                const json = await response.json();
                setAccounts(json.results);
            } else {
                const errorMessage = await extractErrorMessage(response);
                setShowSuccessPopup({message: `Errore durante il recupero delle casse: ${errorMessage}`, state: "error"});
            }
        } catch (error) {
            setShowSuccessPopup({message: `Errore generale: ${error}`, state: "error"});
        }
    };

    const handleAction = (account, type) => {
        setSelectedAccount(account);
        setActionType(type);
        setConfirmDialogOpen(true);
    };

    const confirmAction = async () => {
        try {
            const response = await fetchCustom("PATCH", `/account/${selectedAccount.id}/`, {
                status: actionType === "open" ? "open" : "closed",
            });
            if (response.ok) {
                console.log(`Account ${actionType}ed successfully.`);
                fetchAccounts().then(); // Refresh account data
                setShowSuccessPopup({message: `Cassa ${actionType === "open" ? "aperta" : "chiusa"} con successo!`, state: "success"});
            } else {
                console.error(`Failed to ${actionType} account.`);
                setShowSuccessPopup({message: `Errore account: ${response.statusText}`, state: "error"});
            }
        } catch (error) {
            console.error(`Error ${actionType}ing account:`, error);
            setShowSuccessPopup({message: `Errore generale: ${error}`, state: "error"});
        } finally {
            setConfirmDialogOpen(false);
        }
    };

    return (
        <Box>
            <Sidebar/>
            <Box sx={{width: "100%", maxWidth: "90%", mx: "auto", mt: 0}}>
                <Paper elevation={3} sx={{p: 2, mb: 0, borderRadius: 5}}>
                    <Box sx={{display: "flex", alignItems: "center", cursor: "pointer"}} onClick={() => setCasseOpen(o => !o)}>
                        <Typography variant="h5" sx={{flexGrow: 1, fontWeight: 600}}>Casse</Typography>
                        <IconButton>
                            {casseOpen ? <ExpandLessIcon/> : <ExpandMoreIcon/>}
                        </IconButton>
                    </Box>
                    <Collapse in={casseOpen} timeout="auto" unmountOnExit>
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
                                            {account.status === "open" && (
                                                <Button
                                                    variant="contained"
                                                    color="error"
                                                    onClick={() => handleAction(account, "close")}
                                                    sx={{minWidth: 120, fontWeight: 600}}>
                                                    Chiudi Cassa
                                                </Button>
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
            <Box sx={style}>
                <Typography variant="h3" gutterBottom>
                    Sistema di Gestione
                </Typography>
                <img src={logo || ''} alt="ESN Polimi Logo" style={{height: "25vh", marginTop: "2px"}}/>
                <h1>Benvenuto, {user ? user.profile.name : "Sir"}!</h1>
            </Box>
            <ConfirmDialog
                open={confirmDialogOpen}
                message={`Confermi la presenza di €${selectedAccount?.balance} nella cassa "${selectedAccount?.name}" prima di ${actionType === "open" ? "aprirla" : "chiuderla"}?`}
                onConfirm={confirmAction}
                onClose={() => setConfirmDialogOpen(false)}
            />
            {showSuccessPopup && <Popup message={showSuccessPopup.message} state={showSuccessPopup.state}/>}
        </Box>
    );
}