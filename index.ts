import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import * as watch from 'node-watch';
import * as minimist from 'minimist';
import * as debounce from 'debounce';
import * as childProcess from 'child_process';
import {Spinner} from 'cli-spinner';

const exec = promisify<any>(childProcess.exec);
const scan = promisify<string[]>(glob);
const symlink = promisify<null>(fs.symlink);
const readFile = promisify<string>(fs.readFile);

const {
	_:targetPaths,
} = minimist(process.argv.slice(2));

// process.stdin.resume();
// process.on('SIGINT', () => process.exit());
// process.on('uncaughtException', (err) => console.log(err.stack));

console.log(`NPMy (ctrl+c -> exit)`);
console.log(`tmp: ${os.tmpdir()}`);
console.log(`---------------------`);

targetPaths.forEach(async (targetPath) => {
	const fullTargetPath = path.resolve(targetPath);
	const spinner = new Spinner(` %s ${fullTargetPath}`);

	spinner.setSpinnerString(18);
	spinner.start();

	const files = await scan('**/.npmyrc', {cwd: fullTargetPath, dot: true});

	spinner.stop(true);
	console.log(` - ${fullTargetPath}: ${files.length} files`);

	const rcList = await Promise.all(files.map(async (filename, idx) => ({
		name: filename,
		rc: JSON.parse(await readFile(path.resolve(fullTargetPath, filename)) + ''),
	})));

	rcList.forEach(({name, rc}) => {
		console.log(`     ${name}`);

		Object.entries(rc).forEach(([src, dst]) => {
			const dstPath = path.resolve(fullTargetPath, name.split('/').slice(0, -1) + '', dst);

			console.log(`        ${src} -> ${dst} (${dstPath})`);
			link(src, fullTargetPath, dstPath);
		});
	});
});

class Link {
	private pkg: any = null;
	private tasks: (() => Promise<any>)[] = [];
	private processing: boolean = false;

	private filename: string;
	private ghostPath: string;
	private rsyncGhostPath: string;

	constructor(public name, public srcPath, public dstPath) {
		this.pkg = require(path.resolve(dstPath, 'package.json'));

		this.filename = path.resolve(srcPath, 'node_modules', name);
		this.rsyncGhostPath = path.resolve(os.tmpdir(), name.replace(/[^a-z_0-9-]/gi, '_'));
		this.ghostPath = path.resolve(this.rsyncGhostPath, path.basename(dstPath));
	}

	expire(rsync = false) {
		this.tasks = [];

		rsync && this.addTask(() => this.rsyncGhost());
		this.simulatePublish();
		this.simulateInstall();
		this.addTask(() => console.log(`REBUILDED: ${this.name}`))
	}

	addTask(exec) {
		this.tasks.push(exec);
		this.runNextTask();
	}

	hasHook(name) {
		return this.pkg.scripts.hasOwnProperty(name);
	}

	simulatePublish() {
		this.addTask(() => this.execHook('prepublishOnly'));
		this.addTask(() => this.execHook('prepublish'));
		this.addTask(() => this.execHook('publish'));
		this.addTask(() => this.cleanAfterPublish());
	}

	simulateInstall() {
		this.addTask(() => this.execHook('prepublish'));
		this.addTask(() => this.execHook('preinstall'));
		this.addTask(() => this.execHook('install'));
		this.addTask(() => this.execHook('postinstall'));
	}

	async cleanAfterPublish() {
		const {files:ignoreFilePatterns} = this.pkg;

		if (ignoreFilePatterns.length) {
			const toRemoveFiles = await scan('**/*', {
				cwd: this.ghostPath,
				dot: true,
				ignore: ['node_modules/**/*', ...ignoreFilePatterns],
			});

			this.addTask(() => {
				toRemoveFiles.reverse().forEach(filename => {
					if (filename === 'package.json') return;

					const fullFilename = path.resolve(this.ghostPath, filename);

					try {
						fs.unlinkSync(fullFilename);
					} catch (err) {
						try {
							fs.rmdirSync(fullFilename);
						} catch (err) {}
					}
				});
			});
		}
	}

	async activate() {
		console.time(`${this.name}.removeOriginal`);
		await this.removeOriginal();
		console.timeEnd(`${this.name}.removeOriginal`);

		console.time(`${this.name}.rsyncGhost`);
		await this.rsyncGhost();
		console.timeEnd(`${this.name}.rsyncGhost`);

		console.time(`${this.name}.createSymLink`);
		await this.createSymLink();
		console.timeEnd(`${this.name}.createSymLink`);

		console.log(`Start watch: ${this.name}`);
		this.expire(false);

		watch(this.dstPath, {
			recursive: true,
			filter: (name) => !/node_modules/.test(name),
		}, debounce((evtName, filename) => {
			console.log(`${this.name} -> ${evtName}: ${filename}`);
			this.expire(true);
		}, 1000));
	}

	async createSymLink() {
		return symlink(this.ghostPath, this.filename);
	}

	async removeOriginal() {
		return exec(`rm -rf ${this.filename}`);
	}

	async rsyncGhost() {
		await exec(`rsync -a ${this.dstPath} ${this.rsyncGhostPath}`);
	}

	async execHook(name) {
		return this.hasHook(name)
			? exec(`npm run ${name}`, {cwd: this.ghostPath})
			: Promise.resolve()
		;
	}

	async runNextTask() {
		if (!this.processing && this.tasks.length) {
			this.processing = true;

			const task = this.tasks.shift();

			try {
				await task()
			} catch (err) {
				console.log(err);
			} finally {
				this.processing = false;
				this.runNextTask();
			}
		}
	}
}

async function link(name, srcPath, dstPath) {
	const link = new Link(name, srcPath, dstPath);

	link.activate();
}

function promisify<T>(fn, context = null): (...args) => Promise<T> {
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
