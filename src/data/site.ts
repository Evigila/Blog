export const normalizePath = (path: string) => path === '/' ? path : path.replace(/\/+$/, '');

export const siteConfig = {
	title: 'Evigila 的博客',
	description: '记录 .NET、C#、桌面应用与 Web 开发实践。',
		author: {
		name: 'Evigila',
		avatar: '/avatar.jpg',
		bio: '.NET Desktop application developer',
	},
	socials: [
		{ href: 'https://github.com/Evigila', icon: 'github' },
		{ href: 'mailto:evigila.shangyi@gmail.com', icon: 'mail' },
	],
} as const;
