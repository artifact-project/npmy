import {join} from 'path';
import {satisfies} from 'semver';
import {exec, symlink, createSpinner, checkNodeModulesPath} from '../utils/utils';
import {PackageJSON, getPackageJSON} from '../PackageJSON/PackageJSON';

export interface INPMyrc {
	[name: string]: Package;
}

export default class Package {
	json: PackageJSON;
	private installer;

	constructor(public path: string, public npmy: INPMyrc) {
		this.json = getPackageJSON(path);
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
			.entries(this.json.allDependencies)
			.forEach(([name, version]) => {
				if (this.npmy[name]) {
					symLinks.push(this.npmy[name]);
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
		console.time(` [${this.name}] ${label}`);
	}

	protected timeEnd(label) {
		console.timeEnd(` [${this.name}] ${label}`);
	}
}
