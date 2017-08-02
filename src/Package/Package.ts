import {join} from 'path';
import {satisfies} from 'semver';
import {exec, symlink, createSpinner, checkNodeModulesPath, rmdir} from '../utils/utils';
import {PackageJSON, getPackageJSON} from '../PackageJSON/PackageJSON';
import {symlinkSync, unlinkSync} from 'fs';

export interface INPMyrc {
	[name: string]: Package;
}

let SPINNER;

export default class Package {
	json: PackageJSON;

	private installer;
	private verboseTime: boolean = !!process.env.VERBOSE_TIME;

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

			try {
				await exec(
					`npm run ${name}`,
					{cwd: this.getPathToPublished()},
				);
			} catch (err) {
			}

			this.timeEnd(`execHook(${name})`);
		}
	}

	async install(createBinScripts: boolean) {
		this.installer = this.installer || this.runInstall(createBinScripts);
		await this.installer;
	}

	private async createBinScripts(json: PackageJSON) {
		const exists = {};
		const binRoot = join(this.path, 'node_modules', '.bin');
		const createBin = (name, pkgPath, bin = {}) => {
			if (typeof bin === 'string') {
				bin = {[name]: bin};
			}

			const binCommands = Object.keys(bin);

			if (!binCommands.length) return;

			this.log(`${name} /.bin/: ${binCommands.map((name) => `[${name} -> ${bin[name]}]`).join(', ')}`);

			binCommands.forEach((name) => {
				const binFilename = bin[name];
				const filename = join(binRoot, name);

				try { unlinkSync(filename); } catch (err) {}

				try {
					symlinkSync(join(pkgPath, binFilename as string), filename);
				} catch (err) {
					this.log(`[failed] createBin: ${name} -> ${binFilename}`);
					console.error(err);
				}
			});
		};
		const scanNext = (deps = {}) => {
			Object.keys(deps).forEach((name) => {
				if (exists[name]) return;
				exists[name] = true;

				const pkgPath = join(this.path, 'node_modules', name);
				const pkgJson = getPackageJSON(pkgPath);

				if (pkgJson !== null) { // todo: Надо бы разобраться
					createBin(pkgJson.name, pkgPath, pkgJson.bin);
					scanNext(pkgJson.dependencies);
				}
			});
		};

		await checkNodeModulesPath(binRoot);

		createBin(join(this.path, 'node_modules', json.name), json.bin);
		scanNext(json.dependencies);
	}

	protected async runInstall(createBinScripts: boolean) {
		const symLinks: Package[] = [];
		const toInstall: ({name: string, version: string})[] = [];
		const existsDeps = {};

		this.time('install');

		(function collect(deps:{[name:string]: string} = {}, npmy) {
			Object.keys(deps).forEach((name) => {
				if (existsDeps[name]) return;

				const version = deps[name];

				existsDeps[name] = true;

				if (npmy[name]) {
					const pkg = npmy[name];

					symLinks.push(pkg);
					collect.call(this, pkg.json.dependencies, pkg.npmy);
				} else {
					toInstall.push({
						name,
						version,
					});
				}
			});
		}).call(this, this.json.allDependencies, this.npmy);

		if (toInstall.length) {
			SPINNER = createSpinner(` %s [${this.name}] Checking dependencies`, true);

			const deps = toInstall
				.filter(({name, version}) => {
					try {
						const pkg = getPackageJSON(join(this.path, 'node_modules', name));
						return !satisfies(pkg.version, version);
					} catch (err) {
						return true;
					}
				})
				.map(({name, version}) => `${name}@"${version}"`)
			;

			SPINNER.stop(true);

			if (deps.length) {
				this.log(`npm install ${deps.join(' ')}`);

				SPINNER = createSpinner(` [${this.name}] Installing... %s`, true);

				await exec(
					`npm i ${deps.join(' ')}`,
					{cwd: this.path},
				);

				SPINNER.stop(true);
			}
		}

		if (symLinks.length) {
			for (const pkg of symLinks) {
				const path = join(this.path, 'node_modules', pkg.name);

				await checkNodeModulesPath(path);
				await pkg.install(false);
				await rmdir(`${path}`);
				await symlink(pkg.getPathToPublished(), path);
				await this.createBinScripts(pkg.json);
			}
		}

		this.timeEnd('install');
	}

	protected getPathToPublished(): string {
		throw new Error(` ${this.name}#getPathToPublished() Must be implemented`);
	}

	protected log(...args) {
		let resumeSpinner = false;

		if (SPINNER && SPINNER.isSpinning()) {
			resumeSpinner = true;
			SPINNER.stop(true);
		}

		console.log(` [${this.name}]`, ...args);

		resumeSpinner && SPINNER.start();
	}

	protected time(label) {
		this.verboseTime && console.time(` [${this.name}] ${label}`);
	}

	protected timeEnd(label) {
		this.verboseTime && console.timeEnd(` [${this.name}] ${label}`);
	}
}
