import React, {useState, useMemo, useEffect} from 'react';
import {useMaterialReactTable, MaterialReactTable} from 'material-react-table';
import {Box, Button, IconButton, Tooltip} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import {MRT_Localization_IT} from 'material-react-table/locales/it';

/*  The save function must receive as parameter the row object. 
    It must return true if creating was successful, false otherwise.
    Same goes for the create function.
*/

export default function CrudTable({cols, initialData, title, onSave, onDelete, onCreate, createText, canCreate, canDelete, canEdit, sortColumn}) {
    const columns = useMemo(() => cols, [cols]);
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
        enableSorting: sortColumn != null,
        enableFullScreenToggle: false,
        enableColumnOrdering: false,
        enableColumnActions: false,
        enableDensityToggle: false,
        enableHiding: false,
        enablePagination: false,
        localization: MRT_Localization_IT,
        initialState: {
            sorting: [{id: sortColumn, desc: true}],
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
                }
            },
        getRowId: (row) => row.id,
        renderRowActions:
            ({row, table}) => {
                return (
                    <Box sx={{display: 'flex'}}>
                        <Tooltip title="Modifica">
                            <IconButton onClick={() => table.setEditingRow(row)}>
                                <EditIcon/>
                            </IconButton>
                        </Tooltip>
                        {canDelete && (
                            <Tooltip title="Elimina">
                                <IconButton onClick={async () => {
                                    await onDelete(row.original);
                                    setData(data.filter(item => item.id !== row.id));
                                }}> <DeleteIcon/>
                                </IconButton>
                            </Tooltip>
                        )}
                    </Box>
                );
            },

        renderTopToolbarCustomActions:
            ({table}) => {
                return (
                    <Box sx={{display: 'flex', alignItems: 'center', width: '100%'}}>
                        <Box sx={{ml: 3}}>
                            <h3>{title}</h3>
                            <h5>{editText}</h5>
                        </Box>
                        {createText != null ? (
                            <Button variant="contained" color="primary" onClick={onCreate}
                                    sx={{ml: 'auto', mr: 2, visibility: canCreate ? 'visible' : 'hidden'}}>
                                {createText}
                            </Button>
                        ) : (
                            <IconButton
                                sx={{ml: 'auto', mr: 2, visibility: canCreate ? 'visible' : 'hidden'}}
                                onClick={() => {
                                    table.setCreatingRow(true);
                                }}>
                                <AddCircleOutlineIcon/>
                            </IconButton>
                        )}
                    </Box>
                );
            },
    })

    return (<MaterialReactTable table={table}/>);
};