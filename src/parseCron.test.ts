import parseCron from "./parseCron";

describe(parseCron, () => {
  it("parses single values", () => {
    const result = parseCron("0 10 1 6 5");

    expect(result).toEqual({
      minute: [0],
      hour: [10],
      day: [1],
      month: [6],
      dow: [5],
    });
  });

  it("converts single month names", () => {
    const result = parseCron("0 10 1 June 5");

    expect(result).toEqual({
      minute: [0],
      hour: [10],
      day: [1],
      month: [6],
      dow: [5],
    });
  });

  it("converts ranges of month names", () => {
    const result = parseCron("0 10 1 jun-aug 5");

    expect(result).toEqual({
      minute: [0],
      hour: [10],
      day: [1],
      month: [6, 7, 8],
      dow: [5],
    });
  });

  it("converts single weekday names", () => {
    const result = parseCron("0 10 1 6 Friday");

    expect(result).toEqual({
      minute: [0],
      hour: [10],
      day: [1],
      month: [6],
      dow: [5],
    });
  });

  it("converts ranges of weekday names", () => {
    const result = parseCron("0 10 1 6 mon-fri");

    expect(result).toEqual({
      minute: [0],
      hour: [10],
      day: [1],
      month: [6],
      dow: [1, 2, 3, 4, 5],
    });
  });

  it("parse multiple values", () => {
    const result = parseCron("0 10 1,15,30 6,8 5");

    expect(result).toEqual({
      minute: [0],
      hour: [10],
      day: [1, 15, 30],
      month: [6, 8],
      dow: [5],
    });
  });

  it("parse ranges", () => {
    const result = parseCron("0 10 1 6 1-5");

    expect(result).toEqual({
      minute: [0],
      hour: [10],
      day: [1],
      month: [6],
      dow: [1, 2, 3, 4, 5],
    });
  });

  it("parse ranges and individual values", () => {
    const result = parseCron("0 10,14-16 1 6 5");

    expect(result).toEqual({
      minute: [0],
      hour: [10, 14, 15, 16],
      day: [1],
      month: [6],
      dow: [5],
    });
  });

  it("parse minute wildcards", () => {
    const result = parseCron("* 10 1 6 5");

    expect(result).toEqual({
      minute: new Array(60).fill(0).map((_, i) => i),
      hour: [10],
      day: [1],
      month: [6],
      dow: [5],
    });
  });

  it("parse hour wildcards", () => {
    const result = parseCron("0 * 1 6 5");

    expect(result).toEqual({
      minute: [0],
      hour: [
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
        22,
        23,
      ],
      day: [1],
      month: [6],
      dow: [5],
    });
  });

  it("parse day wildcards", () => {
    const result = parseCron("0 10 * 6 5");

    expect(result).toEqual({
      minute: [0],
      hour: [10],
      day: new Array(31).fill(0).map((_, i) => i + 1),
      month: [6],
      dow: [5],
    });
  });

  it("parse month wildcards", () => {
    const result = parseCron("0 10 1 * 5");

    expect(result).toEqual({
      minute: [0],
      hour: [10],
      day: [1],
      month: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      dow: [5],
    });
  });

  it("parse weekday wildcards", () => {
    const result = parseCron("0 10 1 6 *");

    expect(result).toEqual({
      minute: [0],
      hour: [10],
      day: [1],
      month: [6],
      dow: [0, 1, 2, 3, 4, 5, 6],
    });
  });

  it("parse steps", () => {
    const result = parseCron("0 10 1 */2 5");

    expect(result).toEqual({
      minute: [0],
      hour: [10],
      day: [1],
      month: [2, 4, 6, 8, 10, 12],
      dow: [5],
    });
  });

  it("parse steps between", () => {
    const result = parseCron("0 10-18/2 1 6 5");

    expect(result).toEqual({
      minute: [0],
      hour: [10, 12, 14, 16, 18],
      day: [1],
      month: [6],
      dow: [5],
    });
  });

  it("normalizes sunday", () => {
    const result = parseCron("0 10 1 6 7");

    expect(result).toEqual({
      minute: [0],
      hour: [10],
      day: [1],
      month: [6],
      dow: [0],
    });
  });
});
