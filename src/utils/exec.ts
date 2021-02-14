import { spawn, SpawnOptions } from 'child_process';

export function exec(cmd: string, args: string[], options: SpawnOptions = {}) {
	let _resolve = () => void 0;
	const promise = new Promise<void>((resolve) => {
		_resolve = resolve;
	});
	const child = spawn(cmd, args, {
		stdio: 'inherit',
		cwd: process.cwd(),
		env: process.env,
		...options,
	});

	child.on('close', () => _resolve());

	return Object.assign(child, {promise});
}

export async function execWithOutput(cmd: string, args: string[], options: SpawnOptions = {}) {
	const child = exec(cmd, args, {
		...options,
		stdio: undefined,
	});

	let stdout = '';
	let stderr = '';

	child.stdout?.on('data', (chunk) => {
		stdout += chunk;
	});

	child.stderr?.on('data', (chunk) => {
		stderr += chunk;
	});

	await child.promise;

	return {
		stdout,
		stderr,
	};
}
