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
	update();

	// ── Giscus theme sync ──────────────────────────────────────────────────────
	const syncGiscusTheme = () => {
		const iframe = document.querySelector<HTMLIFrameElement>('iframe.giscus-frame');
		if (!iframe?.contentWindow) return;
		const isDark = root.dataset.theme === 'dark';
		iframe.contentWindow.postMessage(
			{ giscus: { setConfig: { theme: isDark ? 'dark_dimmed' : 'light' } } },
			'https://giscus.app',
		);
	};

	// 页面加载后 Giscus iframe 就绪时，读取已保存的站点主题并同步一次
	window.addEventListener(
		'message',
		(event: MessageEvent) => {
			if (event.origin !== 'https://giscus.app') return;
			if (typeof event.data !== 'object' || !event.data.giscus) return;
			syncGiscusTheme();
		},
		{ once: true },
	);

	themeButton?.addEventListener('click', () => {
		// 等 initTheme 更新 dataset.theme 后再同步
		requestAnimationFrame(syncGiscusTheme);
	});

	// ── Font size ──────────────────────────────────────────────────────────────
	const FONT_SIZE_KEY = 'evigila-font-size';
	const fontSizeValues = ['small', 'normal', 'large'] as const;
	type FontSizeValue = (typeof fontSizeValues)[number];

	const fontToggleBtn = document.querySelector<HTMLElement>('[data-font-toggle]');
	const fontPopup = document.querySelector<HTMLElement>('[data-font-popup]');
	const fontSlider = document.querySelector<HTMLInputElement>('[data-font-slider]');

	let currentFontSize: FontSizeValue = (localStorage.getItem(FONT_SIZE_KEY) as FontSizeValue | null) ?? 'normal';

	const applyFontSize = (size: FontSizeValue) => {
		currentFontSize = size;
		if (size === 'normal') {
			delete root.dataset.fontSize;
		} else {
			root.dataset.fontSize = size;
		}
		localStorage.setItem(FONT_SIZE_KEY, size);
		if (fontSlider) {
			fontSlider.value = String(fontSizeValues.indexOf(size));
		}
	};

	applyFontSize(currentFontSize);

	if (fontToggleBtn && fontPopup) {
		fontToggleBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			const willOpen = fontPopup.hidden;
			fontPopup.hidden = !willOpen;
			fontToggleBtn.setAttribute('aria-expanded', String(willOpen));
		});

		document.addEventListener('click', (e) => {
			if (!fontPopup.hidden) {
				const wrap = fontToggleBtn.closest('.post-font-wrap');
				if (!wrap?.contains(e.target as Node)) {
					fontPopup.hidden = true;
					fontToggleBtn.setAttribute('aria-expanded', 'false');
				}
			}
		});

		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' && !fontPopup.hidden) {
				fontPopup.hidden = true;
				fontToggleBtn.setAttribute('aria-expanded', 'false');
				fontToggleBtn.focus();
			}
		});
	}

	if (fontSlider) {
		fontSlider.addEventListener('input', () => {
			applyFontSize(fontSizeValues[parseInt(fontSlider.value, 10)]);
		});
	}

	// ── Share ──────────────────────────────────────────────────────────────────
	const SITE_URL = 'https://evigila.net';
	let shareToastTimeout: ReturnType<typeof setTimeout> | null = null;

	const showShareToast = (message: string) => {
		let toast = document.querySelector<HTMLElement>('.hero-share-toast');
		if (!toast) {
			toast = document.createElement('div');
			toast.className = 'hero-share-toast';
			toast.setAttribute('role', 'status');
			toast.setAttribute('aria-live', 'polite');
			document.body.appendChild(toast);
		}
		toast.textContent = message;
		toast.classList.add('is-visible');
		if (shareToastTimeout !== null) {
			clearTimeout(shareToastTimeout);
		}
		shareToastTimeout = setTimeout(() => {
			toast!.classList.remove('is-visible');
		}, 3000);
	};

	const shareBtn = document.querySelector<HTMLElement>('[data-share]');
	if (shareBtn) {
		const shareIconEl = shareBtn.querySelector<SVGElement>('.post-action-icon--share');
		const successIconEl = shareBtn.querySelector<SVGElement>('.post-action-icon--success');
		let shareResetTimeout: ReturnType<typeof setTimeout> | null = null;

		shareBtn.addEventListener('click', async () => {
			const url = SITE_URL + window.location.pathname;
			try {
				await navigator.clipboard.writeText(url);
			} catch {
				const textarea = document.createElement('textarea');
				textarea.value = url;
				textarea.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
				document.body.appendChild(textarea);
				textarea.select();
				document.execCommand('copy');
				document.body.removeChild(textarea);
			}
			showShareToast('感谢分享，当前博客地址已经复制到剪贴板了喵~');
			// Show success icon
			if (shareIconEl) shareIconEl.style.display = 'none';
			if (successIconEl) successIconEl.style.display = 'block';
			if (shareResetTimeout !== null) clearTimeout(shareResetTimeout);
			shareResetTimeout = setTimeout(() => {
				if (shareIconEl) shareIconEl.style.display = '';
				if (successIconEl) successIconEl.style.display = 'none';
			}, 2200);
		});
	}

	scrollButtons.forEach((button) => {
		button.addEventListener('click', () => {
			window.scrollTo({ top: 0, behavior: 'smooth' });
		});
	});

	window.addEventListener('scroll', queueUpdate, { passive: true });
	window.addEventListener('resize', queueUpdate, { passive: true });
};
