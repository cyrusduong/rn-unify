import { ExecException, execSync } from "child_process";

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

function isPackageInstalled(pkg: string) {
  try {
    return execSync(`yarn list ${pkg}`, { encoding: "utf8" });
  } catch (error) {
    console.error("${pkg} is not installed");
  }
}

function getPackageList() {
  console.log("Getting packages in repo");
  const result = execSync("yarn list --json", { encoding: "utf8" });
  const parsed = JSON.parse(result);
  const packages = parsed.data.trees
    // .filter((pkg: { name: string; depth: number }) => pkg.depth === 0)
    .map((pkg: { name: string; depth: number }) => {
      const split = pkg.name.split("@");
      if (split[0] === "") return `@${split[1]}`; // Had leading @, add it back and return the name
      if (split[0] !== "") return split[0]; // No leading @, just reuturn name
    })
    .filter((v: string, i: number, array: string[]) => array.indexOf(v) === i); // unique

  console.log({ packages });

  return packages;
}

function why(pkg: string) {
  console.log(`Running yarn why for ${pkg}`);
  try {
    return execSync(`yarn why ${pkg}`, { encoding: "utf8" });
  } catch (error) {
    console.error(
      `Error finding reason for ${pkg}: ${(error as Error)?.message}`,
    );
  }
  console.log(`Finished yarn why for ${pkg}`);
}

const extentionsToCheck = ["js", "ts", "tsx", "kts", "java", "m", "h", "swift"];
const extGlob = extentionsToCheck.map((ext) => `"*.${ext}"`).join(" --glob ");
const rnModuleExpression =
  "ReactContextBaseJavaModule|RCTBridgeModule|ReactPackage|NativeModule";
function isRnPackage(pkgName: string) {
  // console.log(`Checking if ${pkgName} contains NativeModule code`);
  try {
    execSync(
      `rg --max-count=1 --no-ignore --glob ${extGlob} -e "${rnModuleExpression}" "node_modules/${pkgName}"`,
      { stdio: "ignore" },
    );
    return true;
  } catch (e) {
    const error = e as ExecException;
    // console.error(error.message);
    // if (error?.code === 1) return false; // in rg this is nothing found, but no failure
    return false;
  }
}

// Note: is this faster? Maybe reimplement and compare rather than using yarn list to search set of paths.
// function findRnPackages(pkgNames: string[]) {
//   console.log("Looking for packages with RN native modules");
//   const result = execSync(
//     `rg --files-with-matches --max-count=1 --no-ignore "ReactContextBaseJavaModule|RCTBridgeModule|ReactPackage|NativeModule" node_modules | cut -d'/' -f2 | sort | uniq`,
//   );
//   console.log("Found following packages in your project that needs checked:");
//   const rnPackages: string[] = result.toString().trimEnd().split("\n");
//   console.log(rnPackages);
//   return rnPackages;
// }

const list = getPackageList();
console.log({ list });

const rnPackages = list.filter(isRnPackage);
console.log({ rnPackages });

// const whys = rnPackages.map(why);
// console.log(whys);
