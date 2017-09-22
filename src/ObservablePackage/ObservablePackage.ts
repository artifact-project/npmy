import {tmpdir} from 'os';
import {join, basename, relative} from 'path';
import * as watch from 'node-watch';
import * as debounce from 'debounce';
import * as minimatch from 'minimatch';
import {exec, writeFile, glob, unlinkSync, rmdirSync, existsSync, readFile, pause} from '../utils/utils';
import Package, {INPMyrc} from '../Package/Package';

export default class ObservablePackage extends Package {
	private processing: boolean = false;
	private taskRetries: number = 0;

	private rsyncGhostPath: string;
	private ghostPath: string;
	private tasks: (() => Promise<any>)[] = [];
	private gitignore: ((file: string) => boolean)[] = [];

	constructor(public path: string, public npmy: INPMyrc) {
		super(path, npmy);

		this.rsyncGhostPath = join(tmpdir(), this.name.replace(/[^a-z_0-9-]/gi, '_'));
		this.ghostPath = join(this.rsyncGhostPath, basename(this.path));
	}

	expire(rsync) {
		this.tasks = [];

		rsync && this.addTask(() => this.rsyncGhost(true));
		this.simulatePublish();
		this.addTask(() => this.log(`Published`))
	}

	addTask(exec) {
		this.tasks.push(exec);
		this.runNextTask();
	}

	simulatePublish() {
		this.addTask(() => this.time('simulatePublish'));
		this.addTask(() => this.execHook('prepare'));
		this.addTask(() => this.execHook('prepublishOnly'));
		this.addTask(() => this.execHook('prepublish'));
		this.addTask(() => this.execHook('publish'));
		this.addTask(() => this.cleanGhostAfterPublish());
		this.addTask(() => this.timeEnd('simulatePublish'));
	}

	protected getPathToPublished(): string {
		return this.ghostPath;
	}

	protected async runInstall(createBinScripts: boolean) {
		await super.runInstall(createBinScripts);
		await this.rsyncGhost(false);
		await this.readGitignore();

		this.expire(false);
		this.startWatcher();
	}

	private async readGitignore() {
		const filename = join(this.path, '.gitignore');

		if (existsSync(filename)) {
			const content = await readFile(filename);

			this.gitignore = String(content)
				.split('\n')
				.filter(line => line.trim() && line.charAt(0) !== '#')
				.map(pattern => {
					const mm = new minimatch.Minimatch(pattern, {
						dot: true,
					});

					return (file) => file.includes(pattern) || mm.match(file);
				})
			;
		}
	}

	private startWatcher() {
		this.log('Start watcher');

		watch(this.path, {
			recursive: true,
			filter: (filename) => !/\/(node_modules|\.git)\//.test(filename),
		}, debounce((eventName, filename) => {
			const relativeFilename = relative(this.path, filename);
			const ignored = this.gitignore.some(match => match(relativeFilename));

			if (!ignored) {
				this.log(`${eventName} -> ${filename}`);
				this.expire(true);
			}
		}, 500));
	}

	private async rsyncGhost(excludeNodeModules: boolean) {
		this.time(`rsyncGhost(${excludeNodeModules})`);

		if (excludeNodeModules) {
			await exec(`rsync -a ${this.path} ${this.rsyncGhostPath} --exclude '.git/' --exclude 'node_modules/'`);
		} else {
			await exec(`rsync -a ${this.path} ${this.rsyncGhostPath} --exclude '.git/'`);
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

		if (ignoreFilePatterns && ignoreFilePatterns.length) {
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
			let hasError = false;

			try {
				await task();
			} catch (err) {
				hasError = true;

				this.taskRetries++;
				this.log('Task running failed:', this.taskRetries, '(pause 500ms)');

				await pause(500);

				if (this.taskRetries > 3) {
					this.tasks.unshift(task);
				} else {
					throw err;
				}
			} finally {
				if (!hasError) {
					this.taskRetries = 0;
				}

				this.processing = false;
				this.runNextTask();
			}
		}
	}
}
