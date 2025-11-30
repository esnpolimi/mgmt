import {useState, useEffect} from "react";
import {
    Box,
    Typography,
    Paper,
    Button,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Accordion,
    AccordionSummary,
    AccordionDetails,
} from "@mui/material";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import Sidebar from "../Components/Sidebar";
import Popup from "../Components/Popup";
import {defaultErrorHandler, fetchCustom} from "../api/api";

export default function ContentManager() {
    const [sections, setSections] = useState([]);
    const [popup, setPopup] = useState(null);
    const [, setLoading] = useState(false);

    // Link Dialog
    const [linkDialogOpen, setLinkDialogOpen] = useState(false);
    const [editingLink, setEditingLink] = useState(null);
    const [currentSectionId, setCurrentSectionId] = useState(null);
    const [linkForm, setLinkForm] = useState({
        name: '',
        description: '',
        url: '',
        color: '#1976d2'
    });

    useEffect(() => {
        fetchSections();
    }, []);

    const fetchSections = () => {
        setLoading(true);
        fetchCustom("GET", "/content/sections/active_sections/", {
            onSuccess: (data) => setSections(data),
            onError: (error) => defaultErrorHandler(error, setPopup),
            onFinally: () => setLoading(false)
        });
    };

    // Link handlers
    const openLinkDialog = (sectionId, link = null) => {
        setCurrentSectionId(sectionId);
        if (link) {
            setEditingLink(link);
            setLinkForm({
                name: link.name,
                description: link.description || '',
                url: link.url || '',
                color: link.color
            });
        } else {
            setEditingLink(null);
            setLinkForm({
                name: '',
                description: '',
                url: '',
                color: '#1976d2'
            });
        }
        setLinkDialogOpen(true);
    };

    const handleLinkSave = () => {
        // Validation
        if (!linkForm.name.trim()) {
            setPopup({message: "Il titolo è obbligatorio!", state: "error", id: Date.now()});
            return;
        }
        if (!linkForm.url.trim()) {
            setPopup({message: "Il link è obbligatorio!", state: "error", id: Date.now()});
            return;
        }
        if (!linkForm.color.trim()) {
            setPopup({message: "Il colore è obbligatorio!", state: "error", id: Date.now()});
            return;
        }
        const method = editingLink ? "PATCH" : "POST";
        const url = editingLink
            ? `/content/links/${editingLink.id}/`
            : "/content/links/";

        let body = linkForm;
        
        // Se è un nuovo link, aggiungi section e order
        if (!editingLink) {
            const section = sections.find(s => s.id === currentSectionId);
            const maxOrder = section?.links?.length > 0 
                ? Math.max(...section.links.map(l => l.order)) 
                : -1;
            body = {
                ...linkForm, 
                section: currentSectionId,
                order: maxOrder + 1
            };
        }

        fetchCustom(method, url, {
            body,
            onSuccess: () => {
                fetchSections();
                setLinkDialogOpen(false);
                setPopup({
                    message: `Link ${editingLink ? 'aggiornato' : 'creato'} con successo!`,
                    state: "success",
                    id: Date.now()
                });
            },
            onError: (error) => defaultErrorHandler(error, setPopup)
        });
    };

    const handleLinkDelete = (linkId) => {
        if (!window.confirm("Sei sicuro di voler eliminare questo link?")) return;

        fetchCustom("DELETE", `/content/links/${linkId}/`, {
            onSuccess: () => {
                fetchSections();
                setPopup({
                    message: "Link eliminato con successo!",
                    state: "success",
                    id: Date.now()
                });
            },
            onError: (error) => defaultErrorHandler(error, setPopup)
        });
    };

    const handleMoveLink = (sectionId, linkId, direction) => {
        const section = sections.find(s => s.id === sectionId);
        if (!section) return;

        const links = [...section.links];
        const currentIndex = links.findIndex(l => l.id === linkId);
        
        if (currentIndex === -1) return;
        if (direction === 'up' && currentIndex === 0) return;
        if (direction === 'down' && currentIndex === links.length - 1) return;

        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        
        // Get the two links that need to swap orders
        const currentLink = links[currentIndex];
        const otherLink = links[newIndex];

        // Swap their order values
        Promise.all([
            new Promise((resolve, reject) => {
                fetchCustom("PATCH", `/content/links/${currentLink.id}/`, {
                    body: { order: otherLink.order },
                    onSuccess: resolve,
                    onError: reject
                });
            }),
            new Promise((resolve, reject) => {
                fetchCustom("PATCH", `/content/links/${otherLink.id}/`, {
                    body: { order: currentLink.order },
                    onSuccess: resolve,
                    onError: reject
                });
            })
        ]).then(() => {
            fetchSections();
        }).catch((error) => {
            defaultErrorHandler(error, setPopup);
        });
    };

    return (
        <Box sx={{minHeight: "100vh", background: "#f9f9fb", pb: 4}}>
            <Sidebar/>
            <Box sx={{pt: 3, px: 3, maxWidth: 1400, mx: "auto"}}>
                <Paper elevation={3} sx={{p: 3, mb: 3}}>
                    <Box sx={{display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2}}>
                        <Typography variant="h4" sx={{fontWeight: 700}}>
                            Gestione Contenuti Home Page
                        </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{mb: 3}}>
                        Gestisci i link delle due categorie: LINK UTILI e WIKI E TUTORIAL
                    </Typography>

                    {sections.map((section) => (
                        <Accordion key={section.id} defaultExpanded sx={{mb: 2}}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon/>}>
                                <Box sx={{display: "flex", alignItems: "center", width: "100%", gap: 2}}>
                                    <Typography variant="h6" sx={{flex: 1}}>
                                        {section.title_display}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {section.links?.length || 0} link
                                    </Typography>
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<AddIcon/>}
                                    onClick={() => openLinkDialog(section.id)}
                                    sx={{mb: 2}}>
                                    Aggiungi Link
                                </Button>

                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Titolo</TableCell>
                                                <TableCell>Descrizione</TableCell>
                                                <TableCell>Link</TableCell>
                                                <TableCell>Colore</TableCell>
                                                <TableCell align="right">Azioni</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {section.links?.map((link, index) => (
                                                <TableRow key={link.id}>
                                                    <TableCell>{link.name}</TableCell>
                                                    <TableCell sx={{maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis"}}>
                                                        {link.description}
                                                    </TableCell>
                                                    <TableCell sx={{maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis"}}>
                                                        <a href={link.url} target="_blank" rel="noopener noreferrer">
                                                            {link.url}
                                                        </a>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Box sx={{
                                                            width: 30,
                                                            height: 30,
                                                            backgroundColor: link.color,
                                                            borderRadius: 1,
                                                            border: '1px solid #ccc'
                                                        }}/>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleMoveLink(section.id, link.id, 'up')}
                                                            disabled={index === 0}>
                                                            <ArrowUpwardIcon/>
                                                        </IconButton>
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleMoveLink(section.id, link.id, 'down')}
                                                            disabled={index === section.links.length - 1}>
                                                            <ArrowDownwardIcon/>
                                                        </IconButton>
                                                        <IconButton
                                                            size="small"
                                                            color="primary"
                                                            onClick={() => openLinkDialog(section.id, link)}>
                                                            <EditIcon/>
                                                        </IconButton>
                                                        <IconButton
                                                            size="small"
                                                            color="error"
                                                            onClick={() => handleLinkDelete(link.id)}>
                                                            <DeleteIcon/>
                                                        </IconButton>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </AccordionDetails>
                        </Accordion>
                    ))}
                </Paper>
            </Box>

            {/* Link Dialog */}
            <Dialog open={linkDialogOpen} onClose={() => setLinkDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{editingLink ? 'Modifica Link' : 'Nuovo Link'}</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        label="Titolo"
                        value={linkForm.name}
                        onChange={(e) => setLinkForm({...linkForm, name: e.target.value})}
                        margin="normal"
                        required
                        helperText="Obbligatorio"
                    />
                    <TextField
                        fullWidth
                        label="Descrizione"
                        value={linkForm.description}
                        onChange={(e) => setLinkForm({...linkForm, description: e.target.value})}
                        margin="normal"
                        multiline
                        rows={3}
                        helperText="Breve descrizione del link (opzionale)"
                    />
                    <TextField
                        fullWidth
                        label="Link/URL"
                        value={linkForm.url}
                        onChange={(e) => setLinkForm({...linkForm, url: e.target.value})}
                        margin="normal"
                        required
                        helperText="Obbligatorio - URL completo (es: https://...)"
                    />
                    <Box sx={{mt: 2, mb: 1}}>
                        <Typography variant="body2" color="text.secondary" sx={{mb: 1}}>
                            Colore (Obbligatorio)
                        </Typography>
                        <TextField
                            fullWidth
                            type="color"
                            value={linkForm.color}
                            onChange={(e) => setLinkForm({...linkForm, color: e.target.value})}
                            sx={{maxWidth: 100}}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setLinkDialogOpen(false)}>Annulla</Button>
                    <Button onClick={handleLinkSave} variant="contained">Salva</Button>
                </DialogActions>
            </Dialog>

            {popup && <Popup key={popup.id} message={popup.message} state={popup.state}/>}
        </Box>
    );
}
