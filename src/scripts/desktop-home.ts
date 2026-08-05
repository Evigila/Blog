type HomePanel = 'home' | 'posts' | 'about';
type WindowMode = 'normal' | 'maximized';
type WindowVisibility = 'open' | 'minimized' | 'closed';
type PostLayout = 'grid' | 'list';

interface WindowBounds {
	left: number;
	top: number;
	width: number;
	height: number;
}

interface DragSession {
	pointerId: number;
	startX: number;
	startY: number;
	startBounds?: WindowBounds;
	wasMaximized: boolean;
	restoreRatio: number;
	moved: boolean;
}

const PANEL_META: Record<HomePanel, { title: string; address: string; status: string }> = {
	home: { title: '主页 · Evigila', address: 'Desktop / Evigila / Home', status: '欢迎回来' },
	posts: { title: '博客文章 · Evigila', address: 'Desktop / Evigila / Library', status: '文章库已就绪' },
	about: { title: '关于 · Evigila', address: 'Desktop / Evigila / About', status: '本地用户配置' },
};

const isPanel = (value: string | undefined): value is HomePanel =>
	value === 'home' || value === 'posts' || value === 'about';

const clamp = (value: number, minimum: number, maximum: number) =>
	Math.min(Math.max(value, minimum), Math.max(minimum, maximum));

export const initDesktopHome = () => {
	const root = document.querySelector<HTMLElement>('[data-desktop-home]');
	const desktopQuery = window.matchMedia('(min-width: 1121px) and (hover: hover) and (pointer: fine)');
	if (!root || !desktopQuery.matches || root.dataset.desktopHomeInitialized === 'true') return;

	const desktopWindow = root.querySelector<HTMLElement>('[data-window]');
	const dragHandle = root.querySelector<HTMLElement>('[data-window-handle]');
	if (!desktopWindow || !dragHandle) return;

	root.dataset.desktopHomeInitialized = 'true';
	const controller = new AbortController();
	const listenerOptions = { signal: controller.signal };
	const panels = Array.from(root.querySelectorAll<HTMLElement>('[data-home-panel]'));
	const openButtons = Array.from(root.querySelectorAll<HTMLElement>('[data-open-panel]'));
	const taskbarButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-taskbar-panel]'));
	const windowActions = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-window-action]'));
	const postLayoutPanel = root.querySelector<HTMLElement>('[data-post-layout]');
	const postLayoutButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-post-layout-option]'));
	const title = root.querySelector<HTMLElement>('[data-window-title]');
	const address = root.querySelector<HTMLElement>('[data-address-label]');
	const status = root.querySelector<HTMLElement>('[data-status-label]');
	const maximizeButton = root.querySelector<HTMLButtonElement>('[data-window-action="maximize"]');
	const maximizeIcon = root.querySelector<HTMLElement>('[data-maximize-icon]');
	const taskbar = root.querySelector<HTMLElement>('.taskbar');

	let activePanel: HomePanel = 'home';
	let windowMode: WindowMode = 'normal';
	let windowVisibility: WindowVisibility = 'open';
	let normalBounds: WindowBounds | undefined;
	let dragSession: DragSession | undefined;

	const workspaceSize = () => ({
		width: root.clientWidth,
		height: Math.max(0, root.clientHeight - (taskbar?.offsetHeight ?? 48)),
	});

	const currentBounds = (): WindowBounds => {
		const rect = desktopWindow.getBoundingClientRect();
		const rootRect = root.getBoundingClientRect();
		return {
			left: rect.left - rootRect.left,
			top: rect.top - rootRect.top,
			width: rect.width,
			height: rect.height,
		};
	};

	const constrainedBounds = (bounds: WindowBounds): WindowBounds => {
		const workspace = workspaceSize();
		const width = Math.min(bounds.width, workspace.width);
		const height = Math.min(bounds.height, workspace.height);
		return {
			left: clamp(bounds.left, 0, workspace.width - width),
			top: clamp(bounds.top, 0, workspace.height - height),
			width,
			height,
		};
	};

	const applyNormalBounds = (bounds: WindowBounds) => {
		normalBounds = constrainedBounds(bounds);
		desktopWindow.style.left = `${normalBounds.left}px`;
		desktopWindow.style.top = `${normalBounds.top}px`;
		desktopWindow.style.width = `${normalBounds.width}px`;
		desktopWindow.style.height = `${normalBounds.height}px`;
		desktopWindow.style.right = 'auto';
		desktopWindow.style.bottom = 'auto';
	};

	const announce = (message: string) => {
		if (status) status.textContent = message;
	};

	const syncWindowChrome = () => {
		root.dataset.windowMode = windowMode;
		root.dataset.windowVisibility = windowVisibility;
		const isOpen = windowVisibility === 'open';
		desktopWindow.setAttribute('aria-hidden', String(!isOpen));
		desktopWindow.inert = !isOpen;
		if (maximizeButton) {
			const isMaximized = windowMode === 'maximized';
			maximizeButton.setAttribute('aria-label', isMaximized ? '还原窗口' : '最大化窗口');
			maximizeButton.title = isMaximized ? '还原' : '最大化';
		}
		if (maximizeIcon) maximizeIcon.textContent = windowMode === 'maximized' ? '❐' : '□';

		taskbarButtons.forEach((button) => {
			const panel = button.dataset.taskbarPanel;
			const current = panel === activePanel;
			const running = current && windowVisibility !== 'closed';
			const foreground = current && isOpen;
			button.classList.toggle('is-running', running);
			button.classList.toggle('is-active', foreground);
			button.classList.toggle('is-minimized', current && windowVisibility === 'minimized');
			button.setAttribute('aria-pressed', String(current));
			button.setAttribute('aria-expanded', String(foreground));
		});
	};

	const setPanel = (panel: HomePanel) => {
		activePanel = panel;
		root.dataset.activePanel = panel;
		panels.forEach((item) => {
			const active = item.dataset.homePanel === panel;
			item.hidden = !active;
			item.classList.toggle('is-active', active);
		});
		openButtons.forEach((item) => {
			const active = item.dataset.openPanel === panel;
			item.classList.toggle('is-active', active);
			if (item instanceof HTMLButtonElement) item.setAttribute('aria-pressed', String(active));
		});
		if (title) title.textContent = PANEL_META[panel].title;
		if (address) address.textContent = PANEL_META[panel].address;
		announce(PANEL_META[panel].status);
		window.history.replaceState(null, '', panel === 'home' ? '/' : `/?view=${panel}`);
		syncWindowChrome();
	};

	const focusWindow = () => {
		window.requestAnimationFrame(() => desktopWindow.focus({ preventScroll: true }));
	};

	const openWindow = (panel = activePanel) => {
		setPanel(panel);
		windowVisibility = 'open';
		syncWindowChrome();
		announce(windowMode === 'maximized' ? '窗口已恢复为最大化' : '窗口已还原');
		focusWindow();
	};

	const minimizeWindow = (focusTarget?: HTMLElement) => {
		if (windowVisibility !== 'open') return;
		if (windowMode === 'normal') normalBounds = currentBounds();
		windowVisibility = 'minimized';
		syncWindowChrome();
		announce('窗口已最小化');
		window.requestAnimationFrame(() => focusTarget?.focus({ preventScroll: true }));
	};

	const closeWindow = (focusTarget?: HTMLElement) => {
		if (windowMode === 'normal' && windowVisibility === 'open') normalBounds = currentBounds();
		windowVisibility = 'closed';
		windowMode = 'normal';
		syncWindowChrome();
		announce('窗口已关闭；可从任务栏重新打开');
		window.requestAnimationFrame(() => focusTarget?.focus({ preventScroll: true }));
	};

	const maximizeWindow = () => {
		if (windowVisibility !== 'open') windowVisibility = 'open';
		if (windowMode === 'normal') normalBounds = currentBounds();
		windowMode = 'maximized';
		syncWindowChrome();
		announce('窗口已最大化');
		focusWindow();
	};

	const restoreWindow = (bounds = normalBounds) => {
		windowMode = 'normal';
		windowVisibility = 'open';
		syncWindowChrome();
		if (bounds) applyNormalBounds(bounds);
		announce('窗口已还原');
		focusWindow();
	};

	const toggleMaximize = () => {
		if (windowMode === 'maximized') restoreWindow();
		else maximizeWindow();
	};

	const setPostLayout = (layout: PostLayout, shouldAnnounce = true) => {
		if (!postLayoutPanel) return;
		postLayoutPanel.dataset.postLayout = layout;
		postLayoutButtons.forEach((button) => {
			const active = button.dataset.postLayoutOption === layout;
			button.classList.toggle('is-active', active);
			button.setAttribute('aria-pressed', String(active));
		});
		if (shouldAnnounce) announce(layout === 'grid' ? '已切换为双列视图' : '已切换为单列视图');
	};

	openButtons.forEach((button) => {
		button.addEventListener('click', () => {
			const panel = button.dataset.openPanel;
			if (isPanel(panel)) openWindow(panel);
		}, listenerOptions);
	});

	taskbarButtons.forEach((button) => {
		button.addEventListener('click', () => {
			const panel = button.dataset.taskbarPanel;
			if (!isPanel(panel)) return;
			if (panel === activePanel && windowVisibility === 'open') {
				minimizeWindow(button);
				return;
			}
			openWindow(panel);
		}, listenerOptions);
	});

	windowActions.forEach((button) => {
		button.addEventListener('click', () => {
			const action = button.dataset.windowAction;
			const activeTaskbarButton = taskbarButtons.find((item) => item.dataset.taskbarPanel === activePanel);
			if (action === 'minimize') minimizeWindow(activeTaskbarButton);
			else if (action === 'maximize') toggleMaximize();
			else if (action === 'close') closeWindow(activeTaskbarButton);
		}, listenerOptions);
	});

	postLayoutButtons.forEach((button) => {
		button.addEventListener('click', () => {
			const layout = button.dataset.postLayoutOption;
			if (layout === 'grid' || layout === 'list') setPostLayout(layout);
		}, listenerOptions);
	});

	const releaseDrag = (pointerId?: number) => {
		if (pointerId !== undefined && dragHandle.hasPointerCapture(pointerId)) dragHandle.releasePointerCapture(pointerId);
		dragSession = undefined;
		root.classList.remove('is-window-dragging');
	};

	dragHandle.addEventListener('pointerdown', (event) => {
		if (event.button !== 0 || windowVisibility !== 'open' || (event.target as Element).closest('[data-window-action]')) return;
		const bounds = currentBounds();
		dragSession = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			startBounds: windowMode === 'normal' ? bounds : undefined,
			wasMaximized: windowMode === 'maximized',
			restoreRatio: clamp((event.clientX - bounds.left) / Math.max(1, bounds.width), 0.12, 0.88),
			moved: false,
		};
		dragHandle.setPointerCapture(event.pointerId);
	}, listenerOptions);

	dragHandle.addEventListener('pointermove', (event) => {
		if (!dragSession || event.pointerId !== dragSession.pointerId) return;
		const totalX = event.clientX - dragSession.startX;
		const totalY = event.clientY - dragSession.startY;
		if (!dragSession.moved && Math.hypot(totalX, totalY) < 4) return;

		if (dragSession.wasMaximized) {
			root.classList.add('is-window-dragging');
			const restored = constrainedBounds(normalBounds ?? {
				left: root.clientWidth * 0.1,
				top: 30,
				width: root.clientWidth * 0.8,
				height: Math.max(360, workspaceSize().height * 0.82),
			});
			windowMode = 'normal';
			syncWindowChrome();
			applyNormalBounds({
				...restored,
				left: event.clientX - restored.width * dragSession.restoreRatio,
				top: Math.max(0, event.clientY - 15),
			});
			dragSession.startBounds = normalBounds ? { ...normalBounds } : restored;
			dragSession.startX = event.clientX;
			dragSession.startY = event.clientY;
			dragSession.wasMaximized = false;
		}

		if (!dragSession.startBounds) return;
		dragSession.moved = true;
		root.classList.add('is-window-dragging');
		applyNormalBounds({
			...dragSession.startBounds,
			left: dragSession.startBounds.left + (event.clientX - dragSession.startX),
			top: dragSession.startBounds.top + (event.clientY - dragSession.startY),
		});
	}, listenerOptions);

	const finishDrag = (event: PointerEvent) => {
		if (!dragSession || event.pointerId !== dragSession.pointerId) return;
		const shouldSnapTop = dragSession.moved && currentBounds().top <= 1;
		releaseDrag(event.pointerId);
		if (shouldSnapTop) maximizeWindow();
	};

	dragHandle.addEventListener('pointerup', finishDrag, listenerOptions);
	dragHandle.addEventListener('pointercancel', (event) => {
		if (dragSession?.pointerId === event.pointerId) releaseDrag(event.pointerId);
	}, listenerOptions);
	dragHandle.addEventListener('lostpointercapture', () => releaseDrag(), listenerOptions);
	dragHandle.addEventListener('dblclick', (event) => {
		if ((event.target as Element).closest('[data-window-action]')) return;
		releaseDrag();
		toggleMaximize();
	}, listenerOptions);

	window.addEventListener('resize', () => {
		if (windowMode === 'normal' && normalBounds) applyNormalBounds(normalBounds);
	}, { ...listenerOptions, passive: true });

	const updateClock = () => {
		const now = new Date();
		const time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
		const shortDate = now.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
		const longDate = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
		root.querySelectorAll<HTMLElement>('[data-taskbar-time], [data-gadget-time]').forEach((item) => { item.textContent = time; });
		root.querySelectorAll<HTMLElement>('[data-taskbar-date]').forEach((item) => { item.textContent = shortDate; });
		root.querySelectorAll<HTMLElement>('[data-gadget-date]').forEach((item) => { item.textContent = longDate; });
	};

	const requestedPanel = new URLSearchParams(window.location.search).get('view');
	setPanel(isPanel(requestedPanel ?? undefined) ? requestedPanel : 'home');
	setPostLayout('grid', false);
	root.dataset.windowMode = windowMode;
	root.dataset.windowVisibility = windowVisibility;
	updateClock();
	const clockTimer = window.setInterval(updateClock, 30_000);
	window.requestAnimationFrame(() => applyNormalBounds(currentBounds()));
	window.addEventListener('beforeunload', () => {
		controller.abort();
		window.clearInterval(clockTimer);
	}, { once: true });
};
