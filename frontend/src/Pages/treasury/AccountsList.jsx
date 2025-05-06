import React, {useEffect, useState, useMemo} from 'react';
import {Box, Typography, Button, IconButton, Collapse, Chip} from '@mui/material';
import {MaterialReactTable, MRT_Table, useMaterialReactTable} from 'material-react-table';
import Sidebar from '../../Components/Sidebar.jsx'
import StoreIcon from '@mui/icons-material/Store';
import AccountModal from '../../Components/treasury/AccountModal.jsx';
import {fetchCustom} from "../../api/api";
import {MRT_Localization_IT} from "material-react-table/locales/it";
import {useNavigate} from "react-router-dom";
import {accountDisplayNames as names} from "../../utils/displayAttributes";
import {transactionDisplayNames as tranNames} from "../../utils/displayAttributes";
import Loader from "../../Components/Loader";
import Popup from "../../Components/Popup";
import {extractErrorMessage} from "../../utils/errorHandling";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

export default function AccountsList() {
    const [data, setData] = useState([]);
    const [isLoading, setLoading] = useState(true);
    const [accountModalOpen, setAccountModalOpen] = useState(false);
    const [expandedRow, setExpandedRow] = useState(null); // Track expanded row
    const [transactions, setTransactions] = useState({}); // Store transactions per account
    const navigate = useNavigate();
    const [showSuccessPopup, setShowSuccessPopup] = useState(null);

    useEffect(() => {
        refreshAccountsData().then();
        fetchAllTransactions().then(); // Fetch all transactions on mount
    }, []);

    const refreshAccountsData = async () => {
        setLoading(true);
        try {
            const response = await fetchCustom("GET", '/accounts/');
            if (!response.ok) {
                const errorMessage = await extractErrorMessage(response);
                setShowSuccessPopup({message: `Errore: ${errorMessage}`, state: 'error'});
            } else {
                const json = await response.json();
                setData(json.results);
                console.log("Account List Data: ", json.results);
            }
        } catch (error) {
            setShowSuccessPopup({message: `Errore generale: ${error}`, state: "error"});
        } finally {
            setLoading(false);
        }
    };

    const fetchAllTransactions = async () => {
        try {
            const response = await fetchCustom("GET", `/transactions/`);
            if (response.ok) {
                const json = await response.json();
                setTransactions(json.results);
                console.log("All Transactions:", json.results);
            } else {
                console.error("Failed to fetch transactions.");
            }
        } catch (error) {
            console.error("Error fetching transactions:", error);
        }
    };

    const handleRowClick = (row) => {
        const accountId = row.original.id;
        setExpandedRow(expandedRow === accountId ? null : accountId); // Toggle row expansion
    };

    const columns = useMemo(() => [
        {accessorKey: 'id', header: names.id, size: 50},
        {accessorKey: 'name', header: names.name, size: 150},
        {accessorKey: 'changed_by', header: names.changed_by, size: 150},
        {accessorKey: 'balance', header: names.balance, size: 100,
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
                        <Chip label="Stato ignoto" color="warning"/>
                    )}
                </Box>
            ),
        },
    ], []);

    const transactionColumns = useMemo(() => [
        {accessorKey: 'created_at', header: tranNames.date, size: 150},
        {accessorKey: 'subscription', header: tranNames.subscription, size: 150},
        {accessorKey: 'executor', header: tranNames.executor, size: 150},
        {accessorKey: 'account', header: tranNames.account, size: 100},
        {accessorKey: 'amount', header: tranNames.amount, size: 100},
    ], []);

    const table = useMaterialReactTable({
        columns,
        data,
        enableStickyHeader: true,
        enableStickyFooter: true,
        enableColumnFilterModes: true,
        enableColumnOrdering: true,
        enableGrouping: true,
        enableColumnPinning: true,
        enableFacetedValues: true,
        enableRowActions: false,
        enableRowSelection: false,
        enableRowPinning: false,
        enableExpandAll: false,
        initialState: {
            showColumnFilters: false,
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
        paginationDisplayMode: 'pages',
        positionToolbarAlertBanner: 'bottom',
        muiSearchTextFieldProps: {
            size: 'small',
            variant: 'outlined',
        },
        muiPaginationProps: {
            color: 'secondary',
            rowsPerPageOptions: [10, 20, 30],
            shape: 'rounded',
            variant: 'outlined',
        },
        localization: MRT_Localization_IT,
        muiTableBodyRowProps: ({row}) => ({
            onClick: () => handleRowClick(row),
            sx: {cursor: 'pointer'},
        }),
        renderDetailPanel: ({row}) => {
            /*const accountTransactions = transactions.filter((transaction) => transaction.account === row.original.id);

            const transactionTable = useMaterialReactTable({
                columns: transactionColumns,
                data: accountTransactions,
                enablePagination: false,
                enableSorting: true,
                enableColumnFilters: false,
                enableGlobalFilter: false,
                enableRowSelection: false,
                enableRowActions: false,
                muiTableContainerProps: {sx: {maxHeight: 300}},
                localization: MRT_Localization_IT,
                renderTopToolbarCustomActions: () => {
                    return (
                        <Typography variant="h6" sx={{ml: 2, mt: 2}}>Transazioni Cassa {row.original.name}</Typography>
                    );
                }
            });

            return (<MaterialReactTable table={transactionTable}/>);*/
        },
        renderTopToolbarCustomActions: () => {
            return (
                <Box sx={{display: 'flex', flexDirection: 'row'}}>
                    <Button variant='contained' onClick={() => setAccountModalOpen(true)} sx={{width: '150px'}}>
                        Crea Nuova Cassa
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
        setAccountModalOpen(false);
    };

    return (
        <Box>
            <Sidebar/>
            {accountModalOpen && <AccountModal
                open={accountModalOpen}
                onClose={handleCloseAccountModal}
                isEdit={false}
            />}
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
