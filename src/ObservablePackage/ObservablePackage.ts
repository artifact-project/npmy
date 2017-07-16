import {tmpdir} from 'os';
import {join, basename} from 'path';
import * as watch from 'node-watch';
import * as debounce from 'debounce';
import {exec, writeFile, glob, unlinkSync, rmdirSync} from '../utils/utils';
import Package, {INPMyrc} from '../Package/Package';

export default class ObservablePackage extends Package {
	private processing: boolean = false;
	private rsyncGhostPath: string;
	private ghostPath: string;
	private tasks: (() => Promise<any>)[] = [];

	constructor(public path: string, public npmy: INPMyrc) {
		super(path, npmy);

		this.rsyncGhostPath = join(tmpdir(), this.name.replace(/[^a-z_0-9-]/gi, '_'));
		this.ghostPath = join(this.rsyncGhostPath, basename(this.path));
	}

	expire(rsync) {
		this.tasks = [];

		rsync && this.addTask(() => this.rsyncGhost(true));
		this.simulatePublish();
		this.simulateInstall();
		this.addTask(() => this.log(`Published`))
	}

	addTask(exec) {
		this.tasks.push(exec);
		this.runNextTask();
	}

	simulatePublish() {
		this.addTask(() => this.time('simulatePublish'));
		this.addTask(() => this.execHook('prepublishOnly'));
		this.addTask(() => this.execHook('prepublish'));
		this.addTask(() => this.execHook('publish'));
		this.addTask(() => this.cleanGhostAfterPublish());
		this.addTask(() => this.timeEnd('simulatePublish'));
	}

	simulateInstall() {
		this.addTask(() => this.time('simulateInstall'));
		this.addTask(() => this.execHook('prepublish'));
		this.addTask(() => this.execHook('preinstall'));
		this.addTask(() => this.execHook('install'));
		this.addTask(() => this.execHook('postinstall'));
		this.addTask(() => this.timeEnd('simulateInstall'));
	}

	protected getPathToPublished(): string {
		return this.ghostPath;
	}

	protected async runInstall() {
		await super.runInstall();
		await this.rsyncGhost(false);

		this.expire(false);
		this.startWatcher();
	}

	private startWatcher() {
		this.log('Start watcher');

		watch(this.path, {
			recursive: true,
			filter: (filename) => !/node_modules/.test(filename),
		}, debounce((eventName, filename) => {
			this.log(`${eventName} -> ${filename}`);
			this.expire(true);
		}, 1000));
	}

	private async rsyncGhost(excludeNodeModules: boolean) {
		this.time(`rsyncGhost(${excludeNodeModules})`);

		if (excludeNodeModules) {
			await exec(`rsync -a ${this.path} ${this.rsyncGhostPath} --exclude 'node_modules'`);
		} else {
			await exec(`rsync -a ${this.path} ${this.rsyncGhostPath}`);
		}

		await writeFile(join(this.ghostPath, 'package.json'), JSON.stringify({
			...this.json,
			...{
				scripts: {
					...this.json.scripts,
					test: 'echo "SKIPPED"',
				},
			},
		}, null, 2));

		this.timeEnd(`rsyncGhost(${excludeNodeModules})`);
	}

	async cleanGhostAfterPublish() {
		const {files:ignoreFilePatterns} = this.json;

		if (ignoreFilePatterns.length) {
			this.time('cleanGhostAfterPublish');
			this.time('cleanGhostAfterPublish.glob');

			const toRemoveFiles = [
				...await glob('*', {
					cwd: this.ghostPath,
					ignore: ['node_modules', ...ignoreFilePatterns],
				}),
				...await glob('!(node_modules)/**/*', {
					cwd: this.ghostPath,
					ignore: [...ignoreFilePatterns],
				})
			];

			this.timeEnd('cleanGhostAfterPublish.glob');
			this.time('cleanGhostAfterPublish.unlink');

			toRemoveFiles.reverse().forEach(filename => {
				if (filename === 'package.json') return;

				const fullFilename = join(this.ghostPath, filename);

				try {
					unlinkSync(fullFilename);
				} catch (err) {
					try {
						rmdirSync(fullFilename);
					} catch (err) {}
				}
			});

			this.timeEnd('cleanGhostAfterPublish.unlink');
			this.timeEnd('cleanGhostAfterPublish');
		}
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
