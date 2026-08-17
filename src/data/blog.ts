import { getCollection, type CollectionEntry } from 'astro:content';

export const getPostSlug = (post: CollectionEntry<'blog'>) =>
	post.id.replace(/\.md$/, '').split('/').at(-1) ?? post.id.replace(/\.md$/, '');

export interface EditorialPostSummary {
	title: string;
	excerpt: string;
	href: string;
	image?: string;
	date: string;
	tags: string[];
	readingTime: string;
}

/** Calculate word count from Markdown source, mixing CJK characters and Latin words. */
export const calcWordCount = (body: string): number => {
	const stripped = body
		.replace(/^---[\s\S]*?---/, '')        // frontmatter
		.replace(/```[\s\S]*?```/g, ' ')      // fenced code
		.replace(/`[^`]+`/g, ' ')             // inline code
		.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // links and images
		.replace(/[#*_~>|\-]/g, ' ');         // markdown markers
	const zhChars = (stripped.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) ?? []).length;
	const noZh = stripped.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g, ' ');
	const enWords = noZh.split(/\s+/).filter((w) => /[a-zA-Z0-9]/.test(w)).length;
	return zhChars + enWords;
};

/** Mixed CJK/Latin reading time, roughly 400 chars/words per minute. */
export const calcReadingTime = (wordCount: number): string => {
	const minutes = Math.max(1, Math.ceil(wordCount / 400));
	return `${minutes} min read`;
};

export const getUpdatedAt = (post: CollectionEntry<'blog'>): Date =>
	post.data.updatedAt ?? post.data.publishDate;

export const sortPostsByUpdatedAt = (posts: CollectionEntry<'blog'>[]) =>
	[...posts].sort((a, b) => getUpdatedAt(b).valueOf() - getUpdatedAt(a).valueOf());

export const toEditorialPostSummary = (post: CollectionEntry<'blog'>): EditorialPostSummary => ({
	title: post.data.title,
	excerpt: post.data.excerpt,
	href: `/posts/${getPostSlug(post)}`,
	image: post.data.image,
	date: getUpdatedAt(post).toLocaleDateString('zh-CN', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}),
	tags: post.data.tags,
	readingTime: calcReadingTime(calcWordCount(post.body ?? '')),
});

export const normalizeTagName = (tag: string) => tag.normalize('NFKC').trim().toLocaleLowerCase('en-US');

export const getTagSlug = (tag: string) => {
	const normalized = normalizeTagName(tag);
	if (normalized === 'c#') return 'c-sharp';
	if (normalized === '.net') return 'dotnet';

	return normalized
		.replace(/[^\p{Letter}\p{Number}]+/gu, '-')
		.replace(/^-+|-+$/g, '');
};

export const getTagHref = (tag: string) => `/tags/${encodeURIComponent(getTagSlug(tag))}`;

export interface TagSummary {
	name: string;
	slug: string;
	count: number;
}

export const getTagSummaries = (posts: CollectionEntry<'blog'>[]): TagSummary[] => {
	const tags = new Map<string, TagSummary>();

	posts.forEach((post) => {
		post.data.tags.forEach((name) => {
			const slug = getTagSlug(name);
			const existing = tags.get(slug);
			if (existing && normalizeTagName(existing.name) !== normalizeTagName(name)) {
				throw new Error(`Tag slug collision: "${existing.name}" and "${name}" both resolve to "${slug}".`);
			}

			if (existing) existing.count += 1;
			else tags.set(slug, { name, slug, count: 1 });
		});
	});

	return [...tags.values()].sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, 'zh-CN'));
};

let directoryPromise: Promise<{
	entries: CollectionEntry<'blog'>[];
	posts: EditorialPostSummary[];
	tags: TagSummary[];
}> | undefined;

/** Shared build-time directory used by the home, article archive, and tag routes. */
export const getBlogDirectory = () => {
	directoryPromise ??= getCollection('blog').then((collection) => {
		const entries = sortPostsByUpdatedAt(collection);
		return {
			entries,
			posts: entries.map(toEditorialPostSummary),
			tags: getTagSummaries(entries),
		};
	});
	return directoryPromise;
};
