import React, {useEffect, useState, useMemo} from 'react';
import {MRT_Table, useMaterialReactTable} from 'material-react-table';
import {transactionDisplayNames as names} from '../../utils/displayAttributes';
import {fetchCustom} from '../../api/api';
import {MRT_Localization_IT} from 'material-react-table/locales/it';
import Loader from '../Loader';

export default function TransactionsDash({limit = 5}) {
    const [data, setData] = useState([]);
    const [isLoading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const response = await fetchCustom("GET", '/transactions/');
                if (response.ok) {
                    const json = await response.json();
                    setData(json.results);
                    console.log("Transactions data:", json.results);
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
        {accessorKey: 'created_at', header: names.date, size: 150},
        {accessorKey: 'subscription', header: names.subscription, size: 150},
        {accessorKey: 'executor', header: names.executor, size: 150},
        {accessorKey: 'account', header: names.account, size: 100},
        {accessorKey: 'amount', header: names.amount, size: 100},
    ], []);

    const table = useMaterialReactTable({
        columns,
        data: data.slice(0, limit),
        enableKeyboardShortcuts: false,
        enableColumnActions: false,
        enableColumnFilters: false,
        enablePagination: false,
        enableSorting: false,
        initialState: {showColumnFilters: false, showGlobalFilter: false},
        paginationDisplayMode: 'default',
        muiTableBodyRowProps: {hover: false},
        localization: MRT_Localization_IT,
    });

    return isLoading ? <Loader/> : <MRT_Table table={table}/>;
}
