import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
	plugins: [react()],
	test: {
		environment: 'jsdom',
		setupFiles: ['./tests/setup.ts'],
		include: ['**/*.{test,spec}.{ts,tsx,js,jsx}'],
		exclude: ['node_modules/**', '.next/**', 'tests/e2e/**'],
		passWithNoTests: true
	}
});
