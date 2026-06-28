export const siteConfig = {
	name: 'Evigila',
	title: "Evigila的个人博客网站",
	description: '极简静态博客，由 Astro 提供驱动',
	author: {
		name: 'Evigila',
		avatar: '/avatar.jpg',
		bio: '.NET Desktop application developer',
		signature: '.NET | C#',
	},
	stageSeed: '3141592653589793238462643383279',
	navigation: [
		{ label: '主页', href: '/' },
		{ label: '博客', href: '/?view=posts' },
		{ label: '链接', href: '/friend' },
		{ label: '主站', href: '#' },
	],
	socials: [
		{ label: 'GitHub', href: 'https://github.com/Evigila', icon: 'github' },
		{ label: '邮件', href: 'mailto:evigila.shangyi@gmail.com', icon: 'mail' },
	],
} as const;
