import {join, sep} from 'path';
import * as fs from 'fs';
import * as globModule from 'glob';
import * as rimraf from 'rimraf';
import * as childProcess from 'child_process';
import {Spinner} from 'cli-spinner';

export const exec = promisify<null>(childProcess.exec);
export const glob = promisify<string[]>(globModule);
export const mkdir = promisify<null>(fs.mkdir);
export const symlink = promisify<null>(fs.symlink);
export const existsSync = fs.existsSync;
export const rmdir = promisify<null>(rimraf);
export const readFile = promisify<Buffer>(fs.readFile);
export const readFileSync = fs.readFileSync;
export const writeFileSync = fs.writeFileSync;
export const rmdirSync = fs.rmdirSync;
export const unlinkSync = fs.unlinkSync;
export const writeFile = promisify<null>(fs.writeFile);

export function promisify<T>(fn, context = null): (...args) => Promise<T> {
	return async function promisifyWrapper(...args): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			fn.call(context, ...[...args, (err, ...results) => {
				err
					? reject(err)
					: resolve(results.length ? results[0] : results)
				;
			}]);
		});
	};
}

export function createSpinner(text, autoStart: boolean = false) {
	const spinner = new Spinner(text);

	spinner.setSpinnerString(18);
	autoStart && spinner.start();

	return spinner;
}

export async function checkNodeModulesPath(path) {
	if (!existsSync(path)) {
		const [rootPath, relativePath] = path.split('node_modules');
		const segments = relativePath.split(sep);

		for (let i = 0; i < segments.length; i++) {
			const checkPath = join(rootPath, 'node_modules', ...segments.slice(0, i));

			if (!existsSync(checkPath)) {
				await mkdir(checkPath);
			}
		}
	}
}
