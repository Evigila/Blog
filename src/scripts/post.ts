import { initShareControls } from './share';
import { initTheme } from './theme';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const initPostPage = () => {
	const root = document.documentElement;
	const article = document.querySelector<HTMLElement>('[data-post-article]');
	const postShell = document.querySelector<HTMLElement>('.post-shell');
	const footer = document.querySelector<HTMLElement>('.post-footer');
	const themeButton = document.querySelector<HTMLElement>('[data-theme-toggle]');
	const themeLabel = document.querySelector<HTMLElement>('[data-theme-label]');
	const postContent = document.querySelector<HTMLElement>('[data-post-content]');
	const outline = document.querySelector<HTMLElement>('[data-post-outline]');
	const progressValue = document.querySelector<HTMLElement>('[data-reading-progress-value]');
	const tocEntries = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-toc-link]'))
		.map((link) => {
			const targetId = link.dataset.targetId;
			const section = targetId ? document.getElementById(targetId) : null;

			return section ? { link, section } : null;
		})
		.filter((entry): entry is { link: HTMLAnchorElement; section: HTMLElement } => Boolean(entry));
	const scrollButtons = Array.from(document.querySelectorAll<HTMLElement>('[data-scroll-top]'));

	let ticking = false;

	const updateReadingProgress = () => {
		if (!postContent || !outline || !progressValue) {
			return;
		}

		const contentTop = postContent.getBoundingClientRect().top + window.scrollY;
		const contentBottom = contentTop + postContent.offsetHeight;
		const current = window.scrollY + window.innerHeight * 0.22;
		const progress = clamp(
			(current - contentTop) / Math.max(contentBottom - contentTop - window.innerHeight * 0.35, 1),
			0,
			1,
		);
		const progressLabel = `${Math.round(progress * 100)}%`;

		outline.style.setProperty('--reading-progress', progressLabel);
		progressValue.textContent = progressLabel;
	};

	const updateActiveHeading = () => {
		if (tocEntries.length === 0) {
			return;
		}

		const current = window.scrollY + window.innerHeight * 0.24;
		let activeIndex = -1;

		tocEntries.forEach((entry, index) => {
			if (entry.section.offsetTop <= current) {
				activeIndex = index;
			}
		});

		if (activeIndex < 0) {
			activeIndex = 0;
		}

		tocEntries.forEach((entry, index) => {
			const isActive = index === activeIndex;
			const isPassed = index < activeIndex;

			entry.link.classList.toggle('is-active', isActive);
			entry.link.classList.toggle('is-passed', isPassed);
			entry.link.setAttribute('aria-current', isActive ? 'true' : 'false');
		});
	};

	const updateDockState = () => {
		const expanded = window.scrollY > 180;
		const nextValue = expanded ? 'true' : 'false';

		if (root.dataset.postDockExpanded !== nextValue) {
			root.dataset.postDockExpanded = nextValue;
		}
	};

	const updateDockLift = () => {
		if (!postShell || !footer) {
			return;
		}

		const footerRect = footer.getBoundingClientRect();
		const lift = Math.max(window.innerHeight - footerRect.top + 16, 0);

		postShell.style.setProperty('--post-dock-lift', `${Math.round(lift)}px`);
	};

	const update = () => {
		updateReadingProgress();
		updateActiveHeading();
		updateDockState();
		updateDockLift();
	};

	const queueUpdate = () => {
		if (ticking) {
			return;
		}

		ticking = true;
		window.requestAnimationFrame(() => {
			ticking = false;
			update();
		});
	};

	if (!article) {
		return;
	}

	initTheme(themeButton, themeLabel);
	initShareControls();
	update();

	const syncGiscusTheme = () => {
		const iframe = document.querySelector<HTMLIFrameElement>('iframe.giscus-frame');
		if (!iframe?.contentWindow) {
			return;
		}

		const isDark = root.dataset.theme === 'dark';
		iframe.contentWindow.postMessage(
			{ giscus: { setConfig: { theme: isDark ? 'dark_dimmed' : 'light' } } },
			'https://giscus.app',
		);
	};

	window.addEventListener(
		'message',
		(event: MessageEvent) => {
			if (event.origin !== 'https://giscus.app') {
				return;
			}

			if (typeof event.data !== 'object' || !event.data.giscus) {
				return;
			}

			syncGiscusTheme();
		},
		{ once: true },
	);

	themeButton?.addEventListener('click', () => {
		window.requestAnimationFrame(syncGiscusTheme);
	});

	scrollButtons.forEach((button) => {
		button.addEventListener('click', () => {
			window.scrollTo({ top: 0, behavior: 'smooth' });
		});
	});

	window.addEventListener('scroll', queueUpdate, { passive: true });
	window.addEventListener('resize', queueUpdate, { passive: true });
};
