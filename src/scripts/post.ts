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
	const giscusRoot = document.querySelector<HTMLElement>('[data-giscus-root]');
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
	let giscusObserver: IntersectionObserver | undefined;
	const scrollToTarget = (target: HTMLElement) => {
		stage.closest<HTMLElement>('.workspace-shell')?.classList.add('is-heading-compact');
		window.requestAnimationFrame(() => {
			const stageRect = stage.getBoundingClientRect();
			const targetTop = target.getBoundingClientRect().top - stageRect.top + stage.scrollTop;
			stage.scrollTo({ top: Math.max(targetTop - 120, 0), behavior: behavior() });
		});
	};

	const ensureGiscusLoaded = () => {
		if (!giscusRoot || giscusRoot.dataset.giscusState) return;
		giscusRoot.dataset.giscusState = 'loading';
		const script = document.createElement('script');
		script.src = 'https://giscus.app/client.js';
		script.async = true;
		script.crossOrigin = 'anonymous';
		const config = {
			repo: giscusRoot.dataset.giscusRepo,
			'repo-id': giscusRoot.dataset.giscusRepoId,
			category: giscusRoot.dataset.giscusCategory,
			'category-id': giscusRoot.dataset.giscusCategoryId,
			mapping: giscusRoot.dataset.giscusMapping,
			strict: giscusRoot.dataset.giscusStrict,
			'reactions-enabled': giscusRoot.dataset.giscusReactionsEnabled,
			'emit-metadata': giscusRoot.dataset.giscusEmitMetadata,
			'input-position': giscusRoot.dataset.giscusInputPosition,
			theme: giscusRoot.dataset.giscusTheme,
			lang: giscusRoot.dataset.giscusLang,
		};
		Object.entries(config).forEach(([name, value]) => {
			if (value) script.setAttribute(`data-${name}`, value);
		});
		script.addEventListener('load', () => { giscusRoot.dataset.giscusState = 'loaded'; }, { once: true });
		script.addEventListener('error', () => {
			giscusRoot.removeAttribute('data-giscus-state');
			script.remove();
		}, { once: true });
		giscusRoot.appendChild(script);
		giscusObserver?.disconnect();
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
			ensureGiscusLoaded();
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

	if (comments && giscusRoot) {
		if ('IntersectionObserver' in window) {
			giscusObserver = new IntersectionObserver((entries) => {
				if (entries.some((entry) => entry.isIntersecting)) ensureGiscusLoaded();
			}, { root: stage, rootMargin: '800px 0px' });
			giscusObserver.observe(comments);
		} else ensureGiscusLoaded();
	}

	stage.addEventListener('scroll', queueUpdate, { passive: true });
	window.addEventListener('resize', queueUpdate, { passive: true });
	new ResizeObserver(queueUpdate).observe(article);
	queueUpdate();
};
