import React, {useState, useMemo, memo} from 'react';
import {
    Box,
    Button,
    Chip,
    IconButton,
    LinearProgress,
    Typography,
    Collapse,
    FormControlLabel,
    Switch
} from '@mui/material';
import {
    PersonAdd as PersonAddIcon,
    Ballot as BallotIcon,
    Euro as EuroIcon,
    AddCard as AddCardIcon,
    OpenInNew as OpenInNewIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    EditNote as EditNoteIcon
} from '@mui/icons-material';
import {MaterialReactTable, useMaterialReactTable} from 'material-react-table';
import {MRT_Localization_IT} from "material-react-table/locales/it";
import dayjs from "dayjs";
import {profileDisplayNames} from '../../utils/displayAttributes';

export default memo(function EventListAccordions({
                                                data,
                                                onOpenSubscriptionModal,
                                                onEditSubscription,
                                                onMoveToList,
                                                onOpenReimburseDeposits,
                                                onOpenReimburseQuota,
                                                onOpenPrintableLibetatorie,
                                                onOpenEditAnswers,
                                                canChangeSubscription,
                                                canChangeTransactions,
                                                isBoardMember
                                            }) {
    const [expandedAccordion, setExpandedAccordion] = useState([]);
    const hasDeposit = data?.deposit > 0;
    const hasQuota = data?.cost > 0;

    const toggleCollapse = (panel) => {
        setExpandedAccordion(prev =>
            prev.includes(panel) ? prev.filter(p => p !== panel) : [...prev, panel]
        );
    };

    const handleSubscriptionStatus = () => {
        if (!data) return {chip: <Chip label="Loading..." variant="outlined" size="medium"/>, isActive: false};

        const now = dayjs();
        const startDateTime = data.subscription_start_date ? dayjs(data.subscription_start_date) : null;
        const endDateTime = data.subscription_end_date ? dayjs(data.subscription_end_date) : null;

        let isActive = false;

        if (startDateTime && endDateTime) {
            if (now.isAfter(startDateTime) && now.isBefore(endDateTime)) {
                isActive = true;
            }
        }

        return {isActive};
    };

    // Toggles for showing/hiding columns
    const [showFormColumns, setShowFormColumns] = useState(true);
    const [showAdditionalColumns, setShowAdditionalColumns] = useState(true);

    const listConfigs = useMemo(() => {
        if (!data?.lists) return [];

        // ...existing helper functions...
        const getProfileFieldValue = (sub, field) => {
            if (sub.profile_data && sub.profile_data[field] !== undefined && sub.profile_data[field] !== null) {
                return sub.profile_data[field];
            }
            if (sub[field] !== undefined && sub[field] !== null) {
                return sub[field];
            }
            if (sub.profile && sub.profile[field] !== undefined && sub.profile[field] !== null) {
                return sub.profile[field];
            }
            return '';
        };

        return data.lists.map(list => {
            const listSubscriptions = data.subscriptions?.filter(sub => sub.list_id === list.id) || [];

            // --- Dynamic columns ---
            let dynamicColumns = [];

            // Profile fields (orange)
            if (Array.isArray(data.profile_fields) && showFormColumns) {
                dynamicColumns = dynamicColumns.concat(
                    data.profile_fields.map(field => ({
                        accessorKey: `profile_field_${field}`,
                        header: profileDisplayNames[field] || (field.charAt(0).toUpperCase() + field.slice(1)),
                        size: 120,
                        Cell: ({row}) => getProfileFieldValue(row.original, field),
                        muiTableHeadCellProps: {
                            sx: {color: 'orange'}
                        }
                    }))
                );
            }

            // Split fields into form and additional
            const formFields = Array.isArray(data.fields) ? data.fields.filter(f => f.field_type === 'form') : [];
            const additionalFields = Array.isArray(data.fields) ? data.fields.filter(f => f.field_type === 'additional') : [];

            // Form fields (orange)
            let formFieldColumns = showFormColumns ? formFields.map((field, idx) => ({
                accessorKey: `form_field_${idx}`,
                header: field.name,
                size: 180,
                Cell: ({row}) => {
                    const sub = row.original;
                    const val = sub.form_data?.[field.name];
                    if (field.type === 'm' && Array.isArray(val)) return val.join(', ');
                    if (field.type === 'b') return val === true ? 'Sì' : val === false ? 'No' : '';
                    return val ?? '';
                },
                muiTableHeadCellProps: {
                    sx: {color: 'orange'}
                }
            })) : [];

            // Form notes (orange)
            const formNotesColumn = showFormColumns ? {
                accessorKey: 'form_notes',
                header: 'Note Form',
                size: 180,
                Cell: ({row}) => row.original.form_notes || '',
                muiTableHeadCellProps: {
                    sx: {color: 'orange'}
                }
            } : null;

            // Additional fields (magenta)
            let additionalFieldColumns = showAdditionalColumns ? additionalFields.map((field, idx) => ({
                accessorKey: `additional_field_${idx}`,
                header: field.name,
                size: 180,
                Cell: ({row}) => {
                    const sub = row.original;
                    const val = sub.additional_data?.[field.name];
                    if (field.type === 'm' && Array.isArray(val)) return val.join(', ');
                    if (field.type === 'b') return val === true ? 'Sì' : val === false ? 'No' : '';
                    return val ?? '';
                },
                muiTableHeadCellProps: {
                    sx: {color: 'mediumvioletred'}
                }
            })) : [];

            // Order: profile fields, form fields, form notes, additional fields
            dynamicColumns = [
                ...dynamicColumns,
                ...formFieldColumns,
                ...(formNotesColumn ? [formNotesColumn] : []),
                ...additionalFieldColumns
            ];

            const listSubscriptionsColumns = [
                // ...existing columns...
                {
                    accessorKey: 'id',
                    header: 'ID',
                    size: 50,
                },
                {
                    accessorKey: 'profile_name',
                    header: 'Profilo',
                    size: 150,
                    Cell: ({row}) => {
                        const sub = row.original;
                        if (sub.external_name) {
                            return <span>{sub.external_name}</span>;
                        }
                        return (
                            <span>
                                <Button variant="text"
                                        color="primary"
                                        sx={{textTransform: 'none', padding: 0, minWidth: 0}}
                                        endIcon={<OpenInNewIcon fontSize="small"/>}
                                        onClick={() => window.open(`/profile/${sub.profile_id}`, '_blank', 'noopener,noreferrer')}>
                                    {sub.profile_name}
                                </Button>
                            </span>
                        );
                    }
                },
                hasQuota && {
                    accessorKey: 'status_quota',
                    header: 'Stato Quota',
                    size: 120,
                    Cell: ({cell}) => {
                        const status = cell.getValue();
                        let color, label;
                        if (status === 'pending') {
                            color = 'error';
                            label = 'In attesa';
                        } else if (status === 'paid') {
                            color = 'success';
                            label = 'Pagata';
                        } else if (status === 'reimbursed') {
                            color = 'warning';
                            label = 'Rimborsata';
                        } else {
                            color = 'default';
                            label = status;
                        }
                        return <Chip label={label} color={color}/>;
                    }
                },
                hasDeposit && {
                    accessorKey: 'status_cauzione',
                    header: 'Stato Cauzione',
                    size: 120,
                    Cell: ({cell}) => {
                        const status = cell.getValue();
                        let label, color;
                        if (status === 'pending') {
                            label = 'In attesa';
                            color = 'error';
                        } else if (status === 'paid') {
                            label = 'Pagata';
                            color = 'success';
                        } else if (status === 'reimbursed') {
                            label = 'Rimborsata';
                            color = 'warning';
                        } else {
                            label = status;
                            color = 'default';
                        }
                        return <Chip label={label} color={color}/>;
                    }
                },
                data.is_allow_external && {
                    accessorKey: 'is_external',
                    header: 'Esterno',
                    size: 80,
                    Cell: ({row}) => {
                        const sub = row.original;
                        const isExternal = !!sub.external_name;
                        return (
                            <Chip
                                label={isExternal ? "Sì" : "No"}
                                color={isExternal ? "success" : "error"}
                                variant="outlined"
                            />
                        );
                    }
                },
                {
                    accessorKey: 'notes',
                    header: 'Note',
                    size: 150,
                },
            ].filter(Boolean);

            // ...existing columns assembly logic...
            let columns;
            const profileIdx = listSubscriptionsColumns.findIndex(col => col.accessorKey === 'profile_name');
            if (profileIdx !== -1) {
                columns = [
                    ...listSubscriptionsColumns.slice(0, profileIdx + 1),
                    ...dynamicColumns,
                    ...listSubscriptionsColumns.slice(profileIdx + 1)
                ];
            } else {
                columns = [...listSubscriptionsColumns, ...dynamicColumns];
            }

            // ...existing actions column logic...
            if ((hasDeposit || hasQuota) && isBoardMember) {
                columns.push({
                    accessorKey: 'actions',
                    header: 'Azioni',
                    size: 120,
                    enableSorting: false,
                    enableColumnActions: false,
                    Cell: ({row}) => {
                        const sub = row.original;
                        const canReimburseQuota = hasQuota && sub.status_quota === 'paid';
                        const canReimburseDeposit = hasDeposit && sub.status_cauzione === 'paid';
                        return (<>
                            <IconButton
                                title="Modifica Risposte Form"
                                color="primary"
                                onClick={e => {
                                    e.stopPropagation();
                                    onOpenEditAnswers(sub);
                                }}
                            >
                                <EditNoteIcon/>
                            </IconButton>
                            {hasQuota && isBoardMember && (
                                <IconButton
                                    title="Rimborsa Quota"
                                    color="secondary"
                                    disabled={!canReimburseQuota}
                                    onClick={e => {
                                        e.stopPropagation();
                                        onOpenReimburseQuota(sub);
                                    }}>
                                    <EuroIcon/>
                                </IconButton>
                            )}
                            {hasDeposit && isBoardMember && (
                                <IconButton
                                    title="Rimborsa Cauzione"
                                    color="primary"
                                    disabled={!canReimburseDeposit}
                                    onClick={e => {
                                        e.stopPropagation();
                                        onOpenReimburseDeposits(sub);
                                    }}>
                                    <AddCardIcon/>
                                </IconButton>
                            )}
                        </>);
                    },
                });
            } else {
                columns.push({
                    accessorKey: 'actions',
                    header: 'Azioni',
                    size: 100,
                    enableSorting: false,
                    enableColumnActions: false,
                    Cell: ({row}) => {
                        const sub = row.original;
                        return (
                            <IconButton
                                title="Modifica Risposte Form"
                                color="primary"
                                onClick={e => {
                                    e.stopPropagation();
                                    onOpenEditAnswers(sub);
                                }}
                            >
                                <EditNoteIcon/>
                            </IconButton>
                        );
                    }
                });
            }

            // Add a caption and toggles for form/aspect columns
            const formAspectCaption = (
                <Box sx={{mb: 1, display: 'flex', alignItems: 'center', gap: 2}}>
                    <Box>

                        <FormControlLabel
                            control={
                                <Switch
                                    checked={showFormColumns}
                                    onChange={(_, checked) => setShowFormColumns(checked)}
                                    color="warning"
                                />
                            }
                            label="Colonne form Erasmus"
                            sx={{ml: 1}}
                        />
                    </Box>
                    <Box>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={showAdditionalColumns}
                                    onChange={(_, checked) => setShowAdditionalColumns(checked)}
                                    color="secondary"
                                />
                            }
                            label="Colonne form ESNers"
                            sx={{ml: 1}}
                        />
                    </Box>
                </Box>
            );

            return {
                listId: list.id,
                listName: list.name,
                capacity: list.capacity,
                subscription_count: list.subscription_count,
                subscriptions: listSubscriptions,
                columns,
                formAspectCaption
            };
        });
    }, [data, hasDeposit, hasQuota, isBoardMember, onOpenEditAnswers, onOpenReimburseQuota, onOpenReimburseDeposits, showFormColumns, showAdditionalColumns]);

    const lists = useMemo(() => {
        return listConfigs.map(config => ({
            ...config,
            tableOptions: {
                columns: config.columns,
                data: config.subscriptions,
                enableStickyHeader: true,
                enablePagination: true,
                enableRowSelection: true,
                enableRowActions: false,
                enableGrouping: false,
                enableSearchHighlighting: true,
                enableFacetedValues: true,
                enableColumnFilters: false,
                enableColumnOrdering: false,
                enableColumnActions: false,
                display: false,
                initialState: {
                    showColumnFilters: false,
                    pagination: {
                        pageSize: 10,
                        pageIndex: 0,
                    },
                    columnVisibility: {id: false},
                },
                paginationDisplayMode: 'pages',
                localization: MRT_Localization_IT,
                renderEmptyRowsFallback: () => (
                    <Box sx={{textAlign: 'center', p: 2}}>
                        <Typography variant="body1">Nessuna iscrizione presente</Typography>
                    </Box>
                ),
                muiTablePaginationProps: {
                    labelRowsPerPage: 'Righe per pagina:'
                },
                renderTopToolbarCustomActions: ({table}) => {
                    const selectedRows = table.getSelectedRowModel().rows;
                    const selectedCount = selectedRows.length;
                    const listId = config.listId;
                    const capacity = config.capacity;
                    const subscription_count = config.subscription_count;
                    const {isActive} = handleSubscriptionStatus();
                    return (
                        <Box sx={{display: 'flex', gap: 1, p: 2, alignItems: 'center'}}>
                            <Box sx={{display: 'flex', gap: 1, flexGrow: 1}}>
                                {selectedCount === 0 && (<>
                                        <Button
                                            variant="contained"
                                            color="primary"
                                            startIcon={<PersonAddIcon/>}
                                            disabled={!((capacity === 0 || subscription_count < capacity) && isActive)}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onOpenSubscriptionModal(listId);
                                            }}>
                                            ISCRIVI
                                        </Button>
                                    </>
                                )}
                                {selectedCount >= 1 && (<>
                                        <Button
                                            variant="outlined"
                                            color="primary"
                                            onClick={() => onMoveToList(selectedRows, listId)}
                                            disabled={!canChangeSubscription}
                                        >
                                            Sposta in Altra Lista
                                        </Button>
                                    </>
                                )}
                                {selectedCount === 1 && (<>
                                        <Button
                                            variant="contained"
                                            color="primary"
                                            onClick={() => onEditSubscription(selectedRows[0].original.id)}
                                            disabled={!canChangeSubscription}
                                        >
                                            Modifica Iscrizione
                                        </Button>
                                    </>
                                )}
                                {hasDeposit && canChangeTransactions && selectedCount === 0 && isBoardMember && (
                                    <Button variant="contained"
                                            color="success"
                                            onClick={e => {
                                                e.stopPropagation();
                                                onOpenReimburseDeposits(null, config.listId);
                                            }}
                                            sx={{ml: 1}}
                                    >
                                        Rimborsa Cauzioni
                                    </Button>
                                )}
                                {hasQuota && selectedCount === 0 && data.is_a_bando && isBoardMember && (
                                    <Button variant="contained"
                                            color="info"
                                            onClick={e => {
                                                e.stopPropagation();
                                                onOpenPrintableLibetatorie(config.listId);
                                            }}
                                            sx={{ml: 1}}
                                    >
                                        Stampa Liberatorie
                                    </Button>
                                )}
                            </Box>
                        </Box>
                    );
                },
            }
        }));
    }, [listConfigs, data, canChangeSubscription, canChangeTransactions, isBoardMember, onOpenSubscriptionModal, onEditSubscription, onMoveToList, onOpenReimburseDeposits, onOpenPrintableLibetatorie]);

    if (!lists || lists.length === 0) {
        return <Typography>Nessuna lista disponibile (aggiungine una per poter iscrivere)</Typography>;
    }

    return lists.map(listConfig => {
        const {listId, listName, capacity, subscription_count, tableOptions, formAspectCaption} = listConfig;
        // Add ML/WL label
        const listObj = data.lists?.find(l => l.id === listId);
        let listLabel = null;
        if (listObj?.is_main_list) {
            listLabel = <Chip label="Main List" color="primary" size="small" sx={{ml: 1}} />;
        } else if (listObj?.is_waiting_list) {
            listLabel = <Chip label="Waiting List" color="warning" size="small" sx={{ml: 1}} />;
        }
        const occupancyPercentage = capacity > 0 ? Math.round((subscription_count / capacity) * 100) : 0;
        const occupancyColor = occupancyPercentage >= 90 ? 'error' : occupancyPercentage >= 60 ? 'warning' : 'success';
        const fixedTableOptions = {...tableOptions, paginationDisplayMode: 'pages'};
        const list = useMaterialReactTable(fixedTableOptions);

        return (
            <Box key={listId} sx={{mt: 2, border: '1px solid #ccc', borderRadius: 2, overflow: 'hidden'}}>
                <Box onClick={() => toggleCollapse(listId)}
                     sx={{
                         display: 'flex',
                         alignItems: 'center',
                         cursor: 'pointer',
                         padding: 1,
                         backgroundColor: '#f5f5f5'
                     }}>
                    <BallotIcon sx={{color: 'primary.main', mr: 2}}/>
                    <Typography variant="h6" component="div" sx={{flexGrow: 1, display: 'flex', alignItems: 'center'}}>
                        {listName}
                        {listLabel}
                    </Typography>
                    <Box sx={{width: '200px', mr: 2}}>
                        <Box sx={{display: 'flex', justifyContent: 'space-between'}}>
                            <Typography variant="body2">{subscription_count}/{capacity}</Typography>
                        </Box>
                        <LinearProgress variant="determinate"
                                        value={occupancyPercentage}
                                        color={occupancyColor}
                                        sx={{height: 8, borderRadius: 5}}/>
                    </Box>
                    <IconButton onClick={(e) => {
                        e.stopPropagation();
                        toggleCollapse(listId);
                    }}>
                        {expandedAccordion.includes(listId) ? <ExpandLessIcon/> : <ExpandMoreIcon/>}
                    </IconButton>
                </Box>
                <Collapse in={expandedAccordion.includes(listId)} timeout="auto" unmountOnExit>
                    <Box sx={{p: 2}}>
                        {formAspectCaption}
                        <MaterialReactTable table={list}/>
                    </Box>
                </Collapse>
            </Box>
        );
    });
});

