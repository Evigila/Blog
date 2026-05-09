import { execSync } from 'node:child_process';
import { statSync } from 'node:fs';

export function remarkModifiedTime() {
	return (_tree: any, vfile: any) => {
		const filepath = (vfile.history as string[] | undefined)?.[0];
		let updatedAt: string;

		if (filepath) {
			try {
				// Normalize to forward slashes for git on Windows
				const gitPath = filepath.replace(/\\/g, '/');
				const gitTime = execSync(`git log -1 --pretty=format:%cI -- "${gitPath}"`, {
					encoding: 'utf-8',
					stdio: ['pipe', 'pipe', 'pipe'],
				}).trim();
				// Fallback to file mtime if file has not been committed yet
				updatedAt = gitTime || statSync(filepath).mtime.toISOString();
			} catch {
				try {
					updatedAt = statSync(filepath).mtime.toISOString();
				} catch {
					updatedAt = new Date().toISOString();
				}
			}
		} else {
			updatedAt = new Date().toISOString();
		}

		const data = vfile.data as Record<string, any>;
		data.astro ??= {};
		data.astro.frontmatter ??= {};
		data.astro.frontmatter.updatedAt = updatedAt;
	};
}
