# Workflow Guide: Practical Implementation

This guide provides detailed, practical steps for executing the dev-automation workflow.

## Prerequisites

Before starting, ensure your project has these npm scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "type-check": "tsc --noEmit",
    "lint": "next lint",
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  }
}
```

## Directory Structure

Create this structure in your project root:

```
project-root/
├── docs/
│   ├── requirements.md (starting point)
│   ├── prd.md
│   ├── database.md
│   ├── userflow.md
│   ├── plans/
│   │   ├── home-plan.md
│   │   ├── dashboard-plan.md
│   │   └── ...
│   ├── specs/
│   │   ├── home-spec.md
│   │   ├── dashboard-spec.md
│   │   └── ...
│   └── statements/
│       ├── home-statement.md
│       ├── dashboard-statement.md
│       └── ...
├── app/ (Next.js app directory)
├── components/
└── ... (other project files)
```

## Phase 1: Documentation Workflow

### Starting with Requirements

**Typical requirements.md structure:**

```markdown
# Project Requirements: [Project Name]

## Project Overview
[Brief description of what you're building]

## Target Users
- [User type 1]
- [User type 2]

## Core Features
1. [Feature 1]
   - [Sub-feature 1a]
   - [Sub-feature 1b]
2. [Feature 2]
   ...

## Technical Constraints
- Must use Next.js 14+
- Must support mobile devices
- [Other constraints]

## Success Criteria
- [Criterion 1]
- [Criterion 2]
```

### Step-by-Step: Creating PRD

1. **Read requirements carefully**
   ```bash
   # Ensure you have the requirements file
   cat docs/requirements.md
   ```

2. **Generate PRD using template**
   - Open `references/document_templates.md`
   - Copy PRD template
   - Fill in each section based on requirements
   - Ask clarifying questions if needed

3. **Focus areas when creating PRD:**
   - Expand vague requirements into specific features
   - Define user personas with concrete details
   - Add measurable success metrics
   - Identify technical requirements
   - Document assumptions

4. **Save PRD**
   ```bash
   # Create the file
   touch docs/prd.md
   # Paste your content
   ```

5. **Review checklist:**
   - [ ] All features from requirements are covered
   - [ ] User personas are clearly defined
   - [ ] Success metrics are measurable
   - [ ] Technical stack is specified
   - [ ] No section is marked as [TODO]

### Step-by-Step: Creating Database Design

1. **Analyze data needs from PRD**
   - List all entities mentioned
   - Identify relationships between entities
   - Note any special data requirements

2. **Create ERD first**
   ```mermaid
   erDiagram
       USER ||--o{ POST : creates
       USER ||--o{ COMMENT : writes
       POST ||--o{ COMMENT : has
   ```

3. **Define schemas for each entity**
   - Start with primary keys
   - Add required fields
   - Add optional fields
   - Define relationships
   - Add indexes

4. **Consider these questions:**
   - What queries will be most common?
   - What needs to be fast?
   - What data integrity constraints are critical?
   - What should cascade on delete?

5. **Save database design**
   ```bash
   touch docs/database.md
   ```

### Step-by-Step: Creating User Flow

1. **List all pages from PRD**
   ```
   - Landing page (/)
   - Login page (/login)
   - Dashboard (/dashboard)
   - ...
   ```

2. **Map navigation between pages**
   - Start from entry point (usually landing page)
   - Draw flow for each user journey
   - Include authentication flows
   - Include error paths

3. **Create Mermaid diagrams**
   ```mermaid
   flowchart TD
       Start[Landing Page] --> Login{Logged in?}
       Login -->|No| LoginPage[Login Page]
       Login -->|Yes| Dashboard
   ```

4. **Document state transitions**
   - What triggers each navigation?
   - What data is passed between pages?
   - What happens on errors?

5. **Save user flow**
   ```bash
   touch docs/userflow.md
   ```

### Phase 1 Checkpoint

```bash
# Verify all documents exist
ls -l docs/prd.md docs/database.md docs/userflow.md

# Quick review
echo "PRD word count: $(wc -w < docs/prd.md)"
echo "Database entities: $(grep -c "^###" docs/database.md)"
echo "Pages identified: $(grep -c "^###" docs/userflow.md)"
```

## Phase 2: Planning Workflow

### Identifying Pages

From `userflow.md`, extract all unique pages:

```bash
# Create plans directory
mkdir -p docs/plans docs/specs docs/statements

# List all pages from userflow
grep "^### \|^- /" docs/userflow.md
```

### Creating Implementation Plan for Each Page

**Example: Dashboard page**

1. **Analyze requirements for this specific page**
   - What features does dashboard need?
   - What data does it display?
   - Who can access it?

2. **List all components**
   ```
   Dashboard (page)
   ├── Header
   ├── Stats Cards
   ├── Recent Activity
   └── Quick Actions
   ```

3. **Define data requirements**
   - What API endpoints?
   - What data shape?
   - What's cached? What's fresh?

4. **Estimate complexity**
   - Count state variables needed
   - Count API calls
   - Identify external dependencies

5. **Create plan document**
   ```bash
   touch docs/plans/dashboard-plan.md
   ```

### Creating Specification for Each Page

1. **Expand the plan into detailed specs**
   - Component hierarchy with types
   - Exact prop interfaces
   - State management details
   - API integration code snippets

2. **Define TypeScript types**
   ```typescript
   interface DashboardProps {
     userId: string
   }
   
   interface DashboardData {
     stats: Stats
     activities: Activity[]
   }
   ```

3. **Specify all interactions**
   - What happens on button click?
   - What happens on form submit?
   - What happens on error?

4. **Create spec document**
   ```bash
   touch docs/specs/dashboard-spec.md
   ```

### Evaluating State Complexity

1. **Count all state variables**
   ```
   From spec:
   - Local state: 3 variables
   - Shared state: 1 variable
   - Form state: 5 fields
   - Derived state: 2 computations
   ```

2. **Count side effects**
   ```
   - useEffect for data fetching: 1
   - useEffect for debounce: 1
   - useEffect for subscription: 1
   Total: 3 side effects
   ```

3. **Calculate complexity score**
   ```
   Local state (3 × 1) = 3
   Shared state (1 × 2) = 2
   Forms (5 × 0.5) = 2.5
   Derived (2 × 1.5) = 3
   Side effects (3 × 2) = 6
   Total = 16.5 → LOW complexity
   ```

4. **Recommend state management**
   ```
   Score 0-20: useState + props
   Score 21-50: Zustand for shared, useState for local
   Score 51+: Consider Redux or split page
   ```

5. **Create statement document**
   ```bash
   touch docs/statements/dashboard-statement.md
   ```

### Phase 2 Checkpoint

```bash
# Count documents created
echo "Plans: $(ls -1 docs/plans/*.md 2>/dev/null | wc -l)"
echo "Specs: $(ls -1 docs/specs/*.md 2>/dev/null | wc -l)"
echo "Statements: $(ls -1 docs/statements/*.md 2>/dev/null | wc -l)"

# They should all match!
```

## Phase 3: Implementation Workflow

### Implementation Order Strategy

**Option 1: Bottom-Up (Recommended for complex apps)**
```
1. Shared components (buttons, inputs)
2. Page-specific components
3. Pages with no dependencies
4. Pages with dependencies
```

**Option 2: Feature-First (Recommended for MVPs)**
```
1. Core feature pages first
2. Supporting pages second
3. Nice-to-have pages last
```

**Option 3: Risk-First**
```
1. Most complex pages first (validate early)
2. Medium complexity
3. Simple pages last
```

### Implementing a Single Page

**Example: Implementing Dashboard**

#### 1. Create File Structure

```bash
# Create page file
mkdir -p app/dashboard
touch app/dashboard/page.tsx

# Create loading and error states
touch app/dashboard/loading.tsx
touch app/dashboard/error.tsx

# Create page-specific components
mkdir -p components/dashboard
touch components/dashboard/stats-card.tsx
touch components/dashboard/activity-list.tsx
```

#### 2. Implement Step-by-Step

**Step 2.1: Create basic page structure**

```typescript
// app/dashboard/page.tsx
export default function DashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1>
      {/* Components will go here */}
    </div>
  )
}
```

**Step 2.2: Add data fetching (server-side)**

```typescript
// app/dashboard/page.tsx
async function getStats() {
  const res = await fetch('https://api.example.com/stats', {
    cache: 'no-store'
  })
  return res.json()
}

export default async function DashboardPage() {
  const stats = await getStats()
  
  return (
    <div>
      <h1>Dashboard</h1>
      <pre>{JSON.stringify(stats, null, 2)}</pre>
    </div>
  )
}
```

**Step 2.3: Build UI components**

```typescript
// components/dashboard/stats-card.tsx
interface StatsCardProps {
  title: string
  value: number
  change: number
}

export function StatsCard({ title, value, change }: StatsCardProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3>{title}</h3>
      <p className="text-3xl font-bold">{value}</p>
      <p className={change > 0 ? 'text-green-600' : 'text-red-600'}>
        {change > 0 ? '+' : ''}{change}%
      </p>
    </div>
  )
}
```

**Step 2.4: Integrate components**

```typescript
// app/dashboard/page.tsx
import { StatsCard } from '@/components/dashboard/stats-card'

export default async function DashboardPage() {
  const stats = await getStats()
  
  return (
    <div className="container mx-auto p-6">
      <h1>Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard 
          title="Users" 
          value={stats.users} 
          change={stats.usersChange} 
        />
        <StatsCard 
          title="Revenue" 
          value={stats.revenue} 
          change={stats.revenueChange} 
        />
        <StatsCard 
          title="Orders" 
          value={stats.orders} 
          change={stats.ordersChange} 
        />
      </div>
    </div>
  )
}
```

**Step 2.5: Add client interactivity (if needed)**

```typescript
// components/dashboard/activity-list.tsx
'use client'

import { useState } from 'react'

export function ActivityList({ initialData }) {
  const [filter, setFilter] = useState('all')
  
  // Filter logic
  const filtered = initialData.filter(...)
  
  return (
    <div>
      <select value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="all">All</option>
        <option value="recent">Recent</option>
      </select>
      {/* Render filtered data */}
    </div>
  )
}
```

**Step 2.6: Add loading states**

```typescript
// app/dashboard/loading.tsx
export default function Loading() {
  return (
    <div className="container mx-auto p-6">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4" />
        <div className="grid grid-cols-3 gap-4">
          <div className="h-32 bg-gray-200 rounded" />
          <div className="h-32 bg-gray-200 rounded" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  )
}
```

**Step 2.7: Add error handling**

```typescript
// app/dashboard/error.tsx
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="container mx-auto p-6">
      <h2>Something went wrong!</h2>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
```

#### 3. Verify Implementation

**Checklist:**
```markdown
- [ ] Page renders without errors
- [ ] Data fetches successfully
- [ ] All components from spec are implemented
- [ ] Loading state displays correctly
- [ ] Error handling works
- [ ] TypeScript has no errors
- [ ] Matches design from spec
```

**Manual Testing:**
1. Run dev server: `npm run dev`
2. Navigate to page
3. Test all interactions
4. Test error cases (disconnect network)
5. Check loading states (throttle network)

#### 4. Run Quality Checks

```bash
# Type check
npm run type-check

# Lint
npm run lint

# Build check
npm run build
```

**Fix errors before proceeding!**

### When Implementation Doesn't Match Plan

**Scenario:** You realize the plan's complexity was underestimated

**Solution:**
1. Stop implementation
2. Update the plan document
3. Update the spec document
4. Update the statement document
5. Resume implementation with updated docs

**Keep SOT documents in sync with reality!**

### Handling API Development

**If APIs don't exist yet:**

**Option 1: Mock Data**
```typescript
// lib/mock-data.ts
export const mockStats = {
  users: 1234,
  usersChange: 12,
  revenue: 45678,
  revenueChange: -3,
  orders: 890,
  ordersChange: 8
}

// Use in page
const stats = process.env.NODE_ENV === 'development' 
  ? mockStats 
  : await getStats()
```

**Option 2: JSON Server**
```bash
# Install
npm install -D json-server

# Create db.json
{
  "stats": { ... }
}

# Run
npx json-server --watch db.json --port 3001
```

**Option 3: Next.js API Routes**
```typescript
// app/api/stats/route.ts
export async function GET() {
  return Response.json({
    users: 1234,
    // ... mock data
  })
}
```

### Phase 3 Checkpoint

After implementing each page:

```bash
# Test the page
open http://localhost:3000/[page-route]

# Run checks
npm run type-check && npm run lint && npm run build
```

Create checkpoint document:

```markdown
## Implementation Checkpoint: [Page Name]

**Date:** [Date]
**Status:** ✓ Complete

### Completed:
- [x] Page structure
- [x] Data fetching
- [x] UI components
- [x] Client interactivity
- [x] Loading states
- [x] Error handling

### Quality Checks:
- [x] TypeScript: No errors
- [x] Lint: No warnings
- [x] Build: Success
- [x] Manual testing: Passed

### Notes:
[Any important decisions or changes made]
```

## Phase 4: Testing Workflow

### Setting Up Vitest

**Install dependencies:**
```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/coverage-v8
```

**Create vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'vitest.setup.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
```

**Create vitest.setup.ts:**
```typescript
import '@testing-library/jest-dom'
```

### Writing Tests for a Page

**Example: Testing Dashboard**

#### 1. Create Test File

```bash
mkdir -p __tests__/app/dashboard
touch __tests__/app/dashboard/page.test.tsx
```

#### 2. Write Component Tests

```typescript
// __tests__/app/dashboard/page.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import DashboardPage from '@/app/dashboard/page'

// Mock fetch
global.fetch = vi.fn()

describe('Dashboard Page', () => {
  it('renders dashboard title', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      json: async () => ({ 
        users: 100, 
        usersChange: 10,
        revenue: 1000,
        revenueChange: 5,
        orders: 50,
        ordersChange: 3
      }),
      ok: true,
    } as Response)
    
    render(await DashboardPage())
    
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })
  
  it('displays stats correctly', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      json: async () => ({ 
        users: 100, 
        usersChange: 10,
        revenue: 1000,
        revenueChange: 5,
        orders: 50,
        ordersChange: 3
      }),
      ok: true,
    } as Response)
    
    render(await DashboardPage())
    
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('1000')).toBeInTheDocument()
  })
})
```

#### 3. Write Component Unit Tests

```typescript
// __tests__/components/dashboard/stats-card.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatsCard } from '@/components/dashboard/stats-card'

describe('StatsCard', () => {
  it('renders title and value', () => {
    render(<StatsCard title="Users" value={100} change={10} />)
    
    expect(screen.getByText('Users')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
  })
  
  it('shows positive change in green', () => {
    render(<StatsCard title="Users" value={100} change={10} />)
    
    const changeElement = screen.getByText('+10%')
    expect(changeElement).toHaveClass('text-green-600')
  })
  
  it('shows negative change in red', () => {
    render(<StatsCard title="Users" value={100} change={-5} />)
    
    const changeElement = screen.getByText('-5%')
    expect(changeElement).toHaveClass('text-red-600')
  })
})
```

#### 4. Write Interaction Tests

```typescript
// __tests__/components/dashboard/activity-list.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActivityList } from '@/components/dashboard/activity-list'

describe('ActivityList', () => {
  const mockData = [
    { id: 1, type: 'order', date: '2024-01-01' },
    { id: 2, type: 'refund', date: '2024-01-02' },
  ]
  
  it('filters activities', async () => {
    const user = userEvent.setup()
    render(<ActivityList initialData={mockData} />)
    
    // Initially shows all
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    
    // Filter to recent only
    await user.selectOptions(
      screen.getByRole('combobox'),
      'recent'
    )
    
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })
})
```

### Running Tests

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test -- --watch

# Run specific file
npm run test __tests__/components/stats-card.test.tsx
```

### Achieving 70% Coverage

#### 1. Check Current Coverage

```bash
npm run test:coverage
```

Output example:
```
File                    | % Stmts | % Branch | % Funcs | % Lines |
------------------------|---------|----------|---------|---------|
All files               |   45.2  |   38.1   |   50.0  |   45.8  |
  app/dashboard         |   30.0  |   25.0   |   40.0  |   30.0  |
  components/dashboard  |   60.0  |   50.0   |   60.0  |   60.0  |
```

#### 2. Identify Gaps

Open coverage report:
```bash
open coverage/index.html
```

Look for:
- Red lines (uncovered)
- Yellow lines (partially covered)
- Uncovered branches (if/else not fully tested)

#### 3. Prioritize Coverage

**High Priority (Cover First):**
1. Business logic functions
2. Form validation
3. Data transformations
4. Error handling

**Medium Priority:**
5. Component rendering
6. User interactions
7. State updates

**Low Priority:**
8. Simple presentational components
9. Configuration files
10. Type definitions

#### 4. Write Missing Tests

**Example: Uncovered error handling**

```typescript
// Before (40% coverage)
describe('fetchData', () => {
  it('fetches successfully', async () => {
    // Only tests success case
  })
})

// After (80% coverage)
describe('fetchData', () => {
  it('fetches successfully', async () => {
    // Tests success
  })
  
  it('handles network errors', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
    
    await expect(fetchData()).rejects.toThrow('Network error')
  })
  
  it('handles invalid response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    })
    
    await expect(fetchData()).rejects.toThrow()
  })
})
```

#### 5. Iterate Until 70%

```bash
# 1. Write tests
# 2. Check coverage
npm run test:coverage

# 3. If < 70%, identify gaps
# 4. Write more tests
# 5. Repeat until 70%
```

### Common Testing Patterns

#### Pattern 1: Mocking API Calls

```typescript
import { vi } from 'vitest'

global.fetch = vi.fn().mockResolvedValue({
  json: async () => ({ data: 'test' }),
  ok: true,
} as Response)
```

#### Pattern 2: Testing Async Components

```typescript
it('renders async component', async () => {
  render(await AsyncComponent())
  expect(screen.getByText('Content')).toBeInTheDocument()
})
```

#### Pattern 3: Testing Forms

```typescript
it('submits form', async () => {
  const user = userEvent.setup()
  const handleSubmit = vi.fn()
  
  render(<Form onSubmit={handleSubmit} />)
  
  await user.type(screen.getByLabelText('Name'), 'John')
  await user.click(screen.getByRole('button', { name: 'Submit' }))
  
  expect(handleSubmit).toHaveBeenCalledWith({ name: 'John' })
})
```

#### Pattern 4: Testing Error Boundaries

```typescript
it('handles errors', () => {
  const ThrowError = () => {
    throw new Error('Test error')
  }
  
  render(
    <ErrorBoundary>
      <ThrowError />
    </ErrorBoundary>
  )
  
  expect(screen.getByText('Something went wrong')).toBeInTheDocument()
})
```

### Phase 4 Checkpoint

```bash
# Final checks
npm run type-check
npm run lint  
npm run test:coverage
npm run build

# Verify coverage
echo "Current coverage:"
npm run test:coverage | grep "All files"
```

Coverage should show ≥ 70%.

## Tips and Best Practices

### 1. Start Small, Iterate Fast

Don't try to document everything perfectly upfront:
- Create minimal PRD first
- Implement one page
- Learn from implementation
- Update docs
- Repeat

### 2. Keep SOT Updated

When code diverges from docs:
- Update the docs immediately
- Don't let them fall out of sync
- SOT should always reflect reality

### 3. Use AI Assistance Effectively

When working with Claude:
- Show him the templates
- Ask him to generate specific documents
- Review and refine his output
- Ask clarifying questions

Example prompts:
```
"Using the PRD template, create a PRD for [project] based on these requirements..."

"Following the Plan template, create an implementation plan for the dashboard page..."

"Based on this spec, evaluate the state complexity using the Statement template..."
```

### 4. Don't Skip Quality Checks

Run checks frequently:
```bash
# After each file
npm run type-check

# After each component
npm run lint

# After each page
npm run build

# Before committing
npm run test:coverage
```

### 5. Test Critical Paths First

For coverage:
1. User registration flow
2. Main feature workflows
3. Payment/critical operations
4. Error handling for above

Then expand to 70%.

### 6. Document Decisions

When you make important decisions:
```markdown
## Decision: Use Zustand for State

**Date:** 2024-01-15
**Context:** Dashboard page state was getting complex
**Decision:** Use Zustand instead of Context
**Reasoning:** Better DevTools, simpler syntax
**Consequences:** Need to learn Zustand API
```

### 7. Parallel Work

If working solo:
- Phase 1 → Phase 2 → Phase 3 → Phase 4 (sequential)

If working in a team:
- Developer 1: Implement pages
- Developer 2: Write tests for completed pages
- Can work in parallel once Phase 2 is done

## Troubleshooting

### Problem: TypeScript Errors After Changes

**Solution:**
```bash
# Restart TypeScript server
# In VSCode: Cmd+Shift+P → "TypeScript: Restart TS Server"

# Check tsconfig.json
cat tsconfig.json

# Clear Next.js cache
rm -rf .next
```

### Problem: Tests Failing After Refactor

**Solution:**
```bash
# Update test mocks
# Check if component props changed
# Update test assertions

# Run single test in debug mode
npm run test -- __tests__/specific.test.tsx --reporter=verbose
```

### Problem: Coverage Stuck Below 70%

**Solution:**
1. Check coverage report HTML
2. Find uncovered files
3. Prioritize business logic
4. Skip trivial getters/setters
5. May need to refactor untestable code

### Problem: Build Succeeds But Runtime Errors

**Solution:**
```bash
# Check dynamic imports
# Verify environment variables
# Check for missing dependencies

# Test production build locally
npm run build
npm start
```

## Conclusion

This workflow ensures:
- ✅ Comprehensive documentation (SOT)
- ✅ Structured implementation
- ✅ Quality assurance at each step
- ✅ 70% test coverage
- ✅ Clean, maintainable codebase

Follow the phases sequentially, use checkpoints frequently, and keep documents updated. Happy coding!
