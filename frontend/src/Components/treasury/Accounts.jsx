import React, {useEffect, useState, useMemo} from 'react';
import {MaterialReactTable, useMaterialReactTable} from 'material-react-table';
import {accountDisplayNames as names} from '../../utils/displayAttributes';
import {fetchCustom} from '../../api/api';
import {MRT_Localization_IT} from 'material-react-table/locales/it';
import Loader from '../Loader';

export default function Accounts({limit = 5}) {
    const [data, setData] = useState([]);
    const [isLoading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const response = await fetchCustom("GET", '/accounts/');
                if (response.ok) {
                    const json = await response.json();
                    setData(json.results);
                }
            } catch (e) {
                // Optionally handle error
            } finally {
                setLoading(false);
            }
        };
        fetchData().then();
    }, []);

    const columns = useMemo(() => [
        {accessorKey: 'id', header: names.id, size: 50},
        {accessorKey: 'name', header: names.name, size: 150},
        {accessorKey: 'status', header: names.status, size: 150},
    ], []);

    const table = useMaterialReactTable({
        columns,
        data: data.slice(0, limit),
        enableRowActions: false,
        enableRowSelection: false,
        enableRowPinning: false,
        enableExpandAll: false,
        initialState: {showColumnFilters: false, showGlobalFilter: false},
        paginationDisplayMode: 'default',
        localization: MRT_Localization_IT,
    });

    return isLoading ? <Loader/> : <MaterialReactTable table={table}/>;
}