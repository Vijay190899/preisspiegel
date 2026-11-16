import { describe, expect, it } from 'vitest'
import { excerptItem } from './gaebExcerpt'

const xml = [
  '<GAEB>',
  '  <Itemlist>',
  '    <Item ID="P0001" RNoPart="0010">',
  '      <Qty>3.000</Qty>',
  '    </Item>',
  '    <Item ID="P0002" RNoPart="0020">',
  '      <Qty>1.000</Qty>',
  '      <QU>St</QU>',
  '      <UP>4280.00</UP>',
  '      <Description>',
  '        <OutlineText>',
  '          <p><span>Anschlussverteilerschrank 250 A</span></p>',
  '        </OutlineText>',
  '      </Description>',
  '    </Item>',
  '  </Itemlist>',
  '</GAEB>',
].join('\n')

describe('excerptItem', () => {
  it('returns the lines of the item, numbered as in the file', () => {
    const excerpt = excerptItem(xml, 'P0002', 'UP')!
    expect(excerpt.firstLine).toBe(6)
    expect(excerpt.lines[0]).toContain('<Item ID="P0002"')
    expect(excerpt.lines.at(-1)).toContain('</Item>')
    expect(excerpt.lines).toHaveLength(10)
  })

  it('marks the line that carries the value', () => {
    const excerpt = excerptItem(xml, 'P0002', 'UP')!
    expect([...excerpt.marked].map((i) => excerpt.lines[i]?.trim())).toEqual([
      '<UP>4280.00</UP>',
    ])
  })

  it('marks every line of an element that spans several', () => {
    const excerpt = excerptItem(xml, 'P0002', 'OutlineText')!
    expect(excerpt.marked.size).toBe(3)
  })

  it('drops the indentation the lines share and keeps the nesting', () => {
    const excerpt = excerptItem(xml, 'P0002', 'UP')!
    expect(excerpt.lines[0]).toBe('<Item ID="P0002" RNoPart="0020">')
    expect(excerpt.lines[1]).toBe('  <Qty>1.000</Qty>')
  })

  it('marks the item line itself for the ordinal number', () => {
    const excerpt = excerptItem(xml, 'P0002', 'RNoPart')!
    expect([...excerpt.marked]).toEqual([0])
  })

  it('does not confuse an item with one whose ID starts the same', () => {
    const excerpt = excerptItem(xml, 'P0001', 'Qty')!
    expect(excerpt.firstLine).toBe(3)
    expect(excerpt.lines).toHaveLength(3)
  })

  it('returns null for an item the file does not have', () => {
    expect(excerptItem(xml, 'P9999', 'Qty')).toBeNull()
  })

  it('marks nothing when the item lacks the element', () => {
    expect(excerptItem(xml, 'P0001', 'UP')!.marked.size).toBe(0)
  })
})
