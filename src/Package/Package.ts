import {join} from 'path';
import {satisfies, gt} from 'semver';
import {exec, symlink, createSpinner, checkNodeModulesPath, rmdir} from '../utils/utils';
import {PackageJSON, getPackageJSON} from '../PackageJSON/PackageJSON';
import {symlinkSync, unlinkSync, chmodSync} from 'fs';

export interface INPMyrc {
	[name: string]: Package;
}

let SPINNER;

export default class Package {
	json: PackageJSON;

	private installer;
	private verboseTime: boolean;

	constructor(public path: string, public npmy: INPMyrc) {
		this.json = getPackageJSON(path);
		this.verboseTime = !!process.env.VERBOSE_TIME;

		if (!this.name) {
			console.error(`\x1b[31m ${path}`);
			console.error(this.json, ' \x1b[0m');
			throw new Error('Invalid package');
		}
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
				this.verboseError(`hook "${name}" failed:`, err);
				// console.error(err);
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

			// Exit
			if (!binCommands.length) return;

			this.verbose(`(bin) ${name} ${binCommands.map((name) => `[${name} -> ${bin[name]}]`).join(', ')}`);

			binCommands.forEach((name) => {
				const binFilename = bin[name];
				const filename = join(binRoot, name);

				try { unlinkSync(filename); } catch (err) {}

				try {
					symlinkSync(join(pkgPath, binFilename as string), filename);
					chmodSync(filename, '755');
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
					scanNext(pkgJson.allDependencies);
				}
			});
		};

		await checkNodeModulesPath(binRoot);

		createBin(join(this.path, 'node_modules', json.name), json.bin);
		scanNext(json.allDependencies);
	}

	protected async runInstall(createBinScripts: boolean) {
		const symLinks: Package[] = [];
		const toInstall: ({name: string, version: string})[] = [];
		const existsDeps = {};

		this.verbose(`Run install (${createBinScripts})`);
		this.time('install');

		(function collect(deps:{[name:string]: string} = {}, npmy: INPMyrc) {
			Object.keys(deps).forEach((name) => {
				const version = deps[name];
				const cleanVersion = version.replace(/[^\d\.]/, '');

				if (existsDeps[name]) {
					try {
						if (existsDeps[name] === cleanVersion || !gt(cleanVersion, existsDeps[name])) {
							return;
						}
					} catch (err) {
						this.verboseError(
							`${name} "${existsDeps[name]}" -> "${cleanVersion}" (${version})`,
							err,
						);
					}

					this.verbose(`(info)  ${name} "${existsDeps[name]}" -> "${cleanVersion}" (${version})`);
				}

				existsDeps[name] = cleanVersion;

				if (npmy[name]) {
					const pkg = npmy[name];

					this.verbose(`\x1b[34m(local) ${name} --> ${pkg.path}`);
					symLinks.push(pkg);
					collect.call(this, pkg.json.dependencies, pkg.npmy);
				} else {
					this.verbose(`\x1b[35m(npm)   ${name}@${version}`);

					toInstall.push({
						name,
						version,
					});
				}
			});
		}).call(this, this.json.allDependencies, this.npmy);

		// Create sym-links
		if (symLinks.length) {
			for (const pkg of symLinks) {
				const path = join(this.path, 'node_modules', pkg.name);

				await checkNodeModulesPath(path);
				await pkg.install(false);
				await rmdir(path);
				await symlink(pkg.getPathToPublished(), path);
				await this.createBinScripts(pkg.json);
			}
		}

		// install npm-packages
		if (toInstall.length) {
			SPINNER = createSpinner(` %s [${this.name}] Checking dependencies`, true);

			const deps = toInstall
				.filter(({name, version}) => {
					try {
						const pkg = getPackageJSON(join(this.path, 'node_modules', name));
						return !satisfies(pkg.version, version);
					} catch (err) {
						// this.verboseError(`${name}@${version} (${this.path})`, err);
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
					`npm i --no-shrinkwrap --no-package-lock ${deps.join(' ')}`,
					{cwd: this.path},
				);

				SPINNER.stop(true);
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

	protected verbose(...args) {
		if (process.env.VERBOSE) {
			let resumeSpinner = false;

			if (SPINNER && SPINNER.isSpinning()) {
				resumeSpinner = true;
				SPINNER.stop(true);
			}

			console.log(`\x1b[33m -> [${this.name}]`, ...args, '\x1b[0m');

			resumeSpinner && SPINNER.start();
		}
	}

	protected verboseError(...args) {
		this.verbose(`\x1b[31m(error)`, ...args);
		process.exit(1);
	}

	protected time(label) {
		this.verboseTime && console.time(` [${this.name}] ${label}`);
	}

	protected timeEnd(label) {
		this.verboseTime && console.timeEnd(` [${this.name}] ${label}`);
	}
}
