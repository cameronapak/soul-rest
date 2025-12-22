import { createRuntimeApp } from 'bknd/adapter'
import { em, entity, text, number, boolean, enumm, date } from 'bknd'
import { sqlite } from 'bknd/adapter/sqlite'
import type { BkndConfig } from 'bknd'
import { syncTypes, timestamps } from 'bknd/plugins'
import { Api } from 'bknd/client'
import type { Context } from 'hono'
import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import type { CodeMode } from 'bknd/modes'
import { writer } from 'bknd/adapter/bun'

const connection = sqlite({ url: 'file:./data.db' })
const config = {
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
            logoUrl: text({
              label: 'Logo URL',
            }),
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
            logoUrl: text({
              label: 'Logo URL',
            }),
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
            contentUrl: text({
              label: 'Content URL',
            }),
            partnerId: text({
              label: 'Partner ID',
            }),
            duration: number(),
            thumbnailUrl: text({
              label: 'Thumbnail Url',
            }),
            listens: number(),
            published: boolean({ default_value: true }),
          },
          {
            name: 'Meditations',
            primary_format: 'uuid',
            name_singular: 'Meditation',
          }
        ),
      },
      ({ relation }, { meditations, partners }) => {
        relation(meditations).manyToOne(partners, {
          mappedBy: 'partnerId',
        })
      }
    ).toJSON(),
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
    mode: 'code',
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
          console.log('WRITE')
          await Bun.write('bknd-types.d.ts', et.toString())
        },
      }),
    ],
  },
  adminOptions: {
    adminBasepath: '/admin',
    logoReturnPath: '/../',
  },
  writer,
  typesFilePath: 'src/bknd-types.d.ts',
  isProduction: process.env?.PROD === 'true',
  syncSchema: {
    force: true,
    drop: true,
  },
} as CodeMode<BkndConfig>

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
