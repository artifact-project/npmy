import { execWithOutput } from './exec';

export async function gitHasChanges() {
	// Я думаю есть более элегантный способ, но чёт лень, буду индусом
	const {stdout} = await execWithOutput('git', ['status']);

	if (stdout.includes('nothing to commit, working tree clean')) {
		return false;
	}

	return (
		!stdout.includes('Your branch is up to date') ||
		stdout.includes('Changes not staged') ||
		stdout.includes('git push') ||
		stdout.includes('Untracked files') ||
		stdout.includes('Changes to be committed')
	);
}

export async function gitCurrentBranch() {
	const {stdout} = await execWithOutput('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
	return stdout.trim();
}

export async function gitPull() {
	const {stdout} = await execWithOutput('git', ['pull', 'origin', 'master']);
	return stdout.includes('Already up to date');
}

export async function gitFetchStatus() {
	let [branch, changes] = await Promise.all([
		gitCurrentBranch(),
		gitHasChanges(),
	]);

	if (!changes) {
		changes = !(await gitPull());
	}

	return {
		changes,
		branch,
	};
}

export async function gitStatus() {
	const {stdout} = await execWithOutput('git', ['status', '--short']);
	const entries = [] as Array<{type: string; file: string}>;
	const parser = /\s+([^\s]+)\s+(.+)/g;
	let matches = null;
	
	while (matches = parser.exec(stdout)) {
		entries.push({
			type: matches[1].trim(),
			file: matches[2].trim(),
		});
	}

	return entries;
}
