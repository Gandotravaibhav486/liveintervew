// Hand-written transcripts for the same real question, built to separate
// two things every real corpus case conflates: how good the CONTENT is and
// how fluent the DELIVERY is. In the live data those move together -
// students who ramble also tend to be wrong - so a model could score purely
// on fluency and look correct on all 50 cases.
//
// The fluent-but-wrong preset is the one AGENTS.md asks for by name and the
// corpus does not contain. It is confidently delivered, well structured,
// and technically incorrect (it describes an O(n) space hash-set walk while
// CLAIMING it is O(1) space Floyd's, and asserts the pointers meet at the
// head of the cycle, which is not what the algorithm guarantees). A scorer
// that rewards polish will rate it highly; a scorer actually grounding
// against reference_answer should mark content_relevance down hard while
// leaving delivery high. The gap between those two numbers IS the measurement.

export interface PresetTranscript {
  id: string;
  label: string;
  note: string;
  questionText: string;
  referenceAnswer: string;
  transcript: string;
}

const QUESTION = "How would you detect a cycle in a linked list?";
const REFERENCE =
  "Use Floyd's cycle detection (slow/fast pointer): advance a slow pointer one step and a fast pointer two steps; if they meet, a cycle exists. This runs in O(n) time and O(1) space, compared to O(n) space with a hash set of visited nodes.";

export const PRESETS: PresetTranscript[] = [
  {
    id: "strong",
    label: "Strong — correct + fluent",
    note: "Correct algorithm, clear structure, states complexity and the tradeoff. Expect high content AND high clarity.",
    questionText: QUESTION,
    referenceAnswer: REFERENCE,
    transcript:
      "The standard approach is Floyd's cycle detection, often called the tortoise and hare. " +
      "I'd keep two pointers, both starting at the head. The slow pointer advances one node at a time, " +
      "the fast pointer advances two. If the list terminates, the fast pointer hits null and I return false. " +
      "If there's a cycle, the fast pointer eventually laps the slow one and they land on the same node, " +
      "which tells me a cycle exists. That's O(n) time and O(1) extra space, which is the reason I'd pick it " +
      "over the more obvious alternative of walking the list and storing every node I've seen in a hash set. " +
      "The hash set version is easier to explain and also O(n) time, but it costs O(n) space. " +
      "If the interviewer also wanted the entry point of the cycle, I'd reset one pointer to the head after " +
      "they meet and advance both one step at a time, and the node where they meet again is where the cycle starts.",
  },
  {
    id: "fluent-wrong",
    label: "Fluent but WRONG — the key control",
    note: "Confident, articulate, well structured, and technically incorrect (claims O(1) space while describing a hash set; wrong claim about where pointers meet). Content should drop, delivery should stay high.",
    questionText: QUESTION,
    referenceAnswer: REFERENCE,
    transcript:
      "So this is a classic one, and the algorithm you want here is Floyd's cycle detection. " +
      "The way it works is you traverse the list once, and at each node you record that you've visited it, " +
      "so you keep a running record of every node you've already seen. Then at each step you check whether " +
      "the current node is already in that record. If it is, you've found your cycle, and if you reach a null " +
      "pointer then the list is acyclic and you return false. The elegance of Floyd's is that it does all of " +
      "this in constant space, O(1), because you're not really storing the list itself, just the references, " +
      "which is why it's strictly better than the two-pointer approaches people sometimes reach for. " +
      "It's O(n) time and O(1) space. And one nice property is that when the algorithm terminates, the pointer " +
      "always lands exactly on the first node of the cycle, so you get the entry point of the loop for free " +
      "without any additional traversal. That's why it's the standard answer for this question.",
  },
  {
    id: "weak-rambling",
    label: "Weak — partially right, rambling",
    note: "Gets to the right idea eventually through filler and false starts. Closest to the real corpus. Both content and clarity should be mid-to-low.",
    questionText: QUESTION,
    referenceAnswer: REFERENCE,
    transcript:
      "Okay so, cycle in a linked list, um. So the thing is a linked list normally just ends right, you get to " +
      "the end and there's a null. But if there's a cycle then it kind of, it loops back on itself so you'd just " +
      "keep going forever. So you need some way to, to catch that. One way, I think the simple way, is you just " +
      "keep track of what you've seen. Like a set or something. And then if you see it again you know. " +
      "But that takes up space obviously. There's also the, I think there's two pointers involved, one goes " +
      "faster than the other one? And they, at some point they'd have to meet if it's looping, because one is " +
      "catching up to the other. I don't remember exactly how many steps each one takes, I think one is two and " +
      "one is one but I'd have to think about it. That one's better for space I'm fairly sure. So probably I'd " +
      "go with that one in an interview.",
  },
  {
    id: "empty",
    label: "Near-empty — negative control",
    note: "Almost no signal. Every model should score low across the board; anything scoring this well is confabulating.",
    questionText: QUESTION,
    referenceAnswer: REFERENCE,
    transcript: "Um, I think you'd use a pointer? Sorry, I don't really remember this one.",
  },
];
