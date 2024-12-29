import Sidebar from '../Components/Sidebar'
import {Box, Typography} from '@mui/material'

export default function Treasury() {

    return (
        <Box>
            <Sidebar/>
            <Box sx={{mx: '5%'}}>
                <Box sx={{display: 'flex', alignItems: 'center', marginBottom: '20px'}}>
                    {/* <People sx={{ marginRight: '10px' }} /> */}
                    <Typography variant="h4">Treasury</Typography>
                </Box>
            </Box>
        </Box>
    );
}