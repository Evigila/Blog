import { initPostCollections } from './post-collection';

type HomeGreeting = {
	period: 'morning' | 'afternoon' | 'evening' | 'late-night';
	first: string;
	second: string;
};

export const getHomeGreeting = (hour: number): HomeGreeting => {
	if (hour >= 23 || hour < 5) return { period: 'late-night', first: '夜已深。', second: '请早早进行休息。' };
	if (hour < 12) return { period: 'morning', first: '欢迎，早上好。', second: '祝你有美好的一天' };
	if (hour < 18) return { period: 'afternoon', first: '欢迎，下午好。', second: '来一杯下午茶休息一下' };
	return { period: 'evening', first: '欢迎，晚上好。', second: '结束了一天的疲惫准备好好休息吧。' };
};

export const initEditorialHome = () => {
	const root = document.querySelector<HTMLElement>('[data-editorial-home]');
	if (!root || root.dataset.editorialInitialized === 'true') return;
	root.dataset.editorialInitialized = 'true';
	initPostCollections(root);

	const greetingFirst = root.querySelector<HTMLElement>('[data-greeting-line="first"]');
	const greetingSecond = root.querySelector<HTMLElement>('[data-greeting-line="second"]');
	const syncGreeting = () => {
		const greeting = getHomeGreeting(new Date().getHours());
		if (greetingFirst) greetingFirst.textContent = greeting.first;
		if (greetingSecond) greetingSecond.textContent = greeting.second;
		root.dataset.greetingPeriod = greeting.period;
	};

	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') syncGreeting();
	});
	window.addEventListener('pageshow', syncGreeting);
	syncGreeting();
};
