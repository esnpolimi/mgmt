import {Box, Typography, Paper, Button, Grid} from '@mui/material';
import Sidebar from '../../Components/Sidebar';
import AccountsDash from '../../Components/treasury/AccountsDash';
import ReceiptsDash from '../../Components/treasury/TransactionsDash';
import ReimbursementRequestsDash from '../../Components/treasury/ReimbursementRequestsDash';
import {useNavigate} from 'react-router-dom';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';

export default function TreasuryDashboard() {
    const navigate = useNavigate();

    return (
        <Box>
            <Sidebar/>
            <Box sx={{mx: '5%', mt: 0}}>
                <Typography variant="h4" sx={{mb: 3}}>
                    <AccountBalanceIcon sx={{mr: 2}}/>
                    Dashboard Tesoreria
                </Typography>
                <Grid container spacing={3}>
                    <Grid size={{xs: 12, md: 4}}>
                        <Paper elevation={3} sx={{p: 2}}>
                            <AccountsDash limit={5}/>
                            <Box sx={{display: 'flex', justifyContent: 'flex-end', mt: 2}}>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={() => navigate('/treasury/accounts_list/')}>
                                    Gestisci Casse
                                </Button>
                            </Box>
                        </Paper>
                    </Grid>
                    <Grid size={{xs: 12, md: 8}}>
                        <Paper elevation={3} sx={{p: 2, mb: 3}}>
                            <ReceiptsDash limit={3}/>
                            <Box sx={{display: 'flex', justifyContent: 'flex-end', mt: 2}}>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={() => navigate('/treasury/transactions_list/')}>
                                    Gestisci Movimenti
                                </Button>
                            </Box>
                        </Paper>
                        <Paper elevation={3} sx={{p: 2}}>
                            <ReimbursementRequestsDash limit={3}/>
                            <Box sx={{display: 'flex', justifyContent: 'flex-end', mt: 2}}>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={() => navigate('/treasury/reimbursement_requests_list/')}>
                                    Gestisci Rimborsi
                                </Button>
                            </Box>
                        </Paper>
                    </Grid>
                </Grid>
            </Box>
        </Box>
    );
}