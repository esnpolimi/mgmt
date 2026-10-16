# Run backend and frontend without Docker

Docker Compose is the standard way to run the project locally. Use this guide
only when you specifically need to run the backend or frontend directly on your
machine.

## Backend

1. Install Python **3.11** and add it to your PATH.
2. Create and activate a virtual environment from the repository root:

   ```bash
   python3.11 -m venv venv
   # macOS/Linux
   source venv/bin/activate
   # Windows (Command Prompt)
   venv\Scripts\activate
   # Windows (PowerShell)
   .\venv\Scripts\Activate.ps1
   ```

3. Install the backend dependencies:

   ```bash
   cd backend
   pip install -r requirements.txt
   ```

4. Configure the development environment and start Django:

   **macOS/Linux**

   ```bash
   DJANGO_ENV=dev DJANGO_SETTINGS_MODULE=backend.settings.dev python manage.py runserver
   ```

   **Windows (Command Prompt)**

   ```bat
   set DJANGO_ENV=dev && set DJANGO_SETTINGS_MODULE=backend.settings.dev && python manage.py runserver
   ```

   **Windows (PowerShell)**

   ```powershell
   $env:DJANGO_ENV="dev"; $env:DJANGO_SETTINGS_MODULE="backend.settings.dev"; python manage.py runserver
   ```

The backend is available at <http://localhost:8000>. This setup still requires a
running MySQL/MariaDB instance configured with the expected connection variables.

## Frontend

1. Install [Node.js](https://nodejs.org/en/download) version **22**.
2. Install the frontend dependencies:

   ```bash
   cd frontend
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

The frontend is available at <http://localhost:3000>.

To create and preview a production build:

```bash
npm run build
npm run preview
```

## Verify the environment

If Django does not load the expected settings, check the environment variables:

```python
import os
print("DJANGO_ENV:", os.getenv("DJANGO_ENV", "Not Set"))
print("DJANGO_SETTINGS_MODULE:", os.getenv("DJANGO_SETTINGS_MODULE"))
```

Remove this temporary diagnostic code after checking the configuration.
