# Technical Specification: [Page Name]

## 1. Component Specifications

### 1.1 [ComponentName]

#### Purpose
[What this component does]

#### Props Interface
```typescript
interface [ComponentName]Props {
  // Required props
  prop1: string;
  prop2: number;
  
  // Optional props
  prop3?: boolean;
  prop4?: () => void;
  
  // Children
  children?: React.ReactNode;
}
```

#### State Interface
```typescript
interface [ComponentName]State {
  field1: string;
  field2: boolean;
  field3: DataType | null;
}
```

#### Hooks Used
- `useState<[Type]>([initialValue])` - [Purpose]
- `useEffect` - [Purpose and dependencies]
- `useCallback` - [Purpose]
- `useMemo` - [Purpose]

#### Event Handlers
```typescript
const handleClick = (event: React.MouseEvent) => {
  // Handler logic
};

const handleSubmit = async (data: FormData) => {
  // Submit logic
};
```

#### Component Structure
```tsx
export const [ComponentName]: React.FC<[ComponentName]Props> = ({
  prop1,
  prop2,
  prop3 = defaultValue,
  children
}) => {
  // State
  const [state1, setState1] = useState<Type>(initialValue);
  
  // Effects
  useEffect(() => {
    // Effect logic
  }, [dependencies]);
  
  // Handlers
  const handleAction = useCallback(() => {
    // Handler logic
  }, [dependencies]);
  
  // Render
  return (
    <div>
      {/* Component JSX */}
    </div>
  );
};
```

### 1.2 [AnotherComponent]
[Repeat structure above]

## 2. Type Definitions

### 2.1 Data Types
```typescript
// User types
interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

// Form types
interface [Form]Data {
  field1: string;
  field2: number;
  field3?: boolean;
}

// API Response types
interface [Entity]Response {
  data: Entity[];
  meta: {
    total: number;
    page: number;
    perPage: number;
  };
}

// Error types
interface ApiError {
  message: string;
  code: string;
  details?: Record<string, string[]>;
}
```

### 2.2 Enums
```typescript
enum LoadingState {
  IDLE = 'idle',
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error'
}

enum [EntityName]Status {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending'
}
```

## 3. API Integration

### 3.1 API Client Setup
```typescript
// api/client.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor
apiClient.interceptors.request.use((config) => {
  // Add auth token, etc.
  return config;
});

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle errors
    return Promise.reject(error);
  }
);
```

### 3.2 API Functions
```typescript
// api/[entity].ts

export const get[Entity] = async (id: string): Promise<Entity> => {
  const response = await apiClient.get(`/[entity]/${id}`);
  return response.data;
};

export const create[Entity] = async (data: Create[Entity]Input): Promise<Entity> => {
  const response = await apiClient.post('/[entity]', data);
  return response.data;
};

export const update[Entity] = async (
  id: string, 
  data: Update[Entity]Input
): Promise<Entity> => {
  const response = await apiClient.put(`/[entity]/${id}`, data);
  return response.data;
};

export const delete[Entity] = async (id: string): Promise<void> => {
  await apiClient.delete(`/[entity]/${id}`);
};

export const list[Entities] = async (
  params?: ListParams
): Promise<[Entity]Response> => {
  const response = await apiClient.get('/[entity]', { params });
  return response.data;
};
```

## 4. State Management

### 4.1 Local State Pattern
```typescript
// For simple local state
const [data, setData] = useState<DataType | null>(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

### 4.2 Reducer Pattern
```typescript
// For complex state
type State = {
  data: DataType | null;
  loading: boolean;
  error: string | null;
};

type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: DataType }
  | { type: 'FETCH_ERROR'; payload: string }
  | { type: 'RESET' };

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS':
      return { ...state, loading: false, data: action.payload };
    case 'FETCH_ERROR':
      return { ...state, loading: false, error: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
};

const [state, dispatch] = useReducer(reducer, initialState);
```

### 4.3 Global Store (Zustand example)
```typescript
// store/[entity]Store.ts
import { create } from 'zustand';

interface [Entity]Store {
  // State
  entities: Entity[];
  selectedEntity: Entity | null;
  loading: boolean;
  
  // Actions
  fetchEntities: () => Promise<void>;
  selectEntity: (id: string) => void;
  clearSelection: () => void;
}

export const use[Entity]Store = create<[Entity]Store>((set, get) => ({
  entities: [],
  selectedEntity: null,
  loading: false,
  
  fetchEntities: async () => {
    set({ loading: true });
    try {
      const entities = await list[Entities]();
      set({ entities, loading: false });
    } catch (error) {
      set({ loading: false });
      // Handle error
    }
  },
  
  selectEntity: (id) => {
    const entity = get().entities.find(e => e.id === id);
    set({ selectedEntity: entity || null });
  },
  
  clearSelection: () => set({ selectedEntity: null })
}));
```

## 5. Form Handling

### 5.1 Form Validation Schema
```typescript
import { z } from 'zod';

const [form]Schema = z.object({
  field1: z.string().min(1, 'Field is required'),
  field2: z.string().email('Invalid email'),
  field3: z.number().min(0).max(100),
  field4: z.boolean().optional(),
});

type [Form]Data = z.infer<typeof [form]Schema>;
```

### 5.2 Form Component Pattern
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const [Form]Component = () => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset
  } = useForm<[Form]Data>({
    resolver: zodResolver([form]Schema)
  });
  
  const onSubmit = async (data: [Form]Data) => {
    try {
      await submitData(data);
      reset();
      // Success feedback
    } catch (error) {
      // Error handling
    }
  };
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Form fields */}
    </form>
  );
};
```

## 6. Error Handling

### 6.1 Error Boundary
```typescript
// components/ErrorBoundary.tsx
class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught:', error, errorInfo);
    // Log to error tracking service
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

### 6.2 Error Handling Pattern
```typescript
const fetchData = async () => {
  try {
    setLoading(true);
    setError(null);
    const data = await apiCall();
    setData(data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      setError(error.response?.data?.message || 'An error occurred');
    } else {
      setError('An unexpected error occurred');
    }
  } finally {
    setLoading(false);
  }
};
```

## 7. Loading States

### 7.1 Loading Component Patterns
```typescript
// Skeleton loading
const SkeletonLoader = () => (
  <div className="animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-3/4 mb-4" />
    <div className="h-4 bg-gray-200 rounded w-1/2" />
  </div>
);

// Spinner loading
const Spinner = () => (
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
);
```

## 8. Performance Optimization

### 8.1 Memoization
```typescript
// Memoize expensive computations
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);

// Memoize callbacks
const handleClick = useCallback(() => {
  doSomething(value);
}, [value]);

// Memoize components
const MemoizedComponent = React.memo(Component);
```

### 8.2 Code Splitting
```typescript
// Lazy load components
const HeavyComponent = lazy(() => import('./HeavyComponent'));

// Use with Suspense
<Suspense fallback={<Loading />}>
  <HeavyComponent />
</Suspense>
```

### 8.3 Debouncing and Throttling
```typescript
import { useDebounce } from 'use-debounce';

const SearchComponent = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebounce(searchTerm, 500);
  
  useEffect(() => {
    // Search with debounced term
    performSearch(debouncedSearchTerm);
  }, [debouncedSearchTerm]);
};
```

## 9. Testing Specifications

### 9.1 Unit Test Structure
```typescript
// [Component].test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { [Component] } from './[Component]';

describe('[Component]', () => {
  it('renders correctly', () => {
    render(<[Component] />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
  
  it('handles user interaction', () => {
    const handleClick = vi.fn();
    render(<[Component] onClick={handleClick} />);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalled();
  });
  
  it('displays error state', () => {
    render(<[Component] error="Error message" />);
    expect(screen.getByText('Error message')).toBeInTheDocument();
  });
});
```

### 9.2 Integration Test Structure
```typescript
describe('[Feature] Flow', () => {
  it('completes full user flow', async () => {
    render(<App />);
    
    // Step 1
    fireEvent.click(screen.getByText('Start'));
    
    // Step 2
    await waitFor(() => {
      expect(screen.getByText('Next Step')).toBeInTheDocument();
    });
    
    // Step 3
    fireEvent.click(screen.getByText('Complete'));
    
    // Verify
    await waitFor(() => {
      expect(screen.getByText('Success')).toBeInTheDocument();
    });
  });
});
```

## 10. Accessibility Specifications

### 10.1 ARIA Attributes
```typescript
<button
  aria-label="Close dialog"
  aria-pressed={isPressed}
  aria-expanded={isExpanded}
  aria-controls="menu-id"
>
  {/* Content */}
</button>
```

### 10.2 Keyboard Navigation
```typescript
const handleKeyDown = (event: React.KeyboardEvent) => {
  switch (event.key) {
    case 'Enter':
    case ' ':
      handleAction();
      break;
    case 'Escape':
      handleClose();
      break;
    case 'ArrowDown':
      moveFocusDown();
      break;
    case 'ArrowUp':
      moveFocusUp();
      break;
  }
};
```

## 11. Environment Configuration

### 11.1 Environment Variables
```typescript
// .env.local
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_APP_NAME=MyApp
DATABASE_URL=postgresql://...
SECRET_KEY=...
```

### 11.2 Type-safe Environment
```typescript
// lib/env.ts
const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  DATABASE_URL: z.string(),
  // ... other vars
});

export const env = envSchema.parse(process.env);
```

## 12. Constants and Configuration

```typescript
// constants/[page].ts
export const PAGE_CONFIG = {
  title: 'Page Title',
  description: 'Page description',
  itemsPerPage: 20,
  maxRetries: 3,
  timeout: 5000,
} as const;

export const API_ENDPOINTS = {
  LIST: '/api/items',
  GET: (id: string) => `/api/items/${id}`,
  CREATE: '/api/items',
  UPDATE: (id: string) => `/api/items/${id}`,
  DELETE: (id: string) => `/api/items/${id}`,
} as const;
```
