const interactiveSelector = [
	'a',
	'button',
	'input',
	'textarea',
	'select',
	'summary',
	'label',
	'[role="button"]',
	'[role="link"]',
	'[contenteditable="true"]',
	'[tabindex]:not([tabindex="-1"])',
].join(',');

const cursorPositionKey = 'evigila:cursor-position';

export const initSiteCursor = () => {
	const root = document.documentElement;
	const cursor = document.querySelector<HTMLElement>('[data-site-cursor]');
	if (!cursor || root.dataset.cursorInitialized === 'true') return;

	root.dataset.cursorInitialized = 'true';
	const canUseCustomCursor = window.matchMedia(
		'(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) and (forced-colors: none)',
	);
	let frame = 0;
	let x = -32;
	let y = -32;
	let visible = false;
	let interactive = false;
	let pressed = false;
	let renderedVisible = false;
	let renderedInteractive = false;
	let renderedPressed = false;
	let lastPointerTarget: EventTarget | null = null;

	const updateInteractiveTarget = (target: EventTarget | null) => {
		lastPointerTarget = target;
		const interactiveTarget = target instanceof Element ? target.closest(interactiveSelector) : null;
		const disabled = interactiveTarget?.matches('[disabled], [aria-disabled="true"]') ?? false;
		interactive = Boolean(interactiveTarget && !disabled);
	};
	const adoptPointerPosition = (clientX: number, clientY: number, target: EventTarget | null) => {
		x = clientX;
		y = clientY;
		visible = true;
		if (target !== lastPointerTarget) updateInteractiveTarget(target);
	};
	const savePosition = () => {
		if (!visible || x < 0 || y < 0) return;
		try {
			sessionStorage.setItem(cursorPositionKey, JSON.stringify({ x, y, savedAt: Date.now() }));
		} catch {
			// Cursor persistence is only an enhancement; storage can be unavailable.
		}
	};
	const restorePosition = () => {
		if (!canUseCustomCursor.matches) return;
		try {
			const stored = sessionStorage.getItem(cursorPositionKey);
			if (!stored) return;
			const position = JSON.parse(stored) as { x?: number; y?: number; savedAt?: number };
			if (
				typeof position.x !== 'number'
				|| typeof position.y !== 'number'
				|| typeof position.savedAt !== 'number'
				|| Date.now() - position.savedAt > 30_000
				|| position.x < 0
				|| position.y < 0
				|| position.x > window.innerWidth
				|| position.y > window.innerHeight
			) return;

			adoptPointerPosition(position.x, position.y, document.elementFromPoint(position.x, position.y));
			render();
		} catch {
			// Ignore malformed or unavailable session storage.
		}
	};

	const render = () => {
		frame = 0;
		cursor.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
		const useReplacementCursor = canUseCustomCursor.matches && visible;
		const replacementState = String(useReplacementCursor);
		if (root.dataset.customCursor !== replacementState) root.dataset.customCursor = replacementState;
		if (renderedVisible !== visible) {
			cursor.dataset.visible = String(visible);
			renderedVisible = visible;
		}
		if (renderedInteractive !== interactive) {
			cursor.dataset.interactive = String(interactive);
			renderedInteractive = interactive;
		}
		if (renderedPressed !== pressed) {
			cursor.dataset.pressed = String(pressed);
			renderedPressed = pressed;
		}
	};
	const queueRender = () => {
		if (!frame) frame = window.requestAnimationFrame(render);
	};
	const hide = () => {
		if (
			!visible && !interactive && !pressed
			&& !renderedVisible && !renderedInteractive && !renderedPressed
		) return;
		visible = false;
		interactive = false;
		pressed = false;
		lastPointerTarget = null;
		queueRender();
	};

	const updateSupport = () => {
		const enabled = canUseCustomCursor.matches;
		if (!enabled) {
			if (root.dataset.customCursor !== 'false') root.dataset.customCursor = 'false';
			hide();
		} else if (!visible && root.dataset.customCursor !== 'false') {
			// Keep the native pointer until the dot has a real mouse position and
			// can be painted in the same animation frame.
			root.dataset.customCursor = 'false';
		}
	};

	document.addEventListener(
		'pointermove',
		(event) => {
			if (!canUseCustomCursor.matches || event.pointerType !== 'mouse') {
				hide();
				return;
			}

			if (event.target instanceof HTMLIFrameElement) {
				hide();
				return;
			}

			adoptPointerPosition(event.clientX, event.clientY, event.target);

			queueRender();
		},
		{ passive: true },
	);

	document.addEventListener('pointerdown', (event) => {
		if (!canUseCustomCursor.matches || pressed) return;
		if (event.pointerType === 'mouse') {
			adoptPointerPosition(event.clientX, event.clientY, event.target);
			savePosition();
		}
		pressed = true;
		queueRender();
	});
	document.addEventListener('wheel', (event) => {
		if (!canUseCustomCursor.matches) return;
		const target = document.elementFromPoint(event.clientX, event.clientY) ?? event.target;
		adoptPointerPosition(event.clientX, event.clientY, target);
		queueRender();
	}, { passive: true, capture: true });
	document.addEventListener('pointerup', () => {
		if (!pressed) return;
		pressed = false;
		queueRender();
	});
	document.addEventListener('pointercancel', hide);
	document.addEventListener('pointerout', (event) => {
		if (!event.relatedTarget) hide();
	});
	document.addEventListener('keydown', (event) => {
		if (event.key === 'Tab') hide();
	});
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') hide();
	});
	window.addEventListener('blur', hide);
	window.addEventListener('pagehide', () => {
		savePosition();
		hide();
	});
	window.addEventListener('pageshow', restorePosition);
	canUseCustomCursor.addEventListener('change', updateSupport);
	updateSupport();
	restorePosition();
};
