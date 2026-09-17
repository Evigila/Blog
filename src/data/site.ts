export const siteNavigation = [
	{ key: 'home', label: 'HOME', postLabel: 'Home', href: '/', section: '/', showInFooter: true, showInPostInspector: true },
	{ key: 'articles', label: 'ARTICLES', postLabel: 'Articles', href: '/articles', section: '/articles', showInFooter: true, showInPostInspector: true },
	{ key: 'tags', label: 'TAGS', postLabel: 'Tags', href: '/tags', section: '/tags', showInFooter: true, showInPostInspector: true },
	{ key: 'links', label: 'LINKS', postLabel: 'Links', href: '/friend', section: '/friend', showInFooter: true, showInPostInspector: true },
	{ key: 'about', label: 'ABOUT', postLabel: 'About', href: '/#about', section: undefined, showInFooter: false, showInPostInspector: false },
] as const;

export const normalizePath = (path: string) => path === '/' ? path : path.replace(/\/+$/, '');

export const isNavigationCurrent = (section: string | undefined, path: string) => {
	if (!section) return false;
	const pathname = normalizePath(path);
	if (section === '/') return pathname === '/';
	return pathname === section || pathname.startsWith(`${section}/`);
};

export const siteConfig = {
	title: 'Evigila 的博客',
	description: '记录 .NET、C#、桌面应用与 Web 开发实践。',
	author: {
		name: 'Evigila',
		avatar: '/avatar.jpg',
		bio: '.NET Desktop application developer',
		signature: '.NET | C#',
	},
	socials: [
		{ label: 'GitHub', href: 'https://github.com/Evigila', icon: 'github' },
		{ label: '邮件', href: 'mailto:evigila.shangyi@gmail.com', icon: 'mail' },
	],
} as const;
