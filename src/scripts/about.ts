const tooltipGap = 10;
const viewportMargin = 12;

export const initAboutPages = () => {
	document.querySelectorAll<HTMLElement>('[data-about-page]').forEach((page) => {
		if (page.dataset.aboutInitialized === 'true') return;
		page.dataset.aboutInitialized = 'true';

		const tooltip = page.querySelector<HTMLElement>('[data-about-tooltip]');
		const targets = Array.from(page.querySelectorAll<HTMLElement>('[data-about-tip]'));
		const stage = page.closest<HTMLElement>('[data-workspace-stage]');
		if (!tooltip || targets.length === 0) return;

		let activeTarget: HTMLElement | undefined;
		let showTimer: number | undefined;
		let hideTimer: number | undefined;

		const clearTimers = () => {
			if (showTimer !== undefined) window.clearTimeout(showTimer);
			if (hideTimer !== undefined) window.clearTimeout(hideTimer);
			showTimer = undefined;
			hideTimer = undefined;
		};

		const positionTooltip = () => {
			if (!activeTarget) return;
			const targetRect = activeTarget.getBoundingClientRect();
			const tooltipRect = tooltip.getBoundingClientRect();
			const maximumLeft = Math.max(viewportMargin, window.innerWidth - tooltipRect.width - viewportMargin);
			const left = Math.min(Math.max(targetRect.left + targetRect.width / 2 - tooltipRect.width / 2, viewportMargin), maximumLeft);
			const preferredTop = targetRect.top - tooltipRect.height - tooltipGap;
			const top = preferredTop >= viewportMargin
				? preferredTop
				: Math.min(targetRect.bottom + tooltipGap, window.innerHeight - tooltipRect.height - viewportMargin);
			tooltip.style.left = `${Math.round(left)}px`;
			tooltip.style.top = `${Math.round(Math.max(top, viewportMargin))}px`;
		};

		const hideTooltip = (delay = 0) => {
			clearTimers();
			const conceal = () => {
				tooltip.removeAttribute('data-tip-visible');
				tooltip.setAttribute('aria-hidden', 'true');
				activeTarget = undefined;
				hideTimer = undefined;
			};
			if (delay === 0) conceal();
			else hideTimer = window.setTimeout(conceal, delay);
		};

		const showTooltip = (target: HTMLElement, delay = 0) => {
			clearTimers();
			const reveal = () => {
				activeTarget = target;
				tooltip.textContent = target.dataset.aboutTip ?? '';
				tooltip.setAttribute('aria-hidden', 'false');
				positionTooltip();
				tooltip.dataset.tipVisible = 'true';
				showTimer = undefined;
			};
			if (delay === 0) reveal();
			else showTimer = window.setTimeout(reveal, delay);
		};

		targets.forEach((target) => {
			target.addEventListener('pointerenter', (event) => {
				if (event.pointerType === 'touch') return;
				showTooltip(target, 150);
			});
			target.addEventListener('pointerleave', () => hideTooltip(120));
			target.addEventListener('focus', () => showTooltip(target));
			target.addEventListener('blur', () => hideTooltip());
			target.addEventListener('keydown', (event) => {
				if (event.key !== 'Escape') return;
				event.preventDefault();
				hideTooltip();
			});
		});

		document.addEventListener('keydown', (event) => {
			if (event.key === 'Escape' && activeTarget) hideTooltip();
		});
		window.addEventListener('resize', () => hideTooltip());
		stage?.addEventListener('scroll', () => hideTooltip(), { passive: true });
	});
};
