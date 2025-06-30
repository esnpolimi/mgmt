import {useEffect, useState, useMemo} from 'react';
import {Box, Typography, Button, IconButton, Chip} from '@mui/material';
import {MaterialReactTable, useMaterialReactTable} from 'material-react-table';
import Sidebar from '../../Components/Sidebar.jsx'
import StoreIcon from '@mui/icons-material/Store';
import AccountModal from '../../Components/treasury/AccountModal.jsx';
import {fetchCustom} from "../../api/api";
import {MRT_Localization_IT} from "material-react-table/locales/it";
import {useNavigate} from "react-router-dom";
import {accountDisplayNames as names} from "../../utils/displayAttributes";
import Loader from "../../Components/Loader";
import Popup from "../../Components/Popup";
import {extractErrorMessage} from "../../utils/errorHandling";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import TransactionAdd from "../../Components/treasury/TransactionAdd";
import EditIcon from '@mui/icons-material/Edit';
import * as Sentry from "@sentry/react";

export default function AccountsList() {
    const [data, setData] = useState([]);
    const [isLoading, setLoading] = useState(true);
    const [accountModalOpen, setAccountModalOpen] = useState(false);
    const navigate = useNavigate();
    const [showSuccessPopup, setShowSuccessPopup] = useState(null);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [transactionModalOpen, setTransactionModalOpen] = useState(false);

    useEffect(() => {
        refreshAccountsData().then();
    }, []);

    const refreshAccountsData = async () => {
        setLoading(true);
        try {
            const response = await fetchCustom("GET", '/accounts/');
            const json = await response.json();
            if (!response.ok) {
                const errorMessage = await extractErrorMessage(json, response.status);
                setShowSuccessPopup({message: `Errore: ${errorMessage}`, state: 'error'});
            } else {
                setData(json.results);
                console.log("Account List Data: ", json.results);
            }
        } catch (error) {
            Sentry.captureException(error);
            setShowSuccessPopup({message: `Errore generale: ${error}`, state: "error"});
        } finally {
            setLoading(false);
        }
    };

    const columns = useMemo(() => [
        {accessorKey: 'id', header: names.id, size: 50},
        {accessorKey: 'name', header: names.name, size: 150},
        {accessorKey: 'changed_by.name', header: names.changed_by, size: 150},
        {
            accessorKey: 'balance', header: names.balance, size: 100,
            Cell: ({cell}) => (
                <Box>
                    {cell.getValue() !== null ? (
                        <Chip label={`€${cell.getValue()}`} color="primary"/>) : (
                        <Chip label="N/A" color="warning"/>)}
                </Box>
            ),
        },
        {
            accessorKey: 'status', header: names.status, size: 150,
            Cell: ({cell}) => (
                <Box sx={{}}>
                    {cell.getValue() !== null ? (
                        <Chip
                            label={cell.getValue() === 'open' ? "Aperta" : "Chiusa"}
                            color={cell.getValue() === 'open' ? "success" : "error"}/>
                    ) : (
                        <Chip label="N/A" color="warning"/>
                    )}
                </Box>
            ),
        },
        {
            accessorKey: 'visible_to_groups', header: names.visible_to_groups, size: 150,
            Cell: ({cell}) => (
                <Box sx={{}}>
                    {cell.getValue() !== null ? (
                        cell.getValue().map((group) => (
                            <Chip key={group.id} label={group.name} color="grey" sx={{mr: 1}}/>
                        ))
                    ) : (
                        <Chip label="N/A" color="warning"/>
                    )}
                </Box>
            ),
        },
        {
            header: 'Azioni',
            size: 150,
            Cell: ({row}) => (
                <Box sx={{display: 'flex', gap: 1}}>
                    <IconButton
                        color="primary"
                        onClick={() => {
                            setSelectedAccount(row.original);
                            setAccountModalOpen(true);
                        }}>
                        <EditIcon/>
                    </IconButton>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={() => {
                            setSelectedAccount(row.original);
                            setTransactionModalOpen(true);
                        }}>
                        Deposita/Preleva
                    </Button>
                </Box>
            ),
        },
    ], []);

    const table = useMaterialReactTable({
        columns,
        data,
        enablePagination: false,
        enableStickyHeader: true,
        enableStickyFooter: true,
        enableColumnFilters: false,
        enableColumnOrdering: true,
        enableGrouping: true,
        enableColumnPinning: false,
        enableFacetedValues: true,
        enableRowActions: false,
        enableRowSelection: false,
        enableRowPinning: false,
        enableExpandAll: false,
        initialState: {
            showGlobalFilter: true,
            columnPinning: {
                left: ['mrt-row-expand', 'mrt-row-select'],
                right: ['mrt-row-actions'],
            },
            columnVisibility: {
                id: false,
                name: true,
                changed_by: true,
                status: true,
                balance: true
            },
        },
        positionToolbarAlertBanner: 'bottom',
        localization: MRT_Localization_IT,
        muiTableBodyRowProps: () => ({
            sx: {cursor: 'default'},
        }),
        renderTopToolbarCustomActions: () => {
            return (
                <Box sx={{display: 'flex', flexDirection: 'row'}}>
                    <Button variant='contained' onClick={() => setAccountModalOpen(true)} sx={{width: '150px'}}>
                        Nuova Cassa
                    </Button>
                </Box>
            );
        },
    });

    const handleCloseAccountModal = async (success) => {
        if (success) {
            setShowSuccessPopup({message: "Cassa creata con successo!", state: "success"});
            await refreshAccountsData();
        }
        setSelectedAccount(null);
        setAccountModalOpen(false);
    };

    return (
        <Box>
            <Sidebar/>
            {accountModalOpen && <AccountModal
                open={accountModalOpen}
                onClose={handleCloseAccountModal}
                account={selectedAccount}
            />}
            <TransactionAdd
                open={transactionModalOpen}
                onClose={() => setTransactionModalOpen(false)}
                account={selectedAccount}
                onSuccess={(message, state) => setShowSuccessPopup({message, state: state || 'success'})}
            />
            <Box sx={{mx: '5%'}}>
                {isLoading ? <Loader/> : (<>
                        <Box sx={{display: 'flex', alignItems: 'center', marginBottom: '20px'}}>
                            <IconButton onClick={() => {
                                navigate(-1);
                            }} sx={{mr: 2}}><ArrowBackIcon/></IconButton>
                            <StoreIcon sx={{marginRight: '10px'}}/>
                            <Typography variant="h4">Lista Casse</Typography>
                        </Box>
                        <MaterialReactTable table={table}/>
                    </>
                )}
            </Box>
            {showSuccessPopup && <Popup message={showSuccessPopup.message} state={showSuccessPopup.state}/>}
        </Box>
    );
}
