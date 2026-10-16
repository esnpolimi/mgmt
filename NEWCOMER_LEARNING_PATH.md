# Newcomer learning path

This project uses several technologies. You do not need to know everything before
starting, but the following order is recommended for understanding the codebase.
Each topic can be studied through the official documentation or another reliable
online resource.

## 1. Development and web fundamentals

Start with these concepts, which are useful in every part of the project:

1. **Git**: repositories, commits, branches, merge, rebase, remotes, and resolving
   conflicts.
2. **GitHub**: issues, pull requests, reviews, branch protection rules, and GitHub
   Actions.
3. **Command line and environment variables**: navigating directories, running
   commands, virtual environments, `.env` configuration, and keeping secrets out
   of the repository.
4. **Web fundamentals**: client/server architecture, HTTP methods and status codes,
   headers, cookies, JSON, CORS, and browser developer tools.
5. **REST APIs**: resources, endpoints, request/response bodies, authentication,
   authorization, validation, and pagination.

## 2. Backend: Python and Django

The backend is a modular monolith written in Python:

1. **Python 3.11**: modules, packages, classes, decorators, exceptions, type hints,
   virtual environments, and package installation with `pip`.
2. **Django 5**: projects, applications, settings, URL routing, models, views,
   forms, templates, the admin site, middleware, and management commands.
3. **Django REST Framework (DRF)**: serializers, API views, routers, permissions,
   authentication, filtering, and exception handling.
4. **Django ORM**: models, relationships, querysets, transactions, migrations,
   constraints, and the difference between lazy and evaluated queries.
5. **Django security**: CSRF, CORS, CSP, password handling, permissions, input
   validation, and safe handling of uploaded files.
6. **JWT authentication with Simple JWT**: access tokens, refresh tokens, token
   expiration, login/logout flows, and protecting API endpoints.

Useful backend libraries used by this project include `django-filter`,
`django-money`, `django-phonenumber-field`, `django-countries`,
`django-crispy-forms`, `ReportLab`, and `openpyxl`. Learn them after the Django
and DRF fundamentals, when working on the related module.

## 3. Database and persistence

The application uses MariaDB locally and in the main runtime, accessed from Django
through the MySQL-compatible driver:

1. **Relational database concepts**: tables, rows, primary keys, foreign keys,
   indexes, constraints, joins, normalization, and transactions.
2. **SQL**: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, filtering, joins, grouping,
   indexes, and basic query performance.
3. **MySQL/MariaDB**: connection settings, users and permissions, dumps, and
   importing/exporting databases.
4. **Django migrations**: creating, inspecting, applying, and rolling back schema
   changes safely.
5. **phpMyAdmin**: the local web interface provided by the Docker environment for
   inspecting the database.

Tests use SQLite in the test configuration, so also understand the differences
between SQLite and MariaDB/MySQL when diagnosing database-specific behavior.

## 4. Frontend: JavaScript and React

The frontend is a single-page application:

1. **Modern JavaScript**: modules, imports/exports, promises, `async`/`await`,
   destructuring, array methods, objects, and browser APIs.
2. **Node.js and npm**: `package.json`, dependencies, scripts, semantic versioning,
   and the `node_modules` directory.
3. **React 19**: components, JSX, props, state, hooks, forms, effects, conditional
   rendering, lists, and component composition.
4. **React Router**: client-side routes, nested routes, protected pages, and
   navigation in a single-page application.
5. **Vite**: development server, environment variables, build, and production
   preview.
6. **Material UI (MUI)**: layout, themes, responsive design, forms, tables,
   dialogs, icons, date pickers, and styling with Emotion.
7. **Frontend authentication**: storing and decoding JWTs, sending authorization
   headers, handling expiration, and protecting the user experience without
   treating client-side checks as the only security boundary.
8. **Frontend testing**: React Testing Library, `jest-dom`, `user-event`, and
   testing behavior rather than implementation details.

Additional frontend libraries include `material-react-table`, `Quill`,
`date-fns`, `dayjs`, `js-cookie`, and `@sentry/react`.

## 5. Running the complete system with Docker

Learn Docker after understanding the application layers:

1. **Docker basics**: images, containers, volumes, ports, environment variables,
   Dockerfiles, and bind mounts.
2. **Docker Compose**: services, networks, dependencies, persistent volumes, and
   service-to-service communication.
3. **This project's local services**: MariaDB, phpMyAdmin, Django backend, and
   React/Vite frontend.
4. **Container debugging**: logs, rebuilds, shell access, port conflicts, and
   persistence problems.

The local environment is defined in [`local.yml`](local.yml), with separate
Dockerfiles in [`backend/`](backend/) and [`frontend/`](frontend/).

## 6. External integrations

Study these only when working on the corresponding feature:

1. **Google APIs and OAuth 2.0**: service credentials, scopes, access tokens, and
   the Google Drive integration used for files and CSV audit data.
2. **SumUp API**: checkout creation, payment confirmation, webhooks, and
   idempotent payment reconciliation.
3. **SMTP and email delivery**: SMTP configuration, transactional email, and the
   development email backend.
4. **OIDC (OpenID Connect)**: identity providers, authorization code flow, tokens,
   and the Dokuwiki integration.
5. **Sentry**: error tracking, environment configuration, and privacy-safe
   diagnostic context.

Never commit API keys, private JSON credentials, passwords, or production
configuration to the repository.

## 7. Testing, quality, and delivery

Before contributing changes, become familiar with:

1. **Django tests**: test discovery, fixtures, isolated test databases,
   integration tests, and test settings.
2. **Frontend tests**: component rendering, user interactions, and assertions
   with React Testing Library.
3. **Linting and formatting**: ESLint and Prettier conventions used by the
   frontend.
4. **GitHub Actions**: workflow triggers, jobs, runners, caches, artifacts,
   secrets, and required status checks.
5. **CodeQL and code review**: static analysis, security findings, review comments,
   and the project merge process.

The backend test workflow runs for every pull request targeting `development`,
`staging`, or `main`, regardless of the source branch, and for every push to
`development`.
