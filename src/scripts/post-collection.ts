export const initPostCollections = (scope: ParentNode = document) => {
	const collections = Array.from(scope.querySelectorAll<HTMLElement>('[data-post-collection]'));

	collections.forEach((collection) => {
		if (collection.dataset.postCollectionInitialized === 'true') return;
		collection.dataset.postCollectionInitialized = 'true';

		const entries = Array.from(collection.querySelectorAll<HTMLElement>('[data-post-href]'));
		const menus = Array.from(collection.querySelectorAll<HTMLElement>('[data-row-menu]'));
		const interactiveSelector = 'a, button, input, select, textarea, summary, [data-row-menu], [role="button"], [role="menuitem"], [contenteditable]';
		let openMenu: HTMLElement | undefined;

		const menuParts = (menu: HTMLElement) => ({
			trigger: menu.querySelector<HTMLButtonElement>('[data-row-menu-trigger]'),
			popup: menu.querySelector<HTMLElement>('[data-row-menu-popup]'),
		});
		const closeMenu = (menu = openMenu, restoreFocus = false) => {
			if (!menu) return;
			const { trigger, popup } = menuParts(menu);
			popup?.setAttribute('hidden', '');
			popup?.style.removeProperty('left');
			popup?.style.removeProperty('top');
			trigger?.setAttribute('aria-expanded', 'false');
			menu.removeAttribute('data-menu-open');
			if (openMenu === menu) openMenu = undefined;
			if (restoreFocus) trigger?.focus();
		};
		const positionMenu = (menu: HTMLElement) => {
			const { trigger, popup } = menuParts(menu);
			if (!trigger || !popup || popup.hidden) return;
			const viewportInset = 12;
			const gap = 6;
			const triggerRect = trigger.getBoundingClientRect();
			const popupRect = popup.getBoundingClientRect();
			const maxLeft = Math.max(viewportInset, window.innerWidth - popupRect.width - viewportInset);
			const left = Math.min(Math.max(triggerRect.right - popupRect.width, viewportInset), maxLeft);
			const below = triggerRect.bottom + gap;
			const above = triggerRect.top - popupRect.height - gap;
			const maxTop = Math.max(viewportInset, window.innerHeight - popupRect.height - viewportInset);
			const top = below + popupRect.height <= window.innerHeight - viewportInset ? below : Math.max(above, viewportInset);
			popup.style.left = `${left}px`;
			popup.style.top = `${Math.min(top, maxTop)}px`;
		};
		const showMenu = (menu: HTMLElement) => {
			if (openMenu && openMenu !== menu) closeMenu(openMenu);
			const { trigger, popup } = menuParts(menu);
			if (!trigger || !popup) return;
			popup.hidden = false;
			trigger.setAttribute('aria-expanded', 'true');
			menu.dataset.menuOpen = 'true';
			openMenu = menu;
			positionMenu(menu);
			popup.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
		};

		entries.forEach((entry) => {
			entry.addEventListener('click', (event) => {
				if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
				if (event.target instanceof Element && event.target.closest(interactiveSelector)) return;
				const href = entry.dataset.postHref;
				if (href) window.location.assign(href);
			});
		});

		menus.forEach((menu) => {
			const { trigger, popup } = menuParts(menu);
			if (!trigger || !popup) return;
			trigger.addEventListener('click', (event) => {
				event.stopPropagation();
				if (openMenu === menu) closeMenu(menu, true);
				else showMenu(menu);
			});
			popup.addEventListener('keydown', (event) => {
				const items = Array.from(popup.querySelectorAll<HTMLElement>('[role="menuitem"]'));
				const current = items.indexOf(document.activeElement as HTMLElement);
				if (event.key === 'Escape') {
					event.preventDefault();
					closeMenu(menu, true);
					return;
				}
				let next = current;
				if (event.key === 'ArrowDown') next = (current + 1) % items.length;
				else if (event.key === 'ArrowUp') next = (current - 1 + items.length) % items.length;
				else if (event.key === 'Home') next = 0;
				else if (event.key === 'End') next = items.length - 1;
				else return;
				event.preventDefault();
				items[next]?.focus();
			});
			popup.addEventListener('click', () => closeMenu(menu));
		});

		document.addEventListener('pointerdown', (event) => {
			if (openMenu && event.target instanceof Node && !openMenu.contains(event.target)) closeMenu(openMenu);
		});
		document.addEventListener('keydown', (event) => {
			if (event.key === 'Escape' && openMenu) closeMenu(openMenu, true);
		});
		window.addEventListener('resize', () => { if (openMenu) positionMenu(openMenu); }, { passive: true });
		collection.closest<HTMLElement>('[data-workspace-stage]')?.addEventListener('scroll', () => {
			if (openMenu) closeMenu(openMenu);
		}, { passive: true });
	});
};
