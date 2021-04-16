const {promisify} = require('util');
const bl = require('bl');
const spawn = require('await-spawn');
const fs = require('fs');

async function mine(soraldJar, source, statsFile) {
  try {
    await spawn(
      'java',
      [
        '-jar',
        soraldJar,
        "mine",
        "--source",
        source,
        "--stats-output-file",
        statsFile,
        "--handled-rules"
      ]
    );
  } catch (e) {
    console.log(e.stderr.toString());
    throw e;
  }

  const miningData = JSON.parse(await fs.promises.readFile(statsFile))
  const keyToSpecs = 
    miningData.minedRules.map(
      data => [
        data.ruleKey,
        data.warningLocations.map(loc => loc.violationSpecifier)
      ]);

  return new Map(keyToSpecs);
}

async function repair(soraldJar, source, statsFile, violationSpecs) {
  try {
    await spawn(
      'java',
      [
        '-jar',
        soraldJar,
        'repair',
        '--source',
        source,
        '--stats-output-file',
        statsFile,
        '--violation-specs',
        violationSpecs.join(','),
      ]
    );
  } catch (e) {
    console.log(e.stderr.toString());
    throw e;
  }

  const repairData = JSON.parse(await fs.promises.readFile(statsFile));
  return parseRepairedViolations(repairData);
}

async function restore(source) {
  try {
    await spawn(
      'git',
      [
        'restore',
        '.',
      ],
      {cwd: source},
    )
  } catch (e) {
    console.log(e.stderr.toString());
    throw e;
  }
}

function parseRepairedViolations(repairData) {
  ruleRepairs = repairData.repairs

  if (!ruleRepairs) {
    return [];
  } else {
    ruleRepairData = ruleRepairs[0];

    numSuccessfulRepairs = ruleRepairData.nbViolationsBefore - ruleRepairData.nbViolationsAfter;
    if (numSuccessfulRepairs > 0) {
      return ruleRepairData.performedRepairsLocations.map(loc => loc.violationSpecifier);
    } else {
      return [];
    }
  }
}

module.exports.mine = mine
module.exports.repair = repair
module.exports.restore = restore
