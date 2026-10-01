import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  buildSearchableContent,
  isNoiseLine,
  matchSectionHeading,
  normalizeQuestionKey,
  normalizeWhitespace,
} from "./normalizer";
import { parseAnnotatedLines, parsePdf } from "./pdf-parser";
import { validateKnowledgeRecords } from "./validator";

describe("normalizer", () => {
  it("strips FAQ number labels and bare page numbers as noise", () => {
    assert.equal(isNoiseLine("Q31."), true);
    assert.equal(isNoiseLine("6"), true);
    assert.equal(isNoiseLine("-- 1 of 5 --"), true);
    assert.equal(isNoiseLine("Has NRCP released any new variety?"), false);
  });

  it("extracts Roman-numeral section headings", () => {
    assert.equal(
      matchSectionHeading("IV. SOIL AND NUTRITION"),
      "IV. SOIL AND NUTRITION",
    );
    assert.equal(matchSectionHeading("Not a heading"), null);
  });

  it("normalizes whitespace and question keys", () => {
    assert.equal(normalizeWhitespace("  a   b\nc  "), "a b c");
    assert.equal(
      normalizeQuestionKey("What is spacing?"),
      normalizeQuestionKey("what is spacing"),
    );
  });

  it("builds searchable content from question and answer", () => {
    assert.equal(
      buildSearchableContent("Q text?", "A text."),
      "Q text? A text.",
    );
  });
});

describe("parseAnnotatedLines", () => {
  it("extracts normal Q&A pairs with page tracking", () => {
    const { records, issues } = parseAnnotatedLines("sample.pdf", [
      { text: "Has NRCP released any new variety of pomegranates?", page: 1 },
      {
        text: "Two hybrid varieties 'Solapur Lal' have been released in 2017.",
        page: 1,
      },
      { text: "How is Super Bhagwa different from Bhagwa?", page: 1 },
      { text: "Super Bhagwa matures 15-20 days early.", page: 1 },
    ]);

    assert.equal(issues.length, 0);
    assert.equal(records.length, 2);
    assert.equal(
      records[0]?.question,
      "Has NRCP released any new variety of pomegranates?",
    );
    assert.match(records[0]?.answer ?? "", /Solapur Lal/);
    assert.equal(records[0]?.sourcePage, 1);
    assert.equal(records[0]?.sourceDocument, "sample.pdf");
  });

  it("keeps compound questions with multiple question marks as one record", () => {
    const { records } = parseAnnotatedLines("sample.pdf", [
      {
        text: "Is Wonderful better than Bhagwa? Is it resistant to bacterial blight?",
        page: 1,
      },
      {
        text: "Wonderful is not suitable for Indian markets.",
        page: 1,
      },
    ]);

    assert.equal(records.length, 1);
    assert.match(records[0]?.question ?? "", /bacterial blight/);
  });

  it("captures section/category and continues answers across pages", () => {
    const { records } = parseAnnotatedLines("sample.pdf", [
      { text: "How can we increase Calcium (Ca) content in fruit?", page: 3 },
      { text: "In calcareous soil", page: 3 },
      { text: "1. Apply farmyard manure.", page: 3 },
      { text: "IV. SOIL AND NUTRITION", page: 3 },
      { text: "2. Apply elemental S @ 20-30 g per plant.", page: 4 },
      { text: "Can we apply Calcium and Boron together?", page: 4 },
      { text: "Apply boron via foliar spray.", page: 4 },
    ]);

    assert.equal(records.length, 2);
    assert.match(records[0]?.answer ?? "", /elemental S/);
    assert.equal(records[0]?.sourcePage, 3);
    assert.equal(records[1]?.category, "IV. SOIL AND NUTRITION");
  });

  it("completes Tell-me prompts that end with a period and splits the next question", () => {
    const { records } = parseAnnotatedLines("sample.pdf", [
      {
        text: "Tell me easiest way to understand the type of soil I have and methods to rectify the problematic soils.",
        page: 3,
      },
      { text: "Moistened the soil slightly and roll it into a ball.", page: 3 },
      { text: "What is the proper method for fertilizer application?", page: 3 },
      { text: "Apply fertilizers in ring during rainy season.", page: 3 },
    ]);

    assert.equal(records.length, 2);
    assert.match(records[0]?.question ?? "", /^Tell me easiest way/);
    assert.match(records[0]?.answer ?? "", /Moistened the soil/);
    assert.equal(
      records[1]?.question,
      "What is the proper method for fertilizer application?",
    );
  });

  it("ignores OCR subscript digits trailing a question mark", () => {
    const { records } = parseAnnotatedLines("sample.pdf", [
      {
        text: "Is EDTA chelate of Zn more effective than inorganic salt of Zn (ZnSO )? 4",
        page: 4,
      },
      { text: "No, foliar application of inorganic salt of Zn is more effective.", page: 4 },
      { text: "Is slurry application beneficial?", page: 4 },
      { text: "Slurry application is highly beneficial.", page: 4 },
    ]);

    assert.equal(records.length, 2);
    assert.match(records[0]?.question ?? "", /EDTA chelate/);
    assert.doesNotMatch(records[0]?.question ?? "", /\b4$/);
    assert.equal(records[1]?.question, "Is slurry application beneficial?");
  });

  it("keeps multi-line questions that continue with should/what clauses", () => {
    const { records } = parseAnnotatedLines("sample.pdf", [
      {
        text: "I have applied all nutrients still the fruit size is not increasing. The skin appears hard. What",
        page: 4,
      },
      { text: "should I do to?", page: 4 },
      {
        text: "Sometimes, fruit skin get hardened due to excessive use of copper.",
        page: 4,
      },
    ]);

    assert.equal(records.length, 1);
    assert.match(records[0]?.question ?? "", /should I do to\?$/);
    assert.match(records[0]?.answer ?? "", /fruit skin/);
  });

  it("reports unassigned prose instead of silently dropping it", () => {
    const { records, issues } = parseAnnotatedLines("sample.pdf", [
      { text: "Random preface text without a question.", page: 1 },
      { text: "What is spacing?", page: 1 },
      { text: "4.5 m x 3 m.", page: 1 },
    ]);

    assert.equal(records.length, 1);
    assert.equal(issues.length, 1);
    assert.match(issues[0]?.message ?? "", /Unassigned text/);
  });
});

describe("validateKnowledgeRecords", () => {
  it("flags empty answers as invalid", () => {
    const result = validateKnowledgeRecords([
      {
        question: "What is spacing?",
        answer: "   ",
        category: null,
        sourceDocument: "a.pdf",
        sourcePage: 1,
      },
    ]);

    assert.equal(result.valid.length, 0);
    assert.equal(result.invalid.length, 1);
    assert.match(result.invalid[0]?.reason ?? "", /Answer is empty/);
  });

  it("detects duplicate questions via normalized key", () => {
    const result = validateKnowledgeRecords([
      {
        question: "What is spacing?",
        answer: "4.5 m x 3 m",
        category: null,
        sourceDocument: "a.pdf",
        sourcePage: 1,
      },
      {
        question: "what is spacing?",
        answer: "Same answer",
        category: null,
        sourceDocument: "a.pdf",
        sourcePage: 2,
      },
    ]);

    assert.equal(result.valid.length, 1);
    assert.equal(result.duplicates.length, 1);
  });
});

describe("parsePdf against real FAQ PDF", () => {
  it("extracts Q&A records from the provided English FAQ PDF", async () => {
    const faq = fs
      .readdirSync(process.cwd())
      .find(
        (name) =>
          name.toLowerCase().endsWith(".pdf") &&
          name.toLowerCase().includes("faq"),
      );

    assert.ok(faq, "FAQ PDF should exist in the repository root");

    const result = await parsePdf(path.join(process.cwd(), faq));
    assert.equal(result.pageCount, 5);
    assert.ok(
      result.records.length >= 32,
      `expected ~33 Q&A pairs, got ${result.records.length}`,
    );

    for (const record of result.records) {
      assert.ok(record.question.length > 0, "question should be non-empty");
      assert.ok(record.answer.length > 0, "answer should be non-empty");
      assert.equal(record.sourceDocument, faq);
      assert.ok(
        record.sourcePage === null || record.sourcePage >= 1,
        "source page should be valid",
      );
    }

    const validated = validateKnowledgeRecords(result.records);
    assert.equal(validated.invalid.length, 0);
    assert.ok(validated.valid.length >= 32);
  });

  it("finds no Q&A pairs in Pilot project.pdf", async () => {
    const pilot = path.join(process.cwd(), "Pilot project.pdf");
    assert.ok(fs.existsSync(pilot));

    const result = await parsePdf(pilot);
    assert.equal(result.pageCount, 1);
    assert.equal(result.records.length, 0);
  });
});
