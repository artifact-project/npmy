NPMy
----
`npm link` on steroids.

```
npm install -g npmy
```

### Usage

 0. `npm install -g npmy`
 1. `cd path/to/project`
 2. Add `.npmyrc` to `.gitignore`
 3. `touch .npmyrc`
 4. Edit `.npmyrc`, a`{"%TARGET_DEPENDENCY%": "%LOCAL_PATH_TO_PACKAGE_FOLDER%"}`
 5. `npmy`
 6. ...
 7. Profit!


### Description of work

`npmy` — это инструмент для локальной разработки пакетов, в зависимостях которых
так же есть пакеты находящиеся в разработке. Обычно эту задачу решаю через создание
сим-линка или использованием `npm link`, но эти способы не работают, когда зависимый
пакет имеет сложный цикл публикации (модифицирует свой исходный код, например
использует транспилер) или их больше чем один...
<br/>

`npmy` решает все эти проблемы, поверьте мне!


### Todo

 - [ ] Revert after exit


### Development

 - `npm i`
 - `npm test`, [code coverage](./coverage/lcov-report/index.html)
