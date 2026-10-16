# ESN Politecnico Milano – New Management System

This is a web application designed to manage the activities and events of the Erasmus Student Network at Politecnico di Milano.
The system is built using **Django** (backend) and **React** (frontend), providing a modern and efficient user experience.


Copyright © 2025 Erasmus Student Network – Politecnico di Milano. This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
Please refer to the [LICENSE](LICENSE) file for more details.
---

# Git Workflow Guide

## Main Branches

* **`development`**: Development area for new features and fixes. All work is mainly done here by the developer members.
* **`staging`**: Staging area for manual tests after passing the automatic tests. The branch is dedicated for testing members.
* **`main`**: Stable, production-ready code. Only tested and approved code is merged here.

---
## Development workflow

Every change must start from an existing GitHub issue and follow this order:

1. **Select an issue**: choose the issue to work on from the repository's
   [GitHub Issues](https://github.com/esnpolimi/mgmt/issues).
2. **Assign the issue**: assign the issue to yourself before starting any work.
3. **Create the branch**: start from the latest `development` branch and create a
   branch named with the issue number followed by a short, lowercase description:

   ```text
   <issue-number>-<short-name>
   ```

   For example, issue `42` titled "Fix event subscription validation" becomes:
   `42-fix-event-subscription`.
4. **Develop and test**: implement the change on the issue branch, run the relevant
   tests locally, and push the branch to GitHub.
5. **Open a pull request**: when development is complete, open a PR from the issue
   branch to `development`. Link the related issue in the PR description.
6. **Review and merge**: address review feedback and wait for the required automatic
   checks (tests, CodeQL, and CodeRabbit analysis) to pass. After approval, merge the
   PR into `development`.
7. **Delete the branch**: once the PR has been merged, delete the remote issue
   branch and remove the local copy if it is no longer needed.

The `staging` branch is used for manual testing after changes have passed the
automatic checks. Changes are promoted from `development` to `staging`, and then
from `staging` to `main` only after the required validation and approval.

The backend test workflow runs automatically on every PR targeting the project's
integration branches (`development`, `staging`, or `main`), regardless of the
source branch. It also runs on every push to `development`. The `Backend Tests
(Tests)` check must be configured as a required status check in the protection
rules for the relevant target branches, so a PR cannot be merged until the
tests pass.

---

# Retrieve the Project

Clone the repository from the `development` branch:

```bash
git clone -b development git@github.com:esnpolimi/mgmt.git
```

Navigate into the project folder. You will find two main subfolders:

* `backend/`
* `frontend/`

⚠️ **Important:** Request private files from a teammate, as they are not included in the public repository for security reasons.
---

# Run Backend + Frontend Locally with Docker

1. Install [Docker](https://www.docker.com/products/docker-desktop).

   * **Windows**: Use Docker Desktop (ensure the daemon is running).
   * **macOS/Linux**: Install via package manager or Docker website.

2. From the project root (where `local.yml` is located), run:

   * Build the containers (first time or after changes to `Dockerfile` / `requirements.txt`):

     ```bash
     docker compose -f local.yml build
     ```

   * Start the containers:

     ```bash
     docker compose -f local.yml up
     ```

3. Reserve ports `8000`, `3000`, `8080`, and `3306`.

   * **Windows**:

     ```bash
     netsh int ipv4 add excludedportrange protocol=tcp startport=3000 numberofports=1
     netsh int ipv4 add excludedportrange protocol=tcp startport=8000 numberofports=1
     netsh int ipv4 add excludedportrange protocol=tcp startport=8080 numberofports=1
     netsh int ipv4 add excludedportrange protocol=tcp startport=3306 numberofports=1
     netsh int ipv4 show excludedportrange protocol=tcp
     ```

   * **macOS/Linux**: Normally no port reservation is needed, but make sure no services are running on those ports.

4. Access the services:

   * Backend: [http://localhost:8000](http://localhost:8000)
   * Frontend: [http://localhost:3000](http://localhost:3000)

---

# Import Database for Local Testing/Development

Next step is to import a local copy of a database dump (SQL file) into your local MySQL server:
- After running the Docker 'mgmt' container, access the url `http://localhost:8080` to open phpMyAdmin.
- Login with user `user` and password `password`
- Click on the `newgest` database, then Check All tables and Drop them, making sure no tables are present anymore
- Click on the `Import` tab, then choose the SQL file and click `Import` (leave all other options as default)


# Run Backend Locally (without Docker)

1. Install Python **3.11** (the same version used in the Dockerfile) and add it to your PATH.

2. Create and activate a virtual environment:

   ```bash
   python3.11 -m venv venv
   # macOS/Linux
   source venv/bin/activate
   # Windows (Command Prompt)
   venv\Scripts\activate
   # Windows (PowerShell)
   .\venv\Scripts\Activate.ps1
   ```

3. Install dependencies:

   ```bash
   cd backend
   pip install -r requirements.txt
   ```

4. Set environment variables and run the server:

   * **macOS/Linux**:

     ```bash
     DJANGO_ENV=dev DJANGO_SETTINGS_MODULE=backend.settings.dev python manage.py runserver
     ```
   * **Windows (Command Prompt)**:

     ```bash
     set DJANGO_ENV=dev && set DJANGO_SETTINGS_MODULE=backend.settings.dev && python manage.py runserver
     ```
   * **Windows (PowerShell)**:

     ```powershell
     $env:DJANGO_ENV="dev"; $env:DJANGO_SETTINGS_MODULE="backend.settings.dev"; python manage.py runserver
     ```

---

## Verify the Environment

To confirm the environment is set correctly, temporarily add this snippet to `manage.py`:

```python
import os
print("DJANGO_ENV:", os.getenv("DJANGO_ENV", "Not Set"))
print("DJANGO_SETTINGS_MODULE:", os.getenv("DJANGO_SETTINGS_MODULE"))
```

When running `runserver`, you should see `development` or `production`.

---

# Run Frontend Locally (without Docker)

1. Install [Node.js](https://nodejs.org/en/download) version **22** (same as in the Dockerfile).

2. Install dependencies:

   ```bash
   cd frontend
   npm install
   ```

3. Run the frontend:

   * Development mode:

     ```bash
     npm run dev
     ```

     Access it at [http://localhost:3000](http://localhost:3000).

   * Production build:

     ```bash
     npm run build
     ```

   * Preview production build locally:

     ```bash
     npm run preview
     ```

---

# Install and Update Dependencies

## Backend (Django)

```bash
cd backend
pip install <package>              # Installs the package in your venv
pip freeze > requirements.txt      # Updates requirements.txt with installed packages
```

⚠️ Note: `pip freeze` overwrites the file with all installed packages. Ensure only required packages are included.

To update all packages:

```bash
pip install pip-upgrader
pip-upgrade
```

## Frontend (React)

```bash
cd frontend
npm install <package>              # Installs the package and updates package.json
```

To update all packages:

```bash
npm install -g npm-check-updates
npx npm-check-updates -u
npm install
```
