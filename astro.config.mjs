// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	build: {
		// Shared typography, cursor, and reset rules are reused on every route.
		// Keep them cacheable instead of duplicating them into each HTML document.
		inlineStylesheets: 'never',
	},
	image: {
		remotePatterns: [
			{
				protocol: 'https',
			},
		],
	},
});
