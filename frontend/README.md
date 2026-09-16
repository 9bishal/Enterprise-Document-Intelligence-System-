# Frontend - Document Intelligent System

React + Vite frontend for the Document Intelligent System. Provides the chat interface, document management, RAG pipeline visualization, admin dashboard, and landing page.

## Tech Stack

- **Framework**: React 18.x
- **Build Tool**: Vite
- **Styling**: CSS custom properties (navy/gold PERC-inspired design system)
- **State Management**: React Hooks + context-based reducers
- **Routing**: React Router
- **HTTP Client**: Fetch API
- **Icons**: SVG component library

## Project Structure

```
frontend/src/
├── pages/                    # Page-level components
│   ├── QueryPage.jsx        # Main chat interface with RAG pipeline
│   ├── DocumentsPage.jsx    # Document management (upload, list, delete)
│   └── SettingsPage.jsx     # System configuration (admin-managed view)
│
├── components/              # Reusable components
│   ├── ChatWindow.jsx       # Chat UI (messages, input, sessions)
│   ├── Visualizer.jsx       # RAG pipeline visualization (steps, cost, metrics)
│   ├── LandingPage.jsx      # Welcome page with feature showcase
│   ├── ErrorBoundary.jsx    # React error boundary
│   ├── Toast.jsx            # Toast notification system
│   ├── Icons.jsx            # SVG icon library (40+ components)
│   ├── LoginScreen.jsx      # Authentication
│   ├── MainLayout.jsx       # App shell layout
│   ├── Sidebar.jsx          # Sidebar navigation
│   ├── WorkspacePage.jsx    # Workspace container
│   └── admin/               # Admin components
│       ├── AdminAnalytics.jsx
│       ├── AdminGraph.jsx
│       ├── AdminRoster.jsx
│       ├── AdminSystemConfig.jsx
│       ├── MetricCard.jsx
│       └── AdminStyles.js
│
├── utils/
│   ├── api.js               # API client (uses safeLocalStorage)
│   └── constants.js         # Shared constants (API_BASE, model tiers, providers)
│
├── App.jsx                  # Main app with routing
├── index.css                # Global styles (design tokens)
└── main.jsx                 # Entry point
```

## Key Components

### QueryPage
- Chat interface with message history
- Session CRUD (create, rename, delete with 3-dot menu)
- Department filter for document scoping
- RAG pipeline visualizer with cost/model/metrics display
- Inline rename with check/cancel buttons
- SVG icon-based UI (no emoji)

### Visualizer
- Real-time RAG pipeline step visualization
- Cost display (estimated_cost_usd)
- Model info (model_used)
- Token usage (input_tokens, output_tokens)
- Latency display (latency_ms)
- Cache hit indicator (cache_hit)
- Evaluation display (heuristic score, LLM judge)

### LandingPage
- Feature showcase (6 feature cards with SVG icons)
- 4-step getting started guide
- Navigation to login/signup

### DocumentsPage
- Document list with search, filter, sort
- Upload (single file) with drag-drop
- SVG icon usage for file types and actions

### SettingsPage
- Simplified view (admin-managed)
- Model tier legend display (Economy, Standard, Advanced)
- Security/privacy info cards with SVG icons

## Design System

The frontend uses a navy/gold PERC-inspired design system with CSS custom properties:

```css
--primary: #243252;       /* Deep navy */
--accent: #c8a44d;        /* Warm gold */
--bg-primary: #f6f5f1;    /* Warm ivory */
--font-display: 'Playfair Display', Georgia, serif;
```

## State Management

- Component-level useState hooks
- Derived state via useMemo (e.g., lastAssistantMsg)
- safeLocalStorage for token persistence (with SSR safety)

## Development

```bash
npm install
npm run dev
```

Frontend available at `http://localhost:5173`.

## Build

```bash
npm run build
# Output in dist/ directory
```
