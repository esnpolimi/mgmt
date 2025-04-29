# ESN Politecnico Milano New Management System
This is a webapp designed to manage the activities and events of the Erasmus Student Network of Politecnico di Milano organization. The system is built using Django for the backend and React for the frontend, providing a modern and efficient user experience.

# Guida Workflow Git

## Branch principali

#### `main`: Codice stabile e pronto per la produzione, usato solo per il codice già testato e approvato.
#### `develop`: Area di staging per integrare nuove funzionalità e fix; Tutto il codice completato e testato si unisce prima qui.

## Branch per nuove modifiche

1. **Crea un branch**:
   - Per ogni nuova funzionalità o fix, crea un branch.
   - Convenzioni di nome:
     - Funzionalità: `feature/nome-funzionalita`
     - Correzione bug: `fix/nome-bug`

2. **Sviluppa**:
   - Effettua le modifiche, chiedendo eventuale supporto agli altri membri del team :)
   - Testa i cambiamenti in locale.

3. **Richiedi una Pull Request (PR)**:
   - Al termine del lavoro, richiedi una PR verso il branch `develop`.

4. **Revisione**:
   - La PR sarà revisionata e, una volta approvata, il codice sarà unito a `develop`.

---

# Run Backend + Frontend on Local with Docker
After having installed Docker (Docker Desktop on Windows) you can start the deamon (just open Docker Desktop on Windows) and execute (from the folder in which local.yml is located):

`docker compose -f .\local.yml build` to build the containers (only the first time, or when you've made changes to the Dockerfile or requirements.txt)

`docker compose -f .\local.yml up` to execute the containers (backend and frontend)

This will expose the backend on [http://localhost:8000](http://localhost:8000) and the frontend on [http://localhost:3000](http://localhost:3000).

Enjoy!

# Run Backend on Local (w/o Docker)
To ensure your Django project runs with the correct environment (`development` or `production`), you need to set the environment variable `DJANGO_ENV` **before** running the `python manage.py runserver` command.
## **On macOS/Linux**
You can export the environment variable using the `export` command in your terminal.

### For Development:
``` bash
DJANGO_ENV=development DJANGO_SETTINGS_MODULE=backend.settings.dev python manage.py runserver
```
### For Production:
``` bash
DJANGO_ENV=production DJANGO_SETTINGS_MODULE=backend.settings.prod python manage.py runserver
```

## **On Windows (Command Prompt)**
Use the `set` command to define the environment variable.
### For Development:
``` bash
$set DJANGO_ENV="development" && set DJANGO_SETTINGS_MODULE="backend.settings.dev" && python manage.py runserver
```
### For Production:
``` bash
$set DJANGO_ENV="production" && set DJANGO_SETTINGS_MODULE="backend.settings.prod" && python manage.py runserver
```

## **On Windows (PowerShell)**
In PowerShell, use the `$env:` prefix to set the environment variable.
### For Development:
``` bash
$env:DJANGO_ENV="development"; $env:DJANGO_SETTINGS_MODULE="backend.settings.dev"; python manage.py runserver
```
### For Production:
``` bash
$env:DJANGO_ENV="production"; $env:DJANGO_SETTINGS_MODULE="backend.settings.prod"; python manage.py runserver
```
## Verify the Current Environment
To ensure the environment variable is set correctly, you can temporarily add a print statement to your `manage.py` file:
``` python
import os

print("DJANGO_ENV:", os.getenv("DJANGO_ENV", "Not Set"))
print("DJANGO_SETTINGS_MODULE:", os.getenv("DJANGO_SETTINGS_MODULE"))
```
When you run the `runserver` command, it should output either `development` or `production`.
This approach ensures Django loads the correct settings file (e.g., `backend.settings.dev` or `backend.settings.prod`) based on the value of `DJANGO_ENV`.


## Run Frontend on Local (w/o Docker)

In the project directory, you can run:

### `npm run dev`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will (hot) reload when you make changes.\
You may also see any lint errors in the console.

### `npm run build`

Builds the app for **production** to the `dist` folder.\
It optimizes the build for the best performance, ensuring fast loading and modern JavaScript output.

### `npm run preview`

Previews the production build locally.\
This is useful for ensuring the build works before deployment.
