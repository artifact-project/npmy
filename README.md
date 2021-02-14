![NPMy](https://habrastorage.org/webt/n4/k6/4j/n4k64jrjrkzeovjzqnnvtfeoto0.png)

- **npm**
  - Init: `npmy --init`
  - Install: `npmy + typescript` or dev `npmy ++ typescript`
  - Uninstall: `npmy - typescript`
  - Outdated + Update: `npmy up`
  - Publish: `npmy :publish --draft`, `npmy :publish --rc`, `npmy :publish --minor`
- **npm.scripts**
  - `npmy :build`
- **npx**
  - `npmy @mail-core/cli init`

---

### Setup

```sh
# Install
npm install -g npmy

# Help
npmy --help
```

---

### `npm`

```sh
# Install
npmy + @mail-core/cli

# Install as dev
npmy ++ mail-core/cli

# Uninstall
npmy - mail-core/cli
```

---

### `npm scripts`

```sh
# `npm start`
npmy :start

# `npm run build`
npmy :build
```

---

### `npm publish`

```sh
# Release
#  version: x.UP.x
#  npm.tag: latest
npmy :publish --minor

# RC
#  version: x.x.x-{branch}.UP
#  npm.tag: rc
npmy :publish --rc

# Draft (prerelease)
#  version: x.x.x-{branch}.UP
#  npm.tag: draft
npmy :publish --draft
```

---

### `npx`

With support custom registry!!1

```sh
# Default regsitry
npmy @mail-core/cli init

# Customize
npmy @mail-core/cli init --registry=https://my.npm.registry.dev
```

### `npm outdated`

```sh
# Soft update deps
npmy up

# Update to latest
npmy up --latest

# Update by filter (starts with):
npmy up @mail-core # ← up deps for "@mail-core/*"
```

---

### `npm link`

 0. `npm install -g npmy`
 1. `cd path/to/project`
 2. Add `.npmyrc` to `.gitignore`
 3. `touch .npmyrc`
 4. Edit `.npmyrc` as JSON-file and write `{"%TARGET_DEPENDENCY%": "%LOCAL_PATH_TO_PACKAGE_FOLDER%"}`
 5. `npmy --link .`
 6. ...
 7. Profit!

---

### API

`npmy --link [path] [--include=pattern]`

 - `path` — by default current folder
 - `add` — add packages into `.npmyrc` (relative or absolute pattern)
 - `include` — see [glob](https://github.com/isaacs/node-glob#glob-primer)
 - `version` — print current version
 - `verbose` — process detailing of installation and linking

---

### Description of work / [Read article](https://github.com/artifact-project/npmy/wiki/%60npm-link%60-on-steroids) <sup><a href="https://habrahabr.ru/company/mailru/blog/333580/">Ru</a></sup>

`npmy --link` — special tool for local packages development, subjecting to other packages being in development.

Usually I solve this task via npm link, or just symlink. These methods don't work,
when dependent package has difficult publish cycle (modifies it's source, e.g. using Babel/Rollup/etc)
or there are more then one.

Trust me, `npmy --link` covers all above mentioned tasks.

---

### Inline usage

```sh
# Before: `cd` to your project folder
npmy --link --pkg=tx-i18n --to=~/artifact-project/tx-i18n
```


### Development

 - `npm i`
 - `npm test`, [code coverage](./coverage/lcov-report/index.html)
