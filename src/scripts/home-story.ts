import { initShareControls } from './share';
import { initTheme } from './theme';

export const initHomeStory = () => {
	const root = document.querySelector<HTMLElement>('[data-carousel-root]');
	const track = root?.querySelector<HTMLElement>('[data-carousel-track]');

	if (!root || !track) {
		return;
	}

	initTheme();
	initShareControls();

	document.documentElement.classList.add('story-home-lock');
	document.body.classList.add('story-home-lock');

	const startButton = root.querySelector<HTMLButtonElement>('[data-carousel-start]');
	const previousButton = root.querySelector<HTMLButtonElement>('[data-carousel-prev]');
	const nextButton = root.querySelector<HTMLButtonElement>('[data-carousel-next]');
	const coverNextButton = root.querySelector<HTMLButtonElement>('[data-cover-next]');
	const viewButtons = Array.from(root.querySelectorAll<HTMLElement>('[data-story-view]'));
	const introPanels = Array.from(root.querySelectorAll<HTMLElement>('[data-intro-panel]'));
	const filterList = root.querySelector<HTMLElement>('[data-filter-list]');
	const filterButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-filter-tag]'));
	const cards = Array.from(track.querySelectorAll<HTMLElement>('[data-post-tags]'));
	let activeCard: HTMLElement | undefined;
	let activeClearTimer: number | undefined;
	let touchStartX = 0;
	let touchStartY = 0;
	let touchStartScrollY = 0;
	let touchStartTime = 0;
	let touchHandledAt = 0;
	const panelHideTimers = new WeakMap<HTMLElement, number>();
	type StoryView = 'cover' | 'about' | 'posts';
	const step = () => Math.max(1280, track.clientWidth * 1.45);
	const isStoryView = (view: string | null): view is StoryView =>
		view === 'cover' || view === 'about' || view === 'posts';

	const setView = (view: StoryView) => {
		root.dataset.view = view;
		document.documentElement.dataset.storyView = view;
		document.body.dataset.storyView = view;
		root.classList.toggle('is-cover', view === 'cover');
		root.classList.toggle('is-about', view === 'about');
		root.classList.toggle('is-posts', view === 'posts');
		viewButtons.forEach((button) => {
			button.classList.toggle('is-active', button.dataset.storyView === view);
		});
		introPanels.forEach((panel) => {
			const existingTimer = panelHideTimers.get(panel);
			if (existingTimer !== undefined) {
				window.clearTimeout(existingTimer);
				panelHideTimers.delete(panel);
			}

			if (view !== 'posts' && panel.dataset.introPanel === view) {
				panel.hidden = false;
				panel.classList.add('is-current');
				panel.classList.remove('is-exiting');
				return;
			}

			if (panel.classList.contains('is-current')) {
				panel.classList.remove('is-current');
				panel.classList.add('is-exiting');
				const timer = window.setTimeout(() => {
					panel.hidden = true;
					panel.classList.remove('is-exiting');
					panelHideTimers.delete(panel);
				}, 260);
				panelHideTimers.set(panel, timer);
				return;
			}

			panel.hidden = true;
			panel.classList.remove('is-current', 'is-exiting');
		});
	};

	const showCover = () => {
		clearActiveCard();
		setView('cover');
		root.scrollTo({ top: 0, behavior: 'auto' });
		track.scrollTo({ left: 0, behavior: 'smooth' });
		window.requestAnimationFrame(updateProgress);
	};

	const showAbout = () => {
		clearActiveCard();
		setView('about');
		root.scrollTo({ top: 0, behavior: 'auto' });
		track.scrollTo({ left: 0, behavior: 'smooth' });
		window.requestAnimationFrame(updateProgress);
	};

	const showPosts = () => {
		setView('posts');
		root.scrollTo({ top: 0, behavior: 'auto' });
		window.requestAnimationFrame(updateProgress);
	};

	const showNextView = () => {
		if (root.dataset.view === 'cover') {
			showAbout();
			return;
		}

		showPosts();
	};

	const updateProgress = () => {
		const maxScroll = Math.max(1, track.scrollWidth - track.clientWidth);
		const progress = Math.min(1, Math.max(0, track.scrollLeft / maxScroll));
		root.style.setProperty('--carousel-progress', progress.toFixed(3));
		root.dataset.canReset = track.scrollLeft > 24 ? 'true' : 'false';
		if (startButton) {
			startButton.hidden = track.scrollLeft <= 24;
		}
		if (activeCard) {
			const trackRect = track.getBoundingClientRect();
			const cardRect = activeCard.getBoundingClientRect();
			const visibleWidth = Math.min(trackRect.right, cardRect.right) - Math.max(trackRect.left, cardRect.left);

			if (visibleWidth < Math.min(80, cardRect.width * 0.25)) {
				clearActiveCard();
			}
		}
	};

	const scrollByStep = (direction: number) => {
		clearActiveCard();
		track.scrollBy({
			left: step() * direction,
			behavior: 'smooth',
		});
	};

	const cancelActiveClear = () => {
		if (activeClearTimer !== undefined) {
			window.clearTimeout(activeClearTimer);
			activeClearTimer = undefined;
		}
	};

	const clearActiveCard = () => {
		cancelActiveClear();
		activeCard = undefined;
		root.dataset.hasActive = 'false';
		cards.forEach((card) => card.classList.remove('is-selected'));
	};

	const scheduleClearActiveCard = () => {
		if (activeClearTimer !== undefined) {
			return;
		}

		activeClearTimer = window.setTimeout(() => {
			activeClearTimer = undefined;
			clearActiveCard();
		}, 120);
	};

	const setActiveCard = (selectedCard: HTMLElement) => {
		cancelActiveClear();

		if (activeCard === selectedCard && root.dataset.hasActive === 'true') {
			return;
		}

		activeCard = selectedCard;
		root.dataset.hasActive = 'true';
		cards.forEach((card) => card.classList.toggle('is-selected', card === selectedCard));
	};

	const selectCardAtPoint = (x: number, y: number) => {
		const element = document.elementFromPoint(x, y) as HTMLElement | null;
		const card = element?.closest<HTMLElement>('[data-post-tags]');

		if (card && track.contains(card) && !card.hidden) {
			setActiveCard(card);
		} else {
			scheduleClearActiveCard();
		}
	};

	const handleCardLeave = (event: MouseEvent | PointerEvent) => {
		const relatedTarget = event.relatedTarget;
		const relatedCard =
			relatedTarget instanceof Element ? relatedTarget.closest<HTMLElement>('[data-post-tags]') : null;

		if (!relatedCard) {
			scheduleClearActiveCard();
		}
	};

	const handleCardBlur = () => {
		if (!track.contains(document.activeElement)) {
			clearActiveCard();
		}
	};

	const applyFilter = (tag: string) => {
		filterButtons.forEach((button) => {
			const isActive = button.dataset.filterTag === tag;
			button.classList.toggle('is-active', isActive);
			button.setAttribute('aria-pressed', String(isActive));
		});

		cards.forEach((card) => {
			const cardTags = (card.dataset.postTags ?? '').split('|');
			card.hidden = tag !== 'all' && !cardTags.includes(tag);
		});

		clearActiveCard();
		track.scrollTo({ left: 0, behavior: 'smooth' });
		window.requestAnimationFrame(updateProgress);
	};

	const isMobileLayout = () => window.matchMedia('(max-width: 1120px), (hover: none) and (pointer: coarse)').matches;
	const getPageScrollTop = () =>
		isMobileLayout() && root.dataset.view === 'posts'
			? root.scrollTop
			: window.scrollY;

	const handleWheel = (event: WheelEvent) => {
		const mainDelta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;

		if (mainDelta === 0) {
			return;
		}

		if (root.dataset.view === 'posts' && isMobileLayout()) {
			return;
		}

		event.preventDefault();

		if (root.dataset.view === 'cover') {
			if (mainDelta > 0) {
				showAbout();
			}
			return;
		}

		if (root.dataset.view === 'about') {
			if (mainDelta > 0) {
				showPosts();
			} else {
				showCover();
			}
			return;
		}

		if (mainDelta < 0 && track.scrollLeft <= 24) {
			showAbout();
			return;
		}

		track.scrollBy({
			left: Math.sign(mainDelta) * Math.max(Math.abs(mainDelta) * 12, 880),
			behavior: 'auto',
		});
		window.setTimeout(() => selectCardAtPoint(event.clientX, event.clientY), 80);
	};

	const isScrollableGestureTarget = (target: EventTarget | null) => {
		if (!(target instanceof Element)) {
			return false;
		}

		return Boolean(target.closest('[data-filter-list]') || target.closest('[data-carousel-track]'));
	};

	const isMobileGesturePointer = (event: PointerEvent) =>
		event.pointerType === 'touch'
		|| (event.pointerType === 'mouse' && isMobileLayout());

	const handleFilterWheel = (event: WheelEvent) => {
		const mainDelta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;

		if (!filterList || mainDelta === 0) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		if (isMobileLayout()) {
			filterList.scrollBy({
				left: mainDelta * 1.4,
				behavior: 'auto',
			});
		} else {
			filterList.scrollBy({
				top: mainDelta * 1.4,
				behavior: 'auto',
			});
		}
	};

	const handleTouchStart = (event: TouchEvent) => {
		const touch = event.touches[0];
		if (!touch) {
			return;
		}

		touchStartX = touch.clientX;
		touchStartY = touch.clientY;
		touchStartScrollY = getPageScrollTop();
		touchStartTime = Date.now();
	};

	const handleVerticalGesture = (
		deltaX: number,
		deltaY: number,
		elapsed: number,
	) => {
		const absX = Math.abs(deltaX);
		const absY = Math.abs(deltaY);

		if (elapsed > 900 || absY < 52 || absY < absX * 1.2) {
			return false;
		}

		if (deltaY < 0) {
			if (root.dataset.view === 'cover') {
				showAbout();
				return true;
			}

			if (root.dataset.view === 'about') {
				showPosts();
				return true;
			}

			return false;
		}

		if (deltaY > 0) {
			if (root.dataset.view === 'about') {
				showCover();
				return true;
			}

			if (root.dataset.view === 'posts') {
				showAbout();
				return true;
			}
		}

		return false;
	};

	const shouldPreventNativeVerticalGesture = (deltaX: number, deltaY: number, target: EventTarget | null) => {
		const absX = Math.abs(deltaX);
		const absY = Math.abs(deltaY);

		if (absY < 8 || absY < absX * 1.1) {
			return false;
		}

		if (isMobileLayout() && root.dataset.view === 'posts') {
			return false;
		}

		if (root.dataset.view !== 'posts') {
			return !isScrollableGestureTarget(target);
		}

		return deltaY > 0;
	};

	const isPostsTopPull = (deltaX: number, deltaY: number) =>
		isMobileLayout()
		&& root.dataset.view === 'posts'
		&& touchStartScrollY <= 1
		&& getPageScrollTop() <= 1
		&& deltaY > 0
		&& Math.abs(deltaY) > Math.abs(deltaX) * 1.1;

	const handleTouchMove = (event: TouchEvent) => {
		const touch = event.touches[0];
		if (!touch || touchStartTime === 0) {
			return;
		}

		const deltaX = touch.clientX - touchStartX;
		const deltaY = touch.clientY - touchStartY;

		if (isMobileLayout() && root.dataset.view === 'posts') {
			if (isPostsTopPull(deltaX, deltaY)) {
				event.preventDefault();

				const elapsed = Date.now() - touchStartTime;
				if (handleVerticalGesture(deltaX, deltaY, elapsed)) {
					touchHandledAt = Date.now();
					touchStartTime = 0;
				}
			}
			return;
		}

		if (shouldPreventNativeVerticalGesture(deltaX, deltaY, event.target)) {
			event.preventDefault();
		}

		const elapsed = Date.now() - touchStartTime;
		const didChangeView = handleVerticalGesture(
			deltaX,
			deltaY,
			elapsed,
		);

		if (didChangeView) {
			touchHandledAt = Date.now();
			touchStartTime = 0;
		}
	};

	const handleTouchEnd = (event: TouchEvent) => {
		const touch = event.changedTouches[0];
		if (!touch || touchStartTime === 0) {
			return;
		}

		if (isMobileLayout() && root.dataset.view === 'posts') {
			const deltaX = touch.clientX - touchStartX;
			const deltaY = touch.clientY - touchStartY;

			if (isPostsTopPull(deltaX, deltaY)) {
				const elapsed = Date.now() - touchStartTime;
				if (handleVerticalGesture(deltaX, deltaY, elapsed)) {
					touchHandledAt = Date.now();
				}
			}
			touchStartTime = 0;
			return;
		}

		const elapsed = Date.now() - touchStartTime;
		const didChangeView = handleVerticalGesture(
			touch.clientX - touchStartX,
			touch.clientY - touchStartY,
			elapsed,
		);
		if (didChangeView) {
			touchHandledAt = Date.now();
		}
		touchStartTime = 0;
	};

	const handlePointerDown = (event: PointerEvent) => {
		if (!isMobileGesturePointer(event)) {
			return;
		}

		touchStartX = event.clientX;
		touchStartY = event.clientY;
		touchStartScrollY = getPageScrollTop();
		touchStartTime = Date.now();
	};

	const handlePointerMove = (event: PointerEvent) => {
		if (!isMobileGesturePointer(event) || touchStartTime === 0 || Date.now() - touchHandledAt < 80) {
			return;
		}

		if (isMobileLayout() && root.dataset.view === 'posts') {
			return;
		}

		const elapsed = Date.now() - touchStartTime;
		const didChangeView = handleVerticalGesture(
			event.clientX - touchStartX,
			event.clientY - touchStartY,
			elapsed,
		);

		if (didChangeView) {
			touchStartTime = 0;
		}
	};

	const handlePointerUp = (event: PointerEvent) => {
		if (!isMobileGesturePointer(event) || touchStartTime === 0 || Date.now() - touchHandledAt < 80) {
			return;
		}

		if (isMobileLayout() && root.dataset.view === 'posts') {
			touchStartTime = 0;
			return;
		}

		const elapsed = Date.now() - touchStartTime;
		handleVerticalGesture(event.clientX - touchStartX, event.clientY - touchStartY, elapsed);
		touchStartTime = 0;
	};

	const resetTouchGesture = () => {
		touchStartTime = 0;
	};

	filterButtons.forEach((button) => {
		button.setAttribute('aria-pressed', button.classList.contains('is-active') ? 'true' : 'false');
		button.addEventListener('click', () => applyFilter(button.dataset.filterTag ?? 'all'));
	});
	cards.forEach((card) => {
		card.addEventListener('pointerenter', () => setActiveCard(card));
		card.addEventListener('pointermove', () => setActiveCard(card));
		card.addEventListener('pointerleave', handleCardLeave);
		card.addEventListener('mouseenter', () => setActiveCard(card));
		card.addEventListener('mouseleave', handleCardLeave);
		card.addEventListener('mouseover', () => setActiveCard(card));
		card.addEventListener('focus', () => setActiveCard(card));
		card.addEventListener('blur', handleCardBlur);
	});
	startButton?.addEventListener('click', () => {
		clearActiveCard();
		track.scrollTo({
			left: 0,
			behavior: 'smooth',
		});
	});
	coverNextButton?.addEventListener('click', showNextView);
	viewButtons.forEach((button) => {
		button.addEventListener('click', () => {
			const view = button.dataset.storyView;
			if (view === 'cover') {
				showCover();
			} else if (view === 'about') {
				showAbout();
			} else if (view === 'posts') {
				showPosts();
			}
		});
	});
	previousButton?.addEventListener('click', () => scrollByStep(-1));
	nextButton?.addEventListener('click', () => scrollByStep(1));
	root.addEventListener('wheel', handleWheel, { passive: false });
	root.addEventListener('touchstart', handleTouchStart, { passive: true });
	root.addEventListener('touchmove', handleTouchMove, { passive: false });
	root.addEventListener('touchend', handleTouchEnd, { passive: true });
	root.addEventListener('touchcancel', resetTouchGesture, { passive: true });
	root.addEventListener('pointerdown', handlePointerDown, { passive: true });
	root.addEventListener('pointermove', handlePointerMove, { passive: true });
	root.addEventListener('pointerup', handlePointerUp, { passive: true });
	root.addEventListener('pointercancel', resetTouchGesture, { passive: true });
	filterList?.addEventListener('wheel', handleFilterWheel, { passive: false });
	track.addEventListener('pointermove', (event) => selectCardAtPoint(event.clientX, event.clientY));
	track.addEventListener('pointerleave', clearActiveCard);
	track.addEventListener('scroll', updateProgress, { passive: true });
	window.addEventListener('resize', updateProgress, { passive: true });
	const requestedView = new URLSearchParams(window.location.search).get('view');
	const initialView: StoryView =
		isStoryView(requestedView)
			? requestedView
			: window.location.hash === '#posts'
				? 'posts'
				: root.dataset.view === 'about' || root.dataset.view === 'posts'
					? root.dataset.view
					: 'cover';

	if (window.location.hash === '#posts') {
		window.history.replaceState(null, '', `${window.location.pathname}?view=posts`);
		window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
	}

	setView(initialView);
	updateProgress();
};
