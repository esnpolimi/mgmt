import React, {useEffect, useState, useMemo} from 'react';
import {Box, Typography, Chip, Button} from '@mui/material';
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


export default function AccountsList() {
    const [data, setData] = useState([]);
    const [isLoading, setLoading] = useState(true);
    const [accountModalOpen, setAccountModalOpen] = useState(false);
    const navigate = useNavigate();
    const [showSuccessPopup, setShowSuccessPopup] = useState(null);

    useEffect(() => {
        refreshAccountsData().then();
    }, []);

    const columns = useMemo(() => [
        {
            accessorKey: 'id',
            header: names.id,
            size: 50,
        },
        {
            accessorKey: 'name',
            header: names.name,
            size: 150,
        },
        {
            accessorKey: 'status',
            header: names.status,
            size: 150,
        },
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
        enableRowPinning: true,
        enableExpandAll: false,
        initialState: {
            showColumnFilters: false,
            showGlobalFilter: true,
            columnPinning: {
                left: ['mrt-row-expand', 'mrt-row-select'],
                right: ['mrt-row-actions'],
            },
            columnVisibility: {
                id: true,
                name: true,
                date: true,
                cost: true
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
            onClick: () => {
                navigate('/treasury/account/' + row.original.id, {state: {account: row.original}});
            },
        }),
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
