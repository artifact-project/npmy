import {resolve, dirname} from 'path';
import {glob, readFile} from '../utils/utils';
import Package, {INPMyrc} from '../Package/Package';
import ObservablePackage from '../ObservablePackage/ObservablePackage';

export type RCScanResult = {
	path: string;
	name: string;
	filename: string;
	rc: INPMyrc;

};

export default class Manager {
	items: RCScanResult[] = [];
	itemsIndex: {[path: string]: RCScanResult} = {};
	observables: {[path: string]: boolean} = {};
	packages: {[path: string]: Package} = {};

	getPackage(path): Package {
		if (!this.packages[path]) {
			const Class = this.observables[path] ? ObservablePackage : Package;
			const rc = this.itemsIndex[path] ? this.itemsIndex[path].rc : {};
			const npmy = Object.entries(rc).reduce((list, [name, path]) => {
				list[name] = this.getPackage(path);
				return list;
			}, {});

			this.packages[path] = new Class(path, npmy) as Package;
		}

		return this.packages[path];
	}

	async run() {
		for (const {path} of this.items) {
			await this.getPackage(path).install();
		}
	}

	async scan(cwd: string) {
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

			const data: RCScanResult = {
				path,
				name,
				filename,
				rc,
			};

			this.itemsIndex[data.path] = data;

			return data;
		}));

		this.items.push(...list);

		return list;
	}
}
