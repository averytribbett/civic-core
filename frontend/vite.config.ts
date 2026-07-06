import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const widgetRoot = path.resolve(rootDir, '../widget')

const MIME: Record<string, string> = {
  '.js': 'application/javascript',
  '.html': 'text/html',
  '.css': 'text/css',
}

function widgetPlugin(): Plugin {
  const serveWidget = (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void
  ) => {
    const url = (req.url ?? '').split('?')[0]
    let filePath: string | null = null

    if (url === '/widget.js' || url === '/') {
      filePath = path.join(widgetRoot, 'cdn/widget.js')
    } else if (url.startsWith('/app/')) {
      filePath = path.join(widgetRoot, url.slice(1))
    }

    if (!filePath || !fs.existsSync(filePath)) {
      next()
      return
    }

    const ext = path.extname(filePath)
    res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream')
    fs.createReadStream(filePath).pipe(res)
  }

  const copyWidgetToDist = () => {
    const outDir = path.resolve(rootDir, 'dist/widget')
    fs.mkdirSync(outDir, { recursive: true })
    fs.copyFileSync(
      path.join(widgetRoot, 'cdn/widget.js'),
      path.join(outDir, 'widget.js')
    )
    fs.cpSync(path.join(widgetRoot, 'app'), path.join(outDir, 'app'), {
      recursive: true,
    })
  }

  return {
    name: 'civic-widget',
    configureServer(server) {
      server.middlewares.use('/widget', serveWidget)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/widget', serveWidget)
    },
    closeBundle: copyWidgetToDist,
  }
}

export default defineConfig({
  plugins: [react(), widgetPlugin()],
})
