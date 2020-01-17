const months = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const weekdays = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

function convertNames(expression: string, names: { [name: string]: number }) {
  let result = expression;
  for (const [name, index] of Object.entries(names)) {
    result = result.replace(new RegExp(name, "gi"), index.toString());
  }
  return result;
}

const stepValuePattern = /^(.+)\/(\d+)$/;
function convertSteps(expression: string) {
  var match = stepValuePattern.exec(expression);

  if (match !== null && match.length > 0) {
    var values = match[1].split(",");
    const setpValues = [];
    const divider = parseInt(match[2], 10);

    for (const valueString of values) {
      const value = parseInt(valueString, 10);
      if (value % divider === 0) {
        setpValues.push(value);
      }
    }
    return setpValues.join(",");
  }

  return expression;
}

function replaceWithRange(
  expression: string,
  text: string,
  init: string,
  end: string
) {
  var numbers = [];
  var last = parseInt(end);
  var first = parseInt(init);

  if (first > last) {
    last = parseInt(init);
    first = parseInt(end);
  }

  for (var i = first; i <= last; i++) {
    numbers.push(i);
  }

  return expression.replace(new RegExp(text, "gi"), numbers.join());
}

function convertRange(expression: string) {
  let result = expression;
  var rangeRegEx = /(\d+)-(\d+)/;
  var match = rangeRegEx.exec(result);
  while (match !== null && match.length > 0) {
    result = replaceWithRange(result, match[0], match[1], match[2]);
    match = rangeRegEx.exec(result);
  }
  return result;
}

function expandWildcard(atom: string, expanded: string) {
  return atom.replace("*", expanded);
}

function parseAtom(atom: string) {
  return convertSteps(convertRange(atom))
    .split(",")
    .map(v => parseInt(v));
}

export type CronPattern = {
  minute: number[];
  hour: number[];
  day: number[];
  month: number[];
  dow: number[];
};

export default function parseCron(cron: string): CronPattern {
  const atoms = cron.split(" ");
  if (atoms.length > 5) {
    throw new Error(`Invalid cron entry: ${cron}`);
  }

  let minute = parseAtom(expandWildcard(atoms[0], "0-59"));
  let hour = parseAtom(expandWildcard(atoms[1], "0-23"));
  let day = parseAtom(expandWildcard(atoms[2], "1-31"));
  let month = parseAtom(expandWildcard(convertNames(atoms[3], months), "1-12"));
  let dow = parseAtom(
    expandWildcard(convertNames(atoms[4], weekdays), "0-6")
  ).map(dow => (dow === 7 ? 0 : dow));

  return { minute, hour, day, month, dow };
}
