import React from 'react';
import {Typography, Box, Alert} from '@mui/material';

const StatusBanner = ({message, state, successText, errorText}) => {
    return (
        <Box
            sx={{
                mt: 2,
                mb: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                p: 2,
                borderRadius: 5,
                boxShadow: 3,
                bgcolor: 'background.paper'
            }}>
            {state === 'success' && (<>
                <Alert severity="success" sx={{width: '100%', mb: 1}}>
                    {message || 'Success!'}
                </Alert>
                {successText && <Typography>{successText}</Typography>}
            </>)}

            {state === 'error' && (<>
                <Alert severity="error" sx={{width: '100%', mb: 1}}>
                    {message || 'An error occurred'}
                </Alert>
                {errorText && <Typography>{errorText}</Typography>}
            </>)}
        </Box>
    );
};

export default StatusBanner;