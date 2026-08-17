const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type HomeGreeting = {
	period: 'morning' | 'afternoon' | 'evening' | 'late-night';
	first: string;
	second: string;
};

export const getHomeGreeting = (hour: number): HomeGreeting => {
	if (hour >= 23 || hour < 5) return { period: 'late-night', first: '夜已深。', second: '请早早进行休息。' };
	if (hour < 12) return { period: 'morning', first: '欢迎，早上好。', second: '祝你有美好的一天' };
	if (hour < 18) return { period: 'afternoon', first: '欢迎，下午好。', second: '来一杯下午茶休息一下' };
	return { period: 'evening', first: '欢迎，晚上好。', second: '结束了一天的疲惫准备好好休息吧。' };
};

export const initEditorialHome = () => {
	const root = document.querySelector<HTMLElement>('[data-editorial-home]');
	if (!root) return;

	const greetingFirst = root.querySelector<HTMLElement>('[data-greeting-line="first"]');
	const greetingSecond = root.querySelector<HTMLElement>('[data-greeting-line="second"]');
	const syncGreeting = () => {
		const greeting = getHomeGreeting(new Date().getHours());
		if (greetingFirst) greetingFirst.textContent = greeting.first;
		if (greetingSecond) greetingSecond.textContent = greeting.second;
		root.dataset.greetingPeriod = greeting.period;
	};
	syncGreeting();

	const windowElement = root.querySelector<HTMLElement>('[data-carousel-window]');
	const carouselRegion = root.querySelector<HTMLElement>('[data-carousel-region]');
	const stickyPanel = root.querySelector<HTMLElement>('[data-carousel-sticky-panel]');
	if (!windowElement || !carouselRegion || !stickyPanel || root.dataset.editorialInitialized === 'true') return;

	const slides = [...root.querySelectorAll<HTMLElement>('[data-carousel-slide]')];
	const metaPanels = [...root.querySelectorAll<HTMLElement>('[data-meta-index]')];
	const scrollStops = [...root.querySelectorAll<HTMLElement>('[data-carousel-stop]')];
	const counter = root.querySelector<HTMLElement>('[data-carousel-counter]');
	const announcer = root.querySelector<HTMLElement>('[data-carousel-announce]');
	const previousButton = root.querySelector<HTMLButtonElement>('[data-carousel-prev]');
	const nextButton = root.querySelector<HTMLButtonElement>('[data-carousel-next]');
	const articleCount = metaPanels.length;
	if (articleCount === 0) return;

	root.dataset.editorialInitialized = 'true';
	const controller = new AbortController();
	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	let activeIndex = 0;
	let stageEnabled = false;
	let stageStart = 0;
	let stageStep = 0;
	let stageDistance = 0;
	let pendingIndex: number | undefined;
	let scrollFrame: number | undefined;
	let metricsFrame: number | undefined;

	const setActiveIndex = (nextIndex: number, announce = true) => {
		activeIndex = clamp(nextIndex, 0, articleCount - 1);
		const leftSlideIndex = activeIndex;
		const activeSlideIndex = activeIndex + 1;
		const nextSlideIndex = activeIndex + 2;

		slides.forEach((slide, slideIndex) => {
			let slot = 'future';
			if (slideIndex < leftSlideIndex) slot = 'past';
			else if (slideIndex === leftSlideIndex) slot = 'left';
			else if (slideIndex === activeSlideIndex) slot = 'active';
			else if (slideIndex === nextSlideIndex) slot = 'next';

			if (slide.dataset.slot !== slot) slide.dataset.slot = slot;
			slide.classList.toggle('is-carousel-nearby', slideIndex >= leftSlideIndex - 1 && slideIndex <= nextSlideIndex + 1);
			const isActive = slot === 'active';
			const isArchiveLink = slide.hasAttribute('data-carousel-archive');
			const isAccessible = isActive || (isArchiveLink && slot === 'left');
			const ariaHidden = String(!isAccessible);
			if (slide.getAttribute('aria-hidden') !== ariaHidden) slide.setAttribute('aria-hidden', ariaHidden);
			if (isActive) slide.setAttribute('aria-current', 'true');
			else slide.removeAttribute('aria-current');
			if (slide.inert !== !isAccessible) slide.inert = !isAccessible;
			if (slide instanceof HTMLAnchorElement && slide.tabIndex !== (isAccessible ? 0 : -1)) {
				slide.tabIndex = isAccessible ? 0 : -1;
			}
		});

		metaPanels.forEach((panel, index) => {
			const shouldHide = index !== activeIndex;
			if (panel.hidden !== shouldHide) panel.hidden = shouldHide;
		});

		if (counter) counter.textContent = `${String(activeIndex + 1).padStart(2, '0')} / ${String(articleCount).padStart(2, '0')}`;
		if (previousButton) previousButton.disabled = activeIndex === 0;
		if (nextButton) nextButton.disabled = activeIndex === articleCount - 1;
		if (announce && announcer) {
			const title = metaPanels[activeIndex]?.querySelector('h3')?.textContent?.trim() ?? '';
			announcer.textContent = `当前文章：${title}，第 ${activeIndex + 1} 篇，共 ${articleCount} 篇`;
		}
	};

	const setStageVisualState = (active: boolean) => {
		const nextState = active ? 'active' : 'inactive';
		if (root.dataset.carouselStage !== nextState) root.dataset.carouselStage = nextState;
	};

	const updateStageFromScroll = () => {
		scrollFrame = undefined;
		const scrollTop = window.scrollY;
		if (!stageEnabled || stageDistance <= 0) {
			setStageVisualState(false);
			return;
		}

		const stageEnd = stageStart + stageDistance;
		const visualHeight = window.visualViewport?.height ?? window.innerHeight;
		const visualMargin = visualHeight * 0.2;
		const inStage = scrollTop >= stageStart - visualMargin && scrollTop <= stageEnd + visualMargin;
		setStageVisualState(inStage);
		if (scrollTop < stageStart) {
			if (activeIndex !== 0) setActiveIndex(0, false);
			return;
		}
		if (scrollTop > stageEnd) {
			if (activeIndex !== articleCount - 1) setActiveIndex(articleCount - 1, false);
			return;
		}

		const nextIndex = clamp(Math.round((scrollTop - stageStart) / stageStep), 0, articleCount - 1);
		if (nextIndex !== activeIndex) setActiveIndex(nextIndex, false);
		if (pendingIndex !== undefined && Math.abs(scrollTop - (stageStart + stageStep * pendingIndex)) < 2) pendingIndex = undefined;
	};

	const scheduleScrollUpdate = () => {
		if (scrollFrame !== undefined) return;
		scrollFrame = window.requestAnimationFrame(updateStageFromScroll);
	};

	const refreshStageMetrics = () => {
		if (metricsFrame !== undefined) window.cancelAnimationFrame(metricsFrame);
		metricsFrame = window.requestAnimationFrame(() => {
			metricsFrame = undefined;
			const visualHeight = window.visualViewport?.height ?? window.innerHeight;
			const layoutHeight = document.documentElement.clientHeight || window.innerHeight;
			const viewportHeight = Math.min(layoutHeight, visualHeight);
			stageEnabled = articleCount > 1
				&& scrollStops.length === articleCount
				&& stickyPanel.scrollHeight <= viewportHeight - 16;
			const nextState = stageEnabled ? 'true' : 'false';
			if (root.dataset.carouselNativeStage !== nextState) root.dataset.carouselNativeStage = nextState;

			const rect = carouselRegion.getBoundingClientRect();
			const regionTop = window.scrollY + rect.top;
			const firstStop = scrollStops[0]?.offsetTop ?? 0;
			const secondStop = scrollStops[1]?.offsetTop ?? firstStop;
			const lastStop = scrollStops.at(-1)?.offsetTop ?? firstStop;
			stageStart = regionTop + firstStop;
			stageStep = stageEnabled ? Math.max(0, secondStop - firstStop) : 0;
			stageDistance = stageEnabled ? Math.max(0, lastStop - firstStop) : 0;
			if (scrollFrame !== undefined) {
				window.cancelAnimationFrame(scrollFrame);
				scrollFrame = undefined;
			}
			updateStageFromScroll();
		});
	};

	const scrollToIndex = (index: number, announce = true) => {
		const nextIndex = clamp(index, 0, articleCount - 1);
		if (!stageEnabled || stageDistance <= 0) {
			setActiveIndex(nextIndex, announce);
			return;
		}
		pendingIndex = nextIndex;
		window.scrollTo({
			top: stageStart + stageStep * nextIndex,
			behavior: reducedMotion.matches ? 'auto' : 'smooth',
		});
		if (announce && announcer) {
			const title = metaPanels[nextIndex]?.querySelector('h3')?.textContent?.trim() ?? '';
			announcer.textContent = `前往文章：${title}，第 ${nextIndex + 1} 篇，共 ${articleCount} 篇`;
		}
	};

	window.addEventListener('scroll', scheduleScrollUpdate, { passive: true, signal: controller.signal });
	document.addEventListener('scrollend', () => {
		pendingIndex = undefined;
		if (root.dataset.carouselStage !== 'active' || !announcer) return;
		const title = metaPanels[activeIndex]?.querySelector('h3')?.textContent?.trim() ?? '';
		announcer.textContent = `当前文章：${title}，第 ${activeIndex + 1} 篇，共 ${articleCount} 篇`;
	}, { passive: true, signal: controller.signal });
	window.addEventListener('resize', refreshStageMetrics, { passive: true, signal: controller.signal });
	window.visualViewport?.addEventListener('resize', refreshStageMetrics, { passive: true, signal: controller.signal });

	windowElement.addEventListener('keydown', (event) => {
		if (event.repeat) return;
		const isNext = event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'PageDown' || (event.key === ' ' && !event.shiftKey);
		const isPrevious = event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'PageUp' || (event.key === ' ' && event.shiftKey);
		const baseIndex = pendingIndex ?? activeIndex;
		if (isNext && baseIndex < articleCount - 1) {
			event.preventDefault();
			scrollToIndex(baseIndex + 1);
		} else if (isPrevious && baseIndex > 0) {
			event.preventDefault();
			scrollToIndex(baseIndex - 1);
		} else if (event.key === 'Home') {
			event.preventDefault();
			scrollToIndex(0);
		} else if (event.key === 'End') {
			event.preventDefault();
			scrollToIndex(articleCount - 1);
		}
	}, { signal: controller.signal });

	previousButton?.addEventListener('click', () => scrollToIndex((pendingIndex ?? activeIndex) - 1), { signal: controller.signal });
	nextButton?.addEventListener('click', () => scrollToIndex((pendingIndex ?? activeIndex) + 1), { signal: controller.signal });
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') {
			syncGreeting();
			refreshStageMetrics();
		}
	}, { signal: controller.signal });
	window.addEventListener('pageshow', () => {
		syncGreeting();
		window.requestAnimationFrame(() => refreshStageMetrics());
	}, { signal: controller.signal });

	const panelObserver = new ResizeObserver(refreshStageMetrics);
	panelObserver.observe(stickyPanel);
	document.fonts?.ready.then(refreshStageMetrics);
	setActiveIndex(0, false);
	refreshStageMetrics();
};
