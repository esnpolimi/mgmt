import React, {useState} from 'react';
import {CircularProgress, IconButton, Box} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';


const EditButton = ({onEdit, onCancel, onSave, saving}) => {
        const [loading, setLoading] = useState(false);
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

        const handleSaveClick = async () => {
            setLoading(true);
            try {
                if (onSave) await onSave();
            } finally {
                setLoading(false);
                setIsEditing(false);
            }
        };

        return (
            <div>
                {isEditing ? (
                    <Box sx={{display: 'inline-flex'}}>
                        <IconButton onClick={handleCancelClick} aria-label="Cancel">
                            <CancelIcon/>
                        </IconButton>
                        {saving ? (
                            <IconButton>
                                <CircularProgress size='1rem'/>
                            </IconButton>
                        ) : (loading ? (
                                <IconButton>
                                    <CircularProgress size='1rem'/>
                                </IconButton>
                            ) : (
                                <IconButton onClick={handleSaveClick} aria-label="Save" sx={{color: '#0288d1'}}>
                                    <SaveIcon/>
                                </IconButton>
                            )
                        )}
                    </Box>
                ) : (
                    <IconButton onClick={handleEditClick} aria-label="Edit">
                        <EditIcon/>
                    </IconButton>
                )}
            </div>
        );
    }
;

export default EditButton;
