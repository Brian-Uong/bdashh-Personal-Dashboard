const comparisons = {
  '<': (value, limit) => value < limit,
  '<=': (value, limit) => value <= limit,
  '=': (value, limit) => value === limit,
  '<>': (value, limit) => value !== limit,
  '>=': (value, limit) => value >= limit,
  '>': (value, limit) => value > limit
};
const conditionToken = /^\[\s*(<=|<>|>=|<|=|>)\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*\]$/i;

function activeNumericSection(format, value) {
  // A sticky scan consumes each literal, escape, padding code and bracket as
  // a unit. Only an unescaped separator outside them starts a new section.
  const lexer = /"[^"]*"|[\\_*][\s\S]|\[[^\]]*\]|[^"\\_*\[\]]/gy;
  const sections = [{code: '', condition: null}];
  let index = 0;
  for (const [token] of format.matchAll(lexer)) {
    index += token.length;
    const section = sections.at(-1);
    if (token === ';') {
      sections.push({code: '', condition: null});
    } else if (token[0] === '[') {
      const condition = conditionToken.exec(token);
      if (condition) {
        const limit = Number(condition[2]);
        if (section.condition || !Number.isFinite(limit)) return '';
        section.condition = test => comparisons[condition[1]](test, limit);
      } else if (/^\[\s*[<=>]/.test(token)) {
        return '';
      } else if (/^\[(?:hh?|mm?|ss?)\]$/i.test(token)) {
        // Elapsed time can be followed by minute tokens, as in [h]:mm.
        section.code += /s/i.test(token) ? ' s ' : ' h ';
      }
    } else {
      section.code += token.length === 1 ? token : ' ';
    }
  }
  if (index !== format.length || sections.length > 4) return '';
  if (sections.length === 4 || sections.at(-1).code.includes('@')) sections.pop();

  const conditioned = sections.filter(section => section.condition);
  if (conditioned.length) {
    // Excel allows at most two conditions in its numeric sections. When
    // neither matches, the unconditional section is the fallback, if present.
    if (conditioned.length > 2 || sections[2]?.condition) return '';
    return (conditioned.find(section => section.condition(value)) ??
      sections.find(section => !section.condition))?.code ?? '';
  }
  const indexBySign = value < 0 && sections.length > 1 ? 1 :
    value === 0 && sections.length === 3 ? 2 : 0;
  return sections[indexBySign]?.code ?? '';
}

export function hasActiveCalendarFormat(format, value, ssf) {
  if (typeof format !== 'string' || !Number.isFinite(value)) return false;
  const section = activeNumericSection(format, value);
  if (!section || !ssf.is_date(section)) return false;
  // Month tokens next to hours or seconds can represent minutes. Strip
  // AM/PM and numeric exponents before checking the actual date/time tokens.
  const units = section.toLowerCase().replace(/am\/pm|a\/p|e[+-]0+/g, '').match(/y+|d+|e+|g+|m+|h+|s+/g) ?? [];
  return units.some((unit, i) =>
    /^[ydeg]/.test(unit) || (unit[0] === 'm' &&
      (unit.length >= 3 || (units[i - 1]?.[0] !== 'h' && units[i + 1]?.[0] !== 's'))));
}
