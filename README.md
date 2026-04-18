![logo](.github/image.png)

# MTRGen templates support - Syntax Highlighting and File Creation

[![GitHub issues](https://badgen.net/static/license/MIT/blue)](https://github.com/matronator/vscode-mtrgen-syntax/issues)
![GitHub: open issues](https://badgen.net/github/open-issues/matronator/vscode-mtrgen-syntax)
![GitHub: stars](https://badgen.net/github/stars/matronator/vscode-mtrgen-syntax)
![installs](https://badgen.net/vs-marketplace/i/matronator.mtrgen-syntax)
![downloads](https://badgen.net/vs-marketplace/d/matronator.mtrgen-syntax)
![rating](https://badgen.net/vs-marketplace/rating/matronator.mtrgen-syntax)

This extension provides syntax highlighting to template files for [MTRGen](https://mtrgen.matronator.cz) ([matronator/mtrgen-js](https://github.com/matronator/mtrgen-js)) templates. It also provides a command to create files from MTRGen templates.

## Features

- Syntax highlighting for MTRGen templates
- Snippets for MTRGen templates
- File creation from MTRGen templates
- Command to create files from MTRGen templates

## Create files from MTRGen templates

This extension adds a button to the file explorer and a coresponding command to create files from MTRGen templates. Just run the command `MTRGen: Create File from MTRGen Template` and select a template from the list. If you have no MTRGen templates, the extension will create a `.mtrgen` folder in your project root and prompt you to create a new template.

## Snippets

The extension provides common snippets for MTRGen templates. The following snippets are available:
REDřwrtqwcznrzkibu n'mtew
| Snippet                 | Description                                          | Example output                                                                                      |
|-------------------------|------------------------------------------------------|-----------------------------------------------------------------------------------------------------|
| `header`, `---`, `mtr`  | Creates MTRGen header block                          |  <pre>--- MTRGEN --- <br> name: foo <br> filename: bar <br> path: baz<br> --- /MTRGEN ---</pre>                |
| `if`                    | Creates an `if` statement block                      |  <pre><% if true %> <br> ... <br> <% endif %></pre>                                                            |
| `ifelseif`, `ifei`      | `if` statement block with `elseif` block             |  <pre><% if true %> <br> ... <br> <% elseif false %> <br> ... <br> <% endif %></pre>                           |
| `ifelse`, `ife`         | `if` statement block with an `else` block            |  <pre><% if true %> <br> ... <br> <% else %> <br> ... <br> <% endif %></pre>                                   |
| `ifelseifelse`, `ifeie` | `if` statement block with `elseif` and `else` blocks |  <pre><% if true %> <br> ... <br> <% elseif false %> <br> ... <br> <% else %> <br> ... <br> <% endif %></pre>  |
| `else`                  | `else` block                                         |  <pre><% else %> <br> ... <br> <% endif %></pre>                                                               |
| `elseif`, `elif`        | `elseif` block                                       |  <pre><% elseif false %> <br> ... <br> <% endif %></pre>                                                       |
| `comment`, `#`, `//`    | Comment block                                        |  <pre><# This is a comment #></pre>                                                                            |
| `for`                   | `for` loop block                                     |  <pre><% for item in items %> <br> ... <br> <% endfor %></pre>                                                 |
| `first`                 | `first` block                                        |  <pre><% first %> <br> ... <br> <% endfirst %></pre>                                                           |
| `last`                  | `last` block                                         |  <pre><% last %> <br> ... <br> <% endlast %></pre>                                                             |
| `sep`                   | `sep` block                                          |  <pre><% sep %> <br> ... <br> <% endsep %></pre>                                                               |
| `empty`                 | `empty` block                                        |  <% empty %> <br> ... <br> <% endempty %>                                                           |

## Supported languages

This extension adds language support for these languages natively or with support from third-party extensions:

- C
- C++
- C#
- Clarity
- CSS
- Dart
- Dockerfile
- Elixir
- Elm
- Erlang
- Gleam
- Go
- Haskell
- Haxe
- HTML
- Java
- JavaScript (including React)
- JSON
- Julia
- KDL
- Kotlin
- Less
- Lisp
- Lua
- Markdown
- Nim
- Objective-C
- OCaml
- Odin
- Perl
- PHP
- PowerShell
- Python
- Ruby
- Rust
- Scala
- SCSS
- Shellscript
- Solidity
- Swift
- Terraform
- TOML
- TypeScript (including React)
- XML
- YAML
- Zig

## License

This extension is released under the [MIT License](LICENSE).
