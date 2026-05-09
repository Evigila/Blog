function extractText(node: any): string {
	if (node.type === 'text' || node.type === 'inlineCode') {
		return (node.value as string) ?? '';
	}
	if (Array.isArray(node.children)) {
		return (node.children as any[]).map(extractText).join(' ');
	}
	return '';
}

export function remarkWordCount() {
	return (tree: any, vfile: any) => {
		const text = extractText(tree);
		const zhChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) ?? []).length;
		const noZh = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g, ' ');
		const enWords = noZh.split(/\s+/).filter((w: string) => /[a-zA-Z0-9]/.test(w)).length;

		const data = vfile.data as Record<string, any>;
		data.astro ??= {};
		data.astro.frontmatter ??= {};
		data.astro.frontmatter.wordCount = zhChars + enWords;
	};
}
