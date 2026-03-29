import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		command: 'npm run dev',
		env: {
			POSTGRES_URL: 'postgres://localhost:5432/trustops'
		},
		url: 'http://localhost:3000',
		timeout: 120000,
		reuseExistingServer: true
	},
	use: {
		baseURL: 'http://localhost:3000'
	},
	testDir: './tests/e2e'
});
