import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.JWT_SECRET_KEY': JSON.stringify('test-secret-key-for-vitest-testing'),
    'process.env.JWT_SECRET': JSON.stringify('test-secret-key-for-testing'),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.next/',
        '**/*.d.ts',
        '**/*.config.*',
        'src/components/ui/**', // shadcn-ui 컴포넌트 제외
        'src/constants/**',
        'src/hooks/**', // 공통 훅은 제외
        '**/*.test.ts',
        '**/*.test.tsx',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
