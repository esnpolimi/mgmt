import React, {useEffect, useState, useMemo} from 'react';
import {Box, Typography, Paper, Button} from '@mui/material';
import Grid from "@mui/material/Grid2";
import Sidebar from '../../Components/Sidebar';
import {MRT_Table, useMaterialReactTable} from 'material-react-table';
import {accountDisplayNames as names} from '../../utils/displayAttributes';
import {fetchCustom} from '../../api/api';
import {MRT_Localization_IT} from 'material-react-table/locales/it';
import Loader from '../../Components/Loader';
import {useNavigate} from 'react-router-dom';


export default function TreasuryDashboard() {
    const [data, setData] = useState([]);
    const [isLoading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const response = await fetchCustom("GET", '/accounts/');
                if (response.ok) {
                    const json = await response.json();
                    setData(json.results);
                }
            } catch (e) {
                // Optionally handle error
            } finally {
                setLoading(false);
            }
        };
        fetchData().then();
    }, []);

    const columns = useMemo(() => [
        {accessorKey: 'id', header: names.id, size: 50},
        {accessorKey: 'name', header: names.name, size: 150},
        {accessorKey: 'status', header: names.status, size: 150},
    ], []);

    const table = useMaterialReactTable({
        columns,
        data: data.slice(0, 5),
        enableKeyboardShortcuts: false,
        enableColumnActions: false,
        enableColumnFilters: false,
        enablePagination: false,
        enableSorting: false,
        initialState: {showColumnFilters: false, showGlobalFilter: false},
        paginationDisplayMode: 'default',
        muiTableBodyRowProps: {hover: false},
        localization: MRT_Localization_IT,
    });

    return (
        <Box>
            <Sidebar/>
            <Box sx={{mx: '5%', mt: 4}}>
                <Typography variant="h4" sx={{mb: 3}}>Treasury Dashboard</Typography>
                <Grid container spacing={3}>
                    <Grid size={{xs: 12, md: 4}}>
                        <Paper elevation={3} sx={{p: 2}}>
                            <Typography variant="h6" sx={{mb: 2}}>Accounts Overview</Typography>
                            {isLoading ? (
                                <Loader/>) : (data.length > 0 ? (<MRT_Table table={table}/>) : (<Typography>No accounts found</Typography>)
                            )}
                            <Box sx={{display: 'flex', justifyContent: 'flex-end', mt: 2}}>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={() => navigate('/treasury/accounts_list/')}
                                >
                                    View All Accounts
                                </Button>
                            </Box>
                        </Paper>
                    </Grid>
                </Grid>
            </Box>
        </Box>
    );
}