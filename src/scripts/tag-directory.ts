const getTagSlugFromUrl = (value: string) => {
	const url = new URL(value, window.location.href);
	if (url.origin !== window.location.origin) return undefined;
	const match = url.pathname.match(/^\/tags(?:\/([^/]+))?\/?$/);
	if (!match) return undefined;
	return match[1] ? decodeURIComponent(match[1]) : '';
};

export const initTagDirectories = () => {
	document.querySelectorAll<HTMLElement>('[data-tag-directory]').forEach((root) => {
		if (root.dataset.tagDirectoryInitialized === 'true') return;
		root.dataset.tagDirectoryInitialized = 'true';

		const filters = [...root.querySelectorAll<HTMLAnchorElement>('[data-tag-slug]')];
		const cards = [...root.querySelectorAll<HTMLElement>('[data-post-card]')];
		const filterBySlug = new Map(filters.map((filter) => [filter.dataset.tagSlug ?? '', filter]));
		const cardRecords = cards.map((card) => ({
			card,
			tags: new Set((card.dataset.tagSlugs ?? '').split(/\s+/).filter(Boolean)),
		}));
		const results = root.querySelector<HTMLElement>('[data-tag-results]');
		const announcer = root.querySelector<HTMLElement>('[data-tag-announcer]');
		const emptyState = root.querySelector<HTMLElement>('[data-tag-empty]');
		const scrollOwner = root.closest<HTMLElement>('[data-workspace-stage]')
			?? document.scrollingElement as HTMLElement;
		if (!results || filters.length === 0) return;

		const knownFilter = (slug: string) => filterBySlug.get(slug);
		const revealFilter = (filter: HTMLAnchorElement) => {
			const owner = filter.closest<HTMLElement>('[data-tag-filters]');
			if (!owner) return;
			const ownerRect = owner.getBoundingClientRect();
			const filterRect = filter.getBoundingClientRect();
			let top = owner.scrollTop;
			let left = owner.scrollLeft;
			if (filterRect.top < ownerRect.top) top -= ownerRect.top - filterRect.top;
			else if (filterRect.bottom > ownerRect.bottom) top += filterRect.bottom - ownerRect.bottom;
			if (filterRect.left < ownerRect.left) left -= ownerRect.left - filterRect.left;
			else if (filterRect.right > ownerRect.right) left += filterRect.right - ownerRect.right;
			owner.scrollTo({ top, left, behavior: 'auto' });
		};
		const alignResults = () => {
			window.requestAnimationFrame(() => {
				const ownerRect = scrollOwner.getBoundingClientRect();
				const resultsTop = results.getBoundingClientRect().top - ownerRect.top + scrollOwner.scrollTop;
				scrollOwner.scrollTo({ top: Math.max(resultsTop - 128, 0), behavior: 'auto' });
			});
		};

		const applyFilter = (
			slug: string,
			options: { pushHistory?: boolean; alignResults?: boolean; announce?: boolean } = {},
		) => {
			const selectedFilter = knownFilter(slug);
			if (!selectedFilter) return false;

			let visibleCount = 0;
			cardRecords.forEach(({ card, tags: cardTags }) => {
				const visible = !slug || cardTags.has(slug);
				const shouldHide = !visible;
				if (card.hidden !== shouldHide) card.hidden = shouldHide;
				if (visible) visibleCount += 1;
			});

			filters.forEach((filter) => {
				if (filter === selectedFilter) filter.setAttribute('aria-current', 'true');
				else filter.removeAttribute('aria-current');
			});
			root.dataset.activeSlug = slug;
			if (emptyState) emptyState.hidden = visibleCount !== 0;
			if (announcer && options.announce !== false) {
				announcer.textContent = `已筛选${selectedFilter.dataset.tagLabel ?? '全部文章'}，显示 ${visibleCount} 篇文章。`;
			}

			if (options.pushHistory && getTagSlugFromUrl(window.location.href) !== slug) {
				window.history.pushState({ editorialTag: slug }, '', selectedFilter.href);
			}
			document.title = slug ? `${selectedFilter.dataset.tagLabel ?? slug} - Evigila 的博客` : '内容标签 - Evigila 的博客';
			revealFilter(selectedFilter);
			if (options.alignResults) alignResults();
			return true;
		};

		root.addEventListener('click', (event) => {
			if (!(event instanceof MouseEvent) || event.defaultPrevented || event.button !== 0) return;
			if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
			const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
			if (!target || !root.contains(target) || target.target === '_blank') return;
			const slug = getTagSlugFromUrl(target.href);
			const selectedFilter = slug === undefined ? undefined : knownFilter(slug);
			if (slug === undefined || !selectedFilter) return;

			event.preventDefault();
			applyFilter(slug, { pushHistory: true, alignResults: true });
		});

		window.addEventListener('popstate', () => {
			const slug = getTagSlugFromUrl(window.location.href);
			if (slug !== undefined) applyFilter(slug, { alignResults: true });
		});
		window.addEventListener('pageshow', (event) => {
			if (!event.persisted) return;
			const slug = getTagSlugFromUrl(window.location.href);
			if (slug !== undefined) applyFilter(slug, { announce: false });
		});

		const initialSlug = getTagSlugFromUrl(window.location.href) ?? root.dataset.activeSlug ?? '';
		applyFilter(initialSlug, { announce: false });
	});
};
