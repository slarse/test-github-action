const core = require("@actions/core");
const github = require("@actions/github");
const fs = require("fs");
const got = require("got");
const stream = require("stream");
const {promisify} = require("util");

const sorald = require('./sorald');

const pipeline = promisify(stream.pipeline);

async function download(url, dst) {
  return pipeline(
    got.stream(url),
    fs.createWriteStream(dst)
  );
}

async function runSorald(source, soraldJarUrl, ) {
  const jarDstPath = "sorald.jar"

  console.log(`Downloading Sorald jar to ${jarDstPath}`);
  await download(soraldJarUrl, jarDstPath);
  console.log(`Mining rule violations at ${source}`);
  keyToSpecs = await sorald.mine(jarDstPath, source, "stats.json");

  console.log('Found rule violations');

  console.log('Attempting repairs');
  const performedRepairs = Array.from(keyToSpecs.entries()).flatMap(async function(subArray) {
    const [ruleKey, violationSpecs] = subArray;
    console.log(`Repairing violations of rule ${ruleKey}: ${violationSpecs}`);
    const statsFile = `${ruleKey}.json`;
    const repairs = await sorald.repair(jarDstPath, source, statsFile, violationSpecs);
    sorald.restore(source);
    return repairs;
  });

  return (await Promise.all(performedRepairs)).flatMap(e => e);
}

try {
  const source = core.getInput('source');
  const soraldJarUrl = core.getInput('sorald-jar-url')
  runSorald(source, soraldJarUrl).then(repairedViolations => {
    if (repairedViolations.length > 0) {
      core.setFailed(`Found repairable violations ${repairedViolations.join(' ')}`)
    }
  });
} catch (error) {
  core.setFailed(error.message);
}
