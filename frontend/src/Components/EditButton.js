import React, { useState } from 'react';
import { CircularProgress, IconButton, Box} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';

const EditButton = ({ onEdit, onCancel, onSave, saving}) => {

    const [isEditing, setIsEditing] = useState(false);

    const handleEditClick = () => {
        setIsEditing(true);
        if (onEdit) onEdit();
    };

    const handleCancelClick = () => {
        if (!saving) {
            setIsEditing(false);
            if (onCancel) onCancel();
        }
    };

    const handleSaveClick = () => {
        if (onSave) {
            onSave()
        }
    };

    return (
        <div>
            {isEditing ? (
                <Box sx={{display: 'inline-flex'}}>
                    <IconButton onClick={handleCancelClick} aria-label="Cancel">
                        <CancelIcon />
                    </IconButton>
                    {saving ? (
                        <IconButton>
                            <CircularProgress size='1rem' />
                        </IconButton>
                    ) : (
                        <IconButton onClick={handleSaveClick} aria-label="Save">
                            <SaveIcon />
                        </IconButton>
                    )}
                </Box>
            ) : (
                <IconButton onClick={handleEditClick} aria-label="Edit">
                    <EditIcon />
                </IconButton>
            )}
        </div>
    );
};

export default EditButton;
