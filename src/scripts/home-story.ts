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
	const panelHideTimers = new WeakMap<HTMLElement, number>();
	type StoryView = 'cover' | 'about' | 'posts';
	const step = () => Math.max(1280, track.clientWidth * 1.45);
	const isStoryView = (view: string | null): view is StoryView =>
		view === 'cover' || view === 'about' || view === 'posts';

	const setView = (view: StoryView) => {
		root.dataset.view = view;
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
		track.scrollTo({ left: 0, behavior: 'smooth' });
		window.requestAnimationFrame(updateProgress);
	};

	const showAbout = () => {
		clearActiveCard();
		setView('about');
		track.scrollTo({ left: 0, behavior: 'smooth' });
		window.requestAnimationFrame(updateProgress);
	};

	const showPosts = () => {
		setView('posts');
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

	const handleWheel = (event: WheelEvent) => {
		const mainDelta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;

		if (mainDelta === 0) {
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

	const handleFilterWheel = (event: WheelEvent) => {
		const mainDelta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;

		if (!filterList || mainDelta === 0) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		filterList.scrollBy({
			top: mainDelta * 1.4,
			behavior: 'auto',
		});
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
