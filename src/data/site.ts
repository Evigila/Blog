export const siteConfig = {
	name: 'Evigila',
	title: "Evigila's Blog",
	description: 'A minimal static blog powered by Astro.',
	author: {
		name: 'Evigila',
		avatar: '/avatar.jpg',
		bio: '.NET Desktop application developer',
		signature: '.NET | C#',
	},
	stageSeed: '3141592653589793238462643383279',
	navigation: [
		{ label: 'Home', href: '/' },
		{ label: 'Blogs', href: '/?view=posts' },
		{ label: 'Links', href: '/friend' },
		{ label: 'Main Site', href: '#' },
	],
	socials: [
		{ label: 'GitHub', href: 'https://github.com/Evigila', icon: 'github' },
		{ label: 'Email', href: 'mailto:evigila.shangyi@gmail.com', icon: 'mail' },
	],
} as const;
