// Plain-text math -> LaTeX translator.
// Usage: MathParse.toTex("int from 0 to 1 x^2 dx")  ->  "\int_{0}^{1} x^{2}\,dx"
(function (root) {
  'use strict';

  // ---------- vocabulary ----------
  const GREEK = ['alpha','beta','gamma','delta','epsilon','varepsilon','zeta','eta','theta','vartheta','iota','kappa','lambda','mu','nu','xi','pi','varpi','rho','varrho','sigma','varsigma','tau','upsilon','phi','varphi','chi','psi','omega',
    'Gamma','Delta','Theta','Lambda','Xi','Pi','Sigma','Upsilon','Phi','Psi','Omega'];
  const STD_FUNCS = ['sin','cos','tan','sec','csc','cot','arcsin','arccos','arctan','sinh','cosh','tanh','coth','ln','log','exp','det','max','min','gcd','arg','dim','ker','Pr','sup'];
  const OP_FUNCS = { sech:'sech', csch:'csch', arcsec:'arcsec', arccsc:'arccsc', arccot:'arccot', lcm:'lcm', sgn:'sgn', sign:'sgn', tr:'tr', rank:'rank', proj:'proj', span:'span', Var:'Var', Cov:'Cov', E:null };
  const FUNC_ALIASES = { sine:'sin', cosine:'cos', tangent:'tan', arcsine:'arcsin', arccosine:'arccos', arctangent:'arctan', asin:'arcsin', acos:'arccos', atan:'arctan' };

  const SYMBOLS = {
    infinity:'\\infty', infty:'\\infty', inf:'\\infty', oo:'\\infty',
    nabla:'\\nabla', grad:'\\nabla', partial:'\\partial', del:'\\partial',
    forall:'\\forall', exists:'\\exists', emptyset:'\\varnothing', empty:'\\varnothing',
    hbar:'\\hbar', ell:'\\ell', eps:'\\varepsilon', cdots:'\\cdots', ldots:'\\ldots',
    angle:'\\angle', triangle:'\\triangle', degree:'^{\\circ}',
    RR:'\\mathbb{R}', ZZ:'\\mathbb{Z}', NN:'\\mathbb{N}', QQ:'\\mathbb{Q}', CC:'\\mathbb{C}',
    therefore:'\\therefore', because:'\\because',
  };
  // infix relations written as words
  const REL_WORDS = {
    in:'\\in', notin:'\\notin', subset:'\\subset', subseteq:'\\subseteq', supset:'\\supset', supseteq:'\\supseteq',
    approx:'\\approx', propto:'\\propto', implies:'\\implies', iff:'\\iff', equiv:'\\equiv', to:'\\to',
    approaches:'\\to', perp:'\\perp', parallel:'\\parallel', neq:'\\neq', leq:'\\leq', geq:'\\geq', sim:'\\sim',
    congruent:'\\cong', cong:'\\cong',
  };
  // infix binary operators written as words
  const BIN_WORDS = { times:'\\times', cross:'\\times', xx:'\\times', div:'\\div', cdot:'\\cdot',
    union:'\\cup', cup:'\\cup', intersect:'\\cap', cap:'\\cap', mod:'\\bmod', setminus:'\\setminus', circ:'\\circ', compose:'\\circ', oplus:'\\oplus', otimes:'\\otimes' };
  // English connecting words -> upright text
  const TEXT_WORDS = new Set(['and','or','if','for','where','when','then','else','otherwise','such','that','so','is','are','all','each','every','some','with','let','given','since','but','not','also','thus','hence','at','on','by','the','be','we','have','get','gives','means','as','of','from','except','only','unless','both','either','neither','nor','it','this','which','true','false','undefined','dne','DNE']);
  const ENGLISH_EXCEPTIONS = new Set(['cost','costs','since','logic','logo','login','expect','expected','exponent','exponents','express','line','lines','sink','single','tank','tangents','define','defined','definition','sincere','cosmic','cosmos','linear','solve','solution','answer','note','step','case','cases','value','values','total','area','volume','rate','speed','time','mass','force','energy','work','power','length','width','height','base','side','sides','price','profit','revenue','distance','velocity','position','acceleration','density','pressure','current','voltage','charge','temp','temperature','opp','adj','hyp','net','avg','tot','init','final','initial']);
  const ACCENTS = { vec:'\\vec', hat:'\\hat', bar:'\\overline', overline:'\\overline', tilde:'\\tilde', ddot:'\\ddot', underline:'\\underline', bold:'\\mathbf', bb:'\\mathbb', cal:'\\mathcal' };

  const GREEK_SET = new Set(GREEK);
  const FUNC_SET = new Set(STD_FUNCS);
  const isFuncWord = w => FUNC_SET.has(w) || (w in OP_FUNCS && OP_FUNCS[w]) || (w in FUNC_ALIASES);
  const funcTex = w => {
    if (w in FUNC_ALIASES) w = FUNC_ALIASES[w];
    if (FUNC_SET.has(w)) return '\\' + w;
    return '\\operatorname{' + OP_FUNCS[w] + '}';
  };
  const BIG_WORDS = new Set(['sum','prod','product','int','integral','integrate','iint','iiint','oint','lim','limit']);
  const SPECIAL_FUNCS = new Set(['sqrt','cbrt','root','abs','norm','floor','ceil','binom','frac','dot']);

  // words allowed when splitting run-together letters, e.g. "sinx" -> sin x, "dtheta" -> d theta
  const SEG_WORDS = [...FUNC_SET, 'sqrt', ...GREEK.filter(g => g.length >= 3)].sort((a, b) => b.length - a.length);

  // ---------- tokenizer ----------
  const MULTI_OPS = ['<=>', '<->', '->', '=>', '<=', '>=', '!=', '/=', '~=', '+-', '-+', '...', '**', ':=', '||', '==', '<<', '>>'];
  const SINGLE = '+-*/^_=<>!\',;:~|()[]{}%&.';

  function tokenize(s) {
    const toks = [];
    let i = 0, sp = false;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { sp = true; i++; continue; }
      let tok = null;
      if (c === '"') {
        const j = s.indexOf('"', i + 1);
        const end = j < 0 ? s.length : j;
        tok = { t: 'str', v: s.slice(i + 1, end) };
        i = j < 0 ? s.length : j + 1;
      } else if (c === '\\') {
        // raw LaTeX passthrough: \command plus any directly attached {...} groups
        let j = i + 1;
        if (/[A-Za-z]/.test(s[j] || '')) { while (j < s.length && /[A-Za-z]/.test(s[j])) j++; }
        else j++;
        while (s[j] === '{' || s[j] === '[') {
          const open = s[j], close = open === '{' ? '}' : ']';
          let depth = 0, k = j;
          for (; k < s.length; k++) { if (s[k] === open) depth++; else if (s[k] === close) { depth--; if (depth === 0) break; } }
          j = Math.min(k + 1, s.length);
        }
        tok = { t: 'raw', v: s.slice(i, j) };
        i = j;
      } else if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1] || ''))) {
        const m = /^[0-9]*\.?[0-9]+|^[0-9]+/.exec(s.slice(i));
        let v = m[0];
        // keep "3." from swallowing a trailing period
        tok = { t: 'num', v };
        i += v.length;
      } else if (/[A-Za-z]/.test(c)) {
        let j = i; while (j < s.length && /[A-Za-z]/.test(s[j])) j++;
        tok = { t: 'id', v: s.slice(i, j) };
        i = j;
      } else {
        const m = MULTI_OPS.find(op => s.startsWith(op, i));
        if (m) { tok = { t: 'op', v: m }; i += m.length; }
        else if (SINGLE.includes(c)) { tok = { t: 'op', v: c }; i++; }
        else { tok = { t: 'sym', v: c }; i++; }
      }
      tok.sp = sp; sp = false;
      toks.push(tok);
    }
    for (let k = 0; k < toks.length; k++) toks[k].spAfter = k + 1 < toks.length ? toks[k + 1].sp : true;
    return toks;
  }

  // ---------- word handling ----------
  function segment(word) {
    // split a run of letters into known words + single letters
    const out = [];
    let i = 0;
    while (i < word.length) {
      const w = SEG_WORDS.find(k => word.startsWith(k, i));
      if (w) { out.push(w); i += w.length; }
      else { out.push(word[i]); i++; }
    }
    return out;
  }
  function wordTex(word, inSub) {
    // a plain identifier (not a function / big operator / keyword)
    if (GREEK_SET.has(word)) return '\\' + word;
    if (word in SYMBOLS) return SYMBOLS[word];
    if (word.length === 1) return word;
    if (ENGLISH_EXCEPTIONS.has(word.toLowerCase())) return '\\text{' + word + '}';
    const segs = segment(word);
    const singles = segs.filter(x => x.length === 1).length;
    const hasKnown = segs.some(x => x.length > 1);
    if ((singles >= 3 && word.length >= 4) || (!hasKnown && word.length >= (inSub ? 3 : 4))) return '\\text{' + word + '}';
    return segs.map(x => x.length === 1 ? x : '\\' + x).join(' ');
  }

  const ESC = { '#': '\\#', '$': '\\$', '%': '\\%', '&': '\\&', '{': '\\{', '}': '\\}', '~': '\\sim', '^': '\\hat{}', '_': '\\_', '\\': '\\backslash' };
  const esc = s => s.replace(/[#$%&{}~^_\\]/g, c => ESC[c]);
  const textEsc = s => s.replace(/[#$%&{}~^_\\]/g, c => '\\' + (c === '\\' ? 'backslash ' : c)).replace(/\\~/g, '\\textasciitilde ').replace(/\\\^/g, '\\textasciicircum ');

  const REL_OPS = { '=': '=', '<': '<', '>': '>', '<=': '\\le', '>=': '\\ge', '!=': '\\ne', '/=': '\\ne', '~=': '\\approx', '~': '\\sim', '->': '\\to', '=>': '\\Rightarrow', '<=>': '\\iff', '<->': '\\leftrightarrow', ':=': '\\mathrel{:=}', '==': '\\equiv', '<<': '\\ll', '>>': '\\gg' };

  const TALL = /\\frac|\\dfrac|\\sum|\\int|\\prod|\\begin|\\sqrt|\\lim|\\binom|\\iint|\\oint/;
  const wrap = (open, inner, close) => {
    if (TALL.test(inner)) return '\\left' + open + ' ' + inner + ' \\right' + close;
    return open + inner + close;
  };
  const brace = t => '{' + t + '}';

  // ---------- parser ----------
  class Parser {
    constructor(toks) { this.toks = toks; this.i = 0; }
    peek(k = 0) { return this.toks[this.i + k]; }
    next() { return this.toks[this.i++]; }
    end() { return this.i >= this.toks.length; }
    isOp(tok, v) { return tok && tok.t === 'op' && (v === undefined || tok.v === v); }
    isId(tok, v) { return tok && tok.t === 'id' && (v === undefined || (Array.isArray(v) ? v.includes(tok.v) : tok.v === v)); }

    // ---- top level: expressions separated by relations, commas, words ----
    statement(stop, rec) {
      const parts = [];
      let guard = 0;
      while (!this.end() && guard++ < 5000) {
        const t = this.peek();
        if (stop && stop(t)) break;
        if (t.t === 'op' && t.v === '<' && this.angleAhead(t)) { parts.push(this.expr(stop)); continue; }
        if (t.t === 'op' && t.v in REL_OPS) {
          this.next();
          if (rec && rec.k === undefined && t.v !== '->' && t.v !== '<->') rec.k = parts.length;
          parts.push(' ' + REL_OPS[t.v] + ' '); continue;
        }
        if (t.t === 'op' && t.v === ':' ) { this.next(); parts.push(' : '); continue; }
        if (t.t === 'op' && t.v === ',') { this.next(); parts.push(',\\; '); continue; }
        if (t.t === 'op' && t.v === ';') { this.next(); parts.push(';\\quad '); continue; }
        if (t.t === 'op' && t.v === '|' && !this.canStartAtom(t)) { this.next(); parts.push(' \\mid '); continue; }
        if (t.t === 'op' && t.v === '...') { this.next(); parts.push('\\ldots '); continue; }
        if (t.t === 'id' && t.v in REL_WORDS ) { this.next(); parts.push(' ' + REL_WORDS[t.v] + ' '); continue; }
        if (t.t === 'id' && TEXT_WORDS.has(t.v)) { this.next(); parts.push('\\text{ ' + t.v + ' }'); continue; }
        if (this.canStartExpr(t)) { const before = this.i; parts.push(this.expr(stop)); if (this.i === before) { this.next(); parts.push(this.literal(t)); } continue; }
        // stray token: show it literally
        this.next();
        parts.push(this.literal(t));
      }
      if (rec) rec.parts = parts;
      return parts.join('').replace(/\s+/g, ' ').trim();
    }

    literal(t) {
      if (t.t === 'op') {
        const map = { ')': ')', ']': ']', '}': '\\}', '(': '(', '[': '[', '{': '\\{', '|': '|', '||': '\\|', '^': '\\hat{}', '_': '\\_', '%': '\\%', '&': '\\&', '/': '/', '*': '\\ast', '!': '!', "'": "'", '.': '.', '**': '\\ast\\ast' };
        return map[t.v] !== undefined ? map[t.v] : esc(t.v);
      }
      if (t.t === 'id') return wordTex(t.v);
      if (t.t === 'raw') return t.v + ' ';
      return esc(t.v);
    }

    canStartExpr(t) {
      if (!t) return false;
      if (t.t === 'op' && ['+', '-', '+-', '-+'].includes(t.v)) return true;
      return this.canStartAtom(t);
    }
    canStartAtom(t) {
      if (!t) return false;
      if (t.t === 'num' || t.t === 'raw' || t.t === 'str' || t.t === 'sym') return true;
      if (t.t === 'id') return !(t.v in REL_WORDS) && !TEXT_WORDS.has(t.v) && !(t.v in BIN_WORDS) && t.v !== 'choose' && t.v !== 'over';
      if (t.t === 'op') {
        if (['(', '[', '{', '||'].includes(t.v)) return true;
        if (t.v === '|') return !(t.sp && t.spAfter) && this.hasMatchingBar(t);
        if (t.v === '...') return false;
        if (t.v === '<') return this.angleAhead(t);
      }
      return false;
    }

    // ---- expr: terms joined by + - ----
    expr(stop) {
      let out = '';
      let first = true;
      while (!this.end()) {
        const t = this.peek();
        if (stop && stop(t)) break;
        if (t.t === 'op' && ['+', '-', '+-', '-+'].includes(t.v)) {
          this.next();
          const sym = { '+': '+', '-': '-', '+-': '\\pm', '-+': '\\mp' }[t.v];
          out += first ? sym : ' ' + sym + ' ';
          first = false;
          const n = this.peek();
          if (!n || (stop && stop(n)) || !this.canStartAtom(n)) break;
          out += this.term(stop);
          continue;
        }
        if (!first) break;
        if (!this.canStartAtom(t)) break;
        out += this.term(stop);
        first = false;
      }
      return out;
    }

    // ---- term: fractions joined by *, spaces, word operators ----
    term(stop) {
      let out = this.fracLevel(stop).tex;
      while (!this.end()) {
        const t = this.peek();
        if (stop && stop(t)) break;
        if (this.isOp(t, '*')) {
          this.next();
          if (this.end() || (stop && stop(this.peek()))) { out += '\\ast'; break; }
          out += ' \\cdot ' + this.unaryFrac(stop); continue;
        }
        if (t.t === 'id' && t.v in BIN_WORDS) { this.next(); out += ' ' + BIN_WORDS[t.v] + ' ' + this.unaryFrac(stop); continue; }
        if (t.t === 'id' && t.v === 'choose') { this.next(); const r = this.fracLevel(stop); out = '\\binom{' + out + '}{' + (r.bare ?? r.tex) + '}'; continue; }
        if (t.t === 'id' && t.v === 'dot' && !this.isOp(this.peek(1), '(')) { this.next(); out += ' \\cdot ' + this.unaryFrac(stop); continue; }
        if (this.canStartAtom(t)) { out += ' ' + this.fracLevel(stop).tex; continue; }
        break;
      }
      return out;
    }
    unaryFrac(stop) {
      const t = this.peek();
      if (t && t.t === 'op' && (t.v === '-' || t.v === '+')) { this.next(); return t.v + this.fracLevel(stop).tex; }
      if (!this.canStartAtom(t)) return '';
      return this.fracLevel(stop).tex;
    }

    // ---- fraction: tight runs joined by / ----
    fracLevel(stop) {
      let left = this.tight(stop);
      while (this.isOp(this.peek(), '/') && !(stop && stop(this.peek()))) {
        this.next();
        let negDen = '';
        if (this.isOp(this.peek(), '-')) { this.next(); negDen = '-'; }
        if (!this.canStartAtom(this.peek())) { left = { tex: left.tex + '/', bare: null }; break; }
        const right = this.tight(stop);
        left = { tex: '\\frac{' + (left.bare ?? left.tex) + '}{' + negDen + (right.bare ?? right.tex) + '}', bare: null };
      }
      return left;
    }

    // ---- tight: factors written next to each other with no space ----
    tight(stop) {
      const first = this.postfix(stop);
      let out = first.tex, count = 1, bare = first.bare;
      while (!this.end()) {
        const t = this.peek();
        if (t.sp) break;
        if (stop && stop(t)) break;
        if (!this.canStartAtom(t)) break;
        if (t.t === 'op' && t.v === '|') break; // closing bar of |x| or ambiguous
        const nxt = this.postfix(stop);
        const sep = /[A-Za-z]$/.test(out) && /^[A-Za-z]/.test(nxt.tex) ? ' ' : '';
        out += sep + nxt.tex; count++;
      }
      return { tex: out, bare: count === 1 ? bare : null };
    }

    // ---- postfix: ^ _ ! ' deg ----
    postfix(stop) {
      let a = this.atom(stop);
      let tex = a.tex, bare = a.bare, touched = false;
      while (!this.end()) {
        const t = this.peek();
        if (stop && stop(t)) break;
        if (this.isOp(t, '_') ) { this.next(); tex += '_{' + this.script(stop, true) + '}'; touched = true; continue; }
        if (this.isOp(t, '^') || this.isOp(t, '**')) { this.next(); tex = this.ensureBase(tex) + '^{' + this.script(stop) + '}'; touched = true; continue; }
        if (this.isOp(t, '!') && !t.sp) { this.next(); tex += '!'; touched = true; continue; }
        if (this.isOp(t, "'") && !t.sp) { this.next(); tex += "'"; touched = true; continue; }
        if (this.isOp(t, '%') && !t.sp) { this.next(); tex += '\\%'; touched = true; continue; }
        if (t.t === 'id' && (t.v === 'deg' || t.v === 'degrees' || t.v === 'degree')) { this.next(); tex += '^{\\circ}'; touched = true; continue; }
        break;
      }
      return { tex, bare: touched ? null : bare };
    }
    ensureBase(tex) {
      // x^2^3 style or a base that already has a superscript -> wrap
      if (/\^\{[^}]*\}$/.test(tex) && !/^\\(sin|cos|tan)/.test(tex)) return '{' + tex + '}';
      return tex;
    }
    // exponent / subscript content
    script(stop, isSub) {
      const t = this.peek();
      if (!t) return '';
      if (this.isOp(t, '(')) {
        // group: strip the parentheses
        const g = this.group(stop);
        return g.bare ?? g.tex;
      }
      if (t.t === 'op' && (t.v === '-' || t.v === '+' || t.v === '+-')) {
        this.next();
        const sign = t.v === '+-' ? '\\pm' : t.v;
        const n = this.peek();
        if (!n || n.sp || !this.canStartAtom(n)) return sign;
        const s = this.scriptAtom(stop, isSub);
        return sign + s;
      }
      if (this.isOp(t, '*')) { this.next(); return '*'; }
      if (t.t === 'id' && t.v === 'T' ) { this.next(); return 'T'; }
      if (!this.canStartAtom(t)) return '';
      return this.scriptAtom(stop, isSub);
    }
    scriptAtom(stop, isSub) {
      const t = this.peek();
      // a word subscript like v_max, T_initial, a_ij
      if (t.t === 'id' && !isFuncWord(t.v) && !BIG_WORDS.has(t.v) && !SPECIAL_FUNCS.has(t.v) && !(t.v in ACCENTS)) {
        this.next();
        let tex = wordTex(t.v, isSub);
        // allow nested scripts: e^x^2
        if (isSub) return tex;
        if (this.isOp(this.peek(), '^')) { this.next(); tex += '^{' + this.script(stop) + '}'; }
        else if (this.isOp(this.peek(), '_')) { this.next(); tex += '_{' + this.script(stop, true) + '}'; }
        return tex;
      }
      if (isSub) { const a = this.atom(stop); return a.bare ?? a.tex; }
      const p = this.postfix(stop);
      return p.bare ?? p.tex;
    }

    // ---- groups ----
    group(stop) {
      const open = this.next().v;
      const closers = [')', ']', '}'];
      // matrix detection: [[...],[...]]  or  [a, b; c, d]
      if (open === '[' && this.isOp(this.peek(), '[')) {
        const save = this.i;
        const rows = [];
        let ok = true;
        while (this.isOp(this.peek(), '[')) {
          this.next();
          const cells = this.cells(t => this.isOp(t, ']'), true);
          if (!this.isOp(this.peek(), ']')) { ok = false; break; }
          this.next();
          rows.push(cells);
          if (this.isOp(this.peek(), ',')) this.next();
        }
        if (ok && this.isOp(this.peek(), ']')) {
          this.next();
          return { tex: '\\begin{bmatrix}' + rows.map(r => r.join(' & ')).join(' \\\\ ') + '\\end{bmatrix}', bare: null };
        }
        this.i = save;
      }
      const isClose = t => t.t === 'op' && closers.includes(t.v);
      // look ahead for top-level ';' -> matrix
      if ((open === '[' || open === '(') && this.hasTopLevel(';')) {
        const rows = [];
        while (true) {
          rows.push(this.cells(t => isClose(t) || this.isOp(t, ';'), true));
          if (this.isOp(this.peek(), ';')) { this.next(); continue; }
          break;
        }
        if (isClose(this.peek() || {})) this.next();
        const env = open === '[' ? 'bmatrix' : 'pmatrix';
        return { tex: '\\begin{' + env + '}' + rows.map(r => r.join(' & ')).join(' \\\\ ') + '\\end{' + env + '}', bare: null };
      }
      if (open === '{' && this.hasTopLevel(';')) {
        const rows = [];
        const condWord = t => this.isId(t, ['if', 'otherwise', 'when', 'for', 'else']);
        while (!this.end()) {
          const val = this.statement(t => isClose(t) || this.isOp(t, ';') || condWord(t));
          let cond = '';
          if (condWord(this.peek())) {
            const w = this.next().v;
            const rest = this.statement(t => isClose(t) || this.isOp(t, ';'));
            cond = '\\text{' + w + (rest ? ' ' : '') + '}' + rest;
          }
          rows.push(val + ' & ' + cond);
          if (this.isOp(this.peek(), ';')) { this.next(); continue; }
          break;
        }
        if (!this.end() && isClose(this.peek())) this.next();
        return { tex: '\\begin{cases}' + rows.join(' \\\\ ') + '\\end{cases}', bare: null };
      }
      const inner = this.statement(t => isClose(t));
      let close = { '(': ')', '[': ']', '{': '}' }[open];
      if (!this.end() && isClose(this.peek())) close = this.next().v;
      const texOpen = open === '{' ? '\\{' : open;
      const texClose = close === '}' ? '\\}' : close;
      const tex = wrap(texOpen, inner, texClose);
      return { tex, bare: open === '(' && close === ')' ? inner : null };
    }
    hasMatchingBar(t) {
      let k = this.toks.indexOf(t);
      if (k < 0) return false;
      let depth = 0;
      for (k = k + 1; k < this.toks.length; k++) {
        const x = this.toks[k];
        if (x.t !== 'op') continue;
        if (['(', '[', '{'].includes(x.v)) depth++;
        else if ([')', ']', '}'].includes(x.v)) { if (depth === 0) return false; depth--; }
        else if (x.v === '|' && depth === 0) return true;
      }
      return false;
    }
    angleAhead(t) {
      const idx = this.toks.indexOf(t);
      if (idx < 0 || !(t.sp || idx === 0 || this.isOp(this.toks[idx - 1], '(')) || t.spAfter) return false;
      let depth = 0;
      for (let k = idx + 1; k < this.toks.length; k++) {
        const x = this.toks[k];
        if (x.t !== 'op') continue;
        if (['(', '[', '{'].includes(x.v)) depth++;
        else if ([')', ']', '}'].includes(x.v)) { if (depth === 0) return false; depth--; }
        else if (depth === 0 && ['<', '=', '<=', '>='].includes(x.v)) return false;
        else if (depth === 0 && x.v === '>') return !x.sp;
      }
      return false;
    }
    angle(stop) {
      this.next();
      const inner = this.statement(x => this.isOp(x, '>'));
      if (this.isOp(this.peek(), '>')) this.next();
      return '\\left\\langle ' + inner + ' \\right\\rangle';
    }
    rowHasComma(stopRow) {
      let depth = 0;
      for (let k = this.i; k < this.toks.length; k++) {
        const t = this.toks[k];
        if (depth === 0 && stopRow(t)) return false;
        if (t.t !== 'op') continue;
        if (['(', '[', '{'].includes(t.v)) depth++;
        else if ([')', ']', '}'].includes(t.v)) { if (depth === 0) return false; depth--; }
        else if (t.v === ',' && depth === 0) return true;
      }
      return false;
    }
    hasTopLevel(ch) {
      let depth = 0;
      for (let k = this.i; k < this.toks.length; k++) {
        const t = this.toks[k];
        if (t.t !== 'op') continue;
        if (['(', '[', '{'].includes(t.v)) depth++;
        else if ([')', ']', '}'].includes(t.v)) { if (depth === 0) return false; depth--; }
        else if (t.v === ch && depth === 0) return true;
      }
      return false;
    }
    cells(stopRow, spaceSplit) {
      const cells = [];
      if (spaceSplit && !this.rowHasComma(stopRow)) {
        while (!this.end() && !stopRow(this.peek())) {
          const before = this.i;
          cells.push(this.unaryFrac(stopRow) || this.literal(this.next()));
          if (this.i === before) this.next();
        }
        return cells;
      }
      while (!this.end()) {
        cells.push(this.statement(t => stopRow(t) || this.isOp(t, ',')));
        if (this.isOp(this.peek(), ',')) { this.next(); continue; }
        break;
      }
      return cells;
    }
    // argument list: f(a, b) -> ['a','b']
    args(stop) {
      if (!this.isOp(this.peek(), '(')) return null;
      this.next();
      const isClose = t => this.isOp(t, ')') || this.isOp(t, ']');
      const out = this.cells(isClose);
      if (!this.end() && isClose(this.peek())) this.next();
      return out;
    }

    // ---- atoms ----
    atom(stop) {
      const t = this.peek();
      if (!t) return { tex: '', bare: null };
      if (t.t === 'num') {
        this.next();
        return { tex: t.v, bare: null };
      }
      if (t.t === 'raw') { this.next(); return { tex: t.v + ' ', bare: null }; }
      if (t.t === 'str') { this.next(); return { tex: '\\text{' + textEsc(t.v) + '}', bare: null }; }
      if (t.t === 'sym') { this.next(); return { tex: esc(t.v), bare: null }; }
      if (t.t === 'op') {
        if (['(', '[', '{'].includes(t.v)) return this.group(stop);
        if (t.v === '<') return { tex: this.angle(stop), bare: null };
        if (t.v === '|') {
          this.next();
          const inner = this.statement(x => this.isOp(x, '|'));
          if (this.isOp(this.peek(), '|')) this.next();
          return { tex: '\\left|' + inner + '\\right|', bare: null };
        }
        if (t.v === '||') {
          this.next();
          const inner = this.statement(x => this.isOp(x, '||'));
          if (this.isOp(this.peek(), '||')) this.next();
          return { tex: '\\left\\|' + inner + '\\right\\|', bare: null };
        }
        this.next();
        return { tex: this.literal(t), bare: null };
      }
      // identifiers
      this.next();
      const w = t.v;
      if (BIG_WORDS.has(w)) return { tex: this.bigOp(w, stop), bare: null };
      if (w === 'sqrt' || w === 'cbrt' || w === 'root') return { tex: this.sqrt(w, stop), bare: null };
      if (['abs', 'norm', 'floor', 'ceil'].includes(w) && this.isOp(this.peek(), '(')) {
        const a = this.args(stop).join(',\\ ');
        const [L, R] = { abs: ['|', '|'], norm: ['\\|', '\\|'], floor: ['\\lfloor', '\\rfloor'], ceil: ['\\lceil', '\\rceil'] }[w];
        return { tex: '\\left' + L + ' ' + a + ' \\right' + R, bare: null };
      }
      if (w === 'binom' && this.isOp(this.peek(), '(')) { const a = this.args(stop); return { tex: '\\binom{' + (a[0] || '') + '}{' + (a[1] || '') + '}', bare: null }; }
      if (w === 'frac' && this.isOp(this.peek(), '(')) { const a = this.args(stop); return { tex: '\\frac{' + (a[0] || '') + '}{' + (a[1] || '') + '}', bare: null }; }
      if ((w in ACCENTS || w === 'dot') && this.isOp(this.peek(), '(') && !this.peek().sp) {
        const a = this.args(stop).join(',');
        const cmd = w === 'dot' ? '\\dot' : ACCENTS[w];
        return { tex: cmd + '{' + a + '}', bare: null };
      }
      if (isFuncWord(w)) return { tex: this.func(w, stop), bare: null };
      if (w === 'partial' || w === 'del') {
        // "partial f" -> one unit so "partial f / partial x" makes a fraction
        let tex = '\\partial';
        if (this.isOp(this.peek(), '^')) { this.next(); tex += '^{' + this.script(stop) + '}'; }
        const n = this.peek();
        if (n && n.t === 'id' && n.sp && this.canStartAtom(n) && !isFuncWord(n.v) && !BIG_WORDS.has(n.v)) {
          const p = this.postfix(stop);
          tex += ' ' + p.tex;
        }
        return { tex, bare: null };
      }
      // single letter followed directly by digits -> subscript (x1 -> x_1)
      if (w.length === 1 && this.peek() && this.peek().t === 'num' && !this.peek().sp && /^[0-9]+$/.test(this.peek().v)) {
        const n = this.next();
        return { tex: w + '_{' + n.v + '}', bare: null };
      }
      return { tex: wordTex(w), bare: null };
    }

    sqrt(w, stop) {
      if (w === 'root') {
        const a = this.args(stop);
        if (a) return '\\sqrt[' + (a[0] || '') + ']{' + (a[1] || '') + '}';
        return '\\sqrt{}';
      }
      const idx = w === 'cbrt' ? '[3]' : '';
      if (this.isOp(this.peek(), '(')) { const g = this.group(stop); return '\\sqrt' + idx + '{' + (g.bare ?? g.tex) + '}'; }
      if (!this.canStartAtom(this.peek())) return '\\sqrt' + idx + '{\\ }';
      const p = this.postfix(stop);
      return '\\sqrt' + idx + '{' + (p.bare ?? p.tex) + '}';
    }

    func(w, stop) {
      let tex = funcTex(w);
      // powers / bases: sin^2 x, log_2 x, sin^-1 x
      for (let k = 0; k < 2; k++) {
        if (this.isOp(this.peek(), '^')) { this.next(); tex += '^{' + this.script(stop) + '}'; }
        else if (this.isOp(this.peek(), '_')) { this.next(); tex += '_{' + this.script(stop, true) + '}'; }
      }
      const n = this.peek();
      if (!n || (stop && stop(n))) return tex;
      if (this.isOp(n, '(')) {
        const g = this.group(stop);
        // allow "sin(x)^2"
        return tex + g.tex;
      }
      if (this.canStartAtom(n)) {
        const arg = this.tight(stop);
        return tex + ' ' + arg.tex;
      }
      return tex;
    }

    // ---- sum / prod / int / lim ----
    findWordAhead(word, maxLook, stop) {
      let depth = 0;
      for (let k = this.i; k < Math.min(this.toks.length, this.i + maxLook); k++) {
        const t = this.toks[k];
        if (t.t === 'op' && ['(', '[', '{'].includes(t.v)) depth++;
        else if (t.t === 'op' && [')', ']', '}'].includes(t.v)) { if (depth === 0) return -1; depth--; }
        else if (depth === 0 && t.t === 'id' && t.v === word) return k;
        else if (depth === 0 && t.t === 'op' && (t.v === ',' || t.v === ';')) return -1;
      }
      return -1;
    }
    bounds(stop, allowBare) {
      // returns [lower, upper] in tex or null
      let lo = null, hi = null;
      // LaTeX-ish: _lower ^upper (either order)
      for (let k = 0; k < 2; k++) {
        if (this.isOp(this.peek(), '_')) { this.next(); lo = this.script(stop, true); }
        else if (this.isOp(this.peek(), '^')) { this.next(); hi = this.script(stop); }
      }
      if (lo !== null || hi !== null) return [lo, hi];
      const hasFrom = this.isId(this.peek(), 'from');
      if (hasFrom) this.next();
      if (hasFrom || (allowBare && this.findWordAhead('to', 8) > this.i)) {
        lo = this.statement(t => this.isId(t, 'to') || this.isId(t, 'from') || (stop && stop(t)));
        if (this.isId(this.peek(), 'to')) {
          this.next();
          if (this.findWordAhead('of', 10) > -1) hi = this.statement(t => this.isId(t, 'of') || (stop && stop(t)));
          else hi = this.scriptLike(stop);
        }
        return [lo, hi];
      }
      return null;
    }
    scriptLike(stop) {
      const t = this.peek();
      if (!t) return '';
      if (t.t === 'op' && (t.v === '-' || t.v === '+')) {
        this.next();
        return t.v + this.scriptLike(stop);
      }
      if (!this.canStartAtom(t)) return '';
      const p = this.postfix(stop);
      return p.bare ?? p.tex;
    }
    limits(lo, hi) {
      let s = '';
      if (lo !== null && lo !== undefined && lo !== '') s += '_{' + lo + '}';
      if (hi !== null && hi !== undefined && hi !== '') s += '^{' + hi + '}';
      return s;
    }
    isDifferential(t) {
      if (!t || t.t !== 'id') return false;
      if (!/^d([A-Za-z]|theta|phi|r|t|u|v|w|s|alpha|omega|lambda|tau|rho|sigma|mu)$/.test(t.v) && t.v !== 'dA' && t.v !== 'dV' && t.v !== 'dS') {
        return false;
      }
      // dy/dx inside an integral is a fraction, not the end
      const n = this.toks[this.toks.indexOf(t) + 1];
      if (n && n.t === 'op' && n.v === '/' && !n.sp) return false;
      return true;
    }
    diffTex(v) { return 'd' + (v.length > 2 ? '\\' + v.slice(1) : v.slice(1)); }

    bigOp(w, stop) {
      if (w === 'lim' || w === 'limit') return this.limit(stop);
      const isInt = ['int', 'integral', 'integrate', 'iint', 'iiint', 'oint'].includes(w);
      let cmd = { sum: '\\sum', prod: '\\prod', product: '\\prod', int: '\\int', integral: '\\int', integrate: '\\int', iint: '\\iint', iiint: '\\iiint', oint: '\\oint' }[w];
      let b = null;
      if (this.isId(this.peek(), 'of')) this.next();
      else { b = this.bounds(stop, true); if (this.isId(this.peek(), 'of')) this.next(); }
      if (!isInt) {
        const body = this.term(stop);
        return cmd + (b ? this.limits(b[0], b[1]) : '') + ' ' + body;
      }
      const bodyStop = t => (stop && stop(t)) || this.isDifferential(t) || this.isId(t, 'from');
      const body = this.statement(bodyStop);
      if (!b && this.isId(this.peek(), 'from')) b = this.bounds(stop, true);
      let diffs = '';
      while (this.isDifferential(this.peek())) { diffs += '\\,' + this.diffTex(this.next().v); }
      if (!b && this.isId(this.peek(), 'from')) b = this.bounds(stop, true);
      return cmd + (b ? this.limits(b[0], b[1]) : '') + ' ' + body + diffs;
    }

    limit(stop) {
      let sub = null;
      if (this.isOp(this.peek(), '_')) { this.next(); sub = this.script(stop, true); }
      else {
        if (this.isId(this.peek(), 'of')) {
          // "limit of BODY as x -> a"
          this.next();
          const body = this.term(t => (stop && stop(t)) || this.isId(t, 'as'));
          let s = '';
          if (this.isId(this.peek(), 'as')) { this.next(); s = this.approach(stop); }
          return '\\lim' + (s ? '_{' + s + '}' : '') + ' ' + body;
        }
        if (this.isId(this.peek(), 'as')) this.next();
        const save = this.i;
        const s = this.approach(stop);
        if (s !== null) sub = s; else this.i = save;
      }
      if (this.isId(this.peek(), 'of')) this.next();
      const body = this.term(stop);
      return '\\lim' + (sub ? '_{' + sub + '}' : '') + ' ' + body;
    }
    approach(stop) {
      // x -> a   |  x to a  |  x approaches a ; returns tex or null
      const v = this.peek();
      if (!v || !this.canStartAtom(v)) return null;
      const save = this.i;
      const varTex = this.postfix(stop).tex;
      const arrow = this.peek();
      if (!(this.isOp(arrow, '->') || this.isId(arrow, ['to', 'approaches']))) { this.i = save; return null; }
      this.next();
      let target = this.scriptLike(stop);
      // one-sided: 0+ / 0- / 0^+
      const n = this.peek();
      if (n && n.t === 'op' && (n.v === '+' || n.v === '-') && !n.sp && (n.spAfter || this.i + 1 >= this.toks.length)) {
        this.next();
        target += '^{' + n.v + '}';
      }
      return varTex + ' \\to ' + target;
    }
  }

  function toTex(src) {
    src = (src || '').trim();
    if (!src) return '';
    try {
      const p = new Parser(tokenize(src));
      return p.statement(null).replace(/\s+/g, ' ').trim();
    } catch (e) {
      return '\\text{' + textEsc(src) + '}';
    }
  }

  function toTexParts(src) {
    src = (src || '').trim();
    const clean = x => x.replace(/\s+/g, ' ').trim();
    if (!src) return { lhs: '', rhs: '', rel: false };
    try {
      const p = new Parser(tokenize(src));
      const rec = {};
      const full = p.statement(null, rec);
      if (rec.k === undefined) return { lhs: full, rhs: '', rel: false };
      return { lhs: clean(rec.parts.slice(0, rec.k).join('')), rhs: clean(rec.parts.slice(rec.k).join('')), rel: true };
    } catch (e) {
      return { lhs: toTex(src), rhs: '', rel: false };
    }
  }

  const api = { toTex, toTexParts, tokenize };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MathParse = api;
})(typeof window !== 'undefined' ? window : globalThis);
