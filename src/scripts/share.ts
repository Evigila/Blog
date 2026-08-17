const SITE_URL = 'https://blog.evigila.net';
const SUCCESS_DURATION = 1400;

interface OriginalButtonState {
	text: string;
	ariaLabel: string | null;
}

const originalStates = new WeakMap<HTMLElement, OriginalButtonState>();
const restoreTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
const attempts = new WeakMap<HTMLElement, number>();
let lifecycleReady = false;

const getShareUrl = () => `${SITE_URL}${window.location.pathname}`;

const showToast = (message: string) => {
	(window as unknown as { showToast?: (m: string) => void }).showToast?.(message);
};

const rememberButton = (button: HTMLElement) => {
	if (originalStates.has(button)) return;
	originalStates.set(button, {
		text: button.textContent ?? '',
		ariaLabel: button.getAttribute('aria-label'),
	});
};

const restoreButton = (button: HTMLElement) => {
	const timer = restoreTimers.get(button);
	if (timer !== undefined) clearTimeout(timer);
	restoreTimers.delete(button);

	const original = originalStates.get(button);
	if (!original) return;
	button.textContent = original.text;
	if (original.ariaLabel === null) button.removeAttribute('aria-label');
	else button.setAttribute('aria-label', original.ariaLabel);
	delete button.dataset.shareState;
};

const showCopiedState = (button: HTMLElement) => {
	restoreButton(button);
	button.textContent = '✔';
	button.setAttribute('aria-label', '链接已复制');
	button.dataset.shareState = 'copied';
	restoreTimers.set(button, setTimeout(() => restoreButton(button), SUCCESS_DURATION));
};

const copyWithFallback = async (text: string, focusTarget: HTMLElement): Promise<boolean> => {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		const textarea = document.createElement('textarea');
		textarea.value = text;
		textarea.readOnly = true;
		textarea.setAttribute('aria-hidden', 'true');
		textarea.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;';
		document.body.appendChild(textarea);

		try {
			textarea.select();
			return document.execCommand('copy');
		} catch {
			return false;
		} finally {
			textarea.remove();
			focusTarget.focus({ preventScroll: true });
		}
	}
};

const resetShareButtons = () => {
	document.querySelectorAll<HTMLElement>('[data-share]').forEach((button) => {
		attempts.set(button, (attempts.get(button) ?? 0) + 1);
		restoreButton(button);
	});
};

export const initShareControls = () => {
	const shareButtons = Array.from(document.querySelectorAll<HTMLElement>('[data-share]'));

	shareButtons.forEach((shareButton) => {
		rememberButton(shareButton);
		if (shareButton.dataset.shareReady === 'true') {
			return;
		}

		shareButton.dataset.shareReady = 'true';
		shareButton.addEventListener('click', async () => {
			const url = getShareUrl();
			const attempt = (attempts.get(shareButton) ?? 0) + 1;
			attempts.set(shareButton, attempt);
			const copied = await copyWithFallback(url, shareButton);
			if (attempts.get(shareButton) !== attempt) return;

			if (copied) {
				showCopiedState(shareButton);
				showToast('链接已复制到剪贴板');
			} else {
				restoreButton(shareButton);
				showToast('复制失败，请手动复制链接');
			}
		});
	});

	if (!lifecycleReady) {
		lifecycleReady = true;
		window.addEventListener('pagehide', resetShareButtons);
		window.addEventListener('pageshow', resetShareButtons);
	}
};
