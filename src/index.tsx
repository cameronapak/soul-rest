import { type Context, Hono } from 'hono'
import { bkndApp, getApi } from '../bknd.ts'
import { Layout } from './layouts'
import { EmptyState } from './components/empty-state.tsx'
import { Message } from './components/icons/message.tsx'

const app = new Hono()

app.route('/', bkndApp)

// Meditation Item component
const MeditationItem = ({ title, id, audioUrl }: { title: string; id: string; audioUrl: string }) => {
  return (
    <div id={`meditation-${id}`} class="flex items-center justify-between gap-4 p-4 border rounded-lg bg-card">
      <span class="font-medium">{title}</span>
      {/* @ts-expect-error - captions not needed for this simple POC */}
      <audio id={`audio-${id}`} src={audioUrl} controls class="w-full"></audio>
    </div>
  )
}

app.get('/', async (c) => {
  const bkndApi = await getApi(c)
  const { data: meditations } = await bkndApi.data.readMany('meditations', {
    where: {
      published: true,
    },
    with: {
      content: {},
    },
    sort: '-created_at',
    limit: 500,
  })

  return c.html(
    <Layout title="Meditations">
      <section class="flex flex-col gap-4 grow p-6">
        <h1 class="text-4xl font-bold">Meditations</h1>
        <a href="/admin" class="btn w-fit">
          Admin
        </a>

        <div id="meditations-container">
          {meditations && meditations.length > 0 ? (
            <div id="meditations" class="flex flex-col gap-4">
              {meditations.map((meditation) => {
                const content = meditation.content as { path?: string } | null
                const audioUrl = content?.path ? `/api/media/file/${content.path}` : ''
                return (
                  <MeditationItem key={meditation.id} id={meditation.id as string} title={meditation.title as string} audioUrl={audioUrl} />
                )
              })}
            </div>
          ) : (
            <EmptyState
              id="empty-state"
              title="No Meditations Yet"
              description="No meditations available. Check back soon!"
              icon={<Message />}
            />
          )}
        </div>
      </section>
    </Layout>
  )
})

app.post('/increment-listens/:meditationId', async (c: Context) => {
  const meditationId = c.req.param('meditationId')

  if (!meditationId) {
    return c.json({ error: 'Meditation ID is required' }, 400)
  }

  try {
    const bkndApi = await getApi(c)
    const meditation = await bkndApi.data.readOne('meditations', meditationId)
    const currentListens = (meditation.data as { listens?: number })?.listens || 0

    await bkndApi.data.updateOne('meditations', meditationId, {
      listens: currentListens + 1,
    })

    return c.json({ success: true })
  } catch (error) {
    console.error('Error incrementing listens:', error)
    return c.json({ error: 'Failed to increment listens' }, 500)
  }
})

app.notFound((c) => {
  return c.html(`Path not found: ${c.req.url}`)
})

export default {
  port: 3000,
  fetch: app.fetch,
}
