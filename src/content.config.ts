import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
	loader: glob({
		pattern: '**/*.md',
		base: './src/content/blog',
	}),
	schema: z.object({
		title: z.string(),
		excerpt: z.string(),
		tags: z.array(z.string()).min(1),
		license: z.string().default('CC BY-NC-SA 4.0'),
		// YAML parses "2026-05-01" as UTC midnight; transform to local midnight so
		// toLocaleDateString() shows the correct date in all timezones.
		publishDate: z.coerce.date().transform(
			(d) => new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
		),
		// Injected by remark-modified-time plugin at build time:
		updatedAt: z.coerce.date().optional().transform(
			(d) => d && new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
		),
	}),
});

export const collections = {
	blog,
};