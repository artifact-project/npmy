import {join, resolve, dirname} from 'path';
import {glob, readFile, existsSync, pause} from '../utils/utils';
import Package from '../Package/Package';
import ObservablePackage from '../ObservablePackage/ObservablePackage';
import {getPackageJSON} from '../PackageJSON/PackageJSON';

export type RCScanResult = {
	path: string;
	rc: object;

};

export default class Manager {
	items: RCScanResult[] = [];
	itemsIndex: {[path: string]: RCScanResult} = {};
	observables: {[path: string]: boolean} = {};

	packages: {[path: string]: Package} = {};
	observablePackages: {[path: string]: ObservablePackage} = {};

	private preparePackage(path: string, notObservable: boolean, initialRC): Package {
		this.verbose(`prepare package: ${path} [observable: ${!notObservable}]`);

		const isObservable = !notObservable && this.observables[path];
		const collection = isObservable ? this.observablePackages : this.packages;

		if (!collection[path]) {
			const Class = isObservable ? ObservablePackage : Package;
			const rc = {
				...initialRC,
				...(this.itemsIndex[path] ? this.itemsIndex[path].rc : {})
			};
			const pkgJson = getPackageJSON(path);

			if (!pkgJson) {
				this.verbose(`Bad package.json in ${path}`);
			}

			const {allDependencies} = pkgJson;
			const npmy = Object
				.entries(rc)
				.filter(([name]) => allDependencies.hasOwnProperty(name))
				.reduce((list, [name, path]) => {
					list[name] = this.preparePackage(path as string, false, rc);
					return list;
				}, {});

			collection[path] = new Class(path, npmy) as Package;
		}

		return collection[path];
	}

	async run() {
		for (const {path} of this.items) {
			await this.preparePackage(path, true, {}).install(true);
			await pause(1000);
		}

		console.log('--------------------------------------');
		console.log('\x1b[32m NPMy is ready, can start development \x1b[0m');
		console.log('--------------------------------------');
	}

	setLink(pkg: string, to: string, cwd: string = __dirname) {
		const toPath = resolve(cwd, to);
		this.observables[toPath] = true;
		this.addItem(cwd, {[pkg]: toPath});
	}

	async scan(cwd: string, include?: string) {
		const files = await glob('**/.npmyrc', {
			cwd,
			dot: true,
		});
		let rc = {};

		const list = await Promise.all(files.map(async (name) => {
			if (name.includes('node_modules')) {
				return null;
			}

			const filename = resolve(cwd, name);
			const path = dirname(filename);

			rc = {
				...rc,
				...(JSON.parse(await readFile(filename) + '')),
			};

			Object.keys(rc).forEach(name => {
				rc[name] = resolve(path, rc[name]);
				this.observables[rc[name]] = true;
			});

			return this.addItem(path, rc);
		}));

		if (include) {
			const entries = await glob(include, {
				cwd,
				absolute: true,
			});

			await Promise.all(
				entries
					.filter(filename => existsSync(join(filename, 'package.json')))
					.map(async filename => {
						let rc = {
							...this.itemsIndex[cwd].rc,
						};

						try {
							rc = {
								...rc,
								...JSON.parse(await readFile(join(filename, '.npmyrc')) + ''),
							};
						} catch (err) {}

						Object
							.entries(rc)
							.forEach(([name, path]:[string, string]) => {
								rc[name] = resolve(filename, path);
								this.observables[rc[name]] = true;
							})
						;

						list.push(this.addItem(filename, rc));
					})
			);
		}

		return list.filter(item => !!item);
	}

	private addItem(path: string, rc: object): RCScanResult {
		if (this.itemsIndex[path]) return null;

		const data: RCScanResult = {
			path,
			rc,
		};

		this.itemsIndex[path] = data;
		this.items.push(data);

		return data;
	}

	private verbose(msg) {
		if (process.env.VERBOSE) {
			console.log(`\x1b[33m -> ${msg}\x1b[0m`);
		}
	}
}
