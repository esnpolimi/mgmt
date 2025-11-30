import React from 'react';
import {Button, Typography, Box} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';

export default function ReceiptFileUpload({
    file,
    onFileChange,
    label = "Carica file",
    removable = true,
    helperText,
    accept = "application/pdf,image/*",
    dense = false
}) {
    const handleChange = (e) => {
        const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
        onFileChange(f);
    };
    return (
        <Box sx={{mb: 1.5}}>
            <Button
                size={dense ? "small" : "medium"}
                startIcon={<UploadFileIcon/>}
                variant={file ? "outlined" : "contained"}
                component="label"
                fullWidth
                sx={{
                    mt: 1,
                    mb: 1,
                    justifyContent: 'flex-start',
                    textTransform: 'none'
                }}>
                {file ? `File: ${file.name}` : label}
                <input
                    type="file"
                    hidden
                    accept={accept}
                    onChange={handleChange}
                />
            </Button>
            {helperText && (
                <Typography variant="caption" color="text.secondary" sx={{display: 'block', ml: 0.5, mb: 0.5}}>
                    {helperText}
                </Typography>
            )}
            {file && removable && (
                <Button
                    size="small"
                    variant="text"
                    color="error"
                    fullWidth
                    onClick={() => onFileChange(null)}>
                    Remove File
                </Button>
            )}
        </Box>
    );
}
