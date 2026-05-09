import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import type { AstroIntegration } from 'astro';

export interface PostMeta {
	publishDate: string;
	updatedAt: string;
	wordCount: number;
}

export type PostMetaStore = Record<string, PostMeta>;

// ── Word count ─────────────────────────────────────────────────────────────────

function stripMarkdown(src: string): string {
	return src
		.replace(/^---[\s\S]*?---\n?/, '')
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/`[^`\n]*`/g, ' ')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/^#{1,6}\s+/gm, '')
		.replace(/[*_~>|\\]/g, ' ')
		.replace(/\n+/g, ' ');
}

function countWords(raw: string): number {
	const plain = stripMarkdown(raw);
	const zhChars = (plain.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) ?? []).length;
	const noZh = plain.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g, ' ');
	const enWords = noZh.split(/\s+/).filter((w) => /[a-zA-Z0-9]/.test(w)).length;
	return zhChars + enWords;
}

// ── Frontmatter helper ─────────────────────────────────────────────────────────

function parseFrontmatterDate(content: string, field: string): Date | null {
	const m = content.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
	if (!m) return null;
	const d = new Date(m[1].trim());
	return isNaN(d.getTime()) ? null : d;
}

// ── Core sync logic ────────────────────────────────────────────────────────────

function syncMeta(root: string, log: (msg: string) => void): void {
	const contentDir = join(root, 'src/content/blog');
	const metaPath = join(root, 'src/data/post-meta.json');

	let store: PostMetaStore = {};
	if (existsSync(metaPath)) {
		try {
			store = JSON.parse(readFileSync(metaPath, 'utf-8')) as PostMetaStore;
		} catch {
			// corrupted file — start fresh
		}
	}

	const files = readdirSync(contentDir).filter((f) => f.endsWith('.md'));

	for (const file of files) {
		const slug = basename(file, '.md');
		const filePath = join(contentDir, file);
		const raw = readFileSync(filePath, 'utf-8');
		const { mtime } = statSync(filePath);
		const wordCount = countWords(raw);

		// publishDate is set once; preserved across rebuilds
		let publishDate: string;
		if (store[slug]?.publishDate) {
			publishDate = store[slug].publishDate;
		} else {
			const fromFrontmatter = parseFrontmatterDate(raw, 'publishDate');
			publishDate = (fromFrontmatter ?? mtime).toISOString();
		}

		store[slug] = {
			publishDate,
			updatedAt: mtime.toISOString(),
			wordCount,
		};
	}

	// Prune entries for deleted posts
	const validSlugs = new Set(files.map((f) => basename(f, '.md')));
	for (const slug of Object.keys(store)) {
		if (!validSlugs.has(slug)) delete store[slug];
	}

	const dir = dirname(metaPath);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	writeFileSync(metaPath, JSON.stringify(store, null, '\t') + '\n');
	log(`[post-meta-sync] synced ${files.length} posts → src/data/post-meta.json`);
}

// ── Astro integration ──────────────────────────────────────────────────────────

export function postMetaSync(): AstroIntegration {
	return {
		name: 'post-meta-sync',
		hooks: {
			'astro:config:setup': ({ updateConfig, logger }) => {
				const root = process.cwd();
				const log = logger.info.bind(logger);

				// Run immediately so the JSON is fresh before Vite imports it
				syncMeta(root, log);

				updateConfig({
					vite: {
						plugins: [
							{
								name: 'post-meta-sync-vite',
								// Re-sync at the start of every production build
								buildStart() {
									syncMeta(root, log);
								},
								// In dev, re-sync + invalidate when any blog .md changes
								handleHotUpdate({ file, server }) {
									if (
										file.endsWith('.md') &&
										file.replace(/\\/g, '/').includes('/content/blog/')
									) {
										syncMeta(root, log);
										// Invalidate the cached post-meta.json module
										const metaModPath = join(root, 'src/data/post-meta.json');
										const mod =
											server.moduleGraph.getModuleById(metaModPath) ??
											server.moduleGraph.getModuleById(
												'/' + metaModPath.replace(/\\/g, '/').replace(/^.*?\/src\//, 'src/'),
											);
										if (mod) {
											server.moduleGraph.invalidateModule(mod);
										}
										// Full-reload so updated wordCount / updatedAt is reflected
										server.ws.send({ type: 'full-reload' });
									}
								},
							},
						],
					},
				});
			},
		},
	};
}
