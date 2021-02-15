import { resolve } from 'path';
import { unlinkSync, existsSync, writeFileSync } from 'fs';
import minimist = require('minimist');
import { bold, red } from 'chalk';
import { satisfies, parse as parseVersion } from 'semver';
import { getRegistryUrl, detectPackage } from '../../src/utils/npm';
import { gitFetchStatus, gitStatus } from '../../src/utils/git';
import { verbose } from '../../src/utils/verbose';
import { execWithRegistry, exec } from '../../src/utils/exec';

const cwd = process.cwd();
const pkgFile = resolve(cwd, 'package.json');
const pkg = (() => {
	try {
		return require(pkgFile);
	} catch {
		verbose(pkgFile, ' not found')
		return {name: '<<unknown>>', version: '0.0.0'};
	}
})();
const argv = process.argv.slice(2);
const values = argv.filter((a) => !a.startsWith('-') || /^-+$/.test(a));
const registryUrl = getRegistryUrl();
let {
	init:npmInit,
	add,
	save,
	saveDev,
	remove,
	latest,
	rc:rcTag,
	draft:draftTag,
	major:upMajor,
	minor:upMinor,
	patch:upPatch,
	release,
} = minimist(argv);
let cmd = values[0];
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

switch (cmd) {
	case 'up':
		values.splice(0, 1);
		action = cmd;
		break;

	case '+':
	case '++':
		values.splice(0, 1);
		action = 'install';
		saveDev = cmd !== '+';
		break;

	case '-':
	case '--':
		values.splice(0, 1);
		action = 'uninstall';
		break;
}

verbose('action:', action);
verbose('registry:', registryUrl);

function savePkgJson() {
	writeFileSync(pkgFile, JSON.stringify(pkg, null, 2));
}

function removeFile(file: string) {
	if (existsSync(file)) {
		verbose('unlink', file);
		unlinkSync(file);
	}
}

async function npx() {
	const value = argv[0];

	if (!value) {
		console.error(bold.red('Package name not defined'));
		process.exit(1);
	}

	const pkg = await detectPackage(value)

	if (pkg === null) {
		console.error(bold.red(`Package '${value}' not found`));
		console.error(red('Try add --reg=...'));
		process.exit(1);
	}

	const args = [pkg.fullName].concat(argv.slice(1));

	verbose('package:', pkg);
	await exec('npx', args).promise;
}

async function npm(list: string[]) {
	const args = [action, saveDev ? '--save-dev' : '--save'];

	for (const name of list) {
		const pkg = await detectPackage(name);
		args.push(pkg.fullName);
	}

	await execWithRegistry('npm', args).promise;
}

async function publish() {
	const ver = parseVersion(pkg.version);
	const {branch, changes} = await gitFetchStatus();
	const beforeStatusFiles = await gitStatus();
	let skipChanges = false;
	let npmTag = 'latest';
	let gitTag = '';

	console.log(bold('NPMy PUBLISH 🔥'));
	console.log('→ branch:', bold.cyan(branch));

	if (rcTag) {
		npmTag = 'rc';
		ver.prerelease = [branch, (+ver.prerelease[1] || 0) + 1]
	} else if (draftTag) {
		npmTag = 'draft';
		skipChanges = true;
		ver.prerelease = [branch, (+ver.prerelease[1] || 0) + 1]
	} else {
		// Release
		if (upMajor) {
			ver.major++;
		} else if (upMinor) {
			ver.minor++;
		} else if (upPatch) {
			ver.patch++;
		} else if (!release) {
			console.error(bold.red('⚠️  Use --major, --minor or --patch'));
			process.exit(1);
		}

		if (branch !== 'master') {
			console.error(bold.red('You can publish a release only from the master'));
			console.error(bold.red('Maybe, you want to publish RC, use: --rc'));
			process.exit(1);
		}

		ver.build = [];
		ver.prerelease = [];
		gitTag = `v${ver.format()}`;
	}

	if (changes && !skipChanges) {
		console.log(bold.red('🛑 Has uncommitted changes'));
		process.exit(1);
	}

	console.log('→ npm.tag:', bold.cyan(npmTag));
	console.log('→ version:', bold.cyan(ver.format()));

	pkg.version = ver.format();
	savePkgJson();

	if (gitTag) {
		const msg = `Release: ${gitTag} (via NPMy 🔥)`;

		await exec('git', ['commit', '-a', '-m', `"${msg}"`]).promise;
		await exec('git', ['push', 'origin', 'master']).promise;
		await exec('git', ['tag', '-a', gitTag, '-m', `"${msg}"`]).promise;
		await exec('git', ['push', 'origin', gitTag]).promise;
	}

	try {
		await execWithRegistry('npm', ['publish', '--tag', npmTag]).promise;
	} catch {}

	const afterStatusFiles = await gitStatus();
	const filesToClean = afterStatusFiles.filter((entry) => {
		if (entry.type !== '??') {
			return false;
		}

		return !beforeStatusFiles.find(({file}) => file === entry.file);
	});

	filesToClean.forEach((entry) => {
		removeFile(entry.file);
	});
}

async function run(name: string, args: any[]) {
	verbose('run:', args);
	
	if (name === 'publish') {
		await publish();
		return;
	}

	await execWithRegistry('npm', ['run', name].concat(args)).promise;
}

async function upDeps(filter?: string) {
	let out = '';
	const child = execWithRegistry('npm', ['outdated', '--json'], { stdio: undefined });
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
		savePkgJson();

		console.log('');

		await execWithRegistry('npm', ['install']).promise;
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
	if (npmInit && values.length === 0) {
		await execWithRegistry('npm', ['init', '-y']).promise;
		return;
	}

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
