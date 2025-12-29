import type { BkndConfig } from 'bknd'
import { boolean, date, em, entity, enumm, medium, number, systemEntity, text } from 'bknd'
import { createRuntimeApp } from 'bknd/adapter'
import { registerLocalMediaAdapter, writer, reader } from 'bknd/adapter/bun'
import { sqlite } from 'bknd/adapter/sqlite'
import { Api } from 'bknd/client'
import { hybrid, type HybridMode } from 'bknd/modes'
import { syncTypes, timestamps } from 'bknd/plugins'
import type { Context } from 'hono'
import { Hono } from 'hono'
import { writeFile } from 'node:fs/promises'
import { serveStatic } from 'hono/bun'

const local = registerLocalMediaAdapter()

const connection = sqlite({ url: 'file:./data.db' })
const config = hybrid({
  connection,
  config: {
    data: em(
      {
        pendingPartners: entity(
          'pendingPartners',
          {
            name: text(),
            contactName: text({
              label: 'Contact Name',
            }),
            contactEmail: text({
              label: 'Contact Email',
            }),
            website: text(),
            whyWantListed: text({
              label: 'Reason to be Listed',
            }),
            whyPartner: text({
              label: 'Reason to Partner',
            }),
            logo: medium(),
            adminNotes: text({
              label: 'Admin Notes',
            }),
            status: enumm<'pending' | 'rejected' | 'approved'>({
              enum: [
                { value: 'pending', label: 'Pending' },
                { value: 'rejected', label: 'Rejected' },
                { value: 'approved', label: 'Approved' },
              ],
            }),
          },
          {
            name: 'Pending Partners',
            name_singular: 'Pending Partner',
            primary_format: 'uuid',
          }
        ),
        partners: entity(
          'partners',
          {
            name: text(),
            contactName: text({
              label: 'Contact Name',
            }),
            contactEmail: text({
              label: 'Contact Email',
            }),
            website: text(),
            logo: medium(),
            approvedAt: date({
              label: 'Approved At',
            }),
          },
          {
            name: 'Partners',
            name_singular: 'Partner',
            primary_format: 'uuid',
          }
        ),
        meditations: entity(
          'meditations',
          {
            title: text(),
            description: text(),
            content: medium(),
            duration: number(),
            thumbnail: medium(),
            listens: number(),
            published: boolean({ default_value: true }),
          },
          {
            name: 'Meditations',
            primary_format: 'uuid',
            name_singular: 'Meditation',
          }
        ),
        media: systemEntity('media', {}),
      },
      ({ relation, index }, { pendingPartners, partners, meditations, media }) => {
        relation(meditations).manyToOne(partners)
        relation(pendingPartners).polyToOne(media, {
          mappedBy: 'logo',
        })
        relation(partners).polyToOne(media, {
          mappedBy: 'logo',
        })
        relation(meditations).polyToOne(media, {
          mappedBy: 'content',
        })
        relation(meditations).polyToOne(media, {
          mappedBy: 'thumbnail',
        })

        index(meditations)
          // .on(['created_at'])
          .on(['published'])
      }
    ).toJSON(),
    media: {
      enabled: true,
      adapter: local({
        path: './public/uploads',
      }),
    },
  },
  onBuilt: async (app) => {
    // This can only really run locally because it requires
    // file access...
    try {
      await app.em.schema().sync({ force: true })
    } catch (e) {
      console.error(e)
    }
  },
  options: {
    mode: process.env.NODE_ENV === 'development' ? 'db' : 'code',
    manager: {
      secrets: process.env,
    },
    plugins: [
      timestamps({
        entities: ['pendingPartners', 'partners', 'meditations'],
        setUpdatedOnCreate: true,
      }),

      syncTypes({
        // whether to enable the plugin, make sure to disable in production
        enabled: true,
        // your writing function (required)
        write: async (et) => {
          console.log('WRITE FILES')
          await writeFile('bknd-types.d.ts', et.toString(), 'utf-8')
        },
      }),
    ],
  },
  // @ts-expect-error - I know this says it's not a key, but it does in fact work.
  adminOptions: {
    adminBasepath: '/admin',
    logoReturnPath: '/../',
  },
  writer,
  reader,
  typesFilePath: 'bknd-types.d.ts',
  isProduction: process.env?.PROD === 'true',
  syncSchema: {
    force: true,
    drop: true,
  },
}) as HybridMode<BkndConfig>

export async function getBkndApp(context: Context) {
  const app = await createRuntimeApp(config, context)
  return app
}

export async function bkndAppFetch(context: Context) {
  const app = await getBkndApp(context)
  return app.fetch(context.req.raw)
}

export async function getApi(context: Context) {
  const bkndApp = await getBkndApp(context)
  const api = new Api({
    fetcher: bkndApp.server.request as typeof fetch,
  })
  return api
}

export const bkndApp = new Hono()

bkndApp.use('/assets/*', serveStatic({ root: './node_modules/bknd/dist/static' }))
bkndApp.all('/api/*', async (c) => bkndAppFetch(c))
bkndApp.get('/admin', async (c) => bkndAppFetch(c))
bkndApp.get('/admin/*', async (c) => bkndAppFetch(c))
