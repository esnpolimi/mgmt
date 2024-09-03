import { useState, useMemo, useEffect } from 'react';
import { MRT_Table, useMaterialReactTable, MaterialReactTable } from 'material-react-table';
import EditButton from "./EditButton";

import { Box, Button, IconButton, Tooltip, Typography } from '@mui/material';

import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';


/*  The save function must receive as parameter the row object. 
    It must return true if creating was successful, false otherwise.
    Same goes for the create function.
*/

export default function CrudTable({ cols, initialData, title, onSave, onCreate, canCreate, canDelete }) {

    const columns = useMemo(() => cols);
    const [data,setData] = useState([])

    useEffect(() => {
        setData(initialData);
    }, [initialData]);

    const table = useMaterialReactTable({
        columns,
        data: data,
        enableEditing: true,
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
        onCreatingRowCancel: () => {},
        onCreatingRowSave: async ({values, table}) => { 
            let new_doc = await onCreate(values);
            if(new_doc){
                setData([...data, new_doc]);
                table.setCreatingRow(false);
            }
        },
        onEditingRowSave: async ({row, values}) => {
            if(await onSave(row.original,values)){
                const updatedData = data.map((item, index) =>
                    index === row.index ? {...row.original, ...values} : item
                );
                setData(updatedData);
                console.log(updatedData);
                table.setEditingRow(null);
            }
        },
        onEditingRowCancel: () => { },
        getRowId: (row) => row.id,
        renderRowActions: ({ row, table }) => {
            return (
                <Box sx={{ display: 'flex', gap: '1rem' }}>
                    <Tooltip title="Edit">
                        <IconButton onClick={() => table.setEditingRow(row)}>
                            <EditIcon />
                        </IconButton>
                    </Tooltip>
                    {canDelete && (
                        <Tooltip title="Delete">
                            <IconButton onClick={() => { }}>
                                <DeleteIcon />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>
            );
        },

        renderTopToolbarCustomActions: ({ table }) => {
            return (
                <Box sx={{ display: 'flex', flexDirection: 'row' }}>
                    {canCreate ? (<IconButton
                        onClick={() => {
                            table.setCreatingRow(true);
                        }}
                    >
                        <AddCircleOutlineIcon />
                    </IconButton>) : (<></>)}
                    <Box sx={{ ml: '30px' }}>
                        <h3>{title}</h3>
                    </Box>
                </Box>
            );
        },

    })

    return (
        <MaterialReactTable table={table} />
    );
};