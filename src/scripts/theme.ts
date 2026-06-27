export const initTheme = (button?: HTMLElement | null, label?: HTMLElement | null) => {
	const root = document.documentElement;
	const buttons = button
		? [button]
		: Array.from(document.querySelectorAll<HTMLElement>('[data-theme-toggle]'));
	const labels = label
		? [label]
		: Array.from(document.querySelectorAll<HTMLElement>('[data-theme-label]'));

	const sync = () => {
		const isDark = root.dataset.theme === 'dark';
		const themeName = isDark ? 'Dark' : 'Light';

		labels.forEach((labelElement) => {
			labelElement.textContent = themeName;
		});

		buttons.forEach((buttonElement) => {
			buttonElement.setAttribute('aria-label', `Toggle theme, current: ${themeName}`);
			buttonElement.setAttribute('aria-pressed', String(isDark));
		});
	};

	sync();

	buttons.forEach((buttonElement) => {
		if (buttonElement.dataset.themeReady === 'true') {
			return;
		}

		buttonElement.dataset.themeReady = 'true';
		buttonElement.addEventListener('click', () => {
			const nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
			root.dataset.theme = nextTheme;
			localStorage.setItem('evigila-theme', nextTheme);
			sync();
		});
	});
};
