import {useState} from 'react';
import {Box, Typography, Paper, Button, Grid} from '@mui/material';
import Sidebar from '../../Components/Sidebar';
import AccountsDash from '../../Components/treasury/AccountsDash';
import ReceiptsDash from '../../Components/treasury/TransactionsDash';
import ReimbursementRequestsDash from '../../Components/treasury/ReimbursementRequestsDash';
import EventsDash from '../../Components/treasury/EventsDash';
import {useNavigate} from 'react-router-dom';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import {fetchCustom, defaultErrorHandler} from '../../api/api';
import Popup from '../../Components/Popup';

export default function TreasuryDashboard() {
    const navigate = useNavigate();
    const [popup, setPopup] = useState(null);
    const [isGeneratingAccounts, setGeneratingAccounts] = useState(false);
    const [isGeneratingTransactions, setGeneratingTransactions] = useState(false);

    const handleGenerateReport = (type) => {
        const isAccounts = type === 'accounts';
        const setLoading = isAccounts ? setGeneratingAccounts : setGeneratingTransactions;
        const label = isAccounts ? 'Casse' : 'Transazioni';

        setLoading(true);
        fetchCustom('POST', `/reports/${type}/?download=true`, {
            onSuccess: async (response) => {
                const contentType = response.headers.get('content-type') || '';
                if (!contentType.includes('application/vnd.openxmlformats-officedocument')) {
                    setPopup({message: 'Tipo di file inatteso durante la generazione.', state: 'error', id: Date.now()});
                    return;
                }
                const contentDisposition = response.headers.get('content-disposition') || '';
                const filename = contentDisposition.match(/filename="([^"]+)"/i)?.[1] || `Report_${type}.xlsx`;
                const downloadUrl = URL.createObjectURL(await response.blob());
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
                setPopup({
                    message: `Report ${label} generato e scaricato (${filename}).`,
                    state: 'success',
                    id: Date.now()
                });
            },
            onError: (err) => {
                defaultErrorHandler(err, setPopup);
            },
            onFinally: () => setLoading(false)
        });
    };

    return (
        <Box>
            <Sidebar/>
            <Box sx={{mx: '5%', mt: 0}}>
                <Typography variant="h4" sx={{mb: 3}}>
                    <AccountBalanceIcon sx={{mr: 2}}/>
                    Dashboard Tesoreria
                </Typography>
                <Box sx={{display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap'}}>
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<FileDownloadIcon/>}
                        disabled={isGeneratingAccounts}
                        onClick={() => handleGenerateReport('accounts')}>
                        {isGeneratingAccounts ? 'Generazione Casse...' : 'Genera Report Casse'}
                    </Button>
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<FileDownloadIcon/>}
                        disabled={isGeneratingTransactions}
                        onClick={() => handleGenerateReport('transactions')}>
                        {isGeneratingTransactions ? 'Generazione Transazioni...' : 'Genera Report Transazioni'}
                    </Button>
                </Box>
                <Grid container spacing={3}>
                    <Grid size={{xs: 12, md: 4}}>
                        <Paper elevation={3} sx={{p: 2}}>
                            <AccountsDash/>
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
                    <Grid size={{xs: 12, md: 8}} sx={{mb: 5}}>
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
                        <Paper elevation={3} sx={{p: 2, mb: 3}}>
                            <EventsDash pageSize={3}/>
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
            {popup && <Popup key={popup.id} message={popup.message} state={popup.state}/>}
        </Box>
    );
}