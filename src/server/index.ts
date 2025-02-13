/*****
 License
 --------------
 Copyright © 2020 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the
 Apache License, Version 2.0 (the 'License') and you may not use these files
 except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files
 are distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 KIND, either express or implied. See the License for the specific language
 governing permissions and limitations under the License.
 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 - Vijay Kumar Guthi <vijaya.guthi@modusbox.com>

 --------------
 ******/
// workaround for lack of typescript types for mojaloop dependencies
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../ambient.d.ts"/>
import express from 'express'
import { createProxyMiddleware, Filter, Options, RequestHandler } from 'http-proxy-middleware'

import Config from '../shared/config'
import { addUserToExtensionList } from './modifiers/central-admin'
import Logger from '@mojaloop/central-services-logger'

const app = express()

async function setProxyBody (proxyReq: any, body: any) {
  const newBody = JSON.stringify(body)
  proxyReq.setHeader('content-length', newBody.length)
  proxyReq.write(newBody)
  proxyReq.end()
}

function getUserId (headers: any) {
  return headers['x-email']
}
// proxy middleware options
const commonOptions = {
  changeOrigin: true,
  logLevel: <'error' | 'debug' | 'info' | 'warn' | 'silent' | undefined>'debug',
  proxyTimeout: Config.PROXY_TIMEOUT
}
const centralAdminOptions = {
  ...commonOptions,
  target: Config.CENTRAL_ADMIN_URL,
  pathRewrite: {
    '^/central-admin': ''
  },
  onError: function (_err: any, _req: any, res: any) {
    res.writeHead(500, {
      'Content-Type': 'text/plain'
    })
    res.end('Something went wrong while proxying the request.')
  },
  onProxyReq: function (proxyReq: any, req: any) {
    if (!req.body || !Object.keys(req.body).length) {
      return
    }
    const userid = getUserId(req.headers)
    if (req.path === '/post' && req.method === 'POST') {
      const { body } = addUserToExtensionList(userid, req.headers, req.body)
      setProxyBody(proxyReq, body)
    } else if (req.path.match(/\/participants\/.*\/accounts\/.*/g) && req.method === 'POST') {
      const { body } = addUserToExtensionList(userid, req.headers, req.body)
      setProxyBody(proxyReq, body)
    }
  }
}

async function run (): Promise<void> {
  app.use(express.json())
  // app.use(express.urlencoded())
  app.use('/central-admin/*', createProxyMiddleware(centralAdminOptions))
  app.listen(Config.PORT)
  Logger.info(`service is running on port ${Config.PORT}`)
}

export default {
  run
}
