import {join} from 'path';
import {satisfies} from 'semver';
import {exec, symlink, createSpinner, checkNodeModulesPath} from '../utils/utils';

export interface INPMyrc {
	[name: string]: Package;
}

export interface PackageJSON {
	name: string;
	version: string;
	scripts: object;
	dependencies: object;
	devDependencies: object;
	peerDependencies: object;
	files: string[];
}

export default class Package {
	json: PackageJSON;
	installer;

	constructor(public path: string, public nmpy: INPMyrc) {
		this.json = require(join(path, 'package.json'));
	}

	get name(): string {
		return this.json.name;
	}

	hasHook(name) {
		return this.json.scripts.hasOwnProperty(name);
	}

	async execHook(name) {
		if (this.hasHook(name)) {
			this.time(`execHook(${name})`);

			await exec(
				`npm run ${name}`,
				{cwd: this.getPathToPublished()},
			);

			this.timeEnd(`execHook(${name})`);
		}
	}

	async install() {
		this.installer = this.installer || this.runInstall();
		await this.installer;
	}

	protected async runInstall() {
		const symLinks: Package[] = [];
		const toInstall: ({name: string, version: string})[] = [];

		this.time('install');

		Object
			.entries({
				...(this.json.dependencies || {}),
				...(this.json.devDependencies || {}),
			})
			.forEach(([name, version]) => {
				if (this.nmpy[name]) {
					symLinks.push(this.nmpy[name]);
				} else {
					toInstall.push({
						name,
						version: <string>version,
					});
				}
			})
		;

		if (toInstall.length) {
			let spinner = createSpinner(` [${this.name}] Checking dependencies %s`, true);

			const deps = toInstall
				.filter(({name, version}) => {
					try {
						const pkg = require(join(this.path, 'node_modules', name, 'package.json'));
						return !satisfies(pkg.version, version);
					} catch (err) {
						return true;
					}
				})
				.map(({name, version}) => `${name}@"${version}"`)
			;

			spinner.stop(true);

			if (deps.length) {
				spinner = createSpinner(` [${this.name}] npm install ${deps.join(' ')} %s`, true);

				await exec(
					`npm i ${deps.join(' ')}`,
					{cwd: this.path},
				);

				spinner.stop(true);
			}
		}

		if (symLinks.length) {
			await Promise.all(symLinks.map(async (pkg) => {
				const path = join(this.path, 'node_modules', pkg.name);

				await pkg.install();
				await checkNodeModulesPath(path);
				await exec(`rm -rf ${path}`);
				await symlink(pkg.getPathToPublished(), path);
			}));
		}

		this.timeEnd('install');
	}

	protected getPathToPublished(): string {
		throw new Error(` ${this.name}#getPathToPublished() Must be implemented`);
	}

	protected log(...args) {
		console.log(` [${this.name}]`, ...args);
	}

	protected time(label) {
		console.time(` [${this.name}] <time> ${label}`);
	}

	protected timeEnd(label) {
		console.timeEnd(` [${this.name}] <time> ${label}`);
	}
}