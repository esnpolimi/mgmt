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
    Switch,
    Tooltip
} from '@mui/material';
import {
    PersonAdd as PersonAddIcon,
    Ballot as BallotIcon,
    Euro as EuroIcon,
    AddCard as AddCardIcon,
    OpenInNew as OpenInNewIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    EditNote as EditNoteIcon,
    ContentCopy as ContentCopyIcon,
    Check as CheckIcon
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
    const [showProfileColumns, setShowProfileColumns] = useState(true);

    // Canonical order for profile fields (same as frontend event form)
    const canonicalProfileOrder = [
        "name", "surname", "birthdate", "email", "latest_esncard", "country", "domicile",
        "phone_prefix", "phone_number", "whatsapp_prefix", "whatsapp_number",
        "latest_document", "course", "matricola_expiration", "person_code", "matricola_number"
    ];

    function orderProfileFields(fields) {
        return canonicalProfileOrder.filter(f => fields.includes(f));
    }

    const listConfigs = useMemo(() => {
        if (!data?.lists) return [];

        const baseProfileFields = Array.isArray(data.profile_fields) ? data.profile_fields : [];
        const getProfileFieldValue = (sub, field) => {
            // If internal profile, use live profile value
            if (sub?.profile && sub.profile[field] !== undefined && sub.profile[field] !== null) {
                return sub.profile[field];
            }
            // External (no profile) -> expose stored email
            if (field === 'email') {
                return sub?.additional_data?.form_email || '';
            }
            return '';
        };

        return data.lists.map(list => {
            const listSubscriptions = data.subscriptions?.filter(sub => sub.list_id === list.id) || [];

            const profileFieldSet = new Set(baseProfileFields);
            listSubscriptions.forEach(sub => {
                (sub?.event_profile_fields || []).forEach(field => {
                    if (field) profileFieldSet.add(field);
                });
            });
            const orderedFromCanonical = orderProfileFields(Array.from(profileFieldSet));
            const extras = Array.from(profileFieldSet).filter(f => !orderedFromCanonical.includes(f));
            const mergedProfileFields = [...orderedFromCanonical, ...extras];

            const baseFields = Array.isArray(data.fields) ? data.fields : [];
            const fieldMap = new Map();
            baseFields.forEach(field => {
                if (!field || !field.name) return;
                const key = `${field.field_type || 'form'}::${field.name}`;
                if (!fieldMap.has(key)) fieldMap.set(key, field);
            });
            const technicalAdditionalFields = new Set([
                'subscription_confirmation_email_sent',
                'payment_confirmation_email_sent',
                'subscription_confirmation_email_sent_at',
                'payment_confirmation_email_sent_at',
                'form_email'
            ]);

            listSubscriptions.forEach(sub => {
                (sub?.event_fields || []).forEach(field => {
                    if (!field || !field.name) return;
                    const key = `${field.field_type || 'form'}::${field.name}`;
                    if (!fieldMap.has(key)) fieldMap.set(key, field);
                });
                const ensureField = (fieldType, name, value) => {
                    if (!name) return;
                    const safeType = fieldType || 'form';
                    if (safeType === 'additional' && technicalAdditionalFields.has(name)) {
                        return;
                    }
                    const key = `${safeType}::${name}`;
                    if (fieldMap.has(key)) return;
                    let inferredType = 't';
                    if (Array.isArray(value)) {
                        inferredType = 'm';
                    } else if (typeof value === 'boolean') {
                        inferredType = 'b';
                        if (safeType === 'additional' && /_confirmation/i.test(name)) {
                            return;
                        }
                    }
                    fieldMap.set(key, {
                        name,
                        type: inferredType,
                        field_type: safeType,
                    });
                };
                Object.entries(sub?.form_data || {}).forEach(([name, value]) => ensureField('form', name, value));
                Object.entries(sub?.additional_data || {}).forEach(([name, value]) => ensureField('additional', name, value));
            });
            const mergedFields = Array.from(fieldMap.values());

            // --- Dynamic columns ---
            let dynamicColumns = [];

            // Profile fields (now blue headers, display-only, toggleable)
            if (showProfileColumns) {
                dynamicColumns = dynamicColumns.concat(
                    mergedProfileFields.map(field => ({
                        accessorKey: `profile_field_${field}`,
                        header: profileDisplayNames[field] || (field.charAt(0).toUpperCase() + field.slice(1)),
                        size: 50,
                        Cell: ({row}) => getProfileFieldValue(row.original, field),
                        muiTableHeadCellProps: {
                            sx: {color: 'primary.main'}
                        }
                    }))
                );
            }

            // Split fields into form and additional
            const formFields = mergedFields.filter(f => (f.field_type || 'form') === 'form');
            const additionalFields = mergedFields.filter(f => f.field_type === 'additional');

            // Form fields (still orange)
            let formFieldColumns = showFormColumns ? formFields.map((field, idx) => ({
                accessorKey: `form_field_${idx}`,
                header: field.name,
                size: 50,
                Cell: ({row}) => {
                    const sub = row.original;
                    const val = sub.form_data?.[field.name];
                    if (field.type === 'm' && Array.isArray(val)) return val.join(', ');
                    if (field.type === 'b') return val === true ? 'Sì' : val === false ? 'No' : '';
                    return val ?? '';
                },
                muiTableHeadCellProps: { sx: {color: 'orange'} }
            })) : [];

            // Form notes (orange)
            const formNotesColumn = showFormColumns ? {
                accessorKey: 'form_notes',
                header: 'Note Form',
                size: 50,
                Cell: ({row}) => row.original.form_notes || '',
                muiTableHeadCellProps: { sx: {color: 'orange'} }
            } : null;

            // Additional fields (keep magenta / purple)
            let additionalFieldColumns = showAdditionalColumns ? additionalFields.map((field, idx) => ({
                accessorKey: `additional_field_${idx}`,
                header: field.name,
                size: 50,
                Cell: ({row}) => {
                    const sub = row.original;
                    const val = sub.additional_data?.[field.name];
                    if (field.type === 'm' && Array.isArray(val)) return val.join(', ');
                    if (field.type === 'b') return val === true ? 'Sì' : val === false ? 'No' : '';
                    return val ?? '';
                },
                muiTableHeadCellProps: { sx: {color: 'mediumvioletred'} }
            })) : [];

            // Order: profile fields, form fields, form notes, additional fields
            dynamicColumns = [
                ...dynamicColumns,
                ...formFieldColumns,
                ...(formNotesColumn ? [formNotesColumn] : []),
                ...additionalFieldColumns
            ];

            const listSubscriptionsColumns = [
                {
                    accessorKey: 'id',
                    header: 'ID',
                    size: 50,
                },
                {
                    accessorKey: 'subscribed_at',
                    header: 'Iscritto il',
                    size: 50,
                    Cell: ({row}) => {
                        const dt = row.original?.subscribed_at;
                        return dt ? dayjs(dt).format('DD/MM/YYYY HH:mm') : '';
                    }
                },
                {
                    accessorKey: 'profile_name',
                    header: 'Profilo',
                    size: 50,
                    muiTableHeadCellProps: { 'data-profile-header': 1 },
                    muiTableBodyCellProps: { 'data-profile-cell': 1 },
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
                                    Apri
                                </Button>
                            </span>
                        );
                    }
                },
                hasQuota && {
                    accessorKey: 'status_quota',
                    header: 'Stato Quota',
                    size: 50,
                    Cell: ({cell}) => {
                        const status = cell.getValue();
                        let color, label;
                        if (status === 'pending') {
                            color = 'error';
                            label = 'In attesa';
                        } else if (status === 'paid') {
                            color = 'success';
                            label = 'Pagata ('+ (cell.row.original.account_name || '-') + ')';
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
                    size: 50,
                    Cell: ({cell}) => {
                        const status = cell.getValue();
                        let label, color;
                        if (status === 'pending') {
                            label = 'In attesa';
                            color = 'error';
                        } else if (status === 'paid') {
                            label = 'Pagata ('+ (cell.row.original.account_name || '-') + ')';
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
                    size: 50,
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
                    size: 50,
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
                                disabled={!sub.created_by_form}
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
                    size: 120,
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

            // Copy column (sticky/pinned left) with header + row copy (Excel-safe '+')
            const copyColumn = {
                id: 'copy',
                header: '',
                size: 40,
                enableSorting: false,
                enableColumnActions: false,
                Header: () => {
                    const [copiedHead, setCopiedHead] = React.useState(false);
                    const handleCopyHeaders = async (e) => {
                        e.stopPropagation();
                        try {
                            const thead = e.currentTarget.closest('thead');
                            if (!thead) return;
                            const headerRow = thead.querySelector('tr');
                            if (!headerRow) return;
                            const ths = Array.from(headerRow.querySelectorAll('th'));
                            const values = ths
                                .filter(th => {
                                    if (th.querySelector('button[title="Copia nomi colonne (Excel)"]')) return false;
                                    if (th.querySelector('input[type="checkbox"]')) return false;
                                    if (th.hasAttribute('data-profile-header')) return false; // Robust Profilo exclusion
                                    const txt = th.innerText.trim();
                                    if (txt === 'Profilo') return false;
                                    return txt !== 'Azioni';

                                })
                                .map(th => {
                                    let txt = th.innerText.replace(/\s+/g, ' ').trim();
                                    // Remove standalone numbers (e.g., spurious "0")
                                    txt = txt.replace(/\b\d+\b/g, ' ').replace(/\s+/g, ' ').trim();
                                    return txt;
                                })
                                .filter(v => v.length);
                            if (values.length) {
                                await navigator.clipboard.writeText(values.join('\t'));
                                setCopiedHead(true);
                                setTimeout(() => setCopiedHead(false), 1500);
                            }
                        } catch (err) {
                            console.error('Header copy failed', err);
                        }
                    };
                    return (
                        <Box sx={{display: 'flex', alignItems: 'center'}}>
                            <IconButton
                                size="small"
                                onClick={handleCopyHeaders}
                                title="Copia nomi colonne (Excel)"
                            >
                                {copiedHead ? <CheckIcon fontSize="inherit" color="success"/> : <ContentCopyIcon fontSize="inherit"/>}
                            </IconButton>
                            {copiedHead && (
                                <Typography variant="caption" color="success.main" sx={{ml: 0.5}}>
                                    Copiato
                                </Typography>
                            )}
                        </Box>
                    );
                },
                Cell: ({row}) => {
                    const [copied, setCopied] = React.useState(false);
                    const handleCopy = async (e) => {
                        e.stopPropagation();
                        const toExcelSafe = (val) => {
                            if (typeof val !== 'string') return val;
                            const s = val.trim();
                            // Excel-safe: treat +NN as text to avoid formula error
                            if (s.startsWith('+')) return `'${s}`;
                            return val;
                        };
                        try {
                            const rowEl = e.currentTarget.closest('tr');
                            let values = [];
                            if (rowEl) {
                                const tds = Array.from(rowEl.querySelectorAll('td'));
                                values = tds
                                    .filter(td => {
                                        if (td.querySelector('button[title="Copia riga (Excel)"]')) return false; // copy cell
                                        if (td.querySelector('input[type="checkbox"]')) return false; // selection
                                        if (td.hasAttribute('data-profile-cell')) return false; // Profilo (incl. external name)
                                        if (td.querySelector('button[title="Modifica Risposte Form"]')) return false; // Azioni
                                        return true;
                                    })
                                    .map(td => td.innerText.replace(/\s+/g, ' ').trim())
                                    // Excel-safe transform
                                    .map(toExcelSafe);
                            }
                            if (!values.length) {
                                const visibleCells = row.getVisibleCells()
                                    .filter(c => !['copy','profile_name','actions','mrt-row-select'].includes(c.column.id));
                                values = visibleCells.map(cell => {
                                    // Format subscribed_at like the UI
                                    if (cell.column.id === 'subscribed_at') {
                                        const dt = row.original?.subscribed_at;
                                        const s = dt ? dayjs(dt).format('DD/MM/YYYY HH:mm') : '';
                                        return toExcelSafe(s);
                                    }
                                    let raw = cell.getValue();
                                    if (raw === null || raw === undefined) return '';
                                    if (Array.isArray(raw)) raw = raw.join(', ');
                                    if (typeof raw === 'object') raw = '';
                                    const s = String(raw).replace(/\s+/g, ' ').trim();
                                    return toExcelSafe(s);
                                });
                            }
                            await navigator.clipboard.writeText(values.join('\t'));
                            setCopied(true);
                            setTimeout(() => setCopied(false), 1500);
                        } catch (err) {
                            console.error('Row copy failed', err);
                        }
                    };
                    return (
                        <Box sx={{display:'flex', alignItems:'center'}}>
                            <IconButton size="small" onClick={handleCopy} title="Copia riga (Excel)">
                                {copied ? <CheckIcon fontSize="inherit" color="success"/> : <ContentCopyIcon fontSize="inherit"/>}
                            </IconButton>
                            {copied && (
                                <Typography variant="caption" color="success.main" sx={{ml:0.5}}>
                                    Copiato
                                </Typography>
                            )}
                        </Box>
                    );
                },
                muiTableHeadCellProps: {sx: {position: 'sticky', left: 0, backgroundColor: 'background.paper', zIndex: 3}},
                muiTableBodyCellProps: {sx: {position: 'sticky', left: 0, backgroundColor: 'background.paper', zIndex: 2}},
            };
            // Insert at far left
            columns.unshift(copyColumn);

            // Add a caption and toggles for form/aspect columns
            const formAspectCaption = (
                <Box sx={{mb: 1, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap'}}>
                    <Box>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={showProfileColumns}
                                    onChange={(_, checked) => setShowProfileColumns(checked)}
                                    color="primary"
                                />
                            }
                            label="Colonne Profilo"
                            sx={{ml: 1}}
                        />
                    </Box>
                    <Box>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={showFormColumns}
                                    onChange={(_, checked) => setShowFormColumns(checked)}
                                    color="warning"
                                />
                            }
                            label="Colonne Form"
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
                            label="Colonne Aggiuntive"
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
                subscriptions: listSubscriptions, // backend-ordered (desc by time)
                columns,
                formAspectCaption
            };
        });
    }, [data, hasDeposit, hasQuota, isBoardMember, onOpenEditAnswers, onOpenReimburseQuota, onOpenReimburseDeposits, showFormColumns, showAdditionalColumns, showProfileColumns]);

    // Build a vCard 3.0 file for an array of subscription objects
    const buildVCard = (subs) => {
        const safe = v => (v || '').toString().replace(/[\r\n]+/g, ' ').trim();
        const linesArr = subs.map(sub => {
            let name = '';
            let surname = '';
            if (sub.profile) {
                name = safe(sub.profile.name);
                surname = safe(sub.profile.surname);
            } else if (sub.external_name) {
                const parts = sub.external_name.trim().split(/\s+/);
                name = safe(parts[0]);
                surname = safe(parts.slice(1).join(' '));
            }
            const email = safe(
                (sub.profile && sub.profile.email) ||
                sub.additional_data?.form_email ||
                ''
            );

            const pickNumber = () => {
                const wpPrefix = sub.profile?.whatsapp_prefix;
                const wpNumber = sub.profile?.whatsapp_number;
                const phPrefix = sub.profile?.phone_prefix;
                const phNumber = sub.profile?.phone_number;
                let prefix = '';
                let num = '';
                if (wpPrefix && wpNumber) {
                    prefix = wpPrefix;
                    num = wpNumber;
                } else if (phPrefix && phNumber) {
                    prefix = phPrefix;
                    num = phNumber;
                }
                if (!num) return '';
                let full = `${prefix || ''}${num}`;
                full = full.replace(/\s+/g, '');
                if (full && !full.startsWith('+') && /^\d+$/.test(full)) {
                    full = '+' + full;
                }
                return full;
            };
            const phone = pickNumber();

            const fullName = (name + ' ' + surname).trim();
            const vcardLines = [
                'BEGIN:VCARD',
                'VERSION:3.0',
                `N:${surname};${name};;;`,
                `FN:${fullName}`,
            ];
            if (email) vcardLines.push(`EMAIL;TYPE=INTERNET:${email}`);
            if (phone) vcardLines.push(`TEL;TYPE=CELL,VOICE,WHATSAPP:${phone}`);
            vcardLines.push('END:VCARD');
            return vcardLines.join('\r\n');
        });
        return linesArr.join('\r\n');
    };

    const downloadVCard = (subs) => {
        if (!subs.length) return;
        const content = buildVCard(subs);
        const blob = new Blob([content], {type: 'text/vcard;charset=utf-8'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'event_contacts.vcf';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            URL.revokeObjectURL(a.href);
            document.body.removeChild(a);
        }, 0);
    };

    const lists = useMemo(() => {
        return listConfigs.map(config => ({
            ...config,
            tableOptions: {
                columns: config.columns,
                data: config.subscriptions,
                enableStickyHeader: true,
                enableColumnPinning: true,
                enablePagination: true,
                enableRowSelection: true,
                enableSorting: false,  // server-side sorting only
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
                    pagination: { pageSize: 10, pageIndex: 0 },
                    columnVisibility: {id: false},
                    columnPinning: { left: ['copy'] },
                },
                paginationDisplayMode: 'pages',
                localization: MRT_Localization_IT,
                muiTableBodyRowProps: ({ row }) => {
                    const profile = row.original.profile;
                    const matricolaExpiration = profile?.matricola_expiration;
                    const isExpired = matricolaExpiration && dayjs(matricolaExpiration).isBefore(dayjs(), 'day');
                    
                    const tooltipTitle = isExpired 
                        ? `⚠️ Matricola scaduta il ${dayjs(matricolaExpiration).format('DD/MM/YYYY')}`
                        : '';
                    
                    return {
                        sx: {
                            backgroundColor: isExpired ? '#ffebee' : 'inherit', 
                            '&:hover': {                                
                                backgroundColor: isExpired ? '#ffcdd2' : 'rgba(0, 0, 0, 0.04)', 
                            },
                        },
                        title: tooltipTitle,
                    };
                },
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
                                {selectedCount === 1 && (
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        onClick={() => onEditSubscription(selectedRows[0].original.id)}
                                        disabled={!canChangeSubscription}
                                    >
                                        Modifica Iscrizione
                                    </Button>
                                )}
                                {selectedCount >= 1 && (
                                    <Button
                                        variant="outlined"
                                        color="success"
                                        onClick={() => downloadVCard(selectedRows.map(r => r.original))}
                                    >
                                        Esporta contatti (vCard)
                                    </Button>
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
                                {hasQuota && selectedCount === 0 && isBoardMember && (
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
        const isInfinite = capacity === 0;
        const occupancyPercentage = !isInfinite && capacity > 0 ? Math.round((subscription_count / capacity) * 100) : 0;
        const occupancyColor = occupancyPercentage >= 90 ? 'error' : occupancyPercentage >= 60 ? 'warning' : 'success';
        const fixedTableOptions = {...tableOptions, paginationDisplayMode: 'pages'};
        const list = useMaterialReactTable(fixedTableOptions);

        return (
            <Box key={listId} sx={{mt: 2, border: '1px solid #ccc', borderRadius: 2, overflow: 'hidden'}}>
                <Box onClick={() => toggleCollapse(listId)}
                     sx={{display: 'flex', alignItems: 'center', cursor: 'pointer', padding: 1, backgroundColor: '#f5f5f5'}}>
                    <BallotIcon sx={{color: 'primary.main', mr: 2}}/>
                    <Typography variant="h6" component="div" sx={{flexGrow: 1, display: 'flex', alignItems: 'center'}}>
                        {listName}
                        {listLabel}
                    </Typography>
                    <Box sx={{width: '200px', mr: 2}}>
                        {isInfinite ? (
                            <Box sx={{display: 'flex', justifyContent: 'flex-end'}}>
                                <Typography variant="body2">{subscription_count} /♾️</Typography>
                            </Box>
                        ) : (
                            <>
                                <Box sx={{display: 'flex', justifyContent: 'space-between'}}>
                                    <Typography variant="body2">{subscription_count} / {capacity}</Typography>
                                </Box>
                                <LinearProgress
                                    variant="determinate"
                                    value={occupancyPercentage}
                                    color={occupancyColor}
                                    sx={{height: 8, borderRadius: 5}}
                                />
                            </>
                        )}
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
