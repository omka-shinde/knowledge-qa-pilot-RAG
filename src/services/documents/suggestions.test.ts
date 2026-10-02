import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractQuestionsFromText, pickEvenly } from "./suggestions";

describe("extractQuestionsFromText", () => {
  it("keeps questions that appear in the document and drops statements", () => {
    const text = `
      Pomegranate plantation guide.
      What is the recommended spacing for pomegranate plantation?
      Rows are usually 4 to 5 metres apart.
      Q2. When should pomegranate fruits be harvested?
    `;

    assert.deepEqual(extractQuestionsFromText(text), [
      "What is the recommended spacing for pomegranate plantation?",
      "When should pomegranate fruits be harvested?",
    ]);
  });

  it("ignores fragments that are too short to be a prompt", () => {
    assert.deepEqual(extractQuestionsFromText("Why? Because the soil is dry."), []);
  });

  it("drops formula text that was glued onto the front of a question", () => {
    const text =
      "ZnSO4, MnSO4, and H3BO3 respectively. 4 4 Is EDTA chelate of Zn more effective than inorganic salt of Zn?";
    assert.deepEqual(extractQuestionsFromText(text), [
      "Is EDTA chelate of Zn more effective than inorganic salt of Zn?",
    ]);
  });
});

describe("pickEvenly", () => {
  it("spreads a long list down to four items", () => {
    assert.deepEqual(
      pickEvenly(["a", "b", "c", "d", "e", "f", "g"], 4),
      ["a", "c", "e", "g"],
    );
  });
});
