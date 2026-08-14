import { defineConfig } from 'astro/config';
import legacy from '@vitejs/plugin-legacy';

// https://astro.build/config
export default defineConfig({
	server: {
		host: true,
	},
	vite: {
		plugins: [
			legacy({
				targets: ['defaults', 'not IE 11'],
			}),
		],
	},
});
