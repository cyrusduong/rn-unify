import yargs from "yargs";
import { hideBin } from "yargs/helpers";

function splitVersion(version: string) {
  return version.split(".").map(Number);
}

function getNewerVersion(a: string, b: string) {
  const aParts = splitVersion(a);
  const bParts = splitVersion(b);

  for (let i = 0; i < aParts.length; i++) {
    if (aParts[i] > bParts[i]) return a;
    if (aParts[i] < bParts[i]) return b;
  }

  return a; // If they are the same, return the first
}

function newestVersionFromList(versions: string[]) {
  let newVersion = versions[0];
  for (let i = 1; i < versions.length; i++) {
    newVersion = getNewerVersion(newVersion, versions[i]);
  }
  return newVersion;
}

function resolveConflicts({
  packageName,
  versions,
}: {
  packageName: string;
  versions: string[];
}) {
  let newVersion = newestVersionFromList(versions);
  console.log(
    `Resolved conflict for ${packageName}. Using version ${newVersion}`,
  );
}

yargs(hideBin(process.argv))
  .command(
    "resolve <pkg> <version1> <version2>",
    "Resolve package version conflicts",
    (yargs) => {
      return yargs
        .positional("pkg", {
          describe: "Pacakge Name",
          type: "string",
          demandOption: true,
        })
        .positional("version1", {
          describe: "First version",
          type: "string",
          demandOption: true,
        })
        .positional("version2", {
          describe: "Second version",
          type: "string",
          demandOption: true,
        });
      // .array("versionN");
    },
    (argv) => {
      resolveConflicts({
        packageName: argv.pkg as string,
        versions: [
          argv.version1,
          argv.version2,
          // ...(argv.versionN as string[]),
        ] as string[],
      });
    },
  )
  .help().argv;
