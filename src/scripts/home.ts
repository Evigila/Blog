import { initTheme } from './theme';

const FILTER_ALL = 'all';
const HERO_STATE_DOCKED = 'docked';

const collectCardTags = (card: Element) => new Set((card.getAttribute('data-tags') || '').split('|').filter(Boolean));

export const initHomePage = () => {
	const root = document.documentElement;
	const themeButton = document.querySelector<HTMLElement>('[data-theme-toggle]');
	const themeLabel = document.querySelector<HTMLElement>('[data-theme-label]');
	const stageShell = document.querySelector<HTMLElement>('[data-stage-shell]');
	const filterButtons = Array.from(document.querySelectorAll<HTMLElement>('[data-tag-filter]'));
	const tagsExpandButtons = Array.from(document.querySelectorAll<HTMLElement>('[data-tags-expand-toggle]'));
	const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-post-card]')).map((card) => ({
		element: card,
		tags: collectCardTags(card),
	}));
	const scrollButtons = Array.from(document.querySelectorAll<HTMLElement>('[data-scroll-top]'));
	const emptyState = document.querySelector<HTMLElement>('[data-feed-empty]');
	const feedSummary = document.querySelector<HTMLElement>('[data-feed-summary]');
	const tagShelf = document.querySelector<HTMLElement>('[data-tag-shelf]');

	let activeFilter = FILTER_ALL;
	let tagsExpanded = root.dataset.tagsExpanded === 'true';
	let stageProgress = '';
	let heroState = root.dataset.heroState ?? '';
	let stageDistance = 1;
	let ticking = false;
	let resizeTicking = false;

	const syncFilterButtons = () => {
		filterButtons.forEach((button) => {
			const isActive = button.getAttribute('data-tag-filter') === activeFilter;
			button.classList.toggle('is-active', isActive);
			button.setAttribute('aria-checked', String(isActive));
			button.tabIndex = isActive ? 0 : -1;
		});
	};

	const moveFilterFocus = (currentIndex: number, nextIndex: number) => {
		const safeIndex = (nextIndex + filterButtons.length) % filterButtons.length;
		filterButtons[safeIndex]?.focus();
	};

	const applyFilter = (tag: string, force = false) => {
		if (!force && activeFilter === tag) {
			return;
		}

		activeFilter = tag;
		let visibleCards = 0;

		cards.forEach(({ element, tags }) => {
			const matches = tag === FILTER_ALL || tags.has(tag);

			if (element.hidden === matches) {
				element.hidden = !matches;
			}

			if (matches) {
				visibleCards += 1;
			}
		});

		syncFilterButtons();

		if (feedSummary) {
			feedSummary.textContent = `Archive / ${visibleCards} Posts`;
		}

		if (emptyState) {
			emptyState.hidden = visibleCards > 0;
		}
	};

	const syncTagsExpanded = () => {
		const shelfVisible = tagsExpanded;
		root.dataset.tagsExpanded = String(tagsExpanded);

		if (tagShelf) {
			if (tagShelf.hidden === shelfVisible) {
				tagShelf.hidden = !shelfVisible;
			}
		}

		tagsExpandButtons.forEach((button) => {
			button.setAttribute('aria-pressed', String(tagsExpanded));
			button.setAttribute('aria-expanded', String(shelfVisible));
		});
	};

	const measureStage = () => {
		if (!stageShell) {
			stageDistance = 1;
			return;
		}

		stageDistance = Math.max(stageShell.offsetHeight - window.innerHeight, 1);
	};

	const updateStage = () => {
		if (!stageShell) {
			return;
		}

		const progress = Math.min(Math.max(window.scrollY / stageDistance, 0), 1);
		const nextProgress = progress.toFixed(3);
		const nextHeroState = progress >= 0.98 ? HERO_STATE_DOCKED : 'floating';

		if (stageProgress !== nextProgress) {
			stageProgress = nextProgress;
			root.style.setProperty('--stage-progress', nextProgress);
		}

		if (heroState !== nextHeroState) {
			heroState = nextHeroState;
			root.dataset.heroState = nextHeroState;
		}
	};

	const queueStageUpdate = () => {
		if (ticking) {
			return;
		}

		ticking = true;
		window.requestAnimationFrame(() => {
			ticking = false;
			updateStage();
		});
	};

	initTheme(themeButton, themeLabel);
	measureStage();
	applyFilter(FILTER_ALL, true);
	syncTagsExpanded();
	updateStage();

	filterButtons.forEach((button) => {
		button.addEventListener('click', () => {
			applyFilter(button.getAttribute('data-tag-filter') || FILTER_ALL);
		});

		button.addEventListener('keydown', (event) => {
			const currentIndex = filterButtons.indexOf(button);

			if (currentIndex === -1) {
				return;
			}

			if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
				event.preventDefault();
				moveFilterFocus(currentIndex, currentIndex + 1);
				return;
			}

			if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
				event.preventDefault();
				moveFilterFocus(currentIndex, currentIndex - 1);
				return;
			}

			if (event.key === 'Home') {
				event.preventDefault();
				filterButtons[0]?.focus();
				return;
			}

			if (event.key === 'End') {
				event.preventDefault();
				filterButtons[filterButtons.length - 1]?.focus();
			}
		});
	});

	tagsExpandButtons.forEach((button) => {
		button.addEventListener('click', () => {
			tagsExpanded = !tagsExpanded;
			syncTagsExpanded();
		});
	});

	scrollButtons.forEach((button) => {
		button.addEventListener('click', () => {
			window.scrollTo({ top: 0, behavior: 'smooth' });
		});
	});

	window.addEventListener('scroll', queueStageUpdate, { passive: true });
	window.addEventListener('resize', () => {
		if (!resizeTicking) {
			resizeTicking = true;
			window.requestAnimationFrame(() => {
				resizeTicking = false;
				measureStage();
				queueStageUpdate();
			});
		}
	}, { passive: true });
};