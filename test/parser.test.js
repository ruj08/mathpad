// Checks the plain-text -> LaTeX translator against known-good outputs.
// Run: npm test
const assert = require('assert');
const { toTex, toTexParts } = require('../src/mathparse.js');

const cases = [
  [
    "x^2 + 3x - 4 = 0",
    "x^{2} + 3x - 4 = 0"
  ],
  [
    "x = (-b +- sqrt(b^2 - 4ac))/(2a)",
    "x = \\frac{-b \\pm \\sqrt{b^{2} - 4a c}}{2a}"
  ],
  [
    "1/2x",
    "\\frac{1}{2x}"
  ],
  [
    "1/2 x",
    "\\frac{1}{2} x"
  ],
  [
    "dy/dx = 3x^2",
    "\\frac{d y}{d x} = 3x^{2}"
  ],
  [
    "d/dx (x^2) = 2x",
    "\\frac{d}{d x} (x^{2}) = 2x"
  ],
  [
    "d^2y/dx^2 + y = 0",
    "\\frac{d^{2}y}{d x^{2}} + y = 0"
  ],
  [
    "int x^2 dx",
    "\\int x^{2}\\,dx"
  ],
  [
    "int from 0 to 1 x^2 dx",
    "\\int_{0}^{1} x^{2}\\,dx"
  ],
  [
    "int_0^1 x^2 dx",
    "\\int_{0}^{1} x^{2}\\,dx"
  ],
  [
    "integral of sin(x) from 0 to pi dx",
    "\\int_{0}^{\\pi} \\sin(x)\\,dx"
  ],
  [
    "int e^(2x) dx = 1/2 e^(2x) + C",
    "\\int e^{2x}\\,dx = \\frac{1}{2} e^{2x} + C"
  ],
  [
    "sum i=1 to n i^2 = n(n+1)(2n+1)/6",
    "\\sum_{i = 1}^{n} i^{2} = \\frac{n(n + 1)(2n + 1)}{6}"
  ],
  [
    "sum_(k=0)^inf x^k/k!",
    "\\sum_{k = 0}^{\\infty} \\frac{x^{k}}{k!}"
  ],
  [
    "sum from n=1 to infinity of 1/n^2 = pi^2/6",
    "\\sum_{n = 1}^{\\infty} \\frac{1}{n^{2}} = \\frac{\\pi^{2}}{6}"
  ],
  [
    "lim x->0 sin(x)/x = 1",
    "\\lim_{x \\to 0} \\frac{\\sin(x)}{x} = 1"
  ],
  [
    "lim as x approaches 0 of (1-cos x)/x",
    "\\lim_{x \\to 0} \\frac{1 - \\cos x}{x}"
  ],
  [
    "lim_(h->0) (f(x+h) - f(x))/h",
    "\\lim_{h \\to 0} \\frac{f(x + h) - f(x)}{h}"
  ],
  [
    "lim x->0+ ln x",
    "\\lim_{x \\to 0^{+}} \\ln x"
  ],
  [
    "limit of sin x / x as x -> 0",
    "\\lim_{x \\to 0} \\frac{\\sin x}{x}"
  ],
  [
    "sin^2 x + cos^2 x = 1",
    "\\sin^{2} x + \\cos^{2} x = 1"
  ],
  [
    "sinx/x",
    "\\frac{\\sin x}{x}"
  ],
  [
    "log_2 8 = 3",
    "\\log_{2} 8 = 3"
  ],
  [
    "ln|x| + C",
    "\\ln \\left|x\\right| + C"
  ],
  [
    "e^(i pi) + 1 = 0",
    "e^{i \\pi} + 1 = 0"
  ],
  [
    "f'(x) = 2x",
    "f'(x) = 2x"
  ],
  [
    "|x - 1| < delta",
    "\\left|x - 1\\right| < \\delta"
  ],
  [
    "||v|| = sqrt(v_1^2 + v_2^2)",
    "\\left\\|v\\right\\| = \\sqrt{v_{1}^{2} + v_{2}^{2}}"
  ],
  [
    "a_(n+1) = 2a_n",
    "a_{n + 1} = 2a_{n}"
  ],
  [
    "x1 + x2 = 5",
    "x_{1} + x_{2} = 5"
  ],
  [
    "v_max",
    "v_{\\max}"
  ],
  [
    "F_net = m a",
    "F_{\\text{net}} = m a"
  ],
  [
    "theta = 30deg",
    "\\theta = 30^{\\circ}"
  ],
  [
    "x in RR",
    "x \\in \\mathbb{R}"
  ],
  [
    "{x | x > 0}",
    "\\{x \\mid x > 0\\}"
  ],
  [
    "P(A|B) = P(B|A)P(A)/P(B)",
    "P(A \\mid B) = \\frac{P(B \\mid A)P(A)}{P(B)}"
  ],
  [
    "[1, 2; 3, 4]",
    "\\begin{bmatrix}1 & 2 \\\\ 3 & 4\\end{bmatrix}"
  ],
  [
    "[[1,2],[3,4]]",
    "\\begin{bmatrix}1 & 2 \\\\ 3 & 4\\end{bmatrix}"
  ],
  [
    "A^-1",
    "A^{-1}"
  ],
  [
    "n choose k",
    "\\binom{n}{k}"
  ],
  [
    "partial f/partial x",
    "\\frac{\\partial f}{\\partial x}"
  ],
  [
    "vec(v) = <1, 2>",
    "\\vec{v} = \\left\\langle 1,\\; 2 \\right\\rangle"
  ],
  [
    "u dot v",
    "u \\cdot v"
  ],
  [
    "f(x) = {x^2 if x > 0; 0 otherwise}",
    "f(x) = \\begin{cases}x^{2} & \\text{if }x > 0 \\\\ 0 & \\text{otherwise}\\end{cases}"
  ],
  [
    "speed = distance/time",
    "\\text{speed} = \\frac{\\text{distance}}{\\text{time}}"
  ],
  [
    "cbrt(27) = 3",
    "\\sqrt[3]{27} = 3"
  ],
  [
    "root(4, 16) = 2",
    "\\sqrt[4]{16} = 2"
  ],
  [
    "abs(x-3)",
    "\\left| x - 3 \\right|"
  ],
  [
    "e^-x^2",
    "e^{-x^{2}}"
  ],
  [
    "x^2/3",
    "\\frac{x^{2}}{3}"
  ],
  [
    "2x/3",
    "\\frac{2x}{3}"
  ],
  [
    "a/b/c",
    "\\frac{\\frac{a}{b}}{c}"
  ],
  [
    "x <= 5 and x >= -2",
    "x \\le 5\\text{ and }x \\ge -2"
  ]
];

let failed = 0;
for (const [input, expected] of cases) {
  const got = toTex(input);
  if (got !== expected) { failed++; console.log('FAIL', JSON.stringify(input), '\n  expected', expected, '\n  got     ', got); }
}

// derivation rows split at the first relation so they can line up on '='
assert.deepStrictEqual(toTexParts('= x^2 + 1'), { lhs: '', rhs: '= x^{2} + 1', rel: true });
assert.deepStrictEqual(toTexParts('sum i=1 to n i = n(n+1)/2').lhs, '\\sum_{i = 1}^{n} i');

if (failed) { console.log(failed + ' of ' + cases.length + ' cases failed'); process.exit(1); }
console.log('All ' + cases.length + ' translator cases pass.');
