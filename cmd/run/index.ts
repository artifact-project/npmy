import { spawn, SpawnOptions } from 'child_process';
import { resolve } from 'path';
import { unlinkSync, existsSync, writeFileSync } from 'fs';
import getLatestVersion from 'latest-version';
import minimist = require('minimist');
import {bold, magenta, red} from 'chalk';
import { satisfies } from 'semver';

const cwd = process.cwd();
const argv = process.argv.slice(2);
const values = argv.filter((a) => !a.startsWith('-'));
let {
	add,
	save,
	saveDev,
	remove,
	registry, // 'https://registry.npmjs.org'
	r,
	reg,
	dr, // Use default registry
	verbose:verboseEnabled,
	latest,
} = minimist(argv);
let cmd = values[0];
let registryUrl = reg || r || registry;
let action = (
	add || save || saveDev
	? 'install'
	: remove
	? 'uninstall'
	: /^:/.test(cmd)
	? 'run'
	: 'npx'
);

verbose('argv:', argv);
verbose('values:', values);
verbose('action:', action);
verbose('registry:', registryUrl);

if (dr) {
	registryUrl = 'https://registry.npmjs.org';
}

switch (cmd) {
	case 'up':
		values.splice(0, 1);
		action = cmd;
		break;

	case '+':
	case '+?':
	case '++':
		values.splice(0, 1);
		action = 'install';
		saveDev = cmd !== '+';
		break;

	case '-':
	case '-?':
	case '--':
		values.splice(0, 1);
		action = 'uninstall';
		break;
}

if (registryUrl) {
	process.env['npm_config_registry'] = registryUrl;
}

function verbose(...args: any[]) {
	verboseEnabled && console.info(...args.map(a => /bool|string|number/.test(typeof a) ? magenta(a) : a));
}

function exec(cmd: string, args: string[], options: SpawnOptions = {}) {
	if (cmd === 'npm' && registryUrl) {
		args.push(`--registry=${registryUrl}`);
	}

	verbose(cmd, args);

	let _resolve = () => void 0;
	const promise = new Promise<void>((resolve) => {
		_resolve = resolve;
	});
	const child = spawn(cmd, args, {
		stdio: 'inherit',
		cwd: process.cwd(),
		env: process.env,
		...options,
	});

	child.on('close', () => _resolve());

	return Object.assign(child, {promise});
}

function removeFile(file: string) {
	if (existsSync(file)) {
		unlinkSync(file);
	}
}

async function getVersion(pkgName: string) {
	try {
		return await getLatestVersion(pkgName, <any>{registryUrl});
	} catch {
		return null;
	}
}

async function detectPackage(value: string) {
	const [firstPart, ...parts] = value.split(/[/-]/);
	const names = value.includes('@') ? [value] : [value].concat(
		parts
			.map((_, i) => {
				const scope = [firstPart].concat(parts.slice(0, i)).join('-');
				const name = parts.slice(i).join('-');

				return `@${scope}/${name}`;
			})
			.reverse()
	);

	verbose('names:', names);

	for (const name of names) {
		let version = await getVersion(name);
		
		if (version !== null) {
			return {
				name,
				version,
				fullName: `${name}@${version}`,
			};
		}
	}

	return null;
}

async function npx() {
	const value = argv[0];

	if (!value) {
		console.error(bold.red('Package name not defined'));
		process.exit(1);
	}

	const pkg = await detectPackage(value)

	if (pkg === null) {
		console.error(`Package '${value}' not found`);
		console.error('Try add --reg=...');
		process.exit(1);
	}

	const args = [pkg.fullName].concat(argv.slice(1));

	verbose('package:', pkg);
	exec('npx', args);
}

async function npm(list: string[]) {
	const args = [action, saveDev ? '--save-dev' : '--save'];

	for (const name of list) {
		const pkg = await detectPackage(name);
		args.push(pkg.fullName);
	}

	exec('npm', args);
}

async function run(name: string, args: any[]) {
	verbose('run:', args);
	exec('npm', ['run', name].concat(args));
}

async function upDeps(filter?: string) {
	const pkgFile = resolve(cwd, 'package.json');
	const pkg = require(pkgFile);

	let out = '';
	const child = exec('npm', ['outdated', '--json'], { stdio: undefined });
	child.stdout.on('data', (chunk) => { out += chunk; })

	await child.promise;
	
	const deps = JSON.parse(out) as Record<string, {
		current: string;
		wanted: string;
		latest: string;
	}>;

	verbose('deps:', deps);
	
	const depsList = Object.entries(deps);
	const toUp = [] as [string, string, string][];
	const notUp = [] as [string, string, string][];

	let maxNameLen = 0;
	let maxVerLen = 0;

	for (const [name, info] of depsList) {
		if (filter && !name.startsWith(filter)) {
			continue;
		}

		maxNameLen = Math.max(maxNameLen, name.length);
		maxVerLen = Math.max(maxVerLen, info.current.length);
		
		if (latest || satisfies(info.current, info.latest)) {
			toUp.push([name, info.current, info.latest])
		} else {
			notUp.push([name, info.current, info.latest])
		}
	}

	if (!toUp.length && !notUp.length) {
		console.log(bold.green('Wow, all dependencies are actual 👌🏻'));
		return;
	}

	if (toUp.length) {
		console.log(bold('List of packages to be updated:'))
		toUp.forEach(([name, curVer, latest]) => {
			pkg.dependencies && pkg.dependencies[name] && (pkg.dependencies[name] = `^${latest}`);
			pkg.devDependencies && pkg.devDependencies[name] && (pkg.devDependencies[name] = `^${latest}`);
			pkg.peerDependencies && pkg.peerDependencies[name] && (pkg.peerDependencies[name] = `^${latest}`);

			console.log(
				' ',
				bold.cyan(name.padEnd(maxNameLen)),
				bold.yellow(curVer.padEnd(maxVerLen)), '→', bold.green(latest),
			);
		});

		removeFile(resolve(cwd, 'package-lock.json'));
		writeFileSync(pkgFile, JSON.stringify(pkg, null, 2));

		console.log('');

		await exec('npm', ['install']);
	}

	if (notUp.length) {
		console.log(bold('Not updated packages (use --latest):'))

		notUp.forEach(([name, curVer, latest]) => {
			console.log(
				' ',
				red(name.padEnd(maxNameLen)),
				bold.yellow(curVer.padEnd(maxVerLen)), '→', bold.red(latest),
			);
		});
	}
}

// Main
(async function main() {
	if (action === 'npx') {
		await npx();
		return;
	}
	
	if (action === 'run') {
		await run(values[0].slice(1), argv.slice(1));
		return;
	}

	if (action === 'up') {
		await upDeps(values[0]);
		return;
	}

	await npm(values);
})();
