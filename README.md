# rn-unify - A magical react-native dependency resolver 🪄

<!--toc:start-->

- [rn-unify - A magical react-native dependency resolver 🪄](#rn-unify-a-magical-react-native-dependency-resolver-🪄wwww)
  - [Description](#description)
  - [Rationale](#rationale)
    - [Why not use a monorepo or workspaces?](#why-not-use-a-monorepo-or-workspaces)
    - [Isn't peer dependencies enough?](#isnt-peer-dependencies-enough)
  - [Examples](#examples)
  - [Usage](#usage)
  - [How it works](#how-it-works)
  - [Caveats](#caveats)
  <!--toc:end-->

## Description

> Warning: This project only supports the `yarn` package manager at the moment.
> I may update this to support other package managers if there is enough interest.

rn-unify (React Native Unify) is a CLI tool to help identify conflicting
react native packages within an iOS, Android, or RN project, when consuming
multiple component libraries and attempt to resolve (unify) package versions.

## Rationale

We developed this tool to help automate the resolutions of packages between
our component library and our consuming native application which has implemented
the react native framework.

### Why not use a monorepo or workspaces?

There are many tools provide the ability to align dependencies within workspaces
or using a monorepo structure. If this is a possibility, by all means, this project
serves as a band-aid for teams in an in-between state or one without plans to fully
build a RN application along side a RN component library.

There are times where a rewrite or re-scaffolding of a project does takes tremendous
effort and planning. In the mean time there may be needs to export components
and be consumable within certain portions of legacy or native application are still
supported.

### Isn't peer dependencies enough?

While teams and most projects often list peer dependencies within react-native projects
I've experienced that without clear instruction and without some automation,
the warning of mismatched or required versions can be locked, become outdated,
or simply ignored.

The consuming team may forget to align version, someone might accidentally upgrade,
or even nuke the lock files (yarn.lock, package-lock.json, etc).

This leads to mismatching versions of the RN dependency and underlying native module.

## Examples

Below are a few examples of when you might want to consider this package.

- Multiple RN teams/components consumed into a native _shell_ application
- Differing react native animation libraries and wrappers
- Payment processors webview and/or iframe implementations
- Geolocation services or libraries

## Usage

This project is intended to be run as a post install script
within the `package.json`.

```json
{
  "scripts": {
    "postinstall": "rn-unify"
  }
}
```

## How it works

The process to determine and identify RN dependencies which have native modules is straight-forward

1. Identify dependencies using search and AST parsing for native modules
1. Gather a list of dependencies which are duplicated via `yarn list`
1. Identify the newest version of the duplicated modules
1. Add or update a "resolutions" field within the `package.json` to enforce only
   one version of a dependency to install, repeat remaining duplicates found.
1. Re-run yarn install to fix auto linking of modules to the RN or native application.

## Caveats

This project has only been tested internally within my workplace. Please see the
Licence within this repository to understand the limitations and risks of using
this software.
