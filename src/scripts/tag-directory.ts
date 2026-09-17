const getTagSlugFromUrl = (value: string) => {
	const url = new URL(value, window.location.href);
	if (url.origin !== window.location.origin) return undefined;
	const match = url.pathname.match(/^\/tags(?:\/([^/]+))?\/?$/);
	if (!match) return undefined;
	return match[1] ? decodeURIComponent(match[1]) : '';
};

const restoreScrollPosition = (scrollOwner: HTMLElement, left: number, top: number) => {
	const previousBehavior = scrollOwner.style.getPropertyValue('scroll-behavior');
	const previousPriority = scrollOwner.style.getPropertyPriority('scroll-behavior');
	scrollOwner.style.setProperty('scroll-behavior', 'auto', 'important');
	scrollOwner.scrollTo(left, top);
	window.requestAnimationFrame(() => {
		scrollOwner.scrollTo(left, top);
		if (previousBehavior) scrollOwner.style.setProperty('scroll-behavior', previousBehavior, previousPriority);
		else scrollOwner.style.removeProperty('scroll-behavior');
	});
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
		const statusLabel = root.querySelector<HTMLElement>('[data-tag-status-label]');
		const statusCount = root.querySelector<HTMLElement>('[data-tag-status-count]');
		const emptyState = root.querySelector<HTMLElement>('[data-tag-empty]');
		const scrollOwner = root.closest<HTMLElement>('[data-workspace-stage]')
			?? document.scrollingElement as HTMLElement;
		if (!results || filters.length === 0) return;

		let preservedResultsHeight = 0;
		const knownFilter = (slug: string) => filterBySlug.get(slug);

		const applyFilter = (
			slug: string,
			options: { pushHistory?: boolean; preserveScroll?: boolean; announce?: boolean } = {},
		) => {
			const selectedFilter = knownFilter(slug);
			if (!selectedFilter) return false;

			const preserveScroll = options.preserveScroll ?? false;
			const scrollLeft = scrollOwner.scrollLeft;
			const scrollTop = scrollOwner.scrollTop;
			if (preserveScroll) {
				preservedResultsHeight = Math.max(preservedResultsHeight, results.getBoundingClientRect().height);
				results.style.minHeight = `${preservedResultsHeight}px`;
			}

			let visibleIndex = 0;
			cardRecords.forEach(({ card, tags: cardTags }) => {
				const visible = !slug || cardTags.has(slug);
				const shouldHide = !visible;
				if (card.hidden !== shouldHide) card.hidden = shouldHide;
				if (!visible) return;
				visibleIndex += 1;
			});

			filters.forEach((filter) => {
				if (filter === selectedFilter) filter.setAttribute('aria-current', 'true');
				else filter.removeAttribute('aria-current');
			});
			root.dataset.activeSlug = slug;
			if (statusLabel) statusLabel.textContent = selectedFilter.dataset.tagLabel ?? '全部文章';
			if (statusCount) {
				statusCount.textContent = `${visibleIndex} 篇文章`;
				if (options.announce === false) statusCount.setAttribute('aria-live', 'off');
				else statusCount.setAttribute('aria-live', 'polite');
			}
			if (emptyState) emptyState.hidden = visibleIndex !== 0;

			if (options.pushHistory && getTagSlugFromUrl(window.location.href) !== slug) {
				window.history.pushState({ editorialTag: slug }, '', selectedFilter.href);
			}
			document.title = slug ? `${selectedFilter.dataset.tagLabel ?? slug} - Evigila 的博客` : '内容标签 - Evigila 的博客';
			if (preserveScroll) restoreScrollPosition(scrollOwner, scrollLeft, scrollTop);
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
			const clickedInsideFilters = Boolean(target.closest('[data-tag-filters]'));
			if (!applyFilter(slug, { pushHistory: true, preserveScroll: true })) return;
			if (!clickedInsideFilters) selectedFilter.focus({ preventScroll: true });
		});

		window.addEventListener('popstate', () => {
			const slug = getTagSlugFromUrl(window.location.href);
			if (slug !== undefined) applyFilter(slug, { announce: true });
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
