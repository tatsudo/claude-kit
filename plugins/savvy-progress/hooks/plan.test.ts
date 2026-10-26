import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const PLUGIN = 'savvy-progress'
const PLAN = 'mcp__ccd_turn__update_plan'
const WRAP = 'mcp__ccd_turn__wrap_up'
const band = { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 100, scroll: { offset: 0, bodyRows: 4 }, view: {} }

// The app's tools are not the mod's: the test answers them as the app would.
function app(on: On) {
  on('tool.call', { tool: PLAN }, async () => ({ result: 'Plan updated.' }) as never)
  on('tool.call', { tool: WRAP }, async () => ({ result: 'Shown.' }) as never)
}

// With no band to draw the mod hands on to the engine, which a test does not have.
async function isEmpty($: Engine): Promise<boolean> {
  try {
    await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: band })
    return false
  } catch (err) {
    return String(err).includes('no implementation for ui.render')
  }
}

async function row($: Engine): Promise<string> {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: band })
  const svg = await ui.find({ type: 'Svg' })
  await ui.unmount()
  return svg ? String(svg.props.source) : ''
}

const items = [
  { content: 'Read the code', status: 'in_progress' },
  { content: 'Write the fix', status: 'pending' },
  { content: 'Run the tests', status: 'pending' },
]

test('plan: the app task list drives the band without any skill', async ($, on) => {
  app(on)
  expect(await isEmpty($)).toBe(true)

  expect(await $.tool.call({ tool: PLAN, items, scope: 'first_task' } as never)).toMatchObject({ result: 'Plan updated.' })
  let drawn = await row($)
  expect(drawn).toContain('Read the code')
  expect(drawn).toContain('Tasks 0/3')

  await $.tool.call({ tool: PLAN, advance: true } as never)
  drawn = await row($)
  expect(drawn).toContain('Write the fix')
  expect(drawn).toContain('Tasks 1/3')

  await $.tool.call({ tool: PLAN, done: [2], start: 3 } as never)
  drawn = await row($)
  expect(drawn).toContain('Run the tests')
  expect(drawn).toContain('Tasks 2/3')

  expect(await $.tool.call({ tool: WRAP, recap: 'Done.' } as never)).toMatchObject({ result: 'Shown.' })
  expect(await row($)).toContain('Done')
})

test('plan: a new list replaces a finished one', async ($, on) => {
  app(on)
  await $.tool.call({ tool: PLAN, items } as never)
  await $.tool.call({ tool: WRAP, recap: 'Done.' } as never)
  await $.tool.call({ tool: PLAN, items: [{ content: 'Next task', status: 'in_progress' }, { content: 'Check it', status: 'pending' }] } as never)
  const drawn = await row($)
  expect(drawn).toContain('Next task')
  expect(drawn).toContain('Tasks 0/2')
})

test('plan: a subagent task list does not move the band', async ($, on) => {
  app(on)
  await $.tool.call({ tool: PLAN, items } as never)
  await $.tool.call({ tool: PLAN, agentId: 'a1', items: [{ content: 'Hijacked', status: 'completed' }] } as never)
  const drawn = await row($)
  expect(drawn).toContain('Read the code')
  expect(drawn).not.toContain('Hijacked')
})

test('plan: wrap_up with no task list draws nothing', async ($, on) => {
  app(on)
  await $.tool.call({ tool: WRAP, recap: 'Answered.' } as never)
  expect(await isEmpty($)).toBe(true)
})
