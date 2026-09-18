import { initShareControls } from './share';

type TocEntry = {
	link: HTMLAnchorElement;
	section: HTMLElement;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const initPostPage = () => {
	const stage = document.querySelector<HTMLElement>('[data-workspace-stage]');
	const article = document.querySelector<HTMLElement>('[data-post-article]');
	const content = document.querySelector<HTMLElement>('[data-post-content]');
	const outline = document.querySelector<HTMLElement>('[data-post-outline]');
	const progressValue = document.querySelector<HTMLElement>('[data-reading-progress-value]');
	const comments = document.getElementById('post-comments');
	if (!stage || !article || !content) return;

	const tocEntries = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-toc-link]'))
		.map((link): TocEntry | null => {
			const targetId = link.dataset.targetId;
			const section = targetId ? document.getElementById(targetId) : null;
			return section ? { link, section } : null;
		})
		.filter((entry): entry is TocEntry => entry !== null);
	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	const behavior = (): ScrollBehavior => reducedMotion.matches ? 'auto' : 'smooth';
	let frame: number | undefined;
	let activeTocIndex = -2;
	const scrollToTarget = (target: HTMLElement) => {
		stage.closest<HTMLElement>('.workspace-shell')?.classList.add('is-heading-compact');
		window.requestAnimationFrame(() => {
			const stageRect = stage.getBoundingClientRect();
			const targetTop = target.getBoundingClientRect().top - stageRect.top + stage.scrollTop;
			stage.scrollTo({ top: Math.max(targetTop - 120, 0), behavior: behavior() });
		});
	};

	const update = () => {
		frame = undefined;
		const stageRect = stage.getBoundingClientRect();
		const contentRect = content.getBoundingClientRect();
		const contentTop = contentRect.top - stageRect.top + stage.scrollTop;
		const progress = clamp(
			(stage.scrollTop + stage.clientHeight * 0.25 - contentTop)
			/ Math.max(content.scrollHeight - stage.clientHeight * 0.4, 1),
			0,
			1,
		);
		const progressLabel = `${Math.round(progress * 100)}%`;
		outline?.style.setProperty('--reading-progress', progressLabel);
		if (progressValue) progressValue.textContent = progressLabel;

		let activeIndex = -1;
		const activationLine = stageRect.top + Math.min(stage.clientHeight * 0.24, 180);
		tocEntries.forEach((entry, index) => {
			if (entry.section.getBoundingClientRect().top <= activationLine) activeIndex = index;
		});
		tocEntries.forEach((entry, index) => {
			const active = index === activeIndex;
			entry.link.classList.toggle('is-active', active);
			if (active) entry.link.setAttribute('aria-current', 'location');
			else entry.link.removeAttribute('aria-current');
		});
		if (activeIndex !== activeTocIndex) {
			activeTocIndex = activeIndex;
			const activeLink = tocEntries[activeIndex]?.link;
			const list = activeLink?.closest<HTMLElement>('.post-outline__list');
			if (activeLink && list) {
				const listRect = list.getBoundingClientRect();
				const linkRect = activeLink.getBoundingClientRect();
				if (linkRect.top < listRect.top || linkRect.bottom > listRect.bottom) {
					list.scrollTo({
						top: list.scrollTop + linkRect.top - listRect.top - (list.clientHeight - linkRect.height) / 2,
						behavior: 'auto',
					});
				}
			}
		}
	};

	const queueUpdate = () => {
		if (frame !== undefined) return;
		frame = window.requestAnimationFrame(update);
	};

	initShareControls();
	document.querySelectorAll<HTMLElement>('[data-scroll-top]').forEach((button) => {
		button.addEventListener('click', () => stage.scrollTo({ top: 0, behavior: behavior() }));
	});
	document.querySelectorAll<HTMLAnchorElement>('[data-scroll-comments]').forEach((button) => {
		button.addEventListener('click', (event) => {
			if (!comments) return;
			event.preventDefault();
			scrollToTarget(comments);
			history.replaceState(history.state, '', '#post-comments');
		});
	});
	tocEntries.forEach(({ link, section }) => {
		link.addEventListener('click', (event) => {
			event.preventDefault();
			scrollToTarget(section);
			if (!section.hasAttribute('tabindex')) section.tabIndex = -1;
			window.requestAnimationFrame(() => section.focus({ preventScroll: true }));
			history.replaceState(history.state, '', `#${section.id}`);
		});
	});

	stage.addEventListener('scroll', queueUpdate, { passive: true });
	window.addEventListener('resize', queueUpdate, { passive: true });
	new ResizeObserver(queueUpdate).observe(article);
	queueUpdate();
};
