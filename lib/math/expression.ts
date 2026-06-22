type Token = { type: 'number'; value: number } | { type: 'name'; value: string } | { type: 'operator'; value: string } | { type: 'left' } | { type: 'right' }

type Node =
  | { type: 'number'; value: number }
  | { type: 'variable' }
  | { type: 'unary'; operator: '+' | '-'; value: Node }
  | { type: 'binary'; operator: '+' | '-' | '*' | '/' | '^'; left: Node; right: Node }
  | { type: 'function'; name: keyof typeof mathFunctions; value: Node }

const mathFunctions = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  log: Math.log10,
  ln: Math.log,
  exp: Math.exp,
}

function tokenize(source: string): Token[] {
  const input = source.toLowerCase().replace(/^\s*y\s*=\s*/, '')
  const tokens: Token[] = []
  let index = 0
  while (index < input.length) {
    const rest = input.slice(index)
    const whitespace = rest.match(/^\s+/)
    if (whitespace) {
      index += whitespace[0].length
      continue
    }
    const number = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)/)
    if (number) {
      tokens.push({ type: 'number', value: Number(number[0]) })
      index += number[0].length
      continue
    }
    const name = rest.match(/^[a-z]+/)
    if (name) {
      tokens.push({ type: 'name', value: name[0] })
      index += name[0].length
      continue
    }
    const character = input[index]
    if ('+-*/^'.includes(character)) tokens.push({ type: 'operator', value: character })
    else if (character === '(') tokens.push({ type: 'left' })
    else if (character === ')') tokens.push({ type: 'right' })
    else throw new Error('Unsupported character: ' + character)
    index += 1
  }
  return tokens
}

class Parser {
  private index = 0
  private readonly tokens: Token[]

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  parse() {
    if (!this.tokens.length) throw new Error('Enter a function to graph.')
    const node = this.expression()
    if (this.peek()) throw new Error('Check the expression near the end.')
    return node
  }

  private peek() { return this.tokens[this.index] }
  private take() { return this.tokens[this.index++] }
  private operator(value: string) {
    const token = this.peek()
    if (token?.type === 'operator' && token.value === value) {
      this.index += 1
      return true
    }
    return false
  }

  private expression(): Node {
    let node = this.term()
    while (true) {
      if (this.operator('+')) node = { type: 'binary', operator: '+', left: node, right: this.term() }
      else if (this.operator('-')) node = { type: 'binary', operator: '-', left: node, right: this.term() }
      else return node
    }
  }

  private term(): Node {
    let node = this.power()
    while (true) {
      if (this.operator('*')) node = { type: 'binary', operator: '*', left: node, right: this.power() }
      else if (this.operator('/')) node = { type: 'binary', operator: '/', left: node, right: this.power() }
      else if (this.startsPrimary(this.peek())) node = { type: 'binary', operator: '*', left: node, right: this.power() }
      else return node
    }
  }

  private power(): Node {
    let node = this.unary()
    if (this.operator('^')) node = { type: 'binary', operator: '^', left: node, right: this.power() }
    return node
  }

  private unary(): Node {
    if (this.operator('+')) return { type: 'unary', operator: '+', value: this.unary() }
    if (this.operator('-')) return { type: 'unary', operator: '-', value: this.unary() }
    return this.primary()
  }

  private startsPrimary(token?: Token) {
    return token?.type === 'number' || token?.type === 'name' || token?.type === 'left'
  }

  private primary(): Node {
    const token = this.take()
    if (!token) throw new Error('The expression is incomplete.')
    if (token.type === 'number') return { type: 'number', value: token.value }
    if (token.type === 'left') {
      const node = this.expression()
      if (this.take()?.type !== 'right') throw new Error('A closing parenthesis is missing.')
      return node
    }
    if (token.type === 'name') {
      if (token.value === 'x') return { type: 'variable' }
      if (token.value === 'pi') return { type: 'number', value: Math.PI }
      if (token.value === 'e') return { type: 'number', value: Math.E }
      if (!(token.value in mathFunctions)) throw new Error('Unknown function: ' + token.value)
      if (this.take()?.type !== 'left') throw new Error(token.value + ' needs parentheses.')
      const value = this.expression()
      if (this.take()?.type !== 'right') throw new Error('A closing parenthesis is missing.')
      return { type: 'function', name: token.value as keyof typeof mathFunctions, value }
    }
    throw new Error('Unexpected symbol in expression.')
  }
}

function evaluate(node: Node, x: number): number {
  if (node.type === 'number') return node.value
  if (node.type === 'variable') return x
  if (node.type === 'unary') return node.operator === '-' ? -evaluate(node.value, x) : evaluate(node.value, x)
  if (node.type === 'function') return mathFunctions[node.name](evaluate(node.value, x))
  const left = evaluate(node.left, x)
  const right = evaluate(node.right, x)
  if (node.operator === '+') return left + right
  if (node.operator === '-') return left - right
  if (node.operator === '*') return left * right
  if (node.operator === '/') return left / right
  return left ** right
}

export function compileExpression(expression: string) {
  const tree = new Parser(tokenize(expression)).parse()
  return (x: number) => {
    const result = evaluate(tree, x)
    return Number.isFinite(result) ? result : Number.NaN
  }
}
