export const initWorkspaceShells = () => {
	document.querySelectorAll<HTMLElement>('.workspace-shell').forEach((shell) => {
		if (shell.dataset.workspaceInitialized === 'true') return;
		shell.dataset.workspaceInitialized = 'true';
		const stage = shell.querySelector<HTMLElement>('[data-workspace-stage]');
		const scrollTop = shell.querySelector<HTMLButtonElement>('[data-workspace-scroll-top]');
		if (!stage || !scrollTop) return;
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
		let compact = false;
		let frame: number | undefined;
		const scrollToTarget = (target: HTMLElement, updateHistory = false) => {
			compact = true;
			shell.classList.add('is-heading-compact');
			window.requestAnimationFrame(() => {
				const stageRect = stage.getBoundingClientRect();
				const targetTop = target.getBoundingClientRect().top - stageRect.top + stage.scrollTop;
				stage.scrollTo({ top: Math.max(targetTop - 120, 0), behavior: reducedMotion.matches ? 'auto' : 'smooth' });
				if (updateHistory) history.pushState(history.state, '', `#${encodeURIComponent(target.id)}`);
			});
		};

		const update = () => {
			frame = undefined;
			if (!compact && (stage.scrollTop > 96 || (stage.scrollTop > 0 && shell.classList.contains('is-heading-compact')))) compact = true;
			else if (compact && stage.scrollTop < 24) compact = false;
			shell.classList.toggle('is-heading-compact', compact);
			scrollTop.hidden = stage.scrollTop <= 280;
		};

		const queueUpdate = () => {
			if (frame !== undefined) return;
			frame = requestAnimationFrame(update);
		};

		stage.addEventListener('scroll', queueUpdate, { passive: true });
		shell.addEventListener('click', (event) => {
			if (event.defaultPrevented || !(event.target instanceof Element)) return;
			const link = event.target.closest<HTMLAnchorElement>('a[href]');
			if (!link || !shell.contains(link) || link.target === '_blank') return;
			const url = new URL(link.href, window.location.href);
			if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || !url.hash) return;
			const targetId = decodeURIComponent(url.hash.slice(1));
			const target = document.getElementById(targetId);
			if (!target) return;
			event.preventDefault();
			scrollToTarget(target, true);
		});
		scrollTop.addEventListener('click', () => stage.scrollTo({
			top: 0,
			behavior: reducedMotion.matches ? 'auto' : 'smooth',
		}));
		update();
		if (window.location.hash) {
			const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
			if (target) window.requestAnimationFrame(() => scrollToTarget(target));
		}
	});
};
