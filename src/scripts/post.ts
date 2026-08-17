import { initShareControls } from './share';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

type TocEntry = {
	link: HTMLAnchorElement;
	section: HTMLElement;
};

type LayoutMetrics = {
	usesReaderScroll: boolean;
	viewportHeight: number;
	contentTop: number;
	contentHeight: number;
	headerEnd: number;
	headingTops: number[];
	commentsTop: number;
};

const findActiveHeading = (headingTops: number[], activationPoint: number) => {
	let low = 0;
	let high = headingTops.length - 1;
	let activeIndex = 0;

	while (low <= high) {
		const middle = (low + high) >> 1;
		if (headingTops[middle] <= activationPoint) {
			activeIndex = middle;
			low = middle + 1;
		} else {
			high = middle - 1;
		}
	}

	return activeIndex;
};

export const initPostPage = () => {
	const article = document.querySelector<HTMLElement>('[data-post-article]');
	if (!article) return;

	const postContent = document.querySelector<HTMLElement>('[data-post-content]');
	const reader = document.querySelector<HTMLElement>('[data-post-reader]');
	const header = article.querySelector<HTMLElement>('.post-header');
	const stickyTitle = reader?.querySelector<HTMLElement>('[data-sticky-title]');
	const stickyScrollButton = stickyTitle?.querySelector<HTMLElement>('[data-scroll-top]');
	const cover = document.querySelector<HTMLElement>('.post-cover');
	const coverMedia = cover?.querySelector<HTMLElement>('[data-cover-media]');
	const coverImage = coverMedia?.querySelector<HTMLImageElement>('[data-cover-image]');
	const outline = document.querySelector<HTMLElement>('[data-post-outline]');
	const outlineList = outline?.querySelector<HTMLElement>('.post-outline__list');
	const inspector = document.querySelector<HTMLElement>('.post-inspector');
	const inspectorScroll = inspector?.querySelector<HTMLElement>('.post-inspector__scroll');
	const progressValue = document.querySelector<HTMLElement>('[data-reading-progress-value]');
	const comments = document.getElementById('post-comments');
	const giscusRoot = document.querySelector<HTMLElement>('[data-giscus-root]');
	const tocEntries = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-toc-link]'))
		.map((link): TocEntry | null => {
			const targetId = link.dataset.targetId;
			const section = targetId ? document.getElementById(targetId) : null;
			return section ? { link, section } : null;
		})
		.filter((entry): entry is TocEntry => entry !== null);
	const scrollButtons = Array.from(document.querySelectorAll<HTMLElement>('[data-scroll-top]'));
	const commentButtons = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-scroll-comments]'));

	let frame: number | undefined;
	let metricsDirty = true;
	const desktopReaderMode = window.matchMedia('(min-width: 1280px)');
	let metrics: LayoutMetrics = {
		// The desktop layout always delegates scrolling to the middle reader.
		// Seed this synchronously so wheel forwarding already works before the
		// first (deferred) full layout measurement has completed.
		usesReaderScroll: desktopReaderMode.matches,
		viewportHeight: window.innerHeight,
		contentTop: 0,
		contentHeight: 0,
		headerEnd: Number.POSITIVE_INFINITY,
		headingTops: [],
		commentsTop: 0,
	};
	let renderedProgress = '';
	let renderedActiveHeading = -1;
	let renderedTitleVisible: boolean | undefined;
	let giscusObserver: IntersectionObserver | undefined;
	let giscusObserverRoot: Element | null | undefined;
	let coverLoadScheduled = false;
	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	const scrollBehavior = (): ScrollBehavior => reducedMotion.matches ? 'auto' : 'smooth';
	const startCoverImageLoad = () => {
		coverLoadScheduled = false;
		if (!coverMedia || !coverImage || coverMedia.dataset.coverState !== 'pending') return;
		const source = coverImage.dataset.src;
		if (!source) {
			coverMedia.dataset.coverState = 'error';
			coverMedia.setAttribute('aria-busy', 'false');
			return;
		}

		coverMedia.dataset.coverState = 'loading';
		let settled = false;
		const settle = (state: 'ready' | 'error') => {
			if (settled || !coverImage.isConnected || coverImage.dataset.src !== source) return;
			settled = true;
			coverMedia.dataset.coverState = state;
			coverMedia.setAttribute('aria-busy', 'false');
			if (state === 'error') coverImage.removeAttribute('src');
		};
		const decodeImage = async () => {
			try {
				await coverImage.decode();
			} catch {
				// A loaded image can remain drawable even when decode() rejects.
			}
			settle(coverImage.naturalWidth > 0 ? 'ready' : 'error');
		};

		coverImage.addEventListener('error', () => settle('error'), { once: true });
		coverImage.src = source;
		void decodeImage();
	};

	const scheduleCoverImageLoad = () => {
		if (!coverMedia || !coverImage || coverMedia.dataset.coverState !== 'pending' || coverLoadScheduled) return;
		coverLoadScheduled = true;
		const idleWindow = window as Window & {
			requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
		};
		if (idleWindow.requestIdleCallback) idleWindow.requestIdleCallback(startCoverImageLoad, { timeout: 600 });
		else window.setTimeout(startCoverImageLoad, 0);
	};

	const ensureGiscusLoaded = () => {
		if (!giscusRoot || giscusRoot.dataset.giscusState === 'loading' || giscusRoot.dataset.giscusState === 'loaded') {
			return;
		}

		giscusRoot.dataset.giscusState = 'loading';
		const script = document.createElement('script');
		script.src = 'https://giscus.app/client.js';
		script.async = true;
		script.crossOrigin = 'anonymous';

		const config = {
			repo: giscusRoot.dataset.giscusRepo,
			'repo-id': giscusRoot.dataset.giscusRepoId,
			category: giscusRoot.dataset.giscusCategory,
			'category-id': giscusRoot.dataset.giscusCategoryId,
			mapping: giscusRoot.dataset.giscusMapping,
			strict: giscusRoot.dataset.giscusStrict,
			'reactions-enabled': giscusRoot.dataset.giscusReactionsEnabled,
			'emit-metadata': giscusRoot.dataset.giscusEmitMetadata,
			'input-position': giscusRoot.dataset.giscusInputPosition,
			theme: giscusRoot.dataset.giscusTheme,
			lang: giscusRoot.dataset.giscusLang,
		};

		Object.entries(config).forEach(([name, value]) => {
			if (value) script.setAttribute(`data-${name}`, value);
		});
		script.addEventListener('load', () => {
			giscusRoot.dataset.giscusState = 'loaded';
		}, { once: true });
		script.addEventListener('error', () => {
			giscusRoot.removeAttribute('data-giscus-state');
			script.remove();
		}, { once: true });
		giscusRoot.appendChild(script);
		giscusObserver?.disconnect();
	};

	const configureGiscusObserver = (usesReaderScroll: boolean) => {
		if (
			!comments
			|| !giscusRoot
			|| giscusRoot.dataset.giscusState === 'loading'
			|| giscusRoot.dataset.giscusState === 'loaded'
		) return;
		const nextRoot = usesReaderScroll ? reader : null;
		if (giscusObserver && giscusObserverRoot === nextRoot) return;

		giscusObserver?.disconnect();
		giscusObserverRoot = nextRoot;
		if (!('IntersectionObserver' in window)) {
			ensureGiscusLoaded();
			return;
		}

		giscusObserver = new IntersectionObserver((entries) => {
			if (entries.some((entry) => entry.isIntersecting)) ensureGiscusLoaded();
		}, {
			root: nextRoot,
			rootMargin: '800px 0px',
		});
		giscusObserver.observe(comments);
	};

	const readLayoutMetrics = (): LayoutMetrics => {
		const usesReaderScroll = Boolean(
			reader
			&& getComputedStyle(reader).overflowY !== 'visible'
			&& reader.scrollHeight > reader.clientHeight,
		);
		const activeReader = usesReaderScroll ? reader : null;
		const scrollTop = activeReader?.scrollTop ?? window.scrollY;
		const viewportHeight = activeReader?.clientHeight ?? window.innerHeight;
		const readerTop = activeReader?.getBoundingClientRect().top ?? 0;
		const toScrollCoordinate = (element: Element | null) => {
			if (!element) return 0;
			return element.getBoundingClientRect().top - readerTop + scrollTop;
		};
		const contentRect = postContent?.getBoundingClientRect();
		const contentTop = contentRect ? contentRect.top - readerTop + scrollTop : 0;
		const contentHeight = contentRect?.height ?? 0;
		const headerRect = header?.getBoundingClientRect();
		const headerEnd = headerRect ? headerRect.bottom - readerTop + scrollTop : Number.POSITIVE_INFINITY;
		const commentsScrollMargin = comments
			? Number.parseFloat(getComputedStyle(comments).scrollMarginTop) || 0
			: 0;

		return {
			usesReaderScroll,
			viewportHeight,
			contentTop,
			contentHeight,
			headerEnd,
			headingTops: tocEntries.map((entry) => toScrollCoordinate(entry.section)),
			commentsTop: toScrollCoordinate(comments) - commentsScrollMargin,
		};
	};

	const commitActiveHeading = (activeIndex: number) => {
		if (activeIndex === renderedActiveHeading) return;
		renderedActiveHeading = activeIndex;
		tocEntries.forEach((entry, index) => {
			const isActive = index === activeIndex;
			entry.link.classList.toggle('is-active', isActive);
			entry.link.classList.toggle('is-passed', index < activeIndex);
			entry.link.setAttribute('aria-current', isActive ? 'true' : 'false');
		});
	};

	const update = () => {
		frame = undefined;
		const previousReaderMode = metrics.usesReaderScroll;
		if (metricsDirty) {
			metrics = readLayoutMetrics();
			metricsDirty = false;
		}

		// Build one scroll context before performing any DOM writes in this frame.
		const scrollTop = metrics.usesReaderScroll ? (reader?.scrollTop ?? 0) : window.scrollY;
		const viewportHeight = metrics.viewportHeight;
		const current = scrollTop + viewportHeight * 0.22;
		const progress = clamp(
			(current - metrics.contentTop) / Math.max(metrics.contentHeight - viewportHeight * 0.35, 1),
			0,
			1,
		);
		const progressLabel = `${Math.round(progress * 100)}%`;
		const activeHeading = metrics.headingTops.length > 0
			? findActiveHeading(metrics.headingTops, scrollTop + viewportHeight * 0.24)
			: -1;
		const titleVisible = scrollTop >= metrics.headerEnd - 72;

		// Commit after every measurement and calculation has completed.
		if (outline && progressValue && progressLabel !== renderedProgress) {
			renderedProgress = progressLabel;
			outline.style.setProperty('--reading-progress', progressLabel);
			progressValue.textContent = progressLabel;
		}
		commitActiveHeading(activeHeading);
		if (reader && titleVisible !== renderedTitleVisible) {
			renderedTitleVisible = titleVisible;
			reader.dataset.titleVisible = titleVisible ? 'true' : 'false';
			stickyTitle?.setAttribute('aria-hidden', titleVisible ? 'false' : 'true');
			if (stickyScrollButton) stickyScrollButton.tabIndex = titleVisible ? 0 : -1;
		}
		if (previousReaderMode !== metrics.usesReaderScroll || !giscusObserver) {
			configureGiscusObserver(metrics.usesReaderScroll);
		}
	};

	const queueUpdate = () => {
		if (frame !== undefined) return;
		frame = window.requestAnimationFrame(update);
	};

	const invalidateLayout = () => {
		metricsDirty = true;
		queueUpdate();
	};

	initShareControls();

	scrollButtons.forEach((button) => {
		button.addEventListener('click', () => {
			if (metrics.usesReaderScroll) reader?.scrollTo({ top: 0, behavior: scrollBehavior() });
			else window.scrollTo({ top: 0, behavior: scrollBehavior() });
		});
	});

	commentButtons.forEach((button) => {
		button.addEventListener('click', (event) => {
			if (!comments) return;

			event.preventDefault();
			ensureGiscusLoaded();
			if (metrics.usesReaderScroll && reader) {
				reader.scrollTo({ top: Math.max(metrics.commentsTop, 0), behavior: scrollBehavior() });
			} else {
				comments.scrollIntoView({ block: 'start', behavior: scrollBehavior() });
			}
			history.replaceState(history.state, '', '#post-comments');
		});
	});

	tocEntries.forEach(({ link, section }) => {
		link.addEventListener('click', (event) => {
			event.preventDefault();
			section.scrollIntoView({ block: 'start', behavior: scrollBehavior() });
			if (!section.hasAttribute('tabindex')) section.tabIndex = -1;
			section.focus({ preventScroll: true });
			history.replaceState(history.state, '', `#${section.id}`);
		});
	});

	reader?.addEventListener('scroll', queueUpdate, { passive: true });
	window.addEventListener('scroll', queueUpdate, { passive: true });
	window.addEventListener('wheel', (event) => {
		if (
			!reader
			|| !desktopReaderMode.matches
			|| event.ctrlKey
			|| event.shiftKey
			|| event.deltaY === 0
			|| Math.abs(event.deltaX) > Math.abs(event.deltaY)
		) return;
		const path = event.composedPath();
		const nativeOwner = path.some((node) => node instanceof Element && node.matches(
			'.post-outline__list, .post-inspector__scroll, [data-post-reader]',
		));
		if (nativeOwner) return;

		const hit = document.elementFromPoint(event.clientX, event.clientY);
		let destination = reader;
		if (hit?.closest('.post-outline__list') && outlineList) {
			destination = outlineList;
		} else if (hit?.closest('.post-inspector') && inspectorScroll) {
			destination = inspectorScroll;
		} else if (
			(!hit || hit === document.documentElement || hit === document.body)
			&& inspector
			&& inspectorScroll
			&& event.clientX >= inspector.getBoundingClientRect().left
		) {
			destination = inspectorScroll;
		}
		const multiplier = event.deltaMode === WheelEvent.DOM_DELTA_LINE
			? 16
			: event.deltaMode === WheelEvent.DOM_DELTA_PAGE
				? destination.clientHeight
				: 1;
		// A direct scrollTop write must stay immediate even though anchor/API
		// navigation uses smooth scrolling on the reader.
		destination.scrollTop += event.deltaY * multiplier;
	}, { passive: true, capture: true });
	window.addEventListener('resize', invalidateLayout, { passive: true });
	window.addEventListener('pageshow', () => {
		invalidateLayout();
		if (coverMedia?.dataset.coverState === 'pending') coverLoadScheduled = false;
		scheduleCoverImageLoad();
	});
	if (document.fonts?.status === 'loading') document.fonts.ready.then(invalidateLayout);

	let observedArticleSize = '';
	const layoutObserver = new ResizeObserver(([entry]) => {
		if (!entry) return;
		const nextSize = `${entry.contentRect.width}:${entry.contentRect.height}`;
		if (!observedArticleSize) {
			observedArticleSize = nextSize;
			return;
		}
		if (nextSize === observedArticleSize) return;
		observedArticleSize = nextSize;
		invalidateLayout();
	});
	layoutObserver.observe(article);
	// Return control to the browser before measuring every article heading.
	// This keeps links, pointer events and the cover wheel listener responsive
	// during the first paint; the queued frame then builds the full metrics.
	queueUpdate();
	window.requestAnimationFrame(scheduleCoverImageLoad);
};
