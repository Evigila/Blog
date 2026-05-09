export const siteConfig = {
	name: 'Evigila',
	title: 'Evigila的个人博客',
	description: '极简静态博客，由 Astro 提供驱动。',
	author: {
		name: 'Evigila',
		avatar: '/avatar.jpg',
		bio: 'Ciallo ～(∠・ω< )⌒★! Have a nice day.',
		signature: '.NET | C# | Windows',
	},
	stageSeed: '3141592653589793238462643383279',
	navigation: [
		{ label: '首页', href: '/' },
		{ label: '文章', href: '/#posts' },
		{ label: '友链', href: '/friend' },
		{ label: '联系', href: '/contact' },
	],
	socials: [
		{ label: 'GitHub', href: 'https://github.com/Evigila', icon: 'github' },
		{ label: '邮箱', href: 'mailto:evigila.shangyi@gmail.com', icon: 'mail' },
	],
} as const;