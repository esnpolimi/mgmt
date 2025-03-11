import React from 'react';
import {Typography, Box, Alert} from '@mui/material';

const StatusBanner = ({status, message, successText, errorText}) => {
    return (
        <Box
            sx={{
                mt: 3,
                mb: 3,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                p: 3,
                borderRadius: 2,
                boxShadow: 1,
                bgcolor: 'background.paper'
            }}
        >
            {status === 'success' && (
                <>
                    <Alert severity="success" sx={{width: '100%', mb: 1}}>
                        {message || 'Success!'}
                    </Alert>
                    {successText && <Typography>{successText}</Typography>}
                </>
            )}

            {status === 'error' && (
                <>
                    <Alert severity="error" sx={{width: '100%', mb: 1}}>
                        {message || 'An error occurred'}
                    </Alert>
                    {errorText && <Typography>{errorText}</Typography>}
                </>
            )}
        </Box>
    );
};

export default StatusBanner;