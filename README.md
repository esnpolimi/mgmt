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

Remember to reserve the ports 8000, 3000, 8080 and 3306 on your machine, as they will be used by the backend and frontend respectively:
``` bash
netsh int ipv4 add excludedportrange protocol=tcp startport=3000 numberofports=1
netsh int ipv4 add excludedportrange protocol=tcp startport=8000 numberofports=1
netsh int ipv4 add excludedportrange protocol=tcp startport=8080 numberofports=1
netsh int ipv4 add excludedportrange protocol=tcp startport=3306 numberofports=1
netsh int ipv4 show excludedportrange protocol=tcp
```
This will expose the backend on [http://localhost:8000](http://localhost:8000) and the frontend on [http://localhost:3000](http://localhost:3000).

Enjoy!

# Run Backend on Local (w/o Docker)

Set up a virtual environment and install the required packages, **after having locally installed and added to PATH the same python verison os the one in the Dockerfile (3.11 as of June 2025)**:
``` bash
python3.11 -m venv venv
source venv/bin/activate  # On macOS/Linux
venv\Scripts\activate  # On Windows
.\venv\Scripts\Activate.ps1 # On Windows PowerShell
cd backend
pip install -r requirements.txt
```

To ensure your Django project runs with the correct environment (`development` or `production`), you need to set the environment variable `DJANGO_ENV` **before** running the `python manage.py runserver` command.
## **On macOS/Linux**
You can export the environment variable using the `export` command in your terminal:
``` bash
DJANGO_ENV=dev DJANGO_SETTINGS_MODULE=backend.settings.dev python manage.py runserver # On macOS/Linux
$set DJANGO_ENV="dev" && set DJANGO_SETTINGS_MODULE="backend.settings.dev" && python manage.py runserver # On Windows (Command Prompt)
$env:DJANGO_ENV="dev"; $env:DJANGO_SETTINGS_MODULE="backend.settings.dev"; python manage.py runserver # On Windows (PowerShell)
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

After having [installed](https://nodejs.org/en/download) the same version of Node as from the frontend's Dockerfile (22 as of June 2025), execute:
``` bash
cd frontend
npm install
```

Now you can run the frontend in development mode:
### `npm run dev`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will (hot) reload when you make changes.\
You may also see any lint errors in the console.

### `npm run build`

Builds the app for **production** to the `build` folder.\
It optimizes the build for the best performance, ensuring fast loading and modern JavaScript output.

### `npm run preview`

Previews the production build locally.\
This is useful for ensuring the build works before deployment.


## Install and Update backend and frontend dependencies

For backend dependencies, follow these steps:

```bash
cd backend
pip install *package* # the package will be installed in the local virtual environment
pip freeze > requirements.txt # this will update the requirements.txt file with the installed packages
# BEWARE this will overwrite the file and add all packages installed in the virtual environment, so make sure to have only the packages you need installed, or to manually remove the ones you don't need

# To update all packages, you can use pip-upgrader:
pip install pip-upgrader
pip-upgrade
```

For the frontend:
```bash
cd frontend
npm install *package* # the package will be installed globally AND update the package.json file!

# To update all packages, you can use npm-check-updates:
npm install -g npm-check-updates
npx npm-check-updates -u
npm install
```
