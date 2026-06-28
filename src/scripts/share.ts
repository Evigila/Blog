const SITE_URL = 'https://blog.evigila.net';

const getShareUrl = () => {
	const storyRoot = document.querySelector<HTMLElement>('[data-carousel-root]');
	const storyView = storyRoot?.dataset.view;
	const viewSearch =
		window.location.pathname === '/' && (storyView === 'about' || storyView === 'posts')
			? `?view=${storyView}`
			: '';

	return `${SITE_URL}${window.location.pathname}${viewSearch}`;
};

const showToast = (message: string) => {
	(window as unknown as { showToast?: (m: string) => void }).showToast?.(message);
};

export const initShareControls = () => {
	const shareButtons = Array.from(document.querySelectorAll<HTMLElement>('[data-share]'));

	shareButtons.forEach((shareButton) => {
		if (shareButton.dataset.shareReady === 'true') {
			return;
		}

		const shareIcon = shareButton.querySelector<SVGElement>('.post-action-icon--share');
		const successIcon = shareButton.querySelector<SVGElement>('.post-action-icon--success');
		let resetTimeout: ReturnType<typeof setTimeout> | undefined;

		shareButton.dataset.shareReady = 'true';
		shareButton.addEventListener('click', async () => {
			const url = getShareUrl();

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

			showToast('链接已复制到剪贴板');
			if (shareIcon) {
				shareIcon.style.display = 'none';
			}
			if (successIcon) {
				successIcon.style.display = 'block';
			}
			if (resetTimeout !== undefined) {
				window.clearTimeout(resetTimeout);
			}
			resetTimeout = window.setTimeout(() => {
				if (shareIcon) {
					shareIcon.style.display = '';
				}
				if (successIcon) {
					successIcon.style.display = 'none';
				}
			}, 2200);
		});
	});
};
