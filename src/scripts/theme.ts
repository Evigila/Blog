export const initTheme = (
	button: HTMLElement | null,
	label: HTMLElement | null,
) => {
	const root = document.documentElement;

	const sync = () => {
		const isDark = root.dataset.theme === 'dark';
		const themeName = isDark ? '深色' : '浅色';

		if (label) {
			label.textContent = themeName;
		}

		if (button) {
			button.setAttribute('aria-label', `切换主题，当前${themeName}`);
			button.setAttribute('aria-pressed', String(isDark));
		}
	};

	sync();

	button?.addEventListener('click', () => {
		const nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
		root.dataset.theme = nextTheme;
		localStorage.setItem('evigila-theme', nextTheme);
		sync();
	});
};

// ── Font size (shared between home and post pages) ─────────────────────────
const FONT_SIZE_KEY = 'evigila-font-size';
const fontSizeValues = ['small', 'normal', 'large'] as const;
type FontSizeValue = (typeof fontSizeValues)[number];

export const initFontSize = (popupWrapSelector: string) => {
	const root = document.documentElement;
	const fontToggleBtn = document.querySelector<HTMLElement>('[data-font-toggle]');
	const fontPopup = document.querySelector<HTMLElement>('[data-font-popup]');
	const fontSlider = document.querySelector<HTMLInputElement>('[data-font-slider]');

	let currentFontSize: FontSizeValue =
		(localStorage.getItem(FONT_SIZE_KEY) as FontSizeValue | null) ?? 'normal';

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
				const wrap = fontToggleBtn.closest(popupWrapSelector);
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
};

