import {join, resolve, dirname} from 'path';
import {glob, readFile, existsSync} from '../utils/utils';
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

	getPackage(path: string, notObservable: boolean = false): Package {
		const isObservable = !notObservable && this.observables[path];
		const collection = isObservable ? this.observablePackages : this.packages;

		if (!collection[path]) {
			const Class = isObservable ? ObservablePackage : Package;
			const rc = this.itemsIndex[path] ? this.itemsIndex[path].rc : {};
			const {allDependencies} = getPackageJSON(path);
			const npmy = Object
				.entries(rc)
				.filter(([name]) => allDependencies.hasOwnProperty(name))
				.reduce((list, [name, path]) => {
					list[name] = this.getPackage(path);
					return list;
				}, {});

			collection[path] = new Class(path, npmy) as Package;
		}

		return collection[path];
	}

	async run() {
		for (const {path} of this.items) {
			await this.getPackage(path, true).install();
		}
	}

	async scan(cwd: string, include?: string) {
		const files = await glob('**/.npmyrc', {
			cwd,
			dot: true,
		});
		let rc = {};

		const list = await Promise.all(files.map(async (name) => {
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

			entries
				.filter(filename => existsSync(join(filename, 'package.json')))
				.forEach(filename => {
					const rc = Object
						.entries(this.itemsIndex[cwd].rc)
						.reduce((map, [name, path]) => {
							(path !== filename) && (map[name] = path);
							return map;
						}, {})
					;

					list.push(this.addItem(filename, rc));
				})
			;
		}

		return list;
	}

	private addItem(path: string, rc: object): RCScanResult {
		const data: RCScanResult = {
			path,
			rc,
		};

		this.itemsIndex[path] = data;
		this.items.push(data);

		return data;
	}
}
