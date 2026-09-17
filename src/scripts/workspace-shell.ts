export const initWorkspaceShells = () => {
	document.querySelectorAll<HTMLElement>('.workspace-shell').forEach((shell) => {
		if (shell.dataset.workspaceInitialized === 'true') return;
		shell.dataset.workspaceInitialized = 'true';
		const stage = shell.querySelector<HTMLElement>('[data-workspace-stage]');
		const scrollTop = shell.querySelector<HTMLButtonElement>('[data-workspace-scroll-top]');
		if (!stage || !scrollTop) return;
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
		const primaryNavigationHost = shell.querySelector<HTMLElement>('[data-primary-navigation]');
		const primaryNavigation = Array.from(shell.querySelectorAll<HTMLElement>('[data-primary-nav]'));
		let compact = false;
		let frame: number | undefined;
		let tipShowTimer: number | undefined;
		let tipHideTimer: number | undefined;
		let visibleTip: HTMLElement | undefined;
		const hideTip = (item = visibleTip, delay = 0) => {
			if (tipShowTimer !== undefined) window.clearTimeout(tipShowTimer);
			if (tipHideTimer !== undefined) window.clearTimeout(tipHideTimer);
			tipShowTimer = undefined;
			tipHideTimer = undefined;
			const conceal = () => {
				item?.removeAttribute('data-tip-visible');
				if (visibleTip === item) visibleTip = undefined;
				tipHideTimer = undefined;
			};
			if (delay === 0) conceal();
			else tipHideTimer = window.setTimeout(conceal, delay);
		};
		const showTip = (item: HTMLElement, delay = 0) => {
			if (tipShowTimer !== undefined) window.clearTimeout(tipShowTimer);
			if (tipHideTimer !== undefined) window.clearTimeout(tipHideTimer);
			tipShowTimer = undefined;
			tipHideTimer = undefined;
			if (visibleTip && visibleTip !== item) visibleTip.removeAttribute('data-tip-visible');
			const reveal = () => {
				visibleTip = item;
				item.dataset.tipVisible = 'true';
				tipShowTimer = undefined;
			};
			if (delay === 0) reveal();
			else tipShowTimer = window.setTimeout(reveal, delay);
		};
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
		primaryNavigation.forEach((item) => {
			item.addEventListener('pointerenter', () => showTip(item, 150));
			item.addEventListener('pointerleave', () => hideTip(item, 100));
			item.addEventListener('focus', () => showTip(item));
			item.addEventListener('blur', () => hideTip(item));
			item.addEventListener('keydown', (event) => {
				if (event.key !== 'Escape') return;
				event.preventDefault();
				hideTip(item);
			});
			item.addEventListener('click', (event) => {
				if (item instanceof HTMLAnchorElement) return;
				const index = Number(item.dataset.navIndex);
				if (!primaryNavigationHost || !Number.isFinite(index)) return;
				primaryNavigationHost.style.setProperty('--workspace-nav-index', `${index}`);
				primaryNavigation.forEach((candidate) => candidate.removeAttribute('data-nav-selected'));
				item.dataset.navSelected = 'true';
				item.setAttribute('aria-pressed', 'true');
			});
		});
		document.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape' || !visibleTip) return;
			event.preventDefault();
			hideTip();
		});
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
		scrollTop.addEventListener('click', () => stage.scrollTo({ top: 0, behavior: 'auto' }));
		update();
		if (window.location.hash) {
			const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
			if (target) window.requestAnimationFrame(() => scrollToTarget(target));
		}
	});
};
