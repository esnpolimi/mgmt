# Eventi
Obiettivo: integrare le funzionalità di gestione degli eventi e delle iscrizioni in un'unica piattaforma, eliminando la necessità di utilizzare sia un gestionale che un foglio Excel. La piattaforma permetterà di gestire i pagamenti, i rimborsi e l'organizzazione degli eventi in modo più efficiente e centralizzato.

### Funzionalità Principali

1. **Creazione e Gestione degli Eventi**
   - Ogni evento può avere attributi come nome, data, descrizione, RE ed RS.
   - È possibile specificare diverse tabelle per ogni evento, ad esempio "Main List" e "Waiting List", con nome e capienza.

2. **Iscrizioni (Subscriptions)**
   - Ogni riga di una tabella è associata a un'iscrizione, che rappresenta l'iscrizione di un profilo a un evento.
   - Una subscription può essere presente in una sola tabella alla volta.

3. **Colonne delle Tabelle**
   - **Profile Fields**: Colonne che includono dati anagrafici degli iscritti (nome, cognome, numero di telefono, ESN card, ecc.). Queste colonne sono immutabili e vengono popolate automaticamente dal database.
   - **Form Fields**: Colonne che vengono riempite con le risposte fornite dagli iscritti attraverso un form. Queste colonne sono modificabili dagli organizzatori.
   - **Additional Fields**: Colonne aggiuntive compilabili direttamente dagli organizzatori per supportare l'organizzazione dell'evento (es. annotazioni, richieste di noleggio, ecc.). Ogni campo ha attributi booleani per la visibilità e l'editabilità da parte dell'ufficio.

4. **Gestione delle Righe**
   - Le righe possono essere trasferite da una tabella all'altra rispettando la capienza massima.
   - È possibile aggiungere manualmente delle righe, associandole a un profilo esistente.

5. **Gestione dei Pagamenti**
   - Ogni riga ha un pulsante che apre un modale con la lista delle transazioni effettuate per quello specifico evento.
   - Il modale permette di visualizzare lo storico dei pagamenti/rimborsi e di effettuare nuove transazioni.
   - È possibile creare un campo aggiuntivo "Stato" per indicare manualmente lo stato dei pagamenti (es. "Pagato", "Non pagato", "Rimborsato").

### Vantaggi

- **Centralizzazione**: Tutte le informazioni e le funzionalità sono integrate in un'unica piattaforma.
- **Flessibilità**: La possibilità di aggiungere e modificare campi e tabelle permette una gestione personalizzata degli eventi.
- **Efficienza**: La gestione automatizzata dei dati anagrafici e delle iscrizioni riduce gli errori e semplifica l'organizzazione.

