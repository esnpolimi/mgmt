# Dynamic Content Management System

## Description

This module allows dynamic management of homepage content through an administration interface. The system is designed around two fixed content categories: **USEFUL LINKS** and **WIKI AND TUTORIALS**.

## Main Features

- **Two predefined categories**: USEFUL LINKS and WIKI AND TUTORIALS
- **Mandatory fields for each link**: Title, Description, URL, and Color
- **Full admin-panel management**: only Board members can modify content
- **All links are loaded from the database**: no hardcoded content

## Structure

### Backend (`backend/content/`)

- **models.py**: defines `ContentSection` and `ContentLink`
  - `ContentSection`: content section (for example "USEFUL LINKS")
  - `ContentLink`: single link inside a section

- **serializers.py**: REST serializers for API payloads
- **views.py**: ViewSets with permission checks (only Board can modify)
- **urls.py**: API routes for content management
- **admin.py**: Django Admin integration

### Frontend

- **Pages/ContentManager.jsx**: admin page for sections and links
- **Pages/Home.jsx**: homepage rendering dynamic content
- **Components/ProtectedRoute.jsx**: supports `requiredGroup`

## API Endpoints

```
GET    /backend/content/sections/                  - list sections
GET    /backend/content/sections/active_sections/  - list active sections with links
POST   /backend/content/sections/                  - create section (Board or users with can_manage_content)
PATCH  /backend/content/sections/{id}/             - update section (Board or users with can_manage_content)
DELETE /backend/content/sections/{id}/             - delete section (Board or users with can_manage_content)

GET    /backend/content/links/                     - list links
POST   /backend/content/links/                     - create link (Board or users with can_manage_content)
PATCH  /backend/content/links/{id}/                - update link (Board or users with can_manage_content)
DELETE /backend/content/links/{id}/                - delete link (Board or users with can_manage_content)
```

## Permissions

- **Read**: all authenticated users
- **Write**: Board members and users with can_manage_content=True

## Setup and Migration

1. **Run migrations**:
```bash
cd backend
python manage.py migrate
```

2. **Populate initial content data**:
```bash
python manage.py populate_content
```

This command automatically creates the two fixed sections (USEFUL LINKS and WIKI AND TUTORIALS) and populates initial links.

## Models

### ContentSection
- `title`: category (`LINK_UTILI` or `WIKI_TUTORIAL`) - **unique field**
- `order`: display order
- `is_active`: active/inactive flag
- `created_by`: creator user
- `created_at`/`updated_at`: timestamps

Note: sections are fixed to two categories by design.

### ContentLink
- `section`: foreign key to `ContentSection`
- `name`: link title - **required**
- `description`: link description - **required**
- `url`: link URL - **required**
- `color`: hexadecimal color (for example `#1976d2`) - **required**
- `order`: order inside the section
- `is_active`: active/inactive flag
- `created_by`: creator user
- `created_at`/`updated_at`: timestamps

All `name`, `description`, `url`, and `color` fields are mandatory.

## Special Actions

~~For links that should trigger custom actions (for example opening a modal), set `action_type`.~~

**Removed**: `action_type` has been removed. All links are standard URL links.

## Fallback Behavior

~~If dynamic content loading fails, the homepage automatically uses static hardcoded fallback content.~~

**Updated**: all content is loaded from the database. Static fallback content is no longer used. If loading fails, the user sees an error message.

## Access to Content Manager

The content management page is available only to Board members via:
- sidebar item: "Content Management"
- direct URL: `/content-manager`

## Content Manager Capabilities

### Sections
- **Two fixed sections**: USEFUL LINKS and WIKI AND TUTORIALS
- display-only for sections (no create/delete in UI)
- each section shows the current number of links

### Links
- add a link to a section
- **required fields**:
  - **Title**: link name
  - **Description**: descriptive text
  - **Link/URL**: full URL (for example `https://...`)
  - **Color**: hexadecimal color (for example `#1976d2`)
- set display order
- activate/deactivate
- delete

### Validation
The page validates required fields before save.

## Technical Notes

- Content is loaded whenever the homepage is opened.
- Caching is currently not implemented (fresh data on each homepage visit).
- Inactive content is not shown to users.
- Display ordering is controlled by the `order` field.
