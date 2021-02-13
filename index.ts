import * as minimist from 'minimist';

const {
	link,
	help,
} = minimist(process.argv.slice(2));

const cmd = help
	? 'help'
	: link
	? 'link'
	: 'run'
;

if (!cmd) {
	console.error(`Unknown '${cmd}' command`);
	process.exit(1);
}

require(`./cmd/${cmd}`);
