import React from 'react';
import {Button} from '@mui/material';

export default function ReceiptFileUpload({file, onFileChange, label = "Carica file", removable = true}) {
    const handleChange = (e) => {
        const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
        onFileChange(f);
    };
    return (
        <>
            <Button
                variant={file ? "outlined" : "text"}
                component="label"
                fullWidth
                sx={{mb: file ? 1 : 0}}>
                {file ? `File: ${file.name}` : label}
                <input
                    type="file"
                    hidden
                    accept="application/pdf,image/*"
                    onChange={handleChange}
                />
            </Button>
            {file && removable && (
                <Button
                    variant="text"
                    color="error"
                    fullWidth
                    onClick={() => onFileChange(null)}>
                    Rimuovi file
                </Button>
            )}
        </>
    );
}

