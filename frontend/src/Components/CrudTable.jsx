import {useState, useMemo, useEffect} from 'react';
import {useMaterialReactTable, MaterialReactTable} from 'material-react-table';
import {Box, IconButton, Tooltip} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import {MRT_Localization_IT} from 'material-react-table/locales/it';
import Popup from './Popup'; // Add this line


/*  The save function must receive as parameter the row object. 
    It must return true if creating was successful, false otherwise.
    Same goes for the create function.
*/

export default function CrudTable({cols, initialData, title, onSave, onCreate, canCreate, canDelete, canEdit}) {
    const [popupMessage, setPopupMessage] = useState(null); // Add this line
    const columns = useMemo(() => cols);
    const [data, setData] = useState([])
    const canEditText = <span style={{color: 'green'}}>(Hai i permessi per eseguire modifiche)</span>;
    const cannotEditText = <span style={{color: 'red'}}>(Non hai i permessi per eseguire modifiche)</span>;
    const editText = canEdit ? canEditText : cannotEditText;

    useEffect(() => {
        setData(initialData);
    }, [initialData]);

    const table = useMaterialReactTable({
        columns,
        data: data,
        enableEditing: canEdit,
        editDisplayMode: 'row',
        createDisplayMode: 'row',
        enableColumnFilters: false,
        enableGlobalFilter: false,
        enableSorting: false,
        enableFullScreenToggle: false,
        enableColumnOrdering: false,
        enableColumnActions: false,
        enableDensityToggle: false,
        enableHiding: false,
        enablePagination: false,
        localization: MRT_Localization_IT,
        onCreatingRowCancel:
            () => {
            },
        onCreatingRowSave:
            async ({values, table}) => {
                let new_doc = await onCreate(values);
                if (new_doc) {
                    setData([...data, new_doc]);
                    table.setCreatingRow(false);
                }
            },
        onEditingRowSave:
            async ({row, values}) => {
                if (await onSave(row.original, values)) {
                    const updatedData = data.map((item, index) =>
                        index === row.index ? {...row.original, ...values} : item
                    );
                    setData(updatedData);
                    console.log(updatedData);
                    table.setEditingRow(null);
                    setPopupMessage({message: 'Save successful!', state: 'success'}); // Add this line
                } else {
                    setPopupMessage({message: 'Save failed!', state: 'error'}); // Add this line
                }
            },
        onEditingRowCancel:
            () => {
            },
        getRowId:
            (row) => row.id,
        renderRowActions:
            ({row, table}) => {
                return (
                    <Box sx={{display: 'flex', gap: '1rem'}}>
                        <Tooltip title="Modifica">
                            <IconButton onClick={() => table.setEditingRow(row)}>
                                <EditIcon/>
                            </IconButton>
                        </Tooltip>
                        {canDelete && (
                            <Tooltip title="Delete">
                                <IconButton onClick={() => {

                                }}>
                                    <DeleteIcon/>
                                </IconButton>
                            </Tooltip>
                        )}
                        {popupMessage && <Popup message={popupMessage.message} state={popupMessage.state} />}
                    </Box>
                );
            },

        renderTopToolbarCustomActions:
            ({table}) => {
                return (
                    <Box sx={{display: 'flex', flexDirection: 'row'}}>
                        {canCreate ? (<IconButton onClick={() => {
                            table.setCreatingRow(true);
                        }}>
                            <AddCircleOutlineIcon/>
                        </IconButton>) : (<></>)}
                        <Box sx={{ml: '20px'}}>
                            <h3>{title}</h3>
                            <h5>{editText}</h5>
                        </Box>
                    </Box>
                );
            },
    })

    return (<MaterialReactTable table={table}/>);
};