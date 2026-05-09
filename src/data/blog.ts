import type { CollectionEntry } from 'astro:content';

export const getPostSlug = (post: CollectionEntry<'blog'>) =>
	post.id.replace(/\.md$/, '').split('/').at(-1) ?? post.id.replace(/\.md$/, '');

/** 从 Markdown 原文动态计算字数（中文字符 + 英文词） */
export const calcWordCount = (body: string): number => {
	const stripped = body
		.replace(/^---[\s\S]*?---/, '')        // frontmatter
		.replace(/```[\s\S]*?```/g, ' ')      // 代码块
		.replace(/`[^`]+`/g, ' ')             // 行内代码
		.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // 链接/图片
		.replace(/[#*_~>|\-]/g, ' ');         // markdown 符号
	const zhChars = (stripped.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) ?? []).length;
	const noZh = stripped.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g, ' ');
	const enWords = noZh.split(/\s+/).filter((w) => /[a-zA-Z0-9]/.test(w)).length;
	return zhChars + enWords;
};

/** 阅读时长：中文/英文混合，约 400 字/词 每分钟 */
export const calcReadingTime = (wordCount: number): string => {
	const minutes = Math.max(1, Math.ceil(wordCount / 400));
	return `约 ${minutes} 分钟`;
};

export const getUpdatedAt = (post: CollectionEntry<'blog'>): Date =>
	post.data.updatedAt ?? post.data.publishDate;

export const sortPostsByPublishDate = (posts: CollectionEntry<'blog'>[]) =>
	[...posts].sort((a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf());

export const sortPostsByUpdatedAt = (posts: CollectionEntry<'blog'>[]) =>
	[...posts].sort((a, b) => getUpdatedAt(b).valueOf() - getUpdatedAt(a).valueOf());

export const getSortedTagNamesByCount = (posts: CollectionEntry<'blog'>[]) => {
	const tagCounts = posts.reduce((counts, post) => {
		post.data.tags.forEach((tag) => {
			counts.set(tag, (counts.get(tag) ?? 0) + 1);
		});

		return counts;
	}, new Map<string, number>());

	return [...tagCounts.entries()]
		.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'zh-CN'))
		.map(([tag]) => tag);
};