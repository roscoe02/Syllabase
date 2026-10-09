import { z } from "zod";

/** Structured results for the study tools that get their own UI. No nullable fields: the API caps unions at 16. */

export const Flashcards = z.object({
  cards: z.array(
    z.object({
      front: z.string().describe("The question"),
      back: z.string().describe("The answer"),
      common_wrong_answer: z.string().describe("The wrong answer students usually give, and why it's wrong"),
    }),
  ),
});
export type Flashcards = z.infer<typeof Flashcards>;

export const Quiz = z.object({
  questions: z.array(
    z.object({
      type: z.enum(["multiple_choice", "short_answer", "application"]),
      question: z.string(),
      options: z.array(z.string()).describe("4 options for multiple choice, empty otherwise"),
      correct_option: z.number().int().describe("Index of the correct option for multiple choice, -1 otherwise"),
      answer: z.string().describe("The correct answer, with a short explanation"),
      common_wrong_answer: z.string().describe("The wrong answer most students give, with one line on why"),
    }),
  ),
});
export type Quiz = z.infer<typeof Quiz>;
