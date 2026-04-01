# LinkedIn Automation - Frontend Dashboard

React-based dashboard for managing LinkedIn prospects extracted via Chrome extension.

## Tech Stack

- **React 18** - UI library
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **React Router v6** - Client-side routing
- **TanStack Query (React Query)** - Server state management
- **Zustand** - Client state management
- **Axios** - HTTP client

## Features

- ✅ User authentication (login/register)
- ✅ Prospect list with pagination
- ✅ Filters (search, connection status, tags)
- ✅ Prospect CRUD operations
- ✅ Tag management
- ✅ Statistics dashboard
- ✅ Responsive design

## Prerequisites

- Node.js 18+ and npm
- Laravel backend running on `http://localhost:8000`

## Installation

1. Navigate to frontend directory:
```bash
cd C:\Users\a2z\linkedin-automation\frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env.local` file (copy from `.env.example`):
```
VITE_API_BASE_URL=http://localhost:8000/api
```

## Development

Start the development server:
```bash
npm run dev
```

The app will run on `http://localhost:3000`

## Building for Production

Build the project:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── common/          # Reusable UI components
│   │   ├── layout/          # Layout components (Header, Layout)
│   │   └── prospects/       # Prospect-specific components
│   ├── hooks/               # React Query hooks
│   ├── pages/               # Page components (routes)
│   ├── services/            # API service layer
│   ├── store/               # Zustand stores
│   ├── utils/               # Helper functions and constants
│   ├── App.jsx              # Main app with routing
│   ├── main.jsx             # Entry point
│   └── index.css            # Global styles
├── public/                  # Static assets
├── .env.local               # Environment variables
└── package.json
```

## Available Routes

- `/login` - User login
- `/register` - User registration
- `/prospects` - Prospects list (protected)
- `/tags` - Tag management (protected)

## API Integration

The frontend connects to the Laravel backend API at `http://localhost:8000/api`.

### Authentication
- Token-based authentication using Laravel Sanctum
- Token stored in localStorage and Zustand store
- Automatic redirect to login on 401 errors

### API Endpoints Used
- `POST /register` - Create account
- `POST /login` - Login
- `POST /logout` - Logout
- `GET /prospects` - Get prospects (with filters)
- `PUT /prospects/:id` - Update prospect
- `DELETE /prospects/:id` - Delete prospect
- `GET /prospects/stats` - Get statistics
- `POST /prospects/:id/tags` - Attach tags
- `DELETE /prospects/:id/tags/:id` - Detach tag
- `GET /tags` - Get tags
- `POST /tags` - Create tag
- `PUT /tags/:id` - Update tag
- `DELETE /tags/:id` - Delete tag

## State Management

### Zustand Stores
- `authStore` - Authentication state (token, user, isAuthenticated)
- `uiStore` - UI state (modals, sidebar)

### React Query
- Handles server state, caching, and mutations
- Automatic refetching and cache invalidation
- Optimistic updates for better UX

## Key Features

### Prospects Management
- Paginated list with 15/25/50/100 items per page
- Search by name, company, or headline
- Filter by connection status and tags
- Edit prospect details
- Delete prospects
- Add/remove tags from prospects

### Tag Management
- Create tags with custom colors
- Edit tag name and color
- Delete tags (removes from all prospects)
- View prospect count per tag

### Authentication
- Register with name, email, password
- Login with email and password
- Automatic token refresh
- Protected routes with automatic redirect

## Troubleshooting

### CORS Errors
Ensure Laravel backend has CORS properly configured for `http://localhost:3000`

### API Connection Failed
1. Check backend is running on `http://localhost:8000`
2. Verify `.env.local` has correct `VITE_API_BASE_URL`
3. Check browser console for specific errors

### Build Errors
1. Delete `node_modules` and `package-lock.json`
2. Run `npm install` again
3. Clear Vite cache: `rm -rf node_modules/.vite`

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## License

Private project - All rights reserved
