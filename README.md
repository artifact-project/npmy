![NPMy](https://habrastorage.org/web/90b/1de/e11/90b1dee119184345bf280b43c8172568.png)

```
npm install -g npmy
```

### Usage

 0. `npm install -g npmy`
 1. `cd path/to/project`
 2. Add `.npmyrc` to `.gitignore`
 3. `touch .npmyrc`
 4. Edit `.npmyrc` as JSON-file and write `{"%TARGET_DEPENDENCY%": "%LOCAL_PATH_TO_PACKAGE_FOLDER%"}`
 5. `npmy .`
 6. ...
 7. Profit!

### API

`npmy [path] [--include=pattern]`

 - `path` — by default current folder
 - `add` — add packages into `.npmyrc` (relative or absolute pattern)
 - `include` — see [glob](https://github.com/isaacs/node-glob#glob-primer)
 - `version` — print current version
 - `verbose` — process detailing of installation and linking

### Description of work / [Read article](https://github.com/artifact-project/npmy/wiki/%60npm-link%60-on-steroids) <sup><a href="https://habrahabr.ru/company/mailru/blog/333580/">Ru</a></sup>

`npmy` — special tool for local packages development, subjecting to other packages being in development.

Usually I solve this task via npm link, or just symlink. These methods don't work,
when dependent package has difficult publish cycle (modifies it's source, e.g. using Babel/Rollup/etc)
or there are more then one.

Trust me, `npmy` covers all above mentioned tasks.

### Inline usage

```sh
# Before: `cd` to your project folder
npmy --pkg=tx-i18n --to=~/artifact-project/tx-i18n
```


### Development

 - `npm i`
 - `npm test`, [code coverage](./coverage/lcov-report/index.html)
